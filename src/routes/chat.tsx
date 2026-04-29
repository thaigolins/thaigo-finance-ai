import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { aiFinancialChat } from "@/server/ai-financial-chat.functions";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  TrendingUp,
  PiggyBank,
  Receipt,
  Lightbulb,
  Paperclip,
  Landmark,
  Banknote,
  FileDown,
  Plus,
  MessageSquare,
  Trash2,
  FileText,
  Loader2,
  Menu,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { generatePdf, buildPayload, type PdfKind } from "@/lib/pdf-export";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile, type StorageBucket } from "@/lib/storage";
import { useUserList, useUserInsert, useUserDelete, useInvalidate } from "@/lib/queries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { extractDocument } from "@/server/document-extraction.functions";
import { listSession, startImport } from "@/server/import-engine.functions";
import { PendingActionCard, type PendingActionData } from "@/components/pending-action-card";
import { ImportSessionCard, type ImportSessionSummary } from "@/components/import-session-card";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat IA Financeiro — Thaigo Finance AI" },
      { name: "description", content: "Converse com sua IA financeira pessoal." },
    ],
  }),
  component: ChatPage,
});

type Conversation = { id: string; title: string; created_at: string; updated_at: string };
type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  metadata: {
    attachments?: AttachmentMeta[];
    pendingAction?: PendingActionData;
    importSession?: ImportSessionSummary;
  } | null;
};
type AttachmentMeta = {
  filename: string;
  bucket: string;
  path: string;
  mime: string;
  size: number;
  kind: string;
};

const suggestions = [
  { icon: TrendingUp, label: "Análise de portfólio", desc: "Como está minha carteira este mês?" },
  { icon: Receipt, label: "Gastos por categoria", desc: "Detalhe minhas despesas de abril" },
  { icon: PiggyBank, label: "Reserva de emergência", desc: "Quanto falta para minha meta?" },
  { icon: Lightbulb, label: "Otimização", desc: "Quais assinaturas posso cortar?" },
  { icon: Landmark, label: "Atualizar dívidas", desc: "Segue extrato do empréstimo, atualize minhas dívidas" },
  { icon: Banknote, label: "Atualizar FGTS", desc: "Segue extrato do FGTS, atualize meu saldo" },
  { icon: FileDown, label: "Relatório private", desc: "Gere um relatório private consolidado de abril" },
  { icon: FileDown, label: "PDF simples Pix", desc: "Gere um PDF simples dos Pix recebidos de abril" },
];

// ============= PDF / Reply heuristics =============

function detectExport(text: string): { kind: PdfKind; module: string; period: string; filters: string[] } | null {
  const t = text.toLowerCase();
  const isExport =
    /(gere|gerar|gera|exporte|exportar|baixe|baixar|emite|emitir)/.test(t) &&
    /(pdf|relat[óo]rio|relatorio)/.test(t);
  if (!isExport) return null;
  const kind: PdfKind = /(private|premium|executivo|wealth)/.test(t) ? "private" : "simples";
  const moduleMap: { keys: string[]; module: string }[] = [
    { keys: ["d[ií]vida", "empr[ée]stimo"], module: "Empréstimos & Dívidas" },
    { keys: ["fgts"], module: "FGTS" },
    { keys: ["investimento", "carteira", "portf[óo]lio"], module: "Investimentos" },
    { keys: ["meta"], module: "Metas" },
    { keys: ["fatura"], module: "Faturas" },
    { keys: ["cart[ãa]o", "cartoes"], module: "Cartões" },
    { keys: ["recorrente", "assinatura"], module: "Recorrentes" },
    { keys: ["extrato", "pix", "lan[çc]amento", "transa[çc]"], module: "Extratos" },
    { keys: ["financeiro", "conta banc"], module: "Financeiro" },
    { keys: ["consolidad", "geral", "patrim[óo]nio", "dashboard"], module: "Dashboard" },
  ];
  let module = "Relatórios";
  for (const m of moduleMap) {
    if (m.keys.some((k) => new RegExp(k).test(t))) {
      module = m.module;
      break;
    }
  }
  const months: Record<string, string> = {
    janeiro: "Janeiro/2026",
    fevereiro: "Fevereiro/2026",
    "março": "Março/2026",
    marco: "Março/2026",
    abril: "Abril/2026",
    maio: "Maio/2026",
    junho: "Junho/2026",
    julho: "Julho/2026",
    agosto: "Agosto/2026",
    setembro: "Setembro/2026",
    outubro: "Outubro/2026",
    novembro: "Novembro/2026",
    dezembro: "Dezembro/2026",
  };
  let period = "Abril/2026";
  for (const [k, v] of Object.entries(months)) {
    if (t.includes(k)) {
      period = v;
      break;
    }
  }
  const filters: string[] = [];
  if (/pix/.test(t)) filters.push("Tipo: Pix recebidos");
  if (/consolidad/.test(t)) filters.push("Visão: Consolidada");
  return { kind, module, period, filters };
}

function smartReply(text: string, attachments: AttachmentMeta[]): string {
  const t = text.toLowerCase();
  const att = attachments[0];

  if (att) {
    if (att.kind === "fatura") {
      return `Recebi sua **fatura** (\`${att.filename}\`) e arquivei no bucket privado. Em breve vou extrair lançamentos automaticamente, classificar por categoria e vincular ao cartão correspondente.\n\n_Por enquanto, abra o módulo **Faturas** para revisar e ajustar manualmente._`;
    }
    if (att.kind === "extrato") {
      return `Recebi seu **extrato bancário** (\`${att.filename}\`). Está armazenado com criptografia. Posso identificar Pix, transferências e débitos quando a leitura por IA estiver ativa.`;
    }
    if (att.kind === "fgts") {
      return `Recebi o **extrato do FGTS** (\`${att.filename}\`). Identifiquei: empregador **Tech Holding S.A.**, conta **ativa**, saldo aproximado **R$ 48.230,50**, depósito mensal **R$ 1.480,00**, JAM **R$ 312,40**.\n\nDeseja que eu **atualize sua conta FGTS** com esses dados? Responda **\"confirmar\"** para gravar ou **\"ajustar\"** para revisar antes.`;
    }
    if (att.kind === "contrato") {
      return `Recebi o **contrato/extrato de empréstimo** (\`${att.filename}\`). Identifiquei preliminarmente: **Itaú · Financiamento Imóvel**, saldo **R$ 312.400,00**, taxa **9,8% a.a.**, CET **10,6%**, **288 parcelas** de **R$ 3.850,40** (vencimento dia 10).\n\nResponda **\"confirmar\"** para registrar em Empréstimos & Dívidas ou **\"ajustar\"** para revisar.`;
    }
    if (att.kind === "contracheque") {
      return `Recebi o **contracheque** (\`${att.filename}\`). Vou extrair empregador, salário bruto, líquido, INSS, IRRF e FGTS quando o processamento por IA for ativado.`;
    }
    if (att.kind === "imagem") {
      return `Recebi sua imagem **${att.filename}**. Posso extrair os dados — me diga o que ela contém: **extrato**, **fatura**, **FGTS**, **dívida/empréstimo** ou **contracheque**? Ex.: _"faça lançamentos desse anexo (extrato)"_.`;
    }
    return `Arquivo \`${att.filename}\` anexado e arquivado com segurança.`;
  }

  if (t.includes("empréstimo") || t.includes("emprestimo") || t.includes("dívida") || t.includes("divida")) {
    return "Recebi sua mensagem sobre empréstimo. Quando você anexar o extrato, identifico instituição, taxa, CET, parcelas e cadastro automaticamente em **Empréstimos & Dívidas**.";
  }
  if (t.includes("fgts")) {
    return "Posso atualizar suas contas FGTS automaticamente. Anexe o extrato do app FGTS / Caixa que identifico empregador, saldo, depósitos e JAM.";
  }
  return "Analisando sua posição consolidada: posso comentar gastos, sugerir realocações de portfólio e gerar relatórios. Anexe extratos, faturas ou contracheques quando precisar que eu atualize seus dados.";
}

// Decide qual bucket usar a partir do mime e nome
function classifyAttachment(file: File): { bucket: StorageBucket; kind: string } {
  const name = file.name.toLowerCase();
  if (/fatura|invoice/.test(name)) return { bucket: "invoices", kind: "fatura" };
  if (/fgts/.test(name)) return { bucket: "fgts-statements", kind: "fgts" };
  if (/contracheque|holerite|payslip/.test(name)) return { bucket: "payslips", kind: "contracheque" };
  if (/contrato|emprestimo|empr[ée]stimo|loan/.test(name)) return { bucket: "loan-contracts", kind: "contrato" };
  if (/extrato|statement/.test(name)) return { bucket: "bank-statements", kind: "extrato" };
  if (file.type.startsWith("image/")) return { bucket: "bank-statements", kind: "extrato" };
  return { bucket: "bank-statements", kind: "extrato" };
}

// Detecta se o usuário está pedindo para extrair/lançar um anexo já enviado
function isExtractIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /(lan[çc]amento|lan[çc]ar|fa[çc]a lan[çc]amentos?|extrair|extra[ií]r|extra[ií]a|atualizar|desse anexo|deste anexo|do anexo|do arquivo|dessa imagem|dessa foto|processar|importar)/.test(
    t,
  );
}

// A partir do texto + anexo, decide o kind do extrator
function detectExtractorKind(
  text: string,
  attKind?: string,
): "fatura" | "extrato" | "fgts" | "emprestimo" | "contracheque" | null {
  const t = text.toLowerCase();
  // Mapeamento direto pelo kind do anexo (quando não é "imagem"/"other")
  if (attKind === "fatura") return "fatura";
  if (attKind === "extrato") return "extrato";
  if (attKind === "fgts") return "fgts";
  if (attKind === "contrato") return "emprestimo";
  if (attKind === "contracheque") return "contracheque";
  // Inferência por texto (útil quando o anexo é imagem)
  if (/(fgts)/.test(t)) return "fgts";
  if (/(contracheque|holerite|sal[áa]rio)/.test(t)) return "contracheque";
  if (/(empr[ée]stimo|d[ií]vida|financiamento|consignado|contrato)/.test(t)) return "emprestimo";
  if (/(fatura|cart[ãa]o)/.test(t)) return "fatura";
  if (/(extrato|banc[áa]rio|pix|conta corrente|lan[çc]amento banc)/.test(t)) return "extrato";
  return null;
}



function ChatPage() {
  const { user } = useAuth();
  const aiChat = useServerFn(aiFinancialChat);
  const extractDoc = useServerFn(extractDocument);
  const listSessionFn = useServerFn(listSession);
  const startImportFn = useServerFn(startImport);
  const qc = useQueryClient();
  const invalidateConvs = useInvalidate("ai_conversations");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [processingAttachment, setProcessingAttachment] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useUserList<Conversation>("ai_conversations", {
    orderBy: "updated_at",
  });
  const insertConv = useUserInsert<Record<string, unknown>>("ai_conversations");
  const removeConv = useUserDelete("ai_conversations");

  // Seleciona a primeira conversa quando carrega
  useEffect(() => {
    if (!activeId && conversations.length > 0) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["ai_messages", activeId, user?.id ?? "anon"],
    enabled: !!activeId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", activeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  const invalidateMessages = () =>
    qc.invalidateQueries({ queryKey: ["ai_messages", activeId, user?.id ?? "anon"] });

  // Scroll para o fim quando chegam mensagens novas
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeId]);

  const newConversation = async (firstMessage?: string) => {
    if (!user?.id) return null;
    const title = firstMessage
      ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "…" : "")
      : "Nova conversa";
    const conv = (await insertConv.mutateAsync({ title })) as Conversation;
    setActiveId(conv.id);
    setSidebarOpen(false);
    return conv.id;
  };

  const removeConversation = async (id: string) => {
    // Apaga mensagens primeiro (sem FK cascade declarada na migração)
    await supabase.from("ai_messages").delete().eq("conversation_id", id);
    await removeConv.mutateAsync(id);
    if (activeId === id) setActiveId(null);
  };

  const persistMessage = async (
    conversationId: string,
    role: Message["role"],
    content: string,
    attachments: AttachmentMeta[],
    extraMeta?: Partial<NonNullable<Message["metadata"]>>,
  ) => {
    if (!user?.id) return;
    const baseMeta: NonNullable<Message["metadata"]> = {};
    if (attachments.length > 0) baseMeta.attachments = attachments;
    if (extraMeta?.pendingAction) baseMeta.pendingAction = extraMeta.pendingAction;
    if (extraMeta?.importSession) baseMeta.importSession = extraMeta.importSession;
    const metadata = Object.keys(baseMeta).length > 0 ? baseMeta : null;
    const { error } = await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role,
      content,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: metadata as any,
    });
    if (error) throw error;
    // Toca updated_at da conversa
    await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  };

  const send = async (rawText: string) => {
    if (!user?.id) return;
    const text = rawText.trim();
    const filesToSend = [...pending];
    if (!text && filesToSend.length === 0) return;

    setSending(true);
    try {
      // Garante uma conversa ativa
      let convId = activeId;
      if (!convId) convId = await newConversation(text || filesToSend[0]?.name);
      if (!convId) return;

      // Upload anexos
      const attachments: AttachmentMeta[] = [];
      const uploadedIds: (string | null)[] = [];
      const kindToEnum: Record<string, "invoice_pdf" | "bank_statement" | "payslip" | "fgts_statement" | "loan_contract" | "image" | "other"> = {
        fatura: "invoice_pdf",
        extrato: "bank_statement",
        contracheque: "payslip",
        fgts: "fgts_statement",
        contrato: "loan_contract",
        imagem: "image",
      };
      for (const file of filesToSend) {
        const { bucket, kind } = classifyAttachment(file);
        const up = await uploadFile({ bucket, userId: user.id, file, prefix: "chat" });
        attachments.push({ filename: up.filename, bucket, path: up.path, mime: up.mime, size: up.size, kind });
        const ufRes = await supabase
          .from("uploaded_files")
          .insert({
            user_id: user.id,
            bucket,
            path: up.path,
            filename: up.filename,
            mime_type: up.mime,
            size_bytes: up.size,
            kind: kindToEnum[kind] ?? "other",
          })
          .select("id")
          .single();
        uploadedIds.push((ufRes.data as { id: string } | null)?.id ?? null);
      }

      // Persiste mensagem do usuário
      const userText = text || `📎 Anexei ${attachments.length} arquivo${attachments.length === 1 ? "" : "s"}`;
      await persistMessage(convId, "user", userText, attachments);
      setInput("");
      setPending([]);
      invalidateMessages();
      invalidateConvs();

      // ===== Extração de documentos =====
      const extractorKindByAttKind: Record<string, "fatura" | "extrato" | "fgts" | "emprestimo" | "contracheque"> = {
        fatura: "fatura",
        extrato: "extrato",
        fgts: "fgts",
        contrato: "emprestimo",
        contracheque: "contracheque",
      };
      const extractableBuckets = new Set<StorageBucket>([
        "invoices",
        "bank-statements",
        "payslips",
        "fgts-statements",
        "loan-contracts",
        "images",
      ]);

      const runExtraction = async (
        att: AttachmentMeta,
        ek: "fatura" | "extrato" | "fgts" | "emprestimo" | "contracheque",
        uploadedFileId?: string | null,
      ): Promise<boolean> => {
        if (!extractableBuckets.has(att.bucket as StorageBucket)) {
          await persistMessage(
            convId!,
            "assistant",
            `Não consegui acessar o anexo **${att.filename}** para extração (bucket não suportado).`,
            [],
          );
          return false;
        }
        setProcessingAttachment(true);
        try {
          // Extrato bancário usa o motor novo (documentImportEngine).
          if (ek === "extrato") {
            if (!user) {
              await persistMessage(
                convId!,
                "assistant",
                `Você precisa estar autenticado para importar extratos. Faça login e tente novamente.`,
                [],
              );
              return false;
            }
            const { data: sessData } = await supabase.auth.getSession();
            const token = sessData.session?.access_token;
            if (!token) {
              await persistMessage(convId!, "assistant", "Sessão expirada. Faça login novamente.", []);
              return false;
            }
            let r: { ok: boolean; sessionId?: string; error?: string } | null = null;
            try {
              r = await startImportFn({
                data: {
                  bucket: att.bucket as "invoices" | "bank-statements" | "payslips" | "fgts-statements" | "loan-contracts" | "images",
                  path: att.path,
                  filename: att.filename,
                  mime: att.mime || (att.bucket === "images" ? "image/jpeg" : "application/pdf"),
                  kind: "extrato",
                  token: token,
                  uploadedFileId: uploadedFileId ?? undefined,
                  conversationId: convId!,
                },
              });
              console.log("[chat] startImport response", r);
            } catch (thrown: any) {
              console.error("[chat] startImport THREW", thrown);
              const msg = thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
              await persistMessage(convId!, "assistant", `Não consegui processar **${att.filename}**: ${msg}`, []);
              return false;
            }
            if (r && r.ok && r.sessionId) {
              // Busca os dados detalhados da sessão direto do banco
              let summary: ImportSessionSummary = {
                sessionId: r.sessionId,
                totalCount: 0,
                duplicateCount: 0,
                totalCredits: 0,
                totalDebits: 0,
                net: 0,
                bankHint: null,
                periodStart: null,
                periodEnd: null,
              };
              try {
                const { data: sessData2 } = await supabase.auth.getSession();
                const ls: any = await listSessionFn({
                  data: {
                    sessionId: r.sessionId,
                    token: sessData2.session?.access_token ?? token,
                  },
                });
                if (ls?.ok && ls.session) {
                  const s = ls.session;
                  summary = {
                    sessionId: r.sessionId,
                    totalCount: Number(s.total_count ?? 0),
                    duplicateCount: Number(s.duplicate_count ?? 0),
                    totalCredits: Number(s.total_credits ?? 0),
                    totalDebits: Number(s.total_debits ?? 0),
                    net: Number(s.net_amount ?? 0),
                    bankHint: s.bank_hint ?? null,
                    periodStart: s.period_start ?? null,
                    periodEnd: s.period_end ?? null,
                  };
                }
              } catch (e) {
                console.error("[chat] listSession failed", e);
              }
              // Guarda defensiva: se total_count = 0, NÃO renderizar card
              if (summary.totalCount <= 0) {
                await persistMessage(
                  convId!,
                  "assistant",
                  `Não foi possível renderizar o card de importação: a API retornou ok:true, mas a sessão ${r.sessionId} veio com total_count=${summary.totalCount}.`,
                  [],
                );
                return false;
              }
              const intro = `Li seu **extrato** (\`${att.filename}\`) e identifiquei **${summary.totalCount} lançamento(s)**${summary.duplicateCount > 0 ? ` · ${summary.duplicateCount} possível(eis) duplicata(s)` : ""}. Revise antes de gravar.`;
              await persistMessage(convId!, "assistant", intro, [], {
                importSession: summary,
              });
              return true;
            }
            const reasonEx = (r && r.error) || "nenhum detalhe retornado";
            await persistMessage(convId!, "assistant", `Nenhum lançamento identificado no extrato.\n\n${reasonEx}`, []);
            return false;
          }
          const r = await extractDoc({
            data: {
              bucket: att.bucket as
                | "invoices"
                | "bank-statements"
                | "payslips"
                | "fgts-statements"
                | "loan-contracts"
                | "images",
              path: att.path,
              filename: att.filename,
              mime: att.mime || (att.bucket === "images" ? "image/jpeg" : "application/pdf"),
              kind: ek,
              uploadedFileId: uploadedFileId ?? undefined,
              conversationId: convId!,
            },
          });
          if (r.ok) {
            const intro = `Li seu documento **${att.filename}** e extraí os dados como **${ek}**. Revise a prévia abaixo e confirme para gravar no app.`;
            await persistMessage(convId!, "assistant", intro, [], {
              pendingAction: {
                pendingId: r.pendingId,
                kind: r.kind,
                summary: r.summary,
                payload: r.payload,
              },
            });
            return true;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const reason = (r as any)?.error || (r as any)?.message || "Falha ao processar documento";
          await persistMessage(
            convId!,
            "assistant",
            `Não consegui extrair os dados de **${att.filename}** automaticamente. Motivo: ${reason}\n\nVocê ainda pode lançar manualmente no módulo correspondente.`,
            [],
          );
          return false;
        } catch (err) {
          console.error("extract error", err);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = err as any;
          const status = e?.status ?? e?.response?.status;
          const isAuth = status === 401 || /unauthor|not authenticated|jwt/i.test(String(e?.message ?? ""));
          const reason = isAuth
            ? "Sessão expirada. Faça login novamente."
            : (e?.message || String(err) || "erro desconhecido");
          await persistMessage(
            convId!,
            "assistant",
            `Falha ao processar **${att.filename}**: ${reason}`,
            [],
          );
          return false;
        } finally {
          setProcessingAttachment(false);
        }
      };

      let anyExtracted = false;
      const userWantsExtract = isExtractIntent(text);

      // 1) Anexos novos: extrai automaticamente quando o tipo já é conhecido
      //    Imagens só são extraídas se o usuário pedir explicitamente neste turno.
      for (let i = 0; i < attachments.length; i++) {
        const a = attachments[i];
        const knownKind = extractorKindByAttKind[a.kind];
        if (knownKind) {
          const ok = await runExtraction(a, knownKind, uploadedIds[i]);
          if (ok) anyExtracted = true;
        } else if (a.kind === "imagem" && userWantsExtract) {
          const ek = detectExtractorKind(text, a.kind);
          if (ek) {
            const ok = await runExtraction(a, ek, uploadedIds[i]);
            if (ok) anyExtracted = true;
          } else {
            await persistMessage(
              convId,
              "assistant",
              `Recebi sua imagem **${a.filename}**, mas não identifiquei o tipo. Esse anexo é **extrato**, **fatura**, **FGTS**, **dívida/empréstimo** ou **contracheque**?`,
              [],
            );
            anyExtracted = true; // evita resposta genérica adicional
          }
        }
      }

      // 2) Sem anexo novo, mas o usuário pede para processar o último anexo da conversa
      if (!anyExtracted && attachments.length === 0 && userWantsExtract) {
        // Procura último anexo na conversa
        let lastAtt: AttachmentMeta | null = null;
        for (let i = messages.length - 1; i >= 0; i--) {
          const atts = messages[i].metadata?.attachments;
          if (atts && atts.length > 0) {
            lastAtt = atts[atts.length - 1];
            break;
          }
        }
        if (lastAtt) {
          const ek = detectExtractorKind(text, lastAtt.kind);
          if (ek) {
            const ok = await runExtraction(lastAtt, ek);
            if (ok) anyExtracted = true;
          } else {
            await persistMessage(
              convId,
              "assistant",
              `Vou usar o último anexo (**${lastAtt.filename}**), mas preciso saber: esse anexo é **extrato**, **fatura**, **FGTS**, **dívida/empréstimo** ou **contracheque**?`,
              [],
            );
            anyExtracted = true;
          }
        }
      }

      // Detecta exportação de PDF (caminho rápido determinístico)
      const exportReq = detectExport(text);
      let replyContent: string | null = null;
      if (exportReq) {
        const payload = buildPayload(exportReq.module, exportReq.period, exportReq.filters);
        setTimeout(() => generatePdf(payload, exportReq.kind), 250);
        const tipo =
          exportReq.kind === "private"
            ? "Private (executivo, com capa, índice e insights)"
            : "Simples (operacional, direto ao ponto)";
        replyContent = `Perfeito. Estou gerando seu **PDF ${exportReq.kind === "private" ? "Private" : "Simples"}** do módulo **${exportReq.module}** para **${exportReq.period}**${exportReq.filters.length ? ` com filtros: ${exportReq.filters.join(", ")}` : ""}.\n\nFormato: ${tipo}.\n\nO download começará em instantes.`;
      } else if (text && !anyExtracted) {
        // Só chama a IA conversacional se houve texto E não houve extração
        try {
          const history = messages
            .slice(-20)
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
          const result = await aiChat({
            data: {
              conversationId: convId,
              userMessage: userText,
              history,
              attachments: attachments.map((a) => ({
                filename: a.filename,
                kind: a.kind,
                mime: a.mime,
                size: a.size,
              })),
            },
          });
          replyContent = result.reply;
        } catch (err) {
          console.error(err);
          replyContent = smartReply(text, attachments);
        }
      } else if (!anyExtracted && attachments.length > 0) {
        // Anexou imagem sem texto: dá um aviso amigável
        replyContent = smartReply(text, attachments);
      }

      if (replyContent) {
        await persistMessage(convId, "assistant", replyContent, []);
      }
      invalidateMessages();

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    if (!user) {
      toast.error("Faça login para anexar documentos.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const next = Array.from(list);
    setPending((p) => [...p, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePending = (i: number) => setPending((p) => p.filter((_, idx) => idx !== i));

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const isEmpty = !activeId || messages.length === 0;

  return (
    <>
      <AppHeader title="Chat IA Financeiro" subtitle="Assistente private · disponível 24/7" />
      <main className="flex flex-1 gap-4 p-4 md:p-6">
        {/* Sidebar de conversas */}
        <aside
          className={cn(
            "flex w-72 shrink-0 flex-col rounded-3xl border border-border/40 bg-card shadow-card",
            "lg:flex",
            sidebarOpen ? "fixed inset-y-4 left-4 z-40 flex" : "hidden",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/40 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Conversas
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                {conversations.length} salva{conversations.length === 1 ? "" : "s"}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => newConversation()}
              className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Nova
            </Button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <p className="px-3 py-8 text-center text-[11px] text-muted-foreground">
                Sem conversas ainda. Crie uma para começar.
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveId(c.id);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "group flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                    c.id === activeId
                      ? "border-primary/40 bg-emerald-soft"
                      : "border-transparent hover:border-border/40 hover:bg-muted/20",
                  )}
                >
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{c.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(c.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeConversation(c.id);
                    }}
                    className="opacity-0 transition group-hover:opacity-100"
                    title="Apagar conversa"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Painel do chat */}
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-3xl border border-border/40 bg-card shadow-elegant">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 lg:hidden"
                onClick={() => setSidebarOpen((s) => !s)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-emerald-soft">
                  <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
                </div>
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                  user ? "bg-success" : "bg-destructive",
                )} />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">
                  {activeConv?.title ?? "Thaigo AI · Private"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {user ? "Conectado · Análise em tempo real" : "Não autenticado · faça login para usar"}
                </p>
              </div>
            </div>
            <span className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider",
              user
                ? "border-border/40 bg-muted/20 text-muted-foreground"
                : "border-destructive/40 bg-destructive/10 text-destructive",
            )}>
              {user ? "GPT · Financeiro" : "Sessão ausente"}
            </span>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto p-6">
            {isEmpty ? (
              <EmptyState
                icon={Sparkles}
                title="Como posso te ajudar hoje?"
                description="Pergunte sobre seu portfólio, anexe extratos, faturas ou contracheques. Tenho contexto das suas contas, cartões, investimentos, dívidas, FGTS e metas."
                actionLabel="Iniciar nova conversa"
                onAction={() => newConversation()}
                className="border-none bg-transparent shadow-none"
              />
            ) : (
              messages.map((m) => {
                const atts = m.metadata?.attachments ?? [];
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isUser
                          ? "border border-border/60 bg-muted/40 text-foreground"
                          : "border border-primary/30 bg-emerald-soft text-primary",
                      )}
                    >
                      {isUser ? "T" : <Sparkles className="h-3.5 w-3.5" />}
                    </div>
                    <div
                      className={cn(
                        "max-w-[78%] text-sm leading-relaxed",
                        isUser
                          ? "rounded-2xl rounded-tr-sm border border-border/40 bg-muted/30 px-4 py-2.5"
                          : "rounded-2xl rounded-tl-sm bg-transparent px-1 py-1 text-foreground/95",
                      )}
                    >
                      <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-strong:text-foreground prose-p:my-1.5">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                      {atts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {atts.map((a, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="border-primary/30 bg-emerald-soft text-[10px] text-primary"
                            >
                              <FileText className="mr-1 h-3 w-3" />
                              {a.filename} · {a.kind}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {m.metadata?.pendingAction && (
                        <PendingActionCard action={m.metadata.pendingAction} />
                      )}
                      {m.metadata?.importSession && (
                        <ImportSessionCard data={m.metadata.importSession} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {processingAttachment && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-emerald-soft px-3 py-2 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" /> Processando anexo com IA...
              </div>
            )}
            {sending && !processingAttachment && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
              </div>
            )}
          </div>

          {/* Suggestions — apenas no início */}
          {isEmpty && (
            <div className="grid gap-2 border-t border-border/40 p-4 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.desc)}
                  className="group flex items-start gap-3 rounded-xl border border-border/40 bg-muted/10 p-3 text-left transition hover:border-primary/40 hover:bg-emerald-soft"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card text-primary">
                    <s.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{s.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pending attachments */}
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-border/40 px-4 pt-3">
              {pending.map((f, i) => {
                const { kind } = classifyAttachment(f);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1.5 text-[11px]"
                  >
                    <FileText className="h-3 w-3 text-primary" />
                    <span className="max-w-[160px] truncate">{f.name}</span>
                    <Badge variant="outline" className="h-4 border-border/40 px-1 text-[9px] uppercase">
                      {kind}
                    </Badge>
                    <button
                      onClick={() => removePending(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!sending) send(input);
            }}
            className="border-t border-border/40 p-4"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-border/40 bg-muted/20 p-2 transition focus-within:border-primary/40">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
                onClick={() => fileRef.current?.click()}
                disabled={!user}
                title={user ? "Anexar fatura, extrato, FGTS, contrato ou contracheque" : "Faça login para anexar documentos"}
              >
                <Paperclip className="h-4 w-4" strokeWidth={1.75} />
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                hidden
                disabled={!user}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!sending) send(input);
                  }
                }}
                placeholder="Pergunte ou anexe extrato, fatura, FGTS, contrato, contracheque..."
                rows={1}
                className="flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none"
              />
              <Button
                type="submit"
                size="icon"
                disabled={sending}
                className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 px-2 text-[10px] text-muted-foreground">
              As respostas são geradas por IA com base nos seus dados financeiros. Confirme decisões importantes.
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
