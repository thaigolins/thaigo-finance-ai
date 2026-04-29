import { createFileRoute } from "@tanstack/react-router";
import { Plus, Building2, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { accounts, transactions } from "@/lib/mock-data";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Thaigo Finance AI" },
      { name: "description", content: "Suas contas bancárias e movimentações." },
    ],
  }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  return (
    <>
      <AppHeader title="Financeiro" subtitle="Contas e movimentações" exportModule="Financeiro" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="rounded-3xl border border-border/60 bg-gradient-card p-6 shadow-elegant">
          <p className="text-xs uppercase tracking-widest text-primary">Saldo consolidado</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight">{formatBRL(total)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{accounts.length} contas conectadas</p>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Contas bancárias</h3>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-1.5 h-4 w-4" /> Nova conta
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border/60 bg-card p-5 shadow-card transition hover:border-primary/30">
                <div className="flex items-center justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                    style={{ background: a.color }}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="border-border/60 text-xs">{a.type}</Badge>
                </div>
                <p className="mt-4 text-sm font-medium">{a.bank}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{formatBRL(a.balance)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Movimentações recentes</h3>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border/60">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.amount>0?"bg-success/10 text-success":"bg-muted/50 text-muted-foreground"}`}>
                    {t.amount>0 ? <ArrowUpRight className="h-4 w-4"/> : <ArrowDownRight className="h-4 w-4"/>}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.date} · {t.category} · {t.account}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${t.amount>0?"text-success":"text-foreground"}`}>
                  {t.amount>0?"+":""}{formatBRL(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
