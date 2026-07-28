import type { Metadata } from "next";
import DeliveryCatalog from "./DeliveryCatalog";
import P60WebChat from "./P60WebChat";
import menu from "./delivery-menu.json";

export const metadata: Metadata = {
  title: { absolute: "Cannabis Delivery York & North York | P60 Cannabis" },
  description: "Browse P60 Cannabis delivery for York, North York, Vaughan, and Brampton, available daily from 10:00 a.m. to 10:00 p.m.",
  alternates: {
    canonical: "https://www.p60cannabis.com/delivery",
  },
};

export default function DeliveryPage() {
  const collectionPageData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "P60 Cannabis York Delivery Menu",
    description: "Current flower delivery menu for P60 Cannabis in York.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: menu.products.length,
      itemListElement: menu.products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.name,
      })),
    },
  };
  const deliveryServiceData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": "https://www.p60cannabis.com/delivery#service",
    name: "P60 Cannabis Delivery",
    serviceType: "Cannabis delivery",
    url: "https://www.p60cannabis.com/delivery",
    provider: {
      "@type": "Store",
      "@id": "https://www.p60cannabis.com",
      name: "P60 Cannabis",
    },
    areaServed: ["York", "North York", "Vaughan", "Brampton"].map((name) => ({
      "@type": "City",
      name,
    })),
    hoursAvailable: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "10:00",
      closes: "22:00",
    },
    offers: {
      "@type": "Offer",
      name: "P60 Cannabis delivery fee",
      price: "10.00",
      priceCurrency: "CAD",
      eligibleTransactionVolume: {
        "@type": "PriceSpecification",
        name: "Product minimum",
        minPrice: "60.00",
        priceCurrency: "CAD",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([collectionPageData, deliveryServiceData]).replace(/</g, "\\u003c") }}
      />
      <DeliveryCatalog />
      <P60WebChat />
    </>
  );
}
