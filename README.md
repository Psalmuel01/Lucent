# Lucent — Confidential Payments on Stellar

**Lucent** is a confidential payments protocol and product for Stellar. Sender
and receiver addresses stay public and verifiable on-chain — only the amount
moves in the dark. Balances are Pedersen commitments on the Grumpkin curve;
every register, withdraw, and transfer carries an UltraHonk zero-knowledge
proof generated in the browser and verified natively on-chain by Soroban. No
off-chain operators, no relayers, no custodians.

On top of that primitive, Lucent ships a full payments product: shielded
deposits and withdrawals, confidential transfers, confidential payroll,
confidential escrow, an auditor console for compliance, and off-chain
selective disclosure — plus a complete Next.js front-end (landing, docs,
about, and a six-screen app) and a Freighter wallet integration.

> ⚠️ **Not production ready.** The UltraHonk verifier backend and the circuits
> are unaudited, and the escrow custody model carries a documented trust
> caveat (below). Testnet only; do not use with real value.

## Features

- **Shield** — deposit public XLM into a confidential balance, merge receiving
  into spendable, withdraw back to public XLM. Registration binds a Grumpkin
  key set to the account, one time.
- **Send** — confidential transfers to any registered account. The amount
  never appears in plaintext anywhere on-chain — not in the transaction, not
  in an event, not in contract storage.
- **Payroll** — an employer distributes salaries to a set of employees in one
  atomic run. No employee can read another's amount; the vault itself never
  sees a plaintext salary either.
- **Escrow** — two-party (optionally arbitrated) escrow whose locked amount
  stays confidential through creation, funding, delivery, dispute, and
  release. Each escrow is its own isolated confidential account.
- **Auditor console** — the party holding the registered Grumpkin auditor key
  decrypts every transfer amount and balance checkpoint across the
  deployment, for every account, without needing anyone's cooperation. The
  institutional compliance primitive.
- **Selective disclosure (Prove)** — a holder proves that one specific
  transfer paid exactly one amount to one counterparty, off-chain, revealing
  nothing else. The receiving party verifies the proof against the chain
  itself.
- **Freighter wallet** — the only supported signer. Confidential keys are
  derived deterministically from a Freighter message signature and cached
  locally, so the signing prompt only appears once per account.
- **Local state engine** — every balance read goes through a client-side
  state reconstruction layer that persists decrypted openings and
  re-verifies them against on-chain commitments (the Soroban RPC only serves
  ~7 days of event history, so this persistence is load-bearing, not a cache).
- **Proof UX** — every proof-carrying action shows a progress state
  immediately on tap; nothing in the product ever looks frozen while a proof
  generates in-browser (typically a few seconds, up to tens of seconds for
  multi-proof flows like escrow funding).

## How value moves

A balance is a commitment `C = v·G + r·H` — the chain only ever sees
commitments and proofs, never plaintext amounts. Every confidential account
holds a **spendable** balance (what you can send or withdraw) and a
**receiving** balance (where deposits and incoming transfers land); `merge`
folds one into the other homomorphically, with no proof needed.

| Operation | Proof? | Effect |
|---|---|---|
| `register` | ✔ | Bind a Grumpkin key set to the contract (one-time) |
| `deposit` | — | Public XLM → receiving balance |
| `merge` | — | Receiving → spendable |
| `withdraw` | ✔ | Spendable → public XLM |
| `confidential_transfer` | ✔ | Spendable → another account's receiving balance |

Every transfer also emits **dual auditor ciphertexts** — one for the sender's
channel, one for the recipient's — encrypted to the registered auditor's
Grumpkin public key. That's the compliance channel the Payroll and Auditor
features build on: register an employer as the auditor, and every salary
transfer becomes decryptable to them alone.

Because a Soroban contract cannot generate a ZK proof, confidential value can
only move via a `confidential_transfer` proven by whoever holds the sender's
key — a contract can never silently move funds on someone's behalf. That
single constraint is what shapes Payroll and Escrow into the design below.

## Protocol contracts

| Contract | Role |
|---|---|
| **Confidential token** | Holds commitments, verifies proofs, executes register / deposit / merge / withdraw / confidential_transfer. |
| **Verifier** | UltraHonk verification-key registry, one key per circuit. |
| **Auditor** | Grumpkin auditor public-key registry, indexed by auditor id. |
| **PayrollVault** | Orchestrates confidential salary runs (below). |
| **PrivateEscrow** (factory + instance) | Confidential two-party escrow (below). |

**PayrollVault** is an orchestrator, not a custodian: an employer creates a
template of employees and opens a run against it. Salaries are never written
to chain storage — at `execute_run` the employer's browser proves one
`confidential_transfer` per employee, and the vault routes them atomically
and records run state. The employer registers as the run's auditor, so every
salary stays decryptable to them and opaque to everyone else.

**PrivateEscrow** is custodial: each escrow deploys its own **instance
contract**, giving it its own isolated confidential account (a confidential
balance is keyed by contract address, so custody requires a dedicated
address per escrow). The depositor funds the instance and hands over two
pre-generated payout proofs — instance→recipient and instance→depositor —
and the instance's own state machine (created → funded → completed →
released / disputed / refunded / cancelled) submits exactly the one it
selects.

> **Escrow trust caveat.** To pre-generate those two payout proofs, the
> depositor derives the instance's Grumpkin secret at fund time and must
> discard it afterward. A depositor who retains it could re-spend the
> escrowed balance and invalidate both stored proofs. Acceptable for a
> testnet demo; not for production.

Lucent's confidential-token layer — the commitment scheme, the UltraHonk
circuits, and the Poseidon2/Grumpkin crypto — is built on
[OpenZeppelin `stellar-contracts`](https://github.com/OpenZeppelin/stellar-contracts)
(`feat/confidential-verifier-ultrahonk`), consumed as a git dependency; the
on-chain verifier backend is
[Nethermind's `rs-soroban-ultrahonk`](https://github.com/NethermindEth/rs-soroban-ultrahonk).
PayrollVault, PrivateEscrow, the SDK's payroll/escrow/disclosure layers, and
the entire product front-end are Lucent's own.

## Product

The front-end (`packages/app`) is a dark, gold-accented Next.js app:

- **Landing, Docs, About** — the public marketing surface.
- **Shield · Send · Payroll · Escrow · Auditor · Prove · Profile** — the app,
  reachable from a sidebar (desktop) or bottom nav (mobile). Shield, Send,
  Payroll, Escrow, and Profile require a connected wallet and redirect to the
  landing page if none is connected; Auditor needs no wallet at all, and
  Prove only gates its holder-side tab.
- A shared component library (glass cards, proof-loading overlays, encrypted
  badges, a numeric keypad, tx-status steppers) and a `ConfidentialWallet`
  client class wrapping the SDK's crypto, proving, chain, and state layers.

## Getting started

```bash
pnpm install
pnpm dev                     # http://localhost:3000
```

`pnpm dev` and `pnpm build` both build `@lucent/sdk` first automatically (it's
a workspace package the app imports from its compiled `dist/`, not from
source) — no separate build step needed.

Install [Freighter](https://freighter.app/), switch it to **Testnet**, and
fund your account (Freighter's built-in friendbot). `next dev` already serves
the cross-origin-isolation headers in-browser proving needs, so nothing extra
to configure locally.

Shield, Send, Auditor, and Prove work immediately against the deployment in
`deployments/testnet.json`. **Payroll and Escrow** show a "not configured"
notice until the PayrollVault and PrivateEscrow contracts are deployed (next
section) — after which they light up automatically, no code change needed.

## Building & testing the contracts

The contracts are a separate Cargo workspace and **must** build with
`stellar contract build` (the `stellar-tokens` dependency enables
soroban-sdk's `experimental_spec_shaking_v2`, which only that build path
supports).

```bash
pnpm build:contracts        # stellar contract build → packages/sdk/contracts/*.wasm
cargo test --manifest-path contracts/Cargo.toml
```

- `contracts/payroll` — PayrollVault state machine, employer auth, atomic
  batch payout, cancel paths (10 tests).
- `contracts/escrow-instance` — every escrow state transition, release-window
  timing, arbiter vs. no-arbiter branches, auth (16 tests).
- `contracts/escrow-factory` — deploys a real instance and drives it through
  fund → mark_completed → release (1 test).

## Deploying

```bash
pnpm deploy:contracts
```

Deploys the full stack — token, verifier, auditor, PayrollVault, and the
PrivateEscrow factory — under your `admin` stellar CLI identity, and writes
both `deployments/testnet.json` and `packages/app/lib/deployment.json`. The
app reads the latter directly, so a redeploy takes effect with **no code
edit and no env var** — just rebuild and run.
(`NEXT_PUBLIC_PAYROLL_ID` / `NEXT_PUBLIC_ESCROW_FACTORY_ID` exist only to
override those two ids ahead of a redeploy, e.g. to point at someone else's.)

A full end-to-end walkthrough, real proofs on testnet:

1. **Shield** — connect Freighter, register, deposit, merge.
2. **Send** — confidential transfer to a second registered account.
3. **Payroll** — create a template of employees, open + fund a run, enter
   salaries, execute; then **Auditor** decrypts every salary amount.
4. **Escrow** — deploy + fund an escrow; walk it through mark-completed →
   release (or dispute → resolve).
5. **Prove** — mint a request on the Verify tab, disclose a transfer on the
   Prove tab, verify the returned bundle.

> Deployer identity: the `admin` key in your stellar CLI config. Requires
> Rust with `wasm32v1-none` and stellar-cli ≥ 25.2.

## Architecture

```
contracts/                    Rust/Soroban (separate Cargo workspace)
  token/                      Confidential token (register/deposit/merge/withdraw/transfer)
  verifier/                   UltraHonk verification-key registry
  auditor/                    Grumpkin auditor-key registry
  payroll/                    PayrollVault
  escrow-instance/            PrivateEscrow instance
  escrow-factory/             PrivateEscrow factory
packages/
  sdk/        @lucent/sdk        crypto · witness · proving · chain (incl. payroll/escrow) · state · auditor · disclosure
  disclosure/ @lucent/disclosure shared disclosure circuits + pinned verification keys
  app/        @lucent/app        Next.js product front-end (Freighter wallet)
  indexer/    @lucent/indexer    optional Goldsky indexer for full event history
scripts/                         deploy.ts · e2e.ts · e2e-disclosure.ts
```

## Deployed (testnet)

Read from `deployments/testnet.json`, rewritten automatically by
`pnpm deploy:contracts`:

| Contract | ID |
|---|---|
| Confidential token | `CBF64DEOVQAXJFBSNGFEUT2AH4H7K5JBY3ZYJ5GVEINMNSDISWRG5N3F` |
| Verifier | `CDCET36PIS44DWJM5UQSSI4ZHGRDSBIIQW4G4ALPYK3Y6FEQGY5ZWFXL` |
| Auditor | `CA4II62E35TQKPGHCPBD6EBAS732GSGS6H37UUWKEDHR4YTBVMPHVY4L` |
| Underlying | native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| PayrollVault | *not yet deployed — run `pnpm deploy:contracts`* |
| PrivateEscrow factory | *not yet deployed — run `pnpm deploy:contracts`* |

## Prerequisites

- Node ≥ 20, pnpm 10
- For contracts: Rust with `wasm32v1-none`, `stellar` CLI ≥ 25.2. OpenZeppelin
  crates are pulled as git dependencies, pinned by `Cargo.lock`.

## Acknowledgments

Lucent's confidential-token primitive builds on
[OpenZeppelin `stellar-contracts`](https://github.com/OpenZeppelin/stellar-contracts)
and [Nethermind's `rs-soroban-ultrahonk`](https://github.com/NethermindEth/rs-soroban-ultrahonk)
verifier.

## License

MIT.
