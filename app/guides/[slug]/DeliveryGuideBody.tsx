import Link from "next/link";
import type { ReactNode } from "react";
import type { DeliveryGuideFaq } from "../../lib/deliveryGuideRegistry";
import styles from "./guide.module.css";

function renderInline(markdown: string): ReactNode[] {
  const tokens = markdown.split(/(\*\*\[[^\]]+\]\([^)]+\)\*\*|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return tokens.filter(Boolean).map((token, index) => {
    const strongLink = token.match(/^\*\*\[([^\]]+)\]\(([^)]+)\)\*\*$/);
    if (strongLink) return <strong key={index}><Link href={strongLink[2]}>{strongLink[1]}</Link></strong>;
    const strong = token.match(/^\*\*(.+)\*\*$/);
    if (strong) return <strong key={index}>{strong[1]}</strong>;
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <Link key={index} href={link[2]}>{link[1]}</Link>;
    return token;
  });
}

export function stripDeliveryMarkdown(markdown: string) {
  return markdown.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/\s+/g, " ").trim();
}

export default function DeliveryGuideBody({ markdown, faqs }: { markdown: string; faqs: DeliveryGuideFaq[] }) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  const flushParagraph = () => { if (paragraph.length) { blocks.push(<p key={`p-${blocks.length}`}>{renderInline(paragraph.join(" "))}</p>); paragraph = []; } };
  const flushBullets = () => { if (bullets.length) { blocks.push(<ul key={`ul-${blocks.length}`}>{bullets.map((bullet, index) => <li key={index}>{renderInline(bullet)}</li>)}</ul>); bullets = []; } };
  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushBullets(); return; }
    if (line.startsWith("### ")) { flushParagraph(); flushBullets(); blocks.push(<h3 key={`h3-${blocks.length}`}>{renderInline(line.slice(4))}</h3>); return; }
    if (line.startsWith("- ")) { flushParagraph(); bullets.push(line.slice(2)); return; }
    flushBullets(); paragraph.push(line);
  });
  flushParagraph(); flushBullets();
  return <><div className={styles.body}>{blocks}</div><div className={styles.faqs}><h2>FAQ</h2>{faqs.map((faq) => <details key={faq.question}><summary>{renderInline(faq.question)}</summary><p>{renderInline(faq.answer)}</p></details>)}</div></>;
}
