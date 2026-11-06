import { cookies } from "next/headers";
import { json, toResponse } from "@/app/lib/pny-pos/http";
import { PosError } from "@/app/lib/pny-pos/errors";
import { OWNER_COOKIE, ownerAuthConfigured, readOwnerSession } from "@/app/lib/pny-pos/ownerAuth";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireOwner() {
  if (!ownerAuthConfigured()) throw new PosError(503, "NOT_CONFIGURED", "Owner login is not configured on this deployment.");
  const token = (await cookies()).get(OWNER_COOKIE)?.value ?? "";
  if (!readOwnerSession(token)) throw new PosError(401, "OWNER_ONLY", "Owner sign-in is required.");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
    const { id } = await context.params;
    const service = await getService();
    return json(await service.ownerShiftDetail(id));
  } catch (error) {
    return toResponse(error);
  }
}
