import { NextResponse } from "next/server";
import { buildCloseWorkbook } from "@/src/server/xlsx";
import { loadLatestClose } from "@/src/server/readModel";

export const runtime = "nodejs";

export async function GET() {
  const { input, result } = await loadLatestClose("ACD01");
  const body = await buildCloseWorkbook(input, result);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="ACD01-Stock-Closing-S00001.xlsx"',
      "cache-control": "no-store",
    },
  });
}
