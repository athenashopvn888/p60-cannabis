import { cookies } from "next/headers";
import { json, toResponse } from "@/app/lib/pny-pos/http";
import { OWNER_COOKIE } from "@/app/lib/pny-pos/ownerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    (await cookies()).set(OWNER_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
