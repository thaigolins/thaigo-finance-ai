import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_transactions",
  title: "List bank transactions",
  description:
    "List the signed-in user's bank transactions within a date range. Dates in YYYY-MM-DD. Returns up to 200 rows sorted by occurred_at desc.",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date, YYYY-MM-DD, inclusive."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date, YYYY-MM-DD, inclusive."),
    kind: z.enum(["income", "expense"]).optional().describe("Optional filter by transaction kind."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, kind, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("bank_transactions")
      .select("id,occurred_at,kind,amount,description,category")
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { transactions: data ?? [] },
    };
  },
});
