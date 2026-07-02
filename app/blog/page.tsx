import type { Metadata } from "next";
import BlogContent from "./BlogContent";
import { STORE_BLOG_CONFIG } from "./staticPosts";

export const metadata: Metadata = {
  title: `${STORE_BLOG_CONFIG.storeName} Blog | Adult 19+ Store Guides`,
  description: `Read adult 19+ store guides and local visit-planning notes from ${STORE_BLOG_CONFIG.storeName}.`,
  alternates: {
    canonical: `https://${STORE_BLOG_CONFIG.domain}/blog`,
  },
};

export default function BlogPage() {
  return <BlogContent />;
}
