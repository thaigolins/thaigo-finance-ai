import { useState } from "react";
import { Download, FileText, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { generatePdf, type PdfKind } from "@/lib/pdf-export";
import {
  PERIOD_OPTIONS,
  resolvePeriod,
  buildRealPayload,
  moduleSlug,
  type PeriodKey,
  type ReportModule,
} from "@/lib/report-builders";
import { uploadBlob } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Props = {
  module: ReportModule | string;
  trigger?: React.ReactNode;
  defaultFilters?: string[];
  filterOptions?: { label: string; values: string[] }[];
};

export function ExportPdfDialog({
  module,
  trigger,
  defaultFilters = [],
  filterOptions,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("current_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [kind, setKind] = useState<PdfKind>("simples");
  const [filterText, setFilterText] = useState(defaultFilters.join(", "));
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  const handleGenerate = async () => {
    if (!user?.id) {
      toast.error("Você precisa estar autenticado.");
      return;
    }
    setLoading(true);
    setStatus("idle");
    try {
      const range = resolvePeriod(period, { from: customFrom, to: customTo });
      const filters = [
        ...filterText
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
        ...Object.entries(extra)
          .filter(([, v]) => v && v !== "all")
          .map(([k, v]) => `${k}: ${v}`),
      ];

      const payload = await buildRealPayload(
        module as ReportModule,
        range,
        filters,
        user.id,
      );

      // Generate PDF (also auto-downloads locally)
      const { blob, filename } = generatePdf(payload, kind, { autoDownload: true });

      // Upload to private bucket
      const { path } = await uploadBlob({
        bucket: "reports",
        userId: user.id,
        blob,
        filename,
        contentType: "application/pdf",
      });

      // Register in reports table
      const { error: insErr } = await supabase.from("reports").insert({
        user_id: user.id,
        module: moduleSlug(module as ReportModule),
        title: payload.title,
        period: range.label,
        kind: kind === "private" ? "private" : "simples",
        filters: { items: filters, periodKey: period, from: range.from.toISOString(), to: range.to.toISOString() },
        pdf_path: path,
      });
      if (insErr) throw insErr;

      qc.invalidateQueries({ queryKey: ["reports", user.id] });
      setStatus("ok");
      toast.success("PDF gerado, baixado e arquivado.");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 900);
    } catch (e) {
      console.error(e);
      setStatus("err");
      toast.error("Falha ao gerar PDF. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="border-border/60">
            <Download className="mr-1.5 h-4 w-4" /> Exportar PDF
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg border-border/40 bg-card">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">
            Exportar {module} em PDF
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure período, filtros e o tipo de relatório. O arquivo será baixado e arquivado em sua conta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Período
            </Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="border-border/60 bg-muted/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {period === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border-border/60 bg-muted/20 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border-border/60 bg-muted/20 text-sm"
                />
              </div>
            </div>
          )}

          {filterOptions?.map((f) => (
            <div key={f.label} className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {f.label}
              </Label>
              <Select
                value={extra[f.label] ?? "all"}
                onValueChange={(v) => setExtra((s) => ({ ...s, [f.label]: v }))}
              >
                <SelectTrigger className="border-border/60 bg-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {f.values.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Filtros adicionais (separe por vírgula)
            </Label>
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="ex: Categoria: Alimentação, Conta: Itaú"
              className="border-border/60 bg-muted/20 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Tipo de relatório
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind("simples")}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  kind === "simples"
                    ? "border-primary/60 bg-emerald-soft"
                    : "border-border/40 bg-muted/10 hover:border-border/80",
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">PDF Simples</span>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Operacional. Tabela, totais e data de emissão.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setKind("private")}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  kind === "private"
                    ? "border-primary/60 bg-emerald-soft"
                    : "border-border/40 bg-muted/10 hover:border-border/80",
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">PDF Private</span>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Capa, índice, KPIs, insights e recomendações.
                </p>
              </button>
            </div>
          </div>

          {status === "ok" && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-emerald-soft px-3 py-2 text-xs text-primary">
              <CheckCircle2 className="h-4 w-4" /> PDF gerado e arquivado com sucesso.
            </div>
          )}
          {status === "err" && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4" /> Falha ao gerar. Verifique sua conexão.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-4 w-4" /> Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
