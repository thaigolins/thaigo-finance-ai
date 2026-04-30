import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Auth manual via token passado no input (mesmo padrão usado em startImport).
// Retorna { supabase, userId } ou um erro pronto para devolver ao cliente.
async function authWithToken(token: string): Promise<
  | { ok: true; supabase: any; userId: string }
  | { ok: false; error: string }
> {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return { ok: false, error: "Sessão inválida. Faça login novamente." };
  }
  return { ok: true, supabase, userId: userData.user.id as string };
}

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
  token: z.string().min(1),
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
  fgts: `Extraia do extrato do FGTS o seguinte JSON com TODOS os lançamentos:
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
    {
      "occurred_at": "YYYY-MM-DD",
      "entry_type": "deposito|jam|saque|outro",
      "amount": number,
      "notes": "string|null"
    }
  ]
}
REGRAS CRÍTICAS:
- entries deve conter TODOS os lançamentos da tabela do documento, sem exceção
- Para cada linha da tabela: DATA | LANÇAMENTO | VALOR | TOTAL
- entry_type: "deposito" para linhas com "115-DEPOSITO" ou "DEPOSITO"
- entry_type: "jam" para linhas com "CREDITO DE JAM", "AC CRED", "AC AUT", "REGULARIZACAO"
- entry_type: "saque" para linhas com "SAQUE", negativo
- amount: sempre positivo (use Math.abs do valor)
- balance = valor da última linha da coluna TOTAL
- monthly_deposit = média dos últimos 3 depósitos mensais
- jam_month = valor do JAM mais recente
- last_movement = data do último lançamento
- NÃO omita nenhum lançamento. O documento pode ter 200+ linhas — extraia TODAS.`,
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

const fgtsHeaderPrompt = `Extraia apenas o cabeçalho do extrato FGTS:
{
  "kind": "fgts",
  "employer": "string",
  "cnpj": "string|null",
  "status": "ativa",
  "balance": number,
  "monthly_deposit": number,
  "jam_month": number,
  "last_movement": "YYYY-MM-DD|null"
}`;

function buildEntriesMessages(
  fileBase64: string,
  mime: string,
  filename: string,
  half: "all" | "first" | "second" = "all",
) {
  const halfInstruction =
    half === "first"
      ? `\n\nIMPORTANTE — EXTRAIA APENAS A PRIMEIRA METADE DO DOCUMENTO:\n- Extraia somente os lançamentos da PRIMEIRA METADE da tabela (cronologicamente os MAIS ANTIGOS).\n- Se o documento tem N lançamentos, retorne aproximadamente os primeiros N/2.\n- Comece pelo PRIMEIRO lançamento (mais antigo) e pare no meio da tabela.\n- NÃO inclua os lançamentos da segunda metade.`
      : half === "second"
        ? `\n\nIMPORTANTE — EXTRAIA APENAS A SEGUNDA METADE DO DOCUMENTO:\n- Extraia somente os lançamentos da SEGUNDA METADE da tabela (cronologicamente os MAIS RECENTES).\n- Se o documento tem N lançamentos, retorne aproximadamente os últimos N/2.\n- Comece exatamente no meio da tabela e vá até o ÚLTIMO lançamento (mais recente).\n- NÃO inclua os lançamentos da primeira metade.`
        : "";

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Documento: ${filename} (${mime})

Extraia os lançamentos desta tabela de extrato FGTS e retorne APENAS este JSON sem markdown:
{
  "entries": [
    {"occurred_at": "YYYY-MM-DD", "entry_type": "deposito|jam|saque|outro", "amount": number, "notes": "descrição do lançamento"}
  ]
}

Regras:
- occurred_at: data da coluna DATA no formato YYYY-MM-DD
- entry_type: "deposito" para 115-DEPOSITO, "jam" para CREDITO DE JAM/AC CRED/AC AUT/REGULARIZACAO/AC REPOSICAO, "saque" para SAQUE DEP/SAQUE JAM, "outro" para os demais
- amount: valor POSITIVO da coluna VALOR (ignore negativos, use Math.abs)
- notes: texto da coluna LANÇAMENTO
- Ignore a linha "SALDO ANTERIOR"
- Não omita nenhuma linha da metade solicitada.${halfInstruction}`,
    },
    mime === "application/pdf"
      ? {
          type: "file",
          file: { filename, file_data: `data:${mime};base64,${fileBase64}` },
        }
      : {
          type: "image_url",
          image_url: { url: `data:${mime};base64,${fileBase64}` },
        },
  ];

  return [
    {
      role: "system",
      content: "Você é um OCR especializado em extratos FGTS brasileiros. Extraia lançamentos da tabela do documento conforme instruído.",
    },
    {
      role: "user",
      content,
    },
  ];
}

function buildFgtsHeaderMessages(fileBase64: string, mime: string, filename: string) {
  return [
    {
      role: "system",
      content: "Você é um analista financeiro especializado em extratos FGTS brasileiros. Extraia dados do cabeçalho do documento.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Extraia APENAS o cabeçalho deste extrato FGTS (${filename}) e retorne este JSON exato sem markdown:
{
  "kind": "fgts",
  "employer": "nome do empregador",
  "cnpj": "CNPJ do empregador ou null",
  "status": "ativa",
  "balance": número do saldo final (última linha da coluna TOTAL),
  "monthly_deposit": número do depósito mensal mais recente (linhas 115-DEPOSITO),
  "jam_month": número do JAM mais recente (linhas CREDITO DE JAM),
  "last_movement": "YYYY-MM-DD da data do último lançamento"
}
IMPORTANTE:
- balance = valor da última linha da coluna TOTAL do extrato
- monthly_deposit = valor da linha 115-DEPOSITO mais recente
- jam_month = valor da linha CREDITO DE JAM mais recente (ex: se aparecer "R$ 350,57" use 350.57)
- Nunca retorne 0 para jam_month se houver linhas CREDITO DE JAM no documento`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mime};base64,${fileBase64}` },
        },
      ],
    },
  ];
}

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

function safeParseJson(s: string): unknown {
  const trimmed = s.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAudit(supabase: any, params: {
  userId: string;
  action: "extract" | "confirm" | "discard" | "duplicate_detected" | "partial_confirm" | "edit_before_confirm";
  docKind?: Kind | null;
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

function parseFgtsPdfText(text: string): Array<{
  occurred_at: string;
  entry_type: string;
  amount: number;
  notes: string;
}> {
  const entries: Array<{ occurred_at: string; entry_type: string; amount: number; notes: string }> = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const dateRe = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+([-]?R\$\s*[\d.,]+)\s+(R\$\s*[\d.,]+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(dateRe);
    if (m) {
      const dd = m[1], mm = m[2], yyyy = m[3];
      const desc = m[4].trim();
      const valStr = m[5].replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim();
      const amount = Math.abs(parseFloat(valStr));
      if (!isFinite(amount) || amount === 0) continue;

      const occurred_at = `${yyyy}-${mm}-${dd}`;
      const descLower = desc.toLowerCase();
      let entry_type = "outro";
      if (descLower.includes("115-deposito") || descLower.includes("deposito")) entry_type = "deposito";
      else if (
        descLower.includes("credito de jam") ||
        descLower.includes("ac cred") ||
        descLower.includes("ac aut") ||
        descLower.includes("regularizacao")
      ) entry_type = "jam";
      else if (descLower.includes("saque")) entry_type = "saque";

      entries.push({ occurred_at, entry_type, amount, notes: desc });
    }
  }
  return entries;
}

export const extractDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => ExtractInput.parse(d))
  .handler(async ({ data }) => {
    const auth = await authWithToken(data.token);
    if (!auth.ok) return { ok: false as const, error: auth.error };
    const { supabase, userId } = auth;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "LOVABLE_API_KEY ausente. Configure o gateway de IA." };
    }

    const dl = await supabase.storage.from(data.bucket).download(data.path);
    if (dl.error || !dl.data) {
      return { ok: false as const, error: `Falha ao ler arquivo: ${dl.error?.message ?? "desconhecido"}` };
    }
    const arrayBuffer = await dl.data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    const base64 = btoa(binary);

    if (base64.length > 8_500_000) {
      return { ok: false as const, error: "Arquivo muito grande para leitura por IA (máx ~6MB)." };
    }

    let payload: Record<string, unknown>;

    if (data.kind === "fgts") {
      // Etapa 1: cabeçalho via Gemini Flash
      const headerMessages = buildFgtsHeaderMessages(base64, data.mime, data.filename);
      let headerParsed: Record<string, unknown> = {};
      try {
        const headerRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: headerMessages,
            temperature: 0.1,
            max_tokens: 1000,
          }),
        });
        if (headerRes.ok) {
          const hj = (await headerRes.json()) as { choices?: { message?: { content?: string } }[] };
          const hc = hj.choices?.[0]?.message?.content ?? "";
          headerParsed = (safeParseJson(hc) as Record<string, unknown> | null) ?? {};
          console.log("[extractDocument] FGTS header:", JSON.stringify(headerParsed).slice(0, 200));
        } else {
          console.error("[extractDocument] FGTS header gateway error", headerRes.status);
        }
      } catch (e) {
        console.error("[extractDocument] FGTS header error:", e);
      }

      // Etapa 2: processa cada página do PDF separadamente via Gemini
      let fgtsEntries: unknown[] = [];

      try {
        // Divide o PDF em chunks de páginas simulados via múltiplas chamadas
        // Cada chamada pede uma faixa de lançamentos específica
        const BATCH_PROMPTS = [
          "Extraia APENAS os lançamentos da PRIMEIRA METADE do documento (primeiras páginas).",
          "Extraia APENAS os lançamentos da SEGUNDA METADE do documento (últimas páginas).",
        ];

        for (const batchPrompt of BATCH_PROMPTS) {
          try {
            const batchRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-pro",
                messages: [
                  {
                    role: "system",
                    content: "Você é um especialista em extratos FGTS. Extraia lançamentos com precisão absoluta.",
                  },
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: `${batchPrompt}

Retorne APENAS este JSON sem markdown:
{"entries": [{"occurred_at": "YYYY-MM-DD", "entry_type": "deposito|jam|saque|outro", "amount": 0.00, "notes": "descrição"}]}

Regras:
- entry_type: "deposito" para 115-DEPOSITO, "jam" para CREDITO DE JAM/AC CRED/AC AUT/REGULARIZACAO/AC REPOSICAO, "saque" para SAQUE DEP/SAQUE JAM
- amount: valor POSITIVO da coluna VALOR
- notes: texto da coluna LANÇAMENTO
- Ignore SALDO ANTERIOR e cabeçalhos
- Inclua TODOS os lançamentos visíveis nessa metade`,
                      },
                      {
                        type: "image_url",
                        image_url: { url: `data:${data.mime};base64,${base64}` },
                      },
                    ],
                  },
                ],
                temperature: 0.1,
                max_tokens: 8000,
              }),
            });
            if (batchRes.ok) {
              const bj = await batchRes.json() as { choices?: { message?: { content?: string } }[] };
              const bc = bj.choices?.[0]?.message?.content ?? "";
              console.log("[extractDocument] FGTS batch raw:", bc.slice(0, 200));
              const bp = (safeParseJson(bc) as Record<string, unknown>) ?? {};
              const arr = (bp as { entries?: unknown }).entries;
              if (Array.isArray(arr)) {
                fgtsEntries = [...fgtsEntries, ...arr];
              }
            }
          } catch (e) {
            console.error("[extractDocument] FGTS batch error:", e);
          }
        }

        // Remove duplicatas por occurred_at + amount + notes
        const seen = new Set<string>();
        fgtsEntries = fgtsEntries.filter((e: any) => {
          const key = `${e.occurred_at}_${e.amount}_${e.notes}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        console.log("[extractDocument] FGTS total entries after dedup:", fgtsEntries.length);
      } catch (e) {
        console.error("[extractDocument] FGTS entries error:", e);
      }

      console.log("[extractDocument] FGTS FINAL entries:", fgtsEntries.length);
      payload = { ...headerParsed, kind: "fgts", entries: fgtsEntries };
    } else {
      const messages = buildExtractionMessages(data.kind, base64, data.mime, data.filename);
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          temperature: 0.1,
          max_tokens: 8000,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const status = res.status;
        let detail = "";
        try { detail = await res.text(); } catch { /* ignore */ }
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
      payload = parsed as Record<string, unknown>;
    }


    const summary = buildHumanSummary(data.kind, payload);

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

    const pendingId = (insert.data as { id: string }).id;

    await logAudit(supabase, {
      userId,
      action: "extract",
      docKind: data.kind,
      pendingId,
      message: summary,
      after: payload,
    });

    return {
      ok: true as const,
      pendingId,
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
// Detecção de duplicidade
// ============================================================

const DuplicateInput = z.object({
  token: z.string().min(1),
  pendingId: z.string().uuid(),
  overrides: z.record(z.string(), z.unknown()).optional(),
});

export const checkDuplicate = createServerFn({ method: "POST" })
  .inputValidator((d) => DuplicateInput.parse(d))
  .handler(async ({ data }) => {
    const auth = await authWithToken(data.token);
    if (!auth.ok) return { ok: false as const, error: auth.error, duplicates: [] as { reason: string }[] };
    const { supabase, userId } = auth;

    const { data: pending } = await supabase
      .from("pending_ai_actions")
      .select("kind, payload, source_file_id")
      .eq("id", data.pendingId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!pending) return { ok: true as const, duplicates: [] };

    const kind = (pending as { kind: Kind }).kind;
    const p = {
      ...((pending as { payload: Record<string, unknown> }).payload ?? {}),
      ...(data.overrides ?? {}),
    } as Record<string, unknown>;

    const duplicates: { table: string; id: string; reason: string }[] = [];

    try {
      if (kind === "fatura") {
        const refMonth = String(p.reference_month ?? "").slice(0, 10);
        const total = Number(p.total_amount ?? 0);
        const last = String(p.card_last_digits ?? "");
        if (refMonth && last) {
          const { data: cards } = await supabase
            .from("credit_cards").select("id").eq("last_digits", last).limit(5);
          const cardIds = (cards as { id: string }[] | null)?.map((c) => c.id) ?? [];
          if (cardIds.length > 0) {
            const { data: invs } = await supabase
              .from("invoices")
              .select("id, total_amount, reference_month, credit_card_id")
              .in("credit_card_id", cardIds)
              .eq("reference_month", refMonth);
            for (const inv of (invs as { id: string; total_amount: number }[] | null) ?? []) {
              const diff = Math.abs(Number(inv.total_amount) - total);
              if (diff < Math.max(1, total * 0.02)) {
                duplicates.push({ table: "invoices", id: inv.id, reason: `Já existe fatura ${refMonth.slice(0,7)} com total similar` });
              }
            }
          }
        }
      } else if (kind === "extrato") {
        const bank = String(p.bank ?? "");
        const from = String(p.period_from ?? "");
        const to = String(p.period_to ?? "");
        if (bank && from) {
          const { data: accs } = await supabase
            .from("bank_accounts").select("id").ilike("bank", bank).limit(5);
          const accIds = (accs as { id: string }[] | null)?.map((a) => a.id) ?? [];
          if (accIds.length > 0 && to) {
            const { data: txs } = await supabase
              .from("bank_transactions")
              .select("id")
              .in("bank_account_id", accIds)
              .gte("occurred_at", from)
              .lte("occurred_at", to)
              .limit(1);
            if (txs && txs.length > 0) {
              duplicates.push({ table: "bank_transactions", id: accIds[0], reason: `Já há lançamentos em ${bank} entre ${from} e ${to}` });
            }
          }
        }
      } else if (kind === "fgts") {
        const employer = String(p.employer ?? "");
        const lastMov = String(p.last_movement ?? "");
        if (employer) {
          const q = supabase.from("fgts_accounts").select("id, last_movement").ilike("employer", employer);
          const { data: rows } = await q.limit(5);
          for (const r of (rows as { id: string; last_movement: string | null }[] | null) ?? []) {
            if (!lastMov || r.last_movement === lastMov) {
              duplicates.push({ table: "fgts_accounts", id: r.id, reason: `Já existe conta FGTS de ${employer}` });
            }
          }
        }
      } else if (kind === "emprestimo") {
        const inst = String(p.institution ?? "");
        const balance = Number(p.current_balance ?? 0);
        const parcela = Number(p.monthly_payment ?? 0);
        if (inst) {
          const { data: rows } = await supabase
            .from("loan_accounts").select("id, current_balance, monthly_payment").ilike("institution", inst).limit(10);
          for (const r of (rows as { id: string; current_balance: number; monthly_payment: number }[] | null) ?? []) {
            const sameBal = Math.abs(Number(r.current_balance) - balance) < Math.max(50, balance * 0.05);
            const samePar = Math.abs(Number(r.monthly_payment) - parcela) < Math.max(5, parcela * 0.05);
            if (sameBal && samePar) {
              duplicates.push({ table: "loan_accounts", id: r.id, reason: `Já há empréstimo em ${inst} com saldo/parcela similar` });
            }
          }
        }
      } else if (kind === "contracheque") {
        const employer = String(p.employer ?? "");
        const ref = String(p.reference_month ?? "").slice(0, 10);
        if (employer && ref) {
          const { data: rows } = await supabase
            .from("payslips").select("id").ilike("employer", employer).eq("reference_month", ref).limit(1);
          if (rows && rows.length > 0) {
            duplicates.push({ table: "payslips", id: (rows[0] as { id: string }).id, reason: `Já existe contracheque de ${employer} em ${ref.slice(0,7)}` });
          }
        }
      }
    } catch (e) {
      console.error("checkDuplicate error", e);
    }

    if (duplicates.length > 0) {
      await logAudit(supabase, {
        userId, action: "duplicate_detected", docKind: kind, pendingId: data.pendingId,
        status: "warning", message: duplicates.map((d) => d.reason).join(" | "),
        after: duplicates,
      });
    }

    return { ok: true as const, duplicates };
  });

// ============================================================
// Confirmação: grava o payload nas tabelas finais
// Suporta overrides (edição) e selectedIndices (confirmação parcial de lançamentos)
// ============================================================

const ConfirmInput = z.object({
  token: z.string().min(1),
  pendingId: z.string().uuid(),
  overrides: z.record(z.string(), z.unknown()).optional(),
  selectedTxIndices: z.array(z.number().int().min(0)).optional(),
  ignoreDuplicate: z.boolean().optional(),
});

const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : Number(v ?? d);
  return Number.isFinite(n) ? n : d;
};
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

export const confirmPendingAction = createServerFn({ method: "POST" })
  .inputValidator((d) => ConfirmInput.parse(d))
  .handler(async ({ data }) => {
    const auth = await authWithToken(data.token);
    if (!auth.ok) return { ok: false as const, error: auth.error };
    const { supabase, userId } = auth;

    const { data: pending, error: pErr } = await supabase
      .from("pending_ai_actions").select("*").eq("id", data.pendingId).eq("user_id", userId).maybeSingle();

    if (pErr || !pending) return { ok: false as const, error: "Sugestão não encontrada." };
    if ((pending as { status: string }).status !== "pending") {
      return { ok: false as const, error: "Esta sugestão já foi processada." };
    }

    const beforePayload = (pending as { payload: Record<string, unknown> }).payload ?? {};
    const p = { ...beforePayload, ...(data.overrides ?? {}) } as Record<string, unknown>;
    const kind = (pending as { kind: Kind }).kind;

    if (data.overrides && Object.keys(data.overrides).length > 0) {
      await logAudit(supabase, {
        userId, action: "edit_before_confirm", docKind: kind, pendingId: data.pendingId,
        before: beforePayload, after: p,
      });
    }

    let createdSummary = "";
    let partial = false;

    try {
      if (kind === "fatura") {
        let cardId: string | null = null;
        const last = str(p.card_last_digits);
        if (last) {
          const { data: existing } = await supabase
            .from("credit_cards").select("id").eq("last_digits", last).limit(1);
          if (existing && existing.length > 0) cardId = (existing[0] as { id: string }).id;
        }
        if (!cardId) {
          const { data: card, error } = await supabase.from("credit_cards").insert({
            user_id: userId, name: `Cartão ${last || "novo"}`,
            brand: str(p.card_brand, "other"), last_digits: last || null,
            credit_limit: 0, closing_day: 1, due_day: 10,
          }).select("id").single();
          if (error) throw error;
          cardId = (card as { id: string }).id;
        }

        const { data: invoice, error: invErr } = await supabase.from("invoices").insert({
          user_id: userId, credit_card_id: cardId,
          reference_month: str(p.reference_month) || new Date().toISOString().slice(0, 10),
          due_date: str(p.due_date) || new Date().toISOString().slice(0, 10),
          total_amount: num(p.total_amount), status: "open",
        }).select("id").single();
        if (invErr) throw invErr;
        const invoiceId = (invoice as { id: string }).id;

        let txs = (p.transactions as Record<string, unknown>[] | undefined) ?? [];
        if (data.selectedTxIndices && data.selectedTxIndices.length > 0) {
          const set = new Set(data.selectedTxIndices);
          txs = txs.filter((_, i) => set.has(i));
          partial = true;
        }
        if (txs.length > 0) {
          const rows = txs.slice(0, 500).map((t) => ({
            user_id: userId, invoice_id: invoiceId,
            occurred_at: str(t.occurred_at) || new Date().toISOString().slice(0, 10),
            description: str(t.description, "Lançamento"),
            amount: num(t.amount),
            installment_number: t.installment_number != null ? num(t.installment_number) : null,
            installment_total: t.installment_total != null ? num(t.installment_total) : null,
          }));
          await supabase.from("invoice_transactions").insert(rows);
        }
        createdSummary = `Fatura criada com ${txs.length} lançamentos${partial ? " (seleção parcial)" : ""}.`;
      } else if (kind === "extrato") {
        const bank = str(p.bank, "Banco");
        let accountId: string | null = null;
        const { data: existing } = await supabase
          .from("bank_accounts").select("id").ilike("bank", bank).limit(1);
        if (existing && existing.length > 0) accountId = (existing[0] as { id: string }).id;
        else {
          const { data: acc, error } = await supabase.from("bank_accounts").insert({
            user_id: userId, bank,
            account_number: str(p.account_number) || null,
            account_type: "checking", balance: num(p.closing_balance),
          }).select("id").single();
          if (error) throw error;
          accountId = (acc as { id: string }).id;
        }

        let txs = (p.transactions as Record<string, unknown>[] | undefined) ?? [];
        if (data.selectedTxIndices && data.selectedTxIndices.length > 0) {
          const set = new Set(data.selectedTxIndices);
          txs = txs.filter((_, i) => set.has(i));
          partial = true;
        }
        if (txs.length > 0) {
          const rows = txs.slice(0, 1000).map((t) => ({
            user_id: userId, bank_account_id: accountId,
            occurred_at: str(t.occurred_at) || new Date().toISOString().slice(0, 10),
            description: str(t.description, "Lançamento"),
            amount: Math.abs(num(t.amount)),
            kind: str(t.kind) === "income" ? "income" : "expense",
          }));
          await supabase.from("bank_transactions").insert(rows);
        }
        createdSummary = `Extrato importado: ${txs.length} lançamentos em ${bank}${partial ? " (seleção parcial)" : ""}.`;
      } else if (kind === "fgts") {
        const { data: account, error } = await supabase.from("fgts_accounts").insert({
          user_id: userId, employer: str(p.employer, "Empregador"),
          cnpj: str(p.cnpj) || null,
          status: str(p.status) === "inativa" ? "inativa" : "ativa",
          balance: num(p.balance), monthly_deposit: num(p.monthly_deposit),
          jam_month: num(p.jam_month), last_movement: str(p.last_movement) || null,
        }).select("id").single();
        if (error) throw error;
        const accId = (account as { id: string }).id;

        const entries = (p.entries as Record<string, unknown>[] | undefined) ?? [];
        console.log("[confirmFGTS] entries count", entries.length);

        if (entries.length > 0) {
          const typeMap: Record<string, string> = {
            "deposito": "deposito",
            "115-deposito": "deposito",
            "deposito mensal": "deposito",
            "credito de jam": "jam",
            "ac cred": "jam",
            "ac aut": "jam",
            "regularizacao": "jam",
            "jam": "jam",
            "rendimento": "jam",
            "saque dep": "saque",
            "saque jam": "saque",
            "saque": "saque",
            "ajuste": "outro",
            "outro": "outro",
          };

          function mapEntryType(raw: string): string {
            const lower = (raw ?? "").toLowerCase().trim();
            for (const [key, val] of Object.entries(typeMap)) {
              if (lower.includes(key)) return val;
            }
            return "outro";
          }

          const rows = entries.slice(0, 500).map((e) => ({
            user_id: userId,
            fgts_account_id: accId,
            occurred_at: str(e.occurred_at) || new Date().toISOString().slice(0, 10),
            entry_type: mapEntryType(str(e.entry_type)),
            amount: Math.abs(num(e.amount)),
            notes: str(e.notes) || str(e.description) || str(e.entry_type) || null,
          }));

          const { error: entriesError } = await supabase
            .from("fgts_entries")
            .insert(rows);

          if (entriesError) {
            console.error("[confirmFGTS] entries insert error", entriesError);
          } else {
            console.log("[confirmFGTS] entries inserted", rows.length);
          }
        }
        createdSummary = `Conta FGTS de ${str(p.employer)} criada.`;
      } else if (kind === "emprestimo") {
        const validDebt = new Set(["credito_pessoal","consignado","financiamento_imovel","financiamento_veiculo","cartao","cheque_especial","outros"]);
        const validStatus = new Set(["em_dia","atrasado","quitado","renegociado"]);
        const { error } = await supabase.from("loan_accounts").insert({
          user_id: userId, institution: str(p.institution, "Instituição"),
          debt_type: validDebt.has(str(p.debt_type)) ? str(p.debt_type) : "outros",
          original_amount: num(p.original_amount), current_balance: num(p.current_balance),
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
          user_id: userId, employer: str(p.employer, "Empregador"),
          reference_month: str(p.reference_month) || new Date().toISOString().slice(0, 10),
          gross_amount: num(p.gross_amount), net_amount: num(p.net_amount),
          inss: num(p.inss), irrf: num(p.irrf),
          fgts_amount: num(p.fgts_amount), benefits: num(p.benefits),
          notes: str(p.notes) || null,
        });
        if (error) throw error;
        createdSummary = `Contracheque ${str(p.employer)} adicionado.`;
      }

      await supabase
        .from("pending_ai_actions")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString(), payload: p })
        .eq("id", data.pendingId);

      await logAudit(supabase, {
        userId,
        action: partial ? "partial_confirm" : "confirm",
        docKind: kind, pendingId: data.pendingId,
        message: createdSummary, before: beforePayload, after: p,
      });

      return { ok: true as const, summary: createdSummary };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao gravar dados";
      await logAudit(supabase, {
        userId, action: "confirm", docKind: kind, pendingId: data.pendingId,
        status: "error", message, before: beforePayload, after: p,
      });
      return { ok: false as const, error: message };
    }
  });

export const discardPendingAction = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: z.string().min(1), pendingId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const auth = await authWithToken(data.token);
    if (!auth.ok) return { ok: false as const, error: auth.error };
    const { supabase, userId } = auth;
    const { data: pending } = await supabase
      .from("pending_ai_actions").select("kind, payload").eq("id", data.pendingId).eq("user_id", userId).maybeSingle();
    const { error } = await supabase
      .from("pending_ai_actions")
      .update({ status: "discarded", discarded_at: new Date().toISOString() })
      .eq("id", data.pendingId)
      .eq("user_id", userId);
    if (error) return { ok: false as const, error: error.message };
    await logAudit(supabase, {
      userId, action: "discard",
      docKind: (pending as { kind: Kind } | null)?.kind ?? null,
      pendingId: data.pendingId,
      before: (pending as { payload: unknown } | null)?.payload ?? null,
    });
    return { ok: true as const };
  });
