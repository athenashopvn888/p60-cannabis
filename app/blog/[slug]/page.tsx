import type { Metadata } from "next";
import PostContent from "./PostContent";
import { getStaticPost, STORE_BLOG_CONFIG } from "../staticPosts";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const staticPost = getStaticPost(slug);

  if (staticPost) {
    return {
      title: staticPost.seoTitle,
      description: staticPost.metaDescription,
      alternates: {
        canonical: `https://${STORE_BLOG_CONFIG.domain}/blog/${slug}`,
      },
    };
  }

  const title = slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return {
    title: `${title} - Blog | ${STORE_BLOG_CONFIG.storeName}`,
    description: `Read adult 19+ store guides and local visit-planning notes from ${STORE_BLOG_CONFIG.storeName}.`,
    alternates: {
      canonical: `https://${STORE_BLOG_CONFIG.domain}/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  return <PostContent slug={slug} storeCode={STORE_BLOG_CONFIG.storeCode} storeName={STORE_BLOG_CONFIG.storeName} />;
}
