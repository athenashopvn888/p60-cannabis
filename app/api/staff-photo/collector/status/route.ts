import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { publicError, staffDb } from "@/app/lib/staffPhotoDb";
import { availablePrompts, operationalDayKey, randomCheckForDay, STORE_CODE, STORE_NAME, torontoWeekKey } from "@/app/lib/staffPhotoCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyBearer(request, process.env.PNY_STAFF_RETRIEVAL_TOKEN)) return Response.json({ ok: false }, { status: 401 });
  try {
    const db = staffDb();
    const dayKey = new URL(request.url).searchParams.get("day") || operationalDayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return Response.json({ ok: false, error: "Invalid day." }, { status: 400 });
    const weekKey = dayKey === operationalDayKey() ? torontoWeekKey() : undefined;
    const [{ data: submissions, error: submissionError }, { data: issues, error: issueError }, { data: checks, error: checkError }, { data: week, error: weekError }] = await Promise.all([
      db.from("staff_photo_submissions").select("id,day_key,week_key,slot,prompt_key,mime_type,byte_size,status,created_at,expires_at,retrieved_at,posted_at,validation_note").eq("day_key", dayKey).order("slot"),
      db.from("staff_photo_issues").select("id,day_key,category,note,status,attachment_path,attachment_mime,attachment_bytes,created_at,attachment_expires_at,retrieved_at").eq("day_key", dayKey).order("created_at"),
      db.from("staff_photo_random_checks").select("check_key,question,result,issue_id,completed_at").eq("day_key", dayKey).maybeSingle(),
      weekKey ? db.from("staff_photo_submissions").select("prompt_key").eq("week_key", weekKey).in("status", ["pending", "retrieved", "posted"]) : Promise.resolve({ data: [], error: null }),
    ]);
    if (submissionError || issueError || checkError || weekError) throw submissionError || issueError || checkError || weekError;
    const assignment = randomCheckForDay(dayKey);
    const safeIssues = (issues || []).map(({ attachment_path, ...issue }) => ({ ...issue, hasAttachment: Boolean(attachment_path) }));
    return Response.json({
      ok: true, store: { code: STORE_CODE, name: STORE_NAME }, dayKey,
      requiredComplete: Boolean(submissions?.some((row) => row.slot === 1)),
      optionalComplete: Boolean(submissions?.some((row) => row.slot === 2)),
      submissions: submissions || [], issues: safeIssues,
      randomCheck: assignment ? { ...assignment, completed: Boolean(checks), result: checks?.result || null } : null,
      unusedPrompts: availablePrompts((week || []).map((row) => row.prompt_key)),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return publicError(error); }
}
