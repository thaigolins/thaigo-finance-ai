import { useState } from "react";
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
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  confirmPendingAction,
  discardPendingAction,
} from "@/server/document-extraction.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function previewRows(action: PendingActionData): { label: string; value: string }[] {
  const p = action.payload;
  const rows: { label: string; value: string }[] = [];
  switch (action.kind) {
    case "fatura":
      rows.push({ label: "Cartão", value: `${String(p.card_brand ?? "—")} **** ${String(p.card_last_digits ?? "—")}` });
      rows.push({ label: "Mês ref.", value: String(p.reference_month ?? "—").slice(0, 7) });
      rows.push({ label: "Vencimento", value: String(p.due_date ?? "—") });
      rows.push({ label: "Total", value: fmtCurrency(p.total_amount) });
      rows.push({ label: "Lançamentos", value: String((p.transactions as unknown[] | undefined)?.length ?? 0) });
      break;
    case "extrato":
      rows.push({ label: "Banco", value: String(p.bank ?? "—") });
      rows.push({ label: "Período", value: `${String(p.period_from ?? "—")} → ${String(p.period_to ?? "—")}` });
      rows.push({ label: "Saldo final", value: fmtCurrency(p.closing_balance) });
      rows.push({ label: "Lançamentos", value: String((p.transactions as unknown[] | undefined)?.length ?? 0) });
      break;
    case "fgts":
      rows.push({ label: "Empregador", value: String(p.employer ?? "—") });
      rows.push({ label: "Status", value: String(p.status ?? "—") });
      rows.push({ label: "Saldo", value: fmtCurrency(p.balance) });
      rows.push({ label: "Depósito mensal", value: fmtCurrency(p.monthly_deposit) });
      rows.push({ label: "JAM", value: fmtCurrency(p.jam_month) });
      break;
    case "emprestimo":
      rows.push({ label: "Instituição", value: String(p.institution ?? "—") });
      rows.push({ label: "Saldo devedor", value: fmtCurrency(p.current_balance) });
      rows.push({ label: "Parcela", value: fmtCurrency(p.monthly_payment) });
      rows.push({ label: "Parcelas", value: `${String(p.installments_paid ?? 0)}/${String(p.installments_total ?? 0)}` });
      rows.push({ label: "Taxa", value: `${String(p.interest_rate ?? "—")}%` });
      break;
    case "contracheque":
      rows.push({ label: "Empregador", value: String(p.employer ?? "—") });
      rows.push({ label: "Mês ref.", value: String(p.reference_month ?? "—").slice(0, 7) });
      rows.push({ label: "Bruto", value: fmtCurrency(p.gross_amount) });
      rows.push({ label: "Líquido", value: fmtCurrency(p.net_amount) });
      rows.push({ label: "INSS", value: fmtCurrency(p.inss) });
      rows.push({ label: "IRRF", value: fmtCurrency(p.irrf) });
      break;
  }
  return rows;
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
  const confirmFn = useServerFn(confirmPendingAction);
  const discardFn = useServerFn(discardPendingAction);

  const cfg = kindConfig[action.kind];
  const Icon = cfg.icon;
  const rows = previewRows(action);

  const handleConfirm = async () => {
    setBusy("confirm");
    try {
      const r = await confirmFn({ data: { pendingId: action.pendingId } });
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
            : "border-primary/30",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-emerald-soft text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/30 bg-emerald-soft text-[10px] uppercase tracking-wider text-primary"
            >
              <Sparkles className="mr-1 h-2.5 w-2.5" /> Sugestão da IA
            </Badge>
            <span className="text-[11px] font-medium text-muted-foreground">{cfg.label}</span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-foreground">{action.summary}</p>

          <button
            type="button"
            onClick={() => setOpen((s) => !s)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {open ? "Esconder prévia" : "Ver prévia dos dados"}
          </button>

          {open && (
            <div className="mt-2 grid grid-cols-1 gap-1.5 rounded-xl border border-border/30 bg-muted/10 p-3 text-[11px] sm:grid-cols-2">
              {rows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-2 sm:block">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.label}
                  </span>
                  <span className="font-medium text-foreground sm:block">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {!done && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={busy !== null}
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {busy === "confirm" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Confirmar e gravar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDiscard}
                disabled={busy !== null}
                className="h-8 border-border/40"
              >
                {busy === "discard" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                )}
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
