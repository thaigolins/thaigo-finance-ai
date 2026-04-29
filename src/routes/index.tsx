import { createFileRoute } from "@tanstack/react-router";
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
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppHeader } from "@/components/app-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBRL, formatCompactBRL } from "@/lib/format";
import {
  categoryData,
  goals,
  monthlyData,
  transactions,
  upcomingBills,
} from "@/lib/mock-data";

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

function Dashboard() {
  const [hideBalance, setHideBalance] = useState(false);
  const totalBalance = 203750.97;
  const monthIncome = 18812.45;
  const monthExpense = 10620.6;
  const invested = 154200.5;

  const mask = (v: string) => (hideBalance ? "R$ ••••••" : v);

  return (
    <>
      <AppHeader title="Dashboard" subtitle="Visão geral · Abril 2026" />
      <main className="flex-1 space-y-8 p-4 md:p-8">
        {/* Hero balance — minimal & elegant */}
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
              <div className="mt-4 flex items-center gap-3 text-sm">
                <span className="num inline-flex items-center gap-1 font-medium text-success">
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} /> +4.2%
                </span>
                <span className="text-muted-foreground">vs. R$ 195,4k em março</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Sparkles className="mr-1.5 h-4 w-4" /> Perguntar à IA
              </Button>
              <Button variant="outline" className="border-border/60 bg-transparent">
                <Plus className="mr-1.5 h-4 w-4" /> Nova transação
              </Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Entradas do mês" value={mask(formatBRL(monthIncome))} icon={ArrowUpRight} trend={2.1} trendLabel="vs mês passado" accent="success" />
          <StatCard label="Saídas do mês" value={mask(formatBRL(monthExpense))} icon={ArrowDownRight} trend={-7.6} trendLabel="redução" accent="destructive" />
          <StatCard label="Reserva de emergência" value={mask(formatBRL(62400))} icon={PiggyBank} trend={5.4} trendLabel="rumo à meta" accent="warning" />
          <StatCard label="Investimentos" value={mask(formatBRL(invested))} icon={TrendingUp} trend={1.8} trendLabel="rendimento" accent="primary" />
        </section>

        {/* Charts row */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card lg:col-span-2">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Fluxo financeiro</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Últimos 6 meses · BRL</p>
              </div>
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary"/> Entradas</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-destructive/80"/> Saídas</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-chart-2"/> Investido</span>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.68 0.11 158)" stopOpacity={0.35}/>
                      <stop offset="100%" stopColor="oklch(0.68 0.11 158)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="expenseG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.62 0.16 25)" stopOpacity={0.25}/>
                      <stop offset="100%" stopColor="oklch(0.62 0.16 25)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="investG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.08 210)" stopOpacity={0.25}/>
                      <stop offset="100%" stopColor="oklch(0.65 0.08 210)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.28 0.008 180 / 30%)" vertical={false}/>
                  <XAxis dataKey="month" stroke="oklch(0.66 0.008 180)" fontSize={11} tickLine={false} axisLine={false} dy={6}/>
                  <YAxis stroke="oklch(0.66 0.008 180)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactBRL(v as number)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} cursor={{ stroke: "oklch(0.68 0.11 158 / 30%)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="income" stroke="oklch(0.68 0.11 158)" strokeWidth={1.75} fill="url(#incomeG)" />
                  <Area type="monotone" dataKey="expense" stroke="oklch(0.62 0.16 25)" strokeWidth={1.5} fill="url(#expenseG)" />
                  <Area type="monotone" dataKey="invested" stroke="oklch(0.65 0.08 210)" strokeWidth={1.5} fill="url(#investG)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold tracking-tight">Gastos por categoria</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Abril 2026</p>
            <div className="mt-2 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" innerRadius={56} outerRadius={84} paddingAngle={2} stroke="none">
                    {categoryData.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {categoryData.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <span className="num font-medium text-foreground">{formatBRL(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom row */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Últimas transações</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Movimentação recente</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary">
                Ver tudo
              </Button>
            </div>
            <div className="space-y-1">
              {transactions.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg px-2 py-3 transition hover:bg-accent/20"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                        t.amount > 0
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border/40 bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {t.amount > 0 ? <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} /> : <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t.category} · {t.account}</p>
                    </div>
                  </div>
                  <span className={`num text-sm font-semibold ${t.amount > 0 ? "text-success" : "text-foreground"}`}>
                    {t.amount > 0 ? "+" : ""}{formatBRL(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight">Próximos vencimentos</h3>
                <Wallet className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
              </div>
              <div className="space-y-3">
                {upcomingBills.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{b.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{b.dueDate}</p>
                    </div>
                    <span className="num font-medium">{formatBRL(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight">Metas em andamento</h3>
                <Target className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
              </div>
              <div className="space-y-4">
                {goals.slice(0, 3).map((g) => {
                  const pct = (g.current / g.target) * 100;
                  return (
                    <div key={g.id}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{g.name}</span>
                        <span className="num text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                      <Progress value={pct} className="h-1" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
