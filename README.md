# Lucent — Confidential Payments on Stellar

**Lucent** is a confidential-payments product built on Stellar's confidential
token: balances are Pedersen commitments on the Grumpkin curve, and every spend
is proven with an UltraHonk zero-knowledge proof verified on-chain. On top of the
token, Lucent adds two Soroban contracts — **PayrollVault** and **PrivateEscrow** —
and a six-screen product front-end, with two compliance channels carried by the
token itself: **dual auditor** ciphertexts (a master-key auditor can decrypt every
transfer) and off-chain **selective disclosure** (a holder proves one amount of one
transfer to one designated receiver).

It is built on top of the [OpenZeppelin `stellar-contracts`](https://github.com/OpenZeppelin/stellar-contracts)
`feat/confidential-verifier-ultrahonk` confidential-token module.

> ⚠️ **Not production ready.** The UltraHonk verifier backend and the circuits are
> unaudited, and the escrow custody model carries a documented trust caveat (below).
> Testnet only; do not use with real value.

## Why the contracts work the way they do

A natural first instinct is to have the vault/escrow contract custody balances and
do the math on-chain. Stellar's confidential model rules that out:

- A balance is a commitment `C = v·G + r·H`; only commitments and proofs are ever on-chain.
- Every spend (`confidential_transfer`, `withdraw`) needs an UltraHonk proof generated
  **off-chain** by the holder of the sender's Grumpkin secret. **A Soroban contract
  cannot prove on-chain.**
- `deposit` is not a private alternative — its amount is a plaintext `i128` argument.

So confidential value can only move via `confidential_transfer`s whose proofs come
from the browser. That constraint shapes both new contracts into a **hybrid** design:

| Contract | Model | How value moves |
|----------|-------|-----------------|
| **PayrollVault** | Orchestrator | The employer keeps salaries client-side and, on `execute_run`, submits one browser-proven `employer → employee` transfer per employee; the vault routes them atomically and records run state. Salaries never touch chain storage. |
| **PrivateEscrow** | Custodial (factory) | Each escrow is a freshly deployed **instance contract** — its own address, hence its own isolated confidential account. The instance self-authorizes payouts as `from`; the depositor pre-generates both payout proofs at fund time and the state machine picks one. |

The compliance story is unchanged and comes from the **token**: every transfer emits
dual auditor ciphertexts to the registered Grumpkin key, so an employer-as-auditor can
decrypt all salary amounts while employees read only their own.

### Escrow trust caveat

To pre-generate the instance→recipient and instance→depositor payout proofs, the
depositor derives the escrow instance's Grumpkin secret at fund time and must discard
it afterward. A depositor who retains it could re-spend the escrowed balance and
invalidate both stored proofs. Acceptable for a testnet demo; not for production.

## The six screens

The front-end (`packages/app`) replaces the demo's three-persona chooser with a
product shell (dark theme, amber accents, Space Grotesk, glass cards, open-lock mark):

- **/shield** — deposit public XLM → confidential, merge, and withdraw back out.
- **/send** — confidential transfer to any registered account.
- **/payroll** — employer: template → run → fund → execute; employee: claim.
- **/escrow** — create/fund + a role- and state-aware action list (release, dispute, resolve, timeout, refund).
- **/auditor** — decrypt every transfer amount with the registered Grumpkin auditor key.
- **/prove** — selective disclosure, both sides: prove a transfer (holder) and verify a bundle (receiver).

Every proof-carrying action shows a "Generating proof…" state immediately (bb.js proofs
take a few seconds) — the UI never looks frozen. All balance reads go through the SDK's
`StateEngine` local persistence (the Soroban RPC only serves ~7 days of events), with a
"matches chain" badge from `verifyAgainstChain`.

## Getting started

```bash
pnpm install
pnpm build:sdk
pnpm dev                     # http://localhost:3000  (needs Freighter on Testnet)
```

Shield / Send / Auditor / Prove work against the already-deployed token below. Payroll
and Escrow need the Lucent contracts deployed (next section) with their ids set in the
app env.

## Building & testing the contracts

The contracts are a separate Cargo workspace and **must** build with `stellar contract
build` (the `stellar-tokens` dep enables soroban-sdk's `experimental_spec_shaking_v2`).

```bash
pnpm build:contracts        # stellar contract build → packages/sdk/contracts/*.wasm
cargo test --manifest-path contracts/Cargo.toml   # unit tests (mock-token based)
```

The new contracts are fully unit-tested against a mock confidential token:

- `contracts/payroll` — PayrollVault state machine, employer auth, atomic batch payout, cancel paths (10 tests).
- `contracts/escrow` — PrivateEscrow instance: every state transition, release-window timing, arbiter vs. no-arbiter branches, auth (16 tests).
- `contracts/escrow-factory` — deploys a real instance and drives it fund → mark_completed → release (1 test).

## Deploying to testnet (your own instance)

```bash
pnpm deploy:contracts       # deploys token stack + PayrollVault + PrivateEscrow factory
```

This writes `deployments/testnet.json` and prints the two ids to put in
`packages/app/.env.local`:

```
NEXT_PUBLIC_PAYROLL_ID=C...
NEXT_PUBLIC_ESCROW_FACTORY_ID=C...
```

Then rebuild/run the app. A full end-to-end walkthrough (real proofs on testnet):

1. **Shield** — connect Freighter, register, deposit, merge.
2. **Send** — confidential transfer to a second registered account.
3. **Payroll** — create a template of employees, open + fund a run, enter salaries, execute; then **Auditor** decrypts every salary amount.
4. **Escrow** — deploy + fund an escrow; walk it through mark-completed → release (or dispute → resolve).
5. **Prove** — mint a request on the Verify tab, disclose a transfer on the Prove tab, verify the returned bundle.

> Deployer identity: the `admin` key in your stellar CLI config. Requires Rust with
> `wasm32v1-none` and stellar-cli ≥ 25.2.

## Architecture

```
contracts/                    Rust/Soroban (separate Cargo workspace)
  token/                      ConfidentialToken (NoHooks) — the confidential token
  verifier/                   UltraHonk VK registry
  auditor/                    Grumpkin auditor-key registry
  payroll/                    PayrollVault — orchestrator (Lucent)
  escrow/                     PrivateEscrow instance — custodial, one per escrow (Lucent)
  escrow-factory/             PrivateEscrow factory — deploys instances (Lucent)
packages/
  sdk/        @ctd/sdk        crypto · witness · proving · chain (incl. payroll/escrow) · state · auditor · disclosure
  disclosure/ @ctd/disclosure shared disclosure circuits + pinned VKs
  app/        @ctd/app        Next.js product front-end (Freighter wallet)
  indexer/    @ctd/indexer    optional Goldsky indexer for event history
scripts/                      deploy.ts · e2e.ts · e2e-disclosure.ts
shade-ref/                    Shade's Solidity + frontend — REFERENCE ONLY, never edited
```

The protocol itself lives in [OpenZeppelin `stellar-contracts`](https://github.com/OpenZeppelin/stellar-contracts/tree/feat/confidential-verifier-ultrahonk),
consumed as git dependencies; the UltraHonk verifier backend is
[Nethermind's `rs-soroban-ultrahonk`](https://github.com/NethermindEth/rs-soroban-ultrahonk).

## Deployed (testnet)

The shared confidential-token stack (`deployments/testnet.json`):

| Contract | ID |
|----------|----|
| token | `CBF64DEOVQAXJFBSNGFEUT2AH4H7K5JBY3ZYJ5GVEINMNSDISWRG5N3F` |
| verifier | `CDCET36PIS44DWJM5UQSSI4ZHGRDSBIIQW4G4ALPYK3Y6FEQGY5ZWFXL` |
| auditor | `CA4II62E35TQKPGHCPBD6EBAS732GSGS6H37UUWKEDHR4YTBVMPHVY4L` |
| underlying | native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

PayrollVault and the PrivateEscrow factory are deployed per-instance by
`pnpm deploy:contracts` (they land in `deployments/testnet.json` and the app env).

## Prerequisites

- Node ≥ 20, pnpm 10
- For contracts: Rust with `wasm32v1-none`, `stellar` CLI ≥ 25.2. OZ crates are pulled
  as git deps (pinned by `Cargo.lock`).

## License

MIT.
