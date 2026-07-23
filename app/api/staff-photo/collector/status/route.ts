import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { publicError, readStaffState } from "@/app/lib/staffPhotoStore";
import { availablePrompts, operationalDayKey, randomCheckForDay, STORE_CODE, STORE_NAME, torontoWeekKey } from "@/app/lib/staffPhotoCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyBearer(request, process.env.PNY_STAFF_RETRIEVAL_TOKEN)) return Response.json({ ok: false }, { status: 401 });
  try {
    const state = await readStaffState();
    const dayKey = new URL(request.url).searchParams.get("day") || operationalDayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return Response.json({ ok: false, error: "Invalid day." }, { status: 400 });
    const weekKey = dayKey === operationalDayKey() ? torontoWeekKey() : undefined;
    const submissions = state.submissions.filter((row) => row.day_key === dayKey).sort((a, b) => a.slot - b.slot);
    const issues = state.issues.filter((row) => row.day_key === dayKey).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const check = state.randomChecks.find((row) => row.day_key === dayKey);
    const activeStates = new Set(["pending", "retrieved", "posted"]);
    const week = weekKey ? state.submissions.filter((row) => row.week_key === weekKey && activeStates.has(row.status)) : [];
    const assignment = randomCheckForDay(dayKey);
    const safeIssues = issues.map(({ attachment_path, ...issue }) => ({ ...issue, hasAttachment: Boolean(attachment_path) }));
    return Response.json({
      ok: true, store: { code: STORE_CODE, name: STORE_NAME }, dayKey,
      requiredComplete: submissions.some((row) => row.slot === 1),
      optionalComplete: submissions.some((row) => row.slot === 2),
      submissions, issues: safeIssues,
      randomCheck: assignment ? { ...assignment, completed: Boolean(check), result: check?.result || null } : null,
      unusedPrompts: availablePrompts(week.map((row) => row.prompt_key)),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return publicError(error); }
}
