import type { Metadata } from "next";
import AdminApp from "./AdminApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Till admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return <AdminApp />;
}
