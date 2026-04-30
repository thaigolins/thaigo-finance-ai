import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Banknote,
  Upload,
  Plus,
  Building2,
  Sparkles,
  Shield,
  TrendingUp,
  CalendarClock,
  FileText,
  Trash2,
  Loader2,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  Circle,
  Search,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  Calendar,
  BarChart3,
} from "lucide-react";
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { z } from "zod";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUserList, useUserInsert, useUserDelete } from "@/lib/queries";
import { uploadFile, getSignedUrl } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/fgts")({
  head: () => ({
    meta: [
      { title: "FGTS — Thaigo Finance AI" },
      { name: "description", content: "Acompanhe saldo, contas e evolução do FGTS por empregador." },
    ],
  }),
  component: FgtsPage,
});

type FgtsStatus = "ativa" | "inativa";
type FgtsAccount = {
  id: string;
  employer: string;
  cnpj: string | null;
  status: FgtsStatus;
  balance: number;
  monthly_deposit: number;
  jam_month: number;
  last_movement: string | null;
  statement_path: string | null;
  created_at?: string | null;
};

type EntryType = "deposito" | "jam" | "saque" | "outro";
type FgtsEntry = {
  id: string;
  fgts_account_id: string;
  amount: number;
  occurred_at: string;
  entry_type: EntryType;
  notes: string | null;
};

const MONTH_NAMES_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formatDatePT(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function diffYearsMonths(from: string | null): string | null {
  if (!from) return null;
  const start = new Date(from + (from.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0 && months <= 0) return "menos de 1 mês";
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
  return parts.join(" e ");
}

const entryMeta: Record<EntryType, { label: string; color: string; icon: typeof Circle; sign: 1 | -1 }> = {
  deposito: { label: "Depósito", color: "text-success", icon: ArrowDownLeft, sign: 1 },
  jam: { label: "JAM", color: "text-warning", icon: Sparkles, sign: 1 },
  saque: { label: "Saque", color: "text-destructive", icon: ArrowUpRight, sign: -1 },
  outro: { label: "Ajuste", color: "text-muted-foreground", icon: Circle, sign: 1 },
};

const schema = z.object({
  employer: z.string().min(1, "Empregador obrigatório"),
  cnpj: z.string().optional(),
  status: z.enum(["ativa", "inativa"]),
  balance: z.number({ invalid_type_error: "Saldo inválido" }).nonnegative(),
  monthly_deposit: z.number({ invalid_type_error: "Depósito inválido" }).nonnegative(),
  jam_month: z.number({ invalid_type_error: "JAM inválido" }).nonnegative(),
  last_movement: z.string().optional(),
});
type Form = z.infer<typeof schema>;

const PAGE_SIZE = 20;

const FGTS_CODES: Record<string, string> = {
  "01": "Rescisão sem justa causa / contrato encerrado",
  "02": "Rescisão por culpa recíproca ou força maior",
  "03": "Extinção da empresa / estabelecimento",
  "04": "Aposentadoria",
  "05": "Falecimento do trabalhador",
  "06": "Pagamento de parte das prestações do SFH",
  "07": "Liquidação ou amortização de saldo devedor do SFH",
  "08": "Conta inativa há mais de 3 anos (antes 05/10/1988)",
  "09": "Suspensão do trabalho avulso",
  "10": "Conta inativa há mais de 3 anos",
  "19E": "Saque-aniversário — depósito principal",
  "50E": "Saque emergencial COVID-19",
  "50": "Saque emergencial COVID-19",
  "60": "Saque-aniversário — depósito disponível",
  "60F": "Saque-aniversário — depósito com data futura de liberação",
  "99": "Movimentação não especificada / operação interna da Caixa",
};

function getFgtsCodeMeaning(notes: string): string | null {
  if (!notes) return null;
  const match = notes.match(/COD\s+(\d+[A-Z]?)/i);
  if (!match) return null;
  const code = match[1].toUpperCase();
  return FGTS_CODES[code] ?? null;
}

function FgtsPage() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtros do histórico
  const [filterType, setFilterType] = useState<"all" | EntryType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: accounts = [], isLoading } = useUserList<FgtsAccount>("fgts_accounts", {
    orderBy: "balance",
  });
  const { data: entries = [] } = useUserList<FgtsEntry>("fgts_entries", {
    orderBy: "occurred_at",
    ascending: true,
  });
  const insert = useUserInsert<Record<string, unknown>>("fgts_accounts");
  const remove = useUserDelete("fgts_accounts");
  const insertFile = useUserInsert<Record<string, unknown>>("uploaded_files");

  // Totalizadores agregados
  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const monthlyDeposit = accounts.reduce((s, a) => s + Number(a.monthly_deposit), 0);
  const totalJamMonth = accounts.reduce((s, a) => s + Number(a.jam_month), 0);

  const totals = useMemo(() => {
    let dep = 0;
    let jam = 0;
    let saq = 0;
    for (const e of entries) {
      const v = Number(e.amount);
      if (e.entry_type === "deposito") dep += v;
      else if (e.entry_type === "jam") jam += v;
      else if (e.entry_type === "saque") saq += v;
    }
    return { dep, jam, saq };
  }, [entries]);

  // Última movimentação global
  const lastMovementGlobal = useMemo(() => {
    const dates = accounts
      .map((a) => a.last_movement)
      .filter((d): d is string => !!d)
      .sort()
      .reverse();
    return dates[0] ?? null;
  }, [accounts]);

  // Valor rescisório estimado: 40% multa + saldo
  const valorRescisorio = total * 1.4;

  // Análise FGTS — projeção
  const firstMovement = useMemo(() => {
    if (entries.length === 0) return null;
    return entries[0].occurred_at;
  }, [entries]);

  const tempoContribuicao = diffYearsMonths(firstMovement);
  const monthsContrib = useMemo(() => {
    if (!firstMovement) return 0;
    const d = new Date(firstMovement + (firstMovement.length === 10 ? "T00:00:00" : ""));
    const now = new Date();
    return Math.max(
      1,
      (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()) + 1,
    );
  }, [firstMovement]);

  const mediaDeposito = monthsContrib > 0 ? totals.dep / monthsContrib : 0;
  const projecao12m = total + monthlyDeposit * 12 + totalJamMonth * 12;

  // Histórico por mês: depósito, jam, saque, saldo acumulado
  const chartData = useMemo(() => {
    if (entries.length === 0 && total === 0) return [];
    const buckets = new Map<
      string,
      { key: string; label: string; deposito: number; jam: number; saque: number; balance: number }
    >();

    // Pega janela: do primeiro entry até hoje, ou últimos 12 meses
    const start =
      entries.length > 0
        ? new Date(entries[0].occurred_at + "T00:00:00")
        : new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
    const end = new Date();
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, {
        key,
        label: `${MONTH_NAMES_SHORT[cur.getMonth()]}/${String(cur.getFullYear()).slice(2)}`,
        deposito: 0,
        jam: 0,
        saque: 0,
        balance: 0,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    for (const e of entries) {
      const key = e.occurred_at.slice(0, 7);
      const b = buckets.get(key);
      if (!b) continue;
      const v = Number(e.amount);
      if (e.entry_type === "deposito") b.deposito += v;
      else if (e.entry_type === "jam") b.jam += v;
      else if (e.entry_type === "saque") b.saque += v;
    }
    let running = 0;
    const arr = Array.from(buckets.values());
    for (const b of arr) {
      running += b.deposito + b.jam - b.saque;
      b.balance = running;
    }
    // Limita a 12 meses recentes
    return arr.slice(-12);
  }, [entries, total]);

  const withdrawalMonths = useMemo(
    () => chartData.filter((d) => d.saque > 0).map((d) => d.label),
    [chartData],
  );

  // Histórico filtrado
  const filtered = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
    return sorted.filter((e) => {
      if (filterType !== "all" && e.entry_type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${e.notes ?? ""} ${e.occurred_at} ${entryMeta[e.entry_type].label}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, filterType, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFiles = async (list: FileList | null) => {
    if (!list || !user?.id) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const up = await uploadFile({ bucket: "fgts-statements", userId: user.id, file });
        await insertFile.mutateAsync({
          bucket: "fgts-statements",
          path: up.path,
          filename: up.filename,
          mime_type: up.mime,
          size_bytes: up.size,
          kind: "fgts_statement",
          related_table: "fgts_accounts",
        });
        toast.success(`${file.name} arquivado.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadStatement = async (path: string) => {
    try {
      const url = await getSignedUrl("fgts-statements", path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir");
    }
  };


  const maxAccountBalance = Math.max(1, ...accounts.map((a) => Number(a.balance)));

  return (
    <>
      <AppHeader title="FGTS" subtitle="Saldo, contas e evolução por empregador" exportModule="FGTS" />
      <main className="flex-1 space-y-6 p-4 md:p-8">
        {/* Barra discreta — upload + cadastro manual */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" />
            <span>Atualizar via extrato:</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Selecionar arquivo"
              )}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
          <FormDialog<Form>
            title="Nova conta FGTS"
            description="Cadastre um vínculo empregatício"
            trigger={
              <Button size="sm" variant="ghost" className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" /> Cadastro manual
              </Button>
            }
            schema={schema}
            defaultValues={{
              employer: "",
              cnpj: "",
              status: "ativa",
              balance: 0,
              monthly_deposit: 0,
              jam_month: 0,
              last_movement: new Date().toISOString().slice(0, 10),
            }}
            fields={[
              { name: "employer", label: "Empregador", type: "text", placeholder: "Razão social" },
              { name: "cnpj", label: "CNPJ", type: "text", placeholder: "00.000.000/0000-00" },
              {
                name: "status",
                label: "Status",
                type: "select",
                options: [
                  { value: "ativa", label: "Ativa" },
                  { value: "inativa", label: "Inativa" },
                ],
              },
              { name: "balance", label: "Saldo (R$)", type: "number", step: "0.01" },
              { name: "monthly_deposit", label: "Depósito mensal (R$)", type: "number", step: "0.01" },
              { name: "jam_month", label: "JAM do mês (R$)", type: "number", step: "0.01" },
              { name: "last_movement", label: "Última movimentação", type: "date" },
            ]}
            onSubmit={async (v) => {
              const payload: Record<string, unknown> = { ...v };
              if (!payload.cnpj) payload.cnpj = null;
              if (!payload.last_movement) payload.last_movement = null;
              await insert.mutateAsync(payload);
            }}
          />
        </div>

        {/* SEÇÃO 1 — Header com 3 cards principais */}
        <section className="grid gap-5 md:grid-cols-3">
          <HeroCard
            label="Saldo Total FGTS"
            value={formatBRL(total)}
            icon={Banknote}
            tone="success"
            big
          />
          <HeroCard
            label="Depósito Mensal"
            value={formatBRL(monthlyDeposit)}
            icon={TrendingUp}
            tone="primary"
          />
          <HeroCard
            label="JAM Mês"
            value={formatBRL(totalJamMonth)}
            icon={Sparkles}
            tone="warning"
          />
        </section>

        {/* SEÇÃO 2 — 3 cards secundários */}
        <section className="grid gap-4 sm:grid-cols-3">
          <MiniCard
            label="Total em Saques"
            value={formatBRL(totals.saq)}
            icon={ArrowUpRight}
            tone="destructive"
          />
          <MiniCard
            label="Valor Rescisório (est.)"
            value={formatBRL(valorRescisorio)}
            icon={Shield}
            tone="primary"
          />
          <MiniCard
            label="Atualizado em"
            value={lastMovementGlobal ? formatDatePT(lastMovementGlobal) : "—"}
            icon={CalendarClock}
            tone="muted"
          />
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando contas FGTS...
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Nenhuma conta FGTS cadastrada"
            description="Importe um extrato ou cadastre manualmente uma conta para acompanhar saldo, depósitos mensais e JAM por empregador."
          />
        ) : (
          <>
            {/* SEÇÃO 4 — Cards do empregador (layout horizontal limpo) */}
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Contas por empregador</h2>
                <p className="text-xs text-muted-foreground">
                  {accounts.length} vínculo{accounts.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="space-y-4">
                {accounts.map((a) => {
                  const accountEntries = entries.filter((e) => e.fgts_account_id === a.id);
                  const accountWithdrawals = accountEntries
                    .filter((e) => e.entry_type === "saque")
                    .reduce((s, e) => s + Number(e.amount), 0);
                  const admission = accountEntries[0]?.occurred_at ?? a.created_at ?? null;
                  const tempo = diffYearsMonths(admission);
                  const accountRescisorio = Number(a.balance) * 1.4;
                  const progress = (Number(a.balance) / maxAccountBalance) * 100;
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-border/40 bg-card p-5 shadow-card"
                    >
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_auto] lg:items-center">
                        {/* Esquerda: empregador */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/20 text-muted-foreground">
                            <Building2 className="h-5 w-5" strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold tracking-tight">
                              {a.employer}
                            </p>
                            {a.cnpj && (
                              <p className="num text-[11px] text-muted-foreground truncate">
                                CNPJ {a.cnpj}
                              </p>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                "mt-1 rounded-full px-2 py-0 text-[9px] uppercase tracking-wider",
                                a.status === "ativa"
                                  ? "border-success/30 bg-success/10 text-success"
                                  : "border-border/40 bg-muted/20 text-muted-foreground",
                              )}
                            >
                              {a.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Centro: saldo + barra */}
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Saldo
                          </p>
                          <p className="num mt-1 text-2xl font-bold tracking-tight">
                            {formatBRL(Number(a.balance))}
                          </p>
                          <Progress value={progress} className="mt-2 h-1.5" />
                        </div>

                        {/* Direita: grid 2x2 */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Depósito
                            </p>
                            <p className="num mt-0.5 font-medium text-success">
                              {formatBRL(Number(a.monthly_deposit))}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              JAM
                            </p>
                            <p className="num mt-0.5 font-medium text-warning">
                              {formatBRL(Number(a.jam_month))}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Saques
                            </p>
                            <p className="num mt-0.5 font-medium text-destructive">
                              {formatBRL(accountWithdrawals)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Rescisório
                            </p>
                            <p className="num mt-0.5 font-medium text-primary">
                              {formatBRL(accountRescisorio)}
                            </p>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center justify-end gap-1">
                          {a.statement_path && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => downloadStatement(a.statement_path!)}
                              title="Abrir extrato"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => remove.mutate(a.id)}
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Rodapé */}
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarClock className="h-3 w-3" />
                          {a.last_movement
                            ? `Atualizado em ${formatDatePT(a.last_movement)}`
                            : "Sem movimentação registrada"}
                        </span>
                        {tempo && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            Desde {formatDatePT(admission)} · {tempo}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SEÇÃO 5 — Análise Financeira */}
            <section className="rounded-2xl border border-border/40 bg-card p-5 shadow-card">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold tracking-tight">Análise Financeira</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AnalysisItem
                  icon={Calendar}
                  label="Tempo de contribuição"
                  value={tempoContribuicao ?? "—"}
                />
                <AnalysisItem
                  icon={TrendingUp}
                  label="Média de depósito"
                  value={formatBRL(mediaDeposito)}
                />
                <AnalysisItem
                  icon={ArrowDownLeft}
                  label="Total depositado"
                  value={formatBRL(totals.dep)}
                  accent="text-success"
                />
                <AnalysisItem
                  icon={Sparkles}
                  label="Total de JAM"
                  value={formatBRL(totals.jam)}
                  accent="text-warning"
                />
                <AnalysisItem
                  icon={ArrowUpRight}
                  label="Total sacado"
                  value={formatBRL(totals.saq)}
                  accent="text-destructive"
                />
                <AnalysisItem
                  icon={PiggyBank}
                  label="Projeção 12 meses ↑"
                  value={formatBRL(projecao12m)}
                  accent="text-primary"
                />
              </div>
            </section>

            {/* SEÇÃO 6 — Gráfico de evolução */}
            <section className="rounded-2xl border border-border/40 bg-card p-5 shadow-card">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Evolução do saldo (últimos 12 meses)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Saldo acumulado, depósitos mensais e marcadores de saque
                  </p>
                </div>
                <p className="num text-sm font-semibold text-primary">{formatBRL(total)}</p>
              </div>
              {chartData.length === 0 ? (
                <div className="flex h-60 items-center justify-center text-xs text-muted-foreground">
                  Sem lançamentos registrados ainda.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ left: -10, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="fgtsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="oklch(0.68 0.11 158)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="oklch(0.68 0.11 158)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.3 0.01 200)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "oklch(0.6 0.02 200)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "oklch(0.6 0.02 200)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        cursor={{
                          stroke: "oklch(0.68 0.11 158)",
                          strokeWidth: 1,
                          strokeDasharray: "3 3",
                        }}
                        contentStyle={{
                          background: "oklch(0.18 0.01 200)",
                          border: "1px solid oklch(0.3 0.01 200)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(v: number, name: string) => {
                          const labels: Record<string, string> = {
                            balance: "Saldo",
                            deposito: "Depósito",
                            jam: "JAM",
                            saque: "Saque",
                          };
                          return [formatBRL(v), labels[name] ?? name];
                        }}
                      />
                      {withdrawalMonths.map((m) => (
                        <ReferenceLine
                          key={m}
                          x={m}
                          stroke="oklch(0.6 0.2 25)"
                          strokeDasharray="4 3"
                          strokeWidth={1.2}
                        />
                      ))}
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="oklch(0.68 0.11 158)"
                        strokeWidth={2}
                        fill="url(#fgtsGrad)"
                      />
                      <Bar dataKey="deposito" fill="oklch(0.65 0.13 158)" radius={[4, 4, 0, 0]} barSize={14} />
                      <Line
                        type="monotone"
                        dataKey="jam"
                        stroke="oklch(0.78 0.15 90)"
                        strokeWidth={1.5}
                        dot={{ r: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* SEÇÃO 7 — Histórico de lançamentos */}
            <section className="rounded-2xl border border-border/40 bg-card p-5 shadow-card">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Histórico de lançamentos
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {filtered.length} lançamento{filtered.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-success">
                    Depósitos: <span className="num font-semibold">{formatBRL(totals.dep)}</span>
                  </span>
                  <span className="text-warning">
                    JAM: <span className="num font-semibold">{formatBRL(totals.jam)}</span>
                  </span>
                  <span className="text-destructive">
                    Saques: <span className="num font-semibold">{formatBRL(totals.saq)}</span>
                  </span>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(["all", "deposito", "jam", "saque"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={filterType === t ? "default" : "outline"}
                    className="rounded-full text-xs"
                    onClick={() => {
                      setFilterType(t);
                      setPage(1);
                    }}
                  >
                    {t === "all"
                      ? "Todos"
                      : t === "deposito"
                        ? "Depósitos"
                        : t === "jam"
                          ? "JAM"
                          : "Saques"}
                  </Button>
                ))}
                <div className="relative ml-auto w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por descrição ou data..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 rounded-full pl-8 text-xs"
                  />
                </div>
              </div>

              {pageItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum lançamento encontrado.
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {pageItems.map((e) => {
                    const meta = entryMeta[e.entry_type];
                    const Icon = meta.icon;
                    const v = Number(e.amount);
                    return (
                      <li key={e.id} className="flex items-center gap-4 py-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/10",
                            meta.color,
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {e.notes || meta.label}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0 text-[9px] uppercase tracking-wider",
                                meta.color,
                              )}
                            >
                              {meta.label}
                            </Badge>
                          </div>
                          <p className="num mt-0.5 text-[11px] text-muted-foreground">
                            {formatDatePT(e.occurred_at)}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "num shrink-0 text-sm font-semibold tabular-nums",
                            meta.sign === 1 ? "text-success" : "text-destructive",
                          )}
                        >
                          {meta.sign === 1 ? "+" : "−"}
                          {formatBRL(v)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

type Tone = "primary" | "success" | "warning" | "destructive" | "muted";

const toneStyles: Record<Tone, { icon: string; iconBg: string; value: string }> = {
  primary: {
    icon: "text-primary",
    iconBg: "border-primary/30 bg-emerald-soft",
    value: "text-foreground",
  },
  success: {
    icon: "text-success",
    iconBg: "border-success/30 bg-success/10",
    value: "text-success",
  },
  warning: {
    icon: "text-warning",
    iconBg: "border-warning/30 bg-warning/10",
    value: "text-warning",
  },
  destructive: {
    icon: "text-destructive",
    iconBg: "border-destructive/30 bg-destructive/10",
    value: "text-destructive",
  },
  muted: {
    icon: "text-muted-foreground",
    iconBg: "border-border/40 bg-muted/20",
    value: "text-foreground",
  },
};

function HeroCard({
  label,
  value,
  icon: Icon,
  tone,
  big,
}: {
  label: string;
  value: string;
  icon: typeof Circle;
  tone: Tone;
  big?: boolean;
}) {
  const s = toneStyles[tone];
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border",
            s.iconBg,
          )}
        >
          <Icon className={cn("h-4 w-4", s.icon)} strokeWidth={1.75} />
        </div>
      </div>
      <p
        className={cn(
          "num mt-3 font-bold tracking-tight tabular-nums",
          big ? "text-3xl" : "text-2xl",
          s.value,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MiniCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Circle;
  tone: Tone;
}) {
  const s = toneStyles[tone];
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", s.icon)} />
        {label}
      </div>
      <p className={cn("num mt-2 text-xl font-semibold tabular-nums", s.value)}>{value}</p>
    </div>
  );
}

function AnalysisItem({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Circle;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/5 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={cn("num mt-2 text-lg font-semibold tracking-tight", accent ?? "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
