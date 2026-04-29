import { createFileRoute } from "@tanstack/react-router";
import { Plus, Building2, Wallet, ArrowUpRight, ArrowDownRight, Trash2, Loader2 } from "lucide-react";
import { z } from "zod";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { formatBRL } from "@/lib/format";
import { useUserList, useUserInsert, useUserDelete } from "@/lib/queries";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Thaigo Finance AI" },
      { name: "description", content: "Suas contas bancárias e movimentações." },
    ],
  }),
  component: FinanceiroPage,
});

type BankAccount = {
  id: string;
  bank: string;
  account_type: "checking" | "savings" | "investment" | "wallet" | "other";
  branch: string | null;
  account_number: string | null;
  balance: number;
  color: string | null;
};

type Tx = {
  id: string;
  description: string;
  amount: number;
  occurred_at: string;
  kind: "income" | "expense" | "transfer";
  bank_account_id: string | null;
};

const accountTypeLabels: Record<BankAccount["account_type"], string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  investment: "Investimentos",
  wallet: "Carteira Digital",
  other: "Outros",
};

const accountSchema = z.object({
  bank: z.string().min(1, "Banco obrigatório"),
  account_type: z.enum(["checking", "savings", "investment", "wallet", "other"]),
  branch: z.string().optional(),
  account_number: z.string().optional(),
  balance: z.number({ invalid_type_error: "Saldo inválido" }),
  color: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

const txSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  amount: z.number({ invalid_type_error: "Valor inválido" }),
  occurred_at: z.string().min(1, "Data obrigatória"),
  kind: z.enum(["income", "expense", "transfer"]),
  bank_account_id: z.string().optional(),
});
type TxForm = z.infer<typeof txSchema>;

function FinanceiroPage() {
  const { data: accounts = [], isLoading } = useUserList<BankAccount>("bank_accounts", {
    orderBy: "created_at",
  });
  const { data: txs = [] } = useUserList<Tx>("bank_transactions", {
    orderBy: "occurred_at",
  });
  const insertAccount = useUserInsert<Record<string, unknown>>("bank_accounts");
  const insertTx = useUserInsert<Record<string, unknown>>("bank_transactions");
  const removeAccount = useUserDelete("bank_accounts");

  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);

  const accountTrigger = (
    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
      <Plus className="mr-1.5 h-4 w-4" /> Nova conta
    </Button>
  );
  const txTrigger = (
    <Button size="sm" variant="outline" className="border-border/60">
      <Plus className="mr-1.5 h-4 w-4" /> Nova transação
    </Button>
  );

  return (
    <>
      <AppHeader title="Financeiro" subtitle="Contas e movimentações" exportModule="Financeiro" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="rounded-3xl border border-border/60 bg-gradient-card p-6 shadow-elegant">
          <p className="text-xs uppercase tracking-widest text-primary">Saldo consolidado</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight">{formatBRL(total)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {accounts.length} {accounts.length === 1 ? "conta conectada" : "contas conectadas"}
          </p>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Contas bancárias</h3>
            <FormDialog<AccountForm>
              title="Nova conta bancária"
              description="Cadastre uma conta para começar a controlar saldos e movimentações."
              trigger={accountTrigger}
              schema={accountSchema}
              defaultValues={{
                bank: "",
                account_type: "checking",
                branch: "",
                account_number: "",
                balance: 0,
                color: "#689F7A",
              }}
              fields={[
                { name: "bank", label: "Banco", type: "text", placeholder: "Itaú, Nubank, BTG..." },
                {
                  name: "account_type",
                  label: "Tipo",
                  type: "select",
                  options: [
                    { value: "checking", label: "Conta Corrente" },
                    { value: "savings", label: "Poupança" },
                    { value: "investment", label: "Investimentos" },
                    { value: "wallet", label: "Carteira Digital" },
                    { value: "other", label: "Outros" },
                  ],
                },
                { name: "branch", label: "Agência", type: "text" },
                { name: "account_number", label: "Conta", type: "text" },
                { name: "balance", label: "Saldo inicial", type: "number", step: "0.01" },
                { name: "color", label: "Cor", type: "color" },
              ]}
              onSubmit={async (v) => {
                await insertAccount.mutateAsync({
                  bank: v.bank,
                  account_type: v.account_type,
                  branch: v.branch || null,
                  account_number: v.account_number || null,
                  balance: v.balance,
                  color: v.color || null,
                });
              }}
            />
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nenhuma conta cadastrada"
              description="Cadastre suas contas bancárias para acompanhar saldos, movimentações e patrimônio consolidado."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="group relative rounded-2xl border border-border/60 bg-card p-5 shadow-card transition hover:border-primary/30"
                >
                  <button
                    onClick={() => removeAccount.mutate(a.id)}
                    className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Remover conta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center justify-between">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                      style={{ background: a.color ?? "#689F7A" }}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="border-border/60 text-xs">
                      {accountTypeLabels[a.account_type]}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm font-medium">{a.bank}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{formatBRL(Number(a.balance))}</p>
                  {(a.branch || a.account_number) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {a.branch && `Ag. ${a.branch}`}
                      {a.branch && a.account_number && " · "}
                      {a.account_number && `Cc. ${a.account_number}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Movimentações recentes</h3>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <FormDialog<TxForm>
                title="Nova transação"
                trigger={txTrigger}
                schema={txSchema}
                defaultValues={{
                  description: "",
                  amount: 0,
                  occurred_at: new Date().toISOString().slice(0, 10),
                  kind: "expense",
                  bank_account_id: accounts[0]?.id ?? "",
                }}
                fields={[
                  { name: "description", label: "Descrição", type: "text" },
                  { name: "amount", label: "Valor", type: "number", step: "0.01" },
                  { name: "occurred_at", label: "Data", type: "date" },
                  {
                    name: "kind",
                    label: "Tipo",
                    type: "select",
                    options: [
                      { value: "income", label: "Receita" },
                      { value: "expense", label: "Despesa" },
                      { value: "transfer", label: "Transferência" },
                    ],
                  },
                  ...(accounts.length
                    ? [
                        {
                          name: "bank_account_id",
                          label: "Conta",
                          type: "select" as const,
                          options: accounts.map((a) => ({ value: a.id, label: a.bank })),
                        },
                      ]
                    : []),
                ]}
                onSubmit={async (v) => {
                  await insertTx.mutateAsync({
                    description: v.description,
                    amount: v.amount,
                    occurred_at: v.occurred_at,
                    kind: v.kind,
                    bank_account_id: v.bank_account_id || null,
                  });
                }}
              />
            </div>
          </div>
          {txs.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sem movimentações"
              description="Registre suas receitas e despesas para visualizar o fluxo financeiro do mês."
              className="border-0 bg-transparent shadow-none py-10"
            />
          ) : (
            <div className="divide-y divide-border/60">
              {txs.map((t) => {
                const positive = t.kind === "income" || Number(t.amount) > 0;
                return (
                  <div key={t.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          positive ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.occurred_at} ·{" "}
                          {accounts.find((a) => a.id === t.bank_account_id)?.bank ?? "Sem conta"}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${positive ? "text-success" : "text-foreground"}`}>
                      {positive ? "+" : "-"}
                      {formatBRL(Math.abs(Number(t.amount)))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
