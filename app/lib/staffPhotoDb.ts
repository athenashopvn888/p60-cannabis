import "server-only";
import { createClient } from "@supabase/supabase-js";

export const STAFF_BUCKET = "pny-staff-photo-private";

export function staffDb() {
  const url = process.env.PNY_STAFF_SUPABASE_URL || "";
  const key = process.env.PNY_STAFF_SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Staff photo storage is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { "x-application-name": "pny-staff-photo" } } });
}
export function publicError(error: unknown) {
  console.error("Staff photo operation failed", error instanceof Error ? error.message : "unknown error");
  return Response.json({ ok: false, error: "The staff photo service is temporarily unavailable." }, { status: 503 });
}
