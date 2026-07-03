/**
 * Submitters and reads for the compliance allowlist policy contract. Wired
 * onto the token via `ComplianceConfig.policy` (set once at deploy time, see
 * `scripts/deploy.ts`) — an account not on this allowlist cannot deposit,
 * transfer, receive, or withdraw. `add`/`remove` are admin-only; the contract
 * enforces that via `#[only_admin]`, not this module.
 */

import { xdr, Address, scValToNative } from "@stellar/stellar-sdk";

import type { ChainClient, Signer, InvokeResult } from "./client.js";

function policyId(client: ChainClient): string {
  const id = client.cfg.contracts.policy;
  if (!id) throw new Error("no compliance policy contract configured");
  return id;
}

const addr = (a: string): xdr.ScVal => new Address(a).toScVal();

/** `add(account)` — admin-only. Grants `account` allowlist access. */
export function submitPolicyAdd(
  client: ChainClient,
  signer: Signer,
  account: string,
): Promise<InvokeResult> {
  return client.invoke(policyId(client), "add", [addr(account)], signer);
}

/** `remove(account)` — admin-only. Revokes `account`'s allowlist access. */
export function submitPolicyRemove(
  client: ChainClient,
  signer: Signer,
  account: string,
): Promise<InvokeResult> {
  return client.invoke(policyId(client), "remove", [addr(account)], signer);
}

/** `is_allowed(account) -> bool` — read-only allowlist check. */
export async function readIsAllowed(client: ChainClient, account: string): Promise<boolean> {
  const scVal = await client.simulate(policyId(client), "is_allowed", [addr(account)]);
  return scValToNative(scVal) as boolean;
}

/** `is_frozen(account) -> bool` — read-only, on the token contract itself. */
export async function readIsFrozen(client: ChainClient, account: string): Promise<boolean> {
  const scVal = await client.simulate(client.cfg.contracts.token, "is_frozen", [addr(account)]);
  return scValToNative(scVal) as boolean;
}
