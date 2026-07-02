//! A single confidential escrow. Deployed once per escrow by
//! [`PrivateEscrowFactory`](crate::PrivateEscrowFactory); its own address is its
//! confidential account.

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, Bytes, Env, String,
};

use crate::{Escrow, EscrowState, Error, TokenClient, RELEASE_WINDOW};

#[contracttype]
enum DataKey {
    Token,
    Escrow,
    /// Pre-generated payout proof: instance -> recipient.
    ReleaseProof,
    /// Pre-generated payout proof: instance -> depositor.
    RefundProof,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Funded {}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Completed {
    pub by: Address,
    pub proof_uri: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Released {}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Disputed {
    pub by: Address,
    pub proof_uri: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Refunded {}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Cancelled {}

#[contract]
pub struct PrivateEscrowInstance;

#[contractimpl]
impl PrivateEscrowInstance {
    /// Deployed by the factory. `timeout_seconds` counts from now; after it, the
    /// depositor may self-refund while still `Funded`.
    pub fn __constructor(
        e: &Env,
        token: Address,
        depositor: Address,
        recipient: Address,
        arbiter: Option<Address>,
        timeout_seconds: u64,
    ) {
        let now = e.ledger().timestamp();
        e.storage().instance().set(&DataKey::Token, &token);
        e.storage().instance().set(
            &DataKey::Escrow,
            &Escrow {
                depositor,
                recipient,
                arbiter,
                state: EscrowState::Created,
                created_at: now,
                timeout_at: now + timeout_seconds,
                completed_at: 0,
            },
        );
    }

    /// Store the two pre-generated payout proofs (instance → recipient,
    /// instance → depositor) the state machine will later select between.
    /// Split out from `fund` because bundling both proofs alongside the
    /// register and transfer-in proofs in one transaction exceeds Soroban's
    /// per-transaction size ceiling — four ~14KB UltraHonk proofs is too much
    /// for a single call. Must be called before `fund`; harmless to call again
    /// while still `Created` (last write wins).
    pub fn store_payout_proofs(e: &Env, release_proof: Bytes, refund_proof: Bytes) -> Result<(), Error> {
        let esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Created {
            return Err(Error::BadState);
        }
        e.storage().instance().set(&DataKey::ReleaseProof, &release_proof);
        e.storage().instance().set(&DataKey::RefundProof, &refund_proof);
        Ok(())
    }

    /// Lock funds into this escrow. The depositor:
    ///   * registers this instance as a confidential account (`register_data`
    ///     is the register proof for the instance's Grumpkin identity), and
    ///   * `confidential_transfer`s the amount in (`transfer_in`).
    /// Requires `store_payout_proofs` to have already been called — `Funded` is
    /// only ever reached with a complete, working payout-proof set already in
    /// place, so there is no reachable half-funded state. State: Created -> Funded.
    pub fn fund(
        e: &Env,
        register_data: Bytes,
        auditor_id: u32,
        transfer_in: Bytes,
    ) -> Result<(), Error> {
        let mut esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Created {
            return Err(Error::BadState);
        }
        if !e.storage().instance().has(&DataKey::ReleaseProof)
            || !e.storage().instance().has(&DataKey::RefundProof)
        {
            return Err(Error::PayoutProofsMissing);
        }

        let token = token(e);
        let this = e.current_contract_address();
        // The instance authorizes its own registration by invocation.
        token.register(&this, &auditor_id, &register_data);
        // from = depositor (the transaction source authorizes this).
        token.confidential_transfer(&esc.depositor, &this, &transfer_in);

        esc.state = EscrowState::Funded;
        put(e, &esc);
        Funded {}.publish(e);
        Ok(())
    }

    /// Recipient marks delivery; starts the release window, blocks timeout.
    /// State: Funded -> Completed.
    pub fn mark_completed(e: &Env, proof_uri: String) -> Result<(), Error> {
        let mut esc = get(e);
        esc.recipient.require_auth();
        if esc.state != EscrowState::Funded {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Completed;
        esc.completed_at = e.ledger().timestamp();
        put(e, &esc);
        Completed { by: esc.recipient, proof_uri }.publish(e);
        Ok(())
    }

    /// Depositor releases to the recipient. Callable from Funded (early) or
    /// Completed (normal). State: -> Released.
    pub fn release(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Funded && esc.state != EscrowState::Completed {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Released;
        put(e, &esc);
        payout(e, &recipient_proof(e), &esc.recipient);
        Released {}.publish(e);
        Ok(())
    }

    /// Recipient escalates to the arbiter after the release window. Requires an
    /// arbiter. State: Completed -> Disputed.
    pub fn dispute_with_proof(e: &Env, proof_uri: String) -> Result<(), Error> {
        let mut esc = get(e);
        esc.recipient.require_auth();
        if esc.state != EscrowState::Completed {
            return Err(Error::BadState);
        }
        if e.ledger().timestamp() < esc.completed_at + RELEASE_WINDOW {
            return Err(Error::ReleaseWindowActive);
        }
        if esc.arbiter.is_none() {
            return Err(Error::NoArbiter);
        }
        esc.state = EscrowState::Disputed;
        put(e, &esc);
        Disputed { by: esc.recipient, proof_uri }.publish(e);
        Ok(())
    }

    /// Recipient auto-claims when there is no arbiter and the release window has
    /// expired. State: Completed -> Released.
    pub fn claim_after_window(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        esc.recipient.require_auth();
        if esc.state != EscrowState::Completed {
            return Err(Error::BadState);
        }
        if e.ledger().timestamp() < esc.completed_at + RELEASE_WINDOW {
            return Err(Error::ReleaseWindowActive);
        }
        if esc.arbiter.is_some() {
            return Err(Error::ArbiterSet);
        }
        esc.state = EscrowState::Released;
        put(e, &esc);
        payout(e, &recipient_proof(e), &esc.recipient);
        Released {}.publish(e);
        Ok(())
    }

    /// Arbiter awards the escrow to the recipient. State: Disputed -> Released.
    pub fn resolve_to_recipient(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        let arbiter = esc.arbiter.clone().ok_or(Error::NoArbiter)?;
        arbiter.require_auth();
        if esc.state != EscrowState::Disputed {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Released;
        put(e, &esc);
        payout(e, &recipient_proof(e), &esc.recipient);
        Released {}.publish(e);
        Ok(())
    }

    /// Arbiter returns the escrow to the depositor. State: Disputed -> Refunded.
    pub fn resolve_to_depositor(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        let arbiter = esc.arbiter.clone().ok_or(Error::NoArbiter)?;
        arbiter.require_auth();
        if esc.state != EscrowState::Disputed {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Refunded;
        put(e, &esc);
        payout(e, &depositor_proof(e), &esc.depositor);
        Refunded {}.publish(e);
        Ok(())
    }

    /// Depositor reclaims a still-`Funded` escrow after timeout. Blocked once the
    /// recipient marks completed. State: Funded -> Refunded.
    pub fn timeout(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Funded {
            return Err(Error::BadState);
        }
        if e.ledger().timestamp() < esc.timeout_at {
            return Err(Error::TooEarly);
        }
        esc.state = EscrowState::Refunded;
        put(e, &esc);
        payout(e, &depositor_proof(e), &esc.depositor);
        Refunded {}.publish(e);
        Ok(())
    }

    /// Cancel an unfunded shell. State: Created -> Cancelled.
    pub fn cancel(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Created {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Cancelled;
        put(e, &esc);
        Cancelled {}.publish(e);
        Ok(())
    }

    // ---- views -------------------------------------------------------------

    pub fn get_escrow(e: &Env) -> Escrow {
        get(e)
    }

    pub fn token(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Token).unwrap()
    }
}

// ---- helpers ---------------------------------------------------------------

fn get(e: &Env) -> Escrow {
    e.storage().instance().get(&DataKey::Escrow).unwrap()
}

fn put(e: &Env, esc: &Escrow) {
    e.storage().instance().set(&DataKey::Escrow, esc);
}

fn token(e: &Env) -> TokenClient<'_> {
    TokenClient::new(e, &e.storage().instance().get(&DataKey::Token).unwrap())
}

fn recipient_proof(e: &Env) -> Bytes {
    e.storage().instance().get(&DataKey::ReleaseProof).unwrap()
}

fn depositor_proof(e: &Env) -> Bytes {
    e.storage().instance().get(&DataKey::RefundProof).unwrap()
}

/// Fold received funds into spendable, then send them out with the selected
/// pre-generated proof. `from` is this contract, which authorizes by invocation.
fn payout(e: &Env, proof: &Bytes, to: &Address) {
    let token = token(e);
    let this = e.current_contract_address();
    token.merge(&this);
    token.confidential_transfer(&this, to, proof);
}
