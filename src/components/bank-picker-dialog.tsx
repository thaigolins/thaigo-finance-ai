import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BANKS, type BankDef } from "@/lib/banks";
import { BankLogo } from "@/components/bank-logo";

export const accountTypeOptions = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "investment", label: "Investimentos" },
  { value: "wallet", label: "Carteira Digital" },
  { value: "other", label: "Outros" },
] as const;

const detailsSchema = z.object({
  bank: z.string().min(1, "Banco obrigatório"),
  account_type: z.enum(["checking", "savings", "investment", "wallet", "other"]),
  branch: z.string().optional(),
  account_number: z.string().optional(),
  balance: z.number({ invalid_type_error: "Saldo inválido" }),
});
type DetailsForm = z.infer<typeof detailsSchema>;

export type AccountSubmit = DetailsForm & {
  color: string | null;
  bank_color: string | null;
  bank_logo: string | null;
};

type Defaults = Partial<{
  bank: string;
  account_type: DetailsForm["account_type"];
  branch: string;
  account_number: string;
  balance: number;
  bank_color: string | null;
  bank_logo: string | null;
}>;

type Props = {
  trigger: React.ReactNode;
  title?: string;
  description?: string;
  defaultValues?: Defaults;
  submitLabel?: string;
  onSubmit: (values: AccountSubmit) => Promise<void> | void;
};

export function BankPickerDialog({
  trigger,
  title = "Nova conta bancária",
  description = "Selecione o banco e preencha os dados da conta.",
  defaultValues,
  submitLabel = "Salvar conta",
  onSubmit,
}: Props) {
  const initialBank = useMemo<BankDef | null>(() => {
    if (!defaultValues?.bank) return null;
    return (
      BANKS.find((b) => b.name.toLowerCase() === defaultValues.bank!.toLowerCase()) ?? {
        name: defaultValues.bank,
        code: "000",
        color: defaultValues.bank_color ?? "#6B7280",
        logo: defaultValues.bank_logo ?? null,
      }
    );
  }, [defaultValues]);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(initialBank ? 2 : 1);
  const [selected, setSelected] = useState<BankDef | null>(initialBank);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const form = useForm<DetailsForm>({
    defaultValues: {
      bank: defaultValues?.bank ?? "",
      account_type: defaultValues?.account_type ?? "checking",
      branch: defaultValues?.branch ?? "",
      account_number: defaultValues?.account_number ?? "",
      balance: defaultValues?.balance ?? 0,
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return BANKS;
    return BANKS.filter(
      (b) => b.name.toLowerCase().includes(q) || b.code.includes(q),
    );
  }, [search]);

  function reset() {
    setStep(initialBank ? 2 : 1);
    setSelected(initialBank);
    setSearch("");
    form.reset({
      bank: defaultValues?.bank ?? "",
      account_type: defaultValues?.account_type ?? "checking",
      branch: defaultValues?.branch ?? "",
      account_number: defaultValues?.account_number ?? "",
      balance: defaultValues?.balance ?? 0,
    });
  }

  function pickBank(bank: BankDef) {
    setSelected(bank);
    if (bank.name !== "Outro") {
      form.setValue("bank", bank.name);
    } else {
      form.setValue("bank", "");
    }
    setStep(2);
  }

  async function handleSubmit(raw: DetailsForm) {
    const parsed = detailsSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (!selected) {
      toast.error("Selecione um banco");
      setStep(1);
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        ...parsed.data,
        color: selected.color,
        bank_color: selected.color,
        bank_logo: selected.logo ?? null,
      });
      toast.success("Conta salva");
      setOpen(false);
      reset();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl border-border/40 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted/30"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {step === 1 ? title : `${selected?.name ?? "Banco"} — dados da conta`}
          </DialogTitle>
          {description && step === 1 && (
            <DialogDescription className="text-xs text-muted-foreground">
              {description}
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
                className="pl-9 border-border/60 bg-muted/20"
                autoFocus
              />
            </div>
            <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {filtered.map((b) => {
                const isSelected = selected?.name === b.name;
                return (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => pickBank(b)}
                    style={{
                      borderColor: isSelected ? b.color : undefined,
                      backgroundColor: isSelected ? b.color + "10" : undefined,
                    }}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition hover:border-primary/40 hover:bg-muted/20 ${
                      isSelected ? "border-2" : "border-border/40"
                    }`}
                  >
                    <BankLogo name={b.name} logo={b.logo} color={b.color} size={48} />
                    <span className="line-clamp-1 text-xs font-medium">{b.name}</span>
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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 p-3">
              {selected && (
                <BankLogo
                  name={selected.name}
                  logo={selected.logo}
                  color={selected.color}
                  size={48}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{selected?.name}</p>
                <p className="text-[11px] text-muted-foreground">Código {selected?.code}</p>
              </div>
            </div>

            {selected?.name === "Outro" && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Nome do banco
                </Label>
                <Input
                  {...form.register("bank")}
                  placeholder="Digite o nome do banco"
                  className="border-border/60 bg-muted/20"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Tipo de conta
              </Label>
              <Select
                value={form.watch("account_type")}
                onValueChange={(v) =>
                  form.setValue("account_type", v as DetailsForm["account_type"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="border-border/60 bg-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
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
                  {...form.register("branch")}
                  placeholder="0001"
                  className="border-border/60 bg-muted/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Conta
                </Label>
                <Input
                  {...form.register("account_number")}
                  placeholder="12345-6"
                  className="border-border/60 bg-muted/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Saldo atual
              </Label>
              <Input
                type="number"
                step="0.01"
                {...form.register("balance", { valueAsNumber: true })}
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
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Salvando...
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
