import PostCloseClosing, { type PostCloseView } from "../PostCloseClosing";

export const dynamic = "force-dynamic";

const sample: PostCloseView = {
  shift: { staff_name: "Demo Staff", pos_id: "DEMO1", sccx_shift_id: "PNYS-1115-A", started_at: "2026-11-15T01:00:00.000Z", ended_at: "2026-11-15T09:00:00.000Z" },
  post_close: {
    expires_at: "2026-11-15T11:00:00.000Z", version: 2, reclosed: true,
    closing: { sales_total_cents: 55440, cash_sales_cents: 49000, debit_sales_cents: 6440, cash_on_hand_cents: 4000, deposited_cents: 45000, final_deposit_cents: 45000, float_cents: 4000, shortage_cents: 500, overage_cents: 0, close_label: "PNYS-1115", reclosed_at: "2026-11-15T09:18:00.000Z", closing_lines: [{ sku: "240", name: "Preview Product", left: 3, shortage_cents: 500 }, { sku: "261-14g", name: "Daydream Diesel", left: 2 }, { sku: "721", name: "Backwoods", left: 18 }] },
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  const screen = (await searchParams).screen;
  const selected = screen === "warning" || screen === "report" ? screen : "summary";
  return <PostCloseClosing view={sample} previewScreen={selected}/>;
}
