import { NextRequest, NextResponse } from "next/server";
import { requireMasterActor } from "@/src/server/auth";
import { withV2Transaction } from "@/src/server/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = requireMasterActor(request);
    const storeCode = actor.storeScopes[0];
    const result = await withV2Transaction(
      { actorId: actor.id, actorKind: actor.kind, storeCode },
      async (client) => {
        const snapshot = await client.query<{
          store_code: string;
          visible_stores: number;
          on_hand_units: number;
          latest_close_version: number;
          latest_final_cents: number;
        }>(`
          select
            $1::text as store_code,
            (select count(*)::int from pos_v2.stores) as visible_stores,
            (select coalesce(sum(quantity), 0)::int from pos_v2.inventory_balances where store_code = $1) as on_hand_units,
            (select max(version)::int from pos_v2.close_versions where store_code = $1) as latest_close_version,
            (select (result_json->>'finalVarianceCents')::int from pos_v2.close_versions where store_code = $1 order by version desc limit 1) as latest_final_cents
        `, [storeCode]);
        return snapshot.rows[0];
      },
    );
    return NextResponse.json({ ok: true, systemId: "PNYS_V2_PREVIEW", ...result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "V2_HEALTH_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 403, headers: { "cache-control": "no-store" } });
  }
}
