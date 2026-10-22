import { readEmergencyCoded } from "./emergency.ts";
import { articleBodyUrl, articlesIndexUrl, FLEET_ARTICLES_PATH, FLEET_BLOCKED_PHONES, FLEET_ORIGIN, FLEET_STORE_NAME } from "./config.ts";
import { markdownToHtml, sanitizeArticleHtml } from "./sanitize.ts";
import { FLEET_CONTENT_TAG, FLEET_MAX_BUNDLE_BYTES } from "./types.ts";

export type ArticleFaq = { question: string; answer: string };

export type FleetArticle = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  publishedAt: string;
  heroImage: string;
  alt: string;
  html: string;
  faqs: ArticleFaq[];
};

export type ArticleIndexEntry = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  publishedAt: string;
  heroImage: string;
  alt: string;
};

export type CodedArticleLink = { slug: string; title: string; href: string };

export type MergedArticleLink = CodedArticleLink & {
  source: "coded" | "fleet";
  description: string;
  publishedAt: string;
};

export type ArticleLoadResult =
  | { ok: true; articles: FleetArticle[] }
  | { ok: false; articles: [] };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ARTICLE_CACHE_MS = 60_000;

let memory: { key: string; at: number; value: ArticleLoadResult } | null = null;

export function resetFleetArticleCache(): void {
  memory = null;
}

export function textHasBlockedPhone(text: string, blocked: readonly string[] = FLEET_BLOCKED_PHONES): boolean {
  const tokens = text.match(/\+?\d[\d\s().-]{6,}\d/g) ?? [];
  const tokenDigits = tokens.map((token) => token.replace(/\D/g, ""));
  for (const entry of blocked) {
    const raw = entry.trim();
    if (!raw) continue;
    if (text.toLowerCase().includes(raw.toLowerCase())) return true;
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 7) continue;
    if (tokenDigits.some((token) => token === digits || token.endsWith(digits))) return true;
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function parseArticleIndex(raw: string): ArticleIndexEntry[] | null {
  if (Buffer.byteLength(raw) > FLEET_MAX_BUNDLE_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const list = Array.isArray(parsed) ? parsed : asRecord(parsed)?.articles;
  if (!Array.isArray(list)) return null;
  const entries: ArticleIndexEntry[] = [];
  const seen = new Set<string>();
  for (const item of list.slice(0, 50)) {
    const record = asRecord(item);
    if (!record) continue;
    const slug = cleanText(record.slug, 80);
    const title = cleanText(record.title, 180);
    const publishedAt = cleanText(record.publishedAt, 40);
    if (!SLUG.test(slug) || !title || !Number.isFinite(Date.parse(publishedAt)) || seen.has(slug)) continue;
    seen.add(slug);
    entries.push({
      slug,
      title,
      metaTitle: cleanText(record.metaTitle, 180) || title,
      metaDescription: cleanText(record.metaDescription, 300),
      publishedAt: new Date(publishedAt).toISOString(),
      heroImage: cleanText(record.heroImage, 500),
      alt: cleanText(record.alt, 180),
    });
  }
  return entries;
}

function articleHtml(record: Record<string, unknown>): string {
  const body = typeof record.body === "string" ? record.body : "";
  const format = cleanText(record.format, 20).toLowerCase();
  if (format === "markdown" || (format !== "html" && !/<\/?[a-z][\s\S]*>/i.test(body))) return markdownToHtml(body);
  return sanitizeArticleHtml(body);
}

export function parseArticleBody(raw: string, entry: ArticleIndexEntry, blocked: readonly string[]): FleetArticle | null {
  if (Buffer.byteLength(raw) > FLEET_MAX_BUNDLE_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  if (!record) return null;
  const slug = cleanText(record.slug, 80);
  if (slug && slug !== entry.slug) return null;
  const faqs: ArticleFaq[] = [];
  if (Array.isArray(record.faqs)) {
    for (const item of record.faqs.slice(0, 20)) {
      const faq = asRecord(item);
      if (!faq) continue;
      const question = cleanText(faq.question, 200);
      const answer = sanitizeArticleHtml(typeof faq.answer === "string" ? faq.answer : "");
      if (!question || !answer) continue;
      faqs.push({ question, answer });
    }
  }
  const html = articleHtml(record);
  const blob = [entry.title, entry.metaTitle, entry.metaDescription, entry.alt, html, ...faqs.flatMap((faq) => [faq.question, faq.answer])].join("\n");
  if (!html || textHasBlockedPhone(blob, blocked)) return null;
  const hero = entry.heroImage;
  const heroOk = !hero || /^https?:\/\//i.test(hero) || (hero.startsWith("/") && !hero.startsWith("//"));
  return {
    ...entry,
    heroImage: heroOk ? hero : "",
    html,
    faqs,
  };
}

export function absoluteArticleHero(hero: string, origin = FLEET_ORIGIN): string {
  if (/^https?:\/\//i.test(hero)) return hero;
  if (hero.startsWith("/") && !hero.startsWith("//")) return `${origin}${hero}`;
  return "";
}

function faqPlainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function articleJsonLd(article: FleetArticle, origin = FLEET_ORIGIN): { "@context": string; "@graph": Record<string, unknown>[] } {
  const url = `${origin}${FLEET_ARTICLES_PATH}/${article.slug}`;
  const image = absoluteArticleHero(article.heroImage, origin);
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Article",
      headline: article.title,
      description: article.metaDescription,
      datePublished: article.publishedAt,
      ...(image ? { image } : {}),
      mainEntityOfPage: url,
      author: { "@type": "Organization", name: FLEET_STORE_NAME, url: origin },
      publisher: { "@type": "Organization", name: FLEET_STORE_NAME, url: origin },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: origin },
        { "@type": "ListItem", position: 2, name: "Articles", item: `${origin}${FLEET_ARTICLES_PATH}` },
        { "@type": "ListItem", position: 3, name: article.title, item: url },
      ],
    },
  ];
  if (article.faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: article.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faqPlainText(faq.answer) },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function mergeArticleLinks(coded: readonly CodedArticleLink[], fleet: readonly FleetArticle[]): MergedArticleLink[] {
  const codedSlugs = new Set(coded.map((item) => item.slug).filter(Boolean));
  const codedLinks: MergedArticleLink[] = coded.filter((item) => item.slug).map((item) => ({
    ...item,
    source: "coded",
    description: "",
    publishedAt: "",
  }));
  const fleetLinks: MergedArticleLink[] = fleet.filter((item) => !codedSlugs.has(item.slug)).map((item) => ({
    slug: item.slug,
    title: item.title,
    href: `/articles/${item.slug}`,
    source: "fleet",
    description: item.metaDescription,
    publishedAt: item.publishedAt,
  }));
  return [...codedLinks, ...fleetLinks];
}

function bodyUrlFor(indexUrl: string, slug: string): string {
  if (indexUrl.endsWith("/articles/index.json")) {
    return `${indexUrl.slice(0, -"index.json".length)}${encodeURIComponent(slug)}.json`;
  }
  return articleBodyUrl(slug);
}

async function readText(fetchImpl: typeof fetch, url: string): Promise<string | null> {
  try {
    const init: RequestInit = { signal: AbortSignal.timeout(2500) };
    if (process.env.NEXT_RUNTIME) {
      Object.assign(init, { next: { revalidate: 60, tags: [FLEET_CONTENT_TAG] } });
    }
    const response = await fetchImpl(url, init);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function loadFleetArticles(options: {
  fetchImpl?: typeof fetch;
  indexUrl?: string;
  blockedPhones?: readonly string[];
  emergencyCoded?: boolean;
} = {}): Promise<ArticleLoadResult> {
  const emergency = options.emergencyCoded ?? await readEmergencyCoded(options.fetchImpl);
  if (emergency) return { ok: false, articles: [] };
  const indexUrl = options.indexUrl || articlesIndexUrl();
  const blocked = options.blockedPhones ?? FLEET_BLOCKED_PHONES;
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!options.fetchImpl && memory && memory.key === indexUrl && Date.now() - memory.at < ARTICLE_CACHE_MS) return memory.value;

  const indexRaw = await readText(fetchImpl, indexUrl);
  const entries = indexRaw == null ? null : parseArticleIndex(indexRaw);
  if (!entries) {
    const missing: ArticleLoadResult = { ok: false, articles: [] };
    if (!options.fetchImpl) memory = { key: indexUrl, at: Date.now(), value: missing };
    return missing;
  }

  const articles: FleetArticle[] = [];
  await Promise.all(entries.map(async (entry) => {
    const body = await readText(fetchImpl, bodyUrlFor(indexUrl, entry.slug));
    if (!body) return;
    const article = parseArticleBody(body, entry, blocked);
    if (article) articles.push(article);
  }));
  articles.sort((a, b) => entries.findIndex((entry) => entry.slug === a.slug) - entries.findIndex((entry) => entry.slug === b.slug));
  const value: ArticleLoadResult = { ok: true, articles };
  if (!options.fetchImpl) memory = { key: indexUrl, at: Date.now(), value };
  return value;
}
