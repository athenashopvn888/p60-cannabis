import { hasStaffSession, isSameOrigin } from "@/app/lib/staffPhotoAuth";
import { deleteStaffMedia, mutateStaffState, publicError, uploadStaffMedia } from "@/app/lib/staffPhotoStore";
import { expiryFor, ISSUE_CATEGORIES, operationalDayKey } from "@/app/lib/staffPhotoCore";
import { inspectImage } from "@/app/lib/staffPhotoUpload";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false, error: "Request was blocked." }, { status: 403 });
  if (!(await hasStaffSession())) return Response.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  try {
    const form = await request.formData();
    const category = String(form.get("category") || "");
    const note = String(form.get("note") || "").trim().slice(0, 500);
    if (!ISSUE_CATEGORIES.includes(category as (typeof ISSUE_CATEGORIES)[number])) return Response.json({ ok: false, error: "Choose an issue category." }, { status: 400 });
    const attachment = form.get("attachment");
    const image = attachment instanceof File && attachment.size > 0 ? await inspectImage(attachment, "issue") : null;
    if (image && "error" in image) return Response.json({ ok: false, error: image.error }, { status: 400 });
    const id = randomUUID();
    let attachmentPath: string | null = null;
    if (image && !("error" in image)) {
      attachmentPath = await uploadStaffMedia(image.objectPath, image.bytes, image.mime);
    }
    try {
      await mutateStaffState((state) => {
        state.issues.push({
          id, day_key: operationalDayKey(), category, note: note || null, status: "open",
          attachment_path: attachmentPath,
          attachment_mime: image && !("error" in image) ? image.mime : null,
          attachment_bytes: image && !("error" in image) ? image.size : null,
          attachment_expires_at: image && !("error" in image) ? expiryFor().toISOString() : null,
          created_at: new Date().toISOString(), retrieved_at: null,
        });
      });
    } catch (error) {
      if (attachmentPath) await deleteStaffMedia(attachmentPath).catch(() => undefined);
      throw error;
    }
    return Response.json({ ok: true, issueId: id });
  } catch (error) { return publicError(error); }
}
