import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { getStaffMedia, publicError, readStaffState } from "@/app/lib/staffPhotoStore";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifyBearer(request, process.env.PNY_STAFF_RETRIEVAL_TOKEN)) return new Response(null, { status: 401 });
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
    const state = await readStaffState();
    const submission = state.submissions.find((row) => row.id === id);
    let objectPath: string | null | undefined = submission?.object_path;
    let mime: string | null | undefined = submission?.mime_type;
    let expiresAt: string | null | undefined = submission?.expires_at;
    if (!objectPath) {
      const issue = state.issues.find((row) => row.id === id);
      objectPath = issue?.attachment_path;
      mime = issue?.attachment_mime;
      expiresAt = issue?.attachment_expires_at;
    }
    if (!objectPath) return new Response(null, { status: 404 });
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) return Response.json({ ok: false, error: "This attachment has expired." }, { status: 410 });
    const media = await getStaffMedia(objectPath);
    if (!media || media.statusCode !== 200 || !media.stream) return new Response(null, { status: 404 });
    return new Response(media.stream, { headers: { "content-type": mime || "application/octet-stream", "cache-control": "private, no-store", "content-disposition": `attachment; filename="${id}"`, "x-content-type-options": "nosniff" } });
  } catch (error) { return publicError(error); }
}
