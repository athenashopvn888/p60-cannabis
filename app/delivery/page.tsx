import type { Metadata } from "next";
import DeliveryContent from "./DeliveryContent";

export const metadata: Metadata = {
  title: "Delivery Coming Soon — P60 Cannabis | York",
  description: "Get notified when P60 Cannabis launches same-day weed delivery across York and surrounding areas.",
  alternates: {
    canonical: "https://p60cannabis.com/delivery",
  },
};

export default function DeliveryPage() {
  return <DeliveryContent />;
}
