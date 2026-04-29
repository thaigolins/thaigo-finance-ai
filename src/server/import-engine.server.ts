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

async function callGateway(
  model: string,
  messages: unknown,
  apiKey: string,
  opts: { jsonMode?: boolean } = { jsonMode: true },
) {
  console.log("[import-engine] gateway REQUEST", { model, jsonMode: !!opts.jsonMode });
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.1,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("[import-engine] gateway STATUS", { model, status: res.status, ok: res.ok });
  if (!res.ok) {
    const status = res.status;
    let detail = "";
    try { detail = await res.text(); } catch { /* ignore */ }
    console.error("[import-engine] gateway ERROR BODY", { model, status, detail: detail.slice(0, 800) });
    if (status === 429) throw new Error(`Gateway 429 (rate limit) em ${model}: ${detail.slice(0, 200)}`);
    if (status === 402) throw new Error(`Gateway 402 (créditos esgotados) em ${model}: ${detail.slice(0, 200)}`);
    if (status === 400) throw new Error(`Gateway 400 (bad request) em ${model}: ${detail.slice(0, 300)}`);
    throw new Error(`Gateway ${status} em ${model}: ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const finish = json.choices?.[0]?.finish_reason;
  console.log("[import-engine] gateway CONTENT", {
    model,
    len: content.length,
    finish_reason: finish,
    preview: content.slice(0, 300),
  });
  return content;
}

// OCR livre (sem JSON) — usado como fallback quando IA falha em estruturar.
async function ocrFreeText(opts: {
  base64: string;
  mime: string;
  apiKey: string;
}): Promise<string> {
  const messages = [
    {
      role: "system",
      content:
        "Você é um OCR especializado em extratos bancários brasileiros. Transcreva TODO o texto visível na imagem, linha por linha, preservando a ordem visual e mantendo exatamente datas, descrições, nomes, valores, sinais negativos, vírgulas, pontos, 'Saldo do dia', 'Proventos' e 'Ordem de Crédito'. Não invente, não corrija, não resuma e não responda em JSON.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Transcreva linha por linha este print de extrato. Preserve cada linha separada, inclusive datas, nomes, valores com -R$, saldos e cabeçalhos." },
        { type: "image_url", image_url: { url: `data:${opts.mime};base64,${opts.base64}` } },
      ],
    },
  ];
  return callGateway("google/gemini-2.5-flash", messages, opts.apiKey, { jsonMode: false });
}

// ============================================================
// Parser brasileiro robusto (PIX, TED, DOC, débito, crédito)
// Suporta layouts inline (1 linha) e multi-linha (apps de banco mobile).
// ============================================================

const MES_PT: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

function parseBrAmount(raw: string): { amount: number; isNegative: boolean } | null {
  const s = raw.replace(/[−–—]/g, "-").replace(/\s/g, "");
  const isNegative = /^-/.test(s) || /-R\$/.test(s);
  const cleaned = s.replace(/[R$]/g, "").replace(/^-/, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n === 0) return null;
  return { amount: Math.abs(n), isNegative };
}

function inferKind(descAndContext: string, amountIsNegative: boolean, hasMinusBeforeAmount: boolean): "income" | "expense" {
  const t = descAndContext.toLowerCase();
  // Sinal explícito sempre vence
  if (hasMinusBeforeAmount || amountIsNegative) return "expense";
  // Indicadores textuais de saída
  if (/\b(pix\s+enviado|pix\s+qr|pix\s+pago|enviado|pago|d[eé]bito|saque|tarifa|compra|cart[aã]o|boleto pago|transfer[eê]ncia enviada|ted enviada|doc enviado)\b/.test(t)) return "expense";
  // Indicadores de entrada
  if (/(\bpix\s+recebid|\brecebid|\bcr[eé]dito|\bdep[oó]sito|\bsal[aá]rio|\bestorno|\bprovent|\bordem\s+de\s+cr[eé]dito|\bted\s+recebid|\bdoc\s+recebid|\bentrada\b|\brendimento|\bremunera[cç][aã]o|\btransfer[eê]ncia\s+recebid)/i.test(t)) return "income";
  return "expense";
}

function normalizeDate(dateStr: string, yearHint: number): string | null {
  // dd/mm[/yyyy]
  let m = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let yyyy = m[3] ?? String(yearHint);
    if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? "19" : "20") + yyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  // "23 de abr" / "23 abr 2026" / "24 de abr - 2026" / "24 de abr-2026"
  m = dateStr.match(/^(\d{1,2})\s+(?:de\s+)?([a-zç]{3,})\.?(?:\s*[-–de\s]+\s*(\d{2,4}))?$/i);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const monKey = m[2].slice(0, 3).toLowerCase().replace("ç", "c");
    const mm = MES_PT[monKey];
    if (!mm) return null;
    let yyyy = m[3] ?? String(yearHint);
    if (yyyy.length === 2) yyyy = (Number(yyyy) > 50 ? "19" : "20") + yyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function isLikelyHeaderOrBalance(line: string): boolean {
  return /\b(saldo\s+(do\s+dia|anterior|atual|final|inicial|dispon[ií]vel)|total\s+(de\s+)?(cr[eé]ditos|d[eé]bitos)|extrato|p[aá]gina|lan[çc]amentos|recentes|futuros|filtrar)\b/i.test(line);
}

function isLikelyTransactionTitle(line: string): boolean {
  return /\b(pix|ted|doc|boleto|proventos?|ordem\s+de\s+cr[eé]dito|cr[eé]dito|d[eé]bito|tarifa|saque|dep[oó]sito|transfer[eê]ncia)\b/i.test(line);
}

const AMOUNT_RE_GLOBAL = /([-−–—]?\s*R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[-−–—]?\d+,\d{2})/g;
const DATE_INLINE_RE = /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{1,2}\s+(?:de\s+)?[a-zç]{3,}\.?(?:\s*[-–]\s*\d{2,4}|\s+(?:de\s+)?\d{2,4})?)\b/i;

export function parseExtratoFromText(text: string): RawTx[] {
  const txs: RawTx[] = [];
  const yearNow = new Date().getFullYear();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // Estado para layout multi-linha tipo app mobile:
  // cabeçalho de data ("Sex, 24 de abr - 2026") seta currentDate;
  // depois cada bloco transação tem descrição (1+ linhas) + valor "-R$ 10,00"
  let currentDate: string | null = null;
  let buffer: string[] = [];
  let pendingAmountLine: string | null = null;

  const flushBuffer = (amountLine: string) => {
    if (!currentDate) return;
    const amt = parseBrAmount(amountLine.match(AMOUNT_RE_GLOBAL)?.[0] ?? "");
    if (!amt) return;
    const hasMinusBeforeAmount = /[-−–—]\s*R?\$?\s*\d/.test(amountLine);
    const desc = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (!desc) return;
    if (isLikelyHeaderOrBalance(desc)) return;
    const kind = inferKind(desc, amt.isNegative, hasMinusBeforeAmount);
    txs.push({
      occurred_at: currentDate,
      description: desc.slice(0, 200),
      amount: amt.amount,
      kind,
      category_hint: /pix/i.test(desc) ? "pix" : /ted/i.test(desc) ? "ted" : /doc/i.test(desc) ? "doc" : /boleto/i.test(desc) ? "boleto" : /sal[aá]rio/i.test(desc) ? "salario" : /tarifa/i.test(desc) ? "tarifa" : null,
      confidence: 0.5,
    });
  };

  for (const line of lines) {
    const amounts = line.match(AMOUNT_RE_GLOBAL);
    const dmatch = line.match(DATE_INLINE_RE);

    // OCR mobile às vezes vem: título, valor, nome. Se uma nova transação/data
    // começou, fecha o bloco anterior antes de processar a linha atual.
    if (pendingAmountLine && (dmatch || isLikelyHeaderOrBalance(line) || isLikelyTransactionTitle(line))) {
      flushBuffer(pendingAmountLine);
      buffer = [];
      pendingAmountLine = null;
    }

    // 0) cabeçalho de data multi-linha antes do filtro de saldo, pois apps
    // podem OCRizar "Sex, 24 de abr - 2026 Saldo do dia R$ 0,88" em uma linha.
    if (dmatch && /(saldo|sex|seg|ter|qua|qui|s[aá]b|sab|dom|de\s+[a-zç]{3})/i.test(line)) {
      const nd = normalizeDate(dmatch[1], yearNow);
      if (nd) {
        currentDate = nd;
        buffer = [];
        continue;
      }
    }

    // 1) Linhas de saldo/cabeçalho — ignorar SEMPRE (mesmo com valor)
    if (isLikelyHeaderOrBalance(line)) {
      continue;
    }

    // 2) tenta inline: "10/04 PIX RECEBIDO JOAO 1.234,56 C"
    const inlineDate = line.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+)$/);
    if (inlineDate && amounts && amounts.length > 0) {
      const dt = normalizeDate(inlineDate[1], yearNow);
      const lastAmt = amounts[amounts.length - 1];
      const amt = parseBrAmount(lastAmt);
      if (dt && amt) {
        const idx = line.lastIndexOf(lastAmt);
        const before = line.slice(inlineDate[1].length, idx).trim();
        const after = line.slice(idx + lastAmt.length).trim();
        const indicator = after.match(/^([CD]|cr[eé]dito|d[eé]bito|\+|-)/i)?.[1] ?? "";
        const ind = indicator.toLowerCase();
        let kind: "income" | "expense";
        if (ind === "c" || ind.startsWith("cr") || ind === "+") kind = "income";
        else if (ind === "d" || ind.startsWith("d") || ind === "-") kind = "expense";
        else kind = inferKind(before, amt.isNegative, /[-−–—]\s*R?\$?\s*\d/.test(line.slice(0, idx + lastAmt.length).slice(-15)));
        if (!isLikelyHeaderOrBalance(before)) {
          txs.push({
            occurred_at: dt,
            description: before.replace(/\s+/g, " ").slice(0, 200),
            amount: amt.amount,
            kind,
            category_hint: /pix/i.test(before) ? "pix" : /ted/i.test(before) ? "ted" : /doc/i.test(before) ? "doc" : null,
            confidence: 0.55,
          });
          buffer = [];
          continue;
        }
      }
    }

    // 3) linha que CONTÉM apenas valor ou termina com valor — fecha bloco multi-linha
    if (amounts && amounts.length > 0 && currentDate && buffer.length > 0) {
      // remove o valor da linha; o que sobrar entra no buffer como descrição extra
      const lastAmt = amounts[amounts.length - 1];
      const idx = line.lastIndexOf(lastAmt);
      const beforeAmt = line.slice(0, idx).trim();
      if (beforeAmt && !isLikelyHeaderOrBalance(beforeAmt)) buffer.push(beforeAmt);
      if (beforeAmt) {
        flushBuffer(lastAmt);
        buffer = [];
      } else {
        pendingAmountLine = lastAmt;
      }
      continue;
    }

    // 4) linha de texto puro — acumula no buffer (descrição multi-linha)
    if (!isLikelyHeaderOrBalance(line)) {
      buffer.push(line);
    }
  }

  if (pendingAmountLine) {
    flushBuffer(pendingAmountLine);
  }

  return txs;
}

function normalizeAiTransactions(parsed: unknown, model: string): ExtractionResult | null {
  if (!parsed || typeof parsed !== "object") return null;
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
  console.log("[import-engine] vision JSON parsed", { model, txCount: transactions.length, bank_hint: p.bank_hint });
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
    raw: { vision_json: parsed },
  };
}

/**
 * Extrai extrato bancário de imagem/print em 3 etapas obrigatórias:
 * A) Vision JSON direto; B) OCR livre; C) parser brasileiro determinístico sobre o OCR.
 */
export async function extractBankStatementHybridFromImage(opts: {
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
  const tryVisionJson = async (model: string): Promise<ExtractionResult | null> => {
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
    const normalized = normalizeAiTransactions(parsed, model);
    if (!normalized) {
      const preview = content.slice(0, 500).replace(/\s+/g, " ");
      const msg = `${model}: parse JSON falhou (len=${content.length}, preview 500ch: ${preview})`;
      console.error("[import-engine] PARSE FAILED", { model, len: content.length, preview });
      errorsCollected.push(msg);
      return null;
    }
    return normalized;
  };

  // A) Vision JSON direto — tenta estruturar, mas não depende exclusivamente disso.
  let result = await tryVisionJson("google/gemini-2.5-flash");

  // Avalia confidence média; se baixa ou vazia, tenta Pro
  const avgConf = result && result.transactions.length > 0
    ? result.transactions.reduce((s, t) => s + (t.confidence ?? 0.5), 0) / result.transactions.length
    : 0;

  if (!result || result.transactions.length === 0 || avgConf < 0.55) {
    const pro = await tryVisionJson("google/gemini-2.5-pro");
    if (pro && pro.transactions.length > 0) {
      result = pro;
    }
  }

  // B) OCR livre obrigatório + C) parser determinístico brasileiro sobre o OCR.
  let ocrText = "";
  try {
    ocrText = await ocrFreeText({ base64, mime, apiKey });
    console.log("[import-engine] OCR bruto", { len: ocrText.length, preview: ocrText.slice(0, 500) });
  } catch (e) {
    const msg = `OCR livre falhou: ${e instanceof Error ? e.message : String(e)}`;
    console.error("[import-engine]", msg);
    errorsCollected.push(msg);
  }

  if (ocrText.trim().length > 0) {
    const parserTxs = parseExtratoFromText(ocrText);
    console.log("[import-engine] parser brasileiro", { extracted: parserTxs.length, total_count: parserTxs.length });
    if (parserTxs.length > 0) {
      return {
        ...(result ?? {}),
        method: result && result.transactions.length > 0 ? "image_ai" : "ai_fallback",
        transactions: parserTxs,
        errors: [
          ...(result?.errors ?? []),
          ...errorsCollected,
          `Parser OCR brasileiro usado (${parserTxs.length} lançamento(s) detectados).`,
        ],
        raw: {
          ...(typeof result?.raw === "object" && result.raw ? result.raw as Record<string, unknown> : {}),
          ocr_text: ocrText,
          parser_count: parserTxs.length,
        },
      };
    }
    errorsCollected.push(
      `OCR retornou texto, mas o parser identificou 0 lançamentos. OCR preview: ${ocrText.slice(0, 500)}`,
    );
    console.error("[import-engine] parser brasileiro ERROS", {
      parser_count: 0,
      ocr_preview: ocrText.slice(0, 500),
    });
    return {
      method: "image_ai",
      transactions: [],
      errors: errorsCollected,
      raw: {
        ...(typeof result?.raw === "object" && result.raw ? result.raw as Record<string, unknown> : {}),
        ocr_text: ocrText,
        parser_count: 0,
        parser_errors: errorsCollected,
      },
    };
  } else {
    errorsCollected.push("OCR livre retornou texto vazio.");
  }

  if (!result || result.transactions.length === 0) {
    return {
      method: "image_ai",
      transactions: [],
      errors: errorsCollected.length > 0
        ? errorsCollected
        : ["A IA não conseguiu estruturar este documento. Tente um print mais legível."],
      raw: {
        ocr_text: ocrText,
        parser_count: 0,
        parser_errors: errorsCollected,
      },
    };
  }
  // Anexa erros coletados também quando algum modelo deu certo no fim
  if (errorsCollected.length > 0) {
    result = {
      ...result,
      errors: [...(result.errors ?? []), ...errorsCollected],
      raw: {
        ...(typeof result.raw === "object" && result.raw ? result.raw as Record<string, unknown> : {}),
        ocr_text: ocrText,
        parser_count: 0,
      },
    };
  }
  return result;
}

export async function extractBankStatementFromImage(opts: {
  fileBytes: Uint8Array;
  mime: string;
  filename: string;
}): Promise<ExtractionResult> {
  return extractBankStatementHybridFromImage(opts);
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
