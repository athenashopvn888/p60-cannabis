import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import styles from "./blog.module.css";
import { STATIC_POSTS, STORE_BLOG_CONFIG } from "./staticPosts";

interface BlogPost {
  id?: string;
  title: string;
  slug: string;
  content?: string;
  author?: string;
  date?: string;
  excerpt?: string;
  metaDescription?: string;
  meta_description?: string;
}

type BlogContentProps = {
  managerPosts?: BlogPost[];
  storeCode?: string;
  storeName?: string;
};

function truncate(text: string, len: number) {
  if (text.length <= len) return text;
  return text.substring(0, len).replace(/\s+\S*$/, "") + "...";
}

function postExcerpt(post: BlogPost) {
  return post.excerpt || post.meta_description || post.metaDescription || truncate((post.content || "").replace(/[#*\-]/g, ""), 160);
}

export default function BlogContent({ managerPosts = [], storeName = STORE_BLOG_CONFIG.storeName }: BlogContentProps) {
  return (
    <main className={styles.main}>
      <Navbar />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroH1}>
            {storeName} <span className={styles.heroAccent}>Blog</span>
          </h1>
          <p className={styles.heroSub}>
            Adult 19+ store guides, local visit-planning notes, and safe menu-category context.
          </p>
        </div>
      </section>

      {managerPosts.length > 0 && (
        <section className={styles.postsSection}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Latest Posts</h2>
            <div className={styles.postsGrid}>
              {managerPosts.map((post) => (
                <Link key={post.id || post.slug} href={`/blog/${post.slug}`} className={styles.postCard}>
                  <div className={styles.postEmoji}>Post</div>
                  <div className={styles.postMeta}>
                    <span className={styles.postCategory}>Blog</span>
                    <span className={styles.postDot}>-</span>
                    <span className={styles.postTime}>{post.author || `The ${storeName} Team`}</span>
                  </div>
                  <h3 className={styles.postTitle}>{post.title}</h3>
                  <p className={styles.postExcerpt}>{postExcerpt(post)}</p>
                  <div className={styles.postDate}>
                    {post.date ? new Date(post.date).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }) : "Store post"}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={styles.postsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Guides &amp; Resources</h2>
          <div className={styles.postsGrid}>
            {[...STATIC_POSTS].sort((a, b) => b.date.localeCompare(a.date)).map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.postCard}>
                <div className={styles.postEmoji}>Guide</div>
                <div className={styles.postMeta}>
                  <span className={styles.postCategory}>{post.category}</span>
                  <span className={styles.postDot}>-</span>
                  <span className={styles.postTime}>{post.readTime}</span>
                </div>
                <h3 className={styles.postTitle}>{post.title}</h3>
                <p className={styles.postExcerpt}>{post.excerpt}</p>
                <div className={styles.postDate}>
                  {new Date(post.date).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Plan With Store Details</h2>
          <p className={styles.ctaSub}>
            Use the official store page for current details before visiting as an adult 19+ visitor.
          </p>
          <div className={styles.ctaBtns}>
            <Link href={STORE_BLOG_CONFIG.storePath} className={styles.ctaBtn}>
              Store Page
            </Link>
            <Link href="/" className={styles.ctaBtnSecondary}>
              Homepage
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
