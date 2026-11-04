import type { Metadata } from "next";
import CountReview from "./CountReview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Count review",
  robots: { index: false, follow: false, nocache: true },
};

export default function CountReviewPage() {
  return <CountReview />;
}
