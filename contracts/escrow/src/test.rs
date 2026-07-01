#![cfg(test)]

use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, testutils::Ledger as _, Address,
    Bytes, Env, String, Vec,
};

use crate::{
    Error, EscrowState, PrivateEscrowInstance, PrivateEscrowInstanceClient, RELEASE_WINDOW,
};

// ---- mock confidential token -----------------------------------------------

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn register(_e: &Env, account: Address, _auditor_id: u32, _data: Bytes) {
        account.require_auth();
    }

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

    pub fn merge(_e: &Env, account: Address) {
        account.require_auth();
    }

    pub fn xfers(e: &Env) -> Vec<(Address, Address)> {
        e.storage().instance().get(&symbol_short!("xfers")).unwrap_or(Vec::new(e))
    }
}

// ---- fixtures --------------------------------------------------------------

const TIMEOUT: u64 = 3600;

struct Fixture {
    e: Env,
    token: Address,
    escrow: PrivateEscrowInstanceClient<'static>,
    depositor: Address,
    recipient: Address,
    arbiter: Option<Address>,
}

fn setup(with_arbiter: bool) -> Fixture {
    let e = Env::default();
    e.mock_all_auths();
    let token = e.register(MockToken, ());
    let depositor = Address::generate(&e);
    let recipient = Address::generate(&e);
    let arbiter = if with_arbiter { Some(Address::generate(&e)) } else { None };
    let id = e.register(
        PrivateEscrowInstance,
        (token.clone(), depositor.clone(), recipient.clone(), arbiter.clone(), TIMEOUT),
    );
    let escrow = PrivateEscrowInstanceClient::new(&e, &id);
    Fixture { e, token, escrow, depositor, recipient, arbiter }
}

fn b(f: &Fixture) -> Bytes {
    Bytes::from_array(&f.e, &[9u8; 8])
}

fn fund(f: &Fixture) {
    f.escrow.fund(&b(f), &0u32, &b(f), &b(f), &b(f));
}

fn advance_past_window(f: &Fixture, completed_at: u64) {
    f.e.ledger().set_timestamp(completed_at + RELEASE_WINDOW + 1);
}

fn last_payout_to(f: &Fixture) -> Address {
    let xfers = MockTokenClient::new(&f.e, &f.token).xfers();
    let (_, to) = xfers.get(xfers.len() - 1).unwrap();
    to
}

// ---- happy paths -----------------------------------------------------------

#[test]
fn fund_moves_to_funded() {
    let f = setup(false);
    fund(&f);
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Funded);
    // funding transfers depositor -> instance.
    let xfers = MockTokenClient::new(&f.e, &f.token).xfers();
    assert_eq!(xfers.len(), 1);
    assert_eq!(xfers.get(0).unwrap().0, f.depositor);
    assert_eq!(xfers.get(0).unwrap().1, f.escrow.address);
}

#[test]
fn normal_release_pays_recipient() {
    let f = setup(false);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "ipfs://proof"));
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Completed);
    f.escrow.release();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Released);
    assert_eq!(last_payout_to(&f), f.recipient);
}

#[test]
fn early_release_from_funded() {
    let f = setup(false);
    fund(&f);
    f.escrow.release();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Released);
    assert_eq!(last_payout_to(&f), f.recipient);
}

#[test]
fn claim_after_window_no_arbiter() {
    let f = setup(false);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    f.escrow.claim_after_window();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Released);
    assert_eq!(last_payout_to(&f), f.recipient);
}

#[test]
fn dispute_then_resolve_to_recipient() {
    let f = setup(true);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    f.escrow.dispute_with_proof(&String::from_str(&f.e, "evidence"));
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Disputed);
    f.escrow.resolve_to_recipient();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Released);
    assert_eq!(last_payout_to(&f), f.recipient);
}

#[test]
fn dispute_then_resolve_to_depositor() {
    let f = setup(true);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    f.escrow.dispute_with_proof(&String::from_str(&f.e, "evidence"));
    f.escrow.resolve_to_depositor();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Refunded);
    assert_eq!(last_payout_to(&f), f.depositor);
}

#[test]
fn timeout_refunds_depositor() {
    let f = setup(false);
    fund(&f);
    f.e.ledger().set_timestamp(TIMEOUT + 1);
    f.escrow.timeout();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Refunded);
    assert_eq!(last_payout_to(&f), f.depositor);
}

#[test]
fn cancel_unfunded() {
    let f = setup(false);
    f.escrow.cancel();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Cancelled);
}

// ---- guards ----------------------------------------------------------------

#[test]
fn cannot_fund_twice() {
    let f = setup(false);
    fund(&f);
    let res = f.escrow.try_fund(&b(&f), &0u32, &b(&f), &b(&f), &b(&f));
    assert_eq!(res, Err(Ok(Error::BadState)));
}

#[test]
fn mark_completed_requires_funded() {
    let f = setup(false);
    let res = f.escrow.try_mark_completed(&String::from_str(&f.e, "x"));
    assert_eq!(res, Err(Ok(Error::BadState)));
}

#[test]
fn claim_before_window_blocked() {
    let f = setup(false);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let res = f.escrow.try_claim_after_window();
    assert_eq!(res, Err(Ok(Error::ReleaseWindowActive)));
}

#[test]
fn claim_after_window_blocked_when_arbiter_set() {
    let f = setup(true);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    let res = f.escrow.try_claim_after_window();
    assert_eq!(res, Err(Ok(Error::ArbiterSet)));
}

#[test]
fn dispute_without_arbiter_blocked() {
    let f = setup(false);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    let res = f.escrow.try_dispute_with_proof(&String::from_str(&f.e, "x"));
    assert_eq!(res, Err(Ok(Error::NoArbiter)));
}

#[test]
fn timeout_too_early() {
    let f = setup(false);
    fund(&f);
    let res = f.escrow.try_timeout();
    assert_eq!(res, Err(Ok(Error::TooEarly)));
}

#[test]
fn timeout_blocked_after_completed() {
    let f = setup(false);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    f.e.ledger().set_timestamp(TIMEOUT + 1);
    // State is Completed, not Funded -> timeout is blocked.
    let res = f.escrow.try_timeout();
    assert_eq!(res, Err(Ok(Error::BadState)));
    let _ = f.arbiter;
}

// ---- auth ------------------------------------------------------------------

#[test]
#[should_panic]
fn stranger_cannot_mark_completed() {
    let e = Env::default();
    let token = e.register(MockToken, ());
    let depositor = Address::generate(&e);
    let recipient = Address::generate(&e);
    let id = e.register(
        PrivateEscrowInstance,
        (token, depositor.clone(), recipient, None::<Address>, TIMEOUT),
    );
    let escrow = PrivateEscrowInstanceClient::new(&e, &id);

    e.mock_all_auths();
    escrow.fund(
        &Bytes::from_array(&e, &[1]),
        &0u32,
        &Bytes::from_array(&e, &[1]),
        &Bytes::from_array(&e, &[1]),
        &Bytes::from_array(&e, &[1]),
    );

    // Real auth required now: nobody authorized as the recipient.
    e.set_auths(&[]);
    escrow.mark_completed(&String::from_str(&e, "x"));
}
