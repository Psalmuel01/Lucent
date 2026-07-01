/**
 * Submitters for the PayrollVault (orchestrator) contract, plus the client-side
 * builder that turns a run's salaries into the per-employee transfer blobs
 * `execute_run` expects.
 *
 * The vault never sees a plaintext salary: `execute_run` takes one XDR
 * `TransferData` blob per employee (in template order), each an
 * `employer -> employee` confidential transfer proven in the browser. Because
 * every transfer spends the employer's spendable balance, the blobs must be
 * chained — each one's input opening is the previous one's output opening.
 */

import { xdr, Address, nativeToScVal } from "@stellar/stellar-sdk";

import type { ChainClient, Signer, InvokeResult } from "./client.js";
import { encodeTransferData } from "./payload.js";
import { buildTransferWitness } from "../witness/transfer.js";
import type { KeyPair } from "../crypto/keys.js";
import type { Point } from "../crypto/grumpkin.js";
import type { CircuitProver } from "../proving/prover.js";

const addr = (a: string): xdr.ScVal => new Address(a).toScVal();
const u64 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: "u64" });
const bytes = (b: Uint8Array): xdr.ScVal => xdr.ScVal.scvBytes(Buffer.from(b));

/** `create_template(employer, employees) -> u64`. */
export function submitCreateTemplate(
  client: ChainClient,
  signer: Signer,
  employer: string,
  employees: string[],
): Promise<InvokeResult> {
  return client.invoke(
    payrollId(client),
    "create_template",
    [addr(employer), xdr.ScVal.scvVec(employees.map(addr))],
    signer,
  );
}

/** `create_run(template_id) -> u64`. */
export function submitCreateRun(
  client: ChainClient,
  signer: Signer,
  templateId: bigint,
): Promise<InvokeResult> {
  return client.invoke(payrollId(client), "create_run", [u64(templateId)], signer);
}

/** `fund_run(run_id)`. */
export function submitFundRun(
  client: ChainClient,
  signer: Signer,
  runId: bigint,
): Promise<InvokeResult> {
  return client.invoke(payrollId(client), "fund_run", [u64(runId)], signer);
}

/**
 * `execute_run(run_id, transfers)`. `transfers` are the raw XDR `TransferData`
 * blobs from {@link buildPayrollTransfers}, one per employee in template order.
 */
export function submitExecuteRun(
  client: ChainClient,
  signer: Signer,
  runId: bigint,
  transfers: Uint8Array[],
): Promise<InvokeResult> {
  return client.invoke(
    payrollId(client),
    "execute_run",
    [u64(runId), xdr.ScVal.scvVec(transfers.map(bytes))],
    signer,
  );
}

/** `cancel_run(run_id)`. */
export function submitCancelRun(
  client: ChainClient,
  signer: Signer,
  runId: bigint,
): Promise<InvokeResult> {
  return client.invoke(payrollId(client), "cancel_run", [u64(runId)], signer);
}

/** `claim(employee)` — folds received salary into the employee's spendable. */
export function submitClaim(
  client: ChainClient,
  signer: Signer,
  employee: string,
): Promise<InvokeResult> {
  return client.invoke(payrollId(client), "claim", [addr(employee)], signer);
}

/** One employee's slice of a payroll run. */
export interface PayrollPayment {
  /** Recipient's public viewing key `PVK_B` (from their confidential account). */
  pvk: Point;
  /** Salary amount. */
  amount: bigint;
}

/**
 * Build the per-employee transfer blobs for a run, chaining the employer's
 * spendable opening across payments so the batch is internally consistent.
 * Returns the blobs (template order) and the employer's post-run opening.
 */
export async function buildPayrollTransfers(params: {
  keys: KeyPair;
  /** Employer's current spendable plaintext / blinding. */
  v: bigint;
  r: bigint;
  /** Registered auditor key (used for both sender and recipient channels). */
  kAud: Point;
  prover: CircuitProver;
  payments: PayrollPayment[];
}): Promise<{ blobs: Uint8Array[]; next: { v: bigint; r: bigint } }> {
  let v = params.v;
  let r = params.r;
  const blobs: Uint8Array[] = [];
  for (const pmt of params.payments) {
    const w = buildTransferWitness({
      keys: params.keys,
      v,
      r,
      amount: pmt.amount,
      pvkB: pmt.pvk,
      kAudR: params.kAud,
      kAudS: params.kAud,
    });
    const { proof } = await params.prover.prove(w.inputs);
    blobs.push(new Uint8Array(encodeTransferData(w, proof).bytes()));
    v = w.next.v;
    r = w.next.r;
  }
  return { blobs, next: { v, r } };
}

function payrollId(client: ChainClient): string {
  const id = client.cfg.contracts.payroll;
  if (!id) throw new Error("chain config missing contracts.payroll");
  return id;
}
