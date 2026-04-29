import { createFileRoute } from "@tanstack/react-router";
import {
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  Trash2,
  Plus,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { FormDialog } from "@/components/form-dialog";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUserList, useUserInsert, useUserDelete, useUserUpdate } from "@/lib/queries";
import { uploadFile, getSignedUrl } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/faturas")({
  head: () => ({
    meta: [
      { title: "Faturas — Thaigo Finance AI" },
      { name: "description", content: "Faturas dos cartões de crédito e upload inteligente de PDFs." },
    ],
  }),
  component: FaturasPage,
});

type Card = { id: string; name: string; brand: string; last_digits: string | null };
type Invoice = {
  id: string;
  credit_card_id: string;
  reference_month: string;
  due_date: string;
  total_amount: number;
  status: "open" | "closed" | "paid" | "overdue";
  pdf_path: string | null;
  created_at: string;
};

const statusLabels: Record<Invoice["status"], { label: string; cls: string; icon: typeof Clock }> = {
  open: { label: "Aberta", cls: "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15", icon: Clock },
  closed: { label: "Fechada", cls: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15", icon: FileText },
  paid: { label: "Paga", cls: "border-success/30 bg-success/10 text-success hover:bg-success/15", icon: CheckCircle2 },
  overdue: { label: "Vencida", cls: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15", icon: AlertCircle },
};

const invoiceSchema = z.object({
  credit_card_id: z.string().min(1, "Cartão obrigatório"),
  reference_month: z.string().min(1, "Mês de referência obrigatório"),
  due_date: z.string().min(1, "Vencimento obrigatório"),
  total_amount: z.number({ invalid_type_error: "Valor inválido" }),
  status: z.enum(["open", "closed", "paid", "overdue"]),
});
type InvoiceForm = z.infer<typeof invoiceSchema>;

function FaturasPage() {
  const { user } = useAuth();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: cards = [] } = useUserList<Card>("credit_cards", { orderBy: "created_at" });
  const { data: invoices = [], isLoading } = useUserList<Invoice>("invoices", {
    orderBy: "due_date",
  });
  const insertInvoice = useUserInsert<Record<string, unknown>>("invoices");
  const updateInvoice = useUserUpdate<Record<string, unknown>>("invoices");
  const insertFile = useUserInsert<Record<string, unknown>>("uploaded_files");
  const removeInvoice = useUserDelete("invoices");

  const cardOptions = cards.map((c) => ({
    value: c.id,
    label: `${c.name}${c.last_digits ? ` ····${c.last_digits}` : ""}`,
  }));

  const cardById = (id: string) => cards.find((c) => c.id === id);

  const handleFiles = async (list: FileList | null) => {
    if (!list || !user?.id) return;
    if (cards.length === 0) {
      toast.error("Cadastre um cartão antes de importar faturas.");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        if (file.type !== "application/pdf") {
          toast.error(`${file.name}: apenas PDF é aceito.`);
          continue;
        }
        const up = await uploadFile({ bucket: "invoices", userId: user.id, file });
        // Cria fatura placeholder vinculada ao primeiro cartão (usuário pode editar depois)
        const today = new Date();
        const refMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
        const dueDate = new Date(today.getFullYear(), today.getMonth(), 10).toISOString().slice(0, 10);
        const inv = await insertInvoice.mutateAsync({
          credit_card_id: cards[0].id,
          reference_month: refMonth,
          due_date: dueDate,
          total_amount: 0,
          status: "open",
          pdf_path: up.path,
        });
        await insertFile.mutateAsync({
          bucket: "invoices",
          path: up.path,
          filename: up.filename,
          mime_type: up.mime,
          size_bytes: up.size,
          kind: "invoice_pdf",
          related_table: "invoices",
          related_id: (inv as { id: string }).id,
        });
        toast.success(`${file.name} importada — ajuste os dados se necessário.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const downloadInvoice = async (inv: Invoice) => {
    if (!inv.pdf_path) {
      toast.error("Esta fatura não tem PDF anexado.");
      return;
    }
    try {
      const url = await getSignedUrl("invoices", inv.pdf_path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o PDF");
    }
  };

  const cycleStatus = async (inv: Invoice) => {
    const order: Invoice["status"][] = ["open", "closed", "paid", "overdue"];
    const next = order[(order.indexOf(inv.status) + 1) % order.length];
    await updateInvoice.mutateAsync({ id: inv.id, values: { status: next } });
  };

  const formatMonth = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
  };

  return (
    <>
      <AppHeader title="Faturas" subtitle="Cartões de crédito · Importação inteligente" exportModule="Faturas" />
      <main className="flex-1 space-y-8 p-4 md:p-8">
        {/* Upload zone */}
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
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <Upload className="h-6 w-6 text-primary" strokeWidth={1.75} />
              )}
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Importe sua fatura em PDF</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Arraste o arquivo aqui ou selecione manualmente. O PDF é armazenado com criptografia e
              vinculado ao cartão escolhido.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="mr-1.5 h-4 w-4" /> Selecionar PDF
              </Button>
              <FormDialog<InvoiceForm>
                title="Nova fatura"
                description="Cadastre uma fatura manualmente"
                trigger={
                  <Button variant="outline" className="border-border/60 bg-transparent">
                    <Plus className="mr-1.5 h-4 w-4" /> Cadastrar manual
                  </Button>
                }
                schema={invoiceSchema}
                defaultValues={{
                  credit_card_id: cards[0]?.id ?? "",
                  reference_month: new Date().toISOString().slice(0, 10),
                  due_date: new Date().toISOString().slice(0, 10),
                  total_amount: 0,
                  status: "open",
                }}
                fields={[
                  { name: "credit_card_id", label: "Cartão", type: "select", options: cardOptions },
                  { name: "reference_month", label: "Mês de referência", type: "date" },
                  { name: "due_date", label: "Vencimento", type: "date" },
                  { name: "total_amount", label: "Valor total (R$)", type: "number", step: "0.01" },
                  {
                    name: "status",
                    label: "Status",
                    type: "select",
                    options: [
                      { value: "open", label: "Aberta" },
                      { value: "closed", label: "Fechada" },
                      { value: "paid", label: "Paga" },
                      { value: "overdue", label: "Vencida" },
                    ],
                  },
                ]}
                onSubmit={async (v) => {
                  await insertInvoice.mutateAsync(v as Record<string, unknown>);
                }}
              />
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
                <Sparkles className="h-3 w-3 text-primary" /> Bucket privado
              </span>
            </div>
          </div>
        </section>

        {/* Invoice list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando faturas...
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhuma fatura cadastrada"
            description="Faça upload de um PDF de fatura ou cadastre manualmente para começar a controlar seus cartões."
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border/40 p-6">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Faturas recentes</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {invoices.length} fatura{invoices.length === 1 ? "" : "s"} no histórico
                </p>
              </div>
            </div>
            <div className="divide-y divide-border/40">
              {invoices.map((inv) => {
                const card = cardById(inv.credit_card_id);
                const st = statusLabels[inv.status];
                const StIcon = st.icon;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-accent/15"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-muted/20">
                        <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {card?.name ?? "Cartão removido"}
                          {card?.last_digits && (
                            <span className="ml-1.5 text-xs text-muted-foreground">····{card.last_digits}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatMonth(inv.reference_month)} · vence{" "}
                          {new Date(inv.due_date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="num text-sm font-semibold">{formatBRL(Number(inv.total_amount))}</span>
                      <button onClick={() => cycleStatus(inv)} title="Alternar status">
                        <Badge className={st.cls}>
                          <StIcon className="mr-1 h-3 w-3" /> {st.label}
                        </Badge>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => downloadInvoice(inv)}
                        title="Abrir PDF"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeInvoice.mutate(inv.id)}
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
        )}
      </main>
    </>
  );
}
