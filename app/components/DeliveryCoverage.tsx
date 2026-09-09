import Link from "next/link";

const areas = ["York", "Toronto", "North York", "Etobicoke", "Vaughan", "Mississauga", "Brampton"];

export function DeliveryCoverage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": "https://www.p60cannabis.com/weed-dispensary-york#delivery-service",
    name: "P60 Cannabis delivery coverage",
    serviceType: "Cannabis delivery information",
    provider: { "@id": "https://www.p60cannabis.com/#store" },
    url: "https://www.p60cannabis.com/weed-delivery-york",
    areaServed: [
      { "@type": "GeoCircle", geoMidpoint: { "@type": "GeoCoordinates", latitude: 43.700495, longitude: -79.5177122 }, geoRadius: 50000 },
      ...areas.map((name) => ({ "@type": "City", name })),
    ],
  };

  return <section style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 64px" }}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <h2>Delivery Coverage from P60 Cannabis</h2>
    <p>Delivery is coordinated from the York store and confirmed when an order is placed. A practical planning area is approximately 50 km from Weston Road, including York, Toronto, North York, Etobicoke, Vaughan, Mississauga and Brampton.</p>
    <p>Longer trips toward Barrie, Kitchener or Hamilton may be available when a driver is already positioned in that area. Extended coverage is not guaranteed, so confirm the destination and timing with the dispatcher before relying on delivery.</p>
    <p><Link href="/weed-delivery-york">Check current York delivery information</Link></p>
  </section>;
}
