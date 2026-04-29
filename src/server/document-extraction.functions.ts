import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============================================================
// Document extraction — leitura de PDFs/imagens via Lovable AI Gateway
// (Gemini multimodal). Resultado é gravado em pending_ai_actions
// como sugestão aguardando confirmação do usuário.
// ============================================================

const KindSchema = z.enum([
  "fatura",
  "extrato",
  "fgts",
  "emprestimo",
  "contracheque",
]);

const ExtractInput = z.object({
  bucket: z.enum([
    "invoices",
    "bank-statements",
    "payslips",
    "fgts-statements",
    "loan-contracts",
    "images",
  ]),
  path: z.string().min(1).max(512),
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(128),
  kind: KindSchema,
  uploadedFileId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
});

type Kind = z.infer<typeof KindSchema>;

// ============= Schemas de cada tipo de documento =============
// Estes schemas definem a forma estruturada que pedimos ao modelo retornar.
// O retorno real é validado de forma tolerante (best-effort).

const schemaPrompts: Record<Kind, string> = {
  fatura: `Extraia da fatura de cartão de crédito (PDF/imagem) o seguinte JSON:
{
  "kind": "fatura",
  "card_brand": "visa|mastercard|amex|elo|hipercard|diners|other",
  "card_last_digits": "string|null",
  "reference_month": "YYYY-MM-01",
  "due_date": "YYYY-MM-DD",
  "closing_date": "YYYY-MM-DD|null",
  "total_amount": number,
  "minimum_payment": number|null,
  "transactions": [
    { "occurred_at": "YYYY-MM-DD", "description": "string", "amount": number, "installment_number": number|null, "installment_total": number|null }
  ]
}`,
  extrato: `Extraia do extrato bancário o seguinte JSON:
{
  "kind": "extrato",
  "bank": "string",
  "account_number": "string|null",
  "period_from": "YYYY-MM-DD",
  "period_to": "YYYY-MM-DD",
  "opening_balance": number|null,
  "closing_balance": number|null,
  "transactions": [
    { "occurred_at": "YYYY-MM-DD", "description": "string", "amount": number, "kind": "income|expense", "category_hint": "pix|ted|boleto|tarifa|salario|estorno|cartao|outros" }
  ]
}
Use 'income' para créditos e 'expense' para débitos. amount sempre positivo.`,
  fgts: `Extraia do extrato do FGTS o seguinte JSON:
{
  "kind": "fgts",
  "employer": "string",
  "cnpj": "string|null",
  "status": "ativa|inativa",
  "balance": number,
  "monthly_deposit": number,
  "jam_month": number,
  "last_movement": "YYYY-MM-DD|null",
  "entries": [
    { "occurred_at": "YYYY-MM-DD", "entry_type": "deposito|jam|saque|outro", "amount": number, "notes": "string|null" }
  ]
}`,
  emprestimo: `Extraia do contrato/extrato de empréstimo ou financiamento o seguinte JSON:
{
  "kind": "emprestimo",
  "institution": "string",
  "debt_type": "credito_pessoal|consignado|financiamento_imovel|financiamento_veiculo|cartao|cheque_especial|outros",
  "original_amount": number,
  "current_balance": number,
  "interest_rate": number,
  "cet": number|null,
  "installments_total": number,
  "installments_paid": number,
  "monthly_payment": number,
  "due_day": number,
  "status": "em_dia|atrasado|quitado|renegociado",
  "collateral": "string|null"
}
interest_rate em % ao mês ou ano (use o que estiver no documento; se houver dúvida, mensal).`,
  contracheque: `Extraia do contracheque/holerite o seguinte JSON:
{
  "kind": "contracheque",
  "employer": "string",
  "reference_month": "YYYY-MM-01",
  "gross_amount": number,
  "net_amount": number,
  "inss": number,
  "irrf": number,
  "fgts_amount": number,
  "benefits": number,
  "notes": "string|null"
}`,
};

const summaryPrompt: Record<Kind, string> = {
  fatura: "Resuma a fatura em 1-2 linhas (cartão, mês de referência, total, vencimento).",
  extrato: "Resuma o extrato em 1-2 linhas (banco, período, nº de lançamentos, saldo).",
  fgts: "Resuma o FGTS em 1-2 linhas (empregador, status, saldo, depósito mensal).",
  emprestimo: "Resuma o empréstimo em 1-2 linhas (instituição, saldo devedor, parcela, parcelas restantes).",
  contracheque: "Resuma o contracheque em 1-2 linhas (empregador, mês, bruto, líquido).",
};

function buildExtractionMessages(kind: Kind, fileBase64: string, mime: string, filename: string) {
  const sys = `Você é um analista financeiro brasileiro especializado em leitura de documentos.
Extraia dados ESTRUTURADOS do documento anexo seguindo EXATAMENTE o schema JSON solicitado.
Regras:
- Responda SOMENTE com JSON válido (sem markdown, sem cercas \`\`\`).
- Use ponto como separador decimal. Valores numéricos sem prefixo R$.
- Datas no formato ISO (YYYY-MM-DD). Se uma data não estiver clara, use null.
- Não invente dados. Se um campo não existir no documento, use null ou 0.
- Para arrays (lançamentos), inclua TODOS os itens visíveis no documento.
- Idioma: português do Brasil para descrições.`;

  const userText = `Documento: ${filename} (${mime})
Tipo: ${kind}

${schemaPrompts[kind]}

Retorne APENAS o JSON. Nada mais.`;

  return [
    { role: "system", content: sys },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        {
          type: "image_url",
          image_url: { url: `data:${mime};base64,${fileBase64}` },
        },
      ],
    },
  ];
}

// Best-effort JSON parser: aceita resposta com cercas markdown ou texto extra.
function safeParseJson(s: string): unknown {
  const trimmed = s.trim();
  // Remove cercas markdown se houver
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Tenta achar o primeiro { ... } balanceado
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(candidate.slice(first, last + 1));
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

function buildHumanSummary(kind: Kind, payload: Record<string, unknown>): string {
  const fmt = (n: unknown) =>
    typeof n === "number"
      ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—";
  const p = payload as Record<string, unknown>;
  switch (kind) {
    case "fatura":
      return `Fatura ${String(p.card_brand ?? "")} **** ${String(p.card_last_digits ?? "----")} · ref ${String(p.reference_month ?? "—").slice(0, 7)} · total ${fmt(p.total_amount)} · vence ${String(p.due_date ?? "—")}`;
    case "extrato":
      return `Extrato ${String(p.bank ?? "")} · ${String(p.period_from ?? "—")} → ${String(p.period_to ?? "—")} · ${(p.transactions as unknown[] | undefined)?.length ?? 0} lançamentos`;
    case "fgts":
      return `FGTS ${String(p.employer ?? "")} · saldo ${fmt(p.balance)} · depósito ${fmt(p.monthly_deposit)} · JAM ${fmt(p.jam_month)}`;
    case "emprestimo":
      return `Empréstimo ${String(p.institution ?? "")} · saldo ${fmt(p.current_balance)} · parcela ${fmt(p.monthly_payment)} (${String(p.installments_paid ?? 0)}/${String(p.installments_total ?? 0)})`;
    case "contracheque":
      return `Contracheque ${String(p.employer ?? "")} · ref ${String(p.reference_month ?? "—").slice(0, 7)} · líquido ${fmt(p.net_amount)}`;
    default:
      return summaryPrompt[kind];
  }
}

export const extractDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ExtractInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sbTyped, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = sbTyped as any;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error: "LOVABLE_API_KEY ausente. Configure o gateway de IA.",
      };
    }

    // 1) Baixa o arquivo do Storage privado (RLS aplicada)
    const dl = await supabase.storage.from(data.bucket).download(data.path);
    if (dl.error || !dl.data) {
      return { ok: false as const, error: `Falha ao ler arquivo: ${dl.error?.message ?? "desconhecido"}` };
    }
    const arrayBuffer = await dl.data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // Conversão eficiente para base64
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    const base64 = btoa(binary);

    // Tamanho máximo razoável (~8MB de base64 ~ 6MB binário)
    if (base64.length > 8_500_000) {
      return {
        ok: false as const,
        error: "Arquivo muito grande para leitura por IA (máx ~6MB).",
      };
    }

    // 2) Chama o gateway com mensagem multimodal
    const messages = buildExtractionMessages(data.kind, base64, data.mime, data.filename);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const status = res.status;
      let detail = "";
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
      console.error("Extraction gateway error", status, detail);
      if (status === 429) return { ok: false as const, error: "Limite de uso atingido. Aguarde e tente novamente." };
      if (status === 402) return { ok: false as const, error: "Créditos do gateway de IA esgotados." };
      return { ok: false as const, error: `Gateway respondeu ${status}.` };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(content);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false as const, error: "A IA não conseguiu estruturar este documento. Tente um arquivo mais legível." };
    }

    const payload = parsed as Record<string, unknown>;
    const summary = buildHumanSummary(data.kind, payload);

    // 3) Grava como pending_ai_action (aguardando confirmação)
    const insert = await supabase
      .from("pending_ai_actions")
      .insert({
        user_id: userId,
        kind: data.kind,
        status: "pending",
        source_file_id: data.uploadedFileId ?? null,
        conversation_id: data.conversationId ?? null,
        message_id: data.messageId ?? null,
        payload,
        summary,
      })
      .select("id")
      .single();

    if (insert.error) {
      return { ok: false as const, error: `Falha ao salvar sugestão: ${insert.error.message}` };
    }

    return {
      ok: true as const,
      pendingId: (insert.data as { id: string }).id,
      kind: data.kind,
      summary,
      payload: payload as Record<string, unknown> & { [k: string]: unknown },
    } as {
      ok: true;
      pendingId: string;
      kind: Kind;
      summary: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: Record<string, any>;
    };
  });

// ============================================================
// Confirmação: grava o payload nas tabelas finais
// ============================================================

const ConfirmInput = z.object({
  pendingId: z.string().uuid(),
  // Permite o usuário ajustar o payload antes de confirmar
  overrides: z.record(z.string(), z.unknown()).optional(),
});

const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : Number(v ?? d);
  return Number.isFinite(n) ? n : d;
};
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

export const confirmPendingAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ConfirmInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sbTyped, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = sbTyped as any;

    const { data: pending, error: pErr } = await supabase
      .from("pending_ai_actions")
      .select("*")
      .eq("id", data.pendingId)
      .eq("user_id", userId)
      .maybeSingle();

    if (pErr || !pending) {
      return { ok: false as const, error: "Sugestão não encontrada." };
    }
    if ((pending as { status: string }).status !== "pending") {
      return { ok: false as const, error: "Esta sugestão já foi processada." };
    }

    const p = {
      ...((pending as { payload: Record<string, unknown> }).payload ?? {}),
      ...(data.overrides ?? {}),
    } as Record<string, unknown>;
    const kind = (pending as { kind: Kind }).kind;

    let createdSummary = "";

    try {
      if (kind === "fatura") {
        // Cria/encontra cartão pelos últimos 4 dígitos (best-effort)
        let cardId: string | null = null;
        const last = str(p.card_last_digits);
        if (last) {
          const { data: existing } = await supabase
            .from("credit_cards")
            .select("id")
            .eq("last_digits", last)
            .limit(1);
          if (existing && existing.length > 0) {
            cardId = (existing[0] as { id: string }).id;
          }
        }
        if (!cardId) {
          const { data: card, error } = await supabase
            .from("credit_cards")
            .insert({
              user_id: userId,
              name: `Cartão ${last || "novo"}`,
              brand: str(p.card_brand, "other"),
              last_digits: last || null,
              credit_limit: 0,
              closing_day: 1,
              due_day: 10,
            })
            .select("id")
            .single();
          if (error) throw error;
          cardId = (card as { id: string }).id;
        }

        const { data: invoice, error: invErr } = await supabase
          .from("invoices")
          .insert({
            user_id: userId,
            credit_card_id: cardId,
            reference_month: str(p.reference_month) || new Date().toISOString().slice(0, 10),
            due_date: str(p.due_date) || new Date().toISOString().slice(0, 10),
            total_amount: num(p.total_amount),
            status: "open",
          })
          .select("id")
          .single();
        if (invErr) throw invErr;
        const invoiceId = (invoice as { id: string }).id;

        const txs = (p.transactions as Record<string, unknown>[] | undefined) ?? [];
        if (txs.length > 0) {
          const rows = txs.slice(0, 500).map((t) => ({
            user_id: userId,
            invoice_id: invoiceId,
            occurred_at: str(t.occurred_at) || new Date().toISOString().slice(0, 10),
            description: str(t.description, "Lançamento"),
            amount: num(t.amount),
            installment_number: t.installment_number != null ? num(t.installment_number) : null,
            installment_total: t.installment_total != null ? num(t.installment_total) : null,
          }));
          await supabase.from("invoice_transactions").insert(rows);
        }
        createdSummary = `Fatura criada com ${txs.length} lançamentos.`;
      } else if (kind === "extrato") {
        // Encontra/cria conta pelo banco
        const bank = str(p.bank, "Banco");
        let accountId: string | null = null;
        const { data: existing } = await supabase
          .from("bank_accounts")
          .select("id")
          .ilike("bank", bank)
          .limit(1);
        if (existing && existing.length > 0) {
          accountId = (existing[0] as { id: string }).id;
        } else {
          const { data: acc, error } = await supabase
            .from("bank_accounts")
            .insert({
              user_id: userId,
              bank,
              account_number: str(p.account_number) || null,
              account_type: "checking",
              balance: num(p.closing_balance),
            })
            .select("id")
            .single();
          if (error) throw error;
          accountId = (acc as { id: string }).id;
        }

        const txs = (p.transactions as Record<string, unknown>[] | undefined) ?? [];
        if (txs.length > 0) {
          const rows = txs.slice(0, 1000).map((t) => ({
            user_id: userId,
            bank_account_id: accountId,
            occurred_at: str(t.occurred_at) || new Date().toISOString().slice(0, 10),
            description: str(t.description, "Lançamento"),
            amount: Math.abs(num(t.amount)),
            kind: str(t.kind) === "income" ? "income" : "expense",
          }));
          await supabase.from("bank_transactions").insert(rows);
        }
        createdSummary = `Extrato importado: ${txs.length} lançamentos em ${bank}.`;
      } else if (kind === "fgts") {
        const { data: account, error } = await supabase
          .from("fgts_accounts")
          .insert({
            user_id: userId,
            employer: str(p.employer, "Empregador"),
            cnpj: str(p.cnpj) || null,
            status: str(p.status) === "inativa" ? "inativa" : "ativa",
            balance: num(p.balance),
            monthly_deposit: num(p.monthly_deposit),
            jam_month: num(p.jam_month),
            last_movement: str(p.last_movement) || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        const accId = (account as { id: string }).id;

        const entries = (p.entries as Record<string, unknown>[] | undefined) ?? [];
        if (entries.length > 0) {
          const validTypes = new Set(["deposito", "jam", "saque", "outro"]);
          const rows = entries.slice(0, 500).map((e) => ({
            user_id: userId,
            fgts_account_id: accId,
            occurred_at: str(e.occurred_at) || new Date().toISOString().slice(0, 10),
            entry_type: validTypes.has(str(e.entry_type)) ? str(e.entry_type) : "outro",
            amount: num(e.amount),
            notes: str(e.notes) || null,
          }));
          await supabase.from("fgts_entries").insert(rows);
        }
        createdSummary = `Conta FGTS de ${str(p.employer)} criada.`;
      } else if (kind === "emprestimo") {
        const validDebt = new Set([
          "credito_pessoal",
          "consignado",
          "financiamento_imovel",
          "financiamento_veiculo",
          "cartao",
          "cheque_especial",
          "outros",
        ]);
        const validStatus = new Set(["em_dia", "atrasado", "quitado", "renegociado"]);
        const { error } = await supabase.from("loan_accounts").insert({
          user_id: userId,
          institution: str(p.institution, "Instituição"),
          debt_type: validDebt.has(str(p.debt_type)) ? str(p.debt_type) : "outros",
          original_amount: num(p.original_amount),
          current_balance: num(p.current_balance),
          interest_rate: num(p.interest_rate),
          cet: p.cet != null ? num(p.cet) : null,
          installments_total: Math.max(0, Math.floor(num(p.installments_total))),
          installments_paid: Math.max(0, Math.floor(num(p.installments_paid))),
          monthly_payment: num(p.monthly_payment),
          due_day: Math.min(31, Math.max(1, Math.floor(num(p.due_day, 10)))),
          status: validStatus.has(str(p.status)) ? str(p.status) : "em_dia",
          collateral: str(p.collateral) || null,
        });
        if (error) throw error;
        createdSummary = `Empréstimo ${str(p.institution)} adicionado.`;
      } else if (kind === "contracheque") {
        const { error } = await supabase.from("payslips").insert({
          user_id: userId,
          employer: str(p.employer, "Empregador"),
          reference_month: str(p.reference_month) || new Date().toISOString().slice(0, 10),
          gross_amount: num(p.gross_amount),
          net_amount: num(p.net_amount),
          inss: num(p.inss),
          irrf: num(p.irrf),
          fgts_amount: num(p.fgts_amount),
          benefits: num(p.benefits),
          notes: str(p.notes) || null,
        });
        if (error) throw error;
        createdSummary = `Contracheque ${str(p.employer)} adicionado.`;
      }

      await supabase
        .from("pending_ai_actions")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", data.pendingId);

      return { ok: true as const, summary: createdSummary };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao gravar dados";
      return { ok: false as const, error: message };
    }
  });

export const discardPendingAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pendingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("pending_ai_actions")
      .update({ status: "discarded", discarded_at: new Date().toISOString() })
      .eq("id", data.pendingId)
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
