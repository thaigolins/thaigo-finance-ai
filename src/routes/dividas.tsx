import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Landmark,
  Upload,
  Plus,
  AlertTriangle,
  TrendingDown,
  Calendar,
  Sparkles,
  FileText,
  Shield,
  Trash2,
  Loader2,
  Download,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUserList, useUserInsert, useUserDelete } from "@/lib/queries";
import { uploadFile, getSignedUrl } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/dividas")({
  head: () => ({
    meta: [
      { title: "Empréstimos & Dívidas — Thaigo Finance AI" },
      {
        name: "description",
        content:
          "Visão consolidada de endividamento: empréstimos, financiamentos, taxa média e alertas.",
      },
    ],
  }),
  component: DebtsPage,
});

type DebtType =
  | "financiamento"
  | "emprestimo_pessoal"
  | "cartao"
  | "cheque_especial"
  | "consignado"
  | "veiculo"
  | "imovel"
  | "renegociacao"
  | "outros";
type DebtStatus = "em_dia" | "atrasado" | "renegociado" | "quitado";

type Loan = {
  id: string;
  institution: string;
  debt_type: DebtType;
  original_amount: number;
  current_balance: number;
  interest_rate: number;
  cet: number | null;
  monthly_payment: number;
  installments_total: number;
  installments_paid: number;
  due_day: number;
  status: DebtStatus;
  collateral: string | null;
  contract_path: string | null;
};

const typeLabels: Record<DebtType, string> = {
  financiamento: "Financiamento",
  emprestimo_pessoal: "Empréstimo pessoal",
  cartao: "Cartão",
  cheque_especial: "Cheque especial",
  consignado: "Consignado",
  veiculo: "Veículo",
  imovel: "Imóvel",
  renegociacao: "Renegociação",
  outros: "Outros",
};

const statusLabels: Record<DebtStatus, string> = {
  em_dia: "em dia",
  atrasado: "atrasado",
  renegociado: "renegociado",
  quitado: "quitado",
};

const statusStyles: Record<DebtStatus, string> = {
  em_dia: "border-success/30 bg-success/10 text-success",
  atrasado: "border-destructive/30 bg-destructive/10 text-destructive",
  renegociado: "border-warning/30 bg-warning/10 text-warning",
  quitado: "border-border/40 bg-muted/20 text-muted-foreground",
};

const schema = z.object({
  institution: z.string().min(1, "Instituição obrigatória"),
  debt_type: z.enum([
    "financiamento",
    "emprestimo_pessoal",
    "cartao",
    "cheque_especial",
    "consignado",
    "veiculo",
    "imovel",
    "renegociacao",
    "outros",
  ]),
  original_amount: z.number({ invalid_type_error: "Valor inválido" }).nonnegative(),
  current_balance: z.number({ invalid_type_error: "Valor inválido" }).nonnegative(),
  interest_rate: z.number({ invalid_type_error: "Taxa inválida" }),
  cet: z.number({ invalid_type_error: "CET inválido" }).optional(),
  monthly_payment: z.number({ invalid_type_error: "Parcela inválida" }).nonnegative(),
  installments_total: z.number({ invalid_type_error: "Parcelas inválidas" }).int().min(0),
  installments_paid: z.number({ invalid_type_error: "Parcelas pagas inválidas" }).int().min(0),
  due_day: z.number({ invalid_type_error: "Dia inválido" }).int().min(1).max(31),
  status: z.enum(["em_dia", "atrasado", "renegociado", "quitado"]),
  collateral: z.string().optional(),
});
type Form = z.infer<typeof schema>;

function DebtsPage() {
  const { user } = useAuth();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: debts = [], isLoading } = useUserList<Loan>("loan_accounts", {
    orderBy: "current_balance",
  });
  const insert = useUserInsert<Record<string, unknown>>("loan_accounts");
  const remove = useUserDelete("loan_accounts");
  const insertFile = useUserInsert<Record<string, unknown>>("uploaded_files");

  const totalDebt = debts.reduce((s, d) => s + Number(d.current_balance), 0);
  const monthlyTotal = debts.reduce((s, d) => s + Number(d.monthly_payment), 0);
  const weightedRate = totalDebt
    ? debts.reduce((s, d) => s + Number(d.interest_rate) * Number(d.current_balance), 0) / totalDebt
    : 0;
  const overdue = debts.filter((d) => d.status === "atrasado").length;

  const ranking = [...debts]
    .filter((d) => d.status !== "quitado")
    .sort((a, b) => Number(b.cet ?? b.interest_rate * 12) - Number(a.cet ?? a.interest_rate * 12))
    .slice(0, 4);

  const handleFiles = async (list: FileList | null) => {
    if (!list || !user?.id) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const up = await uploadFile({ bucket: "loan-contracts", userId: user.id, file });
        await insertFile.mutateAsync({
          bucket: "loan-contracts",
          path: up.path,
          filename: up.filename,
          mime_type: up.mime,
          size_bytes: up.size,
          kind: "contrato",
          related_table: "loan_accounts",
        });
        toast.success(`${file.name} arquivado em contratos.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadContract = async (path: string) => {
    try {
      const url = await getSignedUrl("loan-contracts", path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir");
    }
  };

  const newDialog = (
    <FormDialog<Form>
      title="Nova dívida"
      description="Registre um empréstimo, financiamento ou contrato"
      trigger={
        <Button className="w-full rounded-xl" variant="outline">
          <Plus className="mr-1.5 h-4 w-4" /> Nova dívida
        </Button>
      }
      schema={schema}
      defaultValues={{
        institution: "",
        debt_type: "emprestimo_pessoal",
        original_amount: 0,
        current_balance: 0,
        interest_rate: 0,
        cet: 0,
        monthly_payment: 0,
        installments_total: 0,
        installments_paid: 0,
        due_day: 5,
        status: "em_dia",
        collateral: "",
      }}
      fields={[
        { name: "institution", label: "Instituição", type: "text", placeholder: "Ex.: Itaú, Caixa" },
        {
          name: "debt_type",
          label: "Tipo",
          type: "select",
          options: (Object.keys(typeLabels) as DebtType[]).map((k) => ({
            value: k,
            label: typeLabels[k],
          })),
        },
        { name: "original_amount", label: "Valor original (R$)", type: "number", step: "0.01" },
        { name: "current_balance", label: "Saldo devedor (R$)", type: "number", step: "0.01" },
        { name: "interest_rate", label: "Taxa % a.m.", type: "number", step: "0.01" },
        { name: "cet", label: "CET % a.a.", type: "number", step: "0.01" },
        { name: "monthly_payment", label: "Parcela mensal (R$)", type: "number", step: "0.01" },
        { name: "installments_total", label: "Parcelas totais", type: "number" },
        { name: "installments_paid", label: "Parcelas pagas", type: "number" },
        { name: "due_day", label: "Dia do vencimento", type: "number" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: (Object.keys(statusLabels) as DebtStatus[]).map((k) => ({
            value: k,
            label: statusLabels[k],
          })),
        },
        { name: "collateral", label: "Garantia", type: "text", placeholder: "Ex.: imóvel, veículo" },
      ]}
      onSubmit={async (v) => {
        const payload: Record<string, unknown> = { ...v };
        if (!payload.collateral) payload.collateral = null;
        if (payload.cet === 0 || payload.cet === undefined) payload.cet = null;
        await insert.mutateAsync(payload);
      }}
    />
  );

  return (
    <>
      <AppHeader
        title="Empréstimos & Dívidas"
        subtitle="Gestão consolidada de endividamento"
        exportModule="Empréstimos & Dívidas"
      />
      <main className="flex-1 space-y-8 p-4 md:p-8">
        {/* KPIs */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Dívida Total Ativa" value={formatBRL(totalDebt)} icon={Landmark} accent="destructive" />
          <StatCard label="Parcela Mensal" value={formatBRL(monthlyTotal)} icon={Calendar} accent="warning" />
          <StatCard
            label="Taxa Média Ponderada"
            value={`${weightedRate.toFixed(2)}% a.m.`}
            icon={TrendingDown}
            accent="primary"
          />
          <StatCard
            label="Alertas de Vencimento"
            value={`${overdue} atraso${overdue === 1 ? "" : "s"}`}
            icon={AlertTriangle}
            accent="destructive"
          />
        </section>

        {/* Upload + Cadastro */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              "lg:col-span-2 rounded-2xl border border-dashed p-8 transition-all",
              dragOver ? "border-primary/60 bg-emerald-soft" : "border-border/50 bg-card",
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-emerald-soft">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Upload className="h-5 w-5 text-primary" strokeWidth={1.75} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold tracking-tight">Enviar contrato ou extrato</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Arraste PDFs, imagens ou contratos. Os arquivos ficam armazenados com criptografia
                  no bucket privado e podem ser revisitados a qualquer momento.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Selecionar arquivos
                  </Button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    hidden
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  <Badge
                    variant="outline"
                    className="rounded-full border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    <Shield className="mr-1 h-3 w-3" /> Criptografado
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/30 bg-emerald-soft text-[10px] uppercase tracking-wider text-primary"
                  >
                    <Sparkles className="mr-1 h-3 w-3" /> Bucket privado
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Cadastro Manual
            </p>
            <p className="mt-3 text-sm text-foreground/90">
              Registre uma dívida informando instituição, tipo, saldo, taxa, CET, parcelas e garantia.
            </p>
            <div className="mt-5">{newDialog}</div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando dívidas...
          </div>
        ) : debts.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Nenhuma dívida cadastrada"
            description="Cadastre seus empréstimos, financiamentos ou contratos para acompanhar saldo, parcelas e CET de forma consolidada."
          />
        ) : (
          <>
            {/* Ranking mais caras */}
            {ranking.length > 0 && (
              <section>
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">
                      Ranking — Dívidas mais caras
                    </h2>
                    <p className="text-xs text-muted-foreground">Ordenadas pelo CET anual efetivo</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {ranking.map((d, i) => {
                    const remaining = Math.max(d.installments_total - d.installments_paid, 0);
                    const cet = Number(d.cet ?? d.interest_rate * 12);
                    return (
                      <div
                        key={d.id}
                        className="flex items-center gap-4 rounded-2xl border border-border/40 bg-card p-4 shadow-card"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-sm font-semibold text-destructive">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {d.institution} · {typeLabels[d.debt_type]}
                          </p>
                          <p className="num text-[11px] text-muted-foreground">
                            Saldo {formatBRL(Number(d.current_balance))} · {remaining} parcelas restantes
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="num text-sm font-semibold text-destructive">
                            {cet.toFixed(1)}%
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            CET a.a.
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Lista completa */}
            <section className="rounded-2xl border border-border/40 bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Carteira de dívidas</h2>
                  <p className="text-xs text-muted-foreground">
                    {debts.length} contrato{debts.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                {debts.map((d) => {
                  const progress = d.installments_total
                    ? (d.installments_paid / d.installments_total) * 100
                    : 0;
                  return (
                    <div
                      key={d.id}
                      className="grid gap-4 px-6 py-5 md:grid-cols-12 md:items-center"
                    >
                      <div className="md:col-span-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold tracking-tight">{d.institution}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2 py-0 text-[9px] uppercase tracking-wider",
                              statusStyles[d.status],
                            )}
                          >
                            {statusLabels[d.status]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {typeLabels[d.debt_type]}
                          {d.collateral && ` · garantia: ${d.collateral}`}
                        </p>
                      </div>
                      <div className="md:col-span-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Saldo devedor
                        </p>
                        <p className="num mt-0.5 text-sm font-semibold">
                          {formatBRL(Number(d.current_balance))}
                        </p>
                        <p className="num text-[11px] text-muted-foreground">
                          de {formatBRL(Number(d.original_amount))}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Parcela
                        </p>
                        <p className="num mt-0.5 text-sm font-medium">
                          {formatBRL(Number(d.monthly_payment))}
                        </p>
                        <p className="num text-[11px] text-muted-foreground">Venc. dia {d.due_day}</p>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="num">
                            {d.installments_paid}/{d.installments_total} pagas
                          </span>
                          <span className="num">
                            {Number(d.interest_rate).toFixed(2)}%
                          </span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                      <div className="flex items-center justify-end gap-1 md:col-span-1">
                        {d.contract_path && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => downloadContract(d.contract_path!)}
                            title="Abrir contrato"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate(d.id)}
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
          </>
        )}
      </main>
    </>
  );
}
