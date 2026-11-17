import { createHash } from "node:crypto";

export type SignalDelivery = {
  event_id: string;
  message: string;
};

export type SignalGateway = {
  enabled: boolean;
  dryRun: boolean;
  send(delivery: SignalDelivery): Promise<Record<string, unknown>>;
};

function requestId(eventId: string) {
  return createHash("sha256").update(`PNY_POS|${eventId}`).digest("hex");
}

/**
 * Uses the existing SCCx Signal gateway contract. Preview remains a dry run;
 * production additionally requires SIGNAL_ENABLED plus all three route values.
 */
export function signalGatewayFromEnv(): SignalGateway {
  const enabled = process.env.SIGNAL_ENABLED?.trim() === "1";
  const dryRun = process.env.VERCEL_ENV !== "production";
  const baseUrl = process.env.SCCX_GATEWAY_BASE_URL?.trim().replace(/\/$/, "") ?? "";
  const token = process.env.SCCX_GATEWAY_TOKEN?.trim() ?? "";
  const groupId = process.env.PNY_SIGNAL_GROUP_ID?.trim() ?? "";

  return {
    enabled,
    dryRun,
    async send(delivery) {
      if (!enabled) throw new Error("Signal delivery is disabled.");
      if (dryRun) return { ok: true, status: "dry-run", request_id: requestId(delivery.event_id) };
      if (!baseUrl || !token || !groupId) throw new Error("SCCx Signal route is not configured.");
      const response = await fetch(`${baseUrl}/api/gateway/send`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-scc-token": token },
        body: JSON.stringify({
          addon: "PNY_POS",
          requestId: requestId(delivery.event_id),
          message: delivery.message,
          groupId,
        }),
        signal: AbortSignal.timeout(135_000),
      });
      const result = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok || result.ok !== true || result.status !== "sent") throw new Error("SCCx did not confirm the Signal delivery.");
      return { ok: true, status: "sent", request_id: requestId(delivery.event_id) };
    },
  };
}
