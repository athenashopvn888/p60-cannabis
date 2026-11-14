"use client";

import { usePathname } from "next/navigation";

export default function PnysCustomerTestLabel() {
  const pathname = usePathname();
  if (pathname.startsWith("/pos")) return null;
  return <div className="pnys-customer-test-label" data-testid="customer-test-store">TEST STORE</div>;
}
