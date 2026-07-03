//! Confidential token compliance allowlist policy.
//!
//! Implements `stellar_tokens::confidential::compliance::Policy` — when wired
//! onto a confidential token via `ComplianceConfig.policy`, the token calls
//! `is_authorized(account, token)` on every gated operation (deposit,
//! transfer, receive, withdraw). Accounts not on the allowlist are rejected.
//! One registry can gate multiple tokens; `token` is accepted but unused here
//! since this deployment only ever wires one token to it.
//!
//! # ⚠️ Not Production Ready
//!
//! Part of an unaudited confidential-token demo. Do not use with real value.
#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};
use stellar_access::access_control;
use stellar_macros::only_admin;
use stellar_tokens::confidential::compliance::Policy;

#[cfg(test)]
mod test;

/// TTL bookkeeping for the per-account allowlist flag, mirroring the
/// confidential token's own `Frozen` entry discipline (see
/// `stellar_tokens::confidential::compliance::storage`).
const ALLOWLIST_TTL_THRESHOLD: u32 = 518_400; // ~30 days at 5s/ledger
const ALLOWLIST_EXTEND_AMOUNT: u32 = 1_036_800; // ~60 days at 5s/ledger

#[contracttype]
pub enum DataKey {
    Allowed(Address),
}

#[contract]
pub struct CompliancePolicyContract;

#[contractimpl]
impl CompliancePolicyContract {
    pub fn __constructor(e: &Env, admin: Address) {
        access_control::set_admin(e, &admin);
    }

    /// Adds `account` to the allowlist. Admin-only.
    #[only_admin]
    pub fn add(e: &Env, account: Address) {
        let key = DataKey::Allowed(account);
        e.storage().persistent().set(&key, &true);
        e.storage().persistent().extend_ttl(&key, ALLOWLIST_TTL_THRESHOLD, ALLOWLIST_EXTEND_AMOUNT);
    }

    /// Removes `account` from the allowlist. Admin-only.
    #[only_admin]
    pub fn remove(e: &Env, account: Address) {
        e.storage().persistent().remove(&DataKey::Allowed(account));
    }

    /// Public view: is `account` currently allowlisted?
    pub fn is_allowed(e: &Env, account: Address) -> bool {
        let key = DataKey::Allowed(account);
        if e.storage().persistent().has(&key) {
            e.storage().persistent().extend_ttl(&key, ALLOWLIST_TTL_THRESHOLD, ALLOWLIST_EXTEND_AMOUNT);
            true
        } else {
            false
        }
    }
}

#[contractimpl]
impl Policy for CompliancePolicyContract {
    fn is_authorized(e: Env, account: Address, _token: Address) -> bool {
        Self::is_allowed(&e, account)
    }
}
