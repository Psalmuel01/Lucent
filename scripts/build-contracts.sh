#!/usr/bin/env bash
# Builds the three demo contracts to wasm and copies the artifacts into
# packages/sdk/contracts/ so the SDK/deploy script can load them.
#
# Requires the pinned stable Rust toolchain with the wasm32v1-none target
# (see contracts/rust-toolchain.toml) and a local checkout of
# OpenZeppelin/stellar-contracts @ feat/confidential-verifier-ultrahonk at the
# path declared in contracts/Cargo.toml.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/contracts"

TARGET="wasm32v1-none"
OUT_DIR="$ROOT/packages/sdk/contracts"
mkdir -p "$OUT_DIR"

echo "==> Building contracts with 'stellar contract build' (target $TARGET)"
# `stellar contract build` is required (not plain `cargo build`) because the
# stellar-tokens dependency enables soroban-sdk's experimental_spec_shaking_v2
# feature, which only the stellar-cli build path supports.
stellar contract build

# "crate_wasm_name:output_name" pairs. Plain array (no `declare -A`) so this runs
# on macOS's stock bash 3.2.
WASMS=(
  "confidential_token_contract:confidential_token"
  "confidential_verifier_contract:confidential_verifier"
  "confidential_auditor_contract:confidential_auditor"
  "payroll_vault_contract:payroll_vault"
  "private_escrow_instance_contract:private_escrow_instance"
  "private_escrow_factory_contract:private_escrow_factory"
  "confidential_policy_contract:confidential_policy"
)

WASM_DIR="target/$TARGET/release"
for pair in "${WASMS[@]}"; do
  src="${pair%%:*}"
  dst="${pair##*:}"
  cp "$WASM_DIR/${src}.wasm" "$OUT_DIR/${dst}.wasm"
  echo "    wrote $OUT_DIR/${dst}.wasm ($(wc -c < "$OUT_DIR/${dst}.wasm") bytes)"
done

echo "Done."
