import { supabase } from "@/integrations/supabase/client";
import type { CaseRow, CaseStatus, CaseWithProgress, DocRow } from "./manifest";

export async function listCases(): Promise<CaseWithProgress[]> {
  await maybeSeedSampleCases();
  const { data, error } = await supabase
    .from("cases")
    .select("*, case_documents(id, verified)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CaseWithProgress[];
}

export async function getCase(id: string): Promise<CaseRow & { case_documents: DocRow[] }> {
  const { data, error } = await supabase
    .from("cases")
    .select("*, case_documents(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  data.case_documents.sort((a, b) => a.sort_order - b.sort_order);
  return data;
}

export async function createCase(input: {
  company: string;
  bank: string;
  amount: number;
  currency: string;
  notes: string | null;
}): Promise<CaseRow> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("cases")
    .insert({ ...input, user_id: userData.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setCaseStatus(id: string, status: CaseStatus) {
  const { error } = await supabase.from("cases").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setDocVerified(docId: string, verified: boolean) {
  const { error } = await supabase.from("case_documents").update({ verified }).eq("id", docId);
  if (error) throw error;
}

export async function attachFile(doc: Pick<DocRow, "id">, caseId: string, file: File) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not signed in");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userData.user.id}/${caseId}/${doc.id}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("case-files")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { error } = await supabase
    .from("case_documents")
    .update({ file_name: file.name, file_path: path })
    .eq("id", doc.id);
  if (error) throw error;
}

/** Removing a file un-verifies the document. */
export async function removeFile(doc: Pick<DocRow, "id" | "file_path">) {
  if (doc.file_path) {
    await supabase.storage.from("case-files").remove([doc.file_path]);
  }
  const { error } = await supabase
    .from("case_documents")
    .update({ file_name: null, file_path: null, verified: false })
    .eq("id", doc.id);
  if (error) throw error;
}

export async function addExtraDocument(caseId: string, name: string, sortOrder: number) {
  const { error } = await supabase
    .from("case_documents")
    .insert({ case_id: caseId, doc_type: name, sort_order: sortOrder, is_extra: true });
  if (error) throw error;
}

export async function deleteDocument(doc: Pick<DocRow, "id" | "file_path">) {
  if (doc.file_path) {
    await supabase.storage.from("case-files").remove([doc.file_path]);
  }
  const { error } = await supabase.from("case_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

export async function openFile(path: string) {
  const { data, error } = await supabase.storage.from("case-files").createSignedUrl(path, 3600);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

/* ---------------- Seed data (first run only) ---------------- */

const SEED_FLAG = "manifest-seeded-v1";

type SeedDoc = { type: string; file?: string; verified?: boolean };

async function seedOneCase(
  c: {
    company: string;
    bank: string;
    amount: number;
    currency: string;
    status: CaseStatus;
    notes: string | null;
    daysAgo: number;
  },
  docs: SeedDoc[],
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const created_at = new Date(Date.now() - c.daysAgo * 86_400_000).toISOString();
  const { data: kase, error } = await supabase
    .from("cases")
    .insert({
      company: c.company,
      bank: c.bank,
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      notes: c.notes,
      created_at,
      user_id: userData.user.id,
    })
    .select()
    .single();
  if (error || !kase) return;
  const { data: rows } = await supabase
    .from("case_documents")
    .select("id, doc_type")
    .eq("case_id", kase.id);
  for (const d of docs) {
    const row = rows?.find((r) => r.doc_type === d.type);
    if (!row) continue;
    await supabase
      .from("case_documents")
      .update({ file_name: d.file ?? null, verified: d.verified ?? false })
      .eq("id", row.id);
  }
}

const ALL_VERIFIED: SeedDoc[] = [
  { type: "Swift (Bank Transfer)", file: "MT103_SWIFT_COPY.pdf", verified: true },
  { type: "Invoice", file: "COMMERCIAL_INVOICE.pdf", verified: true },
  { type: "Packing List", file: "PACKING_LIST.pdf", verified: true },
  { type: "Certificate of Origin", file: "COO_CHAMBER_DXB.pdf", verified: true },
  { type: "Shipping Documents", file: "BILL_OF_LADING.pdf", verified: true },
  { type: "البيان الكمركي", file: "CUSTOMS_DECLARATION.pdf", verified: true },
  { type: "Exit Permission", file: "EXIT_PERMISSION.pdf", verified: true },
];

async function maybeSeedSampleCases() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_FLAG)) return;
  const { count, error } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true });
  if (error) return;
  if ((count ?? 0) > 0) {
    window.localStorage.setItem(SEED_FLAG, "1");
    return;
  }

  // Inserted oldest-first so refs run TT-YYYY-001 … 004 chronologically.
  await seedOneCase(
    {
      company: "Orient Machinery Trading LLC",
      bank: "ADCB",
      amount: 412900,
      currency: "AED",
      status: "sent",
      notes: null,
      daysAgo: 41,
    },
    ALL_VERIFIED,
  );
  await seedOneCase(
    {
      company: "Gulf Steel Trading LLC",
      bank: "Emirates NBD",
      amount: 128450,
      currency: "USD",
      status: "in_progress",
      notes: "Original Certificate of Origin still with the shipping agent — chase weekly.",
      daysAgo: 18,
    },
    [
      { type: "Swift (Bank Transfer)", file: "MT103_SWIFT_128450.pdf", verified: true },
      { type: "Invoice", file: "INV-8841_GULFSTEEL.pdf", verified: true },
      { type: "Packing List", file: "PL-8841.pdf", verified: false },
    ],
  );
  await seedOneCase(
    {
      company: "Al Wafra Foodstuff Trading",
      bank: "Mashreq",
      amount: 86300,
      currency: "EUR",
      status: "complete",
      notes: null,
      daysAgo: 9,
    },
    ALL_VERIFIED,
  );
  await seedOneCase(
    {
      company: "Nile Cotton General Trading",
      bank: "First Abu Dhabi Bank",
      amount: 54200,
      currency: "GBP",
      status: "in_progress",
      notes: null,
      daysAgo: 1,
    },
    [{ type: "Swift (Bank Transfer)", file: "MT103_SWIFT_54200.pdf", verified: false }],
  );

  window.localStorage.setItem(SEED_FLAG, "1");
}
