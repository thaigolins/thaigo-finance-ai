import { createFileRoute } from "@tanstack/react-router";
import { Upload, ArrowDownRight, ArrowUpRight, FileText, Loader2, Trash2, Landmark } from "lucide-react";
import { useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { formatBRL } from "@/lib/format";
import { useUserList, useUserInsert, useUserDelete } from "@/lib/queries";
import { uploadFile, getSignedUrl } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/extratos")({
  head: () => ({
    meta: [
      { title: "Extratos — Thaigo Finance AI" },
      { name: "description", content: "Extratos bancários e classificação automática por IA." },
    ],
  }),
  component: ExtratosPage,
});

type Tx = {
  id: string;
  description: string;
  amount: number;
  occurred_at: string;
  kind: "income" | "expense" | "transfer";
  bank_account_id: string | null;
};

type Account = { id: string; bank: string };

type Upload = {
  id: string;
  filename: string;
  size_bytes: number | null;
  bucket: string;
  path: string;
  created_at: string;
  ai_processed: boolean;
};

function ExtratosPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { data: txs = [] } = useUserList<Tx>("bank_transactions", { orderBy: "occurred_at" });
  const { data: accounts = [] } = useUserList<Account>("bank_accounts");
  const { data: uploads = [] } = useUserList<Upload>("uploaded_files", { orderBy: "created_at" });
  const insertUpload = useUserInsert<Record<string, unknown>>("uploaded_files");
  const removeUpload = useUserDelete("uploaded_files");

  const bankUploads = uploads.filter((u) => u.bucket === "bank-statements");

  // Agrupa transações por conta, depois por data
  const byAccount: Record<string, { account: Account; txs: Tx[] }> = {};
  for (const a of accounts) {
    byAccount[a.id] = { account: a, txs: [] };
  }
  byAccount["sem-conta"] = { account: { id: "sem-conta", bank: "Sem conta vinculada" }, txs: [] };
  for (const tx of txs) {
    const key = tx.bank_account_id && byAccount[tx.bank_account_id] ? tx.bank_account_id : "sem-conta";
    byAccount[key].txs.push(tx);
  }
  const accountGroups = Object.values(byAccount).filter((g) => g.txs.length > 0);

  const accountName = (id: string | null) =>
    accounts.find((a) => a.id === id)?.bank ?? "Sem conta";

  const handleFile = async (file: File) => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const meta = await uploadFile({
        bucket: "bank-statements",
        userId: user.id,
        file,
      });
      await insertUpload.mutateAsync({
        bucket: "bank-statements",
        path: meta.path,
        filename: meta.filename,
        mime_type: meta.mime,
        size_bytes: meta.size,
        kind: "bank_statement",
      });
      toast.success("Extrato enviado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openUpload = async (u: Upload) => {
    try {
      const url = await getSignedUrl(u.bucket as never, u.path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir arquivo");
    }
  };

  return (
    <>
      <AppHeader title="Extratos" subtitle="Histórico bancário" exportModule="Extratos" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Upload className="h-3.5 w-3.5" />
          <span>Importar extrato:</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => fileRef.current?.click()}
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
            ref={fileRef}
            type="file"
            accept=".pdf,.ofx,.csv,image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {bankUploads.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
            <h3 className="mb-3 text-sm font-semibold">Arquivos importados</h3>
            <div className="divide-y divide-border/60">
              {bankUploads.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-3">
                  <button
                    onClick={() => openUpload(u)}
                    className="flex min-w-0 items-center gap-3 text-left transition hover:text-primary"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.filename}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(u.created_at).toLocaleString("pt-BR")} ·{" "}
                        {u.size_bytes ? `${(u.size_bytes / 1024).toFixed(1)} KB` : "—"}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => removeUpload.mutate(u.id)}
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {txs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sem movimentações"
            description="Importe um extrato bancário ou registre transações em Financeiro para visualizar seu histórico aqui."
          />
        ) : (
          <section className="space-y-6">
            {accountGroups.map((group) => {
              const accountTotal = group.txs.reduce(
                (s, t) => s + (t.kind === "income" ? Number(t.amount) : -Math.abs(Number(t.amount))),
                0,
              );
              const grouped = group.txs.reduce<Record<string, Tx[]>>((acc, t) => {
                (acc[t.occurred_at] ||= []).push(t);
                return acc;
              }, {});
              return (
                <div key={group.account.id} className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-5 py-3 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Landmark className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{group.account.bank}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {group.txs.length} lançamento{group.txs.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${accountTotal >= 0 ? "text-success" : "text-foreground"}`}>
                      {accountTotal >= 0 ? "+" : ""}
                      {formatBRL(accountTotal)}
                    </span>
                  </div>
                  {Object.entries(grouped).map(([date, items]) => {
                    const dayTotal = items.reduce(
                      (s, i) => s + (i.kind === "income" ? Number(i.amount) : -Math.abs(Number(i.amount))),
                      0,
                    );
                    return (
                      <div key={date} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
                        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{date}</span>
                          <span className={`text-xs font-semibold ${dayTotal >= 0 ? "text-success" : "text-foreground"}`}>
                            {dayTotal >= 0 ? "+" : ""}
                            {formatBRL(dayTotal)}
                          </span>
                        </div>
                        <div className="divide-y divide-border/60">
                          {items.map((t) => {
                            const positive = t.kind === "income";
                            return (
                              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                      positive ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                                    }`}
                                  >
                                    {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{t.description}</p>
                                    <div className="mt-0.5 flex items-center gap-2">
                                      <Badge variant="outline" className="border-border/60 py-0 text-[10px]">
                                        {t.kind}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <span className={`text-sm font-semibold ${positive ? "text-success" : "text-foreground"}`}>
                                  {positive ? "+" : "-"}
                                  {formatBRL(Math.abs(Number(t.amount)))}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>
        )}
      </main>
    </>
  );
}
