import type { Metadata } from "next";
import PostContent from "./PostContent";
import { getStaticPost, STATIC_POSTS, STORE_BLOG_CONFIG } from "../staticPosts";

export function generateStaticParams() {
  return STATIC_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getStaticPost(slug);
  const fallbackTitle = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const title = post?.seoTitle || `${fallbackTitle} - Blog | ${STORE_BLOG_CONFIG.storeName}`;
  const description =
    post?.metaDescription ||
    `Read about ${fallbackTitle.toLowerCase()} and other cannabis guides from ${STORE_BLOG_CONFIG.storeName} in ${STORE_BLOG_CONFIG.city}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://${STORE_BLOG_CONFIG.domain}/blog/${slug}`,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: `https://${STORE_BLOG_CONFIG.domain}/blog/${slug}`,
      publishedTime: post?.date,
      modifiedTime: post?.dateModified || post?.date,
      authors: post?.author ? [post.author] : undefined,
    },
  };
}

export default function BlogPostPage() {
  return <PostContent />;
}
