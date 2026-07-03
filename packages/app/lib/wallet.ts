/**
 * ConfidentialWallet — UI-facing orchestration over @lucent/sdk.
 *
 * Holds the RPC client, the Freighter signer, the user's confidential key set,
 * a local state engine, and lazily-created provers. All proving happens in the
 * browser (bb.js); the confidential `sk` never leaves the device. It is
 * derived deterministically from a Freighter `signMessage` signature over a
 * deployment-bound message (see derive-key.ts) and cached in localStorage so
 * the signature prompt only appears once per account + deployment.
 */

import {
  ChainClient,
  type Signer,
  type OnChainAccount,
  deriveKeys,
  type KeyPair,
  addressToField,
  toHex32,
  fromHex,
  StateEngine,
  LocalStorageStore,
  type AccountState,
  type CircuitProver,
  proverFromArtifact,
  buildRegisterWitness,
  buildWithdrawWitness,
  buildTransferWitness,
  submitRegister,
  submitDeposit,
  submitMerge,
  submitWithdraw,
  submitTransfer,
  encodeRegisterData,
  encodeTransferData,
  generateKeys,
  // payroll
  submitCreateTemplate,
  submitCreateRun,
  submitFundRun,
  submitExecuteRun,
  submitCancelRun,
  submitClaim,
  buildPayrollTransfers,
  parseCreatedId,
  readTemplateCount,
  readRunCount,
  readTemplate,
  readRun,
  type TemplateInfo,
  type RunInfo,
  // escrow
  submitCreateEscrow,
  parseCreatedEscrow,
  submitStorePayoutProofs,
  submitFund,
  submitMarkCompleted,
  submitRelease,
  submitDispute,
  submitClaimAfterWindow,
  submitResolveToRecipient,
  submitResolveToDepositor,
  submitTimeout,
  submitCancelEscrow,
  readEscrow,
  readEscrowCount,
  readEscrowAddress,
  type EscrowInfo,
  IndexerClient,
  hybridFetchEvents,
  proveRecipientDisclosure,
  proveSenderDisclosure,
  deriveEphemeralRE,
  scalarMul,
  H,
  pointCoords,
  ecdh,
  frMod,
  poseidonWithDomain,
  DOMAIN,
  type ConfidentialEvent,
  type TransferEvent,
  type DisclosureRequest,
  type DisclosureBundle,
} from "@lucent/sdk";
import registerCircuit from "@lucent/sdk/circuits/register.json";
import withdrawCircuit from "@lucent/sdk/circuits/withdraw.json";
import transferCircuit from "@lucent/sdk/circuits/transfer.json";
import discloseRecipientCircuit from "@lucent/disclosure/artifacts/disclose_recipient.json";
import discloseSenderCircuit from "@lucent/disclosure/artifacts/disclose_sender.json";

import { DEPLOYMENT } from "./deployment";
import { connectFreighter } from "./freighter";
import { keyDerivationMessage, skFromSignature } from "./derive-key";
import { ensureBrowserBackend } from "./bb-loader";
import { Address, scValToNative } from "@stellar/stellar-sdk";

type Log = (msg: string) => void;
type CircuitName = "register" | "withdraw" | "transfer" | "disclose_recipient" | "disclose_sender";

const CIRCUITS: Record<CircuitName, { bytecode: string } & Record<string, unknown>> = {
  register: registerCircuit as never,
  withdraw: withdrawCircuit as never,
  transfer: transferCircuit as never,
  disclose_recipient: discloseRecipientCircuit as never,
  disclose_sender: discloseSenderCircuit as never,
};

/** Coarse progress of a proof-carrying operation, for UI button labels. */
export type TxPhase = "proving" | "submitting";

export interface WalletView {
  address: string;
  registered: boolean;
  spendable: bigint;
  receiving: bigint;
  syncedLedger: number;
  matchesChain: boolean | null;
  publicUSDC: bigint;
}

export class ConfidentialWallet {
  private provers = new Map<CircuitName, CircuitProver>();
  /** In-flight full-history fetch shared by concurrent callers (see fetchAllEvents). */
  private inFlightEvents: Promise<ConfidentialEvent[]> | null = null;

  private constructor(
    readonly address: string,
    private signer: Signer,
    private keys: KeyPair,
    private client: ChainClient,
    private engine: StateEngine,
    private indexer: IndexerClient | undefined,
    private log: Log,
  ) {}

  static async connect(log: Log): Promise<ConfidentialWallet> {
    ensureBrowserBackend();
    const signer = await connectFreighter();
    log(`connected ${signer.publicKey}`);

    const client = new ChainClient({
      rpcUrl: DEPLOYMENT.rpcUrl,
      networkPassphrase: DEPLOYMENT.networkPassphrase,
      contracts: DEPLOYMENT.contracts,
    });

    const addrF = addressToField(DEPLOYMENT.contracts.token);
    const skKey = `lucent:sk:${DEPLOYMENT.contracts.token}:${signer.publicKey}`;
    let sk: bigint;
    const stored = localStorage.getItem(skKey);
    if (stored) {
      sk = fromHex(stored);
    } else {
      log("sign the key-derivation message in Freighter…");
      const signature = await signer.signMessage(
        keyDerivationMessage(DEPLOYMENT.networkPassphrase, DEPLOYMENT.contracts.token),
      );
      sk = await skFromSignature(signature);
      localStorage.setItem(skKey, toHex32(sk));
      log("derived confidential key from wallet signature (cached in localStorage)");
    }
    const keys = deriveKeys(sk, addrF);

    // Optional Goldsky indexer: when configured, the hybrid event source
    // backfills history older than the RPC's ~7-day window. Without it the app
    // is RPC-only (today's behavior).
    const indexer = DEPLOYMENT.indexerUrl
      ? new IndexerClient({ baseUrl: DEPLOYMENT.indexerUrl })
      : undefined;
    if (indexer) log(`indexer configured (${DEPLOYMENT.indexerUrl})`);

    // Start from the deploy ledger, unclamped: hybridFetchEvents clamps the RPC
    // leg to the retention window itself and routes anything older to the
    // indexer (if present), so a stale deployment no longer makes sync throw.
    const fromLedger: number = DEPLOYMENT.deployedAtLedger;

    const engine = new StateEngine({
      client,
      store: new LocalStorageStore(),
      keys,
      address: signer.publicKey,
      fromLedger,
      indexer,
    });

    return new ConfidentialWallet(signer.publicKey, signer, keys, client, engine, indexer, log);
  }

  private prover(name: CircuitName): CircuitProver {
    let p = this.provers.get(name);
    if (!p) {
      p = proverFromArtifact(CIRCUITS[name]);
      this.provers.set(name, p);
    }
    return p;
  }

  /** Read on-chain account (null if not registered). */
  async account(): Promise<OnChainAccount | null> {
    return this.client.confidentialBalance(this.address);
  }

  async register(onPhase?: (p: TxPhase) => void): Promise<void> {
    const w = buildRegisterWitness(this.keys);
    onPhase?.("proving");
    this.log("proving register…");
    const { proof } = await this.prover("register").prove(w.inputs);
    onPhase?.("submitting");
    this.log("submitting register…");
    const r = await submitRegister(this.client, this.signer, this.address, DEPLOYMENT.auditorId, w, proof);
    this.log(`registered (tx ${r.hash.slice(0, 10)}…)`);
  }

  async deposit(amount: bigint): Promise<void> {
    this.log(`depositing ${amount}…`);
    const r = await submitDeposit(this.client, this.signer, this.address, this.address, amount);
    this.log(`deposited (tx ${r.hash.slice(0, 10)}…) → receiving balance`);
  }

  async merge(): Promise<void> {
    this.log("merging receiving → spendable…");
    const r = await submitMerge(this.client, this.signer, this.address);
    await this.engine.applyMerge();
    this.log(`merged (tx ${r.hash.slice(0, 10)}…)`);
  }

  async transfer(to: string, amount: bigint, onPhase?: (p: TxPhase) => void): Promise<{ hash: string }> {
    const recipient = await this.client.confidentialBalance(to);
    if (!recipient) throw new Error("recipient is not registered");
    const kAudR = await this.client.auditorKey(recipient.auditorId);
    const kAudS = await this.client.auditorKey(DEPLOYMENT.auditorId);

    const s = await this.engine.sync();
    if (s.spendable.v < amount) throw new Error(`insufficient spendable balance (${s.spendable.v})`);

    const w = buildTransferWitness({
      keys: this.keys,
      v: s.spendable.v,
      r: s.spendable.r,
      amount,
      pvkB: recipient.viewingPublicKey,
      kAudR,
      kAudS,
    });
    onPhase?.("proving");
    this.log("proving transfer…");
    const { proof } = await this.prover("transfer").prove(w.inputs);
    onPhase?.("submitting");
    this.log("submitting transfer…");
    const r = await submitTransfer(this.client, this.signer, this.address, to, w, proof);
    await this.engine.setSpendable(w.next);
    // No r_e bookkeeping (§15.2): the witness derives it from (vk, sigma), so
    // discloseSent() re-derives it from the emitted event whenever needed.
    this.log(`transferred ${amount} → ${to.slice(0, 6)}… (tx ${r.hash.slice(0, 10)}…)`);
    return { hash: r.hash };
  }

  async withdraw(amount: bigint, onPhase?: (p: TxPhase) => void): Promise<void> {
    const kAudS = await this.client.auditorKey(DEPLOYMENT.auditorId);
    const s = await this.engine.sync();
    if (s.spendable.v < amount) throw new Error(`insufficient spendable balance (${s.spendable.v})`);

    const w = buildWithdrawWitness({ keys: this.keys, v: s.spendable.v, r: s.spendable.r, amount, kAudS });
    onPhase?.("proving");
    this.log("proving withdraw…");
    const { proof } = await this.prover("withdraw").prove(w.inputs);
    onPhase?.("submitting");
    this.log("submitting withdraw…");
    const r = await submitWithdraw(this.client, this.signer, this.address, this.address, amount, w, proof);
    await this.engine.setSpendable(w.next);
    this.log(`withdrew ${amount} → public (tx ${r.hash.slice(0, 10)}…)`);
  }

  // ---- payroll (PayrollVault orchestrator) --------------------------------

  /** Employer: create a template with a fixed employee set. Returns template id. */
  async createTemplate(employees: string[]): Promise<bigint> {
    this.log(`creating payroll template (${employees.length} employees)…`);
    const r = await submitCreateTemplate(this.client, this.signer, this.address, employees);
    const id = parseCreatedId(r);
    this.log(`template #${id} created (tx ${r.hash.slice(0, 10)}…)`);
    return id;
  }

  /** Employer: open a run against a template. Returns run id. */
  async createRun(templateId: bigint): Promise<bigint> {
    const r = await submitCreateRun(this.client, this.signer, templateId);
    const id = parseCreatedId(r);
    this.log(`run #${id} opened on template #${templateId} (tx ${r.hash.slice(0, 10)}…)`);
    return id;
  }

  /** Employer: mark a run funded. */
  async fundRun(runId: bigint): Promise<void> {
    const r = await submitFundRun(this.client, this.signer, runId);
    this.log(`run #${runId} funded (tx ${r.hash.slice(0, 10)}…)`);
  }

  /**
   * Employer: execute a run — one confidential transfer per employee, proven in
   * the browser and routed atomically through the vault. Salaries never touch
   * chain storage; only the (encrypted) transfers do.
   */
  async executeRun(
    runId: bigint,
    payments: { employee: string; amount: bigint }[],
    onPhase?: (p: TxPhase) => void,
  ): Promise<void> {
    const kAud = await this.client.auditorKey(DEPLOYMENT.auditorId);
    const resolved: { pvk: import("@lucent/sdk").Point; amount: bigint }[] = [];
    for (const p of payments) {
      const acct = await this.client.confidentialBalance(p.employee);
      if (!acct) throw new Error(`employee ${p.employee.slice(0, 8)}… is not registered`);
      resolved.push({ pvk: acct.viewingPublicKey, amount: p.amount });
    }

    const s = await this.engine.sync();
    const total = payments.reduce((a, p) => a + p.amount, 0n);
    if (s.spendable.v < total) {
      throw new Error(`insufficient spendable balance (${s.spendable.v}) for run total ${total}`);
    }

    onPhase?.("proving");
    this.log(`proving ${payments.length} salary transfers…`);
    const { blobs, next } = await buildPayrollTransfers({
      keys: this.keys,
      v: s.spendable.v,
      r: s.spendable.r,
      kAud,
      prover: this.prover("transfer"),
      payments: resolved,
    });

    onPhase?.("submitting");
    this.log("submitting execute_run…");
    const r = await submitExecuteRun(this.client, this.signer, runId, blobs);
    await this.engine.setSpendable(next);
    this.log(`run #${runId} executed (tx ${r.hash.slice(0, 10)}…)`);
  }

  /** Employer: cancel a run before execution. */
  async cancelRun(runId: bigint): Promise<void> {
    const r = await submitCancelRun(this.client, this.signer, runId);
    this.log(`run #${runId} cancelled (tx ${r.hash.slice(0, 10)}…)`);
  }

  /** Employee: fold received salary into spendable (token `merge`, no proof). */
  async claimSalary(): Promise<void> {
    const r = await submitClaim(this.client, this.signer, this.address);
    await this.engine.applyMerge();
    this.log(`claimed salary (tx ${r.hash.slice(0, 10)}…)`);
  }

  async payrollTemplateCount(): Promise<bigint> {
    return readTemplateCount(this.client);
  }
  async payrollRunCount(): Promise<bigint> {
    return readRunCount(this.client);
  }
  async payrollTemplate(id: bigint): Promise<TemplateInfo> {
    return readTemplate(this.client, id);
  }
  async payrollRun(id: bigint): Promise<RunInfo> {
    return readRun(this.client, id);
  }

  // ---- escrow (PrivateEscrow factory + instances) -------------------------

  /** Depositor: deploy a new escrow instance. Returns its id and address. */
  async createEscrow(
    recipient: string,
    arbiter: string | null,
    timeoutSeconds: bigint,
  ): Promise<{ id: bigint; address: string }> {
    this.log("deploying escrow instance…");
    const r = await submitCreateEscrow(
      this.client,
      this.signer,
      this.address,
      recipient,
      arbiter,
      timeoutSeconds,
    );
    const created = parseCreatedEscrow(r);
    this.log(`escrow #${created.id} deployed at ${created.address.slice(0, 8)}…`);
    return created;
  }

  /**
   * Depositor: fund an escrow. Builds every confidential blob the instance
   * needs — a register proof for the instance's fresh Grumpkin identity, the
   * depositor→instance transfer, and the two pre-generated payout proofs
   * (instance→recipient and instance→depositor). The instance's post-fund
   * spendable opening is deterministic `(amount, r_tx)`, so both payout proofs
   * are valid and the state machine picks exactly one at settlement.
   *
   * The instance secret is generated here and discarded (see the contract's
   * trust caveat).
   */
  async fundEscrow(
    instance: string,
    recipient: string,
    amount: bigint,
    onPhase?: (p: TxPhase) => void,
  ): Promise<void> {
    const recipientAcct = await this.client.confidentialBalance(recipient);
    if (!recipientAcct) throw new Error("recipient is not registered");
    const kAud = await this.client.auditorKey(DEPLOYMENT.auditorId);

    const s = await this.engine.sync();
    if (s.spendable.v < amount) {
      throw new Error(`insufficient spendable balance (${s.spendable.v})`);
    }

    // Fresh, ephemeral identity for the instance's confidential account.
    const instanceKeys = generateKeys(this.keys.addrF);

    onPhase?.("proving");
    this.log("proving escrow register + transfers (4 proofs)…");

    const rw = buildRegisterWitness(instanceKeys);
    const { proof: rproof } = await this.prover("register").prove(rw.inputs);
    const registerData = new Uint8Array(encodeRegisterData(rw, rproof).bytes());

    const tin = buildTransferWitness({
      keys: this.keys,
      v: s.spendable.v,
      r: s.spendable.r,
      amount,
      pvkB: instanceKeys.PVK,
      kAudR: kAud,
      kAudS: kAud,
    });
    const { proof: tinProof } = await this.prover("transfer").prove(tin.inputs);
    const transferIn = new Uint8Array(encodeTransferData(tin, tinProof).bytes());

    // Instance spendable after fund + merge = the transfer's recipient opening.
    const instV = amount;
    const instR = tin.recipientView.rTx;

    const rel = buildTransferWitness({
      keys: instanceKeys,
      v: instV,
      r: instR,
      amount,
      pvkB: recipientAcct.viewingPublicKey,
      kAudR: kAud,
      kAudS: kAud,
    });
    const { proof: relProof } = await this.prover("transfer").prove(rel.inputs);
    const releaseProof = new Uint8Array(encodeTransferData(rel, relProof).bytes());

    const ref = buildTransferWitness({
      keys: instanceKeys,
      v: instV,
      r: instR,
      amount,
      pvkB: this.keys.PVK,
      kAudR: kAud,
      kAudS: kAud,
    });
    const { proof: refProof } = await this.prover("transfer").prove(ref.inputs);
    const refundProof = new Uint8Array(encodeTransferData(ref, refProof).bytes());

    onPhase?.("submitting");
    // Two transactions, not one: all four proofs together exceed Soroban's
    // per-transaction size ceiling (see the contract's `fund` doc comment).
    this.log("submitting payout proofs…");
    await submitStorePayoutProofs(this.client, this.signer, instance, {
      releaseProof,
      refundProof,
    });
    this.log("submitting fund…");
    const r = await submitFund(this.client, this.signer, instance, {
      registerData,
      auditorId: DEPLOYMENT.auditorId,
      transferIn,
    });
    await this.engine.setSpendable(tin.next);
    this.log(`escrow funded (tx ${r.hash.slice(0, 10)}…)`);
  }

  markCompleted(instance: string, proofUri: string) {
    return submitMarkCompleted(this.client, this.signer, instance, proofUri).then((r) =>
      this.log(`marked completed (tx ${r.hash.slice(0, 10)}…)`),
    );
  }
  releaseEscrow(instance: string) {
    return submitRelease(this.client, this.signer, instance).then((r) =>
      this.log(`released (tx ${r.hash.slice(0, 10)}…)`),
    );
  }
  disputeEscrow(instance: string, proofUri: string) {
    return submitDispute(this.client, this.signer, instance, proofUri).then((r) =>
      this.log(`disputed (tx ${r.hash.slice(0, 10)}…)`),
    );
  }
  claimAfterWindow(instance: string) {
    return submitClaimAfterWindow(this.client, this.signer, instance).then((r) =>
      this.log(`claimed after window (tx ${r.hash.slice(0, 10)}…)`),
    );
  }
  resolveToRecipient(instance: string) {
    return submitResolveToRecipient(this.client, this.signer, instance).then((r) =>
      this.log(`resolved to recipient (tx ${r.hash.slice(0, 10)}…)`),
    );
  }
  resolveToDepositor(instance: string) {
    return submitResolveToDepositor(this.client, this.signer, instance).then((r) =>
      this.log(`resolved to depositor (tx ${r.hash.slice(0, 10)}…)`),
    );
  }
  timeoutEscrow(instance: string) {
    return submitTimeout(this.client, this.signer, instance).then((r) =>
      this.log(`timed out (tx ${r.hash.slice(0, 10)}…)`),
    );
  }
  cancelEscrow(instance: string) {
    return submitCancelEscrow(this.client, this.signer, instance).then((r) =>
      this.log(`cancelled (tx ${r.hash.slice(0, 10)}…)`),
    );
  }

  async escrowInfo(instance: string): Promise<EscrowInfo> {
    return readEscrow(this.client, instance);
  }

  /** List all deployed escrows that involve this account (depositor/recipient/arbiter). */
  async listEscrows(): Promise<{ id: bigint; address: string; info: EscrowInfo }[]> {
    const count = await readEscrowCount(this.client);
    const out: { id: bigint; address: string; info: EscrowInfo }[] = [];
    for (let i = 1n; i <= count; i++) {
      const address = await readEscrowAddress(this.client, i);
      if (!address) continue;
      try {
        const info = await readEscrow(this.client, address);
        if (
          info.depositor === this.address ||
          info.recipient === this.address ||
          info.arbiter === this.address
        ) {
          out.push({ id: i, address, info });
        }
      } catch {
        /* skip unreadable */
      }
    }
    return out;
  }

  /**
   * This account's token-contract events, newest first. With an indexer
   * configured this spans the full history; otherwise it is limited to the
   * RPC's ~7-day retention window.
   */
  async listEvents(): Promise<ConfidentialEvent[]> {
    const events = await this.fetchAllEvents();
    return events.filter((ev) => this.concernsMe(ev)).reverse();
  }

  /**
   * Other accounts with a `register` event — the way to enumerate possible
   * transfer recipients. With an indexer this covers the full history; without
   * one, an account registered more than ~7 days ago won't appear.
   *
   * Filtered to `G...` keypair addresses only. Contracts register too — every
   * PrivateEscrow instance is its own confidential account (`C...`), since
   * that's how it holds a balance — but Send is for paying people, not for
   * transferring straight into an arbitrary escrow's custody outside its own
   * fund flow, so those addresses are excluded here.
   */
  async registeredRecipients(): Promise<string[]> {
    const seen = new Set<string>();
    for (const ev of await this.fetchAllEvents()) {
      if (ev.type === "register" && ev.account !== this.address && ev.account.startsWith("G")) {
        seen.add(ev.account);
      }
    }
    return [...seen];
  }

  /**
   * Full token-event history (indexer + RPC), the source for both the activity
   * list and recipient discovery.
   *
   * Single-flight: `listEvents()` and `registeredRecipients()` both run a
   * full-history scan and fire near-simultaneously on connect. Concurrent
   * callers share ONE in-flight fetch; the moment it settles the slot is
   * cleared, so any LATER call (the activity panel's Reload, a post-tx refresh,
   * the recipients refresh button) re-fetches and picks up new events —
   * including ones from other accounts. This only de-duplicates overlapping
   * requests; it never serves stale data, so there is no cache to invalidate.
   */
  private async fetchAllEvents(): Promise<ConfidentialEvent[]> {
    if (this.inFlightEvents) return this.inFlightEvents;
    const fetch = hybridFetchEvents(this.client, this.indexer, {
      fromLedger: DEPLOYMENT.deployedAtLedger,
    }).then((r) => r.events);
    this.inFlightEvents = fetch;
    try {
      return await fetch;
    } finally {
      this.inFlightEvents = null;
    }
  }

  private concernsMe(ev: ConfidentialEvent): boolean {
    switch (ev.type) {
      case "register":
      case "merge":
        return ev.account === this.address;
      case "deposit":
      case "withdraw":
      case "transfer":
        return ev.from === this.address || ev.to === this.address;
    }
  }

  // ---- selective disclosure (SELECTIVE_DISCLOSURE.md §12, holder side) -----

  /**
   * Recover the ephemeral scalar for an outgoing transfer:
   * `r_e = Poseidon2(EPHEMERAL_KEY, vk, sigma)`, checked against the event's
   * `R_e`. No per-transfer state — `sigma` is public in the event. `null`
   * means the transfer wasn't built with this wallet's keys and the
   * deterministic derivation (e.g. a pre-derivation random-r_e transfer).
   */
  private recoverRE(event: TransferEvent): bigint | null {
    const eventRE = pointCoords(event.rE);
    const derived = deriveEphemeralRE(this.keys.vk, event.sigma);
    const derivedRE = pointCoords(scalarMul(derived, H));
    if (derivedRE.x === eventRE.x && derivedRE.y === eventRE.y) return derived;
    return null;
  }

  /** True iff this wallet can produce the ephemeral scalar for an outgoing transfer. */
  canDiscloseSent(event: TransferEvent): boolean {
    return this.recoverRE(event) !== null;
  }

  /**
   * Produce a D-recipient disclosure bundle for an inbound transfer event,
   * answering a third party's `(P_R, ν)` request. Runs the disclosure circuit
   * in-browser; only works for events whose `to` is this wallet.
   */
  async discloseReceived(event: TransferEvent, request: DisclosureRequest): Promise<DisclosureBundle> {
    if (event.to !== this.address) {
      throw new Error("D-recipient disclosure only works for transfers addressed to this wallet");
    }
    this.log("proving disclosure (D-recipient)…");
    const bundle = await proveRecipientDisclosure({
      keys: this.keys,
      event,
      request,
      prover: this.prover("disclose_recipient"),
    });
    this.log(`disclosure proof ready for event in tx ${event.txHash.slice(0, 10)}…`);
    return bundle;
  }

  /**
   * Produce a D-sender disclosure bundle for an outgoing transfer event. The
   * ephemeral scalar is re-derived from `vk` + the event's public `sigma`
   * (deterministic r_e) — no per-transfer state (§7).
   */
  async discloseSent(event: TransferEvent, request: DisclosureRequest): Promise<DisclosureBundle> {
    if (event.from !== this.address) {
      throw new Error("D-sender disclosure only works for transfers sent by this wallet");
    }
    const rEScalar = this.recoverRE(event);
    if (rEScalar === null) {
      throw new Error(
        "the event's R_e doesn't match this wallet's derived ephemeral scalar — the transfer wasn't sent with these keys (or used a non-deterministic r_e)",
      );
    }
    const recipient = await this.client.confidentialBalance(event.to);
    if (!recipient) throw new Error("transfer recipient has no confidential account record");
    this.log("proving disclosure (D-sender)…");
    const bundle = await proveSenderDisclosure({
      keys: this.keys,
      rEScalar,
      event,
      pvkB: recipient.viewingPublicKey,
      request,
      prover: this.prover("disclose_sender"),
    });
    this.log(`disclosure proof ready for event in tx ${event.txHash.slice(0, 10)}…`);
    return bundle;
  }

  /**
   * Decrypt a transfer's amount for the account itself — not a disclosure to
   * a third party, no proof, just showing the owner their own plaintext.
   * Received transfers decrypt directly with the owner's own viewing key (no
   * extra round trip); sent transfers additionally need the recipient's
   * public viewing key to reconstruct what they decrypted — the same lookup
   * `discloseSent` makes. Returns `null` if the transfer can't be attributed
   * to this wallet (e.g. it didn't use the deterministic ephemeral scalar).
   */
  async decryptOwnTransferAmount(event: TransferEvent): Promise<bigint | null> {
    if (event.to === this.address) {
      return this.engine.decryptIncoming(event.rE, event.vTilde, event.sigma).vTx;
    }
    if (event.from === this.address) {
      const rEScalar = this.recoverRE(event);
      if (rEScalar === null) return null;
      const recipient = await this.client.confidentialBalance(event.to);
      if (!recipient) return null;
      const s = ecdh(rEScalar, recipient.viewingPublicKey);
      return frMod(event.vTilde - poseidonWithDomain(DOMAIN.TX_AMOUNT, [s, event.sigma]));
    }
    return null;
  }

  /**
   * Recovery path for a persistent sync-badge mismatch: wipe locally cached
   * state and fully replay event history from the deploy ledger, then refresh
   * as normal. Use when a plain refresh doesn't clear a "Mismatch" — that
   * means the divergent local state is already past the resume cursor, so a
   * normal sync (which only fetches events after it) can't self-correct.
   */
  async resync(): Promise<WalletView> {
    this.log("resyncing from chain history…");
    await this.engine.reset();
    return this.refresh();
  }

  /** Sync from RPC events, verify against chain, and return a UI view. */
  async refresh(): Promise<WalletView> {
    const state: AccountState = await this.engine.sync();
    const onchain = await this.account();
    let matchesChain: boolean | null = null;
    if (onchain) {
      matchesChain = (await this.engine.verifyAgainstChain()).ok;
    }
    let publicUSDC = 0n;
    const underlying = DEPLOYMENT.contracts.underlying;
    if (underlying) {
      try {
        const scVal = await this.client.simulate(underlying, "balance", [
          new Address(this.address).toScVal(),
        ]);
        publicUSDC = scValToNative(scVal) as bigint;
      } catch (e) {
        this.log(`failed to fetch public USDC balance: ${e}`);
      }
    }
    return {
      address: this.address,
      registered: onchain !== null,
      spendable: state.spendable.v,
      receiving: state.receiving.v,
      syncedLedger: state.syncedLedger,
      matchesChain,
      publicUSDC,
    };
  }
}
