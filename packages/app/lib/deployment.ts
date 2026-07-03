/**
 * Deployment the app talks to. Sourced from `lib/deployment.json`, which is
 * written by `pnpm deploy:contracts` (alongside `deployments/testnet.json`) — so
 * a redeploy updates the app with no code edit. The two Lucent contract ids
 * (PayrollVault, PrivateEscrow factory) can also be overridden from env.
 *
 * The auditor's Grumpkin SECRET key is deliberately *not* exposed here —
 * `deploy.ts` redacts it before writing this file, so it never enters the
 * client bundle. It stays in `deployments/testnet.json` (never imported by the
 * app) for the deployer's own records. `/auditor` takes a pasted-in key
 * instead of reading one from here.
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
  contracts: {
    token: deployment.contracts.token,
    verifier: deployment.contracts.verifier,
    auditor: deployment.contracts.auditor,
    underlying: deployment.contracts.underlying,
    /** Lucent contracts — empty until `pnpm deploy:contracts` runs. Env wins. */
    payroll: process.env.NEXT_PUBLIC_PAYROLL_ID || deployment.contracts.payroll || "",
    escrowFactory:
      process.env.NEXT_PUBLIC_ESCROW_FACTORY_ID || deployment.contracts.escrowFactory || "",
    /**
     * Compliance allowlist policy — empty until a redeploy wires the token's
     * ComplianceHooks + `set_compliance_config` (see `scripts/deploy.ts`).
     * When empty, the auditor screen's compliance section stays hidden rather
     * than showing controls that would just fail on-chain.
     */
    policy: deployment.contracts.policy || "",
  },
} as const;
