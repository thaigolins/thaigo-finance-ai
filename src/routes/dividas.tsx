import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Landmark,
  Upload,
  Plus,
  AlertTriangle,
  TrendingDown,
  Calendar,
  Sparkles,
  FileText,
  Shield,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { debts } from "@/lib/mock-data";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dividas")({
  head: () => ({
    meta: [
      { title: "Empréstimos & Dívidas — Thaigo Finance AI" },
      {
        name: "description",
        content:
          "Visão consolidada de endividamento: empréstimos, financiamentos, taxa média e alertas.",
      },
    ],
  }),
  component: DebtsPage,
});

const statusStyles: Record<string, string> = {
  "em dia": "border-success/30 bg-success/10 text-success",
  atrasado: "border-destructive/30 bg-destructive/10 text-destructive",
  renegociado: "border-warning/30 bg-warning/10 text-warning",
  quitado: "border-border/40 bg-muted/20 text-muted-foreground",
};

function DebtsPage() {
  const [dragOver, setDragOver] = useState(false);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const monthlyTotal = debts.reduce((s, d) => s + d.monthly, 0);
  const weightedRate =
    debts.reduce((s, d) => s + d.rate * d.balance, 0) / totalDebt;
  const overdue = debts.filter((d) => d.status === "atrasado").length;

  const ranking = [...debts].sort((a, b) => b.cet - a.cet).slice(0, 4);

  return (
    <>
      <AppHeader
        title="Empréstimos & Dívidas"
        subtitle="Gestão consolidada de endividamento"
        exportModule="Empréstimos & Dívidas"
      />
      <main className="flex-1 space-y-8 p-4 md:p-8">
        {/* KPIs */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Dívida Total Ativa"
            value={formatBRL(totalDebt)}
            icon={Landmark}
            accent="destructive"
          />
          <StatCard
            label="Parcela Mensal"
            value={formatBRL(monthlyTotal)}
            icon={Calendar}
            accent="warning"
          />
          <StatCard
            label="Taxa Média Ponderada"
            value={`${weightedRate.toFixed(2)}% a.m.`}
            icon={TrendingDown}
            accent="primary"
          />
          <StatCard
            label="Alertas de Vencimento"
            value={`${overdue} atraso${overdue === 1 ? "" : "s"}`}
            icon={AlertTriangle}
            accent="destructive"
          />
        </section>

        {/* Upload + Actions */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            className={cn(
              "lg:col-span-2 rounded-2xl border border-dashed p-8 transition-all",
              dragOver
                ? "border-primary/60 bg-emerald-soft"
                : "border-border/50 bg-card",
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-emerald-soft">
                <Upload className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold tracking-tight">
                  Enviar extrato de empréstimo
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Arraste PDFs, imagens ou contratos. A IA extrai instituição,
                  taxa, CET, parcelas e cadastra automaticamente.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" className="rounded-full">
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Selecionar arquivos
                  </Button>
                  <Badge
                    variant="outline"
                    className="rounded-full border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    <Shield className="mr-1 h-3 w-3" />
                    Criptografado
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/30 bg-emerald-soft text-[10px] uppercase tracking-wider text-primary"
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    IA pronta
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Cadastro Manual
            </p>
            <p className="mt-3 text-sm text-foreground/90">
              Registre uma dívida informando instituição, tipo, saldo, taxa,
              CET, parcelas e garantia.
            </p>
            <Button className="mt-5 w-full rounded-xl" variant="outline">
              <Plus className="mr-1.5 h-4 w-4" />
              Nova dívida
            </Button>
          </div>
        </section>

        {/* Ranking mais caras */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Ranking — Dívidas mais caras
              </h2>
              <p className="text-xs text-muted-foreground">
                Ordenadas pelo CET anual efetivo
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {ranking.map((d, i) => (
              <div
                key={d.id}
                className="flex items-center gap-4 rounded-2xl border border-border/40 bg-card p-4 shadow-card"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-sm font-semibold text-destructive">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{d.institution} · {d.type}</p>
                  <p className="num text-[11px] text-muted-foreground">
                    Saldo {formatBRL(d.balance)} · {d.remaining} parcelas restantes
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-sm font-semibold text-destructive">
                    {d.cet.toFixed(1)}%
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    CET a.a.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Lista completa */}
        <section className="rounded-2xl border border-border/40 bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Carteira de dívidas
              </h2>
              <p className="text-xs text-muted-foreground">
                {debts.length} contratos ativos
              </p>
            </div>
          </div>
          <div className="divide-y divide-border/40">
            {debts.map((d) => {
              const progress = (d.paid / d.installments) * 100;
              return (
                <div key={d.id} className="grid gap-4 px-6 py-5 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold tracking-tight">
                        {d.institution}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0 text-[9px] uppercase tracking-wider",
                          statusStyles[d.status],
                        )}
                      >
                        {d.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.type}
                      {d.collateral && ` · garantia: ${d.collateral}`}
                    </p>
                  </div>
                  <div className="md:col-span-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Saldo devedor
                    </p>
                    <p className="num mt-0.5 text-sm font-semibold">
                      {formatBRL(d.balance)}
                    </p>
                    <p className="num text-[11px] text-muted-foreground">
                      de {formatBRL(d.originalAmount)}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Parcela
                    </p>
                    <p className="num mt-0.5 text-sm font-medium">
                      {formatBRL(d.monthly)}
                    </p>
                    <p className="num text-[11px] text-muted-foreground">
                      Venc. dia {d.dueDay}
                    </p>
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="num">{d.paid}/{d.installments} pagas</span>
                      <span className="num">{d.rate.toFixed(2)}% a.m. · CET {d.cet.toFixed(1)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
