import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Sparkles, TrendingUp, PiggyBank, Receipt, Lightbulb, Paperclip, Mic, Landmark, Banknote } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat IA Financeiro — Thaigo Finance AI" },
      { name: "description", content: "Converse com sua IA financeira pessoal." },
    ],
  }),
  component: ChatPage,
});

type Message = { id: string; role: "user" | "assistant"; content: string };

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Bom dia, Thaigo. Sou seu assistente financeiro privado. Tenho acesso à visão consolidada das suas contas, cartões, investimentos e metas — posso analisar gastos, sugerir realocações de portfólio e antecipar vencimentos. Como posso ajudá-lo hoje?",
  },
];

const suggestions = [
  { icon: TrendingUp, label: "Análise de portfólio", desc: "Como está minha carteira este mês?" },
  { icon: Receipt, label: "Gastos por categoria", desc: "Detalhe minhas despesas de abril" },
  { icon: PiggyBank, label: "Reserva de emergência", desc: "Quanto falta para minha meta?" },
  { icon: Lightbulb, label: "Otimização", desc: "Quais assinaturas posso cortar?" },
  { icon: Landmark, label: "Atualizar dívidas", desc: "Segue extrato do empréstimo, atualize minhas dívidas" },
  { icon: Banknote, label: "Atualizar FGTS", desc: "Segue extrato do FGTS, atualize meu saldo" },
];

function smartReply(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("empréstimo") || t.includes("emprestimo") || t.includes("dívida") || t.includes("divida")) {
    return "Recebi o extrato do empréstimo. Identifiquei: instituição **Itaú**, tipo **Financiamento Imóvel**, saldo devedor **R$ 312.400,00**, taxa **9,8% a.a.**, CET **10,6%**, **288 parcelas restantes** de **R$ 3.850,40** (vencimento dia 10).\n\nDeseja que eu **registre essa dívida** no módulo Empréstimos & Dívidas? Responda **\"confirmar\"** para gravar definitivamente ou **\"ajustar\"** para revisar os campos.";
  }
  if (t.includes("fgts")) {
    return "Recebi o extrato do FGTS. Identifiquei: empregador **Tech Holding S.A.** (CNPJ 12.345.678/0001-90), conta **ativa**, saldo **R$ 48.230,50**, depósito mensal **R$ 1.480,00**, JAM do mês **R$ 312,40**, última movimentação **15/04/2026**.\n\nDeseja que eu **atualize sua conta FGTS** com esses dados? Responda **\"confirmar\"** para gravar ou **\"ajustar\"** para revisar antes.";
  }
  return "Analisando sua posição consolidada de abril: a maior linha de despesa foi Moradia (R$ 4.580 — 43% do total). Suas saídas recuaram 7,6% versus março, liberando R$ 870 de fluxo livre. Recomendo manter o aporte mensal de R$ 5.000 em renda fixa indexada à inflação e reavaliar duas assinaturas de baixo uso. Posso preparar um plano detalhado?";
}

function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const reply: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: smartReply(trimmed),
    };
    setMessages((m) => [...m, userMsg, reply]);
    setInput("");
  };

  return (
    <>
      <AppHeader title="Chat IA Financeiro" subtitle="Assistente private · disponível 24/7" />
      <main className="flex flex-1 flex-col p-4 md:p-8">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-3xl border border-border/40 bg-card shadow-elegant">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-emerald-soft">
                  <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">Thaigo AI · Private</p>
                <p className="text-[11px] text-muted-foreground">
                  Conectado · Análise em tempo real
                </p>
              </div>
            </div>
            <span className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              GPT · Financeiro
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    m.role === "user"
                      ? "border border-border/60 bg-muted/40 text-foreground"
                      : "border border-primary/30 bg-emerald-soft text-primary",
                  )}
                >
                  {m.role === "user" ? "T" : <Sparkles className="h-3.5 w-3.5" />}
                </div>
                <div
                  className={cn(
                    "max-w-[78%] whitespace-pre-line text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-2xl rounded-tr-sm border border-border/40 bg-muted/30 px-4 py-2.5"
                      : "rounded-2xl rounded-tl-sm bg-transparent px-1 py-1 text-foreground/95",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="grid gap-2 border-t border-border/40 p-4 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.desc)}
                  className="group flex items-start gap-3 rounded-xl border border-border/40 bg-muted/10 p-3 text-left transition hover:border-primary/40 hover:bg-emerald-soft"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card text-primary">
                    <s.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{s.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border/40 p-4"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-border/40 bg-muted/20 p-2 transition focus-within:border-primary/40">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="h-4 w-4" strokeWidth={1.75} />
              </Button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Pergunte sobre seu portfólio, gastos ou planejamento..."
                rows={1}
                className="flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Mic className="h-4 w-4" strokeWidth={1.75} />
              </Button>
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 px-2 text-[10px] text-muted-foreground">
              As respostas são geradas por IA com base nos seus dados financeiros. Confirme decisões importantes.
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
