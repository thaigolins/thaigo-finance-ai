import { createFileRoute } from "@tanstack/react-router";
import { Upload, ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { transactions } from "@/lib/mock-data";

export const Route = createFileRoute("/extratos")({
  head: () => ({
    meta: [
      { title: "Extratos — Thaigo Finance AI" },
      { name: "description", content: "Extratos bancários e classificação automática por IA." },
    ],
  }),
  component: ExtratosPage,
});

function ExtratosPage() {
  const grouped = transactions.reduce<Record<string, typeof transactions>>((acc, t) => {
    (acc[t.date] ||= []).push(t);
    return acc;
  }, {});
  return (
    <>
      <AppHeader title="Extratos" subtitle="Histórico bancário" exportModule="Extratos" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <section className="flex flex-col gap-4 rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Upload className="h-6 w-6"/>
            </div>
            <div>
              <h3 className="text-base font-semibold">Importar extrato bancário</h3>
              <p className="text-sm text-muted-foreground">Suporte a PDF, OFX e CSV — categorização automática.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border/60"><Download className="mr-1.5 h-4 w-4"/> Exportar</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Upload className="mr-1.5 h-4 w-4"/> Importar
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          {Object.entries(grouped).map(([date, items]) => {
            const dayTotal = items.reduce((s, i) => s + i.amount, 0);
            return (
              <div key={date} className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{date}</span>
                  <span className={`text-xs font-semibold ${dayTotal>=0?"text-success":"text-foreground"}`}>
                    {dayTotal>=0?"+":""}{formatBRL(dayTotal)}
                  </span>
                </div>
                <div className="divide-y divide-border/60">
                  {items.map((t) => (
                    <div key={t.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.amount>0?"bg-success/10 text-success":"bg-muted/50 text-muted-foreground"}`}>
                          {t.amount>0 ? <ArrowUpRight className="h-4 w-4"/> : <ArrowDownRight className="h-4 w-4"/>}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t.description}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Badge variant="outline" className="border-border/60 text-[10px] py-0">{t.category}</Badge>
                            <span className="text-xs text-muted-foreground">{t.account}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${t.amount>0?"text-success":"text-foreground"}`}>
                        {t.amount>0?"+":""}{formatBRL(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </>
  );
}
