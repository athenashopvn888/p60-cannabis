import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
    const report = await service.reconciliation();
    return json(report, report.ok ? 200 : 409);
  } catch (error) {
    return toResponse(error);
  }
}
