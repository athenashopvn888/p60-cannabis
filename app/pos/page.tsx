import type { Metadata } from "next";
import PosApp from "./PosApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff till",
  robots: { index: false, follow: false, nocache: true },
};

export default function PosPage() {
  return <PosApp />;
}
