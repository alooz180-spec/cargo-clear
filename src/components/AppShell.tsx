import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { FileStack, LayoutDashboard, Languages, LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "nav.dashboard", to: "/dashboard", icon: LayoutDashboard },
  { key: "nav.cases", to: "/cases", icon: FileStack },
] as const;

function Brand() {
  const { t } = useI18n();
  return (
    <div className="leading-tight">
      <div className="font-mono text-sm font-semibold tracking-[0.3em] text-sidebar-foreground uppercase">
        Manifest
      </div>
      <div className="mt-0.5 font-mono text-[10px] tracking-[0.14em] text-sidebar-muted uppercase">
        {t("app.tagline")}
      </div>
    </div>
  );
}

function LangToggle({ className }: { className?: string }) {
  const { t, toggle, lang } = useI18n();
  return (
    <button
      onClick={toggle}
      aria-label={t("lang.label")}
      title={t("lang.label")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2 py-1 font-mono text-[11px] text-sidebar-muted transition-colors hover:text-sidebar-foreground",
        className,
      )}
    >
      <Languages className="h-3.5 w-3.5" />
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen w-full md:ps-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col bg-sidebar md:flex">
        <div className="px-6 pt-7 pb-8">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md border-s-2 border-transparent px-3 py-2 text-sm text-sidebar-muted transition-colors hover:text-sidebar-foreground",
                isActive(item.to) &&
                  "border-primary bg-sidebar-active text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4">
          {email && (
            <div className="mb-2 truncate font-mono text-[11px] text-sidebar-muted">{email}</div>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-xs text-sidebar-muted transition-colors hover:text-sidebar-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("nav.signOut")}
            </button>
            <LangToggle />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs text-sidebar-muted",
                isActive(item.to) && "bg-sidebar-active text-sidebar-foreground",
              )}
            >
              {t(item.key)}
            </Link>
          ))}
          <LangToggle className="ms-1" />
          <button
            onClick={handleSignOut}
            aria-label={t("nav.signOut")}
            className="ms-1 rounded-md p-1.5 text-sidebar-muted"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1020px] px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
