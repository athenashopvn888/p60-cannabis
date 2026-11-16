import type { Metadata } from "next";
import PosApp from "../../pos/PosApp";
import { ACD01_STORE } from "../../lib/pny-pos/storeProfile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ACD01 staff till", robots: { index: false, follow: false, nocache: true } };

export default function Acd01PosPage() {
  return <PosApp apiBase={ACD01_STORE.apiBase} tillHref={ACD01_STORE.tillPath} label="ACD01" storeCode="ACD01" menuUrl={ACD01_STORE.menuUrl} />;
}
