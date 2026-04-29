import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "./format";
import type { PdfPayload } from "./pdf-export";

export type PeriodKey =
  | "current_month"
  | "previous_month"
  | "last_3_months"
  | "last_6_months"
  | "current_year"
  | "custom";

export type PeriodRange = {
  key: PeriodKey;
  label: string;
  from: Date;
  to: Date;
};

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "current_month", label: "Mês atual" },
  { value: "previous_month", label: "Mês anterior" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "current_year", label: "Ano atual" },
  { value: "custom", label: "Personalizado" },
];

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function resolvePeriod(
  key: PeriodKey,
  custom?: { from?: string; to?: string },
): PeriodRange {
  const today = new Date();
  switch (key) {
    case "current_month": {
      const from = startOfMonth(today);
      const to = endOfMonth(today);
      return {
        key,
        from,
        to,
        label: `${MONTHS_PT[today.getMonth()]}/${today.getFullYear()}`,
      };
    }
    case "previous_month": {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        key,
        from: startOfMonth(prev),
        to: endOfMonth(prev),
        label: `${MONTHS_PT[prev.getMonth()]}/${prev.getFullYear()}`,
      };
    }
    case "last_3_months": {
      const from = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 2, 1));
      return { key, from, to: endOfMonth(today), label: "Últimos 3 meses" };
    }
    case "last_6_months": {
      const from = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 5, 1));
      return { key, from, to: endOfMonth(today), label: "Últimos 6 meses" };
    }
    case "current_year": {
      return {
        key,
        from: new Date(today.getFullYear(), 0, 1),
        to: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999),
        label: `Ano de ${today.getFullYear()}`,
      };
    }
    case "custom": {
      const from = custom?.from ? new Date(custom.from) : startOfMonth(today);
      const to = custom?.to ? new Date(custom.to) : endOfMonth(today);
      const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
      return { key, from, to, label: `${fmt(from)} → ${fmt(to)}` };
    }
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

async function list<T = Record<string, unknown>>(
  table: string,
  userId: string,
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table as never)
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as T[];
}

async function listInRange<T = Record<string, unknown>>(
  table: string,
  userId: string,
  dateCol: string,
  range: PeriodRange,
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table as never)
    .select("*")
    .eq("user_id", userId)
    .gte(dateCol, iso(range.from))
    .lte(dateCol, iso(range.to));
  if (error) throw error;
  return (data ?? []) as T[];
}

export type ReportModule =
  | "Dashboard"
  | "Financeiro"
  | "Cartões"
  | "Faturas"
  | "Extratos"
  | "Recorrentes"
  | "Metas"
  | "Investimentos"
  | "Empréstimos & Dívidas"
  | "FGTS"
  | "Relatórios";

const moduleToBucketKey: Record<ReportModule, string> = {
  Dashboard: "dashboard",
  Financeiro: "financeiro",
  Cartões: "cartoes",
  Faturas: "faturas",
  Extratos: "extratos",
  Recorrentes: "recorrentes",
  Metas: "metas",
  Investimentos: "investimentos",
  "Empréstimos & Dívidas": "dividas",
  FGTS: "fgts",
  Relatórios: "relatorios",
};

export function moduleSlug(m: ReportModule) {
  return moduleToBucketKey[m];
}

export async function buildRealPayload(
  module: ReportModule,
  range: PeriodRange,
  filters: string[],
  userId: string,
): Promise<PdfPayload> {
  const base = { module, period: range.label, filters };

  switch (module) {
    case "Dashboard":
    case "Relatórios": {
      const [accounts, txs, investments, debts, fgts] = await Promise.all([
        list<{ balance: number; bank: string; account_type: string }>("bank_accounts", userId),
        listInRange<{ amount: number; kind: string; description: string; occurred_at: string }>(
          "bank_transactions",
          userId,
          "occurred_at",
          range,
        ),
        list<{ amount: number; name: string; asset_class: string; return_percent: number }>(
          "investments",
          userId,
        ),
        list<{ current_balance: number; institution: string; monthly_payment: number }>(
          "loan_accounts",
          userId,
        ),
        list<{ balance: number; employer: string }>("fgts_accounts", userId),
      ]);

      const income = txs.filter((t) => t.kind === "income").reduce((a, b) => a + num(b.amount), 0);
      const expense = txs
        .filter((t) => t.kind === "expense")
        .reduce((a, b) => a + num(b.amount), 0);
      const totalAccounts = accounts.reduce((a, b) => a + num(b.balance), 0);
      const totalInv = investments.reduce((a, b) => a + num(b.amount), 0);
      const totalDebt = debts.reduce((a, b) => a + num(b.current_balance), 0);
      const totalFgts = fgts.reduce((a, b) => a + num(b.balance), 0);
      const liquidNet = totalAccounts + totalInv + totalFgts - totalDebt;

      return {
        ...base,
        title: module === "Dashboard" ? "Visão Geral Financeira" : "Relatório Financeiro Mensal",
        summary: [
          { label: "Patrimônio total", value: formatBRL(totalAccounts + totalInv) },
          { label: "Entradas", value: formatBRL(income) },
          { label: "Saídas", value: formatBRL(expense) },
          { label: "Saldo do período", value: formatBRL(income - expense) },
          { label: "Investimentos", value: formatBRL(totalInv) },
          { label: "Dívidas", value: formatBRL(totalDebt) },
        ],
        sections: [
          {
            heading: "Movimentações do período",
            table: {
              columns: ["Data", "Descrição", "Tipo", "Valor"],
              rows: txs
                .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
                .slice(0, 50)
                .map((t) => [
                  new Date(t.occurred_at).toLocaleDateString("pt-BR"),
                  t.description,
                  t.kind === "income" ? "Entrada" : "Saída",
                  formatBRL(num(t.amount)),
                ]),
              totals: ["TOTAL", "", "", formatBRL(income - expense)],
            },
          },
        ],
        insights: [
          income > 0 && expense / income < 0.7
            ? `Índice de poupança em ${(((income - expense) / income) * 100).toFixed(1)}% — acima do benchmark recomendado de 30%.`
            : `Despesas representam ${income > 0 ? ((expense / income) * 100).toFixed(1) : "0"}% das entradas no período.`,
          totalDebt > 0
            ? `Endividamento total em ${formatBRL(totalDebt)} — ${((totalDebt / (totalAccounts + totalInv || 1)) * 100).toFixed(1)}% do patrimônio líquido.`
            : "Sem dívidas ativas registradas.",
          `Carteira de investimentos: ${investments.length} ativo(s) totalizando ${formatBRL(totalInv)}.`,
        ],
        recommendations: [
          "Manter ritmo atual de aportes mensais e revisar carteira trimestralmente.",
          totalDebt > 0
            ? "Priorizar quitação das dívidas com maior CET (custo efetivo total)."
            : "Manter reserva de emergência equivalente a 6 meses de despesas.",
          "Reavaliar assinaturas recorrentes e custos fixos a cada ciclo.",
        ],
        consolidatedPatrimony: [
          { label: "Contas correntes", value: formatBRL(totalAccounts) },
          { label: "Investimentos", value: formatBRL(totalInv) },
          { label: "FGTS", value: formatBRL(totalFgts) },
          { label: "Dívidas (-)", value: `- ${formatBRL(totalDebt)}` },
          { label: "Patrimônio líquido", value: formatBRL(liquidNet) },
        ],
      };
    }
    case "Financeiro": {
      const accounts = await list<{
        bank: string;
        account_type: string;
        balance: number;
        is_active: boolean;
      }>("bank_accounts", userId);
      const total = accounts.reduce((a, b) => a + num(b.balance), 0);
      return {
        ...base,
        title: "Relatório Financeiro",
        summary: [
          { label: "Total em contas", value: formatBRL(total) },
          { label: "Contas ativas", value: String(accounts.filter((a) => a.is_active).length) },
          { label: "Total de contas", value: String(accounts.length) },
        ],
        sections: [
          {
            heading: "Contas bancárias",
            table: {
              columns: ["Banco", "Tipo", "Status", "Saldo"],
              rows: accounts.map((a) => [
                a.bank,
                a.account_type,
                a.is_active ? "Ativa" : "Inativa",
                formatBRL(num(a.balance)),
              ]),
              totals: ["TOTAL", "", "", formatBRL(total)],
            },
          },
        ],
        insights:
          accounts.length > 0
            ? [
                `${accounts[0].bank} concentra ${((num(accounts[0].balance) / (total || 1)) * 100).toFixed(1)}% do total.`,
              ]
            : ["Sem contas cadastradas no período."],
        recommendations: ["Manter reserva de emergência em conta de alta liquidez."],
      };
    }
    case "Cartões": {
      const cards = await list<{
        name: string;
        brand: string;
        credit_limit: number;
        due_day: number;
        is_active: boolean;
      }>("credit_cards", userId);
      const limit = cards.reduce((a, b) => a + num(b.credit_limit), 0);
      return {
        ...base,
        title: "Relatório de Cartões",
        summary: [
          { label: "Limite total", value: formatBRL(limit) },
          { label: "Cartões ativos", value: String(cards.filter((c) => c.is_active).length) },
        ],
        sections: [
          {
            heading: "Cartões cadastrados",
            table: {
              columns: ["Cartão", "Bandeira", "Limite", "Vencto."],
              rows: cards.map((c) => [
                c.name,
                c.brand,
                formatBRL(num(c.credit_limit)),
                `Dia ${c.due_day}`,
              ]),
              totals: ["TOTAL", "", formatBRL(limit), ""],
            },
          },
        ],
        insights: ["Mantenha utilização abaixo de 30% do limite agregado."],
        recommendations: ["Programar débito automático para evitar juros rotativos."],
      };
    }
    case "Faturas": {
      const invoices = await listInRange<{
        reference_month: string;
        due_date: string;
        total_amount: number;
        status: string;
      }>("invoices", userId, "reference_month", range);
      const open = invoices
        .filter((i) => i.status === "open" || i.status === "closed")
        .reduce((a, b) => a + num(b.total_amount), 0);
      const paid = invoices
        .filter((i) => i.status === "paid")
        .reduce((a, b) => a + num(b.total_amount), 0);
      return {
        ...base,
        title: "Relatório de Faturas",
        summary: [
          { label: "Em aberto", value: formatBRL(open) },
          { label: "Pagas", value: formatBRL(paid) },
          { label: "Total faturas", value: String(invoices.length) },
        ],
        sections: [
          {
            heading: "Faturas",
            table: {
              columns: ["Mês ref.", "Vencimento", "Valor", "Status"],
              rows: invoices.map((i) => [
                new Date(i.reference_month).toLocaleDateString("pt-BR"),
                new Date(i.due_date).toLocaleDateString("pt-BR"),
                formatBRL(num(i.total_amount)),
                i.status,
              ]),
              totals: ["TOTAL", "", formatBRL(open + paid), ""],
            },
          },
        ],
        insights: ["Acompanhe o vencimento das faturas para evitar juros rotativos."],
        recommendations: ["Programar débito automático nas faturas recorrentes."],
      };
    }
    case "Extratos": {
      const txs = await listInRange<{
        occurred_at: string;
        description: string;
        amount: number;
        kind: string;
      }>("bank_transactions", userId, "occurred_at", range);
      const income = txs.filter((t) => t.kind === "income").reduce((a, b) => a + num(b.amount), 0);
      const expense = txs
        .filter((t) => t.kind === "expense")
        .reduce((a, b) => a + num(b.amount), 0);
      return {
        ...base,
        title: "Extrato Consolidado",
        summary: [
          { label: "Entradas", value: formatBRL(income) },
          { label: "Saídas", value: formatBRL(expense) },
          { label: "Lançamentos", value: String(txs.length) },
        ],
        sections: [
          {
            heading: "Lançamentos",
            table: {
              columns: ["Data", "Descrição", "Tipo", "Valor"],
              rows: txs
                .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
                .map((t) => [
                  new Date(t.occurred_at).toLocaleDateString("pt-BR"),
                  t.description,
                  t.kind === "income" ? "Entrada" : "Saída",
                  formatBRL(num(t.amount)),
                ]),
              totals: ["TOTAL", "", "", formatBRL(income - expense)],
            },
          },
        ],
        insights: [`Saldo do período: ${formatBRL(income - expense)}.`],
        recommendations: ["Categorizar lançamentos pendentes para análise mais precisa."],
      };
    }
    case "Recorrentes": {
      const recs = await list<{
        name: string;
        amount: number;
        due_day: number;
        status: string;
      }>("recurring_expenses", userId);
      const total = recs
        .filter((r) => r.status === "active")
        .reduce((a, b) => a + num(b.amount), 0);
      return {
        ...base,
        title: "Contas Recorrentes",
        summary: [
          { label: "Total mensal", value: formatBRL(total) },
          { label: "Itens ativos", value: String(recs.filter((r) => r.status === "active").length) },
          { label: "Total de itens", value: String(recs.length) },
        ],
        sections: [
          {
            heading: "Assinaturas e contas fixas",
            table: {
              columns: ["Nome", "Vencimento", "Status", "Valor"],
              rows: recs.map((r) => [
                r.name,
                `Dia ${r.due_day}`,
                r.status === "active" ? "Ativa" : "Pausada",
                formatBRL(num(r.amount)),
              ]),
              totals: ["TOTAL", "", "", formatBRL(total)],
            },
          },
        ],
        insights: [`Compromisso fixo mensal de ${formatBRL(total)} em recorrentes ativas.`],
        recommendations: ["Avaliar consolidação de assinaturas com baixo uso."],
      };
    }
    case "Metas": {
      const goals = await list<{
        name: string;
        target_amount: number;
        current_amount: number;
        deadline: string | null;
        status: string;
      }>("goals", userId);
      const target = goals.reduce((a, b) => a + num(b.target_amount), 0);
      const current = goals.reduce((a, b) => a + num(b.current_amount), 0);
      return {
        ...base,
        title: "Metas Financeiras",
        summary: [
          { label: "Total objetivado", value: formatBRL(target) },
          { label: "Acumulado", value: formatBRL(current) },
          {
            label: "Progresso",
            value: target > 0 ? `${((current / target) * 100).toFixed(1)}%` : "0%",
          },
        ],
        sections: [
          {
            heading: "Acompanhamento",
            table: {
              columns: ["Meta", "Objetivo", "Acumulado", "% Concluído", "Prazo"],
              rows: goals.map((g) => [
                g.name,
                formatBRL(num(g.target_amount)),
                formatBRL(num(g.current_amount)),
                num(g.target_amount) > 0
                  ? `${Math.round((num(g.current_amount) / num(g.target_amount)) * 100)}%`
                  : "—",
                g.deadline ? new Date(g.deadline).toLocaleDateString("pt-BR") : "—",
              ]),
            },
          },
        ],
        insights: [`${goals.length} meta(s) cadastrada(s) com ${formatBRL(current)} acumulados.`],
        recommendations: ["Priorizar aportes nas metas com prazo mais próximo."],
      };
    }
    case "Investimentos": {
      const invs = await list<{
        name: string;
        asset_class: string;
        amount: number;
        return_percent: number;
        allocation_percent: number;
      }>("investments", userId);
      const total = invs.reduce((a, b) => a + num(b.amount), 0);
      const avgReturn =
        invs.length > 0 ? invs.reduce((a, b) => a + num(b.return_percent), 0) / invs.length : 0;
      return {
        ...base,
        title: "Carteira de Investimentos",
        summary: [
          { label: "Patrimônio investido", value: formatBRL(total) },
          { label: "Retorno médio", value: `${avgReturn.toFixed(1)}%` },
          { label: "Ativos", value: String(invs.length) },
        ],
        sections: [
          {
            heading: "Alocação",
            table: {
              columns: ["Ativo", "Classe", "Valor", "Retorno", "Alocação"],
              rows: invs.map((i) => [
                i.name,
                i.asset_class,
                formatBRL(num(i.amount)),
                `${num(i.return_percent).toFixed(2)}%`,
                `${num(i.allocation_percent).toFixed(1)}%`,
              ]),
              totals: ["TOTAL", "", formatBRL(total), "", "100%"],
            },
          },
        ],
        insights: [`Carteira com retorno médio ponderado de ${avgReturn.toFixed(1)}%.`],
        recommendations: ["Reavaliar alocação trimestralmente conforme perfil de risco."],
      };
    }
    case "Empréstimos & Dívidas": {
      const debts = await list<{
        institution: string;
        debt_type: string;
        current_balance: number;
        interest_rate: number;
        cet: number;
        monthly_payment: number;
        installments_paid: number;
        installments_total: number;
      }>("loan_accounts", userId);
      const total = debts.reduce((a, b) => a + num(b.current_balance), 0);
      const monthly = debts.reduce((a, b) => a + num(b.monthly_payment), 0);
      return {
        ...base,
        title: "Empréstimos & Dívidas",
        summary: [
          { label: "Saldo devedor total", value: formatBRL(total) },
          { label: "Parcela mensal", value: formatBRL(monthly) },
          { label: "Contratos ativos", value: String(debts.length) },
        ],
        sections: [
          {
            heading: "Contratos",
            table: {
              columns: ["Instituição", "Tipo", "Saldo", "Taxa", "CET", "Parcela", "Restantes"],
              rows: debts.map((d) => [
                d.institution,
                d.debt_type,
                formatBRL(num(d.current_balance)),
                `${num(d.interest_rate).toFixed(2)}%`,
                d.cet ? `${num(d.cet).toFixed(2)}%` : "—",
                formatBRL(num(d.monthly_payment)),
                `${num(d.installments_total) - num(d.installments_paid)}/${num(d.installments_total)}`,
              ]),
              totals: ["TOTAL", "", formatBRL(total), "", "", formatBRL(monthly), ""],
            },
          },
        ],
        insights:
          debts.length > 0
            ? [
                `Maior CET: ${Math.max(...debts.map((d) => num(d.cet))).toFixed(2)}% — priorize a quitação.`,
              ]
            : ["Sem dívidas ativas no período."],
        recommendations: ["Avaliar portabilidade de dívidas com CET acima de 30%."],
      };
    }
    case "FGTS": {
      const accs = await list<{
        employer: string;
        cnpj: string | null;
        status: string;
        balance: number;
        monthly_deposit: number;
        last_movement: string | null;
      }>("fgts_accounts", userId);
      const total = accs.reduce((a, b) => a + num(b.balance), 0);
      return {
        ...base,
        title: "Relatório de FGTS",
        summary: [
          { label: "Saldo total", value: formatBRL(total) },
          { label: "Contas", value: String(accs.length) },
        ],
        sections: [
          {
            heading: "Contas vinculadas",
            table: {
              columns: ["Empregador", "CNPJ", "Status", "Saldo", "Depósito mensal", "Última mov."],
              rows: accs.map((f) => [
                f.employer,
                f.cnpj ?? "—",
                f.status,
                formatBRL(num(f.balance)),
                formatBRL(num(f.monthly_deposit)),
                f.last_movement
                  ? new Date(f.last_movement).toLocaleDateString("pt-BR")
                  : "—",
              ]),
              totals: ["TOTAL", "", "", formatBRL(total), "", ""],
            },
          },
        ],
        insights: [`${accs.length} conta(s) FGTS vinculada(s).`],
        recommendations: ["Avaliar saque-aniversário se a estratégia for liquidez no curto prazo."],
      };
    }
  }
}
