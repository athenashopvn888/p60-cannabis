import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { absoluteArticleHero, articleJsonLd, loadFleetArticles, mergeArticleLinks, parseArticleBody, parseArticleIndex, resetFleetArticleCache, textHasBlockedPhone, type ArticleIndexEntry } from "../app/lib/fleet/articles.ts";
import { markdownToHtml, sanitizeArticleHtml } from "../app/lib/fleet/sanitize.ts";

const entry: ArticleIndexEntry = {
  slug: "junction-hours",
  title: "Junction hours",
  metaTitle: "Hours meta",
  metaDescription: "Open all night",
  publishedAt: "2026-10-01T00:00:00.000Z",
  heroImage: "/hours.webp",
  alt: "The door",
};

test("article HTML is sanitized and blocked phone numbers drop the article", () => {
  const html = sanitizeArticleHtml(`<script>alert(1)</script><p onclick="steal()" style="color:red">Hi <a href="javascript:alert(1)">x</a></p><iframe src="https://evil"></iframe>`);
  assert.equal(html.includes("script"), false);
  assert.equal(html.includes("onclick"), false);
  assert.equal(html.includes("javascript:"), false);
  assert.equal(html.includes("iframe"), false);
  assert.match(html, /<p>Hi/);
  assert.match(markdownToHtml("# Title\n\nHello **there**"), /<h1>Title<\/h1><p>Hello <strong>there<\/strong><\/p>/);
  assert.equal(textHasBlockedPhone("Call (437) 000-0000 today", ["4370000000"]), true);
  assert.equal(textHasBlockedPhone("Call (437) 291-0948 today", ["4370000000"]), false);

  const blocked = parseArticleBody(JSON.stringify({ body: "<p>Call 437-000-0000</p>", faqs: [] }), entry, ["4370000000"]);
  assert.equal(blocked, null);
  const kept = parseArticleBody(JSON.stringify({
    format: "html",
    body: "<p>The door is open.</p><script>nope</script>",
    faqs: [{ question: "When?", answer: "<p>Always</p><img src=x onerror=alert(1)>" }],
  }), entry, ["4370000000"]);
  assert.ok(kept);
  assert.match(kept.html, /The door is open/);
  assert.equal(kept.html.includes("script"), false);
  assert.equal(kept.faqs[0].answer.includes("onerror"), false);
});

test("a missing index publishes nothing and a coded slug wins the clash", async () => {
  assert.equal(parseArticleIndex("{"), null);
  assert.equal(parseArticleIndex("[]")?.length, 0);
  const index = JSON.stringify({ articles: [entry, { ...entry, slug: "menu-guide", title: "Sheet menu" }] });
  resetFleetArticleCache();
  const bodies: Record<string, string> = {
    "https://fixture.test/articles/index.json": index,
    "https://fixture.test/articles/junction-hours.json": JSON.stringify({ slug: "junction-hours", format: "markdown", body: "Walk in any time." }),
    "https://fixture.test/articles/menu-guide.json": JSON.stringify({ body: "<p>Sheet body</p>" }),
  };
  const fetchImpl = async (url: string | URL) => {
    const body = bodies[String(url)];
    if (!body) return new Response("missing", { status: 404 });
    return new Response(body, { status: 200 });
  };
  const loaded = await loadFleetArticles({ fetchImpl: fetchImpl as typeof fetch, indexUrl: "https://fixture.test/articles/index.json", blockedPhones: [] });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.deepEqual(loaded.articles.map((article) => article.slug), ["junction-hours", "menu-guide"]);
  const merged = mergeArticleLinks([{ slug: "menu-guide", title: "Menu Guide", href: "/resources/menu-guide" }], loaded.articles);
  assert.deepEqual(merged.map((item) => item.href), ["/resources/menu-guide", "/articles/junction-hours"]);
  assert.equal(merged[0].source, "coded");
  assert.equal(merged[1].source, "fleet");

  const missing = await loadFleetArticles({
    fetchImpl: (async () => new Response("nope", { status: 404 })) as typeof fetch,
    indexUrl: "https://fixture.test/missing.json",
  });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.articles, []);
});

const KIT_INDEX = `{"articles":[{"slug":"kit-test-article","title":"Kit Test Article","metaTitle":"Kit Test Article | Gas Junction","metaDescription":"Test article for the fleet content kit.","publishedAt":"2026-10-22T04:00:00.000Z","heroImage":"/banners/core-top-weed-tier.webp","alt":"Test hero"}]}`;
const KIT_BODY = `{"slug":"kit-test-article","format":"html","body":"<p>Hello kit test.</p>","faqs":[{"question":"Is this a test?","answer":"Yes."}]}`;

test("the live kit-test-article JSON keeps a relative hero, the HTML body, and a plain FAQ", async () => {
  const entries = parseArticleIndex(KIT_INDEX);
  assert.ok(entries);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].heroImage, "/banners/core-top-weed-tier.webp");
  assert.equal(entries[0].publishedAt, "2026-10-22T04:00:00.000Z");

  const article = parseArticleBody(KIT_BODY, entries[0], []);
  assert.ok(article);
  assert.equal(article.heroImage, "/banners/core-top-weed-tier.webp");
  assert.equal(article.html, "<p>Hello kit test.</p>");
  assert.equal(article.html.includes("<script"), false);
  assert.deepEqual(article.faqs, [{ question: "Is this a test?", answer: "Yes." }]);
  assert.equal(absoluteArticleHero(article.heroImage), "https://www.p60cannabis.com/banners/core-top-weed-tier.webp");

  const absolute = parseArticleBody(KIT_BODY, { ...entries[0], heroImage: "https://cdn.example/hero.webp" }, []);
  assert.equal(absolute?.heroImage, "https://cdn.example/hero.webp");
  assert.equal(absoluteArticleHero("https://cdn.example/hero.webp"), "https://cdn.example/hero.webp");
  assert.equal(absoluteArticleHero("//evil.example/x.webp"), "");

  const scriptOnly = parseArticleBody(JSON.stringify({ slug: "kit-test-article", format: "html", body: "<script>alert(1)</script>" }), entries[0], []);
  assert.equal(scriptOnly, null);
  assert.equal(parseArticleBody("{", entries[0], []), null);

  const graph = articleJsonLd(article)["@graph"];
  assert.deepEqual(graph.map((node) => node["@type"]), ["Article", "BreadcrumbList", "FAQPage"]);
  assert.equal(graph[0].image, "https://www.p60cannabis.com/banners/core-top-weed-tier.webp");
  const faq = graph[2].mainEntity as { acceptedAnswer: { text: string } }[];
  assert.equal(faq[0].acceptedAnswer.text, "Yes.");
  assert.equal(articleJsonLd(absolute!)["@graph"][0].image, "https://cdn.example/hero.webp");

  const loaded = await loadFleetArticles({
    fetchImpl: (async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith("/articles/index.json")) return new Response(KIT_INDEX, { status: 200 });
      if (href.endsWith("/articles/kit-test-article.json")) return new Response(KIT_BODY, { status: 200 });
      return new Response("missing", { status: 404 });
    }) as typeof fetch,
    indexUrl: "https://dhaah0upvlpukv56.public.blob.vercel-storage.com/PNY01/articles/index.json",
    blockedPhones: [],
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.articles[0]?.html, "<p>Hello kit test.</p>");
  assert.equal(loaded.articles[0]?.html.includes("<script"), false);

  const page = readFileSync(new URL("../app/articles/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /unstable_rethrow/);
  assert.match(page, /notFound\(\)/);
  const view = readFileSync(new URL("../app/components/fleet/FleetArticleView.tsx", import.meta.url), "utf8");
  assert.match(view, /src=\{article\.heroImage\}/);
  assert.match(view, /data-fleet-article-body/);
});
