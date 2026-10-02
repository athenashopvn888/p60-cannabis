import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "../../components/Footer";
import Navbar from "../../components/Navbar";
import { GUIDE_REGISTRY, getGuide, resolveGuideProduct, type GuideEntry } from "../../lib/guideRegistry";
import { gbpLocation } from "../../lib/gbp-location";
import styles from "./guide.module.css";

type GuidePageProps = { params: Promise<{ slug: string }> };
const SITE = `https://${gbpLocation.domain}`;
const CORRIDOR = "Weston Rd";

const laneCopy = {
  strain: { label: "Strain guide", noun: "cannabis flower name", menuLabel: "flower board", distinction: "This is a flower-name guide, separate from tobacco, nicotine devices, and THC vape formats." },
  native_cig: { label: "Native Cigarettes", noun: "adult tobacco brand name", menuLabel: "Native Cigarettes category", distinction: "This page covers adult tobacco. It is not a cannabis or vape page. Tobacco products are for adults 19+." },
  nic_vape: { label: "Nicotine Vape", noun: "adult nicotine-vape name", menuLabel: "Nicotine Vape category", distinction: "This is the Nicotine Vape shelf, not the THC Vape shelf. Nicotine is addictive and products are for adults 19+." },
  thc_vape: { label: "THC Vape", noun: "cannabis-menu vape name", menuLabel: "THC Vape category", distinction: "This is cannabis-menu information, not a nicotine-device recommendation. Read the current item label because formats differ." },
} as const;

export const dynamicParams = false;
export function generateStaticParams() { return GUIDE_REGISTRY.map((guide) => ({ slug: guide.slug })); }

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  const lane = laneCopy[guide.lane];
  const description = `Adult 19+ guide to ${guide.name}, a ${lane.noun} connected to ${gbpLocation.storeName}'s current ${lane.menuLabel} near ${CORRIDOR}. Selection rotates; check today's menu.`;
  const canonical = `${SITE}/guides/${guide.slug}`;
  return { title: { absolute: guide.title }, description, alternates: { canonical }, robots: { index: true, follow: true }, openGraph: { title: guide.title, description, url: canonical, type: "website" } };
}

function buildFaqs(guide: GuideEntry, hasProductPage: boolean) {
  const lane = laneCopy[guide.lane];
  const availabilityAnswer = hasProductPage
    ? `A matching ${guide.name} listing appears in the current ${gbpLocation.storeName} site snapshot, but the shelf can change. Open the linked listing and today's ${lane.menuLabel} before travelling.`
    : `${guide.name} does not have a matching product-detail page in the current site snapshot. Use today's ${lane.menuLabel}; the category remains the current source when a named item rotates out.`;
  const formatAnswer = guide.lane === "native_cig"
    ? "Brand names can cover more than one pack style. Use the cigarette category and package label to distinguish full, lights, silver, menthol, pack, or carton details."
    : guide.lane === "nic_vape"
      ? "No. Device names, formats, nicotine strengths, and package details can differ. Read the current product and package label. This guide does not estimate device life."
      : guide.lane === "thc_vape"
        ? "No. A name can appear in different cannabis vape formats. The current item page and package label control the format."
        : "The guide connects a flower name to the menu; it does not guarantee one batch, potency, package size, or tier forever.";
  return [
    { question: `Is ${guide.name} on the ${gbpLocation.storeName} menu today?`, answer: availabilityAnswer },
    { question: `Does every ${guide.name} listing use the same format?`, answer: formatAnswer },
    { question: `Where should I check before visiting for ${guide.name}?`, answer: `Open the linked item when available, then check today's ${lane.menuLabel}. Use the store page for directions to ${gbpLocation.address}.` },
    { question: `Who can shop this ${lane.label} category?`, answer: `${gbpLocation.storeName} serves adults 19+. Bring valid government-issued photo ID. This guide is informational and does not reserve an item.` },
  ];
}

export default async function GuidePage({ params }: GuidePageProps) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const lane = laneCopy[guide.lane];
  const product = resolveGuideProduct(guide);
  const productHref = product ? `${guide.lane === "strain" ? "/flower" : "/item"}/${product.slug}` : undefined;
  const related = guide.relatedSlugs.map(getGuide).filter((entry): entry is GuideEntry => Boolean(entry));
  const faqs = buildFaqs(guide, Boolean(productHref));
  const canonical = `${SITE}/guides/${guide.slug}`;
  const categoryLabel = guide.preferredCategoryPath.replace("/items/", "").replace(/^\//, "").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const jsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": `${canonical}#webpage`, url: canonical, name: guide.title, description: `${gbpLocation.storeName} guide to ${guide.name} and today's ${lane.menuLabel}.`, isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website` } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: categoryLabel, item: `${SITE}${guide.preferredCategoryPath}` },
      { "@type": "ListItem", position: 3, name: guide.name, item: canonical },
    ] },
    { "@type": "FAQPage", mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) },
  ] };

  return <main className={styles.main}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <Navbar />
    <article className={styles.article}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href={guide.preferredCategoryPath}>{categoryLabel}</Link><span>/</span><span>{guide.name}</span></nav>
      <header className={styles.hero}>
        <span className={styles.lane}>{lane.label}</span><h1>{guide.title}</h1>
        <p className={styles.lede}>A practical adult 19+ name guide for {gbpLocation.storeName} near {CORRIDOR}. Identify the correct menu lane, compare nearby names, and move to today&apos;s board without treating an older listing as a stock promise.</p>
        <div className={styles.actions}><Link className={styles.primary} href={productHref ?? guide.preferredCategoryPath}>{productHref ? `Open the ${guide.name} menu listing` : "Check today’s category board"}</Link><Link className={styles.secondary} href={guide.preferredCategoryPath}>Browse {categoryLabel}</Link></div>
      </header>
      <section className={styles.tldr}><h2>The short version</h2><ul>
        <li><strong>{guide.name}</strong> is treated here as a {lane.noun}, with the public lane labelled {lane.label}.</li><li>{lane.distinction}</li><li>Selection rotates. Use the current item or category page as today&apos;s board and bring valid government photo ID showing 19+.</li>
      </ul></section>
      <section className={styles.section}><h2>What we show today for {guide.name}</h2>
        <p>This guide is connected to the stock-gated PNY01 shiplist and the current site snapshot. That connection is deliberately narrower than an availability guarantee. Menu files help place a name on the correct shelf, but counter stock can rotate after a page is built. Prices, package options, exact variants, and quantities belong on the current menu listing, not in this evergreen guide.</p>
        {productHref ? <p>A matching menu entry appears in the current snapshot: <Link href={productHref}>{product?.name}</Link>. Open it for published item details, then return to the <Link href={guide.preferredCategoryPath}>{categoryLabel} board</Link>. A live link is a navigation aid, not a reservation or shelf guarantee.</p> : <p>There is no matching product-detail page in the current snapshot, so this guide points to the <Link href={guide.preferredCategoryPath}>{categoryLabel} board</Link> instead of inventing a product URL. Check today&apos;s category or ask the counter when this exact name matters.</p>}
      </section>
      <section className={styles.section}><h2>How {guide.name} appears on our menu</h2>
        <p>{gbpLocation.storeName} organizes the menu by shopping lane. The stable parent path is <Link href={guide.preferredCategoryPath}>{categoryLabel}</Link>. This guide does not rewrite the menu, rename a product, or imply similarly named products are identical. If the exact item rotates out, the parent category is the soft out-of-stock destination.</p>
        <p>Read the current label before choosing. Flower names can attach to a particular tier or format. Native Cigarettes can have full, lights, silver, menthol, pack, or carton variants. Nicotine Vape devices can use model and puff-count labels that distinguish products but do not guarantee duration. THC Vape names can refer to different cannabis formats. The item label is always more specific than the hub name.</p>
        {guide.slug === "ovns-vape" ? <p><strong>OVNS is the listed brand name.</strong> It is not OVI, and this site does not publish an OVI guide.</p> : null}
      </section>
      <section className={styles.section}><h2>Compare {guide.name} with names from the same lane</h2>
        <p>These links stay within the same lane. They do not claim products taste alike, perform alike, or are interchangeable. They provide nearby names to check while browsing {lane.label}. Nicotine Vape and THC Vape remain separate so an adult shopper does not have to infer the substance from a device-shaped product.</p>
        <div className={styles.related}>{related.map((entry) => <Link key={entry.slug} href={`/guides/${entry.slug}`}>{entry.name}<span>{laneCopy[entry.lane].label}</span></Link>)}</div>
      </section>
      <section className={styles.section}><h2>Plan a {CORRIDOR} visit</h2>
        <p>{gbpLocation.storeName} is at {gbpLocation.address}. Use the <Link href={`/${gbpLocation.slug}`}>store page</Link> for current directions and store information. Adults must be 19 or older and should bring government-issued photo ID. If the trip depends on one exact {guide.name} listing, check the linked menu immediately before travelling or call the store.</p>
        <p>This page makes no medical, wellness, effect, or performance claims. It does not promise a price, potency, pack size, flavour, device life, or shelf quantity. Its purpose is to give the name a durable route and connect that route to the relevant menu area while keeping flower, Native Cigarettes, Nicotine Vape, and THC Vape labels distinct.</p>
      </section>
      <section className={styles.section}><h2>Frequently asked questions</h2><div className={styles.faqs}>{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
      <aside className={styles.finalCta}><h2>Check today&apos;s {lane.menuLabel}</h2><p>Start with the exact listing when it exists, or use the stable parent category when {guide.name} has rotated off the board.</p><div className={styles.actions}><Link className={styles.primary} href={productHref ?? guide.preferredCategoryPath}>Open today&apos;s menu path</Link><Link className={styles.secondary} href={`/${gbpLocation.slug}`}>Visit {gbpLocation.storeName}</Link></div></aside>
    </article>
    <Footer />
  </main>;
}



