import { Metadata } from "next";
import { GBPLandingPage } from "@/app/components/GBPLandingPage";

export const metadata: Metadata = {
  title: { absolute: "Weed Dispensary York | P60 Cannabis" },
  description: "P60 Cannabis is located at 1938 Weston Rd, York, ON M9N 1W2. Open 24 hours. Call (289) 217-2763 or view our York store information.",
  alternates: {
    canonical: "https://www.p60cannabis.com/weed-dispensary-york",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Page() {
  return <GBPLandingPage />;
}
