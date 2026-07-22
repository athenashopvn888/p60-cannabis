import { hasStaffSession, isSameOrigin } from "@/app/lib/staffPhotoAuth";
import { publicError, STAFF_BUCKET, staffDb } from "@/app/lib/staffPhotoDb";
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
    const db = staffDb();
    const id = randomUUID();
    if (image && !("error" in image)) {
      const { error } = await db.storage.from(STAFF_BUCKET).upload(image.objectPath, image.bytes, { contentType: image.mime, upsert: false, cacheControl: "0" });
      if (error) throw error;
    }
    const values = {
      id, day_key: operationalDayKey(), category, note: note || null, status: "open",
      attachment_path: image && !("error" in image) ? image.objectPath : null,
      attachment_mime: image && !("error" in image) ? image.mime : null,
      attachment_bytes: image && !("error" in image) ? image.size : null,
      attachment_expires_at: image && !("error" in image) ? expiryFor().toISOString() : null,
    };
    const { error: insertError } = await db.from("staff_photo_issues").insert(values);
    if (insertError) {
      if (values.attachment_path) await db.storage.from(STAFF_BUCKET).remove([values.attachment_path]);
      throw insertError;
    }
    return Response.json({ ok: true, issueId: id });
  } catch (error) { return publicError(error); }
}
