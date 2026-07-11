import type { Metadata } from "next";
import BlogContent from "./BlogContent";

export const metadata: Metadata = {
  title: "P60 Cannabis Blog | Cannabis Menu Guides",
  description: "Read P60 Cannabis cannabis menu guides, flower tier notes, and local store checks for York shoppers.",
  alternates: {
    canonical: "https://www.p60cannabis.com/blog",
  },
};

export default function BlogPage() {
  return <BlogContent />;
}
