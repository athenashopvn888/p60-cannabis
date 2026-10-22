import { FLEET_ARTICLES_PATH } from "./config.ts";

/** Paths revalidated when a content bundle is published. */
export const FLEET_AFFECTED_PATHS = [
  "/",
  "/contact",
  "/visit",
  "/hours",
  "/faq",
  "/tv",
  "/tv2",
  "/exotic-weed",
  "/premium-weed",
  "/aaa-weed",
  "/aa-weed",
  "/budget-weed",
  "/items/vapes",
  "/items/edibles",
  "/items/concentrates",
  "/items/prerolls",
  "/items/add-ons",
  "/items/magic",
  "/items/cigarettes",
  "/cigarettes",
  "/delivery",
  "/guides",
  "/resources",
  FLEET_ARTICLES_PATH,
] as const;

/** Dynamic article pages. Passed to revalidatePath with type "page". */
export const FLEET_DYNAMIC_PATHS = ["/articles/[slug]"] as const;
