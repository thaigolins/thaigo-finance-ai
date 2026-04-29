import { createFileRoute } from "@tanstack/react-router";
import { Plus, Wifi, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBRL } from "@/lib/format";
import { cards } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões — Thaigo Finance AI" },
      { name: "description", content: "Gestão dos seus cartões de crédito premium." },
    ],
  }),
  component: CartoesPage,
});

const variantStyles: Record<string, string> = {
  graphite: "bg-card-graphite",
  obsidian: "bg-card-black",
  emerald: "bg-card-emerald",
};

function CartoesPage() {
  const [hideNumbers, setHideNumbers] = useState(false);
  return (
    <>
      <AppHeader title="Cartões" subtitle="Crédito · Limites · Faturas" exportModule="Cartões" />
      <main className="flex-1 space-y-8 p-4 md:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Seus cartões</h2>
            <p className="mt-1 text-sm text-muted-foreground">{cards.length} cartões ativos · Linha private</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHideNumbers(!hideNumbers)}
              className="text-muted-foreground hover:text-foreground"
            >
              {hideNumbers ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
              {hideNumbers ? "Mostrar" : "Ocultar"}
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-1.5 h-4 w-4" /> Novo cartão
            </Button>
          </div>
        </div>

        <section className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => {
            const pct = (c.used / c.limit) * 100;
            const last4 = `4${c.id}${c.id}${c.id}${c.id}`.slice(0, 4);
            return (
              <div key={c.id} className="space-y-5">
                {/* Premium Black Card */}
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl p-6 shadow-premium aspect-[1.586/1] flex flex-col justify-between text-white border border-white/[0.06]",
                    variantStyles[c.variant],
                  )}
                >
                  {/* subtle metallic sheen */}
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.08),_transparent_60%)]" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/50">
                        {c.variant === "emerald" ? "Private Wealth" : "Black"}
                      </p>
                      <p className="mt-1.5 text-[15px] font-semibold tracking-tight">{c.name}</p>
                    </div>
                    <Lock className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
                  </div>

                  {/* Chip + contactless */}
                  <div className="relative flex items-center gap-3">
                    <div className="h-9 w-12 rounded-md bg-gradient-to-br from-yellow-200/40 via-yellow-400/30 to-yellow-600/40 ring-1 ring-white/10" />
                    <Wifi className="h-4 w-4 rotate-90 text-white/60" strokeWidth={1.5} />
                  </div>

                  <div className="relative space-y-4">
                    <p className="num font-mono text-base tracking-[0.3em] text-white/85">
                      {hideNumbers ? "•••• •••• •••• ••••" : `•••• •••• •••• ${last4}`}
                    </p>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[8px] font-medium uppercase tracking-[0.2em] text-white/40">Titular</p>
                        <p className="mt-0.5 text-xs font-medium tracking-wider">THAIGO SILVA</p>
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70">{c.brand}</p>
                    </div>
                  </div>
                </div>

                {/* Card details */}
                <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Limite utilizado
                    </span>
                    <span className="num text-xs font-semibold">{pct.toFixed(0)}%</span>
                  </div>
                  <Progress value={pct} className="mt-3 h-1" />
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Usado</p>
                      <p className="num mt-1 text-base font-semibold">{formatBRL(c.used)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Disponível</p>
                      <p className="num mt-1 text-base font-semibold text-success">{formatBRL(c.limit - c.used)}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4 text-[11px] text-muted-foreground">
                    <span>Fecha dia <span className="text-foreground">{c.closingDay}</span></span>
                    <span>Vence dia <span className="text-foreground">{c.dueDay}</span></span>
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
