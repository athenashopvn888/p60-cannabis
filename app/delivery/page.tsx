import type { Metadata } from "next";
import DeliveryCatalog from "./DeliveryCatalog";
import P60WebChat from "./P60WebChat";
import menu from "./delivery-menu.json";

export const metadata: Metadata = {
  title: "Delivery Menu — P60 Cannabis | York",
  description: "Browse the current P60 Cannabis flower delivery menu and contact the P60 dispatcher through private Web Chat.",
  alternates: {
    canonical: "https://www.p60cannabis.com/delivery",
  },
};

export default function DeliveryPage() {
  const structuredData = {
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <DeliveryCatalog />
      <P60WebChat />
    </>
  );
}
