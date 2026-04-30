import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  User as UserIcon,
  Upload,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Building2,
  Settings as SettingsIcon,
  Shield,
  Download,
  AlertTriangle,
  Save,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  useUserList,
  useUserInsert,
  useUserUpdate,
  useUserDelete,
} from "@/lib/queries";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — Thaigo Finance AI" },
      {
        name: "description",
        content: "Gerencie seu perfil, contas bancárias, preferências e dados.",
      },
    ],
  }),
  component: SettingsPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type BankAccount = {
  id: string;
  bank: string;
  account_type: "checking" | "savings" | "investment" | "wallet" | "other";
  branch: string | null;
  account_number: string | null;
  balance: number;
  color: string | null;
};

const accountTypeLabels: Record<BankAccount["account_type"], string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  investment: "Investimentos",
  wallet: "Carteira Digital",
  other: "Outros",
};

const accountSchema = z.object({
  bank: z.string().min(1, "Banco obrigatório"),
  account_type: z.enum(["checking", "savings", "investment", "wallet", "other"]),
  branch: z.string().optional(),
  account_number: z.string().optional(),
  balance: z.number({ invalid_type_error: "Saldo inválido" }),
  color: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

type Preferences = {
  theme: "dark" | "light";
  notifyDuplicates: boolean;
  currency: string;
  dateFormat: string;
};

const DEFAULT_PREFS: Preferences = {
  theme: "dark",
  notifyDuplicates: true,
  currency: "BRL",
  dateFormat: "DD/MM/YYYY",
};

function SettingsPage() {
  return (
    <>
      <AppHeader title="Configurações" subtitle="Perfil, contas, preferências e dados" />
      <main className="flex-1 space-y-8 px-4 py-6 md:px-8 md:py-10">
        <ProfileSection />
        <AccountsSection />
        <PreferencesSection />
        <PrivacySection />
      </main>
    </>
  );
}

/* ============================================================
 * 1. PERFIL DO USUÁRIO
 * ============================================================ */
function ProfileSection() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [signedAvatar, setSignedAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        toast.error("Erro ao carregar perfil");
      }
      if (data) {
        setProfile(data as Profile);
        setFullName(data.full_name ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  // Resolve signed URL for private avatar
  useEffect(() => {
    if (!avatarUrl) {
      setSignedAvatar(null);
      return;
    }
    if (avatarUrl.startsWith("http")) {
      setSignedAvatar(avatarUrl);
      return;
    }
    (async () => {
      const { data } = await supabase.storage
        .from("images")
        .createSignedUrl(avatarUrl, 60 * 60);
      setSignedAvatar(data?.signedUrl ?? null);
    })();
  }, [avatarUrl]);

  async function handleUpload(file: File) {
    if (!user?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setAvatarUrl(path);
      toast.success("Foto carregada. Clique em Salvar para confirmar.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            full_name: fullName.trim() || null,
            avatar_url: avatarUrl,
          },
          { onConflict: "id" },
        );
      if (error) throw error;
      toast.success("Perfil atualizado");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  const initial = (fullName || user?.email || "?").charAt(0).toUpperCase();

  return (
    <section className="rounded-2xl border border-border/40 bg-card/30 p-6">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserIcon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Perfil do usuário</h2>
          <p className="text-xs text-muted-foreground">Suas informações pessoais</p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-24 w-24 border border-border/40">
              {signedAvatar && <AvatarImage src={signedAvatar} alt={fullName} />}
              <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-full"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? "Enviando..." : "Trocar foto"}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
              <p className="text-[11px] text-muted-foreground">
                O email é gerenciado pela autenticação e não pode ser alterado aqui.
              </p>
            </div>
            <div>
              <Button onClick={handleSave} disabled={saving} className="rounded-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================
 * 2. CONTAS BANCÁRIAS
 * ============================================================ */
function AccountsSection() {
  const { data: accounts = [], isLoading } = useUserList<BankAccount>("bank_accounts", {
    orderBy: "created_at",
  });
  const insertAccount = useUserInsert<Record<string, unknown>>("bank_accounts");
  const updateAccount = useUserUpdate<Record<string, unknown>>("bank_accounts");
  const removeAccount = useUserDelete("bank_accounts");

  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [open, setOpen] = useState(false);

  const fields = [
    { name: "bank" as const, label: "Banco", placeholder: "Itaú, Nubank, etc." },
    {
      name: "account_type" as const,
      label: "Tipo",
      type: "select" as const,
      options: Object.entries(accountTypeLabels).map(([value, label]) => ({ value, label })),
    },
    { name: "branch" as const, label: "Agência", placeholder: "0001" },
    { name: "account_number" as const, label: "Conta", placeholder: "12345-6" },
    { name: "balance" as const, label: "Saldo atual", type: "number" as const, step: "0.01" },
  ];

  return (
    <section className="rounded-2xl border border-border/40 bg-card/30 p-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Contas bancárias</h2>
            <p className="text-xs text-muted-foreground">
              {accounts.length} conta{accounts.length === 1 ? "" : "s"} cadastrada
              {accounts.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <FormDialog<AccountForm>
          open={open && editing === null}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
          trigger={
            <Button size="sm" className="rounded-full" onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" /> Nova conta
            </Button>
          }
          title="Nova conta bancária"
          description="Cadastre uma conta que será usada nas movimentações."
          schema={accountSchema}
          fields={fields}
          defaultValues={{
            bank: "",
            account_type: "checking",
            branch: "",
            account_number: "",
            balance: 0,
            color: "",
          }}
          onSubmit={async (values) => {
            await insertAccount.mutateAsync(values as Record<string, unknown>);
            toast.success("Conta criada");
            setOpen(false);
          }}
        />
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada ainda.</p>
      ) : (
        <ul className="grid gap-3">
          {accounts.map((acc) => (
            <li
              key={acc.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/40 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{acc.bank}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {accountTypeLabels[acc.account_type]}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[acc.branch && `Ag. ${acc.branch}`, acc.account_number && `Cc. ${acc.account_number}`]
                    .filter(Boolean)
                    .join(" · ") || "Sem agência/conta"}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${
                    Number(acc.balance) >= 0 ? "text-foreground" : "text-destructive"
                  }`}
                >
                  {formatBRL(Number(acc.balance))}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setEditing(acc)}
                  aria-label="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    if (!confirm(`Remover a conta ${acc.bank}?`)) return;
                    await removeAccount.mutateAsync(acc.id);
                    toast.success("Conta removida");
                  }}
                  aria-label="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Edit dialog */}
      {editing && (
        <FormDialog<AccountForm>
          open={!!editing}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
          title={`Editar ${editing.bank}`}
          schema={accountSchema}
          fields={fields}
          defaultValues={{
            bank: editing.bank,
            account_type: editing.account_type,
            branch: editing.branch ?? "",
            account_number: editing.account_number ?? "",
            balance: Number(editing.balance),
            color: editing.color ?? "",
          }}
          onSubmit={async (values) => {
            await updateAccount.mutateAsync({
              id: editing.id,
              values: values as Record<string, unknown>,
            });
            toast.success("Conta atualizada");
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

/* ============================================================
 * 3. PREFERÊNCIAS
 * ============================================================ */
function PreferencesSection() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("thaigo:prefs");
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("thaigo:prefs", JSON.stringify(next));
    }
    if (key === "theme") {
      document.documentElement.classList.toggle("dark", value === "dark");
    }
    toast.success("Preferência salva");
  }

  return (
    <section className="rounded-2xl border border-border/40 bg-card/30 p-6">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SettingsIcon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Preferências do app</h2>
          <p className="text-xs text-muted-foreground">Aparência, notificações e formatos</p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 p-4">
          <div>
            <p className="text-sm font-medium">Tema escuro</p>
            <p className="text-xs text-muted-foreground">Alternar entre escuro e claro</p>
          </div>
          <Switch
            checked={prefs.theme === "dark"}
            onCheckedChange={(c) => update("theme", c ? "dark" : "light")}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 p-4">
          <div>
            <p className="text-sm font-medium">Notificar duplicatas</p>
            <p className="text-xs text-muted-foreground">Avisar ao detectar duplicatas em importações</p>
          </div>
          <Switch
            checked={prefs.notifyDuplicates}
            onCheckedChange={(c) => update("notifyDuplicates", c)}
          />
        </div>

        <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-4">
          <Label className="text-xs font-medium">Moeda padrão</Label>
          <Select value={prefs.currency} onValueChange={(v) => update("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BRL">Real (BRL)</SelectItem>
              <SelectItem value="USD">Dólar (USD)</SelectItem>
              <SelectItem value="EUR">Euro (EUR)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-4">
          <Label className="text-xs font-medium">Formato de data</Label>
          <Select value={prefs.dateFormat} onValueChange={(v) => update("dateFormat", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * 4. DADOS E PRIVACIDADE
 * ============================================================ */
function PrivacySection() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0); // 0 = idle, 1 = warning shown
  const [wiping, setWiping] = useState(false);

  async function handleExport() {
    if (!user?.id) return;
    setExporting(true);
    try {
      const tables = [
        "profiles",
        "bank_accounts",
        "bank_transactions",
        "categories",
        "credit_cards",
        "invoices",
        "invoice_transactions",
        "goals",
        "investments",
        "recurring_expenses",
        "loan_accounts",
        "loan_payments",
        "fgts_accounts",
        "fgts_entries",
        "payslips",
        "import_sessions",
        "import_staging_transactions",
        "ai_conversations",
        "ai_messages",
        "alerts",
        "uploaded_files",
      ];
      const out: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
      };
      for (const t of tables) {
        const { data, error } = await supabase.from(t as never).select("*");
        if (error) {
          console.warn(`[export] ${t}:`, error.message);
          out[t] = { error: error.message };
        } else {
          out[t] = data;
        }
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `thaigo-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar dados");
    } finally {
      setExporting(false);
    }
  }

  async function handleWipe() {
    if (!user?.id) return;
    setWiping(true);
    try {
      // Delete em ordem (filhos antes dos pais quando relevante)
      const deletes = [
        "import_staging_transactions",
        "import_sessions",
        "bank_transactions",
        "ai_messages",
        "ai_conversations",
        "uploaded_files",
      ];
      for (const t of deletes) {
        const { error } = await supabase.from(t as never).delete().eq("user_id", user.id);
        if (error) {
          console.warn(`[wipe] ${t}:`, error.message);
        }
      }
      const { error: balErr } = await supabase
        .from("bank_accounts")
        .update({ balance: 0 })
        .eq("user_id", user.id);
      if (balErr) console.warn("[wipe] bank_accounts balance:", balErr.message);

      toast.success("Lançamentos apagados e saldos zerados");
      setConfirmStep(0);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao apagar dados");
    } finally {
      setWiping(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/40 bg-card/30 p-6">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Dados e privacidade</h2>
          <p className="text-xs text-muted-foreground">Exporte ou apague seus dados</p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/40 bg-background/40 p-4">
          <p className="text-sm font-medium">Exportar meus dados</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Baixe um arquivo JSON com todos os seus dados.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-full"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Exportando..." : "Exportar JSON"}
          </Button>
        </div>

        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Apagar todos os lançamentos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Remove movimentações, importações e conversas. Mantém suas contas (zera saldos).
          </p>

          {confirmStep === 1 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Esta ação é irreversível.</strong> Clique novamente em "Confirmar
                exclusão" para apagar definitivamente.
              </span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {confirmStep === 0 ? (
              <Button
                variant="destructive"
                size="sm"
                className="rounded-full"
                onClick={() => setConfirmStep(1)}
              >
                <Trash2 className="h-4 w-4" /> Apagar lançamentos
              </Button>
            ) : (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  onClick={handleWipe}
                  disabled={wiping}
                >
                  {wiping ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                  Confirmar exclusão
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setConfirmStep(0)}
                  disabled={wiping}
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
