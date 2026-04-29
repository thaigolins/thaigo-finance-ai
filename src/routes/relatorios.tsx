import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart } from "lucide-react";
import { ExportPdfDialog } from "@/components/export-pdf-dialog";
import {
  Bar,
  BarChart,
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
import { Button } from "@/components/ui/button";
import { formatBRL, formatCompactBRL } from "@/lib/format";
import { categoryData, monthlyData } from "@/lib/mock-data";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Thaigo Finance AI" },
      { name: "description", content: "Relatórios financeiros mensais detalhados." },
    ],
  }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  return (
    <>
      <AppHeader title="Relatórios" subtitle="Análise mensal" exportModule="Relatórios" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Relatório financeiro</h2>
            <p className="text-sm text-muted-foreground">Abril de 2026 · Visão executiva</p>
          </div>
          <ExportPdfDialog module="Relatórios" />
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Receita total", value: formatBRL(18812), tone: "text-success" },
            { label: "Despesa total", value: formatBRL(10620), tone: "text-destructive" },
            { label: "Saldo do mês", value: formatBRL(8192), tone: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone}`}>{s.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Entradas vs Saídas</h3>
            <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 160 / 40%)" vertical={false}/>
                  <XAxis dataKey="month" stroke="oklch(0.68 0.02 155)" fontSize={11} tickLine={false} axisLine={false}/>
                  <YAxis stroke="oklch(0.68 0.02 155)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactBRL(v as number)}/>
                  <Tooltip
                    contentStyle={{ backgroundColor: "oklch(0.20 0.018 160)", border: "1px solid oklch(0.28 0.02 160)", borderRadius: "12px", fontSize: "12px" }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }}/>
                  <Bar dataKey="income" name="Entradas" fill="oklch(0.82 0.22 152)" radius={[6,6,0,0]}/>
                  <Bar dataKey="expense" name="Saídas" fill="oklch(0.65 0.22 25)" radius={[6,6,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Distribuição de gastos</h3>
            <p className="text-xs text-muted-foreground">Por categoria</p>
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3} stroke="none">
                    {categoryData.map((c, i) => <Cell key={i} fill={c.color}/>)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "oklch(0.20 0.018 160)", border: "1px solid oklch(0.28 0.02 160)", borderRadius: "12px", fontSize: "12px" }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <FileBarChart className="h-5 w-5"/>
            </div>
            <div>
              <h3 className="text-base font-semibold">Resumo da IA Financeira</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Em abril, suas despesas reduziram <span className="text-success font-medium">7,6%</span> em relação a março, principalmente por menor gasto em lazer. Seu índice de poupança ficou em <span className="text-primary font-medium">43,5%</span>, acima do benchmark recomendado (30%). Considere realocar parte da reserva excedente para Tesouro IPCA+, mantendo o objetivo de longo prazo da entrada do imóvel.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
