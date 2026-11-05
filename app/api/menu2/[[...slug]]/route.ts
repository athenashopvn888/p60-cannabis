import { GET as menu } from "../../menu/route";
import { POST as orders } from "../../menu/orders/route";
import { GET as ticket } from "../../menu/tickets/[code]/route";
import { json } from "@/app/lib/pny-pos/http";
import { runStore } from "@/app/lib/pny-pos/storeContext";
import { PNY02_STORE } from "@/app/lib/pny-pos/storeProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const slug = ((await context.params).slug ?? []).join("/");
  return runStore(PNY02_STORE, async () => {
    if (!slug) return menu();
    const match = /^tickets\/([^/]+)$/.exec(slug);
    if (!match) return json({ ok: false, error: "Not found." }, 404);
    return ticket(request, { params: Promise.resolve({ code: match[1] }) });
  });
}

export async function POST(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const slug = ((await context.params).slug ?? []).join("/");
  if (slug !== "orders") return json({ ok: false, error: "Not found." }, 404);
  return runStore(PNY02_STORE, () => orders(request));
}
