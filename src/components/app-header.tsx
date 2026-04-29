import { Bell, Search, Download } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExportPdfDialog } from "@/components/export-pdf-dialog";

export function AppHeader({
  title,
  subtitle,
  exportModule,
}: {
  title: string;
  subtitle?: string;
  exportModule?: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl md:px-8">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden flex-col leading-tight md:flex">
        <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {exportModule && (
          <ExportPdfDialog
            module={exportModule}
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="hidden h-9 rounded-full border-border/40 bg-card/40 text-xs font-medium md:inline-flex"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} /> Exportar PDF
              </Button>
            }
          />
        )}
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" strokeWidth={1.75} />
          <Input
            placeholder="Buscar transações, cartões, metas..."
            className="h-9 w-80 rounded-full border-border/40 bg-card/40 pl-10 text-sm shadow-none focus-visible:ring-1"
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="relative h-9 w-9 rounded-full text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>
      </div>
    </header>
  );
}
