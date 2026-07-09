import { useMemo, useState } from "react";
import { FileDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { CaseRow, DocRow } from "@/lib/manifest";

function slugify(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ExportPdfDialog({
  open,
  onClose,
  kase,
  docs,
}: {
  open: boolean;
  onClose: () => void;
  kase: CaseRow;
  docs: DocRow[];
}) {
  const { t, docLabel } = useI18n();
  const attachableIds = useMemo(
    () => docs.filter((d) => d.file_path).map((d) => d.id),
    [docs],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(attachableIds));
  const [includeCover, setIncludeCover] = useState(true);
  const [busy, setBusy] = useState(false);

  // Re-sync default selection whenever the dialog is (re)opened.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setSelected(new Set(attachableIds));
      setIncludeCover(true);
    }
  }

  if (!open) return null;

  const anyMissing =
    docs.some((d) => !d.file_path) || kase.status !== "complete";

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generate = async () => {
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${base}/functions/v1/export-case-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caseId: kase.id,
          documentIds: Array.from(selected),
          includeCover,
        }),
      });

      if (!res.ok) {
        let msg = t("export.failed");
        try {
          const err = await res.json();
          if (err?.error) msg = err.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      const skipped = Number(res.headers.get("X-Skipped-Count") ?? "0");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(kase.ref)}_${slugify(kase.company)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (skipped > 0) {
        toast.success(t("export.successSkipped", { n: skipped }));
      } else {
        toast.success(t("export.success"));
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("export.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={t("export.title")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{t("export.title")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("export.subtitle")}</p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            aria-label={t("dialog.close")}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {anyMissing && (
            <div className="mb-4 rounded-md border-s-2 border-status-progress bg-status-progress-bg px-3 py-2 text-xs text-status-progress">
              {t("export.warning")}
            </div>
          )}

          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("export.none")}</p>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-3 text-xs">
                <button
                  onClick={() => setSelected(new Set(attachableIds))}
                  className="text-primary underline underline-offset-2 hover:text-primary-deep disabled:opacity-50"
                  disabled={attachableIds.length === 0}
                >
                  {t("export.selectAll")}
                </button>
                <span className="text-border">·</span>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-primary underline underline-offset-2 hover:text-primary-deep"
                >
                  {t("export.selectNone")}
                </button>
              </div>

              <ul className="divide-y divide-border rounded-md border border-border">
                {docs.map((doc, i) => {
                  const has = !!doc.file_path;
                  return (
                    <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={has && selected.has(doc.id)}
                        disabled={!has}
                        onChange={() => toggle(doc.id)}
                        className="h-4 w-4 shrink-0 accent-primary disabled:opacity-40"
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate text-sm ${has ? "" : "text-muted-foreground"}`}
                        >
                          {docLabel(doc.doc_type)}
                        </div>
                        {has ? (
                          <div className="truncate font-mono text-[11px] text-muted-foreground">
                            {doc.file_name}
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground italic">
                            {t("export.notAttached")}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeCover}
                  onChange={(e) => setIncludeCover(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                {t("export.includeCover")}
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            {t("dialog.cancel")}
          </button>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={generate}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {busy ? t("export.generating") : t("export.generate")}
          </button>
        </div>
      </div>
    </div>
  );
}
