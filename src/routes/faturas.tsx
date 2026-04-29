import { createFileRoute } from "@tanstack/react-router";
import { Upload, FileText, CheckCircle2, Clock, Sparkles, Download, MoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { invoices } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/faturas")({
  head: () => ({
    meta: [
      { title: "Faturas — Thaigo Finance AI" },
      { name: "description", content: "Faturas dos cartões de crédito e upload inteligente de PDFs." },
    ],
  }),
  component: FaturasPage,
});

function FaturasPage() {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<{ name: string; size: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).map((f) => ({
      name: f.name,
      size: `${(f.size / 1024).toFixed(0)} KB`,
    }));
    setFiles((prev) => [...arr, ...prev]);
  };

  return (
    <>
      <AppHeader title="Faturas" subtitle="Cartões de crédito · Importação inteligente" />
      <main className="flex-1 space-y-8 p-4 md:p-8">
        {/* Upload zone — premium */}
        <section
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
            "relative overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300",
            dragOver
              ? "border-primary/60 bg-emerald-soft"
              : "border-border/40 bg-card hover:border-border/70",
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-50" />
          <div className="relative mx-auto flex max-w-xl flex-col items-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-emerald-soft">
              <Upload className="h-6 w-6 text-primary" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Importe sua fatura em PDF</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Arraste o arquivo aqui ou selecione manualmente. A IA classifica automaticamente cada
              lançamento por categoria, detecta duplicidades e identifica gastos recorrentes.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => inputRef.current?.click()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="mr-1.5 h-4 w-4" /> Selecionar PDF
              </Button>
              <Button variant="outline" className="border-border/60 bg-transparent">
                <Sparkles className="mr-1.5 h-4 w-4 text-primary" /> Importar do email
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="mt-6 flex items-center gap-6 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success" /> Criptografia AES-256
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-success" /> Suporta Nubank, Itaú, BTG
              </span>
            </div>
          </div>
        </section>

        {/* Files queue */}
        {files.length > 0 && (
          <section className="rounded-2xl border border-border/40 bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Arquivos selecionados</h3>
            <div className="mt-3 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                  <FileText className="h-4 w-4 text-primary" strokeWidth={1.75} />
                  <div className="flex-1 text-sm">{f.name}</div>
                  <span className="text-xs text-muted-foreground">{f.size}</span>
                  <Badge className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/15">
                    Processando
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Invoice list */}
        <section className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border/40 p-6">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Faturas recentes</h3>
              <p className="mt-1 text-xs text-muted-foreground">Histórico em aberto e quitadas</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs">
              Ver tudo
            </Button>
          </div>
          <div className="divide-y divide-border/40">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-accent/15"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-muted/20">
                    <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{inv.card}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {inv.month} · {inv.items} lançamentos · vence {inv.dueDate}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="num text-sm font-semibold">{formatBRL(inv.amount)}</span>
                  {inv.status === "paid" ? (
                    <Badge className="border-success/30 bg-success/10 text-success hover:bg-success/15">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Paga
                    </Badge>
                  ) : (
                    <Badge className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/15">
                      <Clock className="mr-1 h-3 w-3" /> Em aberto
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
