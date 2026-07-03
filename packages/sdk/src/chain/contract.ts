/**
 * High-level submitters for each confidential-token entry point. Each combines
 * the witness payload, the proof bytes, and the plain method arguments into a
 * single `ChainClient.invoke`.
 *
 * Amounts are method arguments (`i128`), not part of the proof payload; the
 * proof binds the confidential debit/credit to the same value.
 */

import { xdr, Address, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";

import type { ChainClient, Signer, InvokeResult } from "./client.js";
import { encodeRegisterData, encodeWithdrawData, encodeTransferData, scvStruct } from "./payload.js";
import type { RegisterWitness } from "../witness/register.js";
import type { WithdrawWitness } from "../witness/withdraw.js";
import type { TransferWitness } from "../witness/transfer.js";

const addr = (a: string): xdr.ScVal => new Address(a).toScVal();
const optAddr = (a: string | null): xdr.ScVal => (a ? addr(a) : xdr.ScVal.scvVoid());
const i128 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "i128" });

/** `register(account, auditor_id, data)`. */
export function submitRegister(
  client: ChainClient,
  signer: Signer,
  account: string,
  auditorId: number,
  witness: RegisterWitness,
  proof: Uint8Array,
): Promise<InvokeResult> {
  return client.invoke(
    client.cfg.contracts.token,
    "register",
    [addr(account), xdr.ScVal.scvU32(auditorId), encodeRegisterData(witness, proof)],
    signer,
  );
}

/** `deposit(from, to, amount)` — public → confidential, no proof. */
export function submitDeposit(
  client: ChainClient,
  signer: Signer,
  from: string,
  to: string,
  amount: bigint,
): Promise<InvokeResult> {
  return client.invoke(
    client.cfg.contracts.token,
    "deposit",
    [addr(from), addr(to), i128(amount)],
    signer,
  );
}

/** `merge(account)` — fold receiving balance into spendable, no proof. */
export function submitMerge(
  client: ChainClient,
  signer: Signer,
  account: string,
): Promise<InvokeResult> {
  return client.invoke(client.cfg.contracts.token, "merge", [addr(account)], signer);
}

/** `withdraw(from, to, amount, data)` — confidential → public. */
export function submitWithdraw(
  client: ChainClient,
  signer: Signer,
  from: string,
  to: string,
  amount: bigint,
  witness: WithdrawWitness,
  proof: Uint8Array,
): Promise<InvokeResult> {
  return client.invoke(
    client.cfg.contracts.token,
    "withdraw",
    [addr(from), addr(to), i128(amount), encodeWithdrawData(witness, proof)],
    signer,
  );
}

/** `confidential_transfer(from, to, data)` — confidential → confidential. */
export function submitTransfer(
  client: ChainClient,
  signer: Signer,
  from: string,
  to: string,
  witness: TransferWitness,
  proof: Uint8Array,
): Promise<InvokeResult> {
  return client.invoke(
    client.cfg.contracts.token,
    "confidential_transfer",
    [addr(from), addr(to), encodeTransferData(witness, proof)],
    signer,
  );
}

/**
 * `freeze(account, operator)` — compliance-admin only. A frozen account
 * cannot deposit, transfer, receive, or withdraw until unfrozen. `operator`
 * must be the token's compliance admin (set at deploy time); the contract
 * enforces this via `#[only_admin]`, not this call.
 */
export function submitFreeze(
  client: ChainClient,
  signer: Signer,
  account: string,
  operator: string,
): Promise<InvokeResult> {
  return client.invoke(
    client.cfg.contracts.token,
    "freeze",
    [addr(account), addr(operator)],
    signer,
  );
}

/** `unfreeze(account, operator)` — compliance-admin only. */
export function submitUnfreeze(
  client: ChainClient,
  signer: Signer,
  account: string,
  operator: string,
): Promise<InvokeResult> {
  return client.invoke(
    client.cfg.contracts.token,
    "unfreeze",
    [addr(account), addr(operator)],
    signer,
  );
}

export interface ComplianceConfig {
  /** Allowlist policy contract, or `null` when the gate is off. */
  policy: string | null;
  sacPassthrough: boolean;
}

/** `compliance_config() -> Option<ComplianceConfig>` — read-only. */
export async function readComplianceConfig(client: ChainClient): Promise<ComplianceConfig | null> {
  const scVal = await client.simulate(client.cfg.contracts.token, "compliance_config", []);
  const n = scValToNative(scVal) as { policy?: string | null; sac_passthrough: boolean } | null | undefined;
  if (n == null) return null;
  return { policy: n.policy ?? null, sacPassthrough: n.sac_passthrough };
}

/**
 * `set_compliance_config(config, operator)` — compliance-admin only. Rotates
 * the allowlist gate (`policy`) and/or the underlying SAC `authorized()`
 * passthrough live. Freeze is unaffected either way: `is_frozen` only goes
 * dark when compliance was never configured at all, which isn't reachable
 * once this has been called once — there's no "unconfigure," only re-set.
 * Pass `policy: null` to turn the allowlist gate off entirely.
 */
export function submitSetComplianceConfig(
  client: ChainClient,
  signer: Signer,
  policy: string | null,
  sacPassthrough: boolean,
  operator: string,
): Promise<InvokeResult> {
  return client.invoke(
    client.cfg.contracts.token,
    "set_compliance_config",
    [
      scvStruct({ policy: optAddr(policy), sac_passthrough: xdr.ScVal.scvBool(sacPassthrough) }),
      addr(operator),
    ],
    signer,
  );
}
