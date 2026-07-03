/**
 * Deploy Lucent to Stellar testnet:
 *
 *   1. Use the USDC Stellar Asset Contract as the underlying SEP-41 asset
 *      (from the UNDERLYING_TOKEN env var).
 *   2. Deploy verifier + auditor + token (constructor wires them together).
 *   3. Register all six circuit verification keys in the verifier.
 *   4. Register one auditor Grumpkin key (id 0).
 *   5. Assert the contract's stored address-as-field equals the SDK's
 *      `addressToField(token)` — the Poseidon2 parity guard.
 *   6. Deploy PayrollVault + PrivateEscrow factory.
 *   7. Write deployments/testnet.json (and the app's deployment.json mirror).
 *
 * Usage: UNDERLYING_TOKEN=<USDC SAC> pnpm --filter @lucent/sdk exec tsx ../../scripts/deploy.ts
 * Deployer identity: the `admin` key in the stellar CLI config.
 */

import { xdr, Address } from "@stellar/stellar-sdk";

import {
  NETWORK, RPC_URL, PASSPHRASE, WASM, REPO_ROOT,
  publicKey, secret, readVk, saveDeployment, deploy, uploadWasm, type Deployment,
} from "./_shared.js";
import { ChainClient, keypairSigner } from "../packages/sdk/src/chain/client.js";
import { scvStruct } from "../packages/sdk/src/chain/payload.js";
import { addressToField } from "../packages/sdk/src/crypto/address.js";
import { randomScalar, toHex32, fromBytesBE } from "../packages/sdk/src/crypto/field.js";
import { H, scalarMul, pointToBytes, pointCoords } from "../packages/sdk/src/crypto/grumpkin.js";
import { CIRCUIT_TYPE } from "../packages/sdk/src/crypto/constants.js";

const addr = (a: string): xdr.ScVal => new Address(a).toScVal();
const optAddr = (a: string | null): xdr.ScVal => (a ? addr(a) : xdr.ScVal.scvVoid());

const DEPLOYER = "admin";

// The underlying SEP-41 asset the confidential token wraps. Must be the USDC
// Stellar Asset Contract on the target network — derive with:
//   stellar contract id asset --asset USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 --network testnet
const UNDERLYING = process.env.UNDERLYING_TOKEN;
if (!UNDERLYING) throw new Error("UNDERLYING_TOKEN env var required. Set to USDC SAC address.");

// vk.bin filename → CircuitType discriminant.
const VK_FILES: ReadonlyArray<[string, number]> = [
  ["register", CIRCUIT_TYPE.Register],
  ["withdraw", CIRCUIT_TYPE.Withdraw],
  ["transfer", CIRCUIT_TYPE.Transfer],
  ["spender_transfer", CIRCUIT_TYPE.SpenderTransfer],
  ["set_spender", CIRCUIT_TYPE.SetSpender],
  ["revoke_spender", CIRCUIT_TYPE.RevokeSpender],
];

async function main(): Promise<void> {
  const deployerPub = publicKey(DEPLOYER);
  console.log(`deployer ${DEPLOYER} = ${deployerPub}`);

  // 1. Underlying SEP-41 asset — the USDC SAC, from UNDERLYING_TOKEN.
  const underlying = UNDERLYING;
  console.log(`underlying (USDC SAC) = ${underlying}`);

  // 2. Deploy registries + the compliance policy + token. The policy contract
  //    has no dependency on the token (Policy::is_authorized takes the token
  //    address as a call-time argument, not a constructor one), so it can be
  //    deployed independently and wired onto the token afterward.
  const verifier = deploy(WASM.verifier, DEPLOYER, ["--admin", deployerPub, "--manager", deployerPub]);
  console.log(`verifier = ${verifier}`);
  const auditor = deploy(WASM.auditor, DEPLOYER, ["--admin", deployerPub, "--manager", deployerPub]);
  console.log(`auditor = ${auditor}`);
  const policy = deploy(WASM.policy, DEPLOYER, ["--admin", deployerPub]);
  console.log(`policy = ${policy}`);

  const client = new ChainClient({
    rpcUrl: RPC_URL,
    networkPassphrase: PASSPHRASE,
    contracts: { token: "", verifier, auditor },
  });
  const ledgerBeforeToken = await client.latestLedger();

  const token = deploy(WASM.token, DEPLOYER, [
    "--underlying_asset", underlying,
    "--verifier", verifier,
    "--auditor", auditor,
    "--admin", deployerPub,
  ]);
  console.log(`token = ${token}`);
  client.cfg.contracts.token = token;

  const signer = keypairSigner(secret(DEPLOYER), PASSPHRASE);

  // 3. Register the six verification keys.
  for (const [name, circuitType] of VK_FILES) {
    const vk = readVk(name);
    await client.invoke(
      verifier,
      "register_verification_key",
      [
        xdr.ScVal.scvU32(circuitType),
        xdr.ScVal.scvBytes(Buffer.from(vk)),
        new Address(deployerPub).toScVal(),
      ],
      signer,
    );
    console.log(`  registered VK ${name} (circuit ${circuitType}, ${vk.length}B)`);
  }

  // 4. Register one auditor key (id 0). K_aud = a·H for a random scalar a.
  const auditorSecret = randomScalar();
  const kAud = scalarMul(auditorSecret, H);
  await client.invoke(
    auditor,
    "register_key",
    [
      xdr.ScVal.scvU32(0),
      xdr.ScVal.scvBytes(Buffer.from(pointToBytes(kAud))),
      new Address(deployerPub).toScVal(),
    ],
    signer,
  );
  const kAudCoords = pointCoords(kAud);
  console.log(`  registered auditor key id 0`);

  // 5. addr_f parity: compare the contract's emitted AddressAsField to the SDK.
  const sdkAddrF = addressToField(token);
  const onchainAddrF = await readAddressAsField(client, ledgerBeforeToken);
  if (onchainAddrF === null) {
    console.warn("  ! could not find AddressAsFieldSet event; skipping parity assert");
  } else if (onchainAddrF !== sdkAddrF) {
    throw new Error(
      `addr_f MISMATCH — SDK ${toHex32(sdkAddrF)} != contract ${toHex32(onchainAddrF)}. ` +
        `Poseidon2 implementations diverge; register proofs would fail.`,
    );
  } else {
    console.log(`  addr_f parity OK: ${toHex32(sdkAddrF)}`);
  }

  // 5.5. Wire the compliance policy onto the token. sac_passthrough is false —
  //      there is no separate SAC identity to consult here, the policy
  //      allowlist is the only gate. Every account must be added via
  //      policy.add() (as the deployer, the policy admin) before it can
  //      deposit, transfer, receive, or withdraw.
  await client.invoke(
    token,
    "set_compliance_config",
    [scvStruct({ policy: optAddr(policy), sac_passthrough: xdr.ScVal.scvBool(false) }), addr(deployerPub)],
    signer,
  );
  console.log(`  compliance config set: policy=${policy}, sac_passthrough=false`);

  // 6. Lucent contracts. PayrollVault orchestrates transfers through the token;
  //    the PrivateEscrow factory deploys one instance per escrow, so its
  //    instance wasm is uploaded first and the factory is bound to that hash.
  const payroll = deploy(WASM.payroll, DEPLOYER, ["--token", token]);
  console.log(`payroll = ${payroll}`);
  const escrowInstanceWasm = uploadWasm(WASM.escrowInstance, DEPLOYER);
  console.log(`escrow instance wasm = ${escrowInstanceWasm}`);
  const escrowFactory = deploy(WASM.escrowFactory, DEPLOYER, [
    "--token", token,
    "--instance_wasm", escrowInstanceWasm,
  ]);
  console.log(`escrow factory = ${escrowFactory}`);

  const deployment: Deployment = {
    network: NETWORK,
    rpcUrl: RPC_URL,
    passphrase: PASSPHRASE,
    deployedAtLedger: ledgerBeforeToken,
    contracts: { token, verifier, auditor, underlying, payroll, escrowFactory, escrowInstanceWasm, policy },
    complianceAdmin: deployerPub,
    auditor: {
      id: 0,
      secretHex: toHex32(auditorSecret),
      keyXHex: toHex32(kAudCoords.x),
      keyYHex: toHex32(kAudCoords.y),
    },
    addrF: toHex32(sdkAddrF),
  };
  saveDeployment(deployment);
  console.log(
    `\nwrote deployments/${NETWORK}.json and packages/app/lib/deployment.json` +
      `\nthe app now points at this deployment — just rebuild/restart it.`,
  );
}

/** Scan token events for `address_as_field_set` and return its field value. */
async function readAddressAsField(client: ChainClient, fromLedger: number): Promise<bigint | null> {
  // Raw scan (the typed fetchEvents skips config events). One page suffices:
  // the setter event fires during construction, right after fromLedger.
  const resp = await client.server.getEvents({
    startLedger: fromLedger,
    filters: [{ type: "contract", contractIds: [client.cfg.contracts.token] }],
    limit: 50,
  });
  for (const ev of resp.events) {
    if (ev.topic[0]?.sym().toString() !== "address_as_field_set") continue;
    for (const entry of ev.value.map() ?? []) {
      if (entry.key().sym().toString() === "address_as_field") {
        return fromBytesBE(new Uint8Array(entry.val().bytes()));
      }
    }
  }
  return null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
