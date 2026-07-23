import { hasStaffSession, isSameOrigin } from "@/app/lib/staffPhotoAuth";
import { deleteStaffMedia, mutateStaffState, publicError, uploadStaffMedia } from "@/app/lib/staffPhotoStore";
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
    const dayKey = operationalDayKey();
    const weekKey = torontoWeekKey();
    const objectPath = await uploadStaffMedia(image.objectPath, image.bytes, image.mime);
    let slot = 0;
    try {
      slot = await mutateStaffState((state) => {
        const activeStates = new Set(["pending", "retrieved", "posted"]);
        const today = state.submissions.filter((row) => row.day_key === dayKey && activeStates.has(row.status));
        if (today.length >= 2) throw new Error("daily-limit");
        const promptUsed = state.submissions.some((row) =>
          row.week_key === weekKey && row.prompt_key === promptKey && activeStates.has(row.status)
        );
        if (promptUsed) throw new Error("prompt-used");
        const nextSlot = today.some((row) => row.slot === 1) ? 2 : 1;
        const now = new Date().toISOString();
        state.submissions.push({
          id: image.id, day_key: dayKey, week_key: weekKey, slot: nextSlot, prompt_key: promptKey,
          object_path: objectPath, original_name: image.originalName, mime_type: image.mime,
          byte_size: image.size, status: "pending", created_at: now, expires_at: expiryFor().toISOString(),
          retrieved_at: null, posted_at: null, validation_note: null,
        });
        return nextSlot;
      });
    } catch (error) {
      await deleteStaffMedia(objectPath).catch(() => undefined);
      if (error instanceof Error && error.message === "daily-limit") return Response.json({ ok: false, error: "Today already has two photos." }, { status: 409 });
      if (error instanceof Error && error.message === "prompt-used") return Response.json({ ok: false, error: "That shot type was already used this week." }, { status: 409 });
      throw error;
    }
    return Response.json({ ok: true, slot });
  } catch (error) { return publicError(error); }
}
