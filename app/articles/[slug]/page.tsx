import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import Footer from "../../components/Footer";
import FleetArticleView from "../../components/fleet/FleetArticleView";
import Navbar from "../../components/Navbar";
import { loadFleetArticles, type FleetArticle } from "../../lib/fleet/articles";
import { FLEET_ARTICLES_PATH, FLEET_ORIGIN } from "../../lib/fleet/config";
import { RESOURCE_PAGES } from "../../resources/resourceData";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function codedSlug(path: string) {
  return path.split("/").filter(Boolean).pop() || "";
}

async function findArticle(slug: string): Promise<FleetArticle | null> {
  if (!SLUG.test(slug) || RESOURCE_PAGES.some((page) => codedSlug(page.path) === slug)) return null;
  const loaded = await loadFleetArticles();
  if (!loaded.ok) return null;
  return loaded.articles.find((article) => article.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    const article = await findArticle(slug);
    if (!article) return {};
    return {
      title: article.metaTitle,
      description: article.metaDescription,
      alternates: { canonical: `${FLEET_ORIGIN}${FLEET_ARTICLES_PATH}/${article.slug}` },
    };
  } catch (error) {
    unstable_rethrow(error);
    return {};
  }
}

export default async function FleetArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  let article: FleetArticle | null;
  try {
    const { slug } = await params;
    article = await findArticle(slug);
  } catch (error) {
    unstable_rethrow(error);
    notFound();
  }
  if (!article) notFound();
  return (
    <>
      <Navbar />
      <main>
        <FleetArticleView article={article} />
      </main>
      <Footer />
    </>
  );
}
