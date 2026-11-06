import { cookies } from "next/headers";
import { clientIp, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { PosError } from "@/app/lib/pny-pos/errors";
import {
  OWNER_COOKIE,
  checkOwnerPassword,
  clearOwnerFails,
  lockoutStatus,
  ownerAuthConfigured,
  recordOwnerFail,
  signOwnerSession,
} from "@/app/lib/pny-pos/ownerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function POST(request: Request) {
  try {
    if (!ownerAuthConfigured()) {
      throw new PosError(503, "NOT_CONFIGURED", "Owner login is not configured on this deployment.");
    }
    const ip = clientIp(request);
    const lock = lockoutStatus(ip);
    if (lock.locked) {
      throw new PosError(429, "LOCKED", "Too many failed attempts. Try again later.", { remaining_ms: lock.remainingMs });
    }
    const body = await readBody(request);
    const password = String(body.password ?? "");
    if (!checkOwnerPassword(password)) {
      const fail = recordOwnerFail(ip);
      if (fail.locked) {
        throw new PosError(429, "LOCKED", "Too many failed attempts. Try again later.", { remaining_ms: fail.remainingMs });
      }
      throw new PosError(401, "BAD_PASSWORD", "Wrong password.", { fails: fail.fails, remaining: 5 - fail.fails });
    }
    clearOwnerFails(ip);
    const token = signOwnerSession();
    (await cookies()).set(OWNER_COOKIE, token, { ...cookieBase, maxAge: 60 * 60 * 14 });
    return json({ ok: true, store: "PNY01" });
  } catch (error) {
    return toResponse(error);
  }
}
