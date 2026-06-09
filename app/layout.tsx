import type { Metadata } from "next";
import "./globals.css";
import AgeGate from "./components/AgeGate";

export const metadata: Metadata = {
  metadataBase: new URL("https://p60cannabis.com"),
  title: {
    default: "P60 Cannabis — Premium Cannabis Dispensary, York",
    template: "%s | P60 Cannabis",
  },
  description:
    "Shop 200+ premium cannabis strains at P60 Cannabis. Exotic, Premium, AAA+, AA & Budget flower from $3/g. York's uplifting dispensary at 1938 Weston Rd. Open Daily: 10:00 AM - 03:00 AM.",
  keywords: [
    "cannabis dispensary York",
    "weed store York",
    "exotic flower York",
    "premium cannabis",
    "P60 Cannabis",
    "cheap weed York",
    "dispensary near me",
    "THC flower",
    "indica sativa hybrid",
    "edibles York",
    "vapes",
    "pre-rolls",
    "native cigarettes York",
    "weed store Mississauga",
  ],
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://p60cannabis.com",
    siteName: "P60 Cannabis",
    title: "P60 Cannabis — Premium York Cannabis Dispensary",
    description:
      "200+ strains from $3/g. Exotic to Budget. York's uplifting dispensary at 1938 Weston Rd. Open Daily: 10:00 AM - 03:00 AM.",
    images: [
      {
        url: "https://p60cannabis.com/wp-content/uploads/2026/04/46Oi5.jpg",
        width: 1200,
        height: 630,
        alt: "P60 Cannabis — Premium Cannabis Dispensary York",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "P60 Cannabis — York's Uplifting Dispensary",
    description: "200+ strains from $3/g. Open Daily: 10:00 AM - 03:00 AM at 1938 Weston Rd, York.",
    images: ["https://p60cannabis.com/wp-content/uploads/2026/04/46Oi5.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://p60cannabis.com",
  },
  verification: {
    // google: "your-google-verification-code",
  },
};

/* ── JSON-LD Structured Data ── */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  additionalType: "https://schema.org/Store",
  "@id": "https://p60cannabis.com",
  name: "P60 Cannabis",
  description: "Cannabis dispensary at 1938 Weston Rd in York, ON. Shop exotic, premium, AAA+, AA, and budget flower tiers plus edibles, prerolls, and vapes. Open Daily: 10:00 AM - 03:00 AM.",
  url: "https://p60cannabis.com",
  telephone: "+14375222802",
  image: "https://p60cannabis.com/wp-content/uploads/2026/04/7Clmh.jpg",
  priceRange: "$3 - $12/g",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1938 Weston Rd",
    addressLocality: "York",
    addressRegion: "ON",
    postalCode: "M9N 1W2",
    addressCountry: "CA",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 43.7004400,
    longitude: -79.5177900,
  },
  openingHoursSpecification: [
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    ],
    "opens": "10:00",
    "closes": "03:00"
  }
],
  sameAs: [
    "https://p60cannabis.com/",
    "https://p60cannabis.com/",
  ],
  hasMap: "https://p60cannabis.com/",
  areaServed: {
    "@type": "City",
    name: "York",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5.0",
    reviewCount: "15",
    bestRating: "5",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="geo.region" content="CA-ON" />
        <meta name="geo.placename" content="York" />
        <meta name="geo.position" content="43.7004400;-79.5177900" />
        <meta name="ICBM" content="43.7004400, -79.5177900" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <AgeGate />
      </body>
    </html>
  );
}
