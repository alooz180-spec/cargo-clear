import type { Tables } from "@/integrations/supabase/types";

export type CaseRow = Tables<"cases">;
export type DocRow = Tables<"case_documents">;
export type CaseStatus = "in_progress" | "complete" | "sent";

export type CaseWithProgress = CaseRow & {
  case_documents: Pick<DocRow, "id" | "verified">[];
};

export const CURRENCIES = ["USD", "IQD", "EUR", "AED", "GBP"] as const;

// The three companies a transfer can be attached to.
export const COMPANIES = [
  "JABAL ALANQAA",
  "GABAT ALGHARBIAH",
  "FK NOBEL",
] as const;

// Iraqi banks in use. Users can also enter another bank via "Other".
export const IRAQI_BANKS = [
  "الاهلي العراقي",
  "الاتحاد الاردني",
  "المنصور",
  "بغداد",
] as const;

export const ACCEPTED_FILE_TYPES = ".pdf,.png,.jpg,.jpeg,.tif";

export const DEFAULT_DOC_TYPES = [
  "Swift (Bank Transfer)",
  "Invoice",
  "Packing List",
  "Certificate of Origin",
  "Shipping Documents",
  "Board Document",
  "Exit Permission",
] as const;

export const STATUS_LABEL: Record<CaseStatus, string> = {
  in_progress: "In progress",
  complete: "Complete",
  sent: "Sent to bank",
};

export function formatAmount(amount: number, currency: string): string {
  return `${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysOpen(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}

export function progressOf(docs: { verified: boolean }[]): {
  verified: number;
  total: number;
  pct: number;
} {
  const total = docs.length;
  const verified = docs.filter((d) => d.verified).length;
  return { verified, total, pct: total === 0 ? 0 : Math.round((verified / total) * 100) };
}

/*
 * ============================================================
 * PHASE 2 — planned, intentionally NOT built yet:
 *
 * 1) Reminders: flag in-progress cases that have been open
 *    30 / 60 / 90 days as needing attention (dashboard badges
 *    + a "stale cases" panel). `daysOpen()` above is the input.
 *
 * 2) AI Swift auto-read: when a Swift file is uploaded, send it
 *    to an AI model (Lovable AI Gateway) to extract bank name,
 *    amount and company, and pre-fill those fields on the case.
 * ============================================================
 */
