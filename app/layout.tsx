import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import AgeGate from "./components/AgeGate";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.p60cannabis.com"),
  title: {
    default: "P60 Cannabis | 24-Hour Cannabis Store in York",
    template: "%s | P60 Cannabis",
  },
  description:
    "Visit P60 Cannabis at 1938 Weston Rd, York, ON M9N 1W2. Open 24 hours. Find store information, cannabis categories and delivery details.",
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://www.p60cannabis.com/",
    siteName: "P60 Cannabis",
    title: "P60 Cannabis | 24-Hour Cannabis Store in York",
    description:
      "Visit P60 Cannabis at 1938 Weston Rd, York, ON M9N 1W2. Open 24 hours. Find store information, cannabis categories and delivery details.",
    images: [
      {
        url: "https://www.p60cannabis.com/wp-content/uploads/2026/04/46Oi5.jpg",
        width: 1200,
        height: 630,
        alt: "P60 Cannabis — Premium Cannabis Dispensary York",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "P60 Cannabis | 24-Hour Cannabis Store in York",
    description: "Visit P60 Cannabis at 1938 Weston Rd, York, ON M9N 1W2. Open 24 hours. Find store information, cannabis categories and delivery details.",
    images: ["https://www.p60cannabis.com/wp-content/uploads/2026/04/46Oi5.jpg"],
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
    canonical: "https://www.p60cannabis.com/",
  },
  verification: {
    // google: "your-google-verification-code",
  },
};

/* ── JSON-LD Structured Data ── */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  "@id": "https://www.p60cannabis.com/#store",
  name: "P60 Cannabis",
  url: "https://www.p60cannabis.com/",
  telephone: "+1-289-217-2763",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1938 Weston Rd",
    addressLocality: "York",
    addressRegion: "ON",
    postalCode: "M9N 1W2",
    addressCountry: "CA",
  },
  openingHoursSpecification: [
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": [
      "https://schema.org/Monday",
      "https://schema.org/Tuesday",
      "https://schema.org/Wednesday",
      "https://schema.org/Thursday",
      "https://schema.org/Friday",
      "https://schema.org/Saturday",
      "https://schema.org/Sunday"
    ],
    "opens": "00:00",
    "closes": "23:59"
  }
],
  sameAs: [
    "https://www.google.com/maps/place/P60+Cannabis/data=!4m2!3m1!1s0x0:0xb4e5e4071fcae428",
  ],
  hasMap: "https://www.google.com/maps/place/P60+Cannabis/data=!4m2!3m1!1s0x0:0xb4e5e4071fcae428",
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
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-KH1SFY3WVW"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-KH1SFY3WVW');
            `
          }}
        />
      </head>
      <body>
        <Link className="deliveryAnnouncement" href="/weed-delivery-york">
          WEED DELIVERY IS HERE — CLICK TO EXPLORE
        </Link>
        {children}
        <AgeGate />
      </body>
    </html>
  );
}
