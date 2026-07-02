/**
 * Partial redeploy: escrow only.
 *
 * Use this after a Rust change to `contracts/escrow-instance` (or
 * `contracts/escrow-factory`) that doesn't touch the token/verifier/auditor/
 * payroll. `PrivateEscrowFactory`'s constructor bakes the instance wasm hash
 * in permanently — there's no admin/upgrade setter — so a new instance build
 * always needs a fresh factory too, not just a wasm re-upload.
 *
 * Steps:
 *   1. Upload the new escrow-instance wasm (new hash from the code change).
 *   2. Deploy a fresh escrow-factory bound to the existing token + that hash.
 *   3. Update only `contracts.escrowFactory` / `contracts.escrowInstanceWasm`
 *      in deployments/testnet.json (and the app's redacted mirror) — token,
 *      verifier, auditor, payroll, underlying are untouched.
 *
 * Any escrows created against the old factory keep working for read/settle
 * calls already in flight, but `create_escrow` on the app now points at the
 * new factory. Escrows still in `Created` (unfunded) on the old factory are
 * harmless orphans — cancel them from the old factory if you still have its id.
 *
 * Usage: pnpm --filter @lucent/sdk exec tsx ../../scripts/deploy-escrow.ts
 * Deployer identity: the `admin` key in the stellar CLI config (must match the
 * original deployer — the token doesn't gate this, but keep identities consistent).
 */

import {
  WASM, PASSPHRASE,
  publicKey, secret, loadDeployment, saveDeployment, deploy, uploadWasm,
} from "./_shared.js";
import { keypairSigner } from "../packages/sdk/src/chain/client.js";

const DEPLOYER = "admin";

async function main(): Promise<void> {
  const deployerPub = publicKey(DEPLOYER);
  console.log(`deployer ${DEPLOYER} = ${deployerPub}`);
  // keypairSigner validated eagerly so a bad `admin` identity fails fast, before
  // any on-chain calls.
  keypairSigner(secret(DEPLOYER), PASSPHRASE);

  const d = loadDeployment();
  console.log(`token = ${d.contracts.token} (unchanged)`);

  const escrowInstanceWasm = uploadWasm(WASM.escrowInstance, DEPLOYER);
  console.log(`escrow instance wasm = ${escrowInstanceWasm}`);

  const escrowFactory = deploy(WASM.escrowFactory, DEPLOYER, [
    "--token", d.contracts.token,
    "--instance_wasm", escrowInstanceWasm,
  ]);
  console.log(`escrow factory = ${escrowFactory}`);

  d.contracts.escrowFactory = escrowFactory;
  d.contracts.escrowInstanceWasm = escrowInstanceWasm;
  saveDeployment(d);
  console.log(
    `\nwrote deployments/testnet.json and packages/app/lib/deployment.json` +
      `\ntoken/verifier/auditor/payroll untouched. Rebuild/restart the app to pick up the new factory.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
