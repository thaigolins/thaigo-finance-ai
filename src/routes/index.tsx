import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wallet,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Target,
  Eye,
  EyeOff,
  Sparkles,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppHeader } from "@/components/app-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBRL, formatCompactBRL } from "@/lib/format";
import { useUserList } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Thaigo Finance AI" },
      { name: "description", content: "Visão geral premium das suas finanças com IA." },
    ],
  }),
  component: Dashboard,
});

const tooltipStyle = {
  backgroundColor: "oklch(0.18 0.006 180)",
  border: "1px solid oklch(0.28 0.008 180 / 60%)",
  borderRadius: "10px",
  fontSize: "12px",
  padding: "10px 12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};

type Account = { id: string; bank: string; balance: number };
type Tx = {
  id: string;
  description: string;
  amount: number;
  occurred_at: string;
  kind: "income" | "expense" | "transfer";
  bank_account_id: string | null;
};
type Goal = { id: string; name: string; target_amount: number; current_amount: number };
type Investment = { id: string; amount: number };
type Recurring = { id: string; name: string; amount: number; due_day: number };

function monthKey(d: string) {
  // expects YYYY-MM-DD
  const [y, m] = d.split("-");
  return `${y}-${m}`;
}

function Dashboard() {
  const [hideBalance, setHideBalance] = useState(false);
  const { data: accounts = [] } = useUserList<Account>("bank_accounts");
  const { data: txs = [] } = useUserList<Tx>("bank_transactions", { orderBy: "occurred_at" });
  const { data: goals = [] } = useUserList<Goal>("goals");
  const { data: investments = [] } = useUserList<Investment>("investments");
  const { data: recurring = [] } = useUserList<Recurring>("recurring_expenses");

  const totalAccounts = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const invested = investments.reduce((s, i) => s + Number(i.amount), 0);
  const totalBalance = totalAccounts + invested;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthTxs = txs.filter((t) => monthKey(t.occurred_at) === currentMonth);
  const monthIncome = monthTxs
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = monthTxs
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  const monthlyData = useMemo(() => {
    const buckets: Record<string, { income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = { income: 0, expense: 0 };
    }
    txs.forEach((t) => {
      const k = monthKey(t.occurred_at);
      if (buckets[k]) {
        if (t.kind === "income") buckets[k].income += Number(t.amount);
        else if (t.kind === "expense") buckets[k].expense += Math.abs(Number(t.amount));
      }
    });
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return Object.entries(buckets).map(([k, v]) => {
      const [, m] = k.split("-");
      return { month: months[Number(m) - 1], ...v };
    });
  }, [txs, now]);

  const mask = (v: string) => (hideBalance ? "R$ ••••••" : v);
  const hasAnyData = accounts.length + txs.length + goals.length + investments.length > 0;

  const upcoming = recurring
    .slice()
    .sort((a, b) => a.due_day - b.due_day)
    .slice(0, 4);

  return (
    <>
      <AppHeader title="Dashboard" subtitle={`Visão geral · ${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`} exportModule="Dashboard" />
      <main className="flex-1 space-y-8 p-4 md:p-8">
        {/* Hero balance */}
        <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-card p-8 shadow-elegant md:p-10">
          <div className="absolute inset-0 bg-gradient-hero" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Patrimônio total consolidado
                </span>
                <button
                  onClick={() => setHideBalance(!hideBalance)}
                  className="text-muted-foreground/70 transition hover:text-foreground"
                  aria-label="Toggle balance visibility"
                >
                  {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <h2 className="num mt-3 text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
                {mask(formatBRL(totalBalance))}
              </h2>
              <p className="mt-4 text-sm text-muted-foreground">
                {accounts.length} contas · {investments.length} investimentos
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/chat">
                  <Sparkles className="mr-1.5 h-4 w-4" /> Perguntar à IA
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-border/60 bg-transparent">
                <Link to="/financeiro">
                  <Plus className="mr-1.5 h-4 w-4" /> Nova transação
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {!hasAnyData ? (
          <EmptyState
            icon={Wallet}
            title="Bem-vindo ao Thaigo Finance AI"
            description="Comece cadastrando suas contas bancárias em Financeiro. Conforme você adiciona dados, o dashboard ganha vida com gráficos, indicadores e insights da IA."
            actionLabel="Cadastrar primeira conta"
            onAction={() => {
              window.location.href = "/financeiro";
            }}
          />
        ) : (
          <>
            <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Entradas do mês" value={mask(formatBRL(monthIncome))} icon={ArrowUpRight} accent="success" />
              <StatCard label="Saídas do mês" value={mask(formatBRL(monthExpense))} icon={ArrowDownRight} accent="destructive" />
              <StatCard label="Saldo em contas" value={mask(formatBRL(totalAccounts))} icon={PiggyBank} accent="warning" />
              <StatCard label="Investimentos" value={mask(formatBRL(invested))} icon={TrendingUp} accent="primary" />
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card lg:col-span-2">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight">Fluxo financeiro</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Últimos 6 meses · BRL</p>
                  </div>
                  <div className="flex gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Entradas</span>
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-destructive/80" /> Saídas</span>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incomeG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="oklch(0.68 0.11 158)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="oklch(0.68 0.11 158)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="expenseG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="oklch(0.62 0.16 25)" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="oklch(0.62 0.16 25)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.28 0.008 180 / 30%)" vertical={false} />
                      <XAxis dataKey="month" stroke="oklch(0.66 0.008 180)" fontSize={11} tickLine={false} axisLine={false} dy={6} />
                      <YAxis stroke="oklch(0.66 0.008 180)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactBRL(v as number)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} cursor={{ stroke: "oklch(0.68 0.11 158 / 30%)", strokeWidth: 1 }} />
                      <Area type="monotone" dataKey="income" stroke="oklch(0.68 0.11 158)" strokeWidth={1.75} fill="url(#incomeG)" />
                      <Area type="monotone" dataKey="expense" stroke="oklch(0.62 0.16 25)" strokeWidth={1.5} fill="url(#expenseG)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight">Próximos vencimentos</h3>
                  <Wallet className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
                </div>
                {upcoming.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Cadastre despesas recorrentes para visualizá-las aqui.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcoming.map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{b.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Dia {b.due_day}</p>
                        </div>
                        <span className="num font-medium">{formatBRL(Number(b.amount))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card lg:col-span-2">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight">Últimas transações</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Movimentação recente</p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="text-xs text-primary hover:text-primary">
                    <Link to="/extratos">Ver tudo</Link>
                  </Button>
                </div>
                {txs.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Sem transações ainda.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {txs.slice(0, 6).map((t) => {
                      const positive = t.kind === "income";
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between rounded-lg px-2 py-3 transition hover:bg-accent/20"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                                positive
                                  ? "border-success/30 bg-success/10 text-success"
                                  : "border-border/40 bg-muted/30 text-muted-foreground"
                              }`}
                            >
                              {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{t.description}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{t.occurred_at}</p>
                            </div>
                          </div>
                          <span className={`num text-sm font-semibold ${positive ? "text-success" : "text-foreground"}`}>
                            {positive ? "+" : "-"}{formatBRL(Math.abs(Number(t.amount)))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight">Metas em andamento</h3>
                  <Target className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
                </div>
                {goals.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Defina seus objetivos em <Link to="/metas" className="text-primary hover:underline">Metas</Link>.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {goals.slice(0, 3).map((g) => {
                      const target = Number(g.target_amount) || 1;
                      const pct = (Number(g.current_amount) / target) * 100;
                      return (
                        <div key={g.id}>
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{g.name}</span>
                            <span className="num text-muted-foreground">{pct.toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(pct, 100)} className="h-1" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
