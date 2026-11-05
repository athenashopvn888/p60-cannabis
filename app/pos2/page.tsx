import type { Metadata } from "next";
import PosApp from "../pos/PosApp";
import { PNY02_STORE } from "../lib/pny-pos/storeProfile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PNY2 staff till",
  robots: { index: false, follow: false, nocache: true },
};

export default function Pos2Page() {
  return (
    <PosApp
      apiBase={PNY02_STORE.apiBase}
      tillHref={PNY02_STORE.tillPath}
      label={PNY02_STORE.label}
      menuUrl={PNY02_STORE.menuUrl}
    />
  );
}
