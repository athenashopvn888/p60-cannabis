import { headers } from "next/headers";
import { notFound } from "next/navigation";

const rows = [
  ["188", "PINK ANIMAL 1G IND PRE-ROLL", 58, 54, -4, -2000],
  ["189", "AMNESIA HAZE 1G SAT PRE-ROLL", 47, 48, 1, 500],
  ["240", "GRABBA", 60, 59, -1, -500],
  ["261-5g", "DAYDREAM DIESEL 5g", 7, 9, 2, 4000],
  ["261-14g", "DAYDREAM DIESEL 14g", 2, 1, -1, -4500],
  ["345-5g", "GAS FACE 5g", 7, 5, -2, -6000],
  ["350-3g", "PURPLE HAZE 3g", 6, 0, -6, -12000],
  ["373-5g", "CANDY KRUSH (S) 5g", 10, 20, 10, 25000],
  ["502-3g", "ALIEN SMACK PINK 3g", 2, 3, 1, 4000],
  ["720", "LIGHTER BIG", 8, 7, -1, -300],
  ["868", "NEW AFGHAN HASH", 2, 1, -1, -2500],
  ["1000", "BB LIGHTS CARTON", 47, 45, -2, -500],
  ["1002", "BB FULL CARTON", 44, 42, -2, -500],
  ["1005", "CANADIAN LIGHTS", 23, 19, -4, -1000],
  ["1006", "CANADIAN FULL", 25, 27, 2, 500],
  ["1014", "CANADIAN CLASSICS ORIGINAL", 24, 25, 1, 250],
  ["1015", "CANADIAN CLASSICS SILVER", 29, 27, -2, -500],
  ["1016", "ROLLED GOLD LIGHTS", 64, 62, -2, -500],
] as const;

const money = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Math.abs(cents) / 100);
const signedMoney = (cents: number) => `${cents >= 0 ? "+" : "-"}${money(cents)}`;

export default async function CloseParityPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  if (host === "pny1-pos.vercel.app" || !host.endsWith("-athenashopvn888-2439s-projects.vercel.app")) notFound();
  const { view } = await searchParams;
  const email = view === "email";
  return <main style={{ maxWidth: email ? 860 : 430, margin: "0 auto", padding: 16, fontFamily: "Arial, sans-serif", color: "#111827", background: "#f8fafc" }}>
    <header style={{ background: "#111827", color: "white", padding: 16, borderRadius: 12 }}><strong>PNYS · Randy</strong><span style={{ float: "right" }}>{email ? "Closing email preview" : "Stock differences · Step 4"}</span></header>
    {email ? <><h1>PNYS CLOSING TILL - Randy</h1><p><strong>Shift:</strong> 6e72d6a9-40dd-469a-917b-cbc9724b03af</p><p>Sales: $1,381.50 · Deposits: $1,435.00 · Starting float: $29.00 confirmed · Closing float: $52.00</p></> : <><h1>Stock differences</h1><p>Review every stock difference before Confirm &amp; Post.</p></>}
    <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
      <div style={{ padding: 12, borderRadius: 10, background: "#fee2e2", color: "#b91c1c" }}><strong>TOTAL SHORT</strong><br/>-28 · -$308.00</div>
      <div style={{ padding: 12, borderRadius: 10, background: "#dcfce7", color: "#15803d" }}><strong>TOTAL EXTRA</strong><br/>+17 · +$342.50</div>
      <div style={{ gridColumn: "1 / -1", padding: 12, borderRadius: 10, background: "#dcfce7", color: "#15803d" }}><strong>NET STOCK: OVER +$34.50</strong></div>
    </section>
    <div style={{ overflowX: "auto", background: "white", borderRadius: 10 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{["SKU", "Item", "Expected", "Counted", "Qty +/-", "$ +/-"].map((label) => <th key={label} style={{ padding: 8, textAlign: "left", borderBottom: "2px solid #cbd5e1" }}>{label}</th>)}</tr></thead><tbody>{rows.map(([sku,name,expected,counted,qty,value]) => <tr key={sku}><td style={{ padding: 8, borderBottom: "1px solid #e2e8f0", fontWeight: 700 }}>{sku}</td><td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>{name}</td><td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>{expected}</td><td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>{counted}</td><td style={{ padding: 8, borderBottom: "1px solid #e2e8f0", color: qty > 0 ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{qty > 0 ? "+" : ""}{qty}</td><td style={{ padding: 8, borderBottom: "1px solid #e2e8f0", color: value > 0 ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{signedMoney(value)}</td></tr>)}</tbody></table></div>
    <section style={{ marginTop: 16, padding: 16, borderRadius: 10, background: "#dcfce7", color: "#15803d", fontSize: 22, fontWeight: 800 }}>FINAL: OVER +$111.00</section>
    {!email ? <button style={{ width: "100%", marginTop: 16, padding: 16, border: 0, borderRadius: 10, background: "#166534", color: "white", fontWeight: 800 }}>Confirm &amp; Post</button> : null}
  </main>;
}
