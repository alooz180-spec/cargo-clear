import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, FileText, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";

import { attachFile } from "@/lib/case-api";
import type { DocRow } from "@/lib/manifest";
import { useI18n } from "@/lib/i18n";

// Configure the pdf.js worker to match the installed pdfjs-dist version.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const IGNORE = "__ignore__";

// Stable ASCII base names per doc_type. Non-ASCII (Arabic) filenames can break
// inline viewing in some browsers, so split output files always get an ASCII name.
const ASCII_SLUGS: Record<string, string> = {
  "Swift (Bank Transfer)": "swift",
  "البيان الكمركي المسبق": "advance-customs-declaration",
  Invoice: "invoice",
  "Packing List": "packing-list",
  "Certificate of Origin": "certificate-of-origin",
  "Shipping Documents": "shipping-documents",
  "البيان الكمركي": "customs-declaration",
  "Exit Permission": "exit-permission",
};

function asciiSlug(docType: string): string {
  return ASCII_SLUGS[docType] ?? "document";
}

type PageThumb = { index: number; url: string };

export function SplitPdfDialog({
  open,
  onClose,
  caseId,
  docs,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  docs: DocRow[];
  onChanged: () => void;
}) {
  const { t, docLabel } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [assign, setAssign] = useState<Record<number, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingReplace, setPendingReplace] = useState<string[] | null>(null);

  const reset = useCallback(() => {
    bytesRef.current = null;
    setFileName(null);
    setLoading(false);
    setPages([]);
    setAssign({});
    setDragOver(false);
    setCreating(false);
    setProgress(null);
    setPendingReplace(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const loadPdf = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error(t("split.onlyPdf"));
      return;
    }
    reset();
    setFileName(file.name);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      // Keep a pristine copy for pdf-lib (pdf.js may detach/transfer the buffer).
      bytesRef.current = buf.slice(0);
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
      const doc = await loadingTask.promise;
      const thumbs: PageThumb[] = [];
      const nextAssign: Record<number, string> = {};
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbs.push({ index: i - 1, url: canvas.toDataURL("image/jpeg", 0.7) });
        nextAssign[i - 1] = IGNORE;
        page.cleanup();
      }
      setPages(thumbs);
      setAssign(nextAssign);
      loadingTask.destroy();
    } catch (e) {
      console.error(e);
      toast.error(t("split.loadFailed"));
      reset();
    } finally {
      setLoading(false);
    }
  }, [reset, t]);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) toast(t("split.oneFile"));
    loadPdf(files[0]);
  };

  // Group assigned pages by target document, in manifest (docs) order.
  const plan = useMemo(() => {
    return docs
      .map((doc) => {
        const pageIdxs = pages
          .map((p) => p.index)
          .filter((idx) => assign[idx] === doc.id)
          .sort((a, b) => a - b);
        return { doc, pageIdxs };
      })
      .filter((g) => g.pageIdxs.length > 0);
  }, [docs, pages, assign]);

  const ignoredCount = pages.filter((p) => (assign[p.index] ?? IGNORE) === IGNORE).length;
  const canCreate = plan.length > 0 && !creating;

  const formatRange = (idxs: number[]): string => {
    // Human page numbers are 1-based; build compact ranges e.g. "1–2, 4".
    const nums = idxs.map((i) => i + 1);
    const parts: string[] = [];
    let start = nums[0];
    let prev = nums[0];
    for (let i = 1; i <= nums.length; i++) {
      if (i < nums.length && nums[i] === prev + 1) {
        prev = nums[i];
        continue;
      }
      parts.push(start === prev ? `${start}` : `${start}\u2013${prev}`);
      if (i < nums.length) {
        start = nums[i];
        prev = nums[i];
      }
    }
    return parts.join(", ");
  };

  const planLabel = (idxs: number[]): string =>
    idxs.length === 1
      ? t("split.pageSingle", { n: idxs[0] + 1 })
      : t("split.pagesRange", { range: formatRange(idxs) });

  const runCreate = async () => {
    if (!bytesRef.current) return;
    setCreating(true);
    setProgress({ done: 0, total: plan.length });
    const failed: string[] = [];
    let done = 0;
    try {
      const source = await PDFDocument.load(bytesRef.current);
      for (const { doc, pageIdxs } of plan) {
        try {
          const out = await PDFDocument.create();
          const copied = await out.copyPages(source, pageIdxs);
          copied.forEach((pg) => out.addPage(pg));
          const bytes = await out.save();
          const label = docLabel(doc.doc_type).replace(/[\\/]/g, "-");
          const file = new File([bytes as BlobPart], `${label}.pdf`, { type: "application/pdf" });
          await attachFile(doc, caseId, file);
          done += 1;
          setProgress({ done, total: plan.length });
        } catch (e) {
          console.error(e);
          failed.push(docLabel(doc.doc_type));
        }
      }
      onChanged();
      if (failed.length === 0) {
        toast.success(t("split.complete", { n: done }));
        onClose();
      } else if (done > 0) {
        toast.warning(
          t("split.partial", { done, failed: failed.length, slots: failed.join(", ") }),
        );
        onChanged();
      } else {
        toast.error(t("split.failed"));
      }
    } catch (e) {
      console.error(e);
      toast.error(t("split.failed"));
    } finally {
      setCreating(false);
      setProgress(null);
      setPendingReplace(null);
    }
  };

  const handleCreateClick = () => {
    // Warn (per plan) if any targeted slot already has a file.
    const occupied = plan.filter((g) => g.doc.file_name).map((g) => docLabel(g.doc.doc_type));
    if (occupied.length > 0) {
      setPendingReplace(occupied);
      return;
    }
    runCreate();
  };

  if (!open) return null;

  const selectCls =
    "w-full rounded-md border border-input bg-card px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-6"
      onClick={() => !creating && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={t("split.title")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{t("split.title")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("split.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => !creating && onClose()}
            aria-label={t("dialog.close")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {pages.length === 0 ? (
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors ${
                dragOver ? "border-drop-accent bg-drop-accent-bg" : "border-border"
              }`}
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {loading ? t("split.loading") : dragOver ? t("split.dropHere") : t("split.selectFile")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                {t("split.selectFile")}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs">{fileName}</span>
                </div>
                <button
                  type="button"
                  disabled={creating}
                  onClick={reset}
                  className="text-xs text-primary underline underline-offset-2 hover:text-primary-deep disabled:opacity-60"
                >
                  {t("split.changeFile")}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {pages.map((pg) => (
                  <div key={pg.index} className="flex flex-col gap-1.5">
                    <div className="overflow-hidden rounded-md border border-border bg-secondary">
                      <img
                        src={pg.url}
                        alt={t("split.page", { n: pg.index + 1 })}
                        className="h-40 w-full object-contain"
                      />
                    </div>
                    <span className="text-center font-mono text-[11px] text-muted-foreground">
                      {t("split.page", { n: pg.index + 1 })}
                    </span>
                    <select
                      value={assign[pg.index] ?? IGNORE}
                      disabled={creating}
                      onChange={(e) =>
                        setAssign((prev) => ({ ...prev, [pg.index]: e.target.value }))
                      }
                      className={selectCls}
                      aria-label={t("split.assignTo")}
                    >
                      <option value={IGNORE}>{t("split.ignore")}</option>
                      {docs.map((doc, i) => (
                        <option key={doc.id} value={doc.id}>
                          {String(i + 1).padStart(2, "0")}. {docLabel(doc.doc_type)}
                          {doc.file_name ? " •" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {pages.length > 0 && (
          <div className="border-t border-border px-5 py-4">
            <div className="mb-3 rounded-md bg-secondary/60 px-3 py-2 text-xs">
              <span className="font-medium text-muted-foreground">{t("split.planTitle")}: </span>
              {plan.length === 0 ? (
                <span className="text-muted-foreground">{t("split.nothingAssigned")}</span>
              ) : (
                <span>
                  {plan.map((g, i) => (
                    <span key={g.doc.id}>
                      {i > 0 && <span className="text-muted-foreground"> · </span>}
                      <span className="font-medium">{docLabel(g.doc.doc_type)}</span>
                      <span className="text-muted-foreground"> ← {planLabel(g.pageIdxs)}</span>
                    </span>
                  ))}
                  {ignoredCount > 0 && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {ignoredCount === 1
                        ? t("split.ignoredCount", { n: ignoredCount })
                        : t("split.ignoredCountPlural", { n: ignoredCount })}
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              {progress && (
                <span className="me-auto font-mono text-xs text-muted-foreground">
                  {t("split.progress", { done: progress.done, total: progress.total })}
                </span>
              )}
              <button
                type="button"
                disabled={creating}
                onClick={onClose}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                {t("dialog.cancel")}
              </button>
              <button
                type="button"
                disabled={!canCreate}
                onClick={handleCreateClick}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? t("split.creating") : t("split.create")}
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingReplace && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4"
          onClick={() => !creating && setPendingReplace(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t("split.replaceTitle")}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
          >
            <h2 className="text-base font-semibold">{t("split.replaceTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("split.replaceBody", {
                n: pendingReplace.length,
                slots: pendingReplace.join(", "),
              })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={creating}
                onClick={() => setPendingReplace(null)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                {t("split.replaceCancel")}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={runCreate}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:opacity-60"
              >
                {creating ? t("split.creating") : t("split.replaceConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
