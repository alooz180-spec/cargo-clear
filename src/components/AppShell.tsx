import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { FileStack, LayoutDashboard, LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Cases", to: "/cases", icon: FileStack },
];

function Brand() {
  return (
    <div className="leading-tight">
      <div className="font-mono text-sm font-semibold tracking-[0.3em] text-sidebar-foreground uppercase">
        Manifest
      </div>
      <div className="mt-0.5 font-mono text-[10px] tracking-[0.14em] text-sidebar-muted uppercase">
        TT document control
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    <div className="min-h-screen w-full md:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar md:flex">
        <div className="px-6 pt-7 pb-8">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-sidebar-muted transition-colors hover:text-sidebar-foreground",
                isActive(item.to) &&
                  "border-primary bg-sidebar-active text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4">
          {email && (
            <div className="mb-2 truncate font-mono text-[11px] text-sidebar-muted">{email}</div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs text-sidebar-muted transition-colors hover:text-sidebar-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
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
              {item.title}
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="ml-1 rounded-md p-1.5 text-sidebar-muted"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1020px] px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
