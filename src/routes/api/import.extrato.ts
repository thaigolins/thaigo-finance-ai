import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import {
  extractBankStatementFromImage,
  validateTransactions,
  detectDuplicates,
  type RawTx,
} from "@/server/import-engine.server";

const Bucket = z.enum([
  "invoices",
  "bank-statements",
  "payslips",
  "fgts-statements",
  "loan-contracts",
  "images",
]);

const Body = z.object({
  bucket: Bucket,
  path: z.string().min(1).max(512),
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(128),
  uploadedFileId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().nullish(),
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/import/extrato")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        console.log("[/api/import/extrato] VERSION_IMPORT_API_29APR step=begin");

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return json({ ok: false, error: "Servidor sem SUPABASE_URL/PUBLISHABLE_KEY configurado." }, 500);
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return json({ ok: false, error: "Não autenticado. Faça login novamente." }, 401);
        }
        const token = authHeader.slice(7);

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const claims = await supabase.auth.getClaims(token);
        const userId = claims.data?.claims?.sub;
        if (claims.error || !userId) {
          return json({ ok: false, error: "Sessão inválida ou expirada. Faça login novamente." }, 401);
        }

        let parsed: z.infer<typeof Body>;
        try {
          const raw = await request.json();
          parsed = Body.parse(raw);
        } catch (e) {
          return json({ ok: false, error: `Payload inválido: ${e instanceof Error ? e.message : String(e)}` }, 400);
        }

        // 1) Sessão
        const sessionInsert = await supabase
          .from("import_sessions")
          .insert({
            user_id: userId,
            doc_kind: "extrato",
            status: "extracting",
            method: "image_ai",
            source_file_id: parsed.uploadedFileId ?? null,
            conversation_id: parsed.conversationId ?? null,
            message_id: parsed.messageId ?? null,
            bank_account_id: parsed.bankAccountId ?? null,
          })
          .select("id")
          .single();

        if (sessionInsert.error || !sessionInsert.data) {
          console.error("[/api/import/extrato] session_insert FAILED", sessionInsert.error);
          return json({ ok: false, error: `Falha ao criar sessão: ${sessionInsert.error?.message ?? "?"}` }, 500);
        }
        const sessionId = sessionInsert.data.id as string;

        // 2) Download
        const dl = await supabase.storage.from(parsed.bucket).download(parsed.path);
        if (dl.error || !dl.data) {
          const msg = `Falha ao ler arquivo (${parsed.bucket}/${parsed.path}): ${dl.error?.message ?? "desconhecido"}`;
          await supabase.from("import_sessions").update({ status: "failed", errors: [msg] }).eq("id", sessionId);
          return json({ ok: false, error: msg }, 500);
        }
        const bytes = new Uint8Array(await dl.data.arrayBuffer());

        // 3) Extração IA
        let result;
        try {
          result = await extractBankStatementFromImage({
            fileBytes: bytes,
            mime: parsed.mime,
            filename: parsed.filename,
          });
        } catch (e) {
          const msg = `Erro no extractor: ${e instanceof Error ? e.message : String(e)}`;
          console.error("[/api/import/extrato] extractor THREW", e);
          await supabase.from("import_sessions").update({ status: "failed", errors: [msg] }).eq("id", sessionId);
          return json({ ok: false, error: msg }, 500);
        }

        const { valid, errors: vErrors } = validateTransactions(result.transactions);
        const allErrors = [...result.errors, ...vErrors];

        if (valid.length === 0) {
          const detail = allErrors.length > 0 ? allErrors.join(" | ") : "IA e OCR não retornaram lançamentos.";
          console.error("[/api/import/extrato] NENHUM LANÇAMENTO", { sessionId, allErrors, raw: result.raw });
          await supabase
            .from("import_sessions")
            .update({
              status: "failed",
              errors: allErrors.length > 0 ? allErrors : [detail],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              raw_extraction: (result.raw ?? null) as any,
            })
            .eq("id", sessionId);
          return json({ ok: false, error: `Nenhum lançamento identificado. ${detail}` }, 200);
        }

        const dupes = await detectDuplicates({
          supabase,
          userId,
          bankAccountId: parsed.bankAccountId ?? null,
          txs: valid,
        });
        const dupSet = new Map(dupes.map((d) => [d.index, d]));

        let totalCredits = 0;
        let totalDebits = 0;
        for (const t of valid) {
          if (t.kind === "income") totalCredits += t.amount;
          else totalDebits += t.amount;
        }
        const net = totalCredits - totalDebits;

        const rows = valid.map((t: RawTx, i: number) => {
          const dup = dupSet.get(i);
          return {
            session_id: sessionId,
            user_id: userId,
            occurred_at: t.occurred_at,
            description: t.description,
            amount: t.amount,
            kind: (t.kind === "income" ? "income" : "expense") as "income" | "expense",
            category_hint: t.category_hint ?? null,
            confidence: t.confidence ?? null,
            is_duplicate: !!dup,
            duplicate_of: dup?.existingId ?? null,
            status: (dup ? "duplicate" : "pending") as "pending" | "duplicate",
            position: i,
            raw_data: t as unknown as Record<string, unknown>,
          };
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ins = await supabase.from("import_staging_transactions").insert(rows as any);
        if (ins.error) {
          await supabase
            .from("import_sessions")
            .update({ status: "failed", errors: [ins.error.message] })
            .eq("id", sessionId);
          return json({ ok: false, error: `Falha ao gravar staging: ${ins.error.message}` }, 500);
        }

        await supabase
          .from("import_sessions")
          .update({
            status: "review",
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            raw_extraction: (result.raw ?? null) as any,
          })
          .eq("id", sessionId);

        const payload = { ok: true, sessionId };
        console.log("[/api/import/extrato] RETURNING", JSON.stringify(payload));
        return json(payload, 200);
      },
    },
  },
});
