// Server-only helpers do documentImportEngine.
// NÃO importar este arquivo no client — protegido pelo Vite import-protection.

export type RawTx = {
  occurred_at: string | null;
  description: string;
  amount: number;
  kind: "income" | "expense";
  bank_hint?: string | null;
  account_hint?: string | null;
  category_hint?: string | null;
  confidence?: number | null;
  raw_text?: string | null;
};

export type ExtractionResult = {
  method: "pdf_text" | "pdf_ocr" | "image_ai" | "csv_parser" | "ofx_parser" | "ai_fallback";
  bank_hint?: string | null;
  account_hint?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  opening_balance?: number | null;
  closing_balance?: number | null;
  transactions: RawTx[];
  errors: string[];
  raw?: unknown;
};

const SYSTEM_EXTRATO = `Você é um analista financeiro brasileiro especializado em ler extratos bancários.
Sua tarefa: extrair TODOS os lançamentos visíveis na imagem/print/PDF do extrato bancário.

Regras CRÍTICAS:
- Responda SOMENTE com JSON válido. Sem markdown, sem cercas.
- Use ponto como separador decimal. amount sempre POSITIVO.
- kind = "income" para créditos/entradas, "expense" para débitos/saídas.
- Datas no formato ISO YYYY-MM-DD. Se ano estiver implícito (ex.: "10/04"), use o ano do período do extrato; se ainda assim ambíguo, use o ano corrente.
- description: limpa, sem prefixos repetidos tipo "PIX RECEBIDO -" se aparecer em todos.
- category_hint: pix, ted, doc, boleto, tarifa, salario, estorno, cartao, transferencia, saque, deposito, outros.
- confidence: 0.0 a 1.0 conforme nitidez/legibilidade.
- NÃO invente lançamentos. Se um valor estiver ilegível, omita o item e adicione mensagem em "errors".
- NÃO inclua linhas de saldo do dia, totalizadores, transportes, ou cabeçalhos como lançamentos.
- Inclua opening_balance e closing_balance quando o documento mostrar saldo inicial/final.`;

const USER_EXTRATO = `Extraia o JSON com este formato EXATO:
{
  "bank_hint": "string|null",
  "account_hint": "string|null",
  "period_start": "YYYY-MM-DD|null",
  "period_end": "YYYY-MM-DD|null",
  "opening_balance": number|null,
  "closing_balance": number|null,
  "transactions": [
    {
      "occurred_at": "YYYY-MM-DD",
      "description": "string",
      "amount": number,
      "kind": "income|expense",
      "category_hint": "pix|ted|doc|boleto|tarifa|salario|estorno|cartao|transferencia|saque|deposito|outros",
      "confidence": number
    }
  ],
  "errors": ["string"]
}
Retorne APENAS o JSON. Nada mais.`;

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function callGateway(model: string, messages: unknown, apiKey: string) {
  console.log("[import-engine] gateway request", { model });
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });
  console.log("[import-engine] gateway response", { model, status: res.status });
  if (!res.ok) {
    const status = res.status;
    let detail = "";
    try { detail = await res.text(); } catch { /* ignore */ }
    console.error("[import-engine] gateway error body", { model, status, detail: detail.slice(0, 500) });
    if (status === 429) throw new Error("Limite de uso atingido. Aguarde e tente novamente.");
    if (status === 402) throw new Error("Créditos do gateway de IA esgotados.");
    throw new Error(`Gateway respondeu ${status}: ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  console.log("[import-engine] gateway content length", { model, len: content.length });
  return content;
}

/**
 * Extrai um extrato bancário de uma imagem/print usando IA multimodal.
 * Estratégia: gemini-2.5-flash; se baixa confiança, fallback para gemini-2.5-pro.
 */
export async function extractBankStatementFromImage(opts: {
  fileBytes: Uint8Array;
  mime: string;
  filename: string;
}): Promise<ExtractionResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return {
      method: "image_ai",
      transactions: [],
      errors: ["LOVABLE_API_KEY ausente. Configure o gateway de IA."],
    };
  }

  const base64 = bytesToBase64(opts.fileBytes);
  console.log("[import-engine] image base64 size", { bytes: opts.fileBytes.byteLength, b64: base64.length });
  if (base64.length > 8_500_000) {
    return {
      method: "image_ai",
      transactions: [],
      errors: ["Arquivo muito grande para leitura por IA (máx ~6MB). Tente cortar/comprimir o print."],
    };
  }

  const mime = opts.mime || "image/jpeg";
  const messages = [
    { role: "system", content: SYSTEM_EXTRATO },
    {
      role: "user",
      content: [
        { type: "text", text: `Documento: ${opts.filename} (${mime})\n\n${USER_EXTRATO}` },
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
      ],
    },
  ];

  const errorsCollected: string[] = [];
  const tryModel = async (model: string): Promise<ExtractionResult | null> => {
    let content: string;
    try {
      content = await callGateway(model, messages, apiKey);
    } catch (e) {
      const msg = `${model}: ${e instanceof Error ? e.message : String(e)}`;
      console.error("[import-engine] callGateway threw", msg);
      errorsCollected.push(msg);
      return null;
    }
    const parsed = safeParseJson(content);
    if (!parsed || typeof parsed !== "object") {
      const preview = content.slice(0, 200);
      const msg = `${model}: resposta não-JSON (preview: ${preview})`;
      console.error("[import-engine] parse failed", msg);
      errorsCollected.push(msg);
      return null;
    }
    const p = parsed as Record<string, unknown>;
    const txsRaw = Array.isArray(p.transactions) ? (p.transactions as unknown[]) : [];
    const transactions: RawTx[] = [];
    for (const t of txsRaw) {
      if (!t || typeof t !== "object") continue;
      const r = t as Record<string, unknown>;
      const amount = Number(r.amount);
      const k = r.kind === "income" ? "income" : "expense";
      if (!Number.isFinite(amount) || amount === 0) continue;
      transactions.push({
        occurred_at: typeof r.occurred_at === "string" ? r.occurred_at : null,
        description: String(r.description ?? "").trim(),
        amount: Math.abs(amount),
        kind: k,
        category_hint: typeof r.category_hint === "string" ? r.category_hint : null,
        confidence: typeof r.confidence === "number" ? r.confidence : null,
      });
    }
    console.log("[import-engine] parsed ok", { model, count: transactions.length });
    return {
      method: "image_ai",
      bank_hint: typeof p.bank_hint === "string" ? p.bank_hint : null,
      account_hint: typeof p.account_hint === "string" ? p.account_hint : null,
      period_start: typeof p.period_start === "string" ? p.period_start : null,
      period_end: typeof p.period_end === "string" ? p.period_end : null,
      opening_balance: typeof p.opening_balance === "number" ? p.opening_balance : null,
      closing_balance: typeof p.closing_balance === "number" ? p.closing_balance : null,
      transactions,
      errors: Array.isArray(p.errors) ? (p.errors as string[]) : [],
      raw: parsed,
    };
  };

  // 1ª tentativa: Flash
  let result = await tryModel("google/gemini-2.5-flash");

  // Avalia confidence média; se baixa ou vazia, tenta Pro
  const avgConf = result && result.transactions.length > 0
    ? result.transactions.reduce((s, t) => s + (t.confidence ?? 0.5), 0) / result.transactions.length
    : 0;

  if (!result || result.transactions.length === 0 || avgConf < 0.55) {
    const pro = await tryModel("google/gemini-2.5-pro");
    if (pro && pro.transactions.length > 0) {
      result = pro;
    }
  }

  if (!result) {
    return {
      method: "image_ai",
      transactions: [],
      errors: errorsCollected.length > 0
        ? errorsCollected
        : ["A IA não conseguiu estruturar este documento. Tente um print mais legível."],
    };
  }
  // Anexa erros coletados também quando algum modelo deu certo no fim
  if (errorsCollected.length > 0) {
    result = { ...result, errors: [...(result.errors ?? []), ...errorsCollected] };
  }
  return result;
}

// ============================================================
// Validação
// ============================================================

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateTransactions(txs: RawTx[]): { valid: RawTx[]; errors: string[] } {
  const errors: string[] = [];
  const valid: RawTx[] = [];
  for (let i = 0; i < txs.length; i++) {
    const t = txs[i];
    if (!t.description || t.description.length < 1) {
      errors.push(`#${i + 1}: descrição vazia`);
      continue;
    }
    if (!Number.isFinite(t.amount) || t.amount <= 0) {
      errors.push(`#${i + 1}: valor inválido`);
      continue;
    }
    if (t.kind !== "income" && t.kind !== "expense") {
      errors.push(`#${i + 1}: tipo inválido`);
      continue;
    }
    if (t.occurred_at && !ISO_DATE.test(t.occurred_at)) {
      errors.push(`#${i + 1}: data inválida (${t.occurred_at})`);
      // não descarta — o usuário pode corrigir na revisão
    }
    valid.push(t);
  }
  return { valid, errors };
}

// ============================================================
// Anti-duplicidade (entre staging e bank_transactions existentes)
// ============================================================

function normalizeDesc(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compara cada transação extraída com lançamentos existentes no banco.
 * Critério: mesma data ± 1 dia, mesmo valor (±0.01), e descrição com >70% de overlap de palavras.
 */
export async function detectDuplicates(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
  bankAccountId?: string | null;
  txs: RawTx[];
}): Promise<{ index: number; existingId: string; reason: string }[]> {
  const found: { index: number; existingId: string; reason: string }[] = [];
  if (opts.txs.length === 0) return found;

  // Pega faixa de datas do batch (com tolerância)
  const dates = opts.txs.map((t) => t.occurred_at).filter((d): d is string => !!d && ISO_DATE.test(d));
  if (dates.length === 0) return found;
  dates.sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  let q = opts.supabase
    .from("bank_transactions")
    .select("id, description, amount, occurred_at, kind, bank_account_id")
    .eq("user_id", opts.userId)
    .gte("occurred_at", minDate)
    .lte("occurred_at", maxDate);
  if (opts.bankAccountId) q = q.eq("bank_account_id", opts.bankAccountId);

  const { data: existing } = await q;
  const list = (existing ?? []) as {
    id: string;
    description: string;
    amount: number;
    occurred_at: string;
    kind: string;
  }[];

  for (let i = 0; i < opts.txs.length; i++) {
    const t = opts.txs[i];
    if (!t.occurred_at) continue;
    for (const e of list) {
      if (Math.abs(Number(e.amount) - t.amount) > 0.01) continue;
      if (e.kind !== t.kind) continue;
      // Tolera ±1 dia
      const d1 = new Date(t.occurred_at).getTime();
      const d2 = new Date(e.occurred_at).getTime();
      if (!Number.isFinite(d1) || !Number.isFinite(d2)) continue;
      if (Math.abs(d1 - d2) > 86400000) continue;
      // Similaridade de descrição
      const a = new Set(normalizeDesc(t.description).split(" ").filter(Boolean));
      const b = new Set(normalizeDesc(e.description).split(" ").filter(Boolean));
      if (a.size === 0 || b.size === 0) continue;
      let inter = 0;
      a.forEach((w) => { if (b.has(w)) inter++; });
      const sim = inter / Math.min(a.size, b.size);
      if (sim >= 0.6) {
        found.push({
          index: i,
          existingId: e.id,
          reason: `Lançamento similar em ${e.occurred_at} de ${e.description.slice(0, 30)}`,
        });
        break;
      }
    }
  }
  return found;
}
