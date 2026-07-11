import { supabase } from "@/integrations/supabase/client";
import type { CaseRow, CaseStatus, CaseWithProgress, DocRow } from "./manifest";

export async function listCases(): Promise<CaseWithProgress[]> {
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
  // Sort by manifest order, then by creation time so copies sit right after
  // the document they were duplicated from.
  data.case_documents.sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  );
  return data;
}

export async function createCase(input: {
  company: string;
  supplier: string | null;
  vessel: string | null;
  bl_number: string | null;
  eta: string | null;
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

export async function updateCase(
  id: string,
  input: {
    company: string;
    supplier: string | null;
    vessel: string | null;
    bl_number: string | null;
    eta: string | null;
    bank: string;
    amount: number;
    currency: string;
    notes: string | null;
  },
) {
  const { error } = await supabase.from("cases").update(input).eq("id", id);
  if (error) throw error;
}

/**
 * Delete a case and everything under it. Storage files are NOT removed by the
 * database cascade, so we first list and remove every file under the case's
 * storage folder, then delete the case row (its case_documents rows cascade).
 */
export async function deleteCase(caseId: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not signed in");
  const prefix = `${userData.user.id}/${caseId}`;
  const { data: files, error: listError } = await supabase.storage
    .from("case-files")
    .list(prefix, { limit: 1000 });
  if (listError) throw listError;
  if (files && files.length > 0) {
    const paths = files.map((f) => `${prefix}/${f.name}`);
    const { error: removeError } = await supabase.storage.from("case-files").remove(paths);
    if (removeError) throw removeError;
  }
  const { error } = await supabase.from("cases").delete().eq("id", caseId);
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

/**
 * Add another copy of an existing document type — e.g. a second البيان الكمركي or
 * اذن خروج when a transfer spans multiple shipments/trucks. The copy keeps the
 * same manifest position (sort_order) and is individually attachable, verifiable
 * and removable.
 */
export async function addDocumentCopy(caseId: string, docType: string, sortOrder: number) {
  const { error } = await supabase
    .from("case_documents")
    .insert({ case_id: caseId, doc_type: docType, sort_order: sortOrder, is_extra: true });
  if (error) throw error;
}

export async function deleteDocument(doc: Pick<DocRow, "id" | "file_path">) {
  if (doc.file_path) {
    await supabase.storage.from("case-files").remove([doc.file_path]);
  }
  const { error } = await supabase.from("case_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

/**
 * Open an attached file for inline viewing in a new tab.
 *
 * The tab is opened *synchronously* inside the click gesture BEFORE the async
 * signed-URL request, otherwise Safari/Chrome (desktop and mobile) block the
 * pop-up because window.open would run after an await. We keep the window
 * reference, so we must NOT pass "noopener" here (that would make window.open
 * return null); instead we null out `opener` after navigating for safety.
 *
 * The signed URL keeps its 1-hour expiry and is served inline (no forced
 * download), so PDFs and images render in the browser's viewer.
 */
export async function openFile(path: string, errorMessage?: string) {
  const w = window.open("about:blank", "_blank");

  try {
    const { data, error } = await supabase.storage
      .from("case-files")
      .createSignedUrl(path, 3600);
    if (error) throw error;
    const url = data.signedUrl;

    if (w) {
      try {
        w.opener = null;
      } catch {
        /* cross-origin opener assignment can throw; ignore */
      }
      w.location.href = url;
    } else {
      // Pop-up was blocked — fall back to a temporary anchor click.
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } catch (err) {
    if (w) w.close();
    toast.error(errorMessage ?? "Could not open file");
    throw err;
  }
}
