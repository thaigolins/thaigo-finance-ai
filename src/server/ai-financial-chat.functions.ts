import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(8000),
});

const AttachmentSchema = z.object({
  filename: z.string().max(255),
  kind: z.string().max(64),
  mime: z.string().max(128).optional(),
  size: z.number().optional(),
});

const InputSchema = z.object({
  conversationId: z.string().uuid(),
  // Última mensagem do usuário (já persistida pelo cliente)
  userMessage: z.string().min(1).max(8000),
  // Histórico opcional adicional (até 30 últimas mensagens)
  history: z.array(MessageSchema).max(30).default([]),
  // Anexos enviados nesta mensagem
  attachments: z.array(AttachmentSchema).max(10).default([]),
});

type FinancialSnapshot = {
  accounts: { count: number; total: number; items: { bank: string; balance: number }[] };
  cards: { count: number; limit: number };
  invoices: { open: number; openAmount: number };
  recurring: { activeCount: number; monthlyTotal: number };
  goals: { count: number; target: number; current: number };
  investments: { count: number; total: number; avgReturn: number };
  debts: { count: number; total: number; monthly: number };
  fgts: { count: number; total: number };
  payslips: { lastMonth?: string; netAmount?: number };
  monthFlow: { income: number; expense: number; balance: number; periodLabel: string };
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function buildSystemPrompt(snap: FinancialSnapshot, userName: string | null) {
  const lines: string[] = [];
  lines.push(
    "Você é a IA Financeira Private do Thaigo Finance AI — um assistente financeiro pessoal premium, no mesmo padrão de um private banker brasileiro.",
  );
  lines.push("");
  lines.push("Princípios de atuação:");
  lines.push(
    "- Responda SEMPRE em português do Brasil, em tom executivo, claro, direto e elegante.",
  );
  lines.push(
    "- Use markdown leve (negrito, listas, tabelas markdown quando ajudar). Evite emojis em excesso.",
  );
  lines.push(
    "- Use APENAS os dados financeiros reais fornecidos abaixo. Nunca invente saldos, taxas, contas ou valores.",
  );
  lines.push(
    "- Se faltar um dado, diga que ainda não está cadastrado e oriente como o usuário pode adicioná-lo no app (módulos: Financeiro, Cartões, Faturas, Extratos, Recorrentes, Metas, Investimentos, Empréstimos & Dívidas, FGTS, Contracheques).",
  );
  lines.push(
    "- Para pedidos de exportação de PDF, oriente o usuário a clicar em 'Exportar PDF' no módulo correspondente — o app gera Simples ou Private com período personalizado.",
  );
  lines.push(
    "- Faça análises úteis: razão poupança/renda, concentração de despesas, custo da dívida, alocação de carteira, próximos vencimentos, oportunidades de otimização.",
  );
  lines.push("- Seja conciso. Termine com 1 recomendação prática quando fizer sentido.");
  lines.push("");
  lines.push(`Usuário: ${userName ?? "Cliente Private"}`);
  lines.push("");
  lines.push("=== Snapshot financeiro atual (dados reais do Supabase) ===");
  lines.push(
    `Período de referência: ${snap.monthFlow.periodLabel} | Entradas ${fmt(snap.monthFlow.income)} | Saídas ${fmt(snap.monthFlow.expense)} | Saldo ${fmt(snap.monthFlow.balance)}`,
  );
  lines.push(
    `Contas bancárias: ${snap.accounts.count} (total ${fmt(snap.accounts.total)})${snap.accounts.items.length ? " — " + snap.accounts.items.slice(0, 6).map((a) => `${a.bank}: ${fmt(a.balance)}`).join(", ") : ""}`,
  );
  lines.push(`Cartões: ${snap.cards.count} (limite agregado ${fmt(snap.cards.limit)})`);
  lines.push(
    `Faturas em aberto: ${snap.invoices.open} (${fmt(snap.invoices.openAmount)})`,
  );
  lines.push(
    `Recorrentes ativas: ${snap.recurring.activeCount} (compromisso mensal ${fmt(snap.recurring.monthlyTotal)})`,
  );
  lines.push(
    `Metas: ${snap.goals.count} | objetivo ${fmt(snap.goals.target)} | acumulado ${fmt(snap.goals.current)}`,
  );
  lines.push(
    `Investimentos: ${snap.investments.count} ativos | total ${fmt(snap.investments.total)} | retorno médio ${snap.investments.avgReturn.toFixed(2)}%`,
  );
  lines.push(
    `Dívidas: ${snap.debts.count} contratos | saldo devedor ${fmt(snap.debts.total)} | parcela mensal ${fmt(snap.debts.monthly)}`,
  );
  lines.push(`FGTS: ${snap.fgts.count} contas | saldo ${fmt(snap.fgts.total)}`);
  if (snap.payslips.netAmount !== undefined) {
    lines.push(
      `Último contracheque: ${snap.payslips.lastMonth ?? "—"} | líquido ${fmt(snap.payslips.netAmount)}`,
    );
  }
  return lines.join("\n");
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadSnapshot(supabase: any): Promise<FinancialSnapshot> {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const periodLabel = today.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [
    accountsRes,
    cardsRes,
    invoicesRes,
    recRes,
    goalsRes,
    invRes,
    debtsRes,
    fgtsRes,
    txRes,
    payRes,
  ] = await Promise.all([
    sb.from("bank_accounts").select("bank,balance"),
    sb.from("credit_cards").select("credit_limit"),
    sb.from("invoices").select("status,total_amount"),
    sb.from("recurring_expenses").select("status,amount"),
    sb.from("goals").select("target_amount,current_amount"),
    sb.from("investments").select("amount,return_percent"),
    sb.from("loan_accounts").select("current_balance,monthly_payment"),
    sb.from("fgts_accounts").select("balance"),
    sb
      .from("bank_transactions")
      .select("kind,amount,occurred_at")
      .gte("occurred_at", from)
      .lte("occurred_at", to),
    sb
      .from("payslips")
      .select("reference_month,net_amount")
      .order("reference_month", { ascending: false })
      .limit(1),
  ]);

  const accounts = (accountsRes.data ?? []) as { bank: string; balance: number }[];
  const cards = (cardsRes.data ?? []) as { credit_limit: number }[];
  const invoices = (invoicesRes.data ?? []) as { status: string; total_amount: number }[];
  const rec = (recRes.data ?? []) as { status: string; amount: number }[];
  const goals = (goalsRes.data ?? []) as { target_amount: number; current_amount: number }[];
  const investments = (invRes.data ?? []) as { amount: number; return_percent: number }[];
  const debts = (debtsRes.data ?? []) as { current_balance: number; monthly_payment: number }[];
  const fgts = (fgtsRes.data ?? []) as { balance: number }[];
  const txs = (txRes.data ?? []) as { kind: string; amount: number }[];
  const pay = (payRes.data ?? []) as { reference_month: string; net_amount: number }[];

  const income = txs.filter((t) => t.kind === "income").reduce((a, b) => a + num(b.amount), 0);
  const expense = txs
    .filter((t) => t.kind === "expense")
    .reduce((a, b) => a + num(b.amount), 0);

  return {
    accounts: {
      count: accounts.length,
      total: accounts.reduce((a, b) => a + num(b.balance), 0),
      items: accounts.map((a) => ({ bank: a.bank, balance: num(a.balance) })),
    },
    cards: {
      count: cards.length,
      limit: cards.reduce((a, b) => a + num(b.credit_limit), 0),
    },
    invoices: {
      open: invoices.filter((i) => i.status === "open" || i.status === "closed").length,
      openAmount: invoices
        .filter((i) => i.status === "open" || i.status === "closed")
        .reduce((a, b) => a + num(b.total_amount), 0),
    },
    recurring: {
      activeCount: rec.filter((r) => r.status === "active").length,
      monthlyTotal: rec
        .filter((r) => r.status === "active")
        .reduce((a, b) => a + num(b.amount), 0),
    },
    goals: {
      count: goals.length,
      target: goals.reduce((a, b) => a + num(b.target_amount), 0),
      current: goals.reduce((a, b) => a + num(b.current_amount), 0),
    },
    investments: {
      count: investments.length,
      total: investments.reduce((a, b) => a + num(b.amount), 0),
      avgReturn:
        investments.length > 0
          ? investments.reduce((a, b) => a + num(b.return_percent), 0) / investments.length
          : 0,
    },
    debts: {
      count: debts.length,
      total: debts.reduce((a, b) => a + num(b.current_balance), 0),
      monthly: debts.reduce((a, b) => a + num(b.monthly_payment), 0),
    },
    fgts: { count: fgts.length, total: fgts.reduce((a, b) => a + num(b.balance), 0) },
    payslips: {
      lastMonth: pay[0]?.reference_month,
      netAmount: pay[0] ? num(pay[0].net_amount) : undefined,
    },
    monthFlow: { income, expense, balance: income - expense, periodLabel },
  };
}

export const aiFinancialChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Carrega snapshot financeiro real do usuário (RLS aplicada)
    const snap = await loadSnapshot(supabase);

    // 2) Pega nome do perfil (best-effort)
    let userName: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      userName = (prof as { full_name?: string } | null)?.full_name ?? null;
    } catch {
      /* ignore */
    }

    // 3) Monta mensagens para o gateway (sistema + histórico + atual)
    const system = buildSystemPrompt(snap, userName);

    const attachmentsLine = data.attachments.length
      ? `\n\n[Anexos enviados pelo usuário nesta mensagem]\n` +
        data.attachments
          .map(
            (a) =>
              `- ${a.filename} (tipo: ${a.kind}${a.mime ? `, ${a.mime}` : ""}${a.size ? `, ${(a.size / 1024).toFixed(1)} KB` : ""})`,
          )
          .join("\n") +
        `\n\nObs: você não vê o conteúdo binário do arquivo, apenas o nome e tipo. Comente o que o usuário pode esperar e o que será atualizado quando ele confirmar os dados.`
      : "";

    const messages = [
      { role: "system", content: system },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.userMessage + attachmentsLine },
    ];

    // 4) Chama Lovable AI Gateway (sem expor chave no frontend)
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        reply:
          "A IA financeira não está configurada (chave do gateway ausente). Avise o administrador.",
      };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.4,
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
      console.error("AI gateway error", status, detail);
      if (status === 429) {
        return {
          ok: false as const,
          reply:
            "Muitas solicitações em pouco tempo. Aguarde alguns segundos e tente novamente.",
        };
      }
      if (status === 402) {
        return {
          ok: false as const,
          reply:
            "Os créditos do gateway de IA do workspace acabaram. Adicione créditos em Settings → Workspace → Plans para continuar.",
        };
      }
      return {
        ok: false as const,
        reply: "Falha ao consultar a IA financeira. Tente novamente em instantes.",
      };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply =
      json.choices?.[0]?.message?.content?.trim() ||
      "Não consegui gerar uma resposta agora. Pode reformular sua pergunta?";

    return { ok: true as const, reply };
  });
