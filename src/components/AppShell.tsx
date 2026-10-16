import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  HeartPulse,
  Inbox,
  Mail,

  LayoutDashboard,
  ListChecks,
  ShoppingBasket,
  LogOut,
  Moon,
  Repeat,
  Settings,
  Sun,
  Tags,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useTheme } from "@/lib/theme";
import { useEntries } from "@/lib/finance";
import { getDueBuckets } from "@/lib/dueBuckets";
import { useDueNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/lancamentos", label: "Lançamentos", icon: ListChecks },
  { to: "/diarias", label: "Diárias", icon: ShoppingBasket },
  { to: "/recorrente", label: "Recorrente", icon: Repeat },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/categorias", label: "Categorias", icon: Tags },
  { to: "/saude", label: "Saúde", icon: HeartPulse },
  { to: "/avisos", label: "Avisos", icon: Inbox },
  { to: "/modelo-email", label: "Modelo do e-mail", icon: Mail },

] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: entries } = useEntries();
  const { permission, pedirPermissao } = useDueNotifications(entries);
  const [config, setConfig] = useState(false);
  const [collapsed, setCollapsed] = useState(false);


  const buckets = getDueBuckets(entries);
  const alertCount = buckets.vencidas.length + buckets.hoje.length;

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden", collapsed ? "w-16" : "w-16 sm:w-56")}>
        <Button asChild variant="ghost" className="h-16 justify-start gap-3 rounded-none px-5" title="Agenda de Contas">
          <Link to="/painel"><Wallet className="size-6 shrink-0 text-primary" />{!collapsed && <span className="hidden sm:inline">Agenda de Contas</span>}</Link>
        </Button>
        <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return <Button key={item.to} asChild variant="ghost" className={cn("h-11 w-full justify-start gap-3 px-3", active && "bg-sidebar-accent text-sidebar-accent-foreground")} title={item.label}>
              <Link to={item.to} aria-label={item.label} aria-current={active ? "page" : undefined}>
                <item.icon className="size-5 shrink-0" />
                {!collapsed && <span className="hidden sm:inline">{item.label}</span>}
                {item.to === "/painel" && alertCount > 0 && !collapsed && <span className="ml-auto hidden rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground md:inline">{alertCount}</span>}
              </Link>
            </Button>;
          })}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-2">
          {permission === "default" && <Button variant="ghost" className="h-10 w-full justify-start gap-3 px-3" onClick={pedirPermissao} aria-label="Ativar avisos de vencimento" title="Ativar avisos"><Bell className="size-5 shrink-0" />{!collapsed && <span className="hidden sm:inline">Ativar avisos</span>}</Button>}
          <Button variant="ghost" className="h-10 w-full justify-start gap-3 px-3" onClick={() => setConfig(true)} aria-label="Configurações de avisos" title="Configurações"><Settings className="size-5 shrink-0" />{!collapsed && <span className="hidden sm:inline">Configurações</span>}</Button>
          <Button variant="ghost" className="h-10 w-full justify-start gap-3 px-3" onClick={toggle} aria-label="Alternar tema" title="Alternar tema">{theme === "dark" ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}{!collapsed && <span className="hidden sm:inline">Alternar tema</span>}</Button>
          <Button variant="ghost" className="h-10 w-full justify-start gap-3 px-3" onClick={sair} aria-label="Sair" title="Sair"><LogOut className="size-5 shrink-0" />{!collapsed && <span className="hidden sm:inline">Sair</span>}</Button>
        </div>
      </aside>
      <div className={cn("ml-16 min-w-0 print:ml-0", !collapsed && "sm:ml-56")}>
        <header className="flex h-16 items-center gap-3 border-b border-border px-4 print:hidden">
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} title={collapsed ? "Expandir menu" : "Recolher menu"}>
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </Button>
          <span className="text-sm font-semibold">{nav.find(item => pathname.startsWith(item.to))?.label ?? "Agenda de Contas"}</span>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 pb-20">{children}</main>
      </div>

      <SettingsDialog open={config} onOpenChange={setConfig} />
    </div>
  );
}
