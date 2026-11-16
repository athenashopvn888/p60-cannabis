import type { Metadata } from "next";
import { lockedStore } from "../lib/pny-pos/singleStore";
import MenuApp from "./MenuApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QR order",
  robots: { index: false, follow: false, nocache: true },
};

export default function MenuPage() {
  const store = lockedStore();
  if (!store || store.code === "PNY01") return <MenuApp />;
  return <MenuApp menuApi="/api/menu" label={store.label} />;
}
