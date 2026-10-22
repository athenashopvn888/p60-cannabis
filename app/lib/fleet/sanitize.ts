const ALLOWED = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "ul", "ol", "li", "a", "strong", "em", "b", "i",
  "blockquote", "code", "pre", "hr", "img", "figure", "figcaption",
]);

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Drop scripts, event handlers, and tags outside the article set. */
export function sanitizeArticleHtml(input: string): string {
  let html = input.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|link|meta|svg|math|template)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|link|meta|svg|math|template)\b[^>]*\/?\s*>/gi, "");
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/\s(href|src)\s*=\s*(['"])\s*(?:javascript|data|vbscript):[^'"]*\2/gi, "");
  html = html.replace(/<\/?([a-zA-Z0-9:-]+)([^>]*)>/g, (full, name: string, rest: string) => {
    const tag = name.toLowerCase();
    if (!ALLOWED.has(tag)) return "";
    if (full.startsWith("</")) return `</${tag}>`;
    const attrs: string[] = [];
    const attrPattern = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let match: RegExpExecArray | null;
    while ((match = attrPattern.exec(rest))) {
      const attr = match[1].toLowerCase();
      const value = match[3] ?? match[4] ?? "";
      if (attr.startsWith("on") || attr === "style") continue;
      if ((attr === "href" || attr === "src") && !/^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(value.trim())) continue;
      attrs.push(`${attr}="${escapeHtml(value)}"`);
    }
    const selfClosing = tag === "br" || tag === "hr" || tag === "img";
    return `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}${selfClosing ? " />" : ">"}`;
  });
  return html.trim();
}

function inlineMarkdown(value: string): string {
  let text = escapeHtml(value);
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return text;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let list: string[] | null = null;
  const flushList = () => {
    if (!list) return;
    parts.push(`<ul>${list.join("")}</ul>`);
    list = null;
  };
  for (const line of lines) {
    const item = /^[-*]\s+(.+)$/.exec(line);
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (item) {
      list = list ?? [];
      list.push(`<li>${inlineMarkdown(item[1])}</li>`);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    if (heading) {
      const level = heading[1].length;
      parts.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    parts.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  flushList();
  return sanitizeArticleHtml(parts.join(""));
}
