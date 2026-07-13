## What & why

<!-- What changed, and why. Link any related issue. -->

## Area

<!-- App / SDK / Contracts / Disclosure / Indexer / Docs -->

## How was this tested?

<!--
- [ ] Unit tests (pnpm test:sdk / cargo test)
- [ ] Manual testnet walkthrough (which flow(s)?)
- [ ] e2e / e2e:disclosure script
-->

## Checklist

- [ ] `pnpm --filter @lucent/sdk typecheck` and `pnpm --filter @lucent/app typecheck` pass
- [ ] `pnpm --filter @lucent/sdk test:fast` passes (or full `test` if proving code changed)
- [ ] `cargo test --manifest-path contracts/Cargo.toml` passes, if contracts changed
- [ ] Added/updated tests for the behavior this changes
- [ ] Updated the README or in-app Docs page if user-facing behavior changed
