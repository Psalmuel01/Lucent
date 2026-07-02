"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Users, Briefcase, ChevronRight, CheckCircle } from "lucide-react";
import { RunStatus } from "@lucent/sdk";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { NumericKeypad } from "@/components/ui/NumericKeypad";
import { TxStatus, type TxStep } from "@/components/ui/TxStatus";
import { EncryptedBadge } from "@/components/ui/EncryptedBadge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import { useWallet } from "@/lib/wallet-context";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { useAction } from "@/lib/use-action";
import { toBaseUnits } from "@/lib/amount";
import { errMsg } from "@/lib/err";
import { DEPLOYMENT } from "@/lib/deployment";
import { cn } from "@/lib/cn";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type TopTab = "employer" | "employee";
type EmployerTab = "templates" | "runs";

interface TemplateRow {
  id: bigint;
  employees: string[];
  active: boolean;
}
interface RunRow {
  id: bigint;
  templateId: bigint;
  status: RunStatus;
}

const STATUS_META: Record<RunStatus, { label: string; tone: "neutral" | "amber" | "green" | "red" | "sky" }> = {
  [RunStatus.Scheduled]: { label: "Scheduled", tone: "neutral" },
  [RunStatus.Funded]: { label: "Funded", tone: "sky" },
  [RunStatus.Executed]: { label: "Executed", tone: "green" },
  [RunStatus.Cancelled]: { label: "Cancelled", tone: "red" },
};

export default function PayrollPage() {
  const wallet = useRequireWallet();
  const { view, error, setError } = useWallet();
  const { run, busy, phase } = useAction();

  const [topTab, setTopTab] = useState<TopTab>("employer");
  const [employerTab, setEmployerTab] = useState<EmployerTab>("templates");
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [employeesText, setEmployeesText] = useState("");
  const [newTplSteps, setNewTplSteps] = useState<TxStep[]>([]);

  // Execute-run modal state
  const [executingRun, setExecutingRun] = useState<RunRow | null>(null);
  const [executingEmployees, setExecutingEmployees] = useState<string[]>([]);
  const [salaries, setSalaries] = useState<Record<string, string>>({});

  const configured = Boolean(DEPLOYMENT.contracts.payroll);

  const reload = useCallback(() => {
    if (!wallet || !configured) return;
    (async () => {
      try {
        const tCount = await wallet.payrollTemplateCount();
        const tpls: TemplateRow[] = [];
        for (let i = 1n; i <= tCount; i++) {
          const t = await wallet.payrollTemplate(i);
          if (t.employer === wallet.address) tpls.push({ id: i, employees: t.employees, active: t.active });
        }
        setTemplates(tpls);

        const rCount = await wallet.payrollRunCount();
        const rws: RunRow[] = [];
        for (let i = 1n; i <= rCount; i++) {
          const r = await wallet.payrollRun(i);
          if (tpls.some((t) => t.id === r.templateId)) rws.push({ id: i, templateId: r.templateId, status: r.status });
        }
        setRuns(rws);
      } catch (e) {
        setError(errMsg(e));
      }
    })();
  }, [wallet, configured, setError]);

  useEffect(reload, [reload]);

  if (!wallet) {
    return (
      <AppShell>
        <PageHeader title="Payroll" showBack={false} />
        <ConnectPrompt message="Connect your wallet to run confidential payroll." />
      </AppShell>
    );
  }

  if (!configured) {
    return (
      <AppShell>
        <PageHeader title="Payroll" showBack={false} />
        <div className="px-4 md:mx-auto md:max-w-2xl md:px-8">
          <GlassCard padding="md">
            <SectionLabel>Not deployed</SectionLabel>
            <p className="mt-3 text-sm text-text-secondary">
              PayrollVault hasn&apos;t been deployed to this environment yet. Run{" "}
              <span className="font-mono text-accent">pnpm deploy:contracts</span> and rebuild the app.
            </p>
          </GlassCard>
        </div>
      </AppShell>
    );
  }

  async function createTemplate() {
    const employees = employeesText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (employees.length === 0) {
      setError("Enter at least one employee address");
      return;
    }
    setNewTplSteps([{ id: "template", label: "Create payroll template", status: "active" }]);
    await run(
      "template",
      async () => {
        await wallet!.createTemplate(employees);
        setNewTplSteps((s) => s.map((x) => ({ ...x, status: "done" })));
      },
      { refresh: false },
    );
    reload();
    setTimeout(() => {
      setShowNewTemplate(false);
      setEmployeesText("");
      setNewTplSteps([]);
    }, 900);
  }

  async function openRun(templateId: bigint) {
    await run(
      "openrun",
      async () => {
        await wallet!.createRun(templateId);
      },
      { refresh: false },
    );
    reload();
  }

  async function fundRun(runId: bigint) {
    await run(`fund-${runId}`, async () => {
      await wallet!.fundRun(runId);
    }, { refresh: false });
    reload();
  }

  function beginExecute(r: RunRow, employees: string[]) {
    setExecutingRun(r);
    setExecutingEmployees(employees);
    setSalaries(Object.fromEntries(employees.map((a) => [a, ""])));
  }

  async function confirmExecute() {
    if (!executingRun) return;
    const payments = executingEmployees.map((employee) => ({ employee, amount: toBaseUnits(salaries[employee] || "0") }));
    if (payments.some((p) => p.amount <= 0n)) {
      setError("Every salary must be greater than 0");
      return;
    }
    await run("execute", async (sp) => {
      await wallet!.executeRun(executingRun.id, payments, sp);
      setExecutingRun(null);
    });
    reload();
  }

  async function cancelRun(runId: bigint) {
    await run(`cancel-${runId}`, async () => {
      await wallet!.cancelRun(runId);
    }, { refresh: false });
    reload();
  }

  const receiving = view?.receiving ?? 0n;
  const hasClaim = receiving > 0n;

  return (
    <AppShell>
      <PageHeader
        title="Payroll"
        showBack={false}
        right={
          topTab === "employer" && employerTab === "templates" ? (
            <Button size="sm" variant="secondary" onClick={() => setShowNewTemplate(true)}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-5 px-4 pb-24 md:mx-auto md:max-w-2xl md:px-8 md:pb-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <div className="flex gap-2 rounded-2xl border border-border bg-card p-1">
          {(["employer", "employee"] as TopTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTopTab(t)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-medium capitalize transition-all duration-200",
                topTab === t ? "bg-accent text-black" : "text-text-muted hover:text-text-secondary",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {topTab === "employer" ? (
          <>
            <div className="flex gap-2">
              {(["templates", "runs"] as EmployerTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setEmployerTab(t)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
                    employerTab === t ? "bg-accent-bg text-accent" : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {employerTab === "templates" &&
              (templates === null ? (
                <p className="py-12 text-center text-sm text-text-muted">Loading…</p>
              ) : templates.length === 0 ? (
                <EmptyState icon={Briefcase} label="No templates yet">
                  <Button onClick={() => setShowNewTemplate(true)}>
                    <Plus className="h-4 w-4" /> Create Template
                  </Button>
                </EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  {templates.map((t) => (
                    <GlassCard key={t.id.toString()} padding="md">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-bg">
                          <Users className="h-4 w-4 text-accent" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">Template #{t.id.toString()}</p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {t.employees.length} employee{t.employees.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <Button size="sm" variant="secondary" isLoading={busy === "openrun"} onClick={() => openRun(t.id)}>
                          Create Run
                        </Button>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              ))}

            {employerTab === "runs" &&
              (runs === null ? (
                <p className="py-12 text-center text-sm text-text-muted">Loading…</p>
              ) : runs.length === 0 ? (
                <EmptyState icon={Briefcase} label="No runs yet" />
              ) : (
                <div className="flex flex-col gap-3">
                  {runs.map((r) => {
                    const tpl = templates?.find((t) => t.id === r.templateId);
                    const meta = STATUS_META[r.status];
                    return (
                      <GlassCard key={r.id.toString()} padding="md">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-text-primary">Run #{r.id.toString()}</span>
                              <Pill tone={meta.tone}>{meta.label}</Pill>
                            </div>
                            <p className="mt-0.5 text-xs text-text-muted">Template #{r.templateId.toString()}</p>
                          </div>
                          <EncryptedBadge size="sm" />
                        </div>
                        {tpl && r.status === RunStatus.Scheduled && (
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" fullWidth isLoading={busy === `fund-${r.id}`} onClick={() => fundRun(r.id)}>
                              Fund
                            </Button>
                            <Button size="sm" variant="danger" isLoading={busy === `cancel-${r.id}`} onClick={() => cancelRun(r.id)}>
                              Cancel
                            </Button>
                          </div>
                        )}
                        {tpl && r.status === RunStatus.Funded && (
                          <div className="mt-3">
                            <Button size="sm" fullWidth onClick={() => beginExecute(r, tpl.employees)}>
                              Execute Payroll
                            </Button>
                          </div>
                        )}
                      </GlassCard>
                    );
                  })}
                </div>
              ))}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            {hasClaim ? (
              <GlassCard padding="md" glow>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Payroll Pending</p>
                      <p className="mt-0.5 text-xs text-text-muted">Ready to claim</p>
                    </div>
                    <EncryptedBadge size="sm" />
                  </div>
                  <Button fullWidth isLoading={busy === "claim"} onClick={() => run("claim", () => wallet!.claimSalary())}>
                    Claim Payroll
                  </Button>
                </div>
              </GlassCard>
            ) : (
              <EmptyState icon={Briefcase} label="No pending claims" />
            )}
          </div>
        )}
      </div>

      {/* New template bottom sheet */}
      <Modal open={showNewTemplate} onClose={() => !(busy === "template") && setShowNewTemplate(false)} title="New Template">
        <Textarea
          label="Employee addresses (one per line)"
          value={employeesText}
          onChange={(e) => setEmployeesText(e.target.value)}
          className="h-28 font-mono text-xs"
          placeholder={"G…\nG…"}
        />
        {newTplSteps.length > 0 && <TxStatus steps={newTplSteps} />}
        <Button fullWidth size="lg" isLoading={busy === "template"} onClick={createTemplate}>
          Create Template
        </Button>
      </Modal>

      {/* Execute run modal */}
      <Modal open={executingRun !== null} onClose={() => setExecutingRun(null)} title={`Execute Run #${executingRun?.id.toString() ?? ""}`}>
        <p className="text-xs leading-relaxed text-text-muted">
          Enter each salary. One confidential transfer per employee is proven in your browser and
          submitted atomically.
        </p>
        <div className="flex flex-col gap-3">
          {executingEmployees.map((a) => (
            <div key={a} className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <AddressDisplay address={a} chars={8} showCopy={false} />
              <NumericKeypad
                value={salaries[a] ?? ""}
                onChange={(v) => setSalaries((s) => ({ ...s, [a]: v }))}
                unit="USDC"
              />
            </div>
          ))}
        </div>
        <Button fullWidth size="lg" isLoading={busy === "execute"} onClick={confirmExecute}>
          Execute Payroll
        </Button>
      </Modal>

      <ProofLoadingOverlay open={busy === "execute" && phase === "proving"} estSeconds={12 * Math.max(executingEmployees.length, 1)} fullScreen />
    </AppShell>
  );
}

function EmptyState({ icon: Icon, label, children }: { icon: typeof Briefcase; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="glass-card flex h-14 w-14 items-center justify-center">
        <Icon className="h-6 w-6 text-text-muted" />
      </div>
      <p className="text-sm text-text-muted">{label}</p>
      {children}
    </div>
  );
}
