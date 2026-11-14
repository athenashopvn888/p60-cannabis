import { createHash, timingSafeEqual } from "node:crypto";
import { runRelease3b } from "@/scripts/pnys-release3b-db-dry-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EXPECTED_TOKEN_HASH = "8bfed44155f133dba9ca108920ee5e369280439bf295a6bc67e68d8620adf3f8";

function acceptedToken(value: string | null) {
  if (!value) return false;
  const actual = createHash("sha256").update(value).digest();
  const expected = Buffer.from(EXPECTED_TOKEN_HASH, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.STORE_CODE !== "PNYS" || process.env.POS_DB_SCHEMA !== "pnys_pos") return Response.json({ error: "PNYS preview only." }, { status: 404 });
  if (!acceptedToken(request.headers.get("x-release3b-token"))) return Response.json({ error: "Not authorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "RUN DRY-R3B AND RESTORE") return Response.json({ error: "Exact confirmation is required." }, { status: 400 });
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    return Response.json(await runRelease3b(env, false));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Release 3b failed." }, { status: 500 });
  }
}
