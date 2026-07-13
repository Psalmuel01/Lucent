# Security Policy

Lucent is **testnet-only and unaudited** — see the
["Not production ready"](README.md#not-production-ready) note in the README.
The UltraHonk verifier backend and circuits have not been audited, and the
escrow custody model carries a documented trust caveat. Do not use it with
real value.

That said, we still want to know about security issues, especially anything
that would matter if this code were ever hardened for production:

- A way to move, mint, or withdraw confidential balances outside the rules
  described in [How value moves](README.md#how-value-moves).
- A way to bypass the compliance policy (allowlist/freeze) enforced by the
  token contract.
- A way to break confidentiality — recovering a plaintext amount, balance,
  or Grumpkin key without the corresponding decryption key.
- A soundness bug in a circuit or the on-chain verifier that lets an invalid
  proof pass.
- A way for the PayrollVault or PrivateEscrow contracts to move funds
  without the authorization the state machine is supposed to require.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive bugs.

Instead, email **dahunsisamuel1st@gmail.com** with:

- A description of the issue and its potential impact.
- Steps to reproduce (a failing test, script, or testnet transaction is
  ideal).
- Which contract(s), circuit(s), or SDK module(s) are affected.

You should get an acknowledgment within a few days. This is a small,
unfunded open-source project — there's no bug bounty, but we'll credit
reporters (unless you'd prefer to stay anonymous) once a fix ships.

## Scope

In scope: everything in `contracts/`, `packages/sdk`, `packages/disclosure`,
and the proving/verification logic they depend on.

Out of scope: third-party dependencies (report those upstream —
[OpenZeppelin `stellar-contracts`](https://github.com/OpenZeppelin/stellar-contracts),
[Nethermind `rs-soroban-ultrahonk`](https://github.com/NethermindEth/rs-soroban-ultrahonk)),
and anything requiring physical access to a user's device or browser
extension.
