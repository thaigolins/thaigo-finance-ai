import { createFileRoute } from "@tanstack/react-router";
import { Plus, TrendingUp, ArrowUpRight, Trash2, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { z } from "zod";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { formatBRL } from "@/lib/format";
import { useUserList, useUserInsert, useUserDelete } from "@/lib/queries";

const colors = [
  "oklch(0.82 0.22 152)",
  "oklch(0.70 0.18 180)",
  "oklch(0.75 0.18 220)",
  "oklch(0.78 0.17 75)",
  "oklch(0.70 0.15 300)",
  "oklch(0.65 0.22 25)",
];

export const Route = createFileRoute("/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos — Thaigo Finance AI" },
      { name: "description", content: "Carteira de investimentos diversificada." },
    ],
  }),
  component: InvestimentosPage,
});

type AssetClass = "renda_fixa" | "renda_variavel" | "fundos" | "cripto" | "previdencia" | "outros";

type Investment = {
  id: string;
  name: string;
  asset_class: AssetClass;
  amount: number;
  return_percent: number;
  allocation_percent: number;
  notes: string | null;
};

const classLabels: Record<AssetClass, string> = {
  renda_fixa: "Renda Fixa",
  renda_variavel: "Renda Variável",
  fundos: "Fundos",
  cripto: "Cripto",
  previdencia: "Previdência",
  outros: "Outros",
};

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  asset_class: z.enum(["renda_fixa", "renda_variavel", "fundos", "cripto", "previdencia", "outros"]),
  amount: z.number({ invalid_type_error: "Valor inválido" }).nonnegative(),
  return_percent: z.number({ invalid_type_error: "Rentabilidade inválida" }),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

function InvestimentosPage() {
  const { data: items = [], isLoading } = useUserList<Investment>("investments", {
    orderBy: "amount",
  });
  const insert = useUserInsert<Record<string, unknown>>("investments");
  const remove = useUserDelete("investments");

  const total = items.reduce((s, i) => s + Number(i.amount), 0);
  const avgReturn = total
    ? items.reduce((s, i) => s + Number(i.return_percent) * (Number(i.amount) / total), 0)
    : 0;

  const allocation = useMemo(() => {
    const buckets: Record<AssetClass, number> = {
      renda_fixa: 0,
      renda_variavel: 0,
      fundos: 0,
      cripto: 0,
      previdencia: 0,
      outros: 0,
    };
    items.forEach((i) => {
      buckets[i.asset_class] = (buckets[i.asset_class] ?? 0) + Number(i.amount);
    });
    return (Object.entries(buckets) as [AssetClass, number][])
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: classLabels[k], amount: v, key: k }));
  }, [items]);

  const newDialog = (
    <FormDialog<Form>
      title="Novo aporte"
      description="Cadastre um ativo da sua carteira"
      trigger={
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-1.5 h-4 w-4" /> Novo aporte
        </Button>
      }
      schema={schema}
      defaultValues={{ name: "", asset_class: "renda_fixa", amount: 0, return_percent: 0, notes: "" }}
      fields={[
        { name: "name", label: "Nome / produto", type: "text", placeholder: "Ex.: Tesouro Selic 2029" },
        {
          name: "asset_class",
          label: "Classe",
          type: "select",
          options: (Object.keys(classLabels) as AssetClass[]).map((k) => ({
            value: k,
            label: classLabels[k],
          })),
        },
        { name: "amount", label: "Valor aplicado (R$)", type: "number", step: "0.01" },
        { name: "return_percent", label: "Rentabilidade % a.a.", type: "number", step: "0.01" },
        { name: "notes", label: "Observações", type: "textarea", placeholder: "Liquidez, vencimento, instituição..." },
      ]}
      onSubmit={async (v) => {
        const payload: Record<string, unknown> = { ...v };
        if (!payload.notes) payload.notes = null;
        await insert.mutateAsync(payload);
      }}
    />
  );

  return (
    <>
      <AppHeader title="Investimentos" subtitle="Sua carteira" exportModule="Investimentos" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-elegant md:col-span-2">
            <p className="text-xs uppercase tracking-widest text-primary">Patrimônio investido</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">{formatBRL(total)}</h2>
            <div className="mt-2 flex items-center gap-2">
              <Badge className="border-success/30 bg-success/10 text-success hover:bg-success/15">
                <ArrowUpRight className="mr-1 h-3 w-3" /> {avgReturn.toFixed(1)}% retorno médio
              </Badge>
              <span className="text-xs text-muted-foreground">ponderado por aporte</span>
            </div>
            <div className="mt-5">{newDialog}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Alocação por classe</h3>
            {allocation.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted-foreground">Sem dados ainda</p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocation}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {allocation.map((_, i) => (
                        <Cell key={i} fill={colors[i % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "oklch(0.20 0.018 160)",
                        border: "1px solid oklch(0.28 0.02 160)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                      formatter={(v: number) => formatBRL(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando carteira...
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Carteira vazia"
            description="Cadastre seus ativos por classe (renda fixa, ações, fundos, cripto) para visualizar alocação e rentabilidade ponderada."
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
            <div className="border-b border-border/60 p-5">
              <h3 className="text-sm font-semibold">Ativos da carteira</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {items.length} ativo{items.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="divide-y divide-border/60">
              {items.map((inv, i) => {
                const pct = total ? (Number(inv.amount) / total) * 100 : 0;
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-4 p-5">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{
                          background: `${colors[i % colors.length]}25`,
                          color: colors[i % colors.length],
                        }}
                      >
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{inv.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {classLabels[inv.asset_class]} · {pct.toFixed(1)}% da carteira
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatBRL(Number(inv.amount))}</p>
                        <p
                          className={`text-xs font-medium ${
                            Number(inv.return_percent) >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {Number(inv.return_percent) >= 0 ? "+" : ""}
                          {Number(inv.return_percent).toFixed(2)}% a.a.
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove.mutate(inv.id)}
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
