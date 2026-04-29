import { Link } from "@tanstack/react-router";
import { Wallet, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type ImportSessionSummary = {
  sessionId: string;
  totalCount: number;
  duplicateCount: number;
  totalCredits: number;
  totalDebits: number;
  net: number;
  bankHint?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ImportSessionCard({ data }: { data: ImportSessionSummary }) {
  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-primary/30 bg-emerald-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-card">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {data.bankHint ?? "Extrato bancário"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {data.periodStart && data.periodEnd
                ? `${data.periodStart} → ${data.periodEnd}`
                : "Período não identificado"}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {data.totalCount} lançamentos
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Créditos</p>
          <p className="font-semibold text-success">{fmt(data.totalCredits)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Débitos</p>
          <p className="font-semibold text-destructive">{fmt(data.totalDebits)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Líquido</p>
          <p className={data.net >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
            {fmt(data.net)}
          </p>
        </div>
      </div>

      {data.duplicateCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {data.duplicateCount} possível(eis) duplicata(s) detectada(s).
        </div>
      )}

      <Button asChild size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        <Link to="/import/review/$id" params={{ id: data.sessionId }}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Revisar e confirmar lançamentos
        </Link>
      </Button>
    </div>
  );
}
