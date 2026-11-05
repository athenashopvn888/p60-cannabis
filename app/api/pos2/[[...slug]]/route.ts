import { POST as cashout } from "../../pos/cashout/route";
import { POST as opening } from "../../pos/counts/opening/route";
import { POST as openingJump } from "../../pos/counts/opening-jump/route";
import { POST as openingLine } from "../../pos/counts/opening-line/route";
import { POST as openingSubmit } from "../../pos/counts/opening-submit/route";
import { POST as deposit } from "../../pos/deposits/route";
import { POST as confirmPin } from "../../pos/deposits/confirm-pin/route";
import { POST as confirmIncoming } from "../../pos/incoming/confirm/route";
import { POST as refreshIncoming } from "../../pos/incoming/refresh/route";
import { POST as login } from "../../pos/login/route";
import { POST as logout } from "../../pos/logout/route";
import { POST as closeStart } from "../../pos/shift/close-start/route";
import { POST as count } from "../../pos/shift/count/route";
import { POST as countSubmit } from "../../pos/shift/count-submit/route";
import { POST as endShift } from "../../pos/shift/end/route";
import { POST as finalDeposit } from "../../pos/shift/final-deposit/route";
import { GET as state } from "../../pos/state/route";
import { GET as summary } from "../../pos/summary/route";
import { POST as cancelTicket } from "../../pos/tickets/[id]/cancel/route";
import { POST as openTicket } from "../../pos/tickets/[id]/open/route";
import { POST as unlock } from "../../pos/till/unlock/route";
import { json } from "@/app/lib/pny-pos/http";
import { runStore } from "@/app/lib/pny-pos/storeContext";
import { PNY02_STORE } from "@/app/lib/pny-pos/storeProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Handler = (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>;

const getRoutes: Record<string, Handler> = {
  state: state as Handler,
  summary: summary as Handler,
};

const postRoutes: Record<string, Handler> = {
  login: login as Handler,
  logout: logout as Handler,
  cashout: cashout as Handler,
  "deposits": deposit as Handler,
  "deposits/confirm-pin": confirmPin as Handler,
  "shift/close-start": closeStart as Handler,
  "shift/count": count as Handler,
  "shift/count-submit": countSubmit as Handler,
  "shift/end": endShift as Handler,
  "shift/final-deposit": finalDeposit as Handler,
  "counts/opening": opening as Handler,
  "counts/opening-line": openingLine as Handler,
  "counts/opening-submit": openingSubmit as Handler,
  "counts/opening-jump": openingJump as Handler,
  "incoming/confirm": confirmIncoming as Handler,
  "incoming/refresh": refreshIncoming as Handler,
  "till/unlock": unlock as Handler,
};

function ticketRoute(slug: string): { handler: Handler; id: string } | null {
  const match = /^tickets\/([^/]+)\/(open|cancel)$/.exec(slug);
  if (!match) return null;
  return { handler: (match[2] === "open" ? openTicket : cancelTicket) as Handler, id: match[1] };
}

async function dispatch(method: "GET" | "POST", request: Request, slug: string) {
  const ticket = method === "POST" ? ticketRoute(slug) : null;
  const handler = ticket?.handler ?? (method === "GET" ? getRoutes[slug] : postRoutes[slug]);
  if (!handler) return json({ ok: false, error: "Not found." }, 404);
  const context = ticket ? { params: Promise.resolve({ id: ticket.id }) } : undefined;
  return runStore(PNY02_STORE, () => handler(request, context));
}

export async function GET(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const slug = ((await context.params).slug ?? []).join("/");
  return dispatch("GET", request, slug);
}

export async function POST(request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const slug = ((await context.params).slug ?? []).join("/");
  return dispatch("POST", request, slug);
}
