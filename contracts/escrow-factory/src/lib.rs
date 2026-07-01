//! PrivateEscrowFactory — deploys one confidential-escrow instance per escrow.
//!
//! Each escrow needs its own isolated confidential balance, and a confidential
//! balance is keyed by contract address, so every escrow is a freshly deployed
//! instance of the `private-escrow-instance-contract`. The factory installs that
//! instance wasm once (its hash is passed at construction) and deploys a new
//! instance on each `create_escrow`, keeping a registry for the UI.
//!
//! # ⚠️ Not Production Ready
//!
//! Built on the unaudited confidential-token demo. Testnet only.
#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, BytesN, Env};

#[contracttype]
enum DataKey {
    /// Confidential token every escrow settles in.
    Token,
    /// Wasm hash of the escrow-instance contract to deploy.
    InstanceWasm,
    Count,
    /// id -> deployed instance address.
    Escrow(u64),
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowCreated {
    #[topic]
    pub id: u64,
    pub address: Address,
    pub depositor: Address,
    pub recipient: Address,
}

#[contract]
pub struct PrivateEscrowFactory;

#[contractimpl]
impl PrivateEscrowFactory {
    /// `instance_wasm` is the hash of the already-installed escrow-instance
    /// wasm (upload it once, then pass the hash here).
    pub fn __constructor(e: &Env, token: Address, instance_wasm: BytesN<32>) {
        e.storage().instance().set(&DataKey::Token, &token);
        e.storage().instance().set(&DataKey::InstanceWasm, &instance_wasm);
        e.storage().instance().set(&DataKey::Count, &0u64);
    }

    /// Create (deploy) a new escrow. Returns its id and deployed address.
    pub fn create_escrow(
        e: &Env,
        depositor: Address,
        recipient: Address,
        arbiter: Option<Address>,
        timeout_seconds: u64,
    ) -> (u64, Address) {
        depositor.require_auth();

        let id: u64 = e.storage().instance().get(&DataKey::Count).unwrap_or(0) + 1;
        e.storage().instance().set(&DataKey::Count, &id);

        let token: Address = e.storage().instance().get(&DataKey::Token).unwrap();
        let wasm: BytesN<32> = e.storage().instance().get(&DataKey::InstanceWasm).unwrap();

        let mut salt = [0u8; 32];
        salt[..8].copy_from_slice(&id.to_be_bytes());
        let salt = BytesN::from_array(e, &salt);

        let address = e.deployer().with_current_contract(salt).deploy_v2(
            wasm,
            (token, depositor.clone(), recipient.clone(), arbiter, timeout_seconds),
        );

        e.storage().persistent().set(&DataKey::Escrow(id), &address);
        EscrowCreated { id, address: address.clone(), depositor, recipient }.publish(e);
        (id, address)
    }

    // ---- views -------------------------------------------------------------

    pub fn escrow_count(e: &Env) -> u64 {
        e.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    pub fn escrow_address(e: &Env, id: u64) -> Option<Address> {
        e.storage().persistent().get(&DataKey::Escrow(id))
    }

    pub fn token(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Token).unwrap()
    }
}

#[cfg(test)]
mod test;
