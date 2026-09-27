"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DeliveryAnnouncement() {
  const pathname = usePathname();
  if (pathname.startsWith("/tv")) return null;

  return (
    <Link className="deliveryAnnouncement" href="/weed-delivery-york">
      WEED DELIVERY IS HERE — CLICK TO EXPLORE
    </Link>
  );
}
