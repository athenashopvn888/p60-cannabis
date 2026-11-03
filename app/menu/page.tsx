import type { Metadata } from "next";
import MenuApp from "./MenuApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "QR order",
  robots: { index: false, follow: false, nocache: true },
};

export default function MenuPage() {
  return <MenuApp />;
}
