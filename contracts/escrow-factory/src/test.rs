#![cfg(test)]

use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, Address, Bytes, Env, String, Vec,
};

use crate::{PrivateEscrowFactory, PrivateEscrowFactoryClient};

// The real instance wasm, built by `stellar contract build` and committed under
// testdata/ so the factory's deploy path can be exercised in a unit test.
mod instance {
    soroban_sdk::contractimport!(file = "testdata/private_escrow_instance.wasm");
}

// Minimal confidential-token mock the deployed instance calls into.
#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn register(_e: &Env, account: Address, _auditor_id: u32, _data: Bytes) {
        account.require_auth();
    }
    pub fn confidential_transfer(e: &Env, from: Address, to: Address, _data: Bytes) {
        from.require_auth();
        let mut log: Vec<(Address, Address)> =
            e.storage().instance().get(&symbol_short!("xfers")).unwrap_or(Vec::new(e));
        log.push_back((from, to));
        e.storage().instance().set(&symbol_short!("xfers"), &log);
    }
    pub fn merge(_e: &Env, account: Address) {
        account.require_auth();
    }
}

fn install_instance(e: &Env) -> soroban_sdk::BytesN<32> {
    e.deployer().upload_contract_wasm(instance::WASM)
}

#[test]
fn create_escrow_deploys_a_working_instance() {
    let e = Env::default();
    e.mock_all_auths();

    let token = e.register(MockToken, ());
    let wasm = install_instance(&e);
    let factory_id = e.register(PrivateEscrowFactory, (token.clone(), wasm));
    let factory = PrivateEscrowFactoryClient::new(&e, &factory_id);

    let depositor = Address::generate(&e);
    let recipient = Address::generate(&e);

    let (id, addr) = factory.create_escrow(&depositor, &recipient, &None, &3600u64);
    assert_eq!(id, 1);
    assert_eq!(factory.escrow_count(), 1);
    assert_eq!(factory.escrow_address(&1), Some(addr.clone()));

    // The deployed instance is live and wired to the same token: drive it
    // through fund -> mark_completed -> release.
    let escrow = instance::Client::new(&e, &addr);
    let blob = Bytes::from_array(&e, &[7u8; 8]);
    escrow.store_payout_proofs(&blob, &blob);
    escrow.fund(&blob, &0u32, &blob);
    escrow.mark_completed(&String::from_str(&e, "ipfs://x"));
    escrow.release();
    assert_eq!(escrow.get_escrow().state, instance::EscrowState::Released);

    // Second escrow gets a distinct address.
    let (id2, addr2) = factory.create_escrow(&depositor, &recipient, &Some(recipient.clone()), &10u64);
    assert_eq!(id2, 2);
    assert_ne!(addr, addr2);
}
