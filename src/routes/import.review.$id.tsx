import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Trash2,
  AlertTriangle,
  Filter,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useUserList } from "@/lib/queries";
import {
  listSession,
  updateStagingTx,
  confirmStaging,
  discardSession,
} from "@/server/import-engine.functions";
import { supabase } from "@/integrations/supabase/client";

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export const Route = createFileRoute("/import/review/$id")({
  head: () => ({
    meta: [
      { title: "Revisar lançamentos importados — Thaigo Finance AI" },
      { name: "description", content: "Revise os lançamentos extraídos do documento antes de gravar." },
    ],
  }),
  component: ReviewPage,
});

type Session = {
  id: string;
  doc_kind: string;
  status: string;
  method: string | null;
  bank_hint: string | null;
  account_hint: string | null;
  bank_account_id: string | null;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  total_credits: number;
  total_debits: number;
  net_amount: number;
  total_count: number;
  duplicate_count: number;
  confirmed_count: number;
  error_count: number;
  errors: string[] | null;
};

type Tx = {
  id: string;
  occurred_at: string | null;
  description: string;
  amount: number;
  kind: "income" | "expense";
  category_hint: string | null;
  category_id: string | null;
  confidence: number | null;
  is_duplicate: boolean;
  status: "pending" | "confirmed" | "discarded" | "duplicate";
  edited: boolean;
  position: number;
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ReviewPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const list = useServerFn(listSession);
  const update = useServerFn(updateStagingTx);
  const confirmFn = useServerFn(confirmStaging);
  const discard = useServerFn(discardSession);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "credits" | "debits" | "duplicates">("all");
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [allowDup, setAllowDup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: accounts = [] } = useUserList<{ id: string; bank: string; account_number: string | null }>(
    "bank_accounts",
    { orderBy: "bank", ascending: true },
  );

  const reload = async () => {
    setLoading(true);
    try {
      const r = await list({ data: { sessionId: id, token: await getToken() } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSession(r.session as Session);
      const items = (r.transactions as Tx[]).filter((t) => t.status !== "discarded");
      setTxs(items);
      // Pré-seleciona pending (não duplicatas)
      setSelected(new Set(items.filter((t) => t.status === "pending").map((t) => t.id)));
      setBankAccountId((r.session as Session).bank_account_id ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (filter === "credits") return t.kind === "income";
      if (filter === "debits") return t.kind === "expense";
      if (filter === "duplicates") return t.is_duplicate;
      return true;
    });
  }, [txs, filter]);

  const selectedTxs = useMemo(() => txs.filter((t) => selected.has(t.id)), [txs, selected]);
  const selCredits = selectedTxs.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
  const selDebits = selectedTxs.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((t) => next.delete(t.id));
      } else {
        filtered.forEach((t) => next.add(t.id));
      }
      return next;
    });
  };

  const onPatch = async (txId: string, patch: Partial<Tx>) => {
    // Optimistic
    setTxs((prev) => prev.map((t) => (t.id === txId ? { ...t, ...patch, edited: true } : t)));
    try {
      const r = await update({
        data: {
          id: txId,
          patch: {
            occurred_at: patch.occurred_at ?? undefined,
            description: patch.description,
            amount: patch.amount,
            kind: patch.kind,
            category_id: patch.category_id ?? undefined,
          },
          token: await getToken(),
        },
      });
      if (!r.ok) toast.error(r.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar edição");
    }
  };

  const onConfirm = async () => {
    if (selected.size === 0) {
      toast.error("Selecione ao menos um lançamento.");
      return;
    }
    const ids = [...selected];
    const dupSelected = selectedTxs.some((t) => t.is_duplicate);
    if (dupSelected && !allowDup) {
      toast.error("Há duplicatas selecionadas. Marque 'Permitir duplicatas' ou desmarque-as.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await confirmFn({
        data: {
          sessionId: id,
          ids,
          bankAccountId: bankAccountId ?? undefined,
          allowDuplicates: allowDup,
          token: await getToken(),
        },
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.confirmedCount} lançamento(s) gravado(s) em sua conta.`);
      await reload();
    } finally {
      setSubmitting(false);
    }
  };

  const onDiscard = async () => {
    if (!window.confirm("Descartar toda esta importação? Os lançamentos não confirmados serão removidos.")) return;
    const r = await discard({ data: { sessionId: id, token: await getToken() } });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Importação descartada.");
    navigate({ to: "/chat" });
  };

  return (
    <>
      <AppHeader
        title="Revisar lançamentos extraídos"
        subtitle="Edite, selecione e confirme antes de gravar"
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/chat">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Voltar ao chat
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando sessão...
          </div>
        ) : !session ? (
          <p className="text-sm text-muted-foreground">Sessão não encontrada.</p>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4 text-primary" />
                  {session.bank_hint ?? "Extrato bancário"}
                  {session.period_start && session.period_end && (
                    <Badge variant="outline" className="text-[10px]">
                      {session.period_start} → {session.period_end}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {session.method ?? "?"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Lançamentos</p>
                  <p className="font-semibold">{session.total_count}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Créditos</p>
                  <p className="font-semibold text-success">{fmt(Number(session.total_credits))}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Débitos</p>
                  <p className="font-semibold text-destructive">{fmt(Number(session.total_debits))}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground">Líquido</p>
                  <p className={cn("font-semibold", Number(session.net_amount) >= 0 ? "text-success" : "text-destructive")}>
                    {fmt(Number(session.net_amount))}
                  </p>
                </div>
                {session.duplicate_count > 0 && (
                  <div className="sm:col-span-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {session.duplicate_count} possível(eis) duplicata(s) detectada(s) com lançamentos já existentes.
                  </div>
                )}
                {session.errors && session.errors.length > 0 && (
                  <div className="sm:col-span-4 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    <p className="font-medium">Avisos da extração:</p>
                    <ul className="ml-4 list-disc">
                      {session.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Conta de destino</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={bankAccountId ?? "none"}
                  onValueChange={(v) => setBankAccountId(v === "none" ? null : v)}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Selecione a conta bancária" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem vínculo —</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.bank} {a.account_number ? `· ${a.account_number}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Os lançamentos confirmados serão vinculados a esta conta.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
                <CardTitle className="text-sm">Lançamentos ({filtered.length})</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-border/40 p-0.5">
                    <Button
                      variant={filter === "all" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFilter("all")}
                    >
                      Todos
                    </Button>
                    <Button
                      variant={filter === "credits" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFilter("credits")}
                    >
                      Créditos
                    </Button>
                    <Button
                      variant={filter === "debits" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFilter("debits")}
                    >
                      Débitos
                    </Button>
                    {session.duplicate_count > 0 && (
                      <Button
                        variant={filter === "duplicates" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setFilter("duplicates")}
                      >
                        Duplicatas
                      </Button>
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={toggleAllFiltered}>
                    <Filter className="mr-1 h-3 w-3" />
                    {allFilteredSelected ? "Limpar filtro" : "Selecionar filtro"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setSelected(new Set(txs.filter((t) => !t.is_duplicate).map((t) => t.id)))}
                  >
                    Selecionar não-duplicatas
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setSelected(new Set())}
                  >
                    Limpar seleção
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAllFiltered} />
                      </TableHead>
                      <TableHead className="w-32">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-28">Tipo</TableHead>
                      <TableHead className="w-32 text-right">Valor</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => {
                      const isSel = selected.has(t.id);
                      return (
                        <TableRow
                          key={t.id}
                          className={cn(
                            t.is_duplicate && "bg-amber-500/5",
                            t.edited && "bg-yellow-500/5",
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSel}
                              onCheckedChange={(v) => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (v) next.add(t.id);
                                  else next.delete(t.id);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={t.occurred_at ?? ""}
                              onChange={(e) => onPatch(t.id, { occurred_at: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={t.description}
                              onChange={(e) => onPatch(t.id, { description: e.target.value })}
                              className="h-8 text-xs"
                            />
                            {t.confidence !== null && t.confidence < 0.6 && (
                              <p className="mt-0.5 text-[10px] text-amber-500">
                                Baixa confiança ({Math.round(t.confidence * 100)}%)
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={t.kind}
                              onValueChange={(v) => onPatch(t.id, { kind: v as "income" | "expense" })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">Crédito</SelectItem>
                                <SelectItem value="expense">Débito</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={Number(t.amount)}
                              onChange={(e) => onPatch(t.id, { amount: parseFloat(e.target.value) })}
                              className={cn(
                                "h-8 text-right text-xs",
                                t.kind === "income" ? "text-success" : "text-destructive",
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            {t.status === "confirmed" ? (
                              <Badge className="bg-success text-success-foreground text-[10px]">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Gravado
                              </Badge>
                            ) : t.is_duplicate ? (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-[10px]">
                                Duplicata
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          Nenhum lançamento neste filtro.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card/95 p-4 shadow-elegant backdrop-blur">
              <div className="text-sm">
                <span className="font-semibold">{selected.size}</span> selecionado(s) ·{" "}
                <span className="text-success">{fmt(selCredits)}</span> /{" "}
                <span className="text-destructive">{fmt(selDebits)}</span> · líquido{" "}
                <span className={cn(selCredits - selDebits >= 0 ? "text-success" : "text-destructive")}>
                  {fmt(selCredits - selDebits)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={allowDup} onCheckedChange={(v) => setAllowDup(!!v)} />
                  Permitir duplicatas
                </label>
                <Button variant="outline" size="sm" onClick={onDiscard} disabled={submitting}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Descartar
                </Button>
                <Button
                  size="sm"
                  onClick={onConfirm}
                  disabled={submitting || selected.size === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {submitting ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  )}
                  Confirmar selecionados
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
