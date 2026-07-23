import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { deleteStaffMedia, mutateStaffState, publicError } from "@/app/lib/staffPhotoStore";

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
    const now = new Date().toISOString();
    const updated = await mutateStaffState((draft) => {
      if (kind === "submission") {
        const row = draft.submissions.find((entry) => entry.id === id);
        if (!row) return { found: false, objectPath: null as string | null };
        row.status = state as "retrieved" | "invalid" | "posted";
        row.retrieved_at = now;
        row.validation_note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
        if (state === "posted") row.posted_at = now;
        return { found: true, objectPath: row.object_path };
      }
      const row = draft.issues.find((entry) => entry.id === id);
      if (!row) return { found: false, objectPath: null as string | null };
      row.status = "retrieved";
      row.retrieved_at = now;
      return { found: true, objectPath: row.attachment_path };
    });
    if (!updated.found) return Response.json({ ok: false, error: "Item not found." }, { status: 404 });
    const objectPath = updated.objectPath;
    if (deleteObject && objectPath) {
      await deleteStaffMedia(objectPath);
      await mutateStaffState((draft) => {
        if (kind === "submission") {
          const row = draft.submissions.find((entry) => entry.id === id);
          if (row?.object_path === objectPath) row.object_path = null;
        } else {
          const row = draft.issues.find((entry) => entry.id === id);
          if (row?.attachment_path === objectPath) row.attachment_path = null;
        }
      });
    }
    return Response.json({ ok: true, durable: true, objectDeleted: deleteObject && Boolean(objectPath) });
  } catch (error) { return publicError(error); }
}
