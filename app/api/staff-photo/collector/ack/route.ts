import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { STAFF_BUCKET, publicError, staffDb } from "@/app/lib/staffPhotoDb";

const SUBMISSION_STATES = new Set(["retrieved", "invalid", "posted"]);

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.PNY_STAFF_RETRIEVAL_TOKEN)) return Response.json({ ok: false }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    const kind = body.kind === "issue" ? "issue" : body.kind === "submission" ? "submission" : "";
    const state = typeof body.state === "string" ? body.state : "";
    const deleteObject = body.deleteObject === true;
    if (!/^[0-9a-f-]{36}$/i.test(id) || !kind) return Response.json({ ok: false, error: "Invalid acknowledgement." }, { status: 400 });
    if (kind === "submission" && !SUBMISSION_STATES.has(state)) return Response.json({ ok: false, error: "Invalid submission state." }, { status: 400 });
    if (kind === "issue" && state !== "retrieved") return Response.json({ ok: false, error: "Invalid issue state." }, { status: 400 });
    const db = staffDb();
    const table = kind === "submission" ? "staff_photo_submissions" : "staff_photo_issues";
    const pathColumn = kind === "submission" ? "object_path" : "attachment_path";
    const { data: row, error: readError } = await db.from(table).select(pathColumn).eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!row) return Response.json({ ok: false, error: "Item not found." }, { status: 404 });
    const objectPath = (row as Record<string, string | null>)[pathColumn];
    const now = new Date().toISOString();
    const values: Record<string, string | null> = kind === "submission"
      ? { status: state, retrieved_at: now, validation_note: typeof body.note === "string" ? body.note.slice(0, 500) : null }
      : { status: "retrieved", retrieved_at: now };
    if (kind === "submission" && state === "posted") values.posted_at = now;
    if (deleteObject) values[pathColumn] = null;
    const { error: updateError } = await db.from(table).update(values).eq("id", id);
    if (updateError) throw updateError;
    if (deleteObject && objectPath) {
      const { error: removeError } = await db.storage.from(STAFF_BUCKET).remove([objectPath]);
      if (removeError) {
        await db.from(table).update({ [pathColumn]: objectPath }).eq("id", id);
        throw removeError;
      }
    }
    return Response.json({ ok: true, durable: true, objectDeleted: deleteObject && Boolean(objectPath) });
  } catch (error) { return publicError(error); }
}
