import { createFileRoute } from "@tanstack/react-router";
import { Plus, Shield, Plane, Home, Car, Target } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBRL } from "@/lib/format";
import { goals } from "@/lib/mock-data";

const iconMap = { shield: Shield, plane: Plane, home: Home, car: Car } as const;

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Thaigo Finance AI" },
      { name: "description", content: "Acompanhe suas metas financeiras e objetivos." },
    ],
  }),
  component: MetasPage,
});

function MetasPage() {
  return (
    <>
      <AppHeader title="Metas" subtitle="Seus objetivos financeiros" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Metas em andamento</h2>
            <p className="text-sm text-muted-foreground">{goals.length} objetivos ativos</p>
          </div>
          <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4"/> Nova meta
          </Button>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const Icon = iconMap[g.icon as keyof typeof iconMap] ?? Target;
            const pct = (g.current / g.target) * 100;
            return (
              <div key={g.id} className="rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card transition hover:border-primary/30 hover:shadow-elegant">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6"/>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">{g.name}</h3>
                      <p className="text-xs text-muted-foreground">Prazo: {g.deadline}</p>
                    </div>
                  </div>
                  <span className="text-2xl font-semibold text-primary">{pct.toFixed(0)}%</span>
                </div>

                <div className="mt-5">
                  <Progress value={pct} className="h-2"/>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Acumulado</p>
                      <p className="font-semibold">{formatBRL(g.current)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Meta</p>
                      <p className="font-semibold">{formatBRL(g.target)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Faltam <span className="font-medium text-foreground">{formatBRL(g.target - g.current)}</span> para concluir
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </>
  );
}
