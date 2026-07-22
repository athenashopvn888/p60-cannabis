import { hasStaffSession, isSameOrigin } from "@/app/lib/staffPhotoAuth";
import { publicError, staffDb } from "@/app/lib/staffPhotoDb";
import { operationalDayKey, randomCheckForDay } from "@/app/lib/staffPhotoCore";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false, error: "Request was blocked." }, { status: 403 });
  if (!(await hasStaffSession())) return Response.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  try {
    const dayKey = operationalDayKey();
    const assignment = randomCheckForDay(dayKey);
    if (!assignment) return Response.json({ ok: false, error: "There is no check assigned today." }, { status: 409 });
    const parsed = await request.json().catch(() => ({}));
    const result = parsed.result === "ok" ? "ok" : parsed.result === "issue" ? "issue" : "";
    const issueId = typeof parsed.issueId === "string" ? parsed.issueId : null;
    if (!result || (result === "issue" && !issueId)) return Response.json({ ok: false, error: "Report the issue before completing this check." }, { status: 400 });
    const db = staffDb();
    const { error } = await db.from("staff_photo_random_checks").upsert({ day_key: dayKey, check_key: assignment.key, question: assignment.question, result, issue_id: issueId, completed_at: new Date().toISOString() }, { onConflict: "day_key" });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) { return publicError(error); }
}
