import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Sparkles, TrendingUp, PiggyBank, Receipt, Lightbulb } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      "Olá Thaigo 👋 Sou sua IA financeira. Posso analisar seus gastos, sugerir realocações de investimento, lembrar vencimentos e responder perguntas sobre suas finanças. Como posso te ajudar hoje?",
  },
];

const suggestions = [
  { icon: TrendingUp, label: "Como está minha carteira este mês?" },
  { icon: Receipt, label: "Quanto gastei com alimentação em abril?" },
  { icon: PiggyBank, label: "Sugira como acelerar minha reserva" },
  { icon: Lightbulb, label: "Quais assinaturas posso cortar?" },
];

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
      content:
        "Analisei seus dados (mockados): em abril, seu maior gasto foi com Moradia (R$ 4.580). Suas saídas caíram 7,6% vs. março. Recomendo manter o aporte mensal de R$ 5.000 em renda fixa e revisar 2 assinaturas pouco usadas. Quer que eu detalhe?",
    };
    setMessages((m) => [...m, userMsg, reply]);
    setInput("");
  };

  return (
    <>
      <AppHeader title="Chat IA Financeiro" subtitle="Sua assistente private 24/7" />
      <main className="flex flex-1 flex-col p-4 md:p-6">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col rounded-3xl border border-border/60 bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-card px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground"/>
            </div>
            <div>
              <p className="text-sm font-semibold">Thaigo AI</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"/> Online · GPT Financeiro
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  m.role === "user" ? "bg-muted text-foreground" : "bg-gradient-primary text-primary-foreground"
                )}>
                  {m.role === "user" ? "T" : <Sparkles className="h-4 w-4"/>}
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary/15 text-foreground rounded-tr-sm"
                    : "bg-muted/40 text-foreground rounded-tl-sm"
                )}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {messages.length <= 1 && (
            <div className="grid gap-2 border-t border-border/60 p-4 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.label)}
                  className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-left text-sm transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <s.icon className="h-4 w-4 shrink-0 text-primary"/>
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-border/60 p-4"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo sobre suas finanças..."
              className="h-11 rounded-full border-border/60 bg-muted/30 px-4"
            />
            <Button type="submit" size="icon" className="h-11 w-11 rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
              <Send className="h-4 w-4"/>
            </Button>
          </form>
        </div>
      </main>
    </>
  );
}
