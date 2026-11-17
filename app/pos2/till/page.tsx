import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TillApp from "../../pos/till/TillApp";
import { singleStoreSite } from "../../lib/pny-pos/singleStore";
import { PNY02_STORE } from "../../lib/pny-pos/storeProfile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PNY2 till totals",
  robots: { index: false, follow: false, nocache: true },
};

export default function Pos2TillPage() {
  if (singleStoreSite()) notFound();
  return <TillApp apiBase={PNY02_STORE.apiBase} homeHref={PNY02_STORE.posPath} />;
}
