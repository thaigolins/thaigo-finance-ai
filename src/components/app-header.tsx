import { Bell, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden flex-col leading-tight md:flex">
        <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar transações, cartões, metas..."
            className="h-9 w-72 rounded-full border-border/60 bg-card/60 pl-9 text-sm"
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="relative h-9 w-9 rounded-full text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
        </Button>
      </div>
    </header>
  );
}
