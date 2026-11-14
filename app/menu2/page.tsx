import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MenuApp from "../menu/MenuApp";
import { singleStoreSite } from "../lib/pny-pos/singleStore";
import { PNY02_STORE } from "../lib/pny-pos/storeProfile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PNY2 QR order",
  robots: { index: false, follow: false, nocache: true },
};

export default function Menu2Page() {
  if (singleStoreSite()) notFound();
  return <MenuApp menuApi={PNY02_STORE.menuApi} label={PNY02_STORE.label} />;
}
