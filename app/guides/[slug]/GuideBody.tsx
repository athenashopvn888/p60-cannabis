import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./guide.module.css";

function renderInline(markdown: string): ReactNode[] {
  const tokens = markdown.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return tokens.filter(Boolean).map((token, index) => {
    const strong = token.match(/^\*\*(.+)\*\*$/);
    if (strong) return <strong key={index}>{strong[1]}</strong>;
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <Link key={index} href={link[2]}>{link[1]}</Link>;
    return token;
  });
}

export function stripMarkdown(markdown: string) {
  return markdown.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/\s+/g, " ").trim();
}

export default function GuideBody({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(<ul key={`ul-${blocks.length}`}>{bullets.map((bullet, index) => <li key={index}>{renderInline(bullet)}</li>)}</ul>);
    bullets = [];
  };

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (lineIndex === 0 && line.startsWith("# ")) return;
    if (!line) { flushParagraph(); flushBullets(); return; }
    if (line.startsWith("## ")) { flushParagraph(); flushBullets(); blocks.push(<h2 key={`h2-${blocks.length}`}>{renderInline(line.slice(3))}</h2>); return; }
    if (line.startsWith("### ")) { flushParagraph(); flushBullets(); blocks.push(<h3 key={`h3-${blocks.length}`}>{renderInline(line.slice(4))}</h3>); return; }
    if (line.startsWith("- ")) { flushParagraph(); bullets.push(line.slice(2)); return; }
    flushBullets();
    paragraph.push(line);
  });
  flushParagraph();
  flushBullets();
  return <div className={styles.body}>{blocks}</div>;
}
