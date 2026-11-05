import { GET as status, POST as open } from "../../open-pin/route";
import { runStore } from "@/app/lib/pny-pos/storeContext";
import { PNY02_STORE } from "@/app/lib/pny-pos/storeProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return runStore(PNY02_STORE, () => status(request));
}

export function POST(request: Request) {
  return runStore(PNY02_STORE, () => open(request));
}
