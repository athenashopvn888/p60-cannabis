import type { Metadata } from "next";
import BlogContent from "./BlogContent";

export const metadata: Metadata = {
  title: "Cannabis Blog & Guides — P60 Cannabis | York",
  description: "Read the latest strain reviews, dosing guides, and cannabis news from P60 Cannabis in York.",
  alternates: {
    canonical: "https://p60cannabis.com/blog",
  },
};

export default function BlogPage() {
  return <BlogContent />;
}
