import { Pool } from "pg";
import { INTEGRATION_CHANNELS, deploymentGeneration } from "@/app/lib/pny-pos/controls";
import { json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") return json({ ok: false, error: "Not available." }, 404);
  const connectionString = process.env.POS_SUPABASE_DB_URL?.trim();
  if (!connectionString) return json({ ok: false, error: "Database is not configured." }, 503);
  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    await client.query("begin transaction read only");
    await client.query("set local statement_timeout = '5s'");
    const runtimeRow = await client.query(
      "select write_mode,generation from pos_hub.store_runtime where store_code='PNY01'",
    );
    const owners = await client.query(
      "select channel,owner_store_code,generation,enabled from pos_hub.integration_owner where channel=any($1::text[]) order by channel",
      [INTEGRATION_CHANNELS],
    );
    const liveState = await client.query("select count(*)::int as rows from pny_pos.live_state where store_code='PNY01'");
    await client.query("rollback");
    const generation = deploymentGeneration();
    return json({
      ok: true,
      store_code: "PNY01",
      write_mode: runtimeRow.rows[0]?.write_mode ?? null,
      generation: Number(runtimeRow.rows[0]?.generation ?? 0),
      deployment_generation: generation,
      owner_channels: owners.rows.length,
      enabled_channels: owners.rows.filter((row) => row.enabled === true).length,
      all_owned_by_pny01: owners.rows.length === INTEGRATION_CHANNELS.length
        && owners.rows.every((row) => row.owner_store_code === "PNY01" && Number(row.generation) === generation && row.enabled === true),
      live_state_rows: Number(liveState.rows[0]?.rows ?? 0),
    });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    return toResponse(error);
  } finally {
    client.release();
    await pool.end();
  }
}
