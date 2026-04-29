import { createFileRoute } from "@tanstack/react-router";
import { Plus, Target, Trash2, Loader2 } from "lucide-react";
import { z } from "zod";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { formatBRL } from "@/lib/format";
import { useUserList, useUserInsert, useUserDelete } from "@/lib/queries";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Thaigo Finance AI" },
      { name: "description", content: "Acompanhe suas metas financeiras e objetivos." },
    ],
  }),
  component: MetasPage,
});

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string | null;
  status: "active" | "achieved" | "paused" | "cancelled";
};

const goalSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  target_amount: z.number({ invalid_type_error: "Meta inválida" }).positive(),
  current_amount: z.number({ invalid_type_error: "Valor inválido" }).min(0),
  deadline: z.string().optional(),
});
type GoalForm = z.infer<typeof goalSchema>;

function MetasPage() {
  const { data: goals = [], isLoading } = useUserList<Goal>("goals", { orderBy: "created_at" });
  const insert = useUserInsert<Record<string, unknown>>("goals");
  const remove = useUserDelete("goals");

  const trigger = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
      <Plus className="mr-1.5 h-4 w-4" /> Nova meta
    </Button>
  );

  return (
    <>
      <AppHeader title="Metas" subtitle="Seus objetivos financeiros" exportModule="Metas" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Metas em andamento</h2>
            <p className="text-sm text-muted-foreground">
              {goals.length} {goals.length === 1 ? "objetivo" : "objetivos"} cadastrados
            </p>
          </div>
          <FormDialog<GoalForm>
            title="Nova meta"
            description="Defina um objetivo financeiro com prazo e valor alvo."
            trigger={trigger}
            schema={goalSchema}
            defaultValues={{ name: "", target_amount: 0, current_amount: 0, deadline: "" }}
            fields={[
              { name: "name", label: "Objetivo", type: "text", placeholder: "Reserva de emergência" },
              { name: "target_amount", label: "Valor alvo", type: "number", step: "0.01" },
              { name: "current_amount", label: "Já acumulado", type: "number", step: "0.01" },
              { name: "deadline", label: "Prazo", type: "date" },
            ]}
            onSubmit={async (v) => {
              await insert.mutateAsync({
                name: v.name,
                target_amount: v.target_amount,
                current_amount: v.current_amount,
                deadline: v.deadline || null,
                icon: "target",
              });
            }}
          />
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Nenhuma meta cadastrada"
            description="Defina objetivos financeiros — viagem, reserva, imóvel — e acompanhe a evolução com clareza."
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {goals.map((g) => {
              const target = Number(g.target_amount) || 0;
              const current = Number(g.current_amount) || 0;
              const pct = target > 0 ? (current / target) * 100 : 0;
              return (
                <div
                  key={g.id}
                  className="group relative rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card transition hover:border-primary/30 hover:shadow-elegant"
                >
                  <button
                    onClick={() => remove.mutate(g.id)}
                    className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Remover meta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Target className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold">{g.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {g.deadline ? `Prazo: ${g.deadline}` : "Sem prazo definido"}
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl font-semibold text-primary">{pct.toFixed(0)}%</span>
                  </div>

                  <div className="mt-5">
                    <Progress value={Math.min(pct, 100)} className="h-2" />
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Acumulado</p>
                        <p className="font-semibold">{formatBRL(current)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Meta</p>
                        <p className="font-semibold">{formatBRL(target)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Faltam <span className="font-medium text-foreground">{formatBRL(Math.max(target - current, 0))}</span> para concluir
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </>
  );
}
