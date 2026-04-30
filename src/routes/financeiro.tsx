import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Wallet, ArrowUpRight, ArrowDownRight, Trash2, Loader2, Building2 } from "lucide-react";
import { z } from "zod";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { BankPickerDialog } from "@/components/bank-picker-dialog";
import { BankLogo } from "@/components/bank-logo";
import { findBank } from "@/lib/banks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  bank_color: string | null;
  bank_logo: string | null;
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

  const [accountFilter, setAccountFilter] = useState<string>("all");
  const filteredTxs = accountFilter === "all"
    ? txs
    : accountFilter === "none"
      ? txs.filter((t) => !t.bank_account_id)
      : txs.filter((t) => t.bank_account_id === accountFilter);
  // Ordena por conta para que o separador funcione, mantendo data desc dentro
  const sortedTxs = [...filteredTxs].sort((a, b) => {
    const aKey = a.bank_account_id ?? "~none";
    const bKey = b.bank_account_id ?? "~none";
    if (aKey !== bKey) return aKey.localeCompare(bKey);
    return (b.occurred_at ?? "").localeCompare(a.occurred_at ?? "");
  });

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
            <BankPickerDialog
              trigger={accountTrigger}
              onSubmit={async (v) => {
                await insertAccount.mutateAsync({
                  bank: v.bank,
                  account_type: v.account_type,
                  branch: v.branch || null,
                  account_number: v.account_number || null,
                  balance: v.balance,
                  color: v.color,
                  bank_color: v.bank_color,
                  bank_logo: v.bank_logo,
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
              {accounts.map((a) => {
                const bankDef = findBank(a.bank);
                const color = a.bank_color ?? bankDef?.color ?? a.color ?? "#689F7A";
                const logo = a.bank_logo ?? bankDef?.logo ?? null;
                return (
                  <div
                    key={a.id}
                    style={{
                      borderLeft: `4px solid ${color}`,
                      background: `linear-gradient(135deg, ${color}0D 0%, transparent 70%)`,
                    }}
                    className="group relative rounded-2xl border border-border/60 p-5 shadow-card transition hover:border-primary/30"
                  >
                    <button
                      onClick={() => removeAccount.mutate(a.id)}
                      className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label="Remover conta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center justify-between">
                      <BankLogo name={a.bank} logo={logo} color={color} size={40} />
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
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Movimentações recentes</h3>
            <div className="flex items-center gap-2">
              {accounts.length > 0 && (
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger className="h-8 w-[180px] border-border/60 text-xs">
                    <SelectValue placeholder="Filtrar conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as contas</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.bank}
                        {a.account_number ? ` · ${a.account_number}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="none">Sem conta vinculada</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
          {sortedTxs.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sem movimentações"
              description="Registre suas receitas e despesas para visualizar o fluxo financeiro do mês."
              className="border-0 bg-transparent shadow-none py-10"
            />
          ) : (
            <div className="divide-y divide-border/60">
              {sortedTxs.map((t, idx) => {
                const positive = t.kind === "income" || Number(t.amount) > 0;
                const acc = accounts.find((a) => a.id === t.bank_account_id);
                const accountName = acc?.bank ?? "Sem conta vinculada";
                const accBankDef = findBank(acc?.bank);
                const accColor = acc?.bank_color ?? accBankDef?.color ?? acc?.color ?? "#6B7280";
                const accLogo = acc?.bank_logo ?? accBankDef?.logo ?? null;
                const prevKey = idx > 0 ? (sortedTxs[idx - 1].bank_account_id ?? "~none") : null;
                const currKey = t.bank_account_id ?? "~none";
                const showHeader = prevKey !== currKey;
                return (
                  <div key={t.id}>
                    {showHeader && (
                      <div className="flex items-center gap-2 pt-4 pb-2 first:pt-0">
                        {acc ? (
                          <BankLogo name={accountName} logo={accLogo} color={accColor} size={24} />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {accountName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-3">
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
                            {t.occurred_at} · {accountName}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${positive ? "text-success" : "text-foreground"}`}>
                        {positive ? "+" : "-"}
                        {formatBRL(Math.abs(Number(t.amount)))}
                      </span>
                    </div>
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
