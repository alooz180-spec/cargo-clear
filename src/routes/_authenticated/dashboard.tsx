import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { listCases } from "@/lib/case-api";
import { daysOpen, progressOf } from "@/lib/manifest";
import { useI18n } from "@/lib/i18n";
import { ProgressBar, StatCard } from "@/components/manifest-ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Manifest" },
      { name: "description", content: "TT case overview: progress, completeness and open cases." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useI18n();
  const { data: cases, isLoading } = useQuery({ queryKey: ["cases"], queryFn: listCases });

  const all = cases ?? [];
  const counts = {
    in_progress: all.filter((c) => c.status === "in_progress").length,
    complete: all.filter((c) => c.status === "complete").length,
    sent: all.filter((c) => c.status === "sent").length,
    total: all.length,
  };

  const needsDocs = all
    .filter((c) => c.status === "in_progress")
    .map((c) => ({ ...c, progress: progressOf(c.case_documents) }))
    .sort((a, b) => b.progress.pct - a.progress.pct);

  return (
    <div>
      <h1 className="text-lg font-semibold">{t("dashboard.title")}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("stat.inProgress")} value={counts.in_progress} accentClass="border-s-status-progress" />
        <StatCard label={t("stat.complete")} value={counts.complete} accentClass="border-s-status-complete" />
        <StatCard label={t("stat.sentToBank")} value={counts.sent} accentClass="border-s-status-sent" />
        <StatCard label={t("stat.totalCases")} value={counts.total} accentClass="border-s-foreground" />
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{t("needsDocs.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("needsDocs.subtitle")}</p>
        </div>
        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : needsDocs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t("needsDocs.empty")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {needsDocs.map((c) => (
              <li key={c.id}>
                <Link
                  to="/cases/$caseId"
                  params={{ caseId: c.id }}
                  className="flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-secondary/60 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-baseline gap-3">
                    <span className="shrink-0 font-mono text-sm font-medium">{c.ref}</span>
                    <span className="truncate text-sm">{c.company}</span>
                    <span className="ms-auto shrink-0 font-mono text-xs text-muted-foreground sm:ms-0">
                      {t("dashboard.daysOpen", { n: daysOpen(c.created_at) })}
                    </span>
                  </div>
                  <div className="flex w-full items-center gap-3 sm:w-56">
                    <ProgressBar
                      verified={c.progress.verified}
                      total={c.progress.total}
                      className="flex-1"
                    />
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {c.progress.verified}/{c.progress.total}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
