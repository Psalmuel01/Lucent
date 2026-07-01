/**
 * Submitters for the PrivateEscrow factory and the per-escrow instance it
 * deploys.
 *
 * `create_escrow` (factory) deploys a fresh instance contract — its own
 * confidential account. `fund` (instance) carries the confidential-flow blobs:
 * the register proof for the instance's Grumpkin identity, the depositor's
 * transfer-in, and the two pre-generated payout proofs (instance -> recipient
 * and instance -> depositor) the state machine later selects between. All blobs
 * are built in the browser; this module only submits them.
 */

import { xdr, Address, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";

import type { ChainClient, Signer, InvokeResult } from "./client.js";

const addr = (a: string): xdr.ScVal => new Address(a).toScVal();
const u64 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "u64" });
const u32 = (v: number): xdr.ScVal => xdr.ScVal.scvU32(v);
const bytes = (b: Uint8Array): xdr.ScVal => xdr.ScVal.scvBytes(Buffer.from(b));
const str = (s: string): xdr.ScVal => xdr.ScVal.scvString(s);
const optAddr = (a: string | null | undefined): xdr.ScVal =>
  a ? addr(a) : xdr.ScVal.scvVoid();

// ---- factory ---------------------------------------------------------------

/** `create_escrow(depositor, recipient, arbiter, timeout_seconds) -> (u64, Address)`. */
export function submitCreateEscrow(
  client: ChainClient,
  signer: Signer,
  depositor: string,
  recipient: string,
  arbiter: string | null,
  timeoutSeconds: bigint,
): Promise<InvokeResult> {
  return client.invoke(
    escrowFactoryId(client),
    "create_escrow",
    [addr(depositor), addr(recipient), optAddr(arbiter), u64(timeoutSeconds)],
    signer,
  );
}

/** Parse the `(id, address)` returned by `create_escrow`. */
export function parseCreatedEscrow(result: InvokeResult): { id: bigint; address: string } {
  if (!result.returnValue) throw new Error("create_escrow returned no value");
  const [id, address] = scValToNative(result.returnValue) as [bigint, string];
  return { id, address };
}

/** `escrow_address(id) -> Option<Address>` (read-only). */
export async function readEscrowAddress(
  client: ChainClient,
  id: bigint,
): Promise<string | null> {
  const v = await client.simulate(escrowFactoryId(client), "escrow_address", [u64(id)]);
  const native = scValToNative(v) as string | null;
  return native ?? null;
}

// ---- instance --------------------------------------------------------------

/** `fund(register_data, auditor_id, transfer_in, release_proof, refund_proof)`. */
export function submitFund(
  client: ChainClient,
  signer: Signer,
  instance: string,
  args: {
    registerData: Uint8Array;
    auditorId: number;
    transferIn: Uint8Array;
    releaseProof: Uint8Array;
    refundProof: Uint8Array;
  },
): Promise<InvokeResult> {
  return client.invoke(
    instance,
    "fund",
    [
      bytes(args.registerData),
      u32(args.auditorId),
      bytes(args.transferIn),
      bytes(args.releaseProof),
      bytes(args.refundProof),
    ],
    signer,
  );
}

/** `mark_completed(proof_uri)` — recipient. */
export function submitMarkCompleted(
  client: ChainClient,
  signer: Signer,
  instance: string,
  proofUri: string,
): Promise<InvokeResult> {
  return client.invoke(instance, "mark_completed", [str(proofUri)], signer);
}

/** `release()` — depositor. */
export function submitRelease(client: ChainClient, signer: Signer, instance: string) {
  return client.invoke(instance, "release", [], signer);
}

/** `dispute_with_proof(proof_uri)` — recipient, after the release window, arbiter set. */
export function submitDispute(
  client: ChainClient,
  signer: Signer,
  instance: string,
  proofUri: string,
): Promise<InvokeResult> {
  return client.invoke(instance, "dispute_with_proof", [str(proofUri)], signer);
}

/** `claim_after_window()` — recipient, after the release window, no arbiter. */
export function submitClaimAfterWindow(client: ChainClient, signer: Signer, instance: string) {
  return client.invoke(instance, "claim_after_window", [], signer);
}

/** `resolve_to_recipient()` — arbiter. */
export function submitResolveToRecipient(client: ChainClient, signer: Signer, instance: string) {
  return client.invoke(instance, "resolve_to_recipient", [], signer);
}

/** `resolve_to_depositor()` — arbiter. */
export function submitResolveToDepositor(client: ChainClient, signer: Signer, instance: string) {
  return client.invoke(instance, "resolve_to_depositor", [], signer);
}

/** `timeout()` — depositor, after timeout, still funded. */
export function submitTimeout(client: ChainClient, signer: Signer, instance: string) {
  return client.invoke(instance, "timeout", [], signer);
}

/** `cancel()` — depositor, before funding. */
export function submitCancelEscrow(client: ChainClient, signer: Signer, instance: string) {
  return client.invoke(instance, "cancel", [], signer);
}

/** Escrow lifecycle state, mirroring the contract's `EscrowState`. */
export enum EscrowState {
  Created = 0,
  Funded = 1,
  Completed = 2,
  Released = 3,
  Disputed = 4,
  Refunded = 5,
  Cancelled = 6,
}

export interface EscrowInfo {
  depositor: string;
  recipient: string;
  arbiter: string | null;
  state: EscrowState;
  createdAt: bigint;
  timeoutAt: bigint;
  completedAt: bigint;
}

/** `get_escrow()` on an instance (read-only). */
export async function readEscrow(client: ChainClient, instance: string): Promise<EscrowInfo> {
  const v = await client.simulate(instance, "get_escrow", []);
  const n = scValToNative(v) as {
    depositor: string;
    recipient: string;
    arbiter: string | null;
    state: number;
    created_at: bigint;
    timeout_at: bigint;
    completed_at: bigint;
  };
  return {
    depositor: n.depositor,
    recipient: n.recipient,
    arbiter: n.arbiter ?? null,
    state: n.state as EscrowState,
    createdAt: n.created_at,
    timeoutAt: n.timeout_at,
    completedAt: n.completed_at,
  };
}

function escrowFactoryId(client: ChainClient): string {
  const id = client.cfg.contracts.escrowFactory;
  if (!id) throw new Error("chain config missing contracts.escrowFactory");
  return id;
}
