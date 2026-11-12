import { json, kitchenToken, toResponse } from "@/app/lib/pny-pos/http";
import { formatMoney } from "@/app/lib/pny-pos/money";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  try {
    const service = await getService();
    const stock = await service.kitchenStock(await kitchenToken());
    if (new URL(request.url).searchParams.get("format") !== "csv") return json(stock);
    const header = ["SKU", "Name", "Size", "Category", "Shelf price", "On hand", "THC", "Counted"];
    const lines = stock.rows.map((row) => [
      row.sku,
      row.name,
      row.size,
      row.category,
      formatMoney(row.price_cents),
      row.on_hand,
      row.thc ? "Y" : "N",
      "",
    ].map(csvCell).join(","));
    return new Response([header.join(","), ...lines].join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=pny01-kitchen-stock.csv",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return toResponse(error);
  }
}
