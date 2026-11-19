import { NextRequest, NextResponse } from "next/server";
import { approveOutbox, listOutbox } from "@/src/server/outbox";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "OUTBOX_REQUEST_FAILED";
  const status = message.includes("AUTH") || message.includes("FORBIDDEN") ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ items: await listOutbox(request) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await approveOutbox(request));
  } catch (error) {
    return failure(error);
  }
}
