import { Pool, type PoolClient } from "pg";
import { emptyState, isAuthSessionOnlyChange, type PosDb, type TransactionKind, type Tx } from "./memory.ts";
import { deploymentGeneration, maintenanceMode } from "./controls.ts";
import { PosError } from "./errors.ts";
import type { State } from "./types.ts";
import type { StoreCode } from "./storeProfile.ts";

export class StaleRevision extends Error {
  constructor() {
    super("stale revision");
    this.name = "StaleRevision";
  }
}

type StateSchema = "pny_pos" | "pnys_pos";

function asState(doc: unknown): State {
  if (!doc || typeof doc !== "object" || !Array.isArray((doc as State).shifts)) return emptyState();
  const state = doc as State;
  state.customers ??= [];
  state.customer_consents ??= [];
  state.customer_visits ??= [];
  state.coupons ??= [];
  state.coupon_redemptions ??= [];
  return state;
}

async function hydrateHub(client: PoolClient, state: State) {
  const [customers, consents, visits, coupons, redemptions] = await Promise.all([
    client.query("select id::text, phone_e164, coalesce(display_name,'') as display_name, email, created_store_code, created_at::text, updated_at::text from pos_hub.customer order by created_at"),
    client.query("select id::text, customer_id::text, coalesce(consent_type, case when consented then 'EXPRESS' else 'IMPLIED' end) as consent_type, coalesce(consented_at, recorded_at)::text as consented_at, source, store_code, unsubscribed_at::text, recorded_at::text as created_at from pos_hub.customer_consent order by recorded_at"),
    client.query("select id::text, customer_id::text, store_code, sale_id, shift_id, spend_cents, visited_at::text from pos_hub.customer_visit order by visited_at"),
    client.query("select id::text, coalesce(store_code,'PNYS') as store_code, code, coalesce(label, code) as label, active, definition, created_by, created_at::text, created_at::text as updated_at from pos_hub.coupon order by created_at"),
    client.query("select id::text, coupon_id::text, customer_id::text, store_code, shift_id, sale_id, discount_cents, redeemed_at::text from pos_hub.coupon_redemption order by redeemed_at"),
  ]);
  state.customers = customers.rows;
  state.customer_consents = consents.rows;
  state.customer_visits = visits.rows;
  state.coupons = coupons.rows.map((row) => ({
    id: row.id, store_code: row.store_code, code: row.code, label: row.label, active: row.active,
    discount_type: row.definition?.discount_type === "PERCENT" ? "PERCENT" : "FIXED",
    discount_value: Number(row.definition?.discount_value ?? 0),
    min_spend_cents: Number(row.definition?.min_spend_cents ?? 0),
    max_redemptions_per_customer: Number(row.definition?.max_redemptions_per_customer ?? 1),
    created_by: row.created_by, created_at: row.created_at, updated_at: row.updated_at,
  }));
  state.coupon_redemptions = redemptions.rows;
}

async function projectHub(client: PoolClient, state: State) {
  for (const row of state.customers ?? []) await client.query(
    "insert into pos_hub.customer(id,phone_e164,display_name,email,created_store_code,created_at,updated_at) values($1::uuid,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz) on conflict(id) do update set phone_e164=excluded.phone_e164,display_name=excluded.display_name,email=excluded.email,updated_at=excluded.updated_at",
    [row.id, row.phone_e164, row.display_name, row.email, row.created_store_code, row.created_at, row.updated_at],
  );
  for (const row of state.customer_consents ?? []) await client.query(
    "insert into pos_hub.customer_consent(id,customer_id,channel,consented,store_code,recorded_at,source,consent_type,consented_at,unsubscribed_at) values($1::uuid,$2::uuid,'SMS',$3,$4,$5::timestamptz,$6,$7,$8::timestamptz,$9::timestamptz) on conflict(id) do update set consent_type=excluded.consent_type,consented_at=excluded.consented_at,source=excluded.source,unsubscribed_at=excluded.unsubscribed_at",
    [row.id, row.customer_id, row.unsubscribed_at == null, row.store_code, row.created_at, row.source, row.consent_type, row.consented_at, row.unsubscribed_at],
  );
  for (const row of state.customer_visits ?? []) await client.query(
    "insert into pos_hub.customer_visit(id,customer_id,store_code,sale_id,shift_id,spend_cents,visited_at) values($1::uuid,$2::uuid,$3,$4,$5,$6,$7::timestamptz) on conflict(store_code,sale_id) do update set customer_id=excluded.customer_id,spend_cents=excluded.spend_cents,visited_at=excluded.visited_at",
    [row.id, row.customer_id, row.store_code, row.sale_id, row.shift_id, row.spend_cents, row.visited_at],
  );
  for (const row of state.coupons ?? []) await client.query(
    "insert into pos_hub.coupon(id,code,active,definition,created_by,created_at,store_code,label) values($1::uuid,$2,$3,$4::jsonb,$5,$6::timestamptz,$7,$8) on conflict(id) do update set code=excluded.code,active=excluded.active,definition=excluded.definition,store_code=excluded.store_code,label=excluded.label",
    [row.id, row.code, row.active, JSON.stringify({ discount_type: row.discount_type, discount_value: row.discount_value, min_spend_cents: row.min_spend_cents, max_redemptions_per_customer: row.max_redemptions_per_customer }), row.created_by, row.created_at, row.store_code, row.label],
  );
  for (const row of state.coupon_redemptions ?? []) await client.query(
    "insert into pos_hub.coupon_redemption(id,coupon_id,customer_id,store_code,shift_id,sale_id,discount_cents,redeemed_at) values($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::timestamptz) on conflict(store_code,sale_id,coupon_id) do nothing",
    [row.id, row.coupon_id, row.customer_id, row.store_code, row.shift_id, row.sale_id, row.discount_cents, row.redeemed_at],
  );
}

export function createSupabaseStateDb(connectionString: string, store: StoreCode, schema: StateSchema = "pny_pos"): PosDb {
  const pool = new Pool({
    connectionString,
    max: 3,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  let tail: Promise<void> = Promise.resolve();
  const db: PosDb & { peek(): Promise<State> } = {
    async assertIntegrationOwner(channel) {
      if (schema !== "pnys_pos") {
        return { channel, owner_store_code: store, generation: deploymentGeneration(), cutover_id: "LEGACY" };
      }
      const client = await pool.connect();
      try {
        await client.query("set role pnys_app");
        const result = await client.query(
          "select channel,owner_store_code,generation,cutover_id from pos_hub.integration_owner where channel=$1 and enabled=true",
          [channel],
        );
        const row = result.rows[0];
        if (!row || row.owner_store_code !== store || Number(row.generation) !== deploymentGeneration()) {
          throw new PosError(423, "INTEGRATION_NOT_OWNER", `${channel} is owned by another deployment.`);
        }
        return { channel, owner_store_code: row.owner_store_code, generation: Number(row.generation), cutover_id: row.cutover_id };
      } finally {
        await client.query("reset role").catch(() => undefined);
        client.release();
      }
    },
    async deliveredIntegrationEvents(channel, cutoverId, eventIds) {
      if (schema !== "pnys_pos" || eventIds.length === 0) return new Set<string>();
      const client = await pool.connect();
      try {
        await client.query("set role pnys_app");
        const result = await client.query(
          "select event_id from pos_hub.integration_delivery where channel=$1 and cutover_id=$2 and event_id=any($3::text[])",
          [channel, cutoverId, eventIds],
        );
        return new Set(result.rows.map((row) => String(row.event_id)));
      } finally {
        await client.query("reset role").catch(() => undefined);
        client.release();
      }
    },
    async recordIntegrationDelivery(lease, eventId, receipt = {}) {
      if (schema !== "pnys_pos") return true;
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("set local role pnys_app");
        const owner = await client.query(
          "select 1 from pos_hub.integration_owner where channel=$1 and owner_store_code=$2 and generation=$3 and cutover_id=$4 and enabled=true",
          [lease.channel, store, lease.generation, lease.cutover_id],
        );
        if (owner.rowCount !== 1) throw new PosError(423, "INTEGRATION_NOT_OWNER", `${lease.channel} ownership changed before delivery acknowledgement.`);
        const saved = await client.query(
          "insert into pos_hub.integration_delivery(channel,cutover_id,event_id,owner_store_code,generation,receipt) values($1,$2,$3,$4,$5,$6::jsonb) on conflict(channel,cutover_id,event_id) do nothing returning id",
          [lease.channel, lease.cutover_id, eventId, store, lease.generation, JSON.stringify(receipt)],
        );
        await client.query("commit");
        return saved.rowCount === 1;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async isReady() {
      if (schema !== "pnys_pos") return true;
      const client = await pool.connect();
      try {
        await client.query("set role pnys_app");
        const result = await client.query(
          "select exists(select 1 from pnys_pos.clone_audit where target_store = $1 and reconciled = true) as ready",
          [store],
        );
        return result.rows[0]?.ready === true;
      } finally {
        await client.query("reset role").catch(() => undefined);
        client.release();
      }
    },
    async peek() {
      const client = await pool.connect();
      try {
        if (schema === "pnys_pos") await client.query("set role pnys_app");
        const loaded = await client.query(`select doc from ${schema}.live_state where store_code = $1`, [store]);
        const state = asState(loaded.rows[0]?.doc);
        if (schema === "pnys_pos") await hydrateHub(client, state);
        return state;
      } finally {
        if (schema === "pnys_pos") await client.query("reset role").catch(() => undefined);
        client.release();
      }
    },
    transaction(fn, options = {}) {
      const run = tail.then(() => runOnce(fn, options.kind ?? "OPERATIONAL"));
      tail = run.then(() => undefined, () => undefined);
      return run;
    },
  };

  async function runOnce<T>(fn: (tx: Tx) => Promise<T>, kind: TransactionKind): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        if (schema === "pnys_pos") {
          await client.query("set local role pnys_app");
          await client.query(
            "select set_config('app.store_code',$1,true),set_config('app.generation',$2,true),set_config('app.mutation_kind',$3,true),set_config('app.preview_test',$4,true)",
            [store, String(deploymentGeneration()), kind, process.env.VERCEL_ENV === "preview" && process.env.TEST_STORE === "1" ? "true" : "false"],
          );
        }
        // Serialize mutations across serverless instances. Idempotency records, stock,
        // sales, and refills commit together under this store-row lock.
        const loaded = await client.query(`select version, doc from ${schema}.live_state where store_code = $1 for update`, [store]);
        const version = Number(loaded.rows[0]?.version ?? 0);
        const snapshot = structuredClone(asState(loaded.rows[0]?.doc)) as State;
        if (schema === "pnys_pos") await hydrateHub(client, snapshot);
        const original = structuredClone(snapshot) as State;
        const before = JSON.stringify(snapshot);
        const result = await fn({ state: snapshot });
        const after = JSON.stringify(snapshot);
        if (after === before) {
          await client.query("commit");
          return result;
        }
        if (schema === "pnys_pos") {
          const runtime = await client.query("select write_mode,generation from pos_hub.store_runtime where store_code=$1", [store]);
          const row = runtime.rows[0];
          const frozenPreviewAuth = row?.write_mode === "FROZEN"
            && kind === "AUTH_SESSION"
            && store === "PNYS"
            && process.env.VERCEL_ENV === "preview"
            && process.env.TEST_STORE === "1"
            && isAuthSessionOnlyChange(original, snapshot);
          if (!row || (row.write_mode !== "ACTIVE" && !frozenPreviewAuth)) {
            throw new PosError(423, "STORE_WRITE_BLOCKED", "Store frozen");
          }
          if (Number(row.generation) !== deploymentGeneration()) throw new PosError(423, "STALE_DEPLOYMENT", "This deployment generation cannot write.");
          if (maintenanceMode()) throw new PosError(423, "MAINTENANCE_MODE", "TEMPORARILY PAUSED — DO NOT TRADE");
        }
        if (schema === "pnys_pos") await projectHub(client, snapshot);
        const saved = await client.query(
          `update ${schema}.live_state set doc = $1::jsonb, version = version + 1, updated_at = now() where store_code = $2 and version = $3 returning version`,
          [after, store, version],
        );
        if (saved.rowCount !== 1) throw new StaleRevision();
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        if (!(error instanceof StaleRevision) || attempt === 2) throw error;
      } finally {
        client.release();
      }
    }
    throw new StaleRevision();
  }

  return db;
}
