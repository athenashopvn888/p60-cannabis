import type { Metadata } from "next";
import DeliveryCatalog from "./DeliveryCatalog";
import P60WebChat from "./P60WebChat";
import menu from "./delivery-menu.json";

export const metadata: Metadata = {
  title: { absolute: "Weed Delivery York | P60 Cannabis" },
  description: "Browse P60 Cannabis delivery for York, North York, Vaughan, and Brampton, available daily from 10:00 a.m. to 10:00 p.m.",
  alternates: {
    canonical: "https://www.p60cannabis.com/weed-delivery-york",
  },
};

export default function DeliveryPage() {
  const webPageData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://www.p60cannabis.com/weed-delivery-york#webpage",
    url: "https://www.p60cannabis.com/weed-delivery-york",
    name: "Weed Delivery York | P60 Cannabis",
    about: { "@id": "https://www.p60cannabis.com/#store" },
    breadcrumb: { "@id": "https://www.p60cannabis.com/weed-delivery-york#breadcrumb" },
  };
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": "https://www.p60cannabis.com/weed-delivery-york#breadcrumb",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.p60cannabis.com/" },
      { "@type": "ListItem", position: 2, name: "Weed Delivery York", item: "https://www.p60cannabis.com/weed-delivery-york" },
    ],
  };
  const collectionPageData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "P60 Cannabis Weed Delivery in York",
    description: "Current Weed Delivery menu for P60 Cannabis in York.",
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
    "@id": "https://www.p60cannabis.com/weed-delivery-york#service",
    name: "P60 Cannabis Weed Delivery",
    serviceType: "Weed delivery",
    url: "https://www.p60cannabis.com/weed-delivery-york",
    provider: {
      "@id": "https://www.p60cannabis.com/#store",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify([webPageData, breadcrumbData, collectionPageData, deliveryServiceData]).replace(/</g, "\\u003c") }}
      />
      <DeliveryCatalog />
      <P60WebChat />
    </>
  );
}
