"use client";

import { useState } from "react";

import { DEPLOYMENT } from "@/lib/deployment";
import { useWallet } from "@/lib/wallet-context";
import { useAction } from "@/lib/use-action";
import { errMsg } from "@/lib/err";
import {
  ConnectPrompt,
  ErrorBox,
  Field,
  GlassCard,
  Pill,
  ProofButton,
  SectionTitle,
  inputCls,
} from "@/lib/ui";

export default function PayrollPage() {
  const { wallet, connect, connecting, error, setError } = useWallet();
  const { run, busy, phase } = useAction();

  const [employeesText, setEmployeesText] = useState("");
  const [employees, setEmployees] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<bigint | null>(null);
  const [runId, setRunId] = useState<bigint | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const configured = Boolean(DEPLOYMENT.contracts.payroll);

  if (!wallet) {
    return (
      <Shell>
        <ErrorBox message={error} />
        <ConnectPrompt onConnect={connect} busy={connecting} />
      </Shell>
    );
  }

  if (!configured) {
    return (
      <Shell>
        <NotDeployed name="PayrollVault" env="NEXT_PUBLIC_PAYROLL_ID" />
      </Shell>
    );
  }

  const parseEmployees = () =>
    employeesText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const createTemplate = () =>
    run(
      "template",
      async () => {
        const emp = parseEmployees();
        if (emp.length === 0) throw new Error("enter at least one employee address");
        const id = await wallet.createTemplate(emp);
        setTemplateId(id);
        setEmployees(emp);
        setAmounts(Object.fromEntries(emp.map((a) => [a, ""])));
        setRunId(null);
      },
      { refresh: false },
    );

  const loadTemplate = (idStr: string) =>
    run(
      "load",
      async () => {
        const id = BigInt(idStr);
        const t = await wallet.payrollTemplate(id);
        setTemplateId(id);
        setEmployees(t.employees);
        setAmounts(Object.fromEntries(t.employees.map((a) => [a, ""])));
      },
      { refresh: false },
    );

  const openRun = () =>
    run(
      "openrun",
      async () => {
        if (templateId === null) throw new Error("create or load a template first");
        setRunId(await wallet.createRun(templateId));
      },
      { refresh: false },
    );

  const fund = () =>
    run("fund", async () => {
      if (runId === null) throw new Error("open a run first");
      await wallet.fundRun(runId);
    }, { refresh: false });

  const execute = () =>
    run("exec", async (sp) => {
      if (runId === null) throw new Error("open a run first");
      const payments = employees.map((employee) => ({
        employee,
        amount: BigInt(amounts[employee] || "0"),
      }));
      if (payments.some((p) => p.amount <= 0n)) throw new Error("every salary must be > 0");
      await wallet.executeRun(runId, payments, sp);
    });

  const cancel = () =>
    run("cancel", async () => {
      if (runId === null) throw new Error("no run to cancel");
      await wallet.cancelRun(runId);
    }, { refresh: false });

  return (
    <Shell>
      <ErrorBox message={error} />

      <GlassCard>
        <SectionTitle
          title="1 · Template"
          hint="Fix the set of employees. Salaries are entered later and never stored on-chain."
        />
        <Field label="Employee addresses (one per line)">
          <textarea
            className={`${inputCls} h-28 font-mono text-xs`}
            value={employeesText}
            onChange={(e) => setEmployeesText(e.target.value)}
            placeholder={"G…\nG…"}
          />
        </Field>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ProofButton onClick={createTemplate} busy={busy === "template"}>
            Create template
          </ProofButton>
          <LoadById label="load existing template #" onLoad={loadTemplate} busy={busy === "load"} />
          {templateId !== null && <Pill tone="amber">template #{templateId.toString()}</Pill>}
        </div>
      </GlassCard>

      {templateId !== null && (
        <GlassCard>
          <SectionTitle title="2 · Run" hint="Open a run, mark it funded, then execute the confidential payouts." />
          <div className="flex flex-wrap items-center gap-2">
            <ProofButton onClick={openRun} busy={busy === "openrun"} variant="ghost">
              Open run
            </ProofButton>
            <ProofButton onClick={fund} busy={busy === "fund"} variant="ghost" disabled={runId === null}>
              Fund run
            </ProofButton>
            <ProofButton onClick={cancel} busy={busy === "cancel"} variant="danger" disabled={runId === null}>
              Cancel
            </ProofButton>
            {runId !== null && <Pill tone="amber">run #{runId.toString()}</Pill>}
          </div>
        </GlassCard>
      )}

      {templateId !== null && (
        <GlassCard>
          <SectionTitle
            title="3 · Salaries"
            hint="Enter each salary, then execute. One confidential transfer per employee is proven in-browser and submitted atomically."
          />
          <div className="space-y-2">
            {employees.map((a) => (
              <div key={a} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-400">{a}</span>
                <input
                  className={`${inputCls} w-32`}
                  value={amounts[a] ?? ""}
                  onChange={(e) => setAmounts((m) => ({ ...m, [a]: e.target.value }))}
                  placeholder="amount"
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <ProofButton onClick={execute} busy={busy === "exec"} phase={phase} disabled={runId === null}>
              Execute payroll
            </ProofButton>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <SectionTitle title="Employee · Claim" hint="Fold a received salary into your spendable balance." />
        <ProofButton onClick={() => run("claim", () => wallet.claimSalary())} busy={busy === "claim"} variant="ghost">
          Claim salary
        </ProofButton>
      </GlassCard>
    </Shell>
  );
}

function LoadById({ label, onLoad, busy }: { label: string; onLoad: (id: string) => void; busy: boolean }) {
  const [id, setId] = useState("");
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <input className={`${inputCls} w-16`} value={id} onChange={(e) => setId(e.target.value)} />
      <button
        onClick={() => onLoad(id)}
        disabled={busy || !id}
        className="rounded-lg border border-white/15 px-2 py-1 text-xs text-neutral-200 hover:border-white/30 disabled:opacity-50"
      >
        {busy ? "…" : "load"}
      </button>
    </div>
  );
}

function NotDeployed({ name, env }: { name: string; env: string }) {
  return (
    <GlassCard>
      <SectionTitle title={`${name} not configured`} />
      <p className="text-sm text-neutral-400">
        Deploy the {name} contract (<span className="font-mono text-xs">pnpm deploy:contracts</span>) and set{" "}
        <span className="font-mono text-xs text-amber-300">{env}</span> before building the app.
      </p>
    </GlassCard>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Confidential salary distribution — no employee sees another&apos;s amount; the employer, as
          auditor, sees all.
        </p>
      </header>
      {children}
    </main>
  );
}
