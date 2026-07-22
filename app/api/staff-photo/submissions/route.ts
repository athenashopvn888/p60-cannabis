import { hasStaffSession, isSameOrigin } from "@/app/lib/staffPhotoAuth";
import { publicError, STAFF_BUCKET, staffDb } from "@/app/lib/staffPhotoDb";
import { expiryFor, operationalDayKey, SHOT_PROMPTS, torontoWeekKey } from "@/app/lib/staffPhotoCore";
import { inspectImage } from "@/app/lib/staffPhotoUpload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false, error: "Request was blocked." }, { status: 403 });
  if (!(await hasStaffSession())) return Response.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  try {
    const form = await request.formData();
    const promptKey = String(form.get("promptKey") || "");
    if (!SHOT_PROMPTS.some((prompt) => prompt.key === promptKey)) return Response.json({ ok: false, error: "Choose a valid shot type." }, { status: 400 });
    const image = await inspectImage(form.get("photo"), "daily");
    if ("error" in image) return Response.json({ ok: false, error: image.error }, { status: 400 });
    const db = staffDb();
    const dayKey = operationalDayKey();
    const weekKey = torontoWeekKey();
    const { data: today, error: todayError } = await db.from("staff_photo_submissions").select("slot,prompt_key").eq("day_key", dayKey).in("status", ["pending", "retrieved", "posted"]).order("slot");
    if (todayError) throw todayError;
    if ((today?.length || 0) >= 2) return Response.json({ ok: false, error: "Today already has two photos." }, { status: 409 });
    const { data: used, error: usedError } = await db.from("staff_photo_submissions").select("id").eq("week_key", weekKey).eq("prompt_key", promptKey).in("status", ["pending", "retrieved", "posted"]).limit(1);
    if (usedError) throw usedError;
    if (used?.length) return Response.json({ ok: false, error: "That shot type was already used this week." }, { status: 409 });
    const slot = (today?.length || 0) + 1;
    const { error: uploadError } = await db.storage.from(STAFF_BUCKET).upload(image.objectPath, image.bytes, { contentType: image.mime, upsert: false, cacheControl: "0" });
    if (uploadError) throw uploadError;
    const { error: insertError } = await db.from("staff_photo_submissions").insert({
      id: image.id, day_key: dayKey, week_key: weekKey, slot, prompt_key: promptKey,
      object_path: image.objectPath, original_name: image.originalName, mime_type: image.mime,
      byte_size: image.size, status: "pending", expires_at: expiryFor().toISOString(),
    });
    if (insertError) {
      await db.storage.from(STAFF_BUCKET).remove([image.objectPath]);
      throw insertError;
    }
    return Response.json({ ok: true, slot });
  } catch (error) { return publicError(error); }
}
