import { NextRequest, NextResponse } from "next/server";
import { runCorrectionRequest } from "@/src/server/correctionApi";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const result = await runCorrectionRequest(request);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CORRECTION_FAILED";
    const status = message.includes("AUTH") || message.includes("FORBIDDEN") ? 403 : message.includes("DISABLED") ? 503 : 409;
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
