import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export default defineTool({
  name: "get_financial_summary",
  title: "Get financial summary",
  description:
    "Return a consolidated snapshot for the signed-in user: bank balances, credit card limits, open invoices, investments, debts, FGTS, goals, and current-month cashflow.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [accounts, cards, invoices, invs, debts, fgts, goals, txs] = await Promise.all([
      sb.from("bank_accounts").select("bank,balance"),
      sb.from("credit_cards").select("credit_limit"),
      sb.from("invoices").select("status,total_amount"),
      sb.from("investments").select("amount,return_percent"),
      sb.from("loan_accounts").select("current_balance,monthly_payment"),
      sb.from("fgts_accounts").select("balance"),
      sb.from("goals").select("target_amount,current_amount"),
      sb.from("bank_transactions").select("kind,amount").gte("occurred_at", from).lte("occurred_at", to),
    ]);

    const acc = (accounts.data ?? []) as { bank: string; balance: number }[];
    const income = ((txs.data ?? []) as { kind: string; amount: number }[])
      .filter((t) => t.kind === "income").reduce((a, b) => a + num(b.amount), 0);
    const expense = ((txs.data ?? []) as { kind: string; amount: number }[])
      .filter((t) => t.kind === "expense").reduce((a, b) => a + num(b.amount), 0);

    const summary = {
      accounts: {
        count: acc.length,
        total: acc.reduce((a, b) => a + num(b.balance), 0),
        items: acc.map((a) => ({ bank: a.bank, balance: num(a.balance) })),
      },
      cards: {
        count: (cards.data ?? []).length,
        totalLimit: (cards.data ?? []).reduce((a: number, b: { credit_limit: number }) => a + num(b.credit_limit), 0),
      },
      invoices: {
        openCount: ((invoices.data ?? []) as { status: string }[]).filter((i) => i.status === "open" || i.status === "closed").length,
        openAmount: ((invoices.data ?? []) as { status: string; total_amount: number }[])
          .filter((i) => i.status === "open" || i.status === "closed")
          .reduce((a, b) => a + num(b.total_amount), 0),
      },
      investments: {
        count: (invs.data ?? []).length,
        total: (invs.data ?? []).reduce((a: number, b: { amount: number }) => a + num(b.amount), 0),
      },
      debts: {
        count: (debts.data ?? []).length,
        totalBalance: (debts.data ?? []).reduce((a: number, b: { current_balance: number }) => a + num(b.current_balance), 0),
        monthlyPayment: (debts.data ?? []).reduce((a: number, b: { monthly_payment: number }) => a + num(b.monthly_payment), 0),
      },
      fgts: {
        count: (fgts.data ?? []).length,
        total: (fgts.data ?? []).reduce((a: number, b: { balance: number }) => a + num(b.balance), 0),
      },
      goals: {
        count: (goals.data ?? []).length,
        target: (goals.data ?? []).reduce((a: number, b: { target_amount: number }) => a + num(b.target_amount), 0),
        current: (goals.data ?? []).reduce((a: number, b: { current_amount: number }) => a + num(b.current_amount), 0),
      },
      monthFlow: { income, expense, balance: income - expense, from, to },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
