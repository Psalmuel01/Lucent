<div align="center">

# Lucent

**Confidential payments on Stellar.**

Sender and receiver stay public and verifiable on-chain. Only the amount moves in the dark.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Network: Stellar Testnet](https://img.shields.io/badge/network-Stellar%20Testnet-7D00FF)](https://stellar.org)
[![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](package.json)
[![pnpm 10](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](package.json)
[![Status: testnet only](https://img.shields.io/badge/status-testnet%20only-red)](#not-production-ready)

</div>

Balances are Pedersen commitments on the Grumpkin curve. Every register,
withdraw, and transfer carries an UltraHonk zero-knowledge proof, generated
in the browser and verified natively on-chain by Soroban — no off-chain
operators, no relayers, no custodians.

On top of that primitive, Lucent ships a full payments product: shielded
deposits and withdrawals, confidential transfers, confidential payroll,
confidential escrow, an auditor console for compliance, and off-chain
selective disclosure — plus a complete Next.js front-end and a Freighter
wallet integration.

<a id="not-production-ready"></a>
> ⚠️ **Not production ready.** The UltraHonk verifier backend and the circuits
> are unaudited, and the escrow custody model carries a documented trust
> caveat. Testnet only; do not use with real value.

## Contents

- [Quickstart](#quickstart)
- [Features](#features)
- [How value moves](#how-value-moves)
- [Protocol contracts](#protocol-contracts)
- [Product](#product)
- [Building and testing the contracts](#building-and-testing-the-contracts)
- [Deploying](#deploying)
- [Architecture](#architecture)
- [Deployed (testnet)](#deployed-testnet)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## Quickstart

Requires **Node ≥ 20**, **pnpm 10**. For contract work you'll also need Rust
with the `wasm32v1-none` target and `stellar` CLI ≥ 25.2.

```bash
pnpm install
pnpm dev                     # http://localhost:3000
```

`pnpm dev` and `pnpm build` both build `@lucent/sdk` first automatically (it's
a workspace package the app imports from its compiled `dist/`, not from
source) — no separate build step needed.

Install [Freighter](https://freighter.app/), switch it to **Testnet**, and
fund your account (Freighter's built-in friendbot). `next dev` already serves
the cross-origin-isolation headers in-browser proving needs, so there's
nothing extra to configure locally.

Home, Shield, Send, Auditor, and Verify work immediately against the
deployment in `deployments/testnet.json`. **Payroll and Escrow** show a "not configured"
notice until their contracts are deployed ([below](#deploying)) — after which
they light up automatically, no code change needed. Want to see the
compliance view without deploying anything yourself? The in-app **Docs**
page's Auditor section has a demo key you can paste straight in.

## Features

| | |
|---|---|
| **Shield** | Deposit public USDC into a confidential balance, merge receiving into spendable, withdraw back to public USDC. Registration binds a Grumpkin key set to the account, one time. |
| **Send** | Confidential transfers to any registered account. The amount never appears in plaintext anywhere on-chain — not in the transaction, not in an event, not in contract storage. |
| **Payroll** | An employer distributes salaries to a set of employees in one atomic run. No employee can read another's amount; the vault itself never sees a plaintext salary either. |
| **Escrow** | Two-party (optionally arbitrated) escrow whose locked amount stays confidential through creation, funding, delivery, dispute, and release. Each escrow is its own isolated confidential account. |
| **Auditor console** | The party holding the registered Grumpkin auditor key decrypts every transfer amount and balance checkpoint across the deployment, for every account, without needing anyone's cooperation. |
| **Compliance** | An allowlist policy and per-account freezing, both enforced on-chain by the token contract itself and gated behind a single compliance admin. An account off the allowlist, or frozen, is rejected before any amount is touched — the primitive KYC-gated payroll needs. Managed from the Auditor screen. |
| **Selective disclosure** | A holder proves that one specific transfer paid exactly one amount to one counterparty, off-chain, revealing nothing else. The counterparty verifies the proof against the chain itself. |
| **Freighter wallet** | The only supported signer. Confidential keys are derived deterministically from a Freighter message signature and cached locally, so the signing prompt only appears once per account. |
| **Local state engine** | Every balance read goes through a client-side reconstruction layer that persists decrypted openings and re-verifies them against on-chain commitments — load-bearing, not a cache, since the Soroban RPC only serves ~7 days of event history. |
| **Proof UX** | Every proof-carrying action shows a progress state immediately on tap; nothing ever looks frozen while a proof generates in-browser (typically a few seconds, up to tens of seconds for multi-proof flows like escrow funding). |

## How value moves

A balance is a commitment `C = v·G + r·H` — the chain only ever sees
commitments and proofs, never plaintext amounts. Every confidential account
holds a **spendable** balance (what you can send or withdraw) and a
**receiving** balance (where deposits and incoming transfers land); `merge`
folds one into the other homomorphically, with no proof needed.

| Operation | Proof? | Effect |
|---|---|---|
| `register` | ✔ | Bind a Grumpkin key set to the contract (one-time) |
| `deposit` | — | Public USDC → receiving balance |
| `merge` | — | Receiving → spendable |
| `withdraw` | ✔ | Spendable → public USDC |
| `confidential_transfer` | ✔ | Spendable → another account's receiving balance |

`deposit` is the one public amount: a plaintext `i128` argument in USDC base
units (7 decimals, so 1 USDC = 10,000,000 base units) — deliberately, so the
on-chain reserve backing the confidential supply stays auditable. Every other
operation hides the amount behind a commitment and a proof.

Every transfer also emits **dual auditor ciphertexts** — one for the sender's
channel, one for the recipient's — encrypted to the registered auditor's
Grumpkin public key. That's the compliance channel Payroll and Auditor build
on: register an employer as the auditor, and every salary transfer becomes
decryptable to them alone.

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
| **PayrollVault** | Orchestrates confidential salary runs. |
| **PrivateEscrow** (factory + instance) | Confidential two-party escrow. |
| **CompliancePolicy** | Admin-gated allowlist; wired onto the token's `ComplianceConfig` alongside per-account freezing. |

**PayrollVault** is an orchestrator, not a custodian: an employer creates a
template of employees and opens a run against it. Salaries are never written
to chain storage — at `execute_run` the employer's browser proves one
`confidential_transfer` per employee, and the vault routes them atomically
and records run state. The employer registers as the run's auditor, so every
salary stays decryptable to them and opaque to everyone else.

**PrivateEscrow** is custodial: each escrow deploys its own **instance
contract**, giving it its own isolated confidential account (a confidential
balance is keyed by contract address, so custody requires a dedicated address
per escrow). Funding an instance is two on-chain calls, not one —
`store_payout_proofs` stores the two pre-generated payout proofs
(instance→recipient, instance→depositor), then `fund` registers the instance
and transfers the amount in, refusing to run until the payout proofs are
already stored. They're split because all four proofs together (register +
transfer-in + both payout proofs, each a ~14KB UltraHonk proof) exceed what
fits in one Soroban transaction.

At settlement, the instance's own state machine (created → funded →
completed → released / disputed / refunded / cancelled) submits exactly the
one pre-generated proof it selects — the instance self-authorizes its own
outgoing `confidential_transfer` by invocation, so no one needs to hold its
key at settlement time. See the in-app Docs page for the full
funding-to-settlement flow.

> **Escrow trust caveat.** To pre-generate those two payout proofs, the
> depositor derives the instance's Grumpkin secret at fund time and must
> discard it afterward. A depositor who retains it could re-spend the
> escrowed balance and invalidate both stored proofs. Acceptable for a
> testnet demo; not for production.

**Compliance Policy** is a separate, admin-gated allowlist contract, wired
onto the token via `ComplianceConfig` (from OpenZeppelin's confidential
token compliance extension). Once wired, every deposit, transfer, receive,
and withdraw checks the policy first — an account off the allowlist is
rejected on-chain before any amount is touched. The same admin can also
freeze a specific account outright, independent of the allowlist. Both are
managed from the Auditor screen's Compliance panel by whoever holds the
compliance-admin wallet set at deploy time; the contract enforces that
itself, not the app.

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
- **Home · Shield · Send · Payroll · Escrow · Auditor · Verify · Profile** —
  the app, reachable from a sidebar (desktop) or bottom nav (mobile: five
  primary tabs plus a "More" sheet for Escrow, Verify, Auditor, and Profile),
  all one tap from each other — none of them redirect. Home is the default
  landing screen after connecting: balances, quick actions, and recent
  activity at a glance, including a "Prove" action on your own transfers
  right where they are in the feed. Shield, Send, Payroll, Escrow, Home, and
  Profile need a connected wallet and show an inline connect prompt in place
  of their content until one's attached; Auditor and Verify need no wallet
  at all — Verify is purely the verifier side of selective disclosure now
  (mint a request, check a returned bundle), since the holder side (proving)
  lives on Home, next to the transfer it's about.
- A shared component library (glass cards, proof-loading overlays, encrypted
  badges, a numeric keypad, tx-status steppers) and a `ConfidentialWallet`
  client class wrapping the SDK's crypto, proving, chain, and state layers.

For a full walkthrough of what each flow actually does on-chain, see the
in-app **Docs** page (`/docs`) — it covers Shield, Send, Payroll, Escrow, the
auditor model, and selective disclosure in depth.

## Building and testing the contracts

The contracts are a separate Cargo workspace and **must** build with
`stellar contract build` (the `stellar-tokens` dependency enables
soroban-sdk's `experimental_spec_shaking_v2`, which only that build path
supports).

```bash
pnpm build:contracts        # stellar contract build → packages/sdk/contracts/*.wasm
cargo test --manifest-path contracts/Cargo.toml
```

| Crate | Coverage | Tests |
|---|---|---|
| `contracts/payroll` | State machine, employer auth, atomic batch payout, cancel paths | 10 |
| `contracts/escrow-instance` | Every state transition, release-window timing, arbiter vs. no-arbiter branches, auth, the two-step `store_payout_proofs` → `fund` guard | 18 |
| `contracts/escrow-factory` | Deploys a real instance and drives it through `store_payout_proofs` → `fund` → `mark_completed` → `release` | 1 |
| `contracts/policy` | Allowlist add/remove/is_authorized round-trip, admin auth rejection | 3 |

## Deploying

The confidential token wraps a SEP-41 asset — **USDC**. Point the deploy at
the USDC Stellar Asset Contract via `UNDERLYING_TOKEN`:

```bash
# Derive the testnet USDC SAC once (issuer GBBD47IF…FLA5):
stellar contract id asset --asset USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 --network testnet
# → CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

UNDERLYING_TOKEN=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA pnpm deploy:contracts
```

Deploys the full stack — token, verifier, auditor, compliance policy,
PayrollVault, and the PrivateEscrow factory — under your `admin` stellar CLI
identity, and writes both `deployments/testnet.json` and
`packages/app/lib/deployment.json`. The token deploys with the compliance
hooks enabled and `admin` set as the compliance admin, and the script wires
the policy contract onto it via `set_compliance_config` right after deploy
(with `sac_passthrough: false` — the allowlist is the only gate). The app
reads the deployment file directly, so a redeploy takes effect with **no
code edit and no env var** — just rebuild and run. (`NEXT_PUBLIC_PAYROLL_ID` /
`NEXT_PUBLIC_ESCROW_FACTORY_ID` exist only to override those two ids ahead of
a redeploy, e.g. to point at someone else's.)

> Deployer identity: the `admin` key in your stellar CLI config.

A full end-to-end walkthrough, real proofs on testnet:

1. **Shield** — connect Freighter, register, deposit, merge.
2. **Send** — confidential transfer to a second registered account.
3. **Payroll** — create a template of employees, open + fund a run, enter
   salaries, execute; then **Auditor** decrypts every salary amount.
4. **Escrow** — deploy + fund an escrow (two wallet confirmations); walk it
   through mark-completed → release (or dispute → resolve).
5. **Selective disclosure** — mint a request on the Verify screen, disclose
   the matching transfer from Home's activity feed, verify the returned
   bundle back on Verify.
6. **Compliance** — on the Auditor screen's Compliance panel (connected as
   the compliance admin), allowlist an account, confirm Send/Shield reject
   it before allowlisting; freeze an account and confirm the same.

## Architecture

```
contracts/                    Rust/Soroban (separate Cargo workspace)
  token/                      Confidential token (register/deposit/merge/withdraw/transfer)
  verifier/                   UltraHonk verification-key registry
  auditor/                    Grumpkin auditor-key registry
  payroll/                    PayrollVault
  escrow-instance/            PrivateEscrow instance
  escrow-factory/             PrivateEscrow factory
  policy/                     Compliance allowlist policy
packages/
  sdk/        @lucent/sdk        crypto · witness · proving · chain (incl. payroll/escrow) · state · auditor · disclosure
  disclosure/ @lucent/disclosure shared disclosure circuits + pinned verification keys
  app/        @lucent/app        Next.js product front-end (Freighter wallet)
  indexer/    @lucent/indexer    optional Goldsky indexer for full event history
scripts/                         deploy.ts · deploy-escrow.ts · e2e.ts · e2e-disclosure.ts
```

## Deployed (testnet)

Read from `deployments/testnet.json`, rewritten automatically by
`pnpm deploy:contracts`.

| Contract | ID |
|---|---|
| Underlying | USDC SAC `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (issuer `GBBD47IF…FLA5`) |
| Confidential token | `CDQLYWKQYQ7QUUU6E5R4YTOZLEUN3OQ62GCS6SCCOLIL7SBT4T2MXPKU` |
| Verifier | `CD7K5WUH7PYGFJLTD4TH7BIEO4TOJUZBLGQDJTTXKASI5TLPLO4R6KDY` |
| Auditor | `CBJ43COFQXAWZNZTQQ6XD2T6WRKFAX37GKUD6D5RJE2Q2KLWIKAOVQ5V` (id `0` — demo key in the Docs page) |
| PayrollVault | `CB4S4ARQVMDI6WUS7IT4VB2EEQBGRFWRS23Q4N765Y6UNLHNU6T4AUFV` |
| PrivateEscrow factory | `CASFGRKYQNHJTI535X4KVXJOYJDKRGFTJDEPMJNR4WJMAQYVXY5GIOLI` |
| PrivateEscrow instance wasm | `44c5852692374c24c5fe2cc6c9e7fcfa936418365ae352266182743794501306` |

## Acknowledgments

Lucent is inspired by
[`stellar-confidential-token-demo`](https://github.com/brozorec/stellar-confidential-token-demo),
an open-source confidential-payments demo for Stellar (MIT). Its
confidential-token primitive builds on
[OpenZeppelin `stellar-contracts`](https://github.com/OpenZeppelin/stellar-contracts)
and [Nethermind's `rs-soroban-ultrahonk`](https://github.com/NethermindEth/rs-soroban-ultrahonk)
verifier.

## License

[MIT](LICENSE)
