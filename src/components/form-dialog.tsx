import { useState, type ReactNode } from "react";
import { useForm, type DefaultValues, type Path, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export type FieldDef =
  | {
      name: string;
      label: string;
      type: "text" | "number" | "date" | "color";
      placeholder?: string;
      step?: string;
    }
  | {
      name: string;
      label: string;
      type: "textarea";
      placeholder?: string;
    }
  | {
      name: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
    };

type Props<T extends FieldValues> = {
  title: string;
  description?: string;
  trigger: ReactNode;
  schema: ZodType<T>;
  defaultValues: DefaultValues<T>;
  fields: FieldDef[];
  submitLabel?: string;
  onSubmit: (values: T) => Promise<void> | void;
};

export function FormDialog<T extends FieldValues>({
  title,
  description,
  trigger,
  schema,
  defaultValues,
  fields,
  submitLabel = "Salvar",
  onSubmit,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handle = async (values: T) => {
    setLoading(true);
    try {
      await onSubmit(values);
      toast.success("Salvo com sucesso");
      form.reset(defaultValues);
      setOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) form.reset(defaultValues);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg border-border/40 bg-card">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs text-muted-foreground">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handle)} className="space-y-4 py-2">
          {fields.map((f) => {
            const err = form.formState.errors[f.name as Path<T>]?.message as string | undefined;
            return (
              <div key={f.name} className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    {...form.register(f.name as Path<T>)}
                    placeholder={f.placeholder}
                    className="border-border/60 bg-muted/20"
                  />
                ) : f.type === "select" ? (
                  <Select
                    value={(form.watch(f.name as Path<T>) as string | undefined) ?? ""}
                    onValueChange={(v) =>
                      form.setValue(f.name as Path<T>, v as never, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="border-border/60 bg-muted/20">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type}
                    step={"step" in f ? f.step : undefined}
                    {...form.register(f.name as Path<T>, {
                      valueAsNumber: f.type === "number",
                    })}
                    placeholder={"placeholder" in f ? f.placeholder : undefined}
                    className="border-border/60 bg-muted/20"
                  />
                )}
                {err && <p className="text-[11px] text-destructive">{err}</p>}
              </div>
            );
          })}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
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
      </DialogContent>
    </Dialog>
  );
}
