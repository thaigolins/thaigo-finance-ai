import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getFinancialSummary from "./tools/get-financial-summary";
import listTransactions from "./tools/list-transactions";
import listGoals from "./tools/list-goals";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "thaigo-finance-mcp",
  title: "Thaigo Finance AI",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in user's personal finance data on Thaigo Finance AI: consolidated snapshot, bank transactions, and goals. All tools operate as the authenticated user (RLS enforced).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getFinancialSummary, listTransactions, listGoals],
});
