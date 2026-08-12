import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell,
  CalendarDays,
  HeartPulse,
  Inbox,
  Mail,

  LayoutDashboard,
  ListChecks,
  ShoppingBasket,
  LogOut,
  Moon,
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
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/painel" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-soft">
              <Wallet className="size-5" />
            </span>
            <span className="hidden text-base font-semibold sm:block">Agenda de Contas</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            {permission === "default" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={pedirPermissao}
                className="gap-2"
                aria-label="Ativar avisos de vencimento"
              >
                <Bell className="size-4" />
                <span className="hidden sm:inline">Ativar avisos</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setConfig(true)}
              aria-label="Configurações de avisos"
            >
              <Settings className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>

            <Button variant="ghost" size="sm" onClick={sair} className="gap-2">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {item.to === "/painel" && alertCount > 0 && (
                  <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-20">{children}</main>

      <SettingsDialog open={config} onOpenChange={setConfig} />
    </div>
  );
}
