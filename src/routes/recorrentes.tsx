import { createFileRoute } from "@tanstack/react-router";
import { Plus, Repeat, Calendar } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { recurring } from "@/lib/mock-data";

export const Route = createFileRoute("/recorrentes")({
  head: () => ({
    meta: [
      { title: "Contas Recorrentes — Thaigo Finance AI" },
      { name: "description", content: "Despesas e assinaturas recorrentes." },
    ],
  }),
  component: RecorrentesPage,
});

function RecorrentesPage() {
  const total = recurring.reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <AppHeader title="Contas recorrentes" subtitle="Despesas fixas mensais" exportModule="Recorrentes" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-card md:col-span-2">
            <p className="text-xs uppercase tracking-widest text-primary">Total mensal recorrente</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{formatBRL(total)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{recurring.length} contas ativas</p>
          </div>
          <div className="flex items-center justify-end">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-1.5 h-4 w-4"/> Nova recorrente
            </Button>
          </div>
        </div>

        <section className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
          <div className="divide-y divide-border/60">
            {recurring.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 p-5 transition hover:bg-accent/20">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Repeat className="h-5 w-5"/>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3"/> Vence dia {r.dueDay}
                      <Badge variant="outline" className="border-border/60 text-[10px] py-0">{r.category}</Badge>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold">{formatBRL(r.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
