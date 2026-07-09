import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Manifest" },
      { name: "description", content: "Sign in to Manifest, the TT document control desk." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t, toggle } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup" | "recovery">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(t("toast.accountCreated"));
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("toast.resetSent"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.authFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <button
        type="button"
        onClick={toggle}
        aria-label={t("lang.label")}
        className="absolute top-4 end-4 rounded-md border border-input px-2.5 py-1 font-mono text-xs font-medium text-muted-foreground hover:bg-secondary"
      >
        {t("lang.toggle")}
      </button>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-mono text-lg font-semibold tracking-[0.35em] text-foreground uppercase">
            Manifest
          </div>
          <div className="mt-1 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            {t("app.tagline")}
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <h1 className="text-base font-semibold">
            {mode === "signin"
              ? t("auth.signInTitle")
              : mode === "signup"
                ? t("auth.signUpTitle")
                : t("auth.recoveryTitle")}
          </h1>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("auth.email")}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {mode !== "recovery" && (
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  {t("auth.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:opacity-60"
          >
            {busy
              ? t("auth.pleaseWait")
              : mode === "signin"
                ? t("auth.signIn")
                : mode === "signup"
                  ? t("auth.signUp")
                  : t("auth.sendReset")}
          </button>
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => setMode("recovery")}
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              {t("auth.forgot")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signup"
              ? t("auth.alreadyRegistered")
              : mode === "recovery"
                ? t("auth.backToSignIn")
                : t("auth.noAccount")}
          </button>
        </form>
      </div>
    </div>
  );
}
