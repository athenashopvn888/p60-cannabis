import { Metadata } from "next";
import { GBPLandingPage } from "@/app/components/GBPLandingPage";
import { gbpLocation } from "@/app/lib/gbp-location";

export const metadata: Metadata = {
  title: "Weed Dispensary in York",
  description: gbpLocation.metaDescription,
  alternates: {
    canonical: `https://${gbpLocation.domain}/${gbpLocation.slug}`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Page() {
  return <GBPLandingPage />;
}
