import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Receipt,
  Landmark,
  Banknote,
  FileText,
  Wallet,
  AlertTriangle,
  Pencil,
  ListChecks,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  confirmPendingAction,
  discardPendingAction,
  checkDuplicate,
} from "@/server/document-extraction.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type PendingActionData = {
  pendingId: string;
  kind: "fatura" | "extrato" | "fgts" | "emprestimo" | "contracheque";
  summary: string;
  payload: Record<string, unknown>;
};

const kindConfig: Record<
  PendingActionData["kind"],
  { label: string; icon: typeof Receipt }
> = {
  fatura: { label: "Fatura de cartão", icon: Receipt },
  extrato: { label: "Extrato bancário", icon: Wallet },
  fgts: { label: "Conta FGTS", icon: Banknote },
  emprestimo: { label: "Empréstimo / Dívida", icon: Landmark },
  contracheque: { label: "Contracheque", icon: FileText },
};

const fmtCurrency = (n: unknown) =>
  typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

type Tx = Record<string, unknown>;

// Campos editáveis por tipo (label + key + tipo)
type EditField = { key: string; label: string; type: "text" | "number" | "date" | "month" };

const editFieldsByKind: Record<PendingActionData["kind"], EditField[]> = {
  fatura: [
    { key: "card_brand", label: "Bandeira", type: "text" },
    { key: "card_last_digits", label: "Últimos 4 dígitos", type: "text" },
    { key: "reference_month", label: "Mês ref.", type: "month" },
    { key: "due_date", label: "Vencimento", type: "date" },
    { key: "total_amount", label: "Total", type: "number" },
  ],
  extrato: [
    { key: "bank", label: "Banco", type: "text" },
    { key: "account_number", label: "Conta", type: "text" },
    { key: "period_from", label: "Período de", type: "date" },
    { key: "period_to", label: "Período até", type: "date" },
    { key: "closing_balance", label: "Saldo final", type: "number" },
  ],
  fgts: [
    { key: "employer", label: "Empregador", type: "text" },
    { key: "cnpj", label: "CNPJ", type: "text" },
    { key: "status", label: "Status (ativa/inativa)", type: "text" },
    { key: "balance", label: "Saldo", type: "number" },
    { key: "monthly_deposit", label: "Depósito mensal", type: "number" },
    { key: "jam_month", label: "JAM", type: "number" },
  ],
  emprestimo: [
    { key: "institution", label: "Instituição", type: "text" },
    { key: "debt_type", label: "Tipo", type: "text" },
    { key: "current_balance", label: "Saldo devedor", type: "number" },
    { key: "monthly_payment", label: "Parcela", type: "number" },
    { key: "interest_rate", label: "Taxa %", type: "number" },
    { key: "cet", label: "CET %", type: "number" },
    { key: "status", label: "Status", type: "text" },
  ],
  contracheque: [
    { key: "employer", label: "Empregador", type: "text" },
    { key: "reference_month", label: "Mês ref.", type: "month" },
    { key: "gross_amount", label: "Bruto", type: "number" },
    { key: "net_amount", label: "Líquido", type: "number" },
    { key: "inss", label: "INSS", type: "number" },
    { key: "irrf", label: "IRRF", type: "number" },
    { key: "fgts_amount", label: "FGTS", type: "number" },
  ],
};

function toInputValue(v: unknown, type: EditField["type"]): string {
  if (v == null) return "";
  if (type === "month") return String(v).slice(0, 7);
  if (type === "date") return String(v).slice(0, 10);
  return String(v);
}

function fromInputValue(s: string, type: EditField["type"]): unknown {
  if (s === "") return null;
  if (type === "number") {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "month") return `${s}-01`;
  return s;
}

export function PendingActionCard({
  action,
  onResolved,
}: {
  action: PendingActionData;
  onResolved?: (kind: "confirmed" | "discarded") => void;
}) {
  const [busy, setBusy] = useState<"confirm" | "discard" | null>(null);
  const [done, setDone] = useState<"confirmed" | "discarded" | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showTxs, setShowTxs] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [duplicates, setDuplicates] = useState<{ reason: string }[]>([]);
  const [dupChecked, setDupChecked] = useState(false);

  const confirmFn = useServerFn(confirmPendingAction);
  const discardFn = useServerFn(discardPendingAction);
  const dupFn = useServerFn(checkDuplicate);

  const cfg = kindConfig[action.kind];
  const Icon = cfg.icon;
  const fields = editFieldsByKind[action.kind];

  // payload combinado (originais + overrides)
  const merged = useMemo(
    () => ({ ...action.payload, ...overrides }) as Record<string, unknown>,
    [action.payload, overrides],
  );

  // Lista de lançamentos (fatura/extrato)
  const txs = useMemo<Tx[]>(() => {
    const raw = merged.transactions;
    return Array.isArray(raw) ? (raw as Tx[]) : [];
  }, [merged]);
  const hasTxs = action.kind === "fatura" || action.kind === "extrato";

  const [selectedTx, setSelectedTx] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    // por padrão: todos selecionados
    setSelectedTx(new Set(txs.map((_, i) => i)));
  }, [txs]);

  // Verifica duplicidade quando abre o card
  useEffect(() => {
    let cancelled = false;
    if (done) return;
    (async () => {
      try {
        const r = await dupFn({ data: { pendingId: action.pendingId } });
        if (!cancelled && r.ok) {
          setDuplicates(r.duplicates.map((d) => ({ reason: d.reason })));
          setDupChecked(true);
        }
      } catch {
        if (!cancelled) setDupChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [action.pendingId, dupFn, done]);

  const allSelected = txs.length > 0 && selectedTx.size === txs.length;
  const noneSelected = selectedTx.size === 0;

  const toggleAll = () => {
    if (allSelected) setSelectedTx(new Set());
    else setSelectedTx(new Set(txs.map((_, i) => i)));
  };
  const toggleOne = (i: number) => {
    setSelectedTx((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  };

  const handleConfirm = async () => {
    setBusy("confirm");
    try {
      // Se editou lançamentos, envia seleção parcial só se diferente do total
      const ovr: Record<string, unknown> = { ...overrides };
      let selectedIndices: number[] | undefined;
      if (hasTxs && txs.length > 0 && !allSelected) {
        selectedIndices = Array.from(selectedTx).sort((a, b) => a - b);
      }
      const r = await confirmFn({
        data: {
          pendingId: action.pendingId,
          overrides: Object.keys(ovr).length > 0 ? ovr : undefined,
          selectedTxIndices: selectedIndices,
          ignoreDuplicate: duplicates.length > 0,
        },
      });
      if (r.ok) {
        toast.success(r.summary || "Dados gravados com sucesso");
        setDone("confirmed");
        onResolved?.("confirmed");
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao confirmar");
    } finally {
      setBusy(null);
    }
  };

  const handleDiscard = async () => {
    setBusy("discard");
    try {
      const r = await discardFn({ data: { pendingId: action.pendingId } });
      if (r.ok) {
        toast.message("Sugestão descartada");
        setDone("discarded");
        onResolved?.("discarded");
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao descartar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={cn(
        "mt-3 rounded-2xl border bg-card/60 p-4 shadow-card",
        done === "confirmed"
          ? "border-success/40 bg-success/5"
          : done === "discarded"
            ? "border-border/30 opacity-60"
            : duplicates.length > 0
              ? "border-amber-500/40"
              : "border-primary/30",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-emerald-soft text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-emerald-soft text-[10px] uppercase tracking-wider text-primary">
              <Sparkles className="mr-1 h-2.5 w-2.5" /> Sugestão da IA
            </Badge>
            <span className="text-[11px] font-medium text-muted-foreground">{cfg.label}</span>
            {dupChecked && duplicates.length > 0 && !done && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mr-1 h-2.5 w-2.5" /> Possível duplicidade
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm font-medium text-foreground">{action.summary}</p>

          {duplicates.length > 0 && !done && (
            <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
              <div className="font-medium">Já existe registro parecido:</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {duplicates.map((d, i) => <li key={i}>{d.reason}</li>)}
              </ul>
              <div className="mt-1.5 text-amber-600/80 dark:text-amber-400/80">
                Você ainda pode confirmar — mas verifique para evitar duplicar.
              </div>
            </div>
          )}

          {!done && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => { setOpen((s) => !s); }}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {open ? "Esconder prévia" : "Ver prévia dos dados"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing((s) => !s); setOpen(true); }}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                {editing ? "Concluir edição" : "Editar campos"}
              </button>
              {hasTxs && txs.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setShowTxs((s) => !s); setOpen(true); }}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ListChecks className="h-3 w-3" />
                  {showTxs ? "Esconder lançamentos" : `Selecionar lançamentos (${selectedTx.size}/${txs.length})`}
                </button>
              )}
            </div>
          )}

          {open && (
            <div className="mt-2 space-y-3">
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/30 bg-muted/10 p-3 sm:grid-cols-2">
                {fields.map((f) => {
                  const value = toInputValue(merged[f.key], f.type);
                  if (!editing) {
                    const display =
                      f.type === "number" && typeof merged[f.key] === "number"
                        ? fmtCurrency(merged[f.key])
                        : value || "—";
                    return (
                      <div key={f.key}>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</div>
                        <div className="text-[12px] font-medium text-foreground">{display}</div>
                      </div>
                    );
                  }
                  return (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {f.label}
                      </Label>
                      <Input
                        type={f.type === "number" ? "number" : f.type === "month" ? "month" : f.type === "date" ? "date" : "text"}
                        step={f.type === "number" ? "0.01" : undefined}
                        value={value}
                        onChange={(e) =>
                          setOverrides((prev) => ({ ...prev, [f.key]: fromInputValue(e.target.value, f.type) }))
                        }
                        className="h-8 text-[12px]"
                      />
                    </div>
                  );
                })}
              </div>

              {hasTxs && showTxs && txs.length > 0 && (
                <div className="rounded-xl border border-border/30 bg-muted/10">
                  <div className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allSelected ? true : noneSelected ? false : "indeterminate"}
                        onCheckedChange={toggleAll}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {selectedTx.size} de {txs.length} selecionados
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTx(new Set(txs.map((_, i) => i)))}
                        className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      >
                        Todos
                      </button>
                      <span className="text-muted-foreground/50">·</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTx(new Set())}
                        className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                      >
                        Nenhum
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 bg-card/80 backdrop-blur">
                        <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="w-8 px-3 py-2"></th>
                          <th className="px-2 py-2">Data</th>
                          <th className="px-2 py-2">Descrição</th>
                          <th className="px-2 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txs.map((t, i) => {
                          const checked = selectedTx.has(i);
                          return (
                            <tr
                              key={i}
                              className={cn(
                                "border-t border-border/20",
                                !checked && "opacity-50",
                              )}
                            >
                              <td className="px-3 py-1.5">
                                <Checkbox checked={checked} onCheckedChange={() => toggleOne(i)} />
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground">{String(t.occurred_at ?? "—").slice(0, 10)}</td>
                              <td className="px-2 py-1.5 text-foreground">{String(t.description ?? "—")}</td>
                              <td className="px-2 py-1.5 text-right font-medium text-foreground">{fmtCurrency(t.amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {!done && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={busy !== null || (hasTxs && txs.length > 0 && noneSelected && !editing)}
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {busy === "confirm" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                {hasTxs && !allSelected && txs.length > 0
                  ? `Confirmar ${selectedTx.size} selecionados`
                  : "Confirmar e gravar"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDiscard}
                disabled={busy !== null}
                className="h-8 border-border/40"
              >
                {busy === "discard" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1.5 h-3.5 w-3.5" />}
                Descartar
              </Button>
            </div>
          )}
          {done === "confirmed" && (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-success">
              <CheckCircle2 className="h-3 w-3" /> Dados gravados no seu app
            </p>
          )}
          {done === "discarded" && (
            <p className="mt-2 text-[11px] text-muted-foreground">Sugestão descartada</p>
          )}
        </div>
      </div>
    </div>
  );
}
