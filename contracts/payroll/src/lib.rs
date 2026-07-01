//! PayrollVault — confidential salary distribution on Stellar.
//!
//! A port of the FHE reference (`shade-ref/contracts/PayrollVault.sol`) to the
//! confidential-token model. Because balances here are Pedersen commitments and
//! every spend needs an UltraHonk proof generated off-chain (a contract cannot
//! prove on-chain), this vault is an **orchestrator**, not a custodian of
//! encrypted balances:
//!
//! * The employer keeps their salary figures client-side (never on-chain — a
//!   plaintext salary in contract storage would leak it).
//! * `execute_run` routes one `confidential_transfer(employer -> employee)` per
//!   employee through the token. The employer is the transaction source, so the
//!   token's `from.require_auth()` is satisfied by the source-account credential
//!   that simulation attaches to the nested call.
//! * Each transfer emits the token's dual auditor ciphertexts, so an
//!   employer-registered auditor key can decrypt every salary amount while
//!   employees can read only their own — the compliance story, unchanged.
//!
//! The vault's job is the state machine (template -> run -> funded -> executed),
//! authorization (employer-only mutations), atomic batch payout, and the events
//! that drive the activity feed and auditor console.
//!
//! # ⚠️ Not Production Ready
//!
//! Built on the unaudited confidential-token demo. Testnet only.
#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, Address,
    Bytes, Env, Vec,
};

/// Minimal cross-contract view of the confidential token: only the entry points
/// the vault invokes. The generated `TokenClient` lets the vault call the token
/// deployed at an arbitrary address.
#[contractclient(name = "TokenClient")]
pub trait ConfidentialTokenInterface {
    fn confidential_transfer(env: Env, from: Address, to: Address, data: Bytes);
    fn merge(env: Env, account: Address);
}

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum Error {
    TemplateInactive = 2,
    TemplateNotFound = 3,
    RunNotFound = 4,
    NoEmployees = 5,
    BadState = 6,
    LengthMismatch = 7,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum RunStatus {
    /// Employees fixed, salaries still client-side; nothing funded yet.
    Scheduled = 0,
    /// Employer has asserted their spendable balance covers the run total.
    Funded = 1,
    /// Salaries paid out via per-employee confidential transfers.
    Executed = 2,
    /// Abandoned before execution.
    Cancelled = 3,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Template {
    pub employer: Address,
    pub employees: Vec<Address>,
    pub active: bool,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Run {
    pub template_id: u64,
    pub status: RunStatus,
    pub executed_at: u64,
}

// ---- events ----------------------------------------------------------------

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemplateCreated {
    #[topic]
    pub template_id: u64,
    pub employer: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RunCreated {
    #[topic]
    pub run_id: u64,
    pub template_id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RunFunded {
    #[topic]
    pub run_id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmployeePaid {
    #[topic]
    pub run_id: u64,
    pub employee: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RunExecuted {
    #[topic]
    pub run_id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RunCancelled {
    #[topic]
    pub run_id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claimed {
    pub employee: Address,
}

#[contracttype]
enum DataKey {
    /// Address of the confidential token this vault distributes.
    Token,
    TemplateCount,
    RunCount,
    Template(u64),
    Run(u64),
}

#[contract]
pub struct PayrollVault;

#[contractimpl]
impl PayrollVault {
    /// Bind the confidential token this vault pays salaries in.
    pub fn __constructor(e: &Env, token: Address) {
        e.storage().instance().set(&DataKey::Token, &token);
        e.storage().instance().set(&DataKey::TemplateCount, &0u64);
        e.storage().instance().set(&DataKey::RunCount, &0u64);
    }

    /// The confidential token address bound at construction.
    pub fn token(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Token).unwrap()
    }

    // ---- templates ---------------------------------------------------------

    /// Create a payroll template with a fixed set of employees. Only `employer`
    /// (the auth principal) can later create/fund/execute runs against it.
    pub fn create_template(
        e: &Env,
        employer: Address,
        employees: Vec<Address>,
    ) -> Result<u64, Error> {
        employer.require_auth();
        if employees.is_empty() {
            return Err(Error::NoEmployees);
        }

        let id = next_id(e, &DataKey::TemplateCount);
        e.storage().persistent().set(
            &DataKey::Template(id),
            &Template {
                employer: employer.clone(),
                employees,
                active: true,
                created_at: e.ledger().timestamp(),
            },
        );
        TemplateCreated { template_id: id, employer }.publish(e);
        Ok(id)
    }

    // ---- runs --------------------------------------------------------------

    /// Open a new payroll run against a template. Salaries stay in the
    /// employer's client (bound into the transfer proofs at `execute_run`), so
    /// they are never written to chain storage.
    pub fn create_run(e: &Env, template_id: u64) -> Result<u64, Error> {
        let t = get_template(e, template_id)?;
        t.employer.require_auth();
        if !t.active {
            return Err(Error::TemplateInactive);
        }

        let id = next_id(e, &DataKey::RunCount);
        e.storage().persistent().set(
            &DataKey::Run(id),
            &Run { template_id, status: RunStatus::Scheduled, executed_at: 0 },
        );
        RunCreated { run_id: id, template_id }.publish(e);
        Ok(id)
    }

    /// Mark a run funded. In the orchestrator model the vault holds no encrypted
    /// balance, so this records the employer's assertion that their confidential
    /// spendable balance covers the run total before execution.
    pub fn fund_run(e: &Env, run_id: u64) -> Result<(), Error> {
        let (t, mut r) = get_run_with_template(e, run_id)?;
        t.employer.require_auth();
        if r.status != RunStatus::Scheduled {
            return Err(Error::BadState);
        }
        r.status = RunStatus::Funded;
        e.storage().persistent().set(&DataKey::Run(run_id), &r);
        RunFunded { run_id }.publish(e);
        Ok(())
    }

    /// Execute the run: for each employee, route a `confidential_transfer` from
    /// the employer to that employee. `transfers[i]` is the XDR `TransferData`
    /// blob (witness + proof) generated in the employer's browser for the
    /// `employer -> employees[i]` transfer, in template order. All-or-nothing.
    pub fn execute_run(e: &Env, run_id: u64, transfers: Vec<Bytes>) -> Result<(), Error> {
        let (t, mut r) = get_run_with_template(e, run_id)?;
        t.employer.require_auth();
        if r.status != RunStatus::Funded {
            return Err(Error::BadState);
        }
        if transfers.len() != t.employees.len() {
            return Err(Error::LengthMismatch);
        }

        let token = TokenClient::new(e, &Self::token(e));
        for (i, employee) in t.employees.iter().enumerate() {
            let data = transfers.get(i as u32).unwrap();
            token.confidential_transfer(&t.employer, &employee, &data);
            EmployeePaid { run_id, employee }.publish(e);
        }

        r.status = RunStatus::Executed;
        r.executed_at = e.ledger().timestamp();
        e.storage().persistent().set(&DataKey::Run(run_id), &r);
        RunExecuted { run_id }.publish(e);
        Ok(())
    }

    /// Cancel a run before it executes. No custody to return in the orchestrator
    /// model — funds never left the employer.
    pub fn cancel_run(e: &Env, run_id: u64) -> Result<(), Error> {
        let (t, mut r) = get_run_with_template(e, run_id)?;
        t.employer.require_auth();
        if r.status == RunStatus::Executed || r.status == RunStatus::Cancelled {
            return Err(Error::BadState);
        }
        r.status = RunStatus::Cancelled;
        e.storage().persistent().set(&DataKey::Run(run_id), &r);
        RunCancelled { run_id }.publish(e);
        Ok(())
    }

    /// Employee convenience: fold received salary from the receiving balance
    /// into the spendable balance (the token's `merge`, no proof needed).
    pub fn claim(e: &Env, employee: Address) {
        employee.require_auth();
        let token = TokenClient::new(e, &Self::token(e));
        token.merge(&employee);
        Claimed { employee }.publish(e);
    }

    // ---- views -------------------------------------------------------------

    pub fn template_count(e: &Env) -> u64 {
        e.storage().instance().get(&DataKey::TemplateCount).unwrap_or(0)
    }

    pub fn run_count(e: &Env) -> u64 {
        e.storage().instance().get(&DataKey::RunCount).unwrap_or(0)
    }

    pub fn get_template(e: &Env, template_id: u64) -> Result<Template, Error> {
        get_template(e, template_id)
    }

    pub fn get_run(e: &Env, run_id: u64) -> Result<Run, Error> {
        e.storage()
            .persistent()
            .get(&DataKey::Run(run_id))
            .ok_or(Error::RunNotFound)
    }
}

// ---- helpers ---------------------------------------------------------------

fn next_id(e: &Env, key: &DataKey) -> u64 {
    let id: u64 = e.storage().instance().get(key).unwrap_or(0) + 1;
    e.storage().instance().set(key, &id);
    id
}

fn get_template(e: &Env, template_id: u64) -> Result<Template, Error> {
    e.storage()
        .persistent()
        .get(&DataKey::Template(template_id))
        .ok_or(Error::TemplateNotFound)
}

fn get_run_with_template(e: &Env, run_id: u64) -> Result<(Template, Run), Error> {
    let r: Run = e
        .storage()
        .persistent()
        .get(&DataKey::Run(run_id))
        .ok_or(Error::RunNotFound)?;
    let t = get_template(e, r.template_id)?;
    Ok((t, r))
}

mod test;
