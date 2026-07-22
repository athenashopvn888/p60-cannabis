import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { STAFF_BUCKET, publicError, staffDb } from "@/app/lib/staffPhotoDb";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifyBearer(request, process.env.PNY_STAFF_RETRIEVAL_TOKEN)) return new Response(null, { status: 401 });
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
    const db = staffDb();
    const { data: submission, error: submissionError } = await db.from("staff_photo_submissions").select("object_path,mime_type,expires_at").eq("id", id).maybeSingle();
    if (submissionError) throw submissionError;
    let objectPath = submission?.object_path;
    let mime = submission?.mime_type;
    let expiresAt = submission?.expires_at;
    if (!objectPath) {
      const { data: issue, error } = await db.from("staff_photo_issues").select("attachment_path,attachment_mime,attachment_expires_at").eq("id", id).maybeSingle();
      if (error) throw error;
      objectPath = issue?.attachment_path;
      mime = issue?.attachment_mime;
      expiresAt = issue?.attachment_expires_at;
    }
    if (!objectPath) return new Response(null, { status: 404 });
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) return Response.json({ ok: false, error: "This attachment has expired." }, { status: 410 });
    const { data, error } = await db.storage.from(STAFF_BUCKET).download(objectPath);
    if (error) throw error;
    return new Response(await data.arrayBuffer(), { headers: { "content-type": mime || "application/octet-stream", "cache-control": "private, no-store", "content-disposition": `attachment; filename="${id}"`, "x-content-type-options": "nosniff" } });
  } catch (error) { return publicError(error); }
}
