import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, FileText, UploadCloud, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";

import { attachFile, addDocumentCopy } from "@/lib/case-api";
import { DEFAULT_DOC_TYPES, type DocRow } from "@/lib/manifest";
import { useI18n } from "@/lib/i18n";

// Configure the pdf.js worker to match the installed pdfjs-dist version.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const IGNORE = "__ignore__";
// Prefix used in the dropdown for the inline "＋ New copy of {doc}" quick action.
const ADD_COPY = "__addcopy__:";
// Prefix used for values that point at a user-created "new copy" target.
const COPY = "__copy__:";

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
// A user-created "new copy" target: an extra document that will be created on
// confirm (is_extra = true, same doc_type as the standard document).
type NewCopy = { key: string; docType: string };

// The concrete operations a confirmed split performs.
type SplitOp =
  | { kind: "existing"; label: string; doc: DocRow; pageIdxs: number[] }
  | { kind: "new"; label: string; docType: string; sortOrder: number; pageIdxs: number[] };

let copyCounter = 0;
const nextCopyKey = () => `c${Date.now().toString(36)}${(copyCounter++).toString(36)}`;

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
  const [newCopies, setNewCopies] = useState<NewCopy[]>([]);
  const [addCopyPick, setAddCopyPick] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Per-slot conflict resolution for existing slots that already hold a file.
  const [conflicts, setConflicts] = useState<DocRow[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "replace" | "copy">>({});

  const reset = useCallback(() => {
    bytesRef.current = null;
    setFileName(null);
    setLoading(false);
    setPages([]);
    setAssign({});
    setNewCopies([]);
    setAddCopyPick("");
    setDragOver(false);
    setCreating(false);
    setProgress(null);
    setConflicts(null);
    setDecisions({});
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const loadPdf = useCallback(
    async (file: File) => {
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
    },
    [reset, t],
  );

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) toast(t("split.oneFile"));
    loadPdf(files[0]);
  };

  // Sort order for a new copy: reuse the standard document's manifest position.
  const sortOrderFor = useCallback(
    (docType: string): number => {
      const match = docs.find((d) => d.doc_type === docType);
      if (match) return match.sort_order;
      const idx = DEFAULT_DOC_TYPES.indexOf(docType as (typeof DEFAULT_DOC_TYPES)[number]);
      return idx >= 0 ? idx + 1 : docs.length + 1;
    },
    [docs],
  );

  // Ordinal label for a new-copy target, e.g. "Exit Permission — new copy 2".
  const copyLabel = useCallback(
    (copy: NewCopy): string => {
      const ordinal =
        newCopies.filter((c) => c.docType === copy.docType).findIndex((c) => c.key === copy.key) + 1;
      return t("split.copyLabel", { doc: docLabel(copy.docType), n: ordinal });
    },
    [newCopies, docLabel, t],
  );

  const addCopyTarget = (docType: string) => {
    if (!docType) return;
    setNewCopies((prev) => [...prev, { key: nextCopyKey(), docType }]);
    setAddCopyPick("");
  };

  const removeCopyTarget = (key: string) => {
    setNewCopies((prev) => prev.filter((c) => c.key !== key));
    // Un-assign any pages that pointed at the removed target.
    setAssign((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[Number(k)] === `${COPY}${key}`) next[Number(k)] = IGNORE;
      }
      return next;
    });
  };

  const onAssignChange = (pageIdx: number, value: string) => {
    if (value.startsWith(ADD_COPY)) {
      // Inline quick action: create a new copy target and point this page at it.
      const docType = value.slice(ADD_COPY.length);
      const key = nextCopyKey();
      setNewCopies((prev) => [...prev, { key, docType }]);
      setAssign((prev) => ({ ...prev, [pageIdx]: `${COPY}${key}` }));
      return;
    }
    setAssign((prev) => ({ ...prev, [pageIdx]: value }));
  };

  // Group assigned pages by target: existing docs (manifest order) then new copies.
  const plan = useMemo(() => {
    const existing = docs
      .map((doc) => ({
        kind: "existing" as const,
        doc,
        pageIdxs: pages
          .map((p) => p.index)
          .filter((idx) => assign[idx] === doc.id)
          .sort((a, b) => a - b),
      }))
      .filter((g) => g.pageIdxs.length > 0);
    const copies = newCopies
      .map((copy) => ({
        kind: "new" as const,
        copy,
        pageIdxs: pages
          .map((p) => p.index)
          .filter((idx) => assign[idx] === `${COPY}${copy.key}`)
          .sort((a, b) => a - b),
      }))
      .filter((g) => g.pageIdxs.length > 0);
    return { existing, copies };
  }, [docs, newCopies, pages, assign]);

  const ignoredCount = pages.filter((p) => {
    const v = assign[p.index] ?? IGNORE;
    return v === IGNORE;
  }).length;

  const planCount = plan.existing.length + plan.copies.length;
  const canCreate = planCount > 0 && !creating;

  const formatRange = (idxs: number[]): string => {
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

  // Turn the plan (+ any per-slot decisions) into concrete operations.
  const buildOps = (decisionMap: Record<string, "replace" | "copy">): SplitOp[] => {
    const ops: SplitOp[] = [];
    for (const g of plan.existing) {
      const hasFile = !!g.doc.file_name;
      const decision = decisionMap[g.doc.id];
      if (hasFile && decision === "copy") {
        ops.push({
          kind: "new",
          label: docLabel(g.doc.doc_type),
          docType: g.doc.doc_type,
          sortOrder: g.doc.sort_order,
          pageIdxs: g.pageIdxs,
        });
      } else {
        // Empty slot, or an occupied slot the user chose to replace.
        ops.push({ kind: "existing", label: docLabel(g.doc.doc_type), doc: g.doc, pageIdxs: g.pageIdxs });
      }
    }
    for (const g of plan.copies) {
      ops.push({
        kind: "new",
        label: copyLabel(g.copy),
        docType: g.copy.docType,
        sortOrder: sortOrderFor(g.copy.docType),
        pageIdxs: g.pageIdxs,
      });
    }
    return ops;
  };

  const runCreate = async (decisionMap: Record<string, "replace" | "copy">) => {
    if (!bytesRef.current) return;
    const ops = buildOps(decisionMap);
    if (ops.length === 0) return;
    setCreating(true);
    setProgress({ done: 0, total: ops.length });
    const failed: string[] = [];
    let done = 0;
    try {
      const source = await PDFDocument.load(bytesRef.current);
      for (const op of ops) {
        try {
          const out = await PDFDocument.create();
          const copied = await out.copyPages(source, op.pageIdxs);
          copied.forEach((pg) => out.addPage(pg));
          const bytes = await out.save();
          const docType = op.kind === "existing" ? op.doc.doc_type : op.docType;
          const file = new File([bytes as BlobPart], `${asciiSlug(docType)}.pdf`, {
            type: "application/pdf",
          });
          if (op.kind === "new") {
            // Create the new copy row first, then attach into it. Never touches
            // existing documents.
            const created = await addDocumentCopy(caseId, op.docType, op.sortOrder);
            await attachFile(created, caseId, file);
          } else {
            await attachFile(op.doc, caseId, file);
          }
          done += 1;
          setProgress({ done, total: ops.length });
        } catch (e) {
          console.error(e);
          failed.push(op.label);
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
      } else {
        toast.error(t("split.failed"));
      }
    } catch (e) {
      console.error(e);
      toast.error(t("split.failed"));
    } finally {
      setCreating(false);
      setProgress(null);
      setConflicts(null);
    }
  };

  const handleCreateClick = () => {
    // Existing slots that already hold a file need a per-slot decision.
    const occupied = plan.existing.filter((g) => g.doc.file_name).map((g) => g.doc);
    if (occupied.length > 0) {
      // Default every conflicted slot to "add as a new copy" — the safe,
      // non-destructive choice.
      setDecisions(Object.fromEntries(occupied.map((d) => [d.id, "copy" as const])));
      setConflicts(occupied);
      return;
    }
    runCreate({});
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

              {/* Add another copy target */}
              <div className="mb-4 rounded-md border border-dashed border-border bg-secondary/40 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={addCopyPick}
                    disabled={creating}
                    onChange={(e) => setAddCopyPick(e.target.value)}
                    aria-label={t("split.addCopyTargetAria")}
                    className={`${selectCls} max-w-xs`}
                  >
                    <option value="">{t("split.addCopyTarget")}</option>
                    {DEFAULT_DOC_TYPES.map((dt) => (
                      <option key={dt} value={dt}>
                        {docLabel(dt)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={creating || !addCopyPick}
                    onClick={() => addCopyTarget(addCopyPick)}
                    className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("split.addCopyTarget")}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{t("split.addCopyTargetHint")}</p>
                {newCopies.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {newCopies.map((copy) => (
                      <span
                        key={copy.key}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px]"
                      >
                        {copyLabel(copy)}
                        <button
                          type="button"
                          disabled={creating}
                          onClick={() => removeCopyTarget(copy.key)}
                          aria-label={t("split.removeCopyTarget")}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-60"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
                      onChange={(e) => onAssignChange(pg.index, e.target.value)}
                      className={selectCls}
                      aria-label={t("split.assignTo")}
                    >
                      <option value={IGNORE}>{t("split.ignore")}</option>
                      <optgroup label={t("split.currentDocs")}>
                        {docs.map((doc, i) => (
                          <option key={doc.id} value={doc.id}>
                            {String(i + 1).padStart(2, "0")}. {docLabel(doc.doc_type)}
                            {doc.file_name ? " •" : ""}
                          </option>
                        ))}
                      </optgroup>
                      {newCopies.length > 0 && (
                        <optgroup label={t("split.newCopiesGroup")}>
                          {newCopies.map((copy) => (
                            <option key={copy.key} value={`${COPY}${copy.key}`}>
                              {copyLabel(copy)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label={t("split.addCopyGroup")}>
                        {DEFAULT_DOC_TYPES.map((dt) => (
                          <option key={`add-${dt}`} value={`${ADD_COPY}${dt}`}>
                            {t("split.newCopyOf", { doc: docLabel(dt) })}
                          </option>
                        ))}
                      </optgroup>
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
              {planCount === 0 ? (
                <span className="text-muted-foreground">{t("split.nothingAssigned")}</span>
              ) : (
                <span>
                  {plan.existing.map((g, i) => (
                    <span key={g.doc.id}>
                      {i > 0 && <span className="text-muted-foreground"> · </span>}
                      <span className="font-medium">{docLabel(g.doc.doc_type)}</span>
                      <span className="text-muted-foreground"> ← {planLabel(g.pageIdxs)}</span>
                    </span>
                  ))}
                  {plan.copies.map((g, i) => (
                    <span key={g.copy.key}>
                      {(plan.existing.length > 0 || i > 0) && (
                        <span className="text-muted-foreground"> · </span>
                      )}
                      <span className="font-medium">{copyLabel(g.copy)}</span>
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

      {conflicts && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4"
          onClick={() => !creating && setConflicts(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t("split.conflictTitle")}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
          >
            <h2 className="text-base font-semibold">{t("split.conflictTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("split.conflictBody")}</p>
            <div className="mt-4 space-y-3">
              {conflicts.map((doc) => (
                <div key={doc.id} className="rounded-md border border-border px-3 py-2.5">
                  <div className="mb-2 text-sm font-medium">{docLabel(doc.doc_type)}</div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name={`conflict-${doc.id}`}
                        checked={decisions[doc.id] === "copy"}
                        disabled={creating}
                        onChange={() => setDecisions((prev) => ({ ...prev, [doc.id]: "copy" }))}
                      />
                      {t("split.addAsNewCopy")}
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name={`conflict-${doc.id}`}
                        checked={decisions[doc.id] === "replace"}
                        disabled={creating}
                        onChange={() => setDecisions((prev) => ({ ...prev, [doc.id]: "replace" }))}
                      />
                      {t("split.replaceExisting")}
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={creating}
                onClick={() => setConflicts(null)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                {t("split.replaceCancel")}
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => runCreate(decisions)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:opacity-60"
              >
                {creating ? t("split.creating") : t("split.conflictConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
