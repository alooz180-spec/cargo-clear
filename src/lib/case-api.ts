import { toast } from "sonner";
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

export async function attachFile(
  doc: Pick<DocRow, "id">,
  caseId: string,
  file: File,
  displayName?: string,
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not signed in");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userData.user.id}/${caseId}/${doc.id}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("case-files")
    .upload(path, file, {
      upsert: true,
      // Set an explicit content type so stored objects render inline when viewed.
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) throw uploadError;
  // The stored object name (in `path`) stays neutral so content blockers can't
  // match on it; `file_name` keeps the human-readable label for display only.
  const { error } = await supabase
    .from("case_documents")
    .update({ file_name: displayName ?? file.name, file_path: path })
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
export async function addDocumentCopy(
  caseId: string,
  docType: string,
  sortOrder: number,
): Promise<DocRow> {
  const { data, error } = await supabase
    .from("case_documents")
    .insert({ case_id: caseId, doc_type: docType, sort_order: sortOrder, is_extra: true })
    .select()
    .single();
  if (error) throw error;
  return data as DocRow;
}

export async function deleteDocument(doc: Pick<DocRow, "id" | "file_path">) {
  if (doc.file_path) {
    await supabase.storage.from("case-files").remove([doc.file_path]);
  }
  const { error } = await supabase.from("case_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

/** Infer a viewable MIME type from a filename so the browser renders inline. */
function inferMimeType(name?: string | null): string {
  const ext = (name ?? "").toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "tif":
    case "tiff":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

/**
 * Resolve a working signed URL for a document, self-healing a diverged path.
 *
 * If the stored file_path no longer matches an object in storage (e.g. a
 * diverged split upload), we list the document's folder, find the object whose
 * name starts with `${doc.id}-`, sign THAT path instead, and repair the row's
 * file_path so future opens are direct. Returns null when nothing is found.
 */
async function resolveDocSignedUrl(ref: {
  id: string;
  case_id: string;
  file_path: string;
}): Promise<string | null> {
  const path = ref.file_path;
  const sign = async (p: string) => supabase.storage.from("case-files").createSignedUrl(p, 3600);

  const { data, error } = await sign(path);
  if (!error && data?.signedUrl) return data.signedUrl;

  console.error("openFile: failed to sign stored path", { path, error });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw error ?? new Error("Not signed in");
  const folder = `${userData.user.id}/${ref.case_id}`;
  const { data: files, error: listError } = await supabase.storage
    .from("case-files")
    .list(folder, { limit: 1000 });
  if (listError) {
    console.error("openFile: failed to list folder", { folder, listError });
    throw error ?? listError;
  }

  const match = files?.find((f) => f.name.startsWith(`${ref.id}-`));
  if (!match) {
    console.error("openFile: no matching object found in storage", {
      folder,
      docId: ref.id,
      available: files?.map((f) => f.name),
    });
    return null;
  }

  const correctedPath = `${folder}/${match.name}`;
  const { data: healed, error: healError } = await sign(correctedPath);
  if (healError || !healed?.signedUrl) {
    console.error("openFile: failed to sign corrected path", { correctedPath, healError });
    throw healError ?? new Error("Could not sign corrected path");
  }

  // Repair the diverged file_path so future opens are direct.
  const { error: updateError } = await supabase
    .from("case_documents")
    .update({ file_path: correctedPath })
    .eq("id", ref.id);
  if (updateError) {
    console.error("openFile: failed to repair file_path", { correctedPath, updateError });
  }

  return healed.signedUrl;
}

/**
 * Open an attached file for VIEWING in a new browser tab.
 *
 * We resolve a working signed URL FIRST (with self-healing), then fetch the file
 * as a blob RE-TYPED with the correct MIME (e.g. application/pdf) and open a
 * `blob:` object URL in a new tab. Blob URLs carry no domain or filename for
 * content blockers to match, so they survive ERR_BLOCKED_BY_CLIENT, and the
 * explicit MIME makes the browser render inline instead of downloading.
 *
 * Fallbacks (view stays the goal, download is the very last resort):
 *  1. If window.open is blocked, open the raw signed URL in a new tab via <a>.
 *  2. If the blob fetch itself fails, open the signed URL in a new tab.
 */
export async function openFile(
  ref: { id: string; case_id: string; file_path: string | null; file_name?: string | null },
  errorMessage?: string,
) {
  const path = ref.file_path;
  if (!path) {
    toast.error(errorMessage ?? "Could not open file");
    return;
  }

  const openViaAnchor = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  try {
    const signedUrl = await resolveDocSignedUrl({
      id: ref.id,
      case_id: ref.case_id,
      file_path: path,
    });
    if (!signedUrl) {
      toast.error(errorMessage ?? "File not found in storage");
      return;
    }

    try {
      // Fetch as a blob and re-type it so the browser renders it inline.
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      const type = inferMimeType(ref.file_name);
      const blob = new Blob([data], { type });
      const objectUrl = URL.createObjectURL(blob);

      const win = window.open(objectUrl, "_blank", "noopener");
      if (!win) {
        // Tab was blocked — try opening the raw signed URL in a new tab.
        console.error("openFile: window.open blocked, opening signed URL in new tab");
        openViaAnchor(signedUrl);
      }
      // Revoke after a delay so the new tab has time to read it.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (blobErr) {
      console.error("openFile: blob open failed, opening signed URL in new tab", { blobErr });
      // Fall back to opening the signed URL directly in a new tab (still a view).
      openViaAnchor(signedUrl);
    }
  } catch (err) {
    console.error("openFile: error opening file", { path, err });
    const message =
      (err as { message?: string } | null)?.message ?? errorMessage ?? "Could not open file";
    toast.error(message);
  }
}

/**
 * Deliberately DOWNLOAD (save) an attached file. Separate from openFile so
 * "view" opens for reading and "download" saves — the two are never confused.
 * Uses the same self-healing signed-URL resolution, then triggers an
 * <a download> with the human-readable file name.
 */
export async function downloadFile(
  ref: { id: string; case_id: string; file_path: string | null; file_name?: string | null },
  errorMessage?: string,
) {
  const path = ref.file_path;
  if (!path) {
    toast.error(errorMessage ?? "Could not download file");
    return;
  }

  try {
    const signedUrl = await resolveDocSignedUrl({
      id: ref.id,
      case_id: ref.case_id,
      file_path: path,
    });
    if (!signedUrl) {
      toast.error(errorMessage ?? "File not found in storage");
      return;
    }

    try {
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      const type = inferMimeType(ref.file_name);
      const blob = new Blob([data], { type });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = ref.file_name ?? "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (blobErr) {
      console.error("downloadFile: blob download failed, using signed URL", { blobErr });
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = ref.file_name ?? "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } catch (err) {
    console.error("downloadFile: error downloading file", { path, err });
    const message =
      (err as { message?: string } | null)?.message ?? errorMessage ?? "Could not download file";
    toast.error(message);
  }
}


