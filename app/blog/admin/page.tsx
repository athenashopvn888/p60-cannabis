"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./admin.module.css";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySrZYxI-NNnXfxY1jXOqHgT2HQi4zst2Fgte6FXTeymat_W_r0o1E3P83EfnVCjEk0/exec";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  date: string;
  published: string;
  store: string;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}

export default function BlogAdmin() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const auth = getCookie("blog_auth");
    if (auth === "seowiz_ok") {
      setLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) fetchPosts();
  }, [loggedIn]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (username === "seowiz" && password === "ottawaseo") {
      setCookie("blog_auth", "seowiz_ok", 30);
      setLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("Invalid credentials");
    }
  }

  function handleLogout() {
    document.cookie = "blog_auth=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
    setLoggedIn(false);
  }

  async function fetchPosts() {
    setLoading(true);
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=blog&store=PNY01&admin=1`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      setPosts([]);
    }
    setLoading(false);
  }

  async function togglePublish(post: BlogPost) {
    const newPub = String(post.published).toUpperCase() !== "TRUE";
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "update", id: post.id, published: newPub }),
      });
      fetchPosts();
    } catch (err) {
      alert("Failed to update post");
    }
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post permanently?")) return;
    setDeleting(id);
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete", id }),
      });
      fetchPosts();
    } catch (err) {
      alert("Failed to delete post");
    }
    setDeleting(null);
  }

  // ── Login Screen ──
  if (!loggedIn) {
    return (
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          <div className={styles.loginLogo}>📝</div>
          <h1 className={styles.loginTitle}>Blog Admin</h1>
          <p className={styles.loginSub}>P60 Cannabis</p>
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.loginInput}
              autoFocus
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.loginInput}
            />
            {loginError && <p className={styles.loginError}>{loginError}</p>}
            <button type="submit" className={styles.loginBtn}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div className={styles.dashboard}>
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <h1 className={styles.dashTitle}>📝 Blog Dashboard</h1>
          <span className={styles.postCount}>{posts.length} posts</span>
        </div>
        <div className={styles.topRight}>
          <Link href="/blog/admin/editor" className={styles.newBtn}>
            + New Post
          </Link>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className={styles.empty}>
          <p>No blog posts yet.</p>
          <Link href="/blog/admin/editor" className={styles.newBtn}>
            Create Your First Post
          </Link>
        </div>
      ) : (
        <div className={styles.postList}>
          {posts.map((post) => (
            <div key={post.id} className={styles.postRow}>
              <div className={styles.postInfo}>
                <h3 className={styles.postTitle}>{post.title || "Untitled"}</h3>
                <div className={styles.postMeta}>
                  <span>{new Date(post.date).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>{post.author}</span>
                  <span>·</span>
                  <span className={String(post.published).toUpperCase() === "TRUE" ? styles.statusPublished : styles.statusDraft}>
                    {String(post.published).toUpperCase() === "TRUE" ? "Published" : "Draft"}
                  </span>
                </div>
              </div>
              <div className={styles.postActions}>
                <button
                  onClick={() => togglePublish(post)}
                  className={styles.actionBtn}
                >
                  {String(post.published).toUpperCase() === "TRUE" ? "Unpublish" : "Publish"}
                </button>
                <Link
                  href={`/blog/admin/editor?id=${post.id}`}
                  className={styles.actionBtn}
                >
                  Edit
                </Link>
                <button
                  onClick={() => deletePost(post.id)}
                  className={styles.deleteBtn}
                  disabled={deleting === post.id}
                >
                  {deleting === post.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
