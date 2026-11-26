import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Actor } from "@/src/domain/corrections";

function equalHash(value: string, expectedHex: string) {
  const actual = createHash("sha256").update(value).digest();
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function storeScopes(request: NextRequest): string[] {
  const requested = request.headers.get("x-v2-store-code")?.trim().toUpperCase();
  return requested && /^[A-Z0-9]{3,12}$/.test(requested) ? [requested] : [];
}

export function requireMasterActor(request: NextRequest): Actor {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const humanHash = process.env.V2_HUMAN_MASTER_TOKEN_SHA256?.trim() ?? "";
  const aiHash = process.env.V2_AI_MASTER_TOKEN_SHA256?.trim() ?? "";
  if (!token || (!humanHash && !aiHash)) throw new Error("MASTER_AUTH_DISABLED");
  const scopes = storeScopes(request);
  if (scopes.length !== 1) throw new Error("STORE_SCOPE_REQUIRED");
  if (humanHash && equalHash(token, humanHash)) {
    return { id: "tri", kind: "HUMAN_MASTER", storeScopes: scopes, triRequested: true };
  }
  if (aiHash && equalHash(token, aiHash)) {
    return {
      id: request.headers.get("x-v2-ai-actor")?.trim() || "ai-master",
      kind: "AI_MASTER",
      storeScopes: scopes,
      triRequested: request.headers.get("x-v2-tri-requested") === "true",
    };
  }
  throw new Error("MASTER_AUTH_FAILED");
}
