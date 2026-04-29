import { createFileRoute } from "@tanstack/react-router";
import { Plus, Repeat, Calendar, Trash2, Power, Loader2, AlertCircle } from "lucide-react";
import { z } from "zod";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useUserList,
  useUserInsert,
  useUserUpdate,
  useUserDelete,
} from "@/lib/queries";

export const Route = createFileRoute("/recorrentes")({
  head: () => ({
    meta: [
      { title: "Contas Recorrentes — Thaigo Finance AI" },
      { name: "description", content: "Despesas e assinaturas recorrentes." },
    ],
  }),
  component: RecorrentesPage,
});

type Recurring = {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  status: "active" | "paused" | "cancelled";
  category_id: string | null;
  notes: string | null;
};

type Category = { id: string; name: string; kind: string };

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  amount: z.number({ invalid_type_error: "Valor inválido" }).positive("Valor deve ser maior que zero"),
  due_day: z
    .number({ invalid_type_error: "Dia inválido" })
    .int()
    .min(1, "Dia entre 1 e 31")
    .max(31, "Dia entre 1 e 31"),
  category_id: z.string().optional(),
  status: z.enum(["active", "paused", "cancelled"]),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

function RecorrentesPage() {
  const { data: items = [], isLoading } = useUserList<Recurring>("recurring_expenses", {
    orderBy: "due_day",
    ascending: true,
  });
  const { data: categories = [] } = useUserList<Category>("categories", { orderBy: "name", ascending: true });
  const insert = useUserInsert<Record<string, unknown>>("recurring_expenses");
  const update = useUserUpdate<Record<string, unknown>>("recurring_expenses");
  const remove = useUserDelete("recurring_expenses");

  const active = items.filter((i) => i.status === "active");
  const total = active.reduce((s, r) => s + Number(r.amount), 0);

  const today = new Date();
  const day = today.getDate();
  const upcoming = [...active].sort((a, b) => {
    const da = a.due_day >= day ? a.due_day - day : 31 + a.due_day - day;
    const db = b.due_day >= day ? b.due_day - day : 31 + b.due_day - day;
    return da - db;
  });

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sem categoria";

  const categoryOptions = [
    { value: "", label: "Sem categoria" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const newDialog = (
    <FormDialog<Form>
      title="Nova conta recorrente"
      description="Despesas fixas mensais como assinaturas, aluguel ou planos."
      trigger={
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-1.5 h-4 w-4" /> Nova recorrente
        </Button>
      }
      schema={schema}
      defaultValues={{
        name: "",
        amount: 0,
        due_day: 5,
        category_id: "",
        status: "active",
        notes: "",
      }}
      fields={[
        { name: "name", label: "Nome", type: "text", placeholder: "Ex.: Netflix, Aluguel" },
        { name: "amount", label: "Valor mensal (R$)", type: "number", step: "0.01" },
        { name: "due_day", label: "Dia do vencimento", type: "number" },
        { name: "category_id", label: "Categoria", type: "select", options: categoryOptions },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "active", label: "Ativa" },
            { value: "paused", label: "Pausada" },
            { value: "cancelled", label: "Cancelada" },
          ],
        },
        { name: "notes", label: "Observações", type: "textarea", placeholder: "Opcional" },
      ]}
      onSubmit={async (v) => {
        const payload: Record<string, unknown> = { ...v };
        if (!payload.category_id) payload.category_id = null;
        if (!payload.notes) payload.notes = null;
        await insert.mutateAsync(payload);
      }}
    />
  );

  const toggleStatus = (r: Recurring) => {
    const next = r.status === "active" ? "paused" : "active";
    update.mutate({ id: r.id, values: { status: next } });
  };

  return (
    <>
      <AppHeader title="Contas recorrentes" subtitle="Despesas fixas mensais" exportModule="Recorrentes" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-card md:col-span-2">
            <p className="text-xs uppercase tracking-widest text-primary">Total mensal recorrente</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{formatBRL(total)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {active.length} ativa{active.length === 1 ? "" : "s"} · {items.length - active.length} pausada
              {items.length - active.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center justify-end">{newDialog}</div>
        </div>

        {/* Próximos vencimentos */}
        {upcoming.length > 0 && (
          <section className="rounded-2xl border border-border/40 bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Próximos vencimentos</h3>
              <Badge variant="outline" className="border-border/60 text-[10px]">
                30 dias
              </Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {upcoming.slice(0, 6).map((r) => {
                const daysUntil = r.due_day >= day ? r.due_day - day : 31 + r.due_day - day;
                const urgent = daysUntil <= 3;
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3",
                      urgent ? "border-warning/30 bg-warning/5" : "border-border/40 bg-muted/10",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        urgent ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary",
                      )}
                    >
                      {urgent ? <AlertCircle className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {daysUntil === 0 ? "Hoje" : `Em ${daysUntil} dia${daysUntil === 1 ? "" : "s"}`} ·{" "}
                        {formatBRL(Number(r.amount))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando recorrentes...
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Nenhuma conta recorrente"
            description="Cadastre suas assinaturas, aluguel, internet e outras despesas fixas para acompanhar os vencimentos."
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
            <div className="divide-y divide-border/60">
              {items.map((r) => {
                const paused = r.status !== "active";
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "flex items-center justify-between gap-4 p-5 transition hover:bg-accent/20",
                      paused && "opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Repeat className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> Vence dia {r.due_day}
                          <Badge variant="outline" className="border-border/60 py-0 text-[10px]">
                            {categoryName(r.category_id)}
                          </Badge>
                          {paused && (
                            <Badge className="border-warning/30 bg-warning/10 py-0 text-[10px] text-warning">
                              {r.status === "paused" ? "Pausada" : "Cancelada"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{formatBRL(Number(r.amount))}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => toggleStatus(r)}
                        title={paused ? "Ativar" : "Pausar"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove.mutate(r.id)}
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
