import { useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CopyPlus, FileDown, Paperclip, Pencil, Plus, Scissors, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addDocumentCopy,
  addExtraDocument,
  attachFile,
  deleteCase,
  deleteDocument,
  getCase,
  openFile,
  removeFile,
  setCaseStatus,
  setDocVerified,
} from "@/lib/case-api";
import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_FILE_EXTENSIONS,
  DEFAULT_DOC_TYPES,
  daysOpen,
  formatAmount,
  formatDate,
  progressOf,
  type CaseStatus,
  type DocRow,
} from "@/lib/manifest";
import { ProgressBar, StatusBadge, VerifiedStamp } from "@/components/manifest-ui";
import { EditCaseDialog } from "@/components/EditCaseDialog";
import { ExportPdfDialog } from "@/components/ExportPdfDialog";
import { SplitPdfDialog } from "@/components/SplitPdfDialog";
import { useI18n } from "@/lib/i18n";


export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case detail — Manifest" },
      { name: "description", content: "Document manifest for a TT transfer case." },
    ],
  }),
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { data: kase, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
  });


  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    queryClient.invalidateQueries({ queryKey: ["cases"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: CaseStatus) => setCaseStatus(caseId, status),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : t("toast.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.removeQueries({ queryKey: ["case", caseId] });
      toast.success(t("toast.caseDeleted"));
      navigate({ to: "/cases" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("toast.deleteFailed")),
  });


  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t("case.loading")}</div>;
  }
  if (!kase) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t("case.notFound")}</div>;
  }

  const docs = kase.case_documents;
  const p = progressOf(docs);
  const allVerified = docs.length > 0 && docs.every((d) => d.verified);
  const status = kase.status as CaseStatus;


  return (
    <div>
      <Link
        to="/cases"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />
        {t("case.backAll")}
      </Link>

      {/* Header */}
      <div className="mt-3 rounded-lg border border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg font-semibold">{kase.ref}</span>
          <StatusBadge status={status} />
          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={() => setExporting(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <FileDown className="h-3.5 w-3.5" />
              {t("export.button")}
            </button>
            <button
              onClick={() => setSplitting(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <Scissors className="h-3.5 w-3.5" />
              {t("split.button")}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("case.edit")}
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("case.delete")}
            </button>
          </div>
        </div>

        <div className="mt-1 text-base font-medium">{kase.company}</div>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("field.bank")}</dt>
            <dd className="mt-0.5">{kase.bank}</dd>
          </div>
          {kase.supplier && (
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("field.supplier")}</dt>
              <dd className="mt-0.5">{kase.supplier}</dd>
            </div>
          )}
          {kase.vessel && (
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("field.vessel")}</dt>
              <dd className="mt-0.5">{kase.vessel}</dd>
            </div>
          )}
          {kase.bl_number && (
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("field.blNumber")}</dt>
              <dd className="mt-0.5 font-mono">{kase.bl_number}</dd>
            </div>
          )}
          {kase.eta && (
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("field.eta")}</dt>
              <dd className="mt-0.5 font-mono">{formatDate(kase.eta)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("field.amount")}</dt>
            <dd className="mt-0.5 font-mono">{formatAmount(kase.amount, kase.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">{t("case.opened")}</dt>
            <dd className="mt-0.5 font-mono">
              {formatDate(kase.created_at)}{" "}
              <span className="text-muted-foreground">· {t("case.daysAgo", { n: daysOpen(kase.created_at) })}</span>
            </dd>
          </div>
        </dl>
        {kase.notes && (
          <blockquote className="mt-4 border-s-2 border-primary bg-primary-soft/50 px-3 py-2 text-sm text-muted-foreground italic">
            "{kase.notes}"
          </blockquote>
        )}
      </div>

      {/* Document manifest */}
      <section className="mt-6 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold">{t("manifest.title")}</h2>
            <span className="font-mono text-xs text-muted-foreground">
              {t("manifest.verifiedCount", { v: p.verified, t: p.total })}
            </span>
          </div>
          <ProgressBar verified={p.verified} total={p.total} className="mt-2.5" />
        </div>

        <ul className="divide-y divide-border">
          {docs.map((doc, i) => (
            <DocumentRow key={doc.id} doc={doc} index={i} caseId={caseId} onChanged={invalidate} />
          ))}
        </ul>

        <AddDocumentControl
          caseId={caseId}
          nextSortOrder={Math.max(0, ...docs.map((d) => d.sort_order)) + 1}
          onChanged={invalidate}
        />
      </section>

      {/* Status actions */}
      <div className="mt-6 rounded-lg border border-border bg-card px-5 py-4">
        {status === "in_progress" && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={!allVerified || statusMutation.isPending}
              onClick={() => statusMutation.mutate("complete")}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("case.markComplete")}
            </button>
            {!allVerified && (
              <span className="text-xs text-muted-foreground">
                {t("case.mustVerifyAll")}
              </span>
            )}
          </div>
        )}
        {status === "complete" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("sent")}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep disabled:opacity-60"
            >
              {t("case.markSent")}
            </button>
            <button
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("in_progress")}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              {t("case.reopen")}
            </button>
          </div>
        )}
        {status === "sent" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-status-sent">
              {t("case.submitted", { bank: kase.bank })}
            </p>
            <button
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("complete")}
              className="ms-auto rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              {t("case.backToComplete")}
            </button>
          </div>
        )}
      </div>

      <EditCaseDialog open={editing} onClose={() => setEditing(false)} kase={kase} />

      <ExportPdfDialog
        open={exporting}
        onClose={() => setExporting(false)}
        kase={kase}
        docs={docs}
      />

      {confirmingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4"
          onClick={() => !deleteMutation.isPending && setConfirmingDelete(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("delete.title")}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
          >
            <h2 className="text-base font-semibold">{t("delete.title")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("delete.body", { ref: kase.ref })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
              >
                {t("delete.cancel")}
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:opacity-90 disabled:opacity-60"
              >
                {deleteMutation.isPending ? t("delete.deleting") : t("delete.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function DocumentRow({
  doc,
  index,
  caseId,
  onChanged,
}: {
  doc: DocRow;
  index: number;
  caseId: string;
  onChanged: () => void;
}) {
  const { t, docLabel } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Track nested dragenter/dragleave so leaving a child element doesn't clear
  // the highlight prematurely.
  const dragDepth = useRef(0);

  const run = async (fn: () => Promise<void>, errMsg: string) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : errMsg);
    } finally {
      setBusy(false);
    }
  };

  const isAcceptedType = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    return (ACCEPTED_FILE_EXTENSIONS as readonly string[]).includes(ext);
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    run(() => attachFile(doc, caseId, file), t("toast.uploadFailed"));
  };

  const resetDrag = () => {
    dragDepth.current = 0;
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    resetDrag();
    if (busy) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;
    if (files.length > 1) toast(t("doc.dropOneFile"));
    const file = files[0];
    if (!isAcceptedType(file)) {
      toast.error(t("doc.dropWrongType"));
      return;
    }
    handleFile(file);
  };

  // A copy is an extra row that shares the name of a standard manifest document
  // (e.g. a second البيان الكمركي / اذن خروج for another shipment or truck).
  const isCopy =
    doc.is_extra && (DEFAULT_DOC_TYPES as readonly string[]).includes(doc.doc_type);

  return (
    <li
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        if (!busy) setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) resetDrag();
      }}
      onDrop={handleDrop}
      className={`relative flex flex-col gap-2 px-5 py-3.5 transition-colors sm:flex-row sm:items-center sm:gap-4 ${
        dragOver
          ? "bg-drop-accent-bg outline-2 -outline-offset-2 outline-dashed outline-drop-accent"
          : ""
      }`}
    >
      {dragOver && (
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-sm text-xs font-medium text-drop-accent">
          {t("doc.dropHere")}
        </span>
      )}
      <span className="font-mono text-xs text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5 text-sm font-medium">
          {docLabel(doc.doc_type)}
          {doc.is_extra && (
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              {isCopy ? t("doc.badge.copy") : t("doc.badge.extra")}
            </span>
          )}
          {doc.verified && <VerifiedStamp />}
        </div>
        <div className="mt-0.5 font-mono text-xs">
          {doc.file_name ? (
            <span className="text-foreground">
              {doc.file_name}
              {doc.file_path && (
                <button
                  onClick={() => doc.file_path && openFile(doc.file_path)}
                  className="ms-2 text-primary underline underline-offset-2 hover:text-primary-deep"
                >
                  {t("doc.view")}
                </button>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground italic">{t("doc.notAttached")}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!doc.file_name ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {busy ? t("doc.uploading") : t("doc.attach")}
            </button>
          </>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => run(() => setDocVerified(doc.id, !doc.verified), t("toast.updateFailed"))}
              className={
                doc.verified
                  ? "rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-60"
                  : "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
              }
            >
              {doc.verified ? t("doc.unverify") : t("doc.verify")}
            </button>
            <button
              disabled={busy}
              onClick={() => run(() => removeFile(doc), t("toast.removeFailed"))}
              aria-label={t("doc.removeAria")}
              title={t("doc.removeTitle")}
              className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          disabled={busy}
          onClick={() =>
            run(() => addDocumentCopy(caseId, doc.doc_type, doc.sort_order), t("toast.addCopyFailed"))
          }
          aria-label={t("doc.addCopyAria")}
          title={t("doc.addCopyTitle")}
          className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary disabled:opacity-60"
        >
          <CopyPlus className="h-3.5 w-3.5" />
        </button>
        {doc.is_extra && (
          <button
            disabled={busy}
            onClick={() => run(() => deleteDocument(doc), t("toast.deleteFailed"))}
            aria-label={t("doc.deleteRowAria")}
            title={t("doc.deleteRowTitle")}
            className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

function AddDocumentControl({
  caseId,
  nextSortOrder,
  onChanged,
}: {
  caseId: string;
  nextSortOrder: number;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addExtraDocument(caseId, name.trim(), nextSortOrder);
      setName("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.addDocFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-border px-5 py-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("doc.addPlaceholder")}
        className="flex-1 rounded-md border border-input bg-card px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("doc.add")}
      </button>
    </form>
  );
}
