import { createFileRoute } from "@tanstack/react-router";
import { Plus, TrendingUp, ArrowUpRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { investments } from "@/lib/mock-data";

const colors = [
  "oklch(0.82 0.22 152)",
  "oklch(0.70 0.18 180)",
  "oklch(0.75 0.18 220)",
  "oklch(0.78 0.17 75)",
  "oklch(0.70 0.15 300)",
  "oklch(0.65 0.22 25)",
];

export const Route = createFileRoute("/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos — Thaigo Finance AI" },
      { name: "description", content: "Carteira de investimentos diversificada." },
    ],
  }),
  component: InvestimentosPage,
});

function InvestimentosPage() {
  const total = investments.reduce((s, i) => s + i.amount, 0);
  const avgReturn = investments.reduce((s, i) => s + i.return * (i.amount / total), 0);
  return (
    <>
      <AppHeader title="Investimentos" subtitle="Sua carteira" exportModule="Investimentos" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-elegant md:col-span-2">
            <p className="text-xs uppercase tracking-widest text-primary">Patrimônio investido</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">{formatBRL(total)}</h2>
            <div className="mt-2 flex items-center gap-2">
              <Badge className="border-success/30 bg-success/10 text-success hover:bg-success/15">
                <ArrowUpRight className="mr-1 h-3 w-3"/> +{avgReturn.toFixed(1)}% retorno médio
              </Badge>
              <span className="text-xs text-muted-foreground">12 meses</span>
            </div>
            <Button className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-1.5 h-4 w-4"/> Novo aporte
            </Button>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Alocação</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={investments} dataKey="amount" innerRadius={40} outerRadius={70} paddingAngle={3} stroke="none">
                    {investments.map((_, i) => <Cell key={i} fill={colors[i % colors.length]}/>)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "oklch(0.20 0.018 160)", border: "1px solid oklch(0.28 0.02 160)", borderRadius: "12px", fontSize: "12px" }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
          <div className="border-b border-border/60 p-5">
            <h3 className="text-sm font-semibold">Ativos da carteira</h3>
          </div>
          <div className="divide-y divide-border/60">
            {investments.map((inv, i) => (
              <div key={inv.id} className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${colors[i % colors.length]}25`, color: colors[i % colors.length] }}>
                    <TrendingUp className="h-5 w-5"/>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{inv.name}</p>
                    <p className="text-xs text-muted-foreground">{inv.type} · {inv.allocation}% da carteira</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatBRL(inv.amount)}</p>
                  <p className="text-xs font-medium text-success">+{inv.return}% a.a.</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
