import type { Metadata } from "next";
import OwnerApp from "./OwnerApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PNY01 owner records",
  robots: { index: false, follow: false, nocache: true },
};

export default function OwnerPage() {
  return <OwnerApp />;
}
