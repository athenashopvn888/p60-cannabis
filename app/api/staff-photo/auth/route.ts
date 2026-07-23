import { clearStaffSession, isSameOrigin, setStaffSession } from "@/app/lib/staffPhotoAuth";
import { mutateStaffState, publicError } from "@/app/lib/staffPhotoStore";
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
    const key = clientKey(request);
    const parsed = await request.json().catch(() => ({}));
    const pin = typeof parsed.pin === "string" ? parsed.pin.trim() : "";
    const outcome = await mutateStaffState((state) => {
      const now = new Date();
      const since = now.getTime() - LOGIN_WINDOW_MINUTES * 60_000;
      state.loginAttempts = state.loginAttempts.filter((attempt) => Date.parse(attempt.created_at) >= now.getTime() - 24 * 60 * 60_000);
      const failures = state.loginAttempts.filter((attempt) =>
        attempt.client_key === key &&
        !attempt.succeeded &&
        Date.parse(attempt.created_at) >= since
      ).length;
      if (!loginAllowed(failures)) return { limited: true, valid: false, pinVersion: state.pinVersion };
      let valid = false;
      try { valid = verifyDailyPin(pin, state.pinVersion); } catch { valid = false; }
      state.loginAttempts.push({ client_key: key, succeeded: valid, created_at: now.toISOString() });
      return { limited: false, valid, pinVersion: state.pinVersion };
    });
    if (outcome.limited) return Response.json({ ok: false, error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    if (!outcome.valid) return Response.json({ ok: false, error: "That staff PIN is not correct." }, { status: 401 });
    await setStaffSession(outcome.pinVersion);
    return Response.json({ ok: true });
  } catch (error) { return publicError(error); }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  await clearStaffSession();
  return Response.json({ ok: true });
}
