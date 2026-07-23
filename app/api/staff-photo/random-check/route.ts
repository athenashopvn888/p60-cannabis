import { hasStaffSession, isSameOrigin } from "@/app/lib/staffPhotoAuth";
import { mutateStaffState, publicError } from "@/app/lib/staffPhotoStore";
import { operationalDayKey, randomCheckForDay } from "@/app/lib/staffPhotoCore";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false, error: "Request was blocked." }, { status: 403 });
  if (!(await hasStaffSession())) return Response.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  try {
    const dayKey = operationalDayKey();
    const assignment = randomCheckForDay(dayKey);
    if (!assignment) return Response.json({ ok: false, error: "There is no check assigned today." }, { status: 409 });
    const parsed = await request.json().catch(() => ({}));
    const result: "ok" | "issue" | "" = parsed.result === "ok" ? "ok" : parsed.result === "issue" ? "issue" : "";
    const issueId: string | null = typeof parsed.issueId === "string" ? parsed.issueId : null;
    if (!result || (result === "issue" && !issueId)) return Response.json({ ok: false, error: "Report the issue before completing this check." }, { status: 400 });
    await mutateStaffState((state) => {
      const row = { day_key: dayKey, check_key: assignment.key, question: assignment.question, result, issue_id: issueId, completed_at: new Date().toISOString() };
      const index = state.randomChecks.findIndex((check) => check.day_key === dayKey);
      if (index >= 0) state.randomChecks[index] = row;
      else state.randomChecks.push(row);
    });
    return Response.json({ ok: true });
  } catch (error) { return publicError(error); }
}
