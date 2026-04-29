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
} from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
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
import { Badge } from "@/components/ui/badge";
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
      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Hero balance */}
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-card p-6 shadow-elegant md:p-8">
          <div className="absolute inset-0 bg-gradient-hero opacity-80" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-widest text-primary">
                  Patrimônio total
                </span>
                <button
                  onClick={() => setHideBalance(!hideBalance)}
                  className="text-muted-foreground transition hover:text-foreground"
                >
                  {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                {mask(formatBRL(totalBalance))}
              </h2>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Badge className="border-success/30 bg-success/10 text-success hover:bg-success/15">
                  <ArrowUpRight className="mr-1 h-3 w-3" /> +4.2% este mês
                </Badge>
                <span className="text-muted-foreground">vs. R$ 195.4k em março</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                <Sparkles className="mr-1.5 h-4 w-4" /> Perguntar à IA
              </Button>
              <Button variant="outline" className="border-border/60 bg-card/40">
                Nova transação
              </Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Entradas do mês"
            value={mask(formatBRL(monthIncome))}
            icon={ArrowUpRight}
            trend={2.1}
            trendLabel="vs mês passado"
            accent="success"
          />
          <StatCard
            label="Saídas do mês"
            value={mask(formatBRL(monthExpense))}
            icon={ArrowDownRight}
            trend={-7.6}
            trendLabel="redução"
            accent="destructive"
          />
          <StatCard
            label="Reserva de emergência"
            value={mask(formatBRL(62400))}
            icon={PiggyBank}
            trend={5.4}
            trendLabel="rumo à meta"
            accent="warning"
          />
          <StatCard
            label="Investimentos"
            value={mask(formatBRL(invested))}
            icon={TrendingUp}
            trend={1.8}
            trendLabel="rendimento"
            accent="primary"
          />
        </section>

        {/* Charts row */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Fluxo financeiro</h3>
                <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary"/> Entradas</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive"/> Saídas</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-chart-2"/> Investido</span>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="incomeG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.82 0.22 152)" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="oklch(0.82 0.22 152)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="expenseG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="oklch(0.65 0.22 25)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="investG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.70 0.18 180)" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="oklch(0.70 0.18 180)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 160 / 40%)" vertical={false}/>
                  <XAxis dataKey="month" stroke="oklch(0.68 0.02 155)" fontSize={11} tickLine={false} axisLine={false}/>
                  <YAxis stroke="oklch(0.68 0.02 155)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactBRL(v as number)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.20 0.018 160)",
                      border: "1px solid oklch(0.28 0.02 160)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                  <Area type="monotone" dataKey="income" stroke="oklch(0.82 0.22 152)" strokeWidth={2} fill="url(#incomeG)" />
                  <Area type="monotone" dataKey="expense" stroke="oklch(0.65 0.22 25)" strokeWidth={2} fill="url(#expenseG)" />
                  <Area type="monotone" dataKey="invested" stroke="oklch(0.70 0.18 180)" strokeWidth={2} fill="url(#investG)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Gastos por categoria</h3>
            <p className="text-xs text-muted-foreground">Abril 2026</p>
            <div className="mt-2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {categoryData.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.20 0.018 160)",
                      border: "1px solid oklch(0.28 0.02 160)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {categoryData.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <span className="font-medium text-foreground">{formatBRL(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom row */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Últimas transações</h3>
                <p className="text-xs text-muted-foreground">Movimentação recente</p>
              </div>
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                Ver tudo
              </Button>
            </div>
            <div className="space-y-1">
              {transactions.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-accent/30"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        t.amount > 0 ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {t.amount > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.category} · {t.account}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${t.amount > 0 ? "text-success" : "text-foreground"}`}>
                    {t.amount > 0 ? "+" : ""}{formatBRL(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Próximos vencimentos</h3>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-2.5">
                {upcomingBills.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.dueDate}</p>
                    </div>
                    <span className="font-medium">{formatBRL(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Metas em andamento</h3>
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                {goals.slice(0, 3).map((g) => {
                  const pct = (g.current / g.target) * 100;
                  return (
                    <div key={g.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{g.name}</span>
                        <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
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
