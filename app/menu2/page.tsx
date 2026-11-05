import type { Metadata } from "next";
import MenuApp from "../menu/MenuApp";
import { PNY02_STORE } from "../lib/pny-pos/storeProfile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PNY2 QR order",
  robots: { index: false, follow: false, nocache: true },
};

export default function Menu2Page() {
  return <MenuApp menuApi={PNY02_STORE.menuApi} label={PNY02_STORE.label} />;
}
