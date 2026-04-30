import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ChevronLeft, Search, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BANKS = [
  { name: "Nubank", code: "260", color: "#820AD1", initials: "NU" },
  { name: "Itaú", code: "341", color: "#FF6600", initials: "IT" },
  { name: "Bradesco", code: "237", color: "#CC092F", initials: "BR" },
  { name: "Banco do Brasil", code: "001", color: "#F9C700", initials: "BB" },
  { name: "Caixa Econômica", code: "104", color: "#005CA9", initials: "CX" },
  { name: "Santander", code: "033", color: "#EC0000", initials: "SA" },
  { name: "Inter", code: "077", color: "#FF6B00", initials: "IN" },
  { name: "C6 Bank", code: "336", color: "#3D3D3D", initials: "C6" },
  { name: "BTG Pactual", code: "208", color: "#C9A84C", initials: "BT" },
  { name: "XP", code: "102", color: "#1A1A1A", initials: "XP" },
  { name: "Sicoob", code: "756", color: "#007A3D", initials: "SC" },
  { name: "Sicredi", code: "748", color: "#5FA110", initials: "SR" },
  { name: "Safra", code: "422", color: "#1A1B4B", initials: "SF" },
  { name: "Mercado Pago", code: "323", color: "#009EE3", initials: "MP" },
  { name: "PicPay", code: "380", color: "#21C25E", initials: "PP" },
  { name: "Neon", code: "536", color: "#00C4D4", initials: "NE" },
  { name: "Banco Original", code: "212", color: "#00A859", initials: "OR" },
  { name: "Pagseguro", code: "290", color: "#00B140", initials: "PS" },
  { name: "Outro", code: "000", color: "#6B7280", initials: "??" },
];

type Bank = (typeof BANKS)[number];

function BankAvatar({
  color,
  initials,
  size = 48,
}: {
  name?: string;
  color: string;
  initials: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color + "25",
        border: `2px solid ${color}60`,
        borderRadius: size * 0.25,
      }}
      className="flex flex-shrink-0 items-center justify-center"
    >
      <span
        style={{
          color,
          fontSize: size * 0.36,
          fontWeight: 700,
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}
      >
        {initials}
      </span>
    </div>
  );
}

type FormValues = {
  bank: string;
  account_type: string;
  branch: string;
  account_number: string;
  balance: number;
};

export type AccountSubmit = FormValues & {
  color: string;
  bank_color: string;
  bank_logo: null;
};

type Props = {
  trigger: React.ReactNode;
  title?: string;
  description?: string;
  defaultValues?: Partial<FormValues> & { bank_color?: string | null; bank_logo?: string | null };
  submitLabel?: string;
  onSubmit: (values: AccountSubmit) => Promise<void> | void;
};

const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Conta Poupança" },
  { value: "salary", label: "Conta Salário" },
  { value: "digital", label: "Conta Digital" },
  { value: "investment", label: "Investimentos" },
  { value: "wallet", label: "Carteira Digital" },
  { value: "other", label: "Outros" },
];

export function BankPickerDialog({
  trigger,
  title = "Nova conta bancária",
  description,
  defaultValues,
  submitLabel = "Salvar conta",
  onSubmit,
}: Props) {
  const initialBank = useMemo<Bank | null>(() => {
    if (!defaultValues?.bank) return null;
    const found = BANKS.find(
      (b) => b.name.toLowerCase() === defaultValues.bank!.toLowerCase(),
    );
    if (found) return found;
    return {
      name: defaultValues.bank,
      code: "000",
      color: defaultValues.bank_color ?? "#6B7280",
      initials: defaultValues.bank.slice(0, 2).toUpperCase(),
    };
  }, [defaultValues]);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(initialBank ? 2 : 1);
  const [selected, setSelected] = useState<Bank | null>(initialBank);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<string>(
    defaultValues?.account_type ?? "checking",
  );

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      bank: defaultValues?.bank ?? "",
      account_type: defaultValues?.account_type ?? "checking",
      branch: defaultValues?.branch ?? "",
      account_number: defaultValues?.account_number ?? "",
      balance: defaultValues?.balance ?? 0,
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return BANKS;
    return BANKS.filter(
      (b) => b.name.toLowerCase().includes(q) || b.code.includes(q),
    );
  }, [search]);

  function handleOpen(v: boolean) {
    setOpen(v);
    if (!v) {
      setStep(initialBank ? 2 : 1);
      setSelected(initialBank);
      setSearch("");
      setAccountType(defaultValues?.account_type ?? "checking");
      reset({
        bank: defaultValues?.bank ?? "",
        account_type: defaultValues?.account_type ?? "checking",
        branch: defaultValues?.branch ?? "",
        account_number: defaultValues?.account_number ?? "",
        balance: defaultValues?.balance ?? 0,
      });
    }
  }

  function pickBank(bank: Bank) {
    setSelected(bank);
    setStep(2);
  }

  async function submit(raw: FormValues) {
    if (!selected) {
      setStep(1);
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        ...raw,
        bank: selected.name,
        account_type: accountType,
        color: selected.color,
        bank_color: selected.color,
        bank_logo: null,
      });
      toast.success("Conta salva com sucesso!");
      handleOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl border-border/40 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <span>
              {step === 1 ? title : `${selected?.name} — dados da conta`}
            </span>
          </DialogTitle>
          {step === 1 && (
            <DialogDescription className="text-xs text-muted-foreground">
              {description ?? "Selecione o banco para começar"}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar banco por nome ou código..."
                className="border-border/60 bg-muted/20 pl-9"
                autoFocus
              />
            </div>
            <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {filtered.map((bank) => {
                const isSelected = selected?.name === bank.name;
                return (
                  <button
                    key={bank.name}
                    type="button"
                    onClick={() => pickBank(bank)}
                    style={{
                      borderColor: isSelected ? bank.color : undefined,
                      backgroundColor: isSelected ? bank.color + "10" : undefined,
                    }}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition hover:border-primary/40 hover:bg-muted/20 ${
                      isSelected ? "border-2" : "border-border/40"
                    }`}
                  >
                    <BankAvatar
                      name={bank.name}
                      color={bank.color}
                      initials={bank.initials}
                      size={48}
                    />
                    <span className="line-clamp-1 text-xs font-medium">
                      {bank.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {bank.code}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  Nenhum banco encontrado.
                </p>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(submit)} className="space-y-4 py-2">
            {selected && (
              <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 p-3">
                <BankAvatar
                  name={selected.name}
                  color={selected.color}
                  initials={selected.initials}
                  size={48}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{selected.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Código {selected.code}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Tipo de conta
              </Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger className="border-border/60 bg-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Agência
                </Label>
                <Input
                  {...register("branch")}
                  placeholder="0001"
                  className="border-border/60 bg-muted/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Conta
                </Label>
                <Input
                  {...register("account_number")}
                  placeholder="12345-6"
                  className="border-border/60 bg-muted/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Saldo atual (R$)
              </Label>
              <Input
                type="number"
                step="0.01"
                {...register("balance", { valueAsNumber: true })}
                className="border-border/60 bg-muted/20"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Trocar banco
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
