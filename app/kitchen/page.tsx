import type { Metadata } from "next";
import KitchenApp from "./KitchenApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kitchen",
  robots: { index: false, follow: false, nocache: true },
};

export default function KitchenPage() {
  return <KitchenApp />;
}
