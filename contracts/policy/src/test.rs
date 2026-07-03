#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{CompliancePolicyContract, CompliancePolicyContractClient};

struct Fixture {
    e: Env,
    policy: CompliancePolicyContractClient<'static>,
    admin: Address,
}

fn setup() -> Fixture {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let id = e.register(CompliancePolicyContract, (admin.clone(),));
    let policy = CompliancePolicyContractClient::new(&e, &id);
    Fixture { e, policy, admin }
}

#[test]
fn starts_with_nobody_allowed() {
    let f = setup();
    let someone = Address::generate(&f.e);
    assert!(!f.policy.is_allowed(&someone));
    assert!(!f.policy.is_authorized(&someone, &f.admin));
}

#[test]
fn admin_can_add_and_remove() {
    let f = setup();
    let account = Address::generate(&f.e);
    let token = Address::generate(&f.e);

    f.policy.add(&account);
    assert!(f.policy.is_allowed(&account));
    assert!(f.policy.is_authorized(&account, &token));

    f.policy.remove(&account);
    assert!(!f.policy.is_allowed(&account));
    assert!(!f.policy.is_authorized(&account, &token));
}

#[test]
#[should_panic]
fn non_admin_cannot_add() {
    // No mocked auths at all — any `require_auth()` in the admin check panics.
    let e = Env::default();
    let admin = Address::generate(&e);
    let id = e.register(CompliancePolicyContract, (admin,));
    let policy = CompliancePolicyContractClient::new(&e, &id);
    let account = Address::generate(&e);

    policy.add(&account);
}
