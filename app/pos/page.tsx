import type { Metadata } from "next";
import { lockedStore } from "../lib/pny-pos/singleStore";
import PosApp from "./PosApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff till",
  robots: { index: false, follow: false, nocache: true },
};

export default function PosPage() {
  const store = lockedStore();
  if (!store || store.code === "PNY01") return <PosApp />;
  return <PosApp apiBase="/api/pos" tillHref="/pos/till" label={store.label} storeCode={store.code} menuUrl={store.menuUrl} />;
}
