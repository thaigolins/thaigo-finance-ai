import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Banknote,
  Upload,
  Plus,
  Building2,
  Sparkles,
  Shield,
  AlertTriangle,
  TrendingUp,
  CalendarClock,
  FileText,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AppHeader } from "@/components/app-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fgtsAccounts, fgtsHistory } from "@/lib/mock-data";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fgts")({
  head: () => ({
    meta: [
      { title: "FGTS — Thaigo Finance AI" },
      {
        name: "description",
        content:
          "Acompanhe saldo, contas e evolução do FGTS por empregador.",
      },
    ],
  }),
  component: FgtsPage,
});

function isStale(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
  return diff > 90;
}

function FgtsPage() {
  const [dragOver, setDragOver] = useState(false);

  const total = fgtsAccounts.reduce((s, a) => s + a.balance, 0);
  const monthlyDeposit = fgtsAccounts.reduce((s, a) => s + a.monthlyDeposit, 0);
  const totalJam = fgtsAccounts.reduce((s, a) => s + a.jam, 0);
  const stale = fgtsAccounts.filter((a) => isStale(a.lastUpdate)).length;

  return (
    <>
      <AppHeader title="FGTS" subtitle="Saldo, contas e evolução por empregador" exportModule="FGTS" />
      <main className="flex-1 space-y-8 p-4 md:p-8">
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Saldo Total FGTS"
            value={formatBRL(total)}
            icon={Banknote}
            accent="primary"
          />
          <StatCard
            label="Depósito Mensal"
            value={formatBRL(monthlyDeposit)}
            icon={TrendingUp}
            accent="success"
          />
          <StatCard
            label="JAM Acumulado (mês)"
            value={formatBRL(totalJam)}
            icon={Sparkles}
            accent="primary"
          />
          <StatCard
            label="Extratos desatualizados"
            value={`${stale}`}
            icon={AlertTriangle}
            accent={stale > 0 ? "warning" : "muted"}
          />
        </section>

        {/* Upload */}
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
                  Enviar extrato do FGTS
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aceita PDF e imagens do app FGTS / Caixa. A IA identifica
                  empregador, saldo, depósitos, saques e crédito JAM.
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
                    Leitura por IA
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
              Adicione manualmente uma conta FGTS por empregador, status e
              saldo.
            </p>
            <Button className="mt-5 w-full rounded-xl" variant="outline">
              <Plus className="mr-1.5 h-4 w-4" />
              Nova conta FGTS
            </Button>
          </div>
        </section>

        {/* Evolução do saldo */}
        <section className="rounded-2xl border border-border/40 bg-card p-6 shadow-card">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Evolução do saldo consolidado
              </h2>
              <p className="text-xs text-muted-foreground">
                Últimos 6 meses · todas as contas
              </p>
            </div>
            <p className="num text-sm font-semibold text-primary">
              {formatBRL(total)}
            </p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fgtsHistory} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fgtsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.68 0.11 158)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.68 0.11 158)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.3 0.01 200)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "oklch(0.6 0.02 200)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "oklch(0.6 0.02 200)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  cursor={{ stroke: "oklch(0.68 0.11 158)", strokeWidth: 1, strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "oklch(0.18 0.01 200)",
                    border: "1px solid oklch(0.3 0.01 200)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Area type="monotone" dataKey="balance" stroke="oklch(0.68 0.11 158)" strokeWidth={2} fill="url(#fgtsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Contas por empregador */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight">
              Contas por empregador
            </h2>
            <p className="text-xs text-muted-foreground">
              {fgtsAccounts.length} vínculos identificados
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fgtsAccounts.map((a) => {
              const stale = isStale(a.lastUpdate);
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-border/40 bg-card p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-muted/20 text-muted-foreground">
                        <Building2 className="h-4 w-4" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-tight">
                          {a.employer}
                        </p>
                        <p className="num text-[11px] text-muted-foreground">
                          CNPJ {a.cnpj}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0 text-[9px] uppercase tracking-wider",
                        a.status === "ativa"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border/40 bg-muted/20 text-muted-foreground",
                      )}
                    >
                      {a.status}
                    </Badge>
                  </div>

                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Saldo
                    </p>
                    <p className="num mt-1 text-2xl font-semibold tracking-tight">
                      {formatBRL(a.balance)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/40 pt-4 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Depósito</p>
                      <p className="num mt-0.5 font-medium">{formatBRL(a.monthlyDeposit)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saques</p>
                      <p className="num mt-0.5 font-medium">{formatBRL(a.withdrawals)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">JAM</p>
                      <p className="num mt-0.5 font-medium text-success">{formatBRL(a.jam)}</p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]",
                      stale
                        ? "border-warning/30 bg-warning/10 text-warning"
                        : "border-border/40 bg-muted/10 text-muted-foreground",
                    )}
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span>
                      {stale ? "Extrato desatualizado · " : "Atualizado em "}
                      {new Date(a.lastUpdate).toLocaleDateString("pt-BR")}
                    </span>
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
