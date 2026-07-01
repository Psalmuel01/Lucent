/**
 * Deployment the app talks to. Sourced from `lib/deployment.json`, which is
 * written by `pnpm deploy:contracts` (alongside `deployments/testnet.json`) — so
 * a redeploy updates the app with no code edit. The two Lucent contract ids
 * (PayrollVault, PrivateEscrow factory) can also be overridden from env.
 *
 * ⚠️ Demo-only exception: `auditor.secretHex` is the auditor's Grumpkin SECRET
 * key, shipped in the client bundle on purpose so anyone can play the auditor on
 * /auditor. In any real deployment it never leaves the auditor's machine — only
 * the public key `K_aud = k·H` goes on-chain.
 */
import deployment from "./deployment.json";

export const DEPLOYMENT = {
  rpcUrl: deployment.rpcUrl,
  networkPassphrase: deployment.passphrase,
  /**
   * Optional Goldsky indexer (see packages/indexer/). When set, the app backfills
   * events older than the RPC's ~7-day retention window; when unset it runs
   * RPC-only. Read at build time from NEXT_PUBLIC_INDEXER_URL.
   */
  indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL || undefined,
  /** Ledger the token was deployed at — the first-sync start point. */
  deployedAtLedger: deployment.deployedAtLedger,
  /** All accounts in this deployment register under this auditor id. */
  auditorId: deployment.auditor.id,
  /** Auditor Grumpkin secret `k` (see header warning). */
  auditorSecretHex: deployment.auditor.secretHex,
  contracts: {
    token: deployment.contracts.token,
    verifier: deployment.contracts.verifier,
    auditor: deployment.contracts.auditor,
    underlying: deployment.contracts.underlying,
    /** Lucent contracts — empty until `pnpm deploy:contracts` runs. Env wins. */
    payroll: process.env.NEXT_PUBLIC_PAYROLL_ID || deployment.contracts.payroll || "",
    escrowFactory:
      process.env.NEXT_PUBLIC_ESCROW_FACTORY_ID || deployment.contracts.escrowFactory || "",
  },
} as const;
