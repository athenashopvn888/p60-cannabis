import type { Metadata } from "next";
import TillApp from "../../../pos/till/TillApp";
import { ACD01_STORE } from "../../../lib/pny-pos/storeProfile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ACD01 till totals", robots: { index: false, follow: false, nocache: true } };

export default function Acd01TillPage() {
  return <TillApp apiBase={ACD01_STORE.apiBase} homeHref={ACD01_STORE.posPath} />;
}
