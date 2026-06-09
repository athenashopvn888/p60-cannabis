"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./editor.module.css";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbySrZYxI-NNnXfxY1jXOqHgT2HQi4zst2Fgte6FXTeymat_W_r0o1E3P83EfnVCjEk0/exec";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function BlogEditorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("id");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("P60 Cannabis Team");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    const auth = getCookie("blog_auth");
    if (auth !== "seowiz_ok") {
      router.push("/blog/admin");
    }
  }, [router]);

  // Load post if editing
  useEffect(() => {
    if (!editId) return;
    setLoading(true);

    fetch(`${APPS_SCRIPT_URL}?action=blog&store=PNY01&admin=1`)
      .then((r) => r.json())
      .then((data) => {
        const post = (data.posts || []).find((p: { id: string }) => p.id === editId);
        if (post) {
          setTitle(post.title || "");
          setContent(post.content || "");
          setAuthor(post.author || "P60 Cannabis Team");
          setPublished(String(post.published).toUpperCase() === "TRUE");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [editId]);

  async function handleSave() {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    setSaving(true);
    setSaved(false);

    const payload = editId
      ? { action: "update", id: editId, title, content, author, published }
      : { action: "create", title, content, author, published, store: "PNY01" };

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSaved(true);
      if (!editId) {
        // After creating, go back to dashboard
        setTimeout(() => router.push("/blog/admin"), 1500);
      }
    } catch {
      alert("Failed to save. Please try again.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className={styles.editorPage}>
        <div className={styles.loading}>Loading post...</div>
      </div>
    );
  }

  return (
    <div className={styles.editorPage}>
      <div className={styles.topBar}>
        <Link href="/blog/admin" className={styles.backBtn}>
          ← Back to Dashboard
        </Link>
        <div className={styles.topRight}>
          <label className={styles.publishToggle}>
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            <span>{published ? "Published" : "Draft"}</span>
          </label>
          <button
            onClick={handleSave}
            className={styles.saveBtn}
            disabled={saving}
          >
            {saving ? "Saving..." : saved ? "✅ Saved!" : editId ? "Update Post" : "Publish Post"}
          </button>
        </div>
      </div>

      <div className={styles.form}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title..."
          className={styles.titleInput}
          autoFocus
        />

        <div className={styles.metaRow}>
          <label className={styles.metaLabel}>
            Author:
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={styles.metaInput}
            />
          </label>
        </div>

        <div className={styles.editorHelp}>
          <strong>Formatting tips:</strong> Use blank lines for paragraphs. Use ## for headings. Use **text** for bold. Use - for bullet points.
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your blog post here...

Use blank lines to separate paragraphs.

## Use double-hash for headings

**Bold text** for emphasis.

- Bullet points
- Like this"
          className={styles.contentArea}
          rows={25}
        />
      </div>
    </div>
  );
}

export default function BlogEditor() {
  return (
    <Suspense fallback={<div className={styles.editorPage}><div className={styles.loading}>Loading editor...</div></div>}>
      <BlogEditorInner />
    </Suspense>
  );
}
