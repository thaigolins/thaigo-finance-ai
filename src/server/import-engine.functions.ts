import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware-custom";
import { z } from "zod";
import {
  extractBankStatementFromImage,
  validateTransactions,
  detectDuplicates,
  type RawTx,
} from "./import-engine.server";

// ============================================================
// documentImportEngine — server functions expostas ao app.
// Pipeline público:
//   1) startImport({bucket, path, kind, ...})  → cria sessão + extrai + persiste staging
//   2) listSession({sessionId})                → carrega sessão + staging para a tela de revisão
//   3) updateStagingTx({id, patch})            → edição inline
//   4) confirmStaging({sessionId, ids})        → grava em bank_transactions
//   5) discardSession({sessionId})             → descarta tudo
// ============================================================

const Bucket = z.enum([
  "invoices",
  "bank-statements",
  "payslips",
  "fgts-statements",
  "loan-contracts",
  "images",
]);

const StartInput = z.object({
  bucket: Bucket,
  path: z.string().min(1).max(512),
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(128),
  // Por enquanto o motor só implementa "extrato"; demais kinds caem no fluxo legado.
  kind: z.enum(["extrato"]),
  uploadedFileId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().nullish(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAudit(supabase: any, params: {
  userId: string;
  action: "extract" | "confirm" | "discard" | "duplicate_detected" | "partial_confirm" | "edit_before_confirm";
  docKind?: "fatura" | "extrato" | "fgts" | "emprestimo" | "contracheque" | null;
  pendingId?: string | null;
  status?: "success" | "error" | "warning";
  message?: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await supabase.from("ai_audit_logs").insert({
      user_id: params.userId,
      action: params.action,
      doc_kind: params.docKind ?? null,
      pending_action_id: params.pendingId ?? null,
      status: params.status ?? "success",
      message: params.message ?? null,
      before_data: params.before ?? null,
      after_data: params.after ?? null,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

export const startImport = createServerFn({ method: "POST" })
  .inputValidator((d) => StartInput.parse(d))
  .handler(async ({ data }) => {
    console.log("[startImport] MIDDLEWARE_VERSION", "manual-auth-v3", new Date().toISOString());

    // Auth manual: extrai token do header Authorization da requisição
    const request = getRequest();
    const authHeader = request?.headers?.get?.("authorization") ?? "";
    let token = authHeader.replace(/^Bearer\s+/i, "").trim();

    // Fallback: cookie sb-*-auth-token
    if (!token && request?.headers) {
      const cookieHeader = request.headers.get("cookie") ?? "";
      const match = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
      if (match) {
        try {
          const decoded = decodeURIComponent(match[1]);
          const parsed = JSON.parse(decoded);
          token = parsed?.access_token ?? "";
        } catch { /* ignore */ }
      }
    }

    if (!token) {
      throw new Error("Unauthorized: token ausente");
    }

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      throw new Error("Unauthorized: sessão inválida");
    }
    const userId = userData.user.id as string;
    console.log("[startImport] VERSION_IMPORT_ENGINE_29APR step=begin", {
      userId,
      bucket: data.bucket,
      path: data.path,
      filename: data.filename,
      mime: data.mime,
      kind: data.kind,
      hasApiKey: !!process.env.LOVABLE_API_KEY,
    });

    // 1) Cria sessão em status extracting
    const sessionInsert = await supabase
      .from("import_sessions")
      .insert({
        user_id: userId,
        doc_kind: data.kind,
        status: "extracting",
        method: "image_ai",
        source_file_id: data.uploadedFileId ?? null,
        conversation_id: data.conversationId ?? null,
        message_id: data.messageId ?? null,
        bank_account_id: data.bankAccountId ?? null,
      })
      .select("id")
      .single();

    if (sessionInsert.error || !sessionInsert.data) {
      console.error("[startImport] step=session_insert FAILED", sessionInsert.error);
      return { ok: false as const, error: `Falha ao criar sessão: ${sessionInsert.error?.message ?? "?"}` };
    }
    const sessionId = (sessionInsert.data as { id: string }).id;
    console.log("[startImport] step=session_created", { sessionId });

    // 2) Baixa arquivo do storage
    const dl = await supabase.storage.from(data.bucket).download(data.path);
    if (dl.error || !dl.data) {
      const msg = `Falha ao ler arquivo do storage (${data.bucket}/${data.path}): ${dl.error?.message ?? "desconhecido"}`;
      console.error("[startImport] step=storage_download FAILED", dl.error);
      await supabase.from("import_sessions").update({ status: "failed", errors: [msg] }).eq("id", sessionId);
      await logAudit(supabase, { userId, action: "extract", docKind: data.kind, status: "error", message: msg });
      return { ok: false as const, error: msg };
    }
    const ab = await dl.data.arrayBuffer();
    const bytes = new Uint8Array(ab);
    console.log("[startImport] step=file_downloaded", { bytes: bytes.byteLength });

    // 3) Roda pipeline (por enquanto só image_ai para extrato)
    let result;
    try {
      result = await extractBankStatementFromImage({
        fileBytes: bytes,
        mime: data.mime,
        filename: data.filename,
      });
    } catch (e) {
      const msg = `Erro no extractor: ${e instanceof Error ? e.message : String(e)}`;
      console.error("[startImport] step=extractor THREW", e);
      await supabase.from("import_sessions").update({ status: "failed", errors: [msg] }).eq("id", sessionId);
      return { ok: false as const, error: msg };
    }
    console.log("[startImport] step=extraction_done", {
      method: result.method,
      txCount: result.transactions.length,
      errors: result.errors,
    });

    // 4) Validação
    const { valid, errors: vErrors } = validateTransactions(result.transactions);
    const allErrors = [...result.errors, ...vErrors];
    console.log("[startImport] step=validated", { validCount: valid.length, errCount: allErrors.length });

    // Se nada extraído, encerra com mensagem real
    if (valid.length === 0) {
      const detail = allErrors.length > 0 ? allErrors.join(" | ") : "IA não retornou nenhum lançamento.";
      await supabase
        .from("import_sessions")
        .update({ status: "failed", errors: allErrors.length > 0 ? allErrors : [detail] })
        .eq("id", sessionId);
      console.error("[startImport] step=no_transactions", { detail });
      return { ok: false as const, error: `Não foi possível extrair lançamentos: ${detail}` };
    }

    // 5) Anti-duplicidade
    const dupes = await detectDuplicates({
      supabase,
      userId,
      bankAccountId: data.bankAccountId ?? null,
      txs: valid,
    });
    const dupSet = new Map(dupes.map((d) => [d.index, d]));

    // 6) Totais
    let totalCredits = 0;
    let totalDebits = 0;
    for (const t of valid) {
      if (t.kind === "income") totalCredits += t.amount;
      else totalDebits += t.amount;
    }
    const net = totalCredits - totalDebits;

    // 7) Persiste staging
    if (valid.length > 0) {
      const rows = valid.map((t: RawTx, i: number) => {
        const dup = dupSet.get(i);
        return {
          session_id: sessionId,
          user_id: userId,
          occurred_at: t.occurred_at,
          description: t.description,
          amount: t.amount,
          kind: t.kind === "income" ? "income" : "expense",
          category_hint: t.category_hint ?? null,
          confidence: t.confidence ?? null,
          is_duplicate: !!dup,
          duplicate_of: dup?.existingId ?? null,
          status: dup ? "duplicate" : "pending",
          position: i,
          raw_data: t as unknown as Record<string, unknown>,
        };
      });
      const ins = await supabase.from("import_staging_transactions").insert(rows);
      if (ins.error) {
        console.error("[startImport] step=staging_insert FAILED", ins.error);
        await supabase
          .from("import_sessions")
          .update({ status: "failed", errors: [ins.error.message] })
          .eq("id", sessionId);
        return { ok: false as const, error: `Falha ao gravar staging: ${ins.error.message}` };
      }
      console.log("[startImport] step=staging_inserted", { count: rows.length });
    }

    // 8) Atualiza sessão
    const update = await supabase
      .from("import_sessions")
      .update({
        status: valid.length === 0 ? "failed" : "review",
        method: result.method,
        bank_hint: result.bank_hint ?? null,
        account_hint: result.account_hint ?? null,
        period_start: result.period_start ?? null,
        period_end: result.period_end ?? null,
        opening_balance: result.opening_balance ?? null,
        closing_balance: result.closing_balance ?? null,
        total_credits: totalCredits,
        total_debits: totalDebits,
        net_amount: net,
        total_count: valid.length,
        duplicate_count: dupes.length,
        error_count: allErrors.length,
        errors: allErrors.length > 0 ? allErrors : null,
        raw_extraction: (result.raw ?? null) as unknown as Record<string, unknown> | null,
      })
      .eq("id", sessionId);
    if (update.error) console.error("[startImport] step=session_update FAILED", update.error);
    else console.log("[startImport] step=session_ready_for_review", { sessionId, totalCount: valid.length });

    await logAudit(supabase, {
      userId,
      action: "extract",
      docKind: data.kind,
      status: valid.length === 0 ? "error" : (dupes.length > 0 ? "warning" : "success"),
      message: `Extraídos ${valid.length} lançamentos · ${dupes.length} duplicidade(s) · método ${result.method}`,
      after: {
        sessionId,
        totalCredits,
        totalDebits,
        net,
        duplicates: dupes.length,
        errors: allErrors,
      },
    });

    const payload = { ok: true as const, sessionId };
    console.log("[startImport] RETURNING", JSON.stringify(payload));
    return payload;
  });

const ListInput = z.object({ sessionId: z.string().uuid() });

export const listSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sbTyped, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = sbTyped as any;

    const sess = await supabase
      .from("import_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (sess.error || !sess.data) return { ok: false as const, error: "Sessão não encontrada." };

    const txs = await supabase
      .from("import_staging_transactions")
      .select("*")
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (txs.error) return { ok: false as const, error: txs.error.message };

    return { ok: true as const, session: sess.data, transactions: txs.data ?? [] };
  });

const PatchSchema = z.object({
  occurred_at: z.string().nullish(),
  description: z.string().max(500).optional(),
  amount: z.number().optional(),
  kind: z.enum(["income", "expense"]).optional(),
  category_id: z.string().uuid().nullish(),
  status: z.enum(["pending", "confirmed", "discarded", "duplicate"]).optional(),
});

const UpdateInput = z.object({
  id: z.string().uuid(),
  patch: PatchSchema,
});

export const updateStagingTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sbTyped, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = sbTyped as any;

    const before = await supabase
      .from("import_staging_transactions")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (before.error || !before.data) return { ok: false as const, error: "Lançamento não encontrado." };

    const upd = await supabase
      .from("import_staging_transactions")
      .update({ ...data.patch, edited: true })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (upd.error) return { ok: false as const, error: upd.error.message };

    await logAudit(supabase, {
      userId,
      action: "edit_before_confirm",
      docKind: "extrato",
      before: before.data,
      after: upd.data,
    });
    return { ok: true as const, transaction: upd.data };
  });

const ConfirmInput = z.object({
  sessionId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1),
  bankAccountId: z.string().uuid().nullish(),
  allowDuplicates: z.boolean().optional(),
});

export const confirmStaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ConfirmInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sbTyped, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = sbTyped as any;

    const sess = await supabase
      .from("import_sessions")
      .select("id, doc_kind, bank_account_id")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (sess.error || !sess.data) return { ok: false as const, error: "Sessão não encontrada." };

    const accountId = data.bankAccountId ?? (sess.data as { bank_account_id: string | null }).bank_account_id;

    const stagingRes = await supabase
      .from("import_staging_transactions")
      .select("*")
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .in("id", data.ids);
    if (stagingRes.error) return { ok: false as const, error: stagingRes.error.message };
    const staging = (stagingRes.data ?? []) as Array<{
      id: string;
      occurred_at: string | null;
      description: string;
      amount: number;
      kind: string;
      category_id: string | null;
      is_duplicate: boolean;
      status: string;
    }>;

    // Bloqueia se há obrigatórios em branco
    const missing = staging.filter((s) => !s.occurred_at || !s.description || !Number.isFinite(Number(s.amount)) || Number(s.amount) <= 0);
    if (missing.length > 0) {
      return { ok: false as const, error: `${missing.length} lançamento(s) com campos obrigatórios em branco.` };
    }
    // Bloqueia duplicatas a menos que explicitamente permitido
    const dupesIncluded = staging.filter((s) => s.is_duplicate);
    if (dupesIncluded.length > 0 && !data.allowDuplicates) {
      return {
        ok: false as const,
        error: `${dupesIncluded.length} lançamento(s) marcado(s) como duplicata. Confirme novamente com "permitir duplicatas" ou desmarque-os.`,
      };
    }

    // Insere em bank_transactions
    const rows = staging.map((s) => ({
      user_id: userId,
      bank_account_id: accountId ?? null,
      category_id: s.category_id ?? null,
      description: s.description,
      amount: Number(s.amount),
      kind: s.kind,
      occurred_at: s.occurred_at,
    }));
    const insRes = await supabase.from("bank_transactions").insert(rows).select("id");
    if (insRes.error) return { ok: false as const, error: insRes.error.message };
    const newIds = (insRes.data as { id: string }[] | null) ?? [];

    // Atualiza staging com bank_transaction_id e status confirmed (best-effort, 1 por 1)
    for (let i = 0; i < staging.length; i++) {
      const stag = staging[i];
      const bt = newIds[i]?.id ?? null;
      await supabase
        .from("import_staging_transactions")
        .update({ status: "confirmed", bank_transaction_id: bt })
        .eq("id", stag.id)
        .eq("user_id", userId);
    }

    // Conta total confirmado e fecha sessão se todos
    const remaining = await supabase
      .from("import_staging_transactions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .in("status", ["pending", "duplicate"]);
    const pendingCount = (remaining.count ?? 0) as number;

    const confirmedRes = await supabase
      .from("import_staging_transactions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .eq("status", "confirmed");
    const confirmedCount = (confirmedRes.count ?? 0) as number;

    await supabase
      .from("import_sessions")
      .update({
        status: pendingCount === 0 ? "confirmed" : "review",
        confirmed_count: confirmedCount,
        bank_account_id: accountId ?? null,
      })
      .eq("id", data.sessionId);

    await logAudit(supabase, {
      userId,
      action: pendingCount === 0 ? "confirm" : "partial_confirm",
      docKind: "extrato",
      message: `Confirmados ${staging.length} lançamento(s)${dupesIncluded.length > 0 ? ` (incluindo ${dupesIncluded.length} marcado(s) como duplicata)` : ""}`,
      after: { sessionId: data.sessionId, confirmedCount, pendingCount, ids: data.ids },
    });

    return { ok: true as const, confirmedCount: staging.length, pendingCount };
  });

const DiscardInput = z.object({ sessionId: z.string().uuid() });

export const discardSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DiscardInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sbTyped, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = sbTyped as any;

    const upd = await supabase
      .from("import_sessions")
      .update({ status: "discarded" })
      .eq("id", data.sessionId)
      .eq("user_id", userId);
    if (upd.error) return { ok: false as const, error: upd.error.message };

    await supabase
      .from("import_staging_transactions")
      .update({ status: "discarded" })
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .in("status", ["pending", "duplicate"]);

    await logAudit(supabase, {
      userId,
      action: "discard",
      docKind: "extrato",
      message: "Sessão de importação descartada",
      after: { sessionId: data.sessionId },
    });
    return { ok: true as const };
  });
