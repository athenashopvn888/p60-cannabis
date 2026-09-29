import Link from "next/link";
import { HOME_DELIVERY_HREF, HOME_MENU_HREF } from "../lib/homeDelivery";
import styles from "./CohortDeliveryActions.module.css";

export default function CohortDeliveryActions({ variant = "nav" }: { variant?: "nav" | "hero" }) {
  return <div className={`${styles.actions} ${variant === "hero" ? styles.hero : ""}`} aria-label="Choose a store or delivery menu">
    <Link href={HOME_MENU_HREF} className={`${styles.link} ${styles.primary}`}>STORE MENU</Link>
    <Link href={HOME_DELIVERY_HREF} className={`${styles.link} ${styles.secondary}`}>Delivery</Link>
  </div>;
}
