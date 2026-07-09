import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Manifest" },
      { name: "description", content: "Set a new password for Manifest." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t, toggle } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    if (params.get("type") !== "recovery") {
      toast.error(t("toast.resetInvalid"));
      return;
    }
    setValid(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("toast.pwMismatch"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("toast.pwUpdated"));
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.pwUpdateFailed"));
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
          <h1 className="text-base font-semibold">{t("reset.title")}</h1>
          {valid ? (
            <>
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    {t("reset.newPassword")}
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    {t("reset.confirmPassword")}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:opacity-60"
              >
                {busy ? t("auth.pleaseWait") : t("reset.update")}
              </button>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("reset.invalid")}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
