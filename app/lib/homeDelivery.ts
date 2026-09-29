export const HOME_TITLE = "P60 Cannabis - Weed Delivery in York";
export const HOME_MENU_HREF = "/exotic-weed";
export const HOME_DELIVERY_HREF = "/delivery";
export const HOME_DELIVERY_H2 = "Cannabis Delivery in York";

export const HOME_DELIVERY_PARAGRAPHS = [
  "P60 Cannabis keeps its delivery path connected to York. Use the Delivery button for the current ordering page, then follow that page to confirm the address and next step.",
  "This homepage keeps the service context local to York instead of presenting a far-city delivery directory. Store-menu browsing and delivery information remain separate so shoppers can choose the route that fits.",
  "Choose STORE MENU to browse the existing catalog, or choose Delivery for the current local delivery route. Adults 19+ need valid government-issued photo ID, and listed menu information is not a live-stock promise.",
] as const;

export const HOME_DELIVERY_CARDS = [
  { href: "/delivery", title: "Delivery menu", text: "Open the existing York store page for current details." },
  { href: "/weed-delivery-york", title: "Local delivery guide", text: "Open the existing York store page for current details." },
  { href: "/weed-dispensary-york", title: "Local dispensary guide", text: "Open the existing York store page for current details." },
  { href: "/visit", title: "Visit the store", text: "Open the existing York store page for current details." },
  { href: "/hours", title: "Store hours", text: "Open the existing York store page for current details." },
] as const;

export const HOME_DELIVERY_FAQS = [
  { q: "Does P60 Cannabis offer cannabis delivery in York?", a: "P60 Cannabis has an existing delivery route for local requests. Use the Delivery button for current details and address confirmation." },
  { q: "How do I start a York delivery request?", a: "Open the Delivery page, review the current information, and follow its ordering steps. The delivery flow confirms the address and next step." },
  { q: "Where does STORE MENU go?", a: "STORE MENU opens the existing catalog at /exotic-weed." },
  { q: "Do I need photo ID?", a: "Yes. Cannabis service is for adults 19+ with valid government-issued photo ID." },
  { q: "Does the homepage promise live inventory?", a: "No. Use the linked menu or delivery page for current details and confirm a specific item before relying on availability." },
  { q: "Is the delivery information limited to York?", a: "This homepage describes the York delivery context only. The current delivery page confirms whether a specific address can be served." },
] as const;
