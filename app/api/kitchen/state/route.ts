import { KITCHEN_PIN } from "@/app/lib/pny-pos/constants";
import { json, kitchenToken, loadDemoJournal, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = await getService();
    const boot = service.bootstrap();
    const token = await kitchenToken();
    const journal = boot.demo ? await loadDemoJournal() : undefined;
    if (!token) return json({ ...boot, demo_pin: boot.demo ? KITCHEN_PIN : null, authenticated: false }, 401);
    try {
      return json({ ...(await service.state(token, journal, "kitchen")), authenticated: true });
    } catch (error) {
      const response = toResponse(error);
      if (response.status === 401) {
        const body = await response.json();
        return json({ ...boot, demo_pin: boot.demo ? KITCHEN_PIN : null, authenticated: false, ...body }, 401);
      }
      return response;
    }
  } catch (error) {
    return toResponse(error);
  }
}
