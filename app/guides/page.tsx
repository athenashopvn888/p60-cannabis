import type { Metadata } from "next";
import Link from "next/link";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { getGuidesByLane, type GuideLane } from "../lib/guideRegistry";
import styles from "./guides-index.module.css";

const SITE = "https://p60cannabis.com";
const CANONICAL = `${SITE}/guides`;

export const metadata: Metadata = {
  title: { absolute: "Guides | P60 Cannabis" },
  description: "Browse P60 Cannabis name guides for strains, Native Cigarettes, Nicotine Vape, and THC Vape, then check today's menu. Adults 19+.",
  alternates: { canonical: CANONICAL },
  robots: { index: true, follow: true },
  openGraph: { url: CANONICAL },
};

const laneCtas: Record<GuideLane, { href: string; label: string }> = {
  strain: { href: "/#menu", label: "View flower tiers" },
  native_cig: { href: "/items/cigarettes", label: "View today's cigarette board" },
  nic_vape: { href: "/items/vapes", label: "View today's nicotine vape board" },
  thc_vape: { href: "/items/vape-disposables", label: "View today's THC vape board" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebPage", "@id": `${CANONICAL}#webpage`, url: CANONICAL, name: "Guides | P60 Cannabis", isPartOf: { "@id": `${SITE}/#website` } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Guides", item: CANONICAL },
    ] },
  ],
};

export default function GuidesPage() {
  const groups = getGuidesByLane().filter((group) => group.guides.length > 0);
  return <main className={styles.main}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <Navbar />
    <article>
      <header className={styles.hero}><div className={styles.shell}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span>Guides</span></nav>
        <span className={styles.eyebrow}>P60 name guides</span><h1>Guides | P60 Cannabis</h1>
        <p>Use this directory to identify a name, confirm its shelf, and continue to today&apos;s menu. Selection rotates, so each guide points back to a current category instead of promising availability. Adults 19+ only.</p>
        <div className={styles.actions}><Link className={styles.primary} href="/#menu">Open today&apos;s menu</Link><Link className={styles.secondary} href="/resources">Browse resources</Link></div>
      </div></header>
      <section className={`${styles.shell} ${styles.intro}`}><h2>Find the right P60 shelf</h2><p>Strain names, Native Cigarettes, Nicotine Vape, and THC Vape stay in separate lanes. Open a name guide for context, then use its current menu path before heading to Weston Road.</p></section>
      <div className={`${styles.shell} ${styles.groups}`}>{groups.map((group) => <section key={group.lane} className={styles.group} aria-labelledby={`${group.lane}-guides`}>
        <div className={styles.groupHeader}><div><span>{group.guides.length} name guides</span><h2 id={`${group.lane}-guides`}>{group.label}</h2></div><Link href={laneCtas[group.lane].href}>{laneCtas[group.lane].label}</Link></div>
        <div className={styles.grid}>{group.guides.map((guide) => <Link key={guide.slug} href={`/guides/${guide.slug}`} className={styles.card}><strong>{guide.name}</strong><span>Read {group.label} guide</span></Link>)}</div>
      </section>)}</div>
      <aside className={`${styles.shell} ${styles.finalCta}`}><h2>Check today&apos;s board</h2><p>Use the menu for current published listings, or plan the Weston Road stop with the visit page.</p><div className={styles.actions}><Link className={styles.primary} href="/#menu">View the menu</Link><Link className={styles.secondary} href="/visit">Plan your visit</Link></div></aside>
    </article><Footer />
  </main>;
}
