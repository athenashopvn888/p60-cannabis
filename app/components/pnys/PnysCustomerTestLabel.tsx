"use client";

import { usePathname } from "next/navigation";

export default function PnysCustomerTestLabel() {
  const pathname = usePathname();
  if (pathname.startsWith("/pos")) return null;
  if (process.env.NEXT_PUBLIC_SHOW_TEST_BADGE !== "1") return null;
  return <div className="pnys-customer-test-label" data-testid="customer-test-store">TEST STORE</div>;
}
