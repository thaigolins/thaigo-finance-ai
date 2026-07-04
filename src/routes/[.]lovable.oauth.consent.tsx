import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, Loader2 } from "lucide-react";

// Beta OAuth namespace on the Supabase client — typed wrapper to keep TS happy.
type AuthorizationDetails = {
  client?: { name?: string; logo_uri?: string; client_uri?: string };
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () =>
  (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar esta solicitação: {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Nenhum redirect retornado pelo servidor de autorização.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "Este aplicativo";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border/40 bg-card p-8 shadow-elegant">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-emerald-soft">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Thaigo Finance AI</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Autorização de acesso
            </p>
          </div>
        </div>

        <h1 className="mt-8 text-xl font-semibold leading-tight tracking-tight">
          Conectar <span className="text-primary">{clientName}</span> à sua conta
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {clientName} poderá acessar as ferramentas do Thaigo Finance AI em seu nome. Todos os dados
          continuam sujeitos às suas permissões (RLS). Você pode revogar o acesso a qualquer momento.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2">
          <Button
            disabled={busy}
            onClick={() => decide(true)}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Autorizar acesso
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => decide(false)}
            className="w-full border-border/60 bg-muted/10"
          >
            Recusar
          </Button>
        </div>

        <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Conexão OAuth 2.1 · tokens escopados por usuário
        </div>
      </div>
    </main>
  );
}
