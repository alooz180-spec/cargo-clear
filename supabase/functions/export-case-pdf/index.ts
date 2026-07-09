// Combined PDF export for a case.
// Merges selected attached documents into a single PDF for the bank, with an
// optional cover page. Uses pdf-lib for merging and page generation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
} from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// English cover labels for the two Arabic-named customs documents so the cover
// page never depends on Arabic font shaping.
const COVER_DOC_LABELS: Record<string, string> = {
  "Swift (Bank Transfer)": "Swift (Bank Transfer)",
  Invoice: "Invoice",
  "Packing List": "Packing List",
  "Certificate of Origin": "Certificate of Origin",
  "Shipping Documents": "Shipping Documents",
  "البيان الكمركي": "Customs Declaration",
  "Exit Permission": "Exit Permission",
  "البيان الكمركي المسبق": "Advance Customs Declaration",
};

function coverLabel(docType: string): string {
  return COVER_DOC_LABELS[docType] ?? docType;
}

// The cover is rendered with a WinAnsi (Latin) font for reliable output, so
// map the known Arabic bank names to English. Unknown banks fall back to
// sanitize() which strips characters the Latin font cannot encode.
const BANK_LABELS: Record<string, string> = {
  "الاهلي العراقي": "Al-Ahli Iraqi Bank",
  "الاتحاد الاردني": "Union Bank of Jordan",
  "المنصور": "Al-Mansour Bank",
  "بغداد": "Baghdad Bank",
};

function bankLabel(bank: string): string {
  return BANK_LABELS[bank?.trim()] ?? bank;
}

// Final safety net: replace any character the Helvetica (WinAnsi) font cannot
// encode so cover rendering never throws on unexpected input.
function sanitize(str: string): string {
  return String(str ?? "")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "")
    .trim();
}

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 36;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth-scoped client — RLS applies as the calling user.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    const caseId: string | undefined = body?.caseId;
    const selectedIds: string[] = Array.isArray(body?.documentIds)
      ? body.documentIds
      : [];
    const includeCover: boolean = body?.includeCover !== false;

    if (!caseId) {
      return json({ error: "caseId is required" }, 400);
    }

    // Load the case and confirm ownership.
    const { data: kase, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();
    if (caseError || !kase) {
      return json({ error: "Case not found" }, 404);
    }
    if (kase.user_id !== user.id) {
      return json({ error: "Forbidden" }, 403);
    }

    // Load candidate documents belonging to this case that have a file.
    const { data: allDocs, error: docsError } = await supabase
      .from("case_documents")
      .select("*")
      .eq("case_id", caseId);
    if (docsError) {
      return json({ error: "Could not load documents" }, 500);
    }

    let docs = (allDocs ?? []).filter((d) => d.file_path);
    if (selectedIds.length > 0) {
      const wanted = new Set(selectedIds);
      docs = docs.filter((d) => wanted.has(d.id));
    }
    // Order: sort_order, then created_at (copies sit after their original).
    docs.sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        String(a.created_at).localeCompare(String(b.created_at)),
    );

    if (docs.length === 0) {
      return json({ error: "No attachable documents selected" }, 400);
    }

    const out = await PDFDocument.create();
    const helv = await out.embedFont(StandardFonts.Helvetica);
    const helvBold = await out.embedFont(StandardFonts.HelveticaBold);
    const courierBold = await out.embedFont(StandardFonts.CourierBold);

    const skipped: string[] = [];
    const included: string[] = [];

    // ---- Download + merge each document ----
    for (const doc of docs) {
      const name = (doc.file_name ?? doc.file_path ?? "").toLowerCase();
      const isTiff = name.endsWith(".tif") || name.endsWith(".tiff");
      if (isTiff) {
        skipped.push(coverLabel(doc.doc_type));
        continue;
      }

      const { data: fileData, error: dlError } = await supabase.storage
        .from("case-files")
        .download(doc.file_path);
      if (dlError || !fileData) {
        skipped.push(coverLabel(doc.doc_type));
        continue;
      }

      const bytes = new Uint8Array(await fileData.arrayBuffer());
      const isPdf = name.endsWith(".pdf");
      const isPng = name.endsWith(".png");
      const isJpg = name.endsWith(".jpg") || name.endsWith(".jpeg");

      try {
        if (isPdf) {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p) => out.addPage(p));
          included.push(coverLabel(doc.doc_type));
        } else if (isPng || isJpg) {
          const img = isPng
            ? await out.embedPng(bytes)
            : await out.embedJpg(bytes);
          const page = out.addPage([A4.width, A4.height]);
          const maxW = A4.width - MARGIN * 2;
          const maxH = A4.height - MARGIN * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, {
            x: (A4.width - w) / 2,
            y: (A4.height - h) / 2,
            width: w,
            height: h,
          });
          included.push(coverLabel(doc.doc_type));
        } else {
          skipped.push(coverLabel(doc.doc_type));
        }
      } catch (_e) {
        skipped.push(coverLabel(doc.doc_type));
      }
    }

    // ---- Cover page (prepended) ----
    if (includeCover) {
      const cover = out.insertPage(0, [A4.width, A4.height]);
      let y = A4.height - 80;
      const left = 56;

      cover.drawText("Transfer Document Package", {
        x: left,
        y,
        size: 22,
        font: helvBold,
        color: rgb(0.086, 0.137, 0.231),
      });
      y -= 44;

      cover.drawText(String(kase.ref), {
        x: left,
        y,
        size: 30,
        font: courierBold,
        color: rgb(0.051, 0.478, 0.431),
      });
      y -= 40;

      // hairline
      cover.drawLine({
        start: { x: left, y },
        end: { x: A4.width - left, y },
        thickness: 1,
        color: rgb(0.894, 0.909, 0.925),
      });
      y -= 30;

      const facts: [string, string][] = [
        ["Company", String(kase.company ?? "")],
        ["Bank", String(kase.bank ?? "")],
        [
          "Amount",
          `${Number(kase.amount).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${kase.currency}`,
        ],
        ["Status", statusLabel(kase.status)],
        [
          "Date",
          new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        ],
      ];

      for (const [label, val] of facts) {
        cover.drawText(label.toUpperCase(), {
          x: left,
          y,
          size: 9,
          font: helvBold,
          color: rgb(0.357, 0.42, 0.51),
        });
        cover.drawText(val, {
          x: left + 120,
          y,
          size: 12,
          font: helv,
          color: rgb(0.13, 0.16, 0.2),
        });
        y -= 24;
      }

      y -= 16;
      cover.drawText("Included documents", {
        x: left,
        y,
        size: 13,
        font: helvBold,
        color: rgb(0.086, 0.137, 0.231),
      });
      y -= 24;

      let n = 1;
      for (const label of included) {
        const idx = String(n).padStart(2, "0");
        cover.drawText(idx, {
          x: left,
          y,
          size: 10,
          font: courierBold,
          color: rgb(0.357, 0.42, 0.51),
        });
        cover.drawText(label, {
          x: left + 34,
          y,
          size: 11,
          font: helv,
          color: rgb(0.13, 0.16, 0.2),
        });
        y -= 20;
        n += 1;
        if (y < 90) break;
      }

      if (skipped.length > 0) {
        y -= 12;
        cover.drawText(
          `Note: ${skipped.length} item(s) could not be included (unsupported format).`,
          {
            x: left,
            y,
            size: 9,
            font: helv,
            color: rgb(0.658, 0.4, 0.067),
          },
        );
      }

      // Subtle "seal" in the corner, matching the app's verified stamp vibe.
      cover.drawText("MANIFEST", {
        x: A4.width - 180,
        y: 90,
        size: 16,
        font: courierBold,
        color: rgb(0.051, 0.478, 0.431),
        rotate: degrees(-9),
        opacity: 0.4,
      });
    }

    const pdfBytes = await out.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "X-Skipped-Count": String(skipped.length),
      },
    });
  } catch (e) {
    console.error("export-case-pdf error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

function statusLabel(status: string): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "complete":
      return "Complete";
    case "sent":
      return "Sent to bank";
    default:
      return status;
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
