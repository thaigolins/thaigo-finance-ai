import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Receipt,
  FileText,
  Repeat,
  Target,
  TrendingUp,
  BarChart3,
  Sparkles,
  Landmark,
  Banknote,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const overviewItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Cartões", url: "/cartoes", icon: CreditCard },
  { title: "Faturas", url: "/faturas", icon: Receipt },
  { title: "Extratos", url: "/extratos", icon: FileText },
  { title: "Recorrentes", url: "/recorrentes", icon: Repeat },
];

const dividasItem = { title: "Empréstimos & Dívidas", url: "/dividas", icon: Landmark };

const planningItems = [
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Investimentos", url: "/investimentos", icon: TrendingUp },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

const fgtsItem = { title: "FGTS", url: "/fgts", icon: Banknote };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Cliente";
  const initial = displayName.charAt(0).toUpperCase();

  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const renderItem = (item: { title: string; url: string; icon: typeof LayoutDashboard }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={isActive(item.url)}
        className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium hover:bg-sidebar-accent/60"
      >
        <Link to={item.url} className="flex items-center gap-3">
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{item.title}</span>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 py-5">
        <Link to="/" className="flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-emerald-soft">
            <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold tracking-tight">Thaigo Finance</span>
              <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Private · AI</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Inteligência</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/chat")}
                  className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium"
                >
                  <Link to="/chat" className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Chat IA</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Visão Geral</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{overviewItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderItem(dividasItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Planejamento</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{planningItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderItem(fgtsItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-3 space-y-2">
        <SidebarMenu>{renderItem({ title: "Configurações", url: "/settings", icon: Settings })}</SidebarMenu>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 p-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-emerald-soft text-sm font-semibold text-primary">
                {initial}
              </div>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-medium">{displayName}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Private Client</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="w-full justify-start gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-emerald-soft text-sm font-semibold text-primary">
              {initial}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut()}
              className="mx-auto h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
