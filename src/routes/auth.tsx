import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Mail, Lock, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso — Thaigo Finance AI" },
      { name: "description", content: "Acesse sua conta private no Thaigo Finance AI." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo de volta.");
    navigate({ to: "/" });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada. Verifique seu e-mail para ativar.");
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error(result.error.message ?? "Falha ao autenticar.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between rounded-3xl border border-border/40 bg-gradient-to-br from-card to-background p-10 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-emerald-soft">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">Thaigo Finance AI</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Private · Wealth
                </p>
              </div>
            </div>
            <h1 className="mt-12 text-3xl font-semibold leading-tight tracking-tight">
              Sua gestão patrimonial,
              <br />
              <span className="text-primary">elevada por IA.</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Visão consolidada de contas, cartões, faturas, FGTS, dívidas, investimentos e metas — com
              relatórios executivos e assistente financeiro 24/7.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Criptografia de nível bancário · Acesso somente seu
          </div>
        </div>

        {/* Auth form */}
        <div className="rounded-3xl border border-border/40 bg-card p-8 shadow-elegant">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-emerald-soft">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">Thaigo Finance AI</p>
            </div>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/30">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6 space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 border-border/60 bg-muted/20" placeholder="voce@exemplo.com" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" type="password" required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 border-border/60 bg-muted/20" placeholder="••••••••" />
                  </div>
                </div>
                <Button type="submit" disabled={busy}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Acessar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6 space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input id="fullName" required value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="border-border/60 bg-muted/20" placeholder="Seu nome" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-su">E-mail</Label>
                  <Input id="email-su" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-border/60 bg-muted/20" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password-su">Senha</Label>
                  <Input id="password-su" type="password" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-border/60 bg-muted/20" placeholder="Mínimo 6 caracteres" />
                </div>
                <Button type="submit" disabled={busy}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Criar conta private
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">ou continue com</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => handleOAuth("google")}
              className="border-border/60 bg-muted/10">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#fff" d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.45-1.7 4.27-5.27 4.27-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.81 3.97 14.7 3 12.18 3 6.99 3 2.79 7.2 2.79 12.38s4.2 9.38 9.39 9.38c5.42 0 9.01-3.81 9.01-9.18 0-.62-.07-1.09-.17-1.48z"/></svg>
              Google
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => handleOAuth("apple")}
              className="border-border/60 bg-muted/10">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16.365 12.79c-.02-2.16 1.77-3.2 1.85-3.25-1.01-1.47-2.58-1.67-3.13-1.69-1.34-.13-2.6.78-3.28.78-.69 0-1.73-.77-2.84-.74-1.46.02-2.81.85-3.56 2.16-1.51 2.61-.39 6.49 1.09 8.61.72 1.04 1.59 2.21 2.72 2.17 1.09-.04 1.5-.71 2.83-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.06 2.65-2.1.83-1.21 1.18-2.39 1.2-2.45-.02-.01-2.31-.89-2.39-3.47zM14.34 6.4c.59-.72 1-1.71.89-2.7-.86.04-1.91.58-2.52 1.29-.55.62-1.03 1.63-.9 2.6.96.07 1.93-.49 2.53-1.19z"/></svg>
              Apple
            </Button>
          </div>

          {typeof window !== "undefined" && window.location.hostname.includes("id-preview--") ? (
            <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground/80">
              No ambiente de preview, o login social pode falhar por restrições de redirect.
              Use e-mail e senha — funciona normalmente no site publicado.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
