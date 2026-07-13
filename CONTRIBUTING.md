# Contributing to Lucent

Thanks for taking an interest in Lucent. This is a testnet-only, unaudited
confidential-payments protocol on Stellar — see the
["Not production ready"](README.md#not-production-ready) note before you dig
in. Contributions of all sizes are welcome: bug reports, docs fixes, tests,
and features.

## Ground rules

- Be respectful and constructive. See the [Code of Conduct](CODE_OF_CONDUCT.md).
- Found a potential security issue (a bug that could move or reveal funds in
  a way the protocol isn't supposed to allow)? Do **not** open a public
  issue — follow [SECURITY.md](SECURITY.md) instead.
- Open an issue before starting any large or architectural change, so we can
  agree on the approach before you invest the time.

## Project layout

```
contracts/    Rust/Soroban contracts — a separate Cargo workspace
packages/
  sdk/        @lucent/sdk        crypto · witness · proving · chain · state · auditor · disclosure
  disclosure/ @lucent/disclosure shared disclosure circuits + pinned verification keys
  app/        @lucent/app        Next.js front-end (Freighter wallet)
  indexer/    @lucent/indexer    optional Goldsky indexer
scripts/      build/deploy/e2e scripts shared across packages
```

See the [Architecture](README.md#architecture) and
[Protocol contracts](README.md#protocol-contracts) sections of the README for
how these fit together.

## Getting set up

Requires **Node ≥ 20**, **pnpm 10**, and — for contract work — Rust via
[`rustup`](https://rustup.rs) (the pinned toolchain in
`contracts/rust-toolchain.toml` installs itself automatically) plus
`stellar` CLI ≥ 25.2.

```bash
pnpm install
pnpm dev                     # http://localhost:3000
```

See the [Quickstart](README.md#quickstart) for wallet/testnet setup.

## Making changes

**Front-end / SDK (TypeScript)**

```bash
pnpm build:sdk               # @lucent/sdk must be built before the app runs against it
pnpm --filter @lucent/app typecheck
pnpm --filter @lucent/sdk typecheck
pnpm test:sdk                # full suite, including real proof generation (slow, needs network for the CRS on first run)
pnpm --filter @lucent/sdk test:fast   # everything except live proving — use this for quick iteration
```

**Contracts (Rust/Soroban)**

```bash
cargo test --manifest-path contracts/Cargo.toml
cargo clippy --manifest-path contracts/Cargo.toml --all-targets
cargo fmt --manifest-path contracts/Cargo.toml -- --check
pnpm build:contracts          # stellar contract build — required for wasm output, see contracts/Cargo.toml
```

If you touch a contract's public interface, update or add tests in that
crate — see the [test coverage table](README.md#building-and-testing-the-contracts)
in the README for what's already covered.

## Commits and pull requests

- Keep commits focused; a commit message should explain *why*, not just
  *what* (the diff already shows what).
- Rebase on top of `main` before opening a PR if it's fallen behind.
- Fill out the PR template — at minimum, state what changed, why, and how you
  tested it (unit tests, `e2e`/`e2e:disclosure` scripts, or manual testnet
  walkthrough).
- CI must pass (typecheck, SDK tests, contract tests/clippy/fmt) before
  merge.
- Small, reviewable PRs get reviewed faster than large ones.

## Reporting bugs / requesting features

Use the issue templates. For bugs, include: what you did, what you expected,
what happened, and — if it's chain-related — the network (testnet), the
contract IDs involved, and the transaction hash if you have one.
