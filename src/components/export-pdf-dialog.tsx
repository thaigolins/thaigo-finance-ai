import { useState } from "react";
import { Download, FileText, Sparkles, Loader2 } from "lucide-react";
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
import { generatePdf, buildPayload, type PdfKind } from "@/lib/pdf-export";

const PERIODS = [
  "Abril/2026",
  "Março/2026",
  "Fevereiro/2026",
  "Janeiro/2026",
  "Últimos 30 dias",
  "Últimos 90 dias",
  "Ano de 2026",
];

type Props = {
  module: string;
  trigger?: React.ReactNode;
  defaultFilters?: string[];
  filterOptions?: { label: string; values: string[] }[];
};

export function ExportPdfDialog({ module, trigger, defaultFilters = [], filterOptions }: Props) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [kind, setKind] = useState<PdfKind>("simples");
  const [filterText, setFilterText] = useState(defaultFilters.join(", "));
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const filters = [
        ...filterText
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
        ...Object.entries(extra)
          .filter(([, v]) => v && v !== "all")
          .map(([k, v]) => `${k}: ${v}`),
      ];
      const payload = buildPayload(module, period, filters);
      // Tiny delay to let UI show loading
      await new Promise((r) => setTimeout(r, 300));
      generatePdf(payload, kind);
      setOpen(false);
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
            Configure período, filtros e o tipo de relatório.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Período
            </Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="border-border/60 bg-muted/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                  Operacional. Direto ao ponto: tabela, totais e data de emissão.
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
                  Executivo. Capa, índice, gráficos, insights e recomendações.
                </p>
              </button>
            </div>
          </div>
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
