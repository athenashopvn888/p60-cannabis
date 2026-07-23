import type { Metadata } from "next";
import StaffPhotoApp from "./StaffPhotoApp";

export const metadata: Metadata = {
  title: "Staff Photo",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function StaffPhotoPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const requested = (await searchParams).preview;
  const previewMode = process.env.NODE_ENV === "development" && (requested === "login" || requested === "dashboard") ? requested : null;
  return <StaffPhotoApp previewMode={previewMode} />;
}
