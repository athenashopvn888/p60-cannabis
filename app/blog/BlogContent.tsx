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
  authorName?: string;
  authorHandle?: string;
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
  return post.excerpt || post.meta_description || post.metaDescription || truncate((post.content || "").replace(/[#*-]/g, ""), 160);
}

function postAuthor(post: BlogPost, storeName: string) {
  if (post.authorName && post.authorHandle) return "By " + post.authorName + " \u00b7 " + post.authorHandle;
  return post.author || "By The " + storeName + " Team";
}

export default function BlogContent({ managerPosts = [], storeName = STORE_BLOG_CONFIG.storeName }: BlogContentProps) {
  const posts = [...STATIC_POSTS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className={styles.main}>
      <Navbar />
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Store notes and menu reads</p>
          <h1 className={styles.heroH1}>{storeName} Blog</h1>
          <p className={styles.heroSub}>Useful cannabis menu guides with a little voice, a lot of checking, and no mystery claims.</p>
        </div>
      </section>

      {managerPosts.length > 0 && (
        <section className={styles.postsSection}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Latest Posts</h2>
            <div className={styles.postsGrid}>
              {managerPosts.map((post) => (
                <Link key={post.id || post.slug} href={"/blog/" + post.slug} className={styles.postCard}>
                  <div className={styles.postMeta}>
                    <span className={styles.postCategory}>Blog</span>
                    <span className={styles.postTime}>{postAuthor(post, storeName)}</span>
                  </div>
                  <h3 className={styles.postTitle}>{post.title}</h3>
                  <p className={styles.postExcerpt}>{postExcerpt(post)}</p>
                  <div className={styles.postDate}>{post.date ? new Date(post.date).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "Store post"}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={styles.postsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Guides</h2>
          <div className={styles.postsGrid}>
            {posts.map((post) => (
              <Link key={post.slug} href={"/blog/" + post.slug} className={styles.postCard}>
                <div className={styles.postMeta}>
                  <span className={styles.postCategory}>{post.category}</span>
                  <span className={styles.postTime}>{post.readTime}</span>
                </div>
                <h3 className={styles.postTitle}>{post.title}</h3>
                <p className={styles.postExcerpt}>{post.excerpt}</p>
                <div className={styles.postFooter}>
                  <span>{postAuthor(post, storeName)}</span>
                  <span>{new Date(post.date).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Check the current store page</h2>
          <p className={styles.ctaSub}>Address, phone, hours, and menu details belong on the live store page.</p>
          <div className={styles.ctaBtns}>
            <Link href={STORE_BLOG_CONFIG.storePath} className={styles.ctaBtn}>Store Page</Link>
            <Link href="/" className={styles.ctaBtnSecondary}>Homepage</Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
