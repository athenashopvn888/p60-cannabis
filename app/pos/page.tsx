import type { Metadata } from "next";
import { lockedStore } from "../lib/pny-pos/singleStore";
import PosApp from "./PosApp";
import MaintenanceScreen from "./MaintenanceScreen";
import { maintenanceMode } from "../lib/pny-pos/controls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff till",
  robots: { index: false, follow: false, nocache: true },
};

export default function PosPage() {
  const store = lockedStore();
  if (store?.code === "PNYS" && maintenanceMode()) return <MaintenanceScreen />;
  if (!store || store.code === "PNY01") return <PosApp />;
  const label = store.code === "PNYS" && process.env.NEXT_PUBLIC_TEST_STORE !== "1" ? "PNY01" : store.label;
  return <PosApp apiBase="/api/pos" tillHref="/pos/till" label={label} storeCode={store.code} menuUrl={store.menuUrl} />;
}
