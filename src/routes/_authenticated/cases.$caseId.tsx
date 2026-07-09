import { useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CopyPlus, Paperclip, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addDocumentCopy,
  addExtraDocument,
  attachFile,
  deleteDocument,
  getCase,
  openFile,
  removeFile,
  setCaseStatus,
  setDocVerified,
} from "@/lib/case-api";
import {
  ACCEPTED_FILE_TYPES,
  DEFAULT_DOC_TYPES,
  daysOpen,
  formatAmount,
  formatDate,
  progressOf,
  type CaseStatus,
  type DocRow,
} from "@/lib/manifest";
import { ProgressBar, StatusBadge, VerifiedStamp } from "@/components/manifest-ui";

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
  const queryClient = useQueryClient();
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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading case…</div>;
  }
  if (!kase) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Case not found.</div>;
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
        <ArrowLeft className="h-3.5 w-3.5" />
        All cases
      </Link>

      {/* Header */}
      <div className="mt-3 rounded-lg border border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg font-semibold">{kase.ref}</span>
          <StatusBadge status={status} />
        </div>
        <div className="mt-1 text-base font-medium">{kase.company}</div>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Bank</dt>
            <dd className="mt-0.5">{kase.bank}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Amount</dt>
            <dd className="mt-0.5 font-mono">{formatAmount(kase.amount, kase.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">Opened</dt>
            <dd className="mt-0.5 font-mono">
              {formatDate(kase.created_at)}{" "}
              <span className="text-muted-foreground">· {daysOpen(kase.created_at)}d ago</span>
            </dd>
          </div>
        </dl>
        {kase.notes && (
          <blockquote className="mt-4 border-l-2 border-primary bg-primary-soft/50 px-3 py-2 text-sm text-muted-foreground italic">
            "{kase.notes}"
          </blockquote>
        )}
      </div>

      {/* Document manifest */}
      <section className="mt-6 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold">Document manifest</h2>
            <span className="font-mono text-xs text-muted-foreground">
              {p.verified}/{p.total} verified
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
              Mark complete
            </button>
            {!allVerified && (
              <span className="text-xs text-muted-foreground">
                All documents must be verified before the case can be marked complete.
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
              Mark sent to bank
            </button>
            <button
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("in_progress")}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              Reopen
            </button>
          </div>
        )}
        {status === "sent" && (
          <p className="font-mono text-sm text-status-sent">
            Submitted to {kase.bank}. Case archived.
          </p>
        )}
      </div>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

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

  const handleFile = (file: File | null) => {
    if (!file) return;
    run(() => attachFile(doc, caseId, file), "Upload failed");
  };

  // A copy is an extra row that shares the name of a standard manifest document
  // (e.g. a second البيان الكمركي / اذن خروج for another shipment or truck).
  const isCopy =
    doc.is_extra && (DEFAULT_DOC_TYPES as readonly string[]).includes(doc.doc_type);

  return (
    <li className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <span className="font-mono text-xs text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5 text-sm font-medium">
          {doc.doc_type}
          {doc.is_extra && (
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              {isCopy ? "copy" : "Extra"}
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
                  className="ml-2 text-primary underline underline-offset-2 hover:text-primary-deep"
                >
                  view
                </button>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Not attached</span>
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
              {busy ? "Uploading…" : "Attach"}
            </button>
          </>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => run(() => setDocVerified(doc.id, !doc.verified), "Update failed")}
              className={
                doc.verified
                  ? "rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-60"
                  : "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-60"
              }
            >
              {doc.verified ? "Unverify" : "Verify"}
            </button>
            <button
              disabled={busy}
              onClick={() => run(() => removeFile(doc), "Remove failed")}
              aria-label="Remove file"
              title="Remove file (un-verifies the document)"
              className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        {doc.is_extra && (
          <button
            disabled={busy}
            onClick={() => run(() => deleteDocument(doc), "Delete failed")}
            aria-label="Delete document row"
            title="Delete this document row"
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
      toast.error(err instanceof Error ? err.message : "Could not add document");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-border px-5 py-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add another document (e.g. Insurance Certificate)…"
        className="flex-1 rounded-md border border-input bg-card px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add
      </button>
    </form>
  );
}
