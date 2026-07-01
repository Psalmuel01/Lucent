#![cfg(test)]

use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, vec, Address, Bytes, Env, Vec,
};

use crate::{Error, PayrollVault, PayrollVaultClient, RunStatus};

// ---- mock confidential token -----------------------------------------------
//
// Records the (from, to) of every `confidential_transfer` and the account of
// every `merge`, and enforces the same `require_auth` the real token does, so
// the vault's auth wiring is exercised.

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn confidential_transfer(e: &Env, from: Address, to: Address, _data: Bytes) {
        from.require_auth();
        let mut log: Vec<(Address, Address)> = e
            .storage()
            .instance()
            .get(&symbol_short!("xfers"))
            .unwrap_or(Vec::new(e));
        log.push_back((from, to));
        e.storage().instance().set(&symbol_short!("xfers"), &log);
    }

    pub fn merge(e: &Env, account: Address) {
        account.require_auth();
        let mut log: Vec<Address> = e
            .storage()
            .instance()
            .get(&symbol_short!("merges"))
            .unwrap_or(Vec::new(e));
        log.push_back(account);
        e.storage().instance().set(&symbol_short!("merges"), &log);
    }

    pub fn xfers(e: &Env) -> Vec<(Address, Address)> {
        e.storage().instance().get(&symbol_short!("xfers")).unwrap_or(Vec::new(e))
    }

    pub fn merges(e: &Env) -> Vec<Address> {
        e.storage().instance().get(&symbol_short!("merges")).unwrap_or(Vec::new(e))
    }
}

// ---- fixtures --------------------------------------------------------------

struct Fixture {
    e: Env,
    vault: PayrollVaultClient<'static>,
    token: Address,
    employer: Address,
    employees: Vec<Address>,
}

fn setup() -> Fixture {
    let e = Env::default();
    e.mock_all_auths();
    let token = e.register(MockToken, ());
    let vault_id = e.register(PayrollVault, (token.clone(),));
    let vault = PayrollVaultClient::new(&e, &vault_id);
    let employer = Address::generate(&e);
    let employees = vec![&e, Address::generate(&e), Address::generate(&e)];
    Fixture { e, vault, token, employer, employees }
}

fn token_client<'a>(f: &'a Fixture) -> MockTokenClient<'a> {
    MockTokenClient::new(&f.e, &f.token)
}

fn dummy_transfers(f: &Fixture) -> Vec<Bytes> {
    let mut v = Vec::new(&f.e);
    for _ in 0..f.employees.len() {
        v.push_back(Bytes::from_array(&f.e, &[1, 2, 3]));
    }
    v
}

// ---- happy path ------------------------------------------------------------

#[test]
fn full_run_lifecycle() {
    let f = setup();
    let tid = f.vault.create_template(&f.employer, &f.employees);
    assert_eq!(tid, 1);
    assert_eq!(f.vault.template_count(), 1);

    let rid = f.vault.create_run(&tid);
    assert_eq!(rid, 1);
    assert_eq!(f.vault.get_run(&rid).status, RunStatus::Scheduled);

    f.vault.fund_run(&rid);
    assert_eq!(f.vault.get_run(&rid).status, RunStatus::Funded);

    f.vault.execute_run(&rid, &dummy_transfers(&f));
    let run = f.vault.get_run(&rid);
    assert_eq!(run.status, RunStatus::Executed);

    // one confidential_transfer per employee, employer -> employee, in order.
    let xfers = token_client(&f).xfers();
    assert_eq!(xfers.len(), f.employees.len());
    for (i, employee) in f.employees.iter().enumerate() {
        let (from, to) = xfers.get(i as u32).unwrap();
        assert_eq!(from, f.employer);
        assert_eq!(to, employee);
    }
}

#[test]
fn claim_merges_for_employee() {
    let f = setup();
    let emp = f.employees.get(0).unwrap();
    f.vault.claim(&emp);
    let merges = token_client(&f).merges();
    assert_eq!(merges.len(), 1);
    assert_eq!(merges.get(0).unwrap(), emp);
}

// ---- guards ----------------------------------------------------------------

#[test]
fn empty_employees_rejected() {
    let f = setup();
    let res = f.vault.try_create_template(&f.employer, &Vec::new(&f.e));
    assert_eq!(res, Err(Ok(Error::NoEmployees)));
}

#[test]
fn execute_requires_funded_state() {
    let f = setup();
    f.vault.create_template(&f.employer, &f.employees);
    let rid = f.vault.create_run(&1);
    // still Scheduled, not Funded.
    let res = f.vault.try_execute_run(&rid, &dummy_transfers(&f));
    assert_eq!(res, Err(Ok(Error::BadState)));
}

#[test]
fn cannot_execute_twice() {
    let f = setup();
    f.vault.create_template(&f.employer, &f.employees);
    let rid = f.vault.create_run(&1);
    f.vault.fund_run(&rid);
    f.vault.execute_run(&rid, &dummy_transfers(&f));
    let res = f.vault.try_execute_run(&rid, &dummy_transfers(&f));
    assert_eq!(res, Err(Ok(Error::BadState)));
}

#[test]
fn transfers_length_must_match_employees() {
    let f = setup();
    f.vault.create_template(&f.employer, &f.employees);
    let rid = f.vault.create_run(&1);
    f.vault.fund_run(&rid);
    let short = vec![&f.e, Bytes::from_array(&f.e, &[1])];
    let res = f.vault.try_execute_run(&rid, &short);
    assert_eq!(res, Err(Ok(Error::LengthMismatch)));
}

#[test]
fn cancel_blocks_after_execution() {
    let f = setup();
    f.vault.create_template(&f.employer, &f.employees);
    let rid = f.vault.create_run(&1);
    f.vault.fund_run(&rid);
    f.vault.execute_run(&rid, &dummy_transfers(&f));
    let res = f.vault.try_cancel_run(&rid);
    assert_eq!(res, Err(Ok(Error::BadState)));
}

#[test]
fn cancel_scheduled_run_ok() {
    let f = setup();
    f.vault.create_template(&f.employer, &f.employees);
    let rid = f.vault.create_run(&1);
    f.vault.cancel_run(&rid);
    assert_eq!(f.vault.get_run(&rid).status, RunStatus::Cancelled);
}

#[test]
fn unknown_run_and_template() {
    let f = setup();
    assert_eq!(f.vault.try_get_run(&99), Err(Ok(Error::RunNotFound)));
    assert_eq!(f.vault.try_get_template(&99), Err(Ok(Error::TemplateNotFound)));
}

// ---- auth ------------------------------------------------------------------

#[test]
#[should_panic]
fn non_employer_cannot_create_run() {
    let e = Env::default();
    let token = e.register(MockToken, ());
    let vault_id = e.register(PayrollVault, (token.clone(),));
    let vault = PayrollVaultClient::new(&e, &vault_id);
    let employer = Address::generate(&e);
    let employees = vec![&e, Address::generate(&e)];

    // Only the employer's auth is mocked; create_template succeeds.
    e.mock_all_auths();
    vault.create_template(&employer, &employees);

    // Now require real auth: a stranger calling create_run has no authorization.
    e.set_auths(&[]);
    vault.create_run(&1);
}
