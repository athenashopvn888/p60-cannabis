import type { Metadata } from "next";
import HomePage from "./HomePage";
import { HOME_DOC_TITLE } from "./lib/homeDelivery";

const HOME_DESCRIPTION =
  "Visit P60 Cannabis at 1938 Weston Rd, York, ON M9N 1W2. Open 24 hours. Find store information, cannabis categories and delivery details.";
const HOME_SHARE_IMAGE = "https://www.p60cannabis.com/wp-content/uploads/2026/04/46Oi5.jpg";

export const metadata: Metadata = {
  title: { absolute: HOME_DOC_TITLE },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://www.p60cannabis.com/",
    siteName: "P60 Cannabis",
    title: { absolute: HOME_DOC_TITLE },
    description: HOME_DESCRIPTION,
    images: [
      {
        url: HOME_SHARE_IMAGE,
        width: 1200,
        height: 630,
        alt: "P60 Cannabis — Premium Cannabis Dispensary York",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: { absolute: HOME_DOC_TITLE },
    description: HOME_DESCRIPTION,
    images: [HOME_SHARE_IMAGE],
  },
};

export default function Page() {
  return <HomePage />;
}
