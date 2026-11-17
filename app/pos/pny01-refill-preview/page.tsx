import type { Metadata } from "next";
import PosApp from "../PosApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "PNY01 Test Refill Receiver", robots: { index: false, follow: false, nocache: true } };
export default function Page() { return <PosApp shadowPny01 label="PNY01 TEST" storeCode="PNY01_TEST" tillHref="#" menuUrl="#"/>; }
