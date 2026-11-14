"use client";

import MenuApp from "../../menu/MenuApp";
import styles from "./mode-proof.module.css";

const allProducts = [
  { sku: "261-14g", name: "Daydream Diesel 14g", price: "$60.00", qty: 3, thc: true },
  { sku: "396-3g", name: "Preview Flower 3g", price: "$20.00", qty: 4, thc: true },
  { sku: "240", name: "Paper Cones", price: "$5.00", qty: 12, thc: false },
  { sku: "721", name: "Backwoods", price: "$20.00", qty: 18, thc: false },
];

export default function ModeProof({ surface, mode }: { surface: "sell" | "closing" | "menu"; mode: "weed" | "no-weed" }) {
  const noWeed = mode === "no-weed";
  const visible = noWeed ? allProducts.filter((row) => !row.thc) : allProducts;
  if (surface === "menu") {
    return <MenuApp label="PNYS" previewMenu={{
      demo: true,
      demo_label: `TEST STORE · ${noWeed ? "NO WEED" : "WEED"}`,
      ordering: true,
      prices_include_tax: false,
      items: visible.map((row) => ({ sku: row.sku, name: row.name, category: "BUDGET", price_cents: Number(row.price.replace(/[^\d]/g, "")), image_url: null, availability: "Available" })),
    }} />;
  }
  const rows = surface === "closing" ? allProducts : visible;
  return <main className={styles.shell} data-testid={`mode-${surface}-${mode}`}>
    <div className={styles.test}>TEST STORE</div>
    <header><div><strong>PNYS</strong><span> · Demo Staff</span></div><strong>{surface === "closing" ? "Closing count" : "Sell"}</strong><span className={noWeed ? styles.off : styles.on}>{noWeed ? "NO WEED" : "WEED"}</span></header>
    <section className={styles.middle}>
      {surface === "closing" ? <div className={styles.notice}>Closing count includes every SKU, including THC stock hidden from sales.</div> : noWeed ? <div className={styles.notice}>THC SKUs are hidden and blocked for this shift.</div> : <div className={styles.notice}>Default WEED mode · all eligible stock is shown.</div>}
      <label htmlFor="proof-search">Search SKU or name</label><input id="proof-search" placeholder="Search products" />
      <div className={styles.products}>{rows.map((row) => <article key={row.sku}><div><strong>{row.sku}</strong><span>{row.name}</span>{row.thc ? <small>THC</small> : <small>NON-THC</small>}</div>{surface === "closing" ? <input aria-label={`Count ${row.sku}`} value={row.qty} readOnly /> : <button type="button">+1 · {row.price}</button>}</article>)}</div>
    </section>
    <footer><button type="button">{surface === "closing" ? "Back" : "Clear"}</button><button type="button" disabled>SCAN</button><button type="button">{surface === "closing" ? "Next" : "Cashout · $0.00"}</button></footer>
  </main>;
}
