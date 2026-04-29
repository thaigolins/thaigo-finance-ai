import { createFileRoute } from "@tanstack/react-router";
import { Upload, FileText, CheckCircle2, Clock } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { invoices } from "@/lib/mock-data";

export const Route = createFileRoute("/faturas")({
  head: () => ({
    meta: [
      { title: "Faturas — Thaigo Finance AI" },
      { name: "description", content: "Faturas dos cartões de crédito e upload de PDFs." },
    ],
  }),
  component: FaturasPage,
});

function FaturasPage() {
  return (
    <>
      <AppHeader title="Faturas" subtitle="Cartões de crédito" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <section className="flex flex-col gap-4 rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Upload className="h-6 w-6"/>
            </div>
            <div>
              <h3 className="text-base font-semibold">Importar fatura em PDF</h3>
              <p className="text-sm text-muted-foreground">A IA classifica automaticamente cada lançamento por categoria.</p>
            </div>
          </div>
          <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            <Upload className="mr-1.5 h-4 w-4"/> Selecionar PDF
          </Button>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
          <div className="border-b border-border/60 p-5">
            <h3 className="text-sm font-semibold">Faturas recentes</h3>
            <p className="text-xs text-muted-foreground">Em aberto e pagas</p>
          </div>
          <div className="divide-y divide-border/60">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-4 p-5 transition hover:bg-accent/20">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
                    <FileText className="h-5 w-5"/>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{inv.card}</p>
                    <p className="text-xs text-muted-foreground">{inv.month} · {inv.items} lançamentos · vence {inv.dueDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold">{formatBRL(inv.amount)}</span>
                  {inv.status === "paid" ? (
                    <Badge className="border-success/30 bg-success/10 text-success hover:bg-success/15">
                      <CheckCircle2 className="mr-1 h-3 w-3"/> Paga
                    </Badge>
                  ) : (
                    <Badge className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/15">
                      <Clock className="mr-1 h-3 w-3"/> Em aberto
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
