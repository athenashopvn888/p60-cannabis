import { hasStaffSession } from "@/app/lib/staffPhotoAuth";
import { publicError, readStaffState } from "@/app/lib/staffPhotoStore";
import { availablePrompts, operationalDayKey, randomCheckForDay, STORE_CODE, STORE_NAME, torontoWeekKey } from "@/app/lib/staffPhotoCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasStaffSession())) return Response.json({ ok: false, authenticated: false }, { status: 401 });
  try {
    const state = await readStaffState();
    const dayKey = operationalDayKey();
    const weekKey = torontoWeekKey();
    const activeStates = new Set(["pending", "retrieved", "posted"]);
    const today = state.submissions.filter((row) => row.day_key === dayKey && activeStates.has(row.status)).sort((a, b) => a.slot - b.slot);
    const week = state.submissions.filter((row) => row.week_key === weekKey && activeStates.has(row.status));
    const checkRow = state.randomChecks.find((row) => row.day_key === dayKey);
    const assignment = randomCheckForDay(dayKey);
    return Response.json({
      ok: true,
      authenticated: true,
      store: { code: STORE_CODE, name: STORE_NAME },
      dayKey,
      weekKey,
      submissions: today,
      requiredComplete: today.some((row) => row.slot === 1),
      optionalComplete: today.some((row) => row.slot === 2),
      availablePrompts: availablePrompts(week.map((row) => row.prompt_key)),
      randomCheck: assignment ? { ...assignment, completed: Boolean(checkRow), result: checkRow?.result || null } : null,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return publicError(error); }
}
