import { createFileRoute } from "@tanstack/react-router";
import { Plus, CreditCard as CardIcon, Wifi } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBRL } from "@/lib/format";
import { cards } from "@/lib/mock-data";

export const Route = createFileRoute("/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões — Thaigo Finance AI" },
      { name: "description", content: "Gestão dos seus cartões de crédito premium." },
    ],
  }),
  component: CartoesPage,
});

function CartoesPage() {
  return (
    <>
      <AppHeader title="Cartões" subtitle="Crédito · Limites · Faturas" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Seus cartões</h2>
            <p className="text-sm text-muted-foreground">{cards.length} cartões cadastrados</p>
          </div>
          <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" /> Novo cartão
          </Button>
        </div>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => {
            const pct = (c.used / c.limit) * 100;
            return (
              <div key={c.id} className="space-y-4">
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.color} p-5 shadow-elegant aspect-[1.6/1] flex flex-col justify-between text-white`}>
                  <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl"/>
                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-70">{c.brand}</p>
                      <p className="mt-1 text-base font-semibold">{c.name}</p>
                    </div>
                    <Wifi className="h-5 w-5 rotate-90 opacity-80"/>
                  </div>
                  <div className="relative">
                    <p className="font-mono text-lg tracking-widest opacity-90">•••• •••• •••• 4{c.id}{c.id}{c.id}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-[10px] uppercase opacity-60">Titular</p>
                        <p className="text-xs font-medium">THAIGO SILVA</p>
                      </div>
                      <CardIcon className="h-7 w-7 opacity-90"/>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Limite usado</span>
                    <span className="font-medium">{pct.toFixed(0)}%</span>
                  </div>
                  <Progress value={pct} className="mt-2 h-1.5"/>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Usado</p>
                      <p className="text-sm font-semibold text-foreground">{formatBRL(c.used)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Disponível</p>
                      <p className="text-sm font-semibold text-success">{formatBRL(c.limit - c.used)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <span>Fecha dia {c.closingDay}</span>
                    <span>Vence dia {c.dueDay}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </>
  );
}
