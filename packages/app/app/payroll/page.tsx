"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Users, Briefcase, ChevronRight, X } from "lucide-react";
import { RunStatus } from "@lucent/sdk";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TxStatus, type TxStep } from "@/components/ui/TxStatus";
import { EncryptedBadge } from "@/components/ui/EncryptedBadge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import { Callout } from "@/components/ui/Callout";
import { useWallet } from "@/lib/wallet-context";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { useAction } from "@/lib/use-action";
import { toBaseUnits, formatAmount, displayAmount, DECIMALS } from "@/lib/amount";
import { errMsg } from "@/lib/err";
import { DEPLOYMENT } from "@/lib/deployment";
import { cn } from "@/lib/cn";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type TopTab = "employer" | "employee";
/** `list` = template cards, `template` = one template's employees + runs. */
type Screen = "list" | "template";

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
  [RunStatus.Funded]: { label: "Confirmed", tone: "sky" },
  [RunStatus.Executed]: { label: "Executed", tone: "green" },
  [RunStatus.Cancelled]: { label: "Cancelled", tone: "red" },
};

export default function PayrollPage() {
  const wallet = useRequireWallet();
  const { view, error, setError } = useWallet();
  const { run, busy, phase } = useAction();

  const [topTab, setTopTab] = useState<TopTab>("employer");
  const [screen, setScreen] = useState<Screen>("list");
  const [selectedTemplateId, setSelectedTemplateId] = useState<bigint | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [runs, setRuns] = useState<RunRow[] | null>(null);

  // New-template modal: one address input per employee row.
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [employeeAddrs, setEmployeeAddrs] = useState<string[]>([""]);
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

  function openNewTemplate() {
    setEmployeeAddrs([""]);
    setNewTplSteps([]);
    setShowNewTemplate(true);
  }

  function updateEmployeeAddr(i: number, addr: string) {
    setEmployeeAddrs((prev) => prev.map((a, idx) => (idx === i ? addr : a)));
  }

  function addEmployeeRow() {
    setEmployeeAddrs((prev) => [...prev, ""]);
  }

  function removeEmployeeRow(i: number) {
    setEmployeeAddrs((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createTemplate() {
    const employees = employeeAddrs.map((a) => a.trim()).filter(Boolean);
    if (employees.length === 0) {
      setError("Add at least one employee address");
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
      setEmployeeAddrs([""]);
      setNewTplSteps([]);
    }, 900);
  }

  function openTemplate(templateId: bigint) {
    setSelectedTemplateId(templateId);
    setScreen("template");
  }

  async function openRun(templateId: bigint) {
    await run(
      `openrun-${templateId}`,
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

  const totalSalaries = executingEmployees.reduce((sum, a) => sum + toBaseUnits(salaries[a] || "0"), 0n);
  const spendable = view?.spendable ?? 0n;
  const overBudget = totalSalaries > spendable;

  async function confirmExecute() {
    if (!executingRun) return;
    const payments = executingEmployees.map((employee) => ({ employee, amount: toBaseUnits(salaries[employee] || "0") }));
    if (payments.some((p) => p.amount <= 0n)) {
      setError("Every salary must be greater than 0");
      return;
    }
    if (totalSalaries > spendable) {
      setError("Total salaries exceed your spendable balance");
      return;
    }
    await run("execute", async (sp) => {
      await wallet!.executeRun(executingRun.id, payments, sp);
      setExecutingRun(null);
    });
    reload();
  }

  /** Digits + at most one decimal point, clamped to DECIMALS fractional digits. */
  function sanitizeAmount(raw: string): string {
    let v = raw.replace(/[^0-9.]/g, "");
    const dot = v.indexOf(".");
    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
    const [whole, frac] = v.split(".");
    if (frac !== undefined && frac.length > DECIMALS) v = `${whole}.${frac.slice(0, DECIMALS)}`;
    return v;
  }

  async function cancelRun(runId: bigint) {
    await run(`cancel-${runId}`, async () => {
      await wallet!.cancelRun(runId);
    }, { refresh: false });
    reload();
  }

  const receiving = view?.receiving ?? 0n;
  const hasClaim = receiving > 0n;
  const registered = view?.registered ?? false;
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId) ?? null;
  const templateRuns = runs?.filter((r) => r.templateId === selectedTemplateId) ?? [];

  // ── Template detail: employees + runs scoped to this one template ────────
  if (screen === "template" && selectedTemplate) {
    return (
      <>
        <AppShell>
          <PageHeader
            title={`Template #${selectedTemplate.id.toString()}`}
            onBack={() => setScreen("list")}
            right={
              <Button size="sm" isLoading={busy === `openrun-${selectedTemplate.id}`} onClick={() => openRun(selectedTemplate.id)}>
                <Plus className="h-3.5 w-3.5" /> New Run
              </Button>
            }
          />
          <div className="flex flex-col gap-5 px-4 pb-24 md:mx-auto md:max-w-2xl md:px-8 md:pb-8">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />

            <GlassCard padding="md">
              <SectionLabel>Employees ({selectedTemplate.employees.length})</SectionLabel>
              <div className="mt-3 flex flex-col gap-2">
                {selectedTemplate.employees.map((emp, i) => (
                  <div key={emp} className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">#{i + 1}</span>
                    <AddressDisplay address={emp} chars={8} />
                  </div>
                ))}
              </div>
            </GlassCard>

            <SectionLabel>Runs</SectionLabel>
            {templateRuns.length === 0 ? (
              <EmptyState icon={Briefcase} label="No runs yet — start one from the header" />
            ) : (
              <div className="flex flex-col gap-3">
                {templateRuns.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <GlassCard key={r.id.toString()} padding="md">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-text-primary">Run #{r.id.toString()}</span>
                        </div>
                        <Pill tone={meta.tone}>{meta.label}</Pill>
                        <EncryptedBadge size="sm" />
                      </div>
                      {r.status === RunStatus.Scheduled && (
                        <div className="mt-3 flex flex-col gap-1.5">
                          <div className="flex gap-2">
                            <Button size="sm" fullWidth isLoading={busy === `fund-${r.id}`} onClick={() => fundRun(r.id)}>
                              Confirm
                            </Button>
                            <Button size="sm" variant="danger" isLoading={busy === `cancel-${r.id}`} onClick={() => cancelRun(r.id)}>
                              Cancel
                            </Button>
                          </div>
                          <p className="text-xs text-text-muted">
                            Confirm locks this run in — no money moves yet. Salaries are entered and
                            transferred at Execute.
                          </p>
                        </div>
                      )}
                      {r.status === RunStatus.Funded && (
                        <div className="mt-3 flex flex-col gap-1.5">
                          <Button size="sm" fullWidth onClick={() => beginExecute(r, selectedTemplate.employees)}>
                            Execute Payroll
                          </Button>
                          <p className="text-xs text-text-muted">
                            This is the step that actually pays everyone — each salary is proven and
                            transferred now.
                          </p>
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </div>
        </AppShell>

        <ExecuteRunModal
          executingRun={executingRun}
          executingEmployees={executingEmployees}
          salaries={salaries}
          setSalaries={setSalaries}
          sanitizeAmount={sanitizeAmount}
          totalSalaries={totalSalaries}
          spendable={spendable}
          overBudget={overBudget}
          busy={busy}
          phase={phase}
          onClose={() => setExecutingRun(null)}
          onConfirm={confirmExecute}
        />
      </>
    );
  }

  // ── List: employer's templates (drill-down) / employee claim ─────────────
  return (
    <>
    <AppShell>
      <PageHeader
        title="Payroll"
        showBack={false}
        right={
          topTab === "employer" ? (
            <Button size="sm" variant="secondary" disabled={!registered} onClick={openNewTemplate}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-5 px-4 pb-24 md:mx-auto md:max-w-2xl md:px-8 md:pb-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {!registered && topTab === "employer" && (
          <Callout>
            You need to register your confidential account before you can create payroll templates or
            runs — head to <strong>Home</strong> to register, a one-time proof.
          </Callout>
        )}

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
          templates === null ? (
            <p className="py-12 text-center text-sm text-text-muted">Loading…</p>
          ) : templates.length === 0 ? (
            <EmptyState icon={Briefcase} label="No templates yet">
              <Button disabled={!registered} onClick={openNewTemplate}>
                <Plus className="h-4 w-4" /> Create Template
              </Button>
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-3">
              <SectionLabel>Your Templates</SectionLabel>
              {templates.map((t) => (
                <button key={t.id.toString()} onClick={() => openTemplate(t.id)} className="w-full text-left">
                  <GlassCard padding="md">
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
                      <ChevronRight className="h-4 w-4 text-text-muted" />
                    </div>
                  </GlassCard>
                </button>
              ))}
            </div>
          )
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
    </AppShell>

    <NewTemplateModal
      open={showNewTemplate}
      onClose={() => busy !== "template" && setShowNewTemplate(false)}
      employeeAddrs={employeeAddrs}
      onUpdateAddr={updateEmployeeAddr}
      onAddRow={addEmployeeRow}
      onRemoveRow={removeEmployeeRow}
      newTplSteps={newTplSteps}
      busy={busy}
      onCreate={createTemplate}
    />
    </>
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

function NewTemplateModal({
  open,
  onClose,
  employeeAddrs,
  onUpdateAddr,
  onAddRow,
  onRemoveRow,
  newTplSteps,
  busy,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  employeeAddrs: string[];
  onUpdateAddr: (i: number, addr: string) => void;
  onAddRow: () => void;
  onRemoveRow: (i: number) => void;
  newTplSteps: TxStep[];
  busy: string | null;
  onCreate: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="New Template">
      <SectionLabel>Employees</SectionLabel>
      <div className="flex flex-col gap-2">
        {employeeAddrs.map((addr, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-xs text-text-muted">#{i + 1}</span>
            <div className="flex-1">
              <Input
                placeholder="G…"
                value={addr}
                onChange={(e) => onUpdateAddr(i, e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <button
              onClick={() => onRemoveRow(i)}
              disabled={employeeAddrs.length === 1}
              aria-label="Remove employee"
              className="shrink-0 text-text-muted transition-colors hover:text-error disabled:opacity-20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onAddRow}>
        <Plus className="h-3.5 w-3.5" /> Add Employee
      </Button>

      {newTplSteps.length > 0 && <TxStatus steps={newTplSteps} />}

      <p className="text-center text-xs leading-relaxed text-text-muted">
        Templates carry no amounts, just who gets paid. You&apos;ll open a run and set salaries
        separately, from the template.
      </p>

      <Button fullWidth size="lg" isLoading={busy === "template"} onClick={onCreate}>
        Create Template
      </Button>
    </Modal>
  );
}

function ExecuteRunModal({
  executingRun,
  executingEmployees,
  salaries,
  setSalaries,
  sanitizeAmount,
  totalSalaries,
  spendable,
  overBudget,
  busy,
  phase,
  onClose,
  onConfirm,
}: {
  executingRun: RunRow | null;
  executingEmployees: string[];
  salaries: Record<string, string>;
  setSalaries: (fn: (s: Record<string, string>) => Record<string, string>) => void;
  sanitizeAmount: (raw: string) => string;
  totalSalaries: bigint;
  spendable: bigint;
  overBudget: boolean;
  busy: string | null;
  phase: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <Modal open={executingRun !== null} onClose={onClose} title={`Execute Run #${executingRun?.id.toString() ?? ""}`}>
        <p className="text-xs leading-relaxed text-text-muted">
          Enter each salary. One confidential transfer per employee is proven in your browser and
          submitted atomically — this is the step that actually moves money.
        </p>
        <div className="flex flex-col gap-2">
          {executingEmployees.map((a) => (
            <div key={a} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <AddressDisplay address={a} chars={6} showCopy={false} className="flex-1" />
              <Input
                value={salaries[a] ?? ""}
                onChange={(e) => setSalaries((s) => ({ ...s, [a]: sanitizeAmount(e.target.value) }))}
                inputMode="decimal"
                placeholder="0.00"
                className="h-10 w-28 text-right font-mono text-sm"
              />
              <span className="w-12 shrink-0 text-xs text-text-muted">USDC</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-white/[0.02] px-3 py-2.5">
          <span className="text-xs text-text-muted">Total</span>
          <span className={cn("font-mono text-sm font-medium tabular-nums", overBudget ? "text-error" : "text-text-primary")}>
            {formatAmount(totalSalaries, DECIMALS)} / {formatAmount(spendable, DECIMALS)} USDC
          </span>
        </div>
        {overBudget && (
          <p className="text-xs text-error">
            Total salaries exceed your spendable balance ({displayAmount(spendable)}).
          </p>
        )}

        <Button
          fullWidth
          size="lg"
          isLoading={busy === "execute"}
          disabled={overBudget || totalSalaries <= 0n}
          onClick={onConfirm}
        >
          Execute Payroll
        </Button>
      </Modal>

      <ProofLoadingOverlay
        open={busy === "execute" && phase === "proving"}
        estSeconds={12 * Math.max(executingEmployees.length, 1)}
        fullScreen
      />
    </>
  );
}
