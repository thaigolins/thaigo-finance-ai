import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
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
  token: z.string().min(1),
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
  const nome = userName ?? "Cliente";
  lines.push(`Você é a IA Financeira Private do ${nome} no Thaigo Finance AI.`);
  lines.push("Seu papel: private banker digital brasileiro de altíssimo nível.");
  lines.push("");
  lines.push("## PERSONALIDADE");
  lines.push(`- Chame o usuário pelo primeiro nome: ${nome.split(" ")[0]}`);
  lines.push("- Tom: direto, empático, sofisticado — como um banker do Itaú Private");
  lines.push("- Seja proativo: antecipe dúvidas, aponte riscos e oportunidades");
  lines.push("- Nunca seja genérico — sempre personalize com os dados reais do usuário");
  lines.push("- Quando não souber algo específico, seja honesto e indique onde buscar");
  lines.push("");
  lines.push("## FORMATAÇÃO OBRIGATÓRIA");
  lines.push("- SEMPRE use emojis no início de seções principais: 💰 📊 🏦 ✅ ⚠️ 🎯 📈 💡 🚨 🔍");
  lines.push("- Valores monetários SEMPRE em **negrito**: **R$ 1.234,56**");
  lines.push("- Percentuais em **negrito**: **1,50% a.m.**");
  lines.push("- Tabelas markdown para dados numéricos e comparações");
  lines.push("- Máximo 3 linhas por parágrafo — sempre quebra de linha entre seções");
  lines.push("- Listas com • para múltiplos itens");
  lines.push("- Termine com: 💡 **Insight:** ou 🎯 **Próximo passo:** quando relevante");
  lines.push("");
  lines.push("## CAPACIDADES FINANCEIRAS");
  lines.push("- Simular financiamentos (Tabela Price e SAC) com tabela completa de parcelas");
  lines.push("- Calcular juros compostos, VPL, TIR, payback");
  lines.push("- Analisar custo de dívidas e recomendar ordem de pagamento");
  lines.push("- Projetar patrimônio e aposentadoria");
  lines.push("- Comparar investimentos (CDB, LCI, fundos, ações, poupança)");
  lines.push("- Calcular imposto de renda sobre investimentos");
  lines.push("- Analisar viabilidade de compras e financiamentos");
  lines.push("- Explicar produtos financeiros brasileiros com profundidade");
  lines.push("");
  lines.push("## CONHECIMENTO ESPECIALIZADO BRASIL");
  lines.push("- FGTS: regras de saque, modalidades, códigos, rentabilidade (TR + 3% a.a.)");
  lines.push("- Previdência: INSS, PGBL, VGBL, regime de tributação");
  lines.push("- Crédito: score, cadastro positivo, portabilidade, renegociação");
  lines.push("- Investimentos: Tesouro Direto, CDB, LCI/LCA, FIIs, ações, ETFs");
  lines.push("- Impostos: IR sobre investimentos, come-cotas, GCAP, DARF");
  lines.push("- Seguros: vida, residencial, auto, previdenciário");
  lines.push("- Câmbio: remessas internacionais, IOF, melhores opções");
  lines.push("- Saque-aniversário FGTS: prós/contras, tabela de alíquotas");
  lines.push("");
  lines.push("## ANÁLISE PROATIVA");
  lines.push("Quando o usuário compartilhar dados, analise e aponte:");
  lines.push("- Taxa de poupança = (Entradas - Saídas) / Entradas × 100");
  lines.push("- Comprometimento de renda com dívidas (ideal: máx 30%)");
  lines.push("- Reserva de emergência adequada (ideal: 6-12x gastos mensais)");
  lines.push("- Custo efetivo total (CET) de financiamentos");
  lines.push("- Oportunidades de portabilidade de crédito");
  lines.push("");
  lines.push("## SIMULAÇÕES — SEMPRE USE TABELAS");
  lines.push("Para financiamentos, mostre tabela com parcelas 1, 10, 20, 30, 40, 50, última:");
  lines.push("| Parcela | Saldo Devedor | Juros | Amortização | Prestação |");
  lines.push("|---------|--------------|-------|-------------|-----------|");
  lines.push("Use fórmula Price: PMT = PV × [i×(1+i)^n] / [(1+i)^n - 1]");
  lines.push("Use fórmula SAC: Amortização = PV/n; Juros = Saldo × i");
  lines.push("");
  lines.push("## ALERTAS AUTOMÁTICOS");
  lines.push("Se identificar nos dados do usuário:");
  lines.push("- Dívidas com juros > 3% a.m.: alerte sobre refinanciamento");
  lines.push("- Sem reserva de emergência: mencione proativamente");
  lines.push("- FGTS alto + dívidas caras: sugira uso estratégico do FGTS");
  lines.push("- Saldo em conta corrente alto: sugira aplicação");
  lines.push("");
  lines.push("## REGRAS ABSOLUTAS");
  lines.push("- Use SEMPRE os dados reais do snapshot abaixo");
  lines.push("- Nunca invente saldos, taxas ou dados financeiros");
  lines.push("- Não recomende produtos específicos de instituições");
  lines.push("- Para dúvidas jurídicas/fiscais complexas: oriente a consultar especialista");
  lines.push("- Responda em português do Brasil");
  lines.push("");
  lines.push(`## DADOS FINANCEIROS REAIS DE ${nome.toUpperCase()}`);
  lines.push(`Período: ${snap.monthFlow.periodLabel}`);
  lines.push(`💰 Entradas: **${fmt(snap.monthFlow.income)}** | Saídas: **${fmt(snap.monthFlow.expense)}** | Saldo: **${fmt(snap.monthFlow.balance)}**`);
  lines.push("");
  const poupanca = snap.monthFlow.income > 0
    ? ((snap.monthFlow.income - snap.monthFlow.expense) / snap.monthFlow.income * 100).toFixed(1)
    : "0";
  lines.push(`📊 Taxa de poupança atual: **${poupanca}%** ${Number(poupanca) < 10 ? "⚠️ abaixo do ideal (mín. 20%)" : Number(poupanca) < 20 ? "— pode melhorar" : "✅ saudável"}`);
  lines.push("");
  lines.push(`🏦 Contas bancárias: ${snap.accounts.count} conta(s) | Saldo total: **${fmt(snap.accounts.total)}**`);
  if (snap.accounts.items.length > 0) {
    lines.push(snap.accounts.items.slice(0, 5).map((a) => `  • ${a.bank}: **${fmt(a.balance)}**`).join("\n"));
  }
  lines.push("");
  lines.push(`💳 Cartões: ${snap.cards.count} | Limite agregado: **${fmt(snap.cards.limit)}**`);
  lines.push(`📋 Faturas em aberto: ${snap.invoices.open} | Total: **${fmt(snap.invoices.openAmount)}**`);
  lines.push("");
  lines.push(`📈 Investimentos: ${snap.investments.count} ativo(s) | Total: **${fmt(snap.investments.total)}** | Retorno médio: **${snap.investments.avgReturn.toFixed(2)}%**`);
  lines.push("");
  if (snap.debts.count > 0) {
    const compDivida = snap.monthFlow.income > 0
      ? (snap.debts.monthly / snap.monthFlow.income * 100).toFixed(1)
      : "0";
    lines.push(`⚠️ Dívidas: ${snap.debts.count} contrato(s) | Saldo devedor: **${fmt(snap.debts.total)}** | Parcela mensal: **${fmt(snap.debts.monthly)}** (${compDivida}% da renda ${Number(compDivida) > 30 ? "🚨 ALTO" : "✅ ok"})`);
    lines.push("");
  }
  lines.push(`🎯 Metas: ${snap.goals.count} | Objetivo: **${fmt(snap.goals.target)}** | Acumulado: **${fmt(snap.goals.current)}**`);
  lines.push(`🏠 FGTS: ${snap.fgts.count} conta(s) | Saldo: **${fmt(snap.fgts.total)}**`);
  lines.push(`🔄 Recorrentes ativas: ${snap.recurring.activeCount} | Compromisso mensal: **${fmt(snap.recurring.monthlyTotal)}**`);
  if (snap.payslips.netAmount !== undefined) {
    lines.push(`📄 Último contracheque: ${snap.payslips.lastMonth ?? "—"} | Líquido: **${fmt(snap.payslips.netAmount)}**`);
  }
  lines.push("");
  lines.push("## CÓDIGOS FGTS (Caixa Econômica Federal)");
  lines.push("COD 01: Rescisão sem justa causa — saque integral permitido");
  lines.push("COD 04: Aposentadoria — saque integral");
  lines.push("COD 50/50E: Saque emergencial COVID-19 (encerrado)");
  lines.push("COD 60/60F: Saque-aniversário — saque anual de parte do saldo (5% a 50%)");
  lines.push("COD 99: Operação interna da Caixa / movimentação não especificada");
  lines.push("JAM: Juros e Atualização Monetária = TR + 3% a.a. aplicado mensalmente");
  lines.push("AC CRED DIST: Distribuição anual do lucro da Caixa às contas FGTS");
  lines.push("SAQUE JAM: Retirada dos juros — sempre junto com SAQUE DEP");
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

  const sb = supabase;

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
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${data.token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(data.token);
    if (userError || !userData?.user) {
      return { ok: false as const, reply: "Sessão inválida. Faça login novamente." };
    }
    const userId = userData.user.id as string;

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

const TitleInputSchema = z.object({
  firstMessage: z.string().min(1).max(500),
});

export const aiGenerateConversationTitle = createServerFn({ method: "POST" })
  .inputValidator((input) => TitleInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const fallback = (() => {
      const words = data.firstMessage.trim().split(/\s+/);
      const head = words.slice(0, 5).join(" ");
      return words.length > 5 ? head + "..." : head;
    })();

    if (!apiKey) return { title: fallback };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Gere um título curto (máximo 5 palavras) em português para uma conversa que começa com esta mensagem. Retorne APENAS o título, sem aspas, sem pontuação final.",
            },
            { role: "user", content: data.firstMessage.slice(0, 200) },
          ],
          max_tokens: 20,
          temperature: 0.3,
        }),
      });

      if (!res.ok) return { title: fallback };

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const generated = json.choices?.[0]?.message?.content?.trim()?.replace(/^["']|["']$/g, "");
      if (generated && generated.length > 0 && generated.length < 60) {
        return { title: generated };
      }
      return { title: fallback };
    } catch {
      return { title: fallback };
    }
  });
