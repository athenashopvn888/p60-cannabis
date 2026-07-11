import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import PostContent from "./PostContent";
import { BLOG_REDIRECTS, STATIC_POSTS, getBlogRedirect, getStaticPost, STORE_BLOG_CONFIG } from "../staticPosts";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return STATIC_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const redirectTarget = getBlogRedirect(slug);
  const finalSlug = redirectTarget || slug;
  const staticPost = getStaticPost(finalSlug);

  if (!staticPost) {
    return {
      title: "Blog | " + STORE_BLOG_CONFIG.storeName,
      robots: { index: false, follow: false },
    };
  }

  return {
    title: staticPost.seoTitle,
    description: staticPost.metaDescription,
    alternates: {
      canonical: "https://" + STORE_BLOG_CONFIG.domain + "/blog/" + staticPost.slug,
    },
    openGraph: {
      title: staticPost.seoTitle,
      description: staticPost.metaDescription,
      url: "https://" + STORE_BLOG_CONFIG.domain + "/blog/" + staticPost.slug,
      type: "article",
      publishedTime: staticPost.date,
      modifiedTime: staticPost.modifiedDate,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const redirectTarget = BLOG_REDIRECTS[slug];

  if (redirectTarget) {
    permanentRedirect("/blog/" + redirectTarget);
  }

  const staticPost = getStaticPost(slug);
  if (!staticPost) notFound();

  return <PostContent slug={slug} storeCode={STORE_BLOG_CONFIG.storeCode} storeName={STORE_BLOG_CONFIG.storeName} />;
}
