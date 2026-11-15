import { beginDemoRequest, endDemoRequest, json, loadDemoJournal, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";
import { blindStaffState } from "@/app/lib/pny-pos/staffView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = await getService();
    const token = await staffToken();
    const journal = service.bootstrap().demo ? await loadDemoJournal() : undefined;
    if (!token) return json({ ...service.bootstrap(), ...(await service.publicStatus()), authenticated: false }, 401);
    await beginDemoRequest(service);
    try {
      const view = { ...(await service.state(token, journal)), authenticated: true } as Record<string, unknown>;
      return json(blindStaffState(view));
    } catch (error) {
      const response = toResponse(error);
      if (response.status === 401) {
        const body = await response.json();
        return json({ ...service.bootstrap(), authenticated: false, ...body }, 401);
      }
      return response;
    } finally {
      await endDemoRequest(service);
    }
  } catch (error) {
    return toResponse(error);
  }
}
