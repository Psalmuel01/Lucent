//! Lucent's Confidential USDC Token contract.
//!
//! Wraps the `ConfidentialToken` implementation from `stellar-tokens`
//! (OpenZeppelin, `feat/confidential-verifier-ultrahonk`) with the compliance
//! extension hooks enabled. At construction it binds four collaborators, all
//! immutable for the address-as-field value and the underlying asset:
//!
//! * `underlying_asset` — the SEP-41 token whose reserves back every
//!   confidential balance. MUST have exact-transfer semantics (no
//!   fee-on-transfer, no rebasing).
//! * `verifier` — the [`ConfidentialVerifier`] registry holding one UltraHonk
//!   verification key per circuit type.
//! * `auditor` — the [`ConfidentialAuditor`] registry holding Grumpkin auditor
//!   public keys, indexed by `auditor_id`.
//! * `admin` — the compliance admin: the sole account authorized to
//!   freeze/unfreeze accounts and rotate the compliance policy (see
//!   [`ConfidentialCompliance`]). Gated via `stellar_access::access_control`,
//!   the same admin/role pattern the auditor registry contract already uses.
//!
//! # ⚠️ Not Production Ready
//!
//! The UltraHonk verifier backend and the circuits the verification keys are
//! derived from are **unaudited**. Do not deploy anywhere handling real value.
#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, Symbol, Vec};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_macros::only_admin;
// `ConfidentialAccount` / `SpenderDelegation` / `Bytes` are referenced by the
// default trait-method bodies that `#[contractimpl(contracttrait)]` generates
// for the read endpoints and the proof-carrying entry points; `Symbol` / `Vec`
// by the `AccessControl` default bodies. All must be in scope here even
// though this file never names them directly.
use stellar_tokens::confidential::{
    compliance::{ComplianceConfig, ComplianceHooks, ConfidentialCompliance},
    storage as token_storage, ConfidentialAccount, ConfidentialToken, SpenderDelegation,
};

#[contract]
pub struct ConfidentialTokenContract;

#[contractimpl]
impl ConfidentialTokenContract {
    /// Binds the underlying SEP-41 asset, the verifier registry, and the
    /// auditor registry, freezes the contract's address-as-field value used
    /// to domain-separate every account's viewing key, and sets the
    /// compliance admin. Compliance itself is left unconfigured (no policy,
    /// no SAC passthrough) — every hook is a no-op until
    /// `set_compliance_config` is called, so a deployment that never calls it
    /// behaves exactly as before this extension was added.
    pub fn __constructor(
        e: &Env,
        underlying_asset: Address,
        verifier: Address,
        auditor: Address,
        admin: Address,
    ) {
        token_storage::set_underlying_asset(e, &underlying_asset);
        token_storage::set_verifier(e, &verifier);
        token_storage::set_auditor(e, &auditor);
        token_storage::set_address_as_field_element(e);
        access_control::set_admin(e, &admin);
    }
}

#[contractimpl(contracttrait)]
impl ConfidentialToken for ConfidentialTokenContract {
    type Hooks = ComplianceHooks;
}

#[contractimpl(contracttrait)]
impl ConfidentialCompliance for ConfidentialTokenContract {
    #[only_admin]
    fn freeze(e: &Env, account: Address, operator: Address) {
        let _ = operator;
        stellar_tokens::confidential::compliance::storage::freeze(e, &account);
    }

    #[only_admin]
    fn unfreeze(e: &Env, account: Address, operator: Address) {
        let _ = operator;
        stellar_tokens::confidential::compliance::storage::unfreeze(e, &account);
    }

    #[only_admin]
    fn set_compliance_config(e: &Env, config: ComplianceConfig, operator: Address) {
        let _ = operator;
        stellar_tokens::confidential::compliance::storage::set_compliance_config(e, &config);
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for ConfidentialTokenContract {}
