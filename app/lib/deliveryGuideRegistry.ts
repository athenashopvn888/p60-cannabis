import deliveryGuideCopy from "./deliveryGuideCopy.json";

export type DeliveryGuideFaq = { question: string; answer: string };
export type DeliveryGuideEntry = {
  slug: string;
  lane: "native_cig" | "nic_vape";
  name: string;
  title: string;
  description: string;
  h1: string;
  body_md: string;
  faq_items: DeliveryGuideFaq[];
  main_button: string;
  second_button: string;
  category_path: string;
  action_path: string;
};

export const DELIVERY_GUIDE_STORE = { domain: "https://www.p60cannabis.com" } as const;
export const DELIVERY_GUIDE_REGISTRY = deliveryGuideCopy as DeliveryGuideEntry[];
export const getDeliveryGuide = (slug: string) => DELIVERY_GUIDE_REGISTRY.find((guide) => guide.slug === slug);
