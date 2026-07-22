import { clearStaffSession, isSameOrigin, setStaffSession } from "@/app/lib/staffPhotoAuth";
import { publicError, staffDb } from "@/app/lib/staffPhotoDb";
import { verifyDailyPin } from "@/app/lib/staffPhotoPin";
import { LOGIN_WINDOW_MINUTES, loginAllowed } from "@/app/lib/staffPhotoCore";
import { createHmac } from "node:crypto";

export const runtime = "nodejs";

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const secret = process.env.PNY_STAFF_SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("Staff session secret is not configured.");
  return createHmac("sha256", secret).update(forwarded).digest("base64url");
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false, error: "Request was blocked." }, { status: 403 });
  try {
    const db = staffDb();
    const key = clientKey(request);
    const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
    const { count, error: countError } = await db.from("staff_photo_login_attempts").select("id", { count: "exact", head: true }).eq("client_key", key).eq("succeeded", false).gte("created_at", since);
    if (countError) throw countError;
    if (!loginAllowed(count || 0)) return Response.json({ ok: false, error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    const parsed = await request.json().catch(() => ({}));
    const pin = typeof parsed.pin === "string" ? parsed.pin.trim() : "";
    const { data: settings, error: settingsError } = await db.from("staff_photo_settings").select("pin_version").eq("id", true).single();
    if (settingsError || !settings) throw settingsError || new Error("Staff settings missing.");
    let valid = false;
    try { valid = verifyDailyPin(pin, settings.pin_version); } catch { valid = false; }
    const { error: insertError } = await db.from("staff_photo_login_attempts").insert({ client_key: key, succeeded: valid });
    if (insertError) throw insertError;
    if (!valid) return Response.json({ ok: false, error: "That staff PIN is not correct." }, { status: 401 });
    await setStaffSession(settings.pin_version);
    return Response.json({ ok: true });
  } catch (error) { return publicError(error); }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  await clearStaffSession();
  return Response.json({ ok: true });
}
