import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";

import { listCases } from "@/lib/case-api";
import { formatAmount, progressOf, type CaseStatus } from "@/lib/manifest";
import { ProgressBar, StatusBadge } from "@/components/manifest-ui";
import { NewCaseDialog } from "@/components/NewCaseDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cases/")({
  head: () => ({
    meta: [
      { title: "Cases — Manifest" },
      { name: "description", content: "All TT transfer cases with document progress and status." },
    ],
  }),
  component: CasesPage,
});

const filters: { value: CaseStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
  { value: "sent", label: "Sent to bank" },
];

function CasesPage() {
  const { data: cases, isLoading } = useQuery({ queryKey: ["cases"], queryFn: listCases });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CaseStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (cases ?? [])
      .filter((c) => (filter === "all" ? true : c.status === filter))
      .filter((c) =>
        q === ""
          ? true
          : [c.company, c.bank, c.ref, String(c.amount)].some((v) =>
              v.toLowerCase().includes(q),
            ),
      );
  }, [cases, search, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Cases</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">One case per telegraphic transfer.</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-deep"
        >
          <Plus className="h-4 w-4" />
          New case
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, bank, reference, amount…"
            className="w-full rounded-md border border-input bg-card py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex rounded-md border border-border bg-card p-0.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors",
                filter === f.value && "bg-primary-soft text-primary-deep",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-2.5 font-medium">Reference</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Bank</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Progress</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No cases match.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const p = progressOf(c.case_documents);
                return (
                  <tr key={c.id} className="transition-colors hover:bg-secondary/60">
                    <td className="px-4 py-3 font-mono font-medium">
                      <Link to="/cases/$caseId" params={{ caseId: c.id }} className="block">
                        {c.ref}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/cases/$caseId" params={{ caseId: c.id }} className="block">
                        {c.company}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.bank}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatAmount(c.amount, c.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProgressBar verified={p.verified} total={p.total} className="w-20" />
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.verified}/{p.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status as CaseStatus} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <NewCaseDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
