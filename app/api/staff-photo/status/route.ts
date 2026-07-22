import { hasStaffSession } from "@/app/lib/staffPhotoAuth";
import { publicError, staffDb } from "@/app/lib/staffPhotoDb";
import { availablePrompts, operationalDayKey, randomCheckForDay, STORE_CODE, STORE_NAME, torontoWeekKey } from "@/app/lib/staffPhotoCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasStaffSession())) return Response.json({ ok: false, authenticated: false }, { status: 401 });
  try {
    const db = staffDb();
    const dayKey = operationalDayKey();
    const weekKey = torontoWeekKey();
    const [{ data: today, error: todayError }, { data: week, error: weekError }, { data: checkRows, error: checkError }] = await Promise.all([
      db.from("staff_photo_submissions").select("id,slot,prompt_key,status,created_at,expires_at").eq("day_key", dayKey).in("status", ["pending", "retrieved", "posted"]).order("slot"),
      db.from("staff_photo_submissions").select("prompt_key").eq("week_key", weekKey).in("status", ["pending", "retrieved", "posted"]),
      db.from("staff_photo_random_checks").select("result,issue_id,completed_at").eq("day_key", dayKey).maybeSingle(),
    ]);
    if (todayError || weekError || checkError) throw todayError || weekError || checkError;
    const assignment = randomCheckForDay(dayKey);
    return Response.json({
      ok: true,
      authenticated: true,
      store: { code: STORE_CODE, name: STORE_NAME },
      dayKey,
      weekKey,
      submissions: today || [],
      requiredComplete: Boolean(today?.some((row) => row.slot === 1)),
      optionalComplete: Boolean(today?.some((row) => row.slot === 2)),
      availablePrompts: availablePrompts((week || []).map((row) => row.prompt_key)),
      randomCheck: assignment ? { ...assignment, completed: Boolean(checkRows), result: checkRows?.result || null } : null,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return publicError(error); }
}
