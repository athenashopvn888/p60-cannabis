import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lockedStore } from "../../lib/pny-pos/singleStore";
import KitchenApp from "./KitchenApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kitchen",
  robots: { index: false, follow: false, nocache: true },
};

export default function KitchenPage() {
  const store = lockedStore();
  if (store && store.code !== "PNY01") notFound();
  return <KitchenApp />;
}
