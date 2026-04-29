import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart, FileText, Sparkles, Download, Loader2 } from "lucide-react";
import { ExportPdfDialog } from "@/components/export-pdf-dialog";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useUserList } from "@/lib/queries";
import { getSignedUrl } from "@/lib/storage";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Thaigo Finance AI" },
      { name: "description", content: "Relatórios financeiros gerados e arquivados." },
    ],
  }),
  component: RelatoriosPage,
});

type ReportRow = {
  id: string;
  module: string;
  title: string;
  period: string;
  kind: "simples" | "private";
  pdf_path: string | null;
  created_at: string;
};

const moduleLabel: Record<string, string> = {
  dashboard: "Dashboard",
  financeiro: "Financeiro",
  cartoes: "Cartões",
  faturas: "Faturas",
  extratos: "Extratos",
  recorrentes: "Recorrentes",
  metas: "Metas",
  investimentos: "Investimentos",
  dividas: "Empréstimos & Dívidas",
  fgts: "FGTS",
  relatorios: "Relatórios",
};

function RelatoriosPage() {
  const { data: reports = [], isLoading } = useUserList<ReportRow>("reports", {
    orderBy: "created_at",
    ascending: false,
  });
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (r: ReportRow) => {
    if (!r.pdf_path) return;
    setDownloading(r.id);
    try {
      const url = await getSignedUrl("reports", r.pdf_path, 60 * 5);
      window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível abrir o arquivo.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <AppHeader title="Relatórios" subtitle="Histórico" exportModule="Relatórios" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Central de Relatórios</h2>
            <p className="text-sm text-muted-foreground">
              Gere PDFs Simples ou Private de qualquer módulo. Cada arquivo é baixado e arquivado em sua conta.
            </p>
          </div>
          <ExportPdfDialog module="Relatórios" />
        </div>

        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <FileBarChart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Relatórios arquivados</h3>
              <p className="text-xs text-muted-foreground">
                Todos os PDFs gerados ficam salvos com segurança e acessíveis a qualquer momento.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={FileBarChart}
              title="Nenhum relatório gerado"
              description="Use o botão Exportar PDF em qualquer módulo para gerar seu primeiro relatório financeiro."
            />
          ) : (
            <div className="divide-y divide-border/40">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        r.kind === "private"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {r.kind === "private" ? (
                        <Sparkles className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {moduleLabel[r.module] ?? r.module} · {r.period} ·{" "}
                        {new Date(r.created_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border/60"
                    onClick={() => download(r)}
                    disabled={!r.pdf_path || downloading === r.id}
                  >
                    {downloading === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
