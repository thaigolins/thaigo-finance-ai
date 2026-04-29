import { createFileRoute } from "@tanstack/react-router";
import { Plus, Wifi, Lock, Eye, EyeOff, CreditCard as CreditCardIcon, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUserList, useUserInsert, useUserDelete } from "@/lib/queries";

export const Route = createFileRoute("/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões — Thaigo Finance AI" },
      { name: "description", content: "Gestão dos seus cartões de crédito premium." },
    ],
  }),
  component: CartoesPage,
});

type Card = {
  id: string;
  name: string;
  brand: "visa" | "mastercard" | "amex" | "elo" | "hipercard" | "other";
  last_digits: string | null;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  variant: string | null;
};

type Invoice = {
  id: string;
  credit_card_id: string;
  total_amount: number;
  status: "open" | "closed" | "paid" | "overdue";
};

const variantStyles: Record<string, string> = {
  graphite: "bg-card-graphite",
  obsidian: "bg-card-black",
  emerald: "bg-card-emerald",
};

const cardSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  brand: z.enum(["visa", "mastercard", "amex", "elo", "hipercard", "other"]),
  last_digits: z.string().optional(),
  credit_limit: z.number({ invalid_type_error: "Limite inválido" }).min(0),
  closing_day: z.number().min(1).max(31),
  due_day: z.number().min(1).max(31),
  variant: z.enum(["graphite", "obsidian", "emerald"]),
});
type CardForm = z.infer<typeof cardSchema>;

function CartoesPage() {
  const [hideNumbers, setHideNumbers] = useState(false);
  const { data: cards = [], isLoading } = useUserList<Card>("credit_cards", { orderBy: "created_at" });
  const { data: invoices = [] } = useUserList<Invoice>("invoices");
  const insert = useUserInsert<Record<string, unknown>>("credit_cards");
  const remove = useUserDelete("credit_cards");

  const usedFor = (cardId: string) =>
    invoices
      .filter((i) => i.credit_card_id === cardId && i.status !== "paid")
      .reduce((s, i) => s + Number(i.total_amount), 0);

  const trigger = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
      <Plus className="mr-1.5 h-4 w-4" /> Novo cartão
    </Button>
  );

  return (
    <>
      <AppHeader title="Cartões" subtitle="Crédito · Limites · Faturas" exportModule="Cartões" />
      <main className="flex-1 space-y-8 p-4 md:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Seus cartões</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {cards.length} {cards.length === 1 ? "cartão ativo" : "cartões ativos"} · Linha private
            </p>
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
            <FormDialog<CardForm>
              title="Novo cartão"
              description="Adicione um cartão de crédito à sua carteira."
              trigger={trigger}
              schema={cardSchema}
              defaultValues={{
                name: "",
                brand: "visa",
                last_digits: "",
                credit_limit: 0,
                closing_day: 1,
                due_day: 10,
                variant: "graphite",
              }}
              fields={[
                { name: "name", label: "Nome do cartão", type: "text", placeholder: "Itaú Black" },
                {
                  name: "brand",
                  label: "Bandeira",
                  type: "select",
                  options: [
                    { value: "visa", label: "Visa" },
                    { value: "mastercard", label: "Mastercard" },
                    { value: "amex", label: "Amex" },
                    { value: "elo", label: "Elo" },
                    { value: "hipercard", label: "Hipercard" },
                    { value: "other", label: "Outros" },
                  ],
                },
                { name: "last_digits", label: "Últimos 4 dígitos", type: "text" },
                { name: "credit_limit", label: "Limite", type: "number", step: "0.01" },
                { name: "closing_day", label: "Dia de fechamento", type: "number" },
                { name: "due_day", label: "Dia de vencimento", type: "number" },
                {
                  name: "variant",
                  label: "Visual",
                  type: "select",
                  options: [
                    { value: "graphite", label: "Graphite" },
                    { value: "obsidian", label: "Obsidian" },
                    { value: "emerald", label: "Emerald (Wealth)" },
                  ],
                },
              ]}
              onSubmit={async (v) => {
                await insert.mutateAsync({
                  name: v.name,
                  brand: v.brand,
                  last_digits: v.last_digits || null,
                  credit_limit: v.credit_limit,
                  closing_day: v.closing_day,
                  due_day: v.due_day,
                  variant: v.variant,
                });
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : cards.length === 0 ? (
          <EmptyState
            icon={CreditCardIcon}
            title="Nenhum cartão cadastrado"
            description="Cadastre seus cartões de crédito para acompanhar limites, faturas e gastos consolidados."
          />
        ) : (
          <section className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => {
              const used = usedFor(c.id);
              const limit = Number(c.credit_limit) || 0;
              const pct = limit > 0 ? (used / limit) * 100 : 0;
              const last4 = c.last_digits ?? "••••";
              const variant = c.variant ?? "graphite";
              return (
                <div key={c.id} className="space-y-5">
                  <div className="group relative">
                    <button
                      onClick={() => remove.mutate(c.id)}
                      className="absolute right-3 top-3 z-10 rounded-md bg-black/40 p-1.5 text-white/70 opacity-0 backdrop-blur transition hover:bg-destructive/80 hover:text-white group-hover:opacity-100"
                      aria-label="Remover cartão"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-2xl p-6 shadow-premium aspect-[1.586/1] flex flex-col justify-between text-white border border-white/[0.06]",
                        variantStyles[variant],
                      )}
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.08),_transparent_60%)]" />
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                      <div className="relative flex items-start justify-between">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/50">
                            {variant === "emerald" ? "Private Wealth" : "Black"}
                          </p>
                          <p className="mt-1.5 text-[15px] font-semibold tracking-tight">{c.name}</p>
                        </div>
                        <Lock className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
                      </div>

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
                            <p className="text-[8px] font-medium uppercase tracking-[0.2em] text-white/40">Bandeira</p>
                            <p className="mt-0.5 text-xs font-medium uppercase tracking-wider">{c.brand}</p>
                          </div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70">
                            {variant}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

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
                        <p className="num mt-1 text-base font-semibold">{formatBRL(used)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Disponível</p>
                        <p className="num mt-1 text-base font-semibold text-success">{formatBRL(limit - used)}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4 text-[11px] text-muted-foreground">
                      <span>Fecha dia <span className="text-foreground">{c.closing_day}</span></span>
                      <span>Vence dia <span className="text-foreground">{c.due_day}</span></span>
                    </div>
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
