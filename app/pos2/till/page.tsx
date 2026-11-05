import type { Metadata } from "next";
import TillApp from "../../pos/till/TillApp";
import { PNY02_STORE } from "../../lib/pny-pos/storeProfile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PNY2 till totals",
  robots: { index: false, follow: false, nocache: true },
};

export default function Pos2TillPage() {
  return <TillApp apiBase={PNY02_STORE.apiBase} homeHref={PNY02_STORE.posPath} />;
}
