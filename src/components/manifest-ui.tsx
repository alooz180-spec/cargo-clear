import type { CaseStatus } from "@/lib/manifest";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const badgeStyles: Record<CaseStatus, string> = {
  in_progress: "bg-status-progress-bg text-status-progress",
  complete: "bg-status-complete-bg text-status-complete",
  sent: "bg-status-sent-bg text-status-sent",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase",
        badgeStyles[status],
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}

export function ProgressBar({
  verified,
  total,
  className,
}: {
  verified: number;
  total: number;
  className?: string;
}) {
  const pct = total === 0 ? 0 : (verified / total) * 100;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function VerifiedStamp() {
  const { t } = useI18n();
  return <span className="stamp-seal">{t("doc.verified")}</span>;
}

export function StatCard({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: number;
  accentClass: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card border-s-4 px-4 py-3", accentClass)}>
      <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}
