"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { Callout } from "@/components/ui/Callout";
import { DEPLOYMENT } from "@/lib/deployment";

const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "how-it-works", label: "How it Works" },
  { id: "deposit-withdraw", label: "Deposit & Withdraw" },
  { id: "private-payments", label: "Private Payments" },
  { id: "payroll", label: "Confidential Payroll" },
  { id: "escrow", label: "Encrypted Escrow" },
  { id: "disclosure", label: "Selective Disclosure" },
  { id: "auditor", label: "Auditor View Key" },
  { id: "contracts", label: "Contracts" },
  { id: "faq", label: "FAQ" },
];

function Code({ children }: { children: string }) {
  return (
    <code className="inline-block rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.82em] text-accent/90">
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-border bg-[#0A0A0A] p-5 font-mono text-xs leading-relaxed text-text-secondary">
      {children}
    </pre>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-14 mb-5 scroll-mt-24 font-display text-2xl font-semibold text-text-primary first:mt-0">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-8 font-display text-base font-semibold text-text-primary">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[15px] leading-relaxed text-text-secondary">{children}</p>;
}

function AddressRow({ name, addr }: { name: string; addr: string }) {
  if (!addr) {
    return (
      <div className="flex flex-col justify-between gap-1.5 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center">
        <span className="text-sm font-medium text-text-primary">{name}</span>
        <span className="font-mono text-xs text-text-muted">not deployed yet</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col justify-between gap-1.5 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center">
      <span className="text-sm font-medium text-text-primary">{name}</span>
      <a
        href={`https://stellar.expert/explorer/testnet/contract/${addr}`}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all font-mono text-xs text-accent/80 transition-colors hover:text-accent"
      >
        {addr}
      </a>
    </div>
  );
}

export default function DocsPage() {
  const [activeId, setActiveId] = useState("introduction");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const headings = SECTIONS.map(({ id }) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    // Classic scrollspy: whichever heading's top has most recently scrolled
    // past a fixed line near the top of the viewport is "current," and it
    // stays current through that entire section's body — regardless of how
    // long the section is — until the next heading also passes the line.
    // (An IntersectionObserver "visible band" can't express this: once a
    // heading's own line scrolls out of a thin band, the observer drops it,
    // so long sections go dark for most of their own body.)
    const THRESHOLD = 100; // just below the fixed nav; matches scroll-mt-24

    let ticking = false;
    function update() {
      ticking = false;
      let current = headings[0]?.id;
      for (const el of headings) {
        if (el.getBoundingClientRect().top <= THRESHOLD) current = el.id;
        else break; // headings are in document order — none after this have passed either
      }
      if (current) setActiveId(current);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const addresses = {
    ConfidentialToken: DEPLOYMENT.contracts.token,
    Verifier: DEPLOYMENT.contracts.verifier,
    Auditor: DEPLOYMENT.contracts.auditor,
    PayrollVault: DEPLOYMENT.contracts.payroll,
    "PrivateEscrow Factory": DEPLOYMENT.contracts.escrowFactory,
  };

  return (
    <div className="min-h-dvh bg-void text-text-primary">
      <nav className="fixed left-0 right-0 top-0 z-40 border-b border-border bg-void/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-75">
            <LucentLogoMark size={24} />
            <span className="text-sm font-semibold">Lucent</span>
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            <span className="text-sm text-text-muted">Docs</span>
          </Link>
          <Link
            href="/shield"
            className="hidden items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-accent-hover sm:flex"
          >
            Launch App <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      <div className="mx-auto flex max-w-7xl pt-14">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col overflow-y-auto border-r border-border py-8 pr-4 lg:flex">
          <p className="mb-4 px-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">Contents</p>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setActiveId(id)}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeId === id ? "bg-accent-bg font-medium text-accent" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="fixed bottom-6 right-4 z-30 lg:hidden">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-text-secondary shadow-xl"
          >
            {SECTIONS.find((s) => s.id === activeId)?.label ?? "Contents"}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {sidebarOpen && (
            <div className="absolute bottom-12 right-0 w-48 rounded-2xl border border-border bg-surface-2 py-2 shadow-2xl">
              {SECTIONS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => {
                    setActiveId(id);
                    setSidebarOpen(false);
                  }}
                  className={`block px-4 py-2.5 text-sm transition-colors ${
                    activeId === id ? "text-accent" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>

        <main className="min-w-0 max-w-3xl flex-1 px-6 py-10 pb-32 lg:px-12">
          <H2 id="introduction">Introduction</H2>
          <P>
            Lucent is a confidential payments layer built on Stellar. It lets you send, receive, run
            payroll, and lock escrow while keeping every amount hidden on-chain — visible to no one
            except the parties you authorize, not even validators.
          </P>
          <Callout>
            <strong>Not production ready.</strong> The UltraHonk verifier backend and the circuits are
            unaudited, and the escrow custody model carries a documented trust caveat (see Encrypted
            Escrow, below). Lucent runs on Stellar testnet only — do not use it with real value.
          </Callout>
          <H3>The trust model</H3>
          <P>
            Lucent doesn&apos;t rely on trusted relayers or off-chain custody. Privacy comes from
            zero-knowledge proofs generated in your browser and verified natively by Stellar&apos;s
            Protocol 26 host functions. There is no operator key that could be compromised, and no
            bridge holding your funds.
          </P>
          <H3>The privacy model</H3>
          <P>
            Lucent encrypts <em>amounts only</em>. Counterparty addresses remain fully public, so
            on-chain auditability is preserved — you can verify that a payment moved from wallet A to
            wallet B without knowing how much. That is the right trade-off for payments and payroll:
            the <em>who</em> is public; the <em>how much</em> is private.
          </P>
          <P>
            Every balance is a Pedersen commitment on the Grumpkin curve, <Code>C = v·G + r·H</Code>.
            The network only ever sees commitments and the UltraHonk proofs that the arithmetic behind
            them is correct — no plaintext amount ever appears in a transaction, event, or contract
            state entry.
          </P>

          <H2 id="how-it-works">How it Works</H2>
          <P>
            Every confidential account holds a <strong>spendable</strong> balance (what you can send or
            withdraw) and a <strong>receiving</strong> balance (where deposits and incoming transfers
            land). A <Code>merge</Code> folds receiving into spendable — a homomorphic point addition
            that needs no proof.
          </P>
          <Pre>{`register    proof  Bind your Grumpkin keys to the contract (one-time)
deposit     —      Public USDC -> your receiving balance
merge       —      Fold receiving -> spendable
withdraw    proof  Spendable -> public USDC
transfer    proof  Spendable -> another account's receiving balance`}</Pre>
          <P>
            Every transfer also emits dual auditor ciphertexts — one for the sender&apos;s channel, one
            for the recipient&apos;s — so the registered auditor key can decrypt every amount without
            either party&apos;s cooperation.
          </P>

          <H2 id="deposit-withdraw">Deposit & Withdraw</H2>
          <H3>Register (one-time)</H3>
          <P>
            Before any of this, <strong>Shield</strong> derives a Grumpkin key set deterministically from
            a Freighter message signature — the same keys every session, nothing extra to back up — and
            proves ownership of it with a zero-knowledge proof that binds the key set to your Stellar
            address on the token contract. This happens once per account; every confidential operation
            below depends on it having already happened.
          </P>
          <H3>Deposit</H3>
          <P>
            Go to <strong>Shield</strong> and deposit. This moves public USDC into your confidential
            receiving balance at a 1:1 ratio — no proof required, since the deposit commitment has zero
            blinding. The deposit amount is a public plaintext <Code>i128</Code> in USDC base units
            (7 decimals, so 1 USDC = 10,000,000 base units). Merge it into spendable before sending or
            withdrawing.
          </P>
          <P>
            Spendable and receiving are shown as two separate numbers deliberately: a deposit (or an
            incoming transfer) counts as yours the moment it lands, but it isn&apos;t spendable or
            withdrawable until you merge it in.
          </P>
          <H3>Withdraw</H3>
          <P>
            Withdrawing is a two-step, in-browser flow: a withdraw proof is generated locally (this
            takes a few seconds — you&apos;re proving &quot;I can open this commitment to a value at
            most my balance&quot; without revealing the balance itself), then submitted on-chain. The
            Soroban verifier checks the proof and converts your spendable balance back into public USDC.
          </P>

          <H2 id="private-payments">Private Payments</H2>
          <P>
            Go to <strong>Send</strong>, choose a registered recipient, and enter an amount. A transfer
            proof is generated in your browser and submitted with the transaction — the recipient
            address is visible on-chain; the amount is not.
          </P>
          <H3>Why only registered recipients</H3>
          <P>
            Building the transfer proof requires the recipient&apos;s public viewing key (
            <Code>PVK</Code>), which only exists on-chain once they&apos;ve completed the one-time
            register step themselves. Send only lists addresses the app has already seen register — an
            address with no <Code>PVK</Code> has nowhere for the proof to encrypt an amount into.
          </P>
          <H3>What the proof actually proves</H3>
          <P>
            <Code>confidential_transfer</Code> proves, without revealing any of the three numbers
            involved: &quot;I know the opening of my spendable commitment, it covers at least this
            amount, and here are two new commitments — one for what I&apos;m sending and one for what
            stays in my own balance.&quot; The proof also seals the amount into two ciphertexts, one per
            auditor channel (sender&apos;s and recipient&apos;s), so a registered auditor can decrypt it
            later even though no one else can.
          </P>
          <P>
            The sent amount lands in the recipient&apos;s receiving balance, not spendable — same as a
            deposit, they merge it in whenever they like.
          </P>

          <H2 id="payroll">Confidential Payroll</H2>
          <P>
            <strong>PayrollVault</strong> is an orchestrator, not a custodian: an employer creates a
            template of employees and opens a run. Salaries never touch chain storage — at execution
            the employer&apos;s browser proves one confidential transfer per employee, and the vault
            routes them atomically. No employee can read another&apos;s salary, and the vault itself
            never sees a plaintext amount either.
          </P>
          <Pre>{`create_template(employer, employees) -> template_id
create_run(template_id)               -> run_id
fund_run(run_id)
execute_run(run_id, transfers)        // one proof per employee
cancel_run(run_id)
claim()                               // employee folds salary into spendable`}</Pre>
          <H3>Employer flow</H3>
          <P>
            <strong>Create a template</strong> once with the employee list — templates carry no
            amounts, just who gets paid. <strong>Create a run</strong> against it to open a{" "}
            <Code>Scheduled</Code> run. <strong>Fund the run</strong> records that the employer&apos;s
            confidential spendable balance covers the total — a state marker, not a transfer, since the
            vault can&apos;t read an encrypted balance to lock anything against it.
          </P>
          <P>
            <strong>Execute the run</strong> is where the money actually moves: the employer enters each
            salary, and the browser builds one transfer proof per employee, chained — employee 2&apos;s
            proof spends the balance opening left over after employee 1&apos;s, and so on, so the whole
            batch is internally consistent. All proofs submit in one transaction; the vault runs every
            transfer and only marks the run <Code>Executed</Code> if all of them succeed — no partial
            payroll runs. A <Code>Scheduled</Code> run can be cancelled any time before execution.
          </P>
          <H3>Employee flow</H3>
          <P>
            A paid employee sees the salary appear in their receiving balance and merges it into
            spendable with <strong>Claim</strong>, same <Code>merge</Code> as anywhere else — no proof
            needed.
          </P>
          <H3>Compliance</H3>
          <P>
            Every salary transfer is an ordinary <Code>confidential_transfer</Code>, so it carries the
            same dual auditor ciphertexts as a Send. Register the employer as the deployment&apos;s
            auditor and every salary they&apos;ve ever paid becomes decryptable to them on the Auditor
            screen — while each employee still only ever sees their own.
          </P>

          <H2 id="escrow">Encrypted Escrow</H2>
          <P>
            <strong>PrivateEscrow</strong> is custodial, unlike Payroll: the funds actually need to sit
            somewhere confidential between funding and release, and a confidential balance only exists
            at a contract address, so each escrow deploys its own tiny instance contract just to hold
            it — its own confidential account, isolated from every other escrow&apos;s.
          </P>
          <Pre>{`Depositor creates -> funds escrow      (CREATED -> FUNDED)
Recipient delivers -> mark_completed   (FUNDED -> COMPLETED)
Depositor reviews -> release           (COMPLETED -> RELEASED)

If depositor stalls past the release window:
  With arbiter    -> recipient disputes    (DISPUTED, arbiter resolves)
  Without arbiter -> recipient claims      (auto RELEASED)

No delivery -> depositor waits for timeout -> reclaims (REFUNDED)`}</Pre>
          <H3>Funding: two calls, not one</H3>
          <P>
            Funding is the expensive step, proof-wise — the depositor derives a one-time Grumpkin
            identity for the instance itself and builds four proofs: a register proof for that identity,
            a transfer-in proof (depositor → instance), and — because the instance can never generate a
            proof on its own later — both possible payout proofs up front, instance → recipient and
            instance → depositor. At roughly 14KB each, all four together exceed what fits in one
            Soroban transaction, so funding is two calls (two wallet confirmations, back to back):
          </P>
          <Pre>{`store_payout_proofs(release_proof, refund_proof)   // stored first
fund(register_data, auditor_id, transfer_in)       // then this moves the money`}</Pre>
          <P>
            <Code>fund</Code> checks the payout proofs are already stored before it will run, so the
            escrow can never end up <Code>Funded</Code> without a working settlement path already in
            place. Once funding completes, the depositor discards the instance&apos;s one-time secret —
            see the trust caveat below.
          </P>
          <H3>Settlement</H3>
          <P>
            Every payout proof was generated once, at funding time, against a fixed opening. That&apos;s
            what lets the instance submit one of them unattended, whenever the state machine says so: no
            one needs to be online or hold a key at settlement time. On the happy path the recipient
            marks delivery, a 10-minute release window opens, and the depositor releases. If the
            depositor stalls, the recipient either self-serves after the window (no arbiter) or escalates
            to a dispute (arbiter configured) — the arbiter resolves by state transition alone and never
            sees the amount.
          </P>
          <H3>Trust caveat</H3>
          <Callout>
            To pre-generate the two payout proofs, the depositor must derive the instance&apos;s Grumpkin
            secret at fund time. They&apos;re expected to discard it immediately afterward — a depositor
            who keeps it could re-spend the escrowed balance and invalidate both stored proofs.
            Acceptable for a testnet demo; not a production-grade custody model.
          </Callout>

          <H2 id="disclosure">Selective Disclosure</H2>
          <P>
            The Auditor screen gives one party standing access to everything under an auditor id — the
            right tool for a compliance relationship, wrong for a one-off. Selective disclosure answers
            a narrower need: proving <em>one specific payment</em> to someone who shouldn&apos;t get a
            decrypt key to your whole history — an accountant who needs one receipt, a landlord who
            wants proof of one rent payment. It&apos;s a proof, generated and verified entirely
            off-chain — there&apos;s no on-chain disclosure verifier, the chain is only ever read from,
            never written to, for this flow.
          </P>
          <H3>Two claims</H3>
          <P>
            <strong>D-recipient</strong> — &quot;this on-chain transfer paid me exactly this
            amount.&quot; Available for anything you received; you can already decrypt it with your own
            viewing key.
          </P>
          <P>
            <strong>D-sender</strong> — &quot;I sent this on-chain transfer for exactly this
            amount.&quot; This one needs more: you re-derive the one-time ephemeral scalar your wallet
            used at send time from data still on the event itself, then prove you can reconstruct what
            the recipient decrypted. If that scalar isn&apos;t recoverable (old local state, a different
            device), the transfer isn&apos;t disclosable as a sender — the Prove screen marks it
            accordingly.
          </P>
          <H3>How it works</H3>
          <P>
            On <strong>Verify</strong> (no wallet required — this can be anyone, even someone with no
            Stellar account at all), click &quot;Create request&quot;: a fresh public key and nonce,
            generated locally, that binds whatever proof comes back to this request specifically so it
            can&apos;t be replayed against someone else. Copy the resulting JSON and send it to the
            holder however you&apos;d normally share a file.
          </P>
          <P>
            On <strong>Prove</strong>, the holder pastes that JSON against the relevant transfer from
            their event list. The browser generates a zero-knowledge proof bound to it — a few seconds
            of in-browser proving — and produces a bundle to copy back. Paste the bundle into Verify to
            check it.
          </P>
          <H3>Why the verifier doesn&apos;t have to trust the bundle</H3>
          <P>
            The verifier never takes the holder&apos;s word for anything except the proof and one sealed
            ciphertext. It doesn&apos;t trust the bundle for who sent the transfer, who received it, or
            what the transaction even was — it re-reads the actual event from the chain by the
            bundle&apos;s event reference, re-reads the relevant account&apos;s public viewing key from
            the token contract, and re-derives every other public input from that independently-fetched
            chain state. Only then does it check the proof, and only after the proof checks out does it
            decrypt the sealed amount with the verifier&apos;s own secret key — never the holder&apos;s.
            The circuit&apos;s range and binding constraints mean a holder can&apos;t get a false amount
            past the proof by construction.
          </P>

          <H2 id="auditor">Auditor View Key</H2>
          <P>
            Every account registers under an auditor id. The holder of that Grumpkin secret key can
            decrypt every transfer amount and balance checkpoint on the <strong>Auditor</strong> screen —
            the institutional compliance primitive. Nobody else can. The screen needs no wallet: paste
            the secret into the unlock field, and it stays in page state only — never written to local
            storage, never sent anywhere, gone the moment you navigate away or reload. The app&apos;s
            shipped bundle does not contain a working default; that&apos;s deliberate, so no one gets
            auditor access just by loading the page.
          </P>
          <P>
            Once unlocked, the console fetches every transfer/withdraw event under that auditor id,
            decrypts each one, and replays the stream into a running per-account view: spendable balance
            from the sender-channel checkpoints, receiving balance as the sum of decrypted inbound
            transfers plus public deposits, folded on merge.
          </P>
          <H3>Try it — demo key (testnet only)</H3>
          <Callout tone="key">
            This deployment&apos;s registered auditor id <Code>0</Code> key, so you can try the console
            without deploying your own stack. Paste the <Code>secret</Code> value into the Auditor
            screen&apos;s unlock field.
          </Callout>
          <Pre>{`secret:  0x00b323d53fd43fc4e3710728fea88aa0600aa20726e07f1c558a17b682ed76b3
K_aud.x: 0x20e9114a670a4ac2ae297c65a8a6ecc26f782af39d9be7ea7134a562c5427030
K_aud.y: 0x1924f028600e145cebddced39723196c9765ced6717a28454a15d527ffc120c8`}</Pre>
          <P>
            This key decrypts every confidential balance and transfer registered under auditor id 0 on
            this specific testnet deployment. There&apos;s nothing sensitive behind it — testnet, no real
            value, and the whole point of this screen is that this is what an auditor is meant to see —
            but it is real key material for a live deployment, not a placeholder. It stops applying the
            moment this stack is redeployed (a fresh random key is generated each time); check the
            Contracts section below for which deployment is current.
          </P>

          <H2 id="contracts">Contracts</H2>
          <P>
            All contracts are deployed on Stellar testnet. Source is available on GitHub, built on{" "}
            <Code>OpenZeppelin/stellar-contracts</Code>.
          </P>
          <div className="mb-8 rounded-2xl border border-border bg-white/[0.02] px-5">
            {Object.entries(addresses).map(([name, addr]) => (
              <AddressRow key={name} name={name} addr={addr} />
            ))}
          </div>

          <H2 id="faq">FAQ</H2>
          <H3>Can anyone see my balance?</H3>
          <P>
            No. Your balance is a Pedersen commitment on-chain. The plaintext openings live only in
            events, reconstructed and persisted locally by your browser&apos;s state engine — never
            broadcast in the clear.
          </P>
          <H3>Does the escrow arbiter see the locked amount?</H3>
          <P>
            No. The arbiter resolves disputes by state transition alone; the amount stays hidden through
            the entire lifecycle.
          </P>
          <H3>Auditor console vs. selective disclosure — which one do I want?</H3>
          <P>
            Auditor if you need standing, ongoing visibility into every amount under an auditor id — the
            compliance relationship Payroll is built around. Selective disclosure if you need to prove
            just one payment to one party who shouldn&apos;t get broader access — see{" "}
            <a href="#disclosure" className="text-accent transition-colors hover:text-accent-hover">
              Selective Disclosure
            </a>{" "}
            above.
          </P>
          <H3>Is Lucent audited?</H3>
          <P>
            No. Lucent runs on Stellar testnet and the UltraHonk verifier and circuits are unaudited. Do
            not use it with real value.
          </P>
          <H3>What happens if I lose my wallet?</H3>
          <P>
            Confidential keys are derived deterministically from a Freighter signature, so they can be
            re-derived from the same wallet. Local balance history persisted in your browser is not
            recoverable if lost, but re-syncing from chain events reconstructs it within the RPC&apos;s
            ~7-day retention window.
          </P>
          <H3>Where is the source code?</H3>
          <P>
            The contracts and frontend are open source on{" "}
            <a
              href="https://github.com/Psalmuel01/Lucent"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent transition-colors hover:text-accent-hover"
            >
              GitHub
            </a>
            .
          </P>
        </main>
      </div>
    </div>
  );
}
