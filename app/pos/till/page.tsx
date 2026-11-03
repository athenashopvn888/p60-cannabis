import type { Metadata } from "next";
import TillApp from "./TillApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Till totals",
  robots: { index: false, follow: false, nocache: true },
};

export default function TillPage() {
  return <TillApp />;
}
