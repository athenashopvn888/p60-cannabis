import type { Metadata } from "next";
import type { ReactNode } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import styles from "./article.module.css";

const TITLE = 'Fresh Frozen vs Cured Cannabis: What "Fresh Frozen" Means on a Concentrate';
const CANONICAL = "https://www.p60cannabis.com/resources/fresh-frozen-vs-cured-cannabis";
const PUBLISHED = "2026-10-28";
const META_DESCRIPTION =
  "That's fresh frozen vs cured cannabis, and it explains a big chunk of concentrate vocabulary.";

const BODY = `# Fresh Frozen vs Cured Cannabis: What "Fresh Frozen" Means on a Concentrate

Last checked: October 27, 2026

Concentrate names love one word: "live." Behind that word sits a harvest decision most people never hear about. Does the plant get dried and cured like regular flower, or does it go straight into a freezer the day it's cut? That's fresh frozen vs cured cannabis, and it explains a big chunk of concentrate vocabulary. P60 Cannabis, at 1938 Weston Rd in Toronto, keeps it calm and precise for adults 19+: terms, a table and what the label actually tells you.

## Two paths after harvest

When a cannabis plant is cut, the producer has a choice.

**Path 1: dry and cure.** The plant (or its branches) is hung or racked to dry slowly, then cured, which means stored under controlled conditions so moisture evens out. This is the path for the dried flower you see in jars, and for material used in many standard concentrates.

**Path 2: fresh frozen.** The plant material is frozen soon after harvest, without drying. It stays frozen until it goes into extraction. Nothing about it is meant to be smoked as flower.

## Fresh frozen vs cured cannabis at a glance

| | Fresh frozen | Dried and cured |
|---|---|---|
| After harvest | Frozen soon after cutting | Dried, then cured |
| Moisture | Kept in, locked by freezing | Removed slowly |
| Main use | Input for extraction | Flower, or input for extraction |
| Common product words | "Live" (e.g. live resin, live rosin) | "Cured" (e.g. cured resin) |
| Sold as flower? | No | Yes |

## The glossary

**Fresh frozen (FF).** Plant material frozen right after harvest instead of dried.

**Whole plant fresh frozen (WPFF).** The same idea, used for whole plants or large sections, not only the buds.

**Live.** A product word for concentrates made from fresh frozen input. Live resin and live rosin are the common examples. "Live" describes the input, not a separate legal class.

**Cured.** Material that went through the normal dry-and-cure path. "Cured resin" uses that material instead of fresh frozen.

**Input material.** Whatever goes into extraction: fresh frozen plant, cured flower, or trim.

**Trim.** The leafy clippings removed when buds are shaped. A different input from whole fresh frozen plant.

## Why producers freeze instead of dry

The idea behind fresh frozen is simple: drying and curing change plant material over time, and freezing is a way to capture it as close to harvest as possible before extraction. Producers make the choice based on the product they're aiming for. You'll see the word "live" when they went that route.

What fresh frozen doesn't do is make a promise. The process describes how the input was handled, nothing more.

## What "fresh frozen" does NOT mean

- **Not a THC claim.** The only reliable numbers are Total THC and Total CBD on a legal label.
- **Not a regulated label class.** Concentrates are labelled as cannabis extracts, whether the input was frozen or cured.
- **Not "fresh" flower.** You won't find fresh frozen material sold as flower.
- **Not proof by itself.** "Live" on a product name is the producer's description.

## Reading the label on a "live" product

On a legal concentrate package, look for:

1. **Product class:** cannabis extract.
2. **Total THC and Total CBD** values.
3. **Net weight or volume.**
4. **Packaging date.**
5. **Ingredients,** where listed.
6. **The standard health warning.**

The word "live" may appear in the product name. The class line and the numbers are what matter.

## Live vs cured, in one line each

- **Live resin:** solvent-based extract from fresh frozen input.
- **Live rosin:** heat-and-pressure extract, usually pressed from ice-water hash made from fresh frozen input.
- **Cured resin:** solvent-based extract from dried and cured input.

Different paths, same plant.

## Storage

Concentrates are sticky and can soften with heat. Keep them in the original sealed, labelled container, somewhere cool, and well out of reach of children and pets.

## Questions people ask on Weston Road

**Can you buy fresh frozen cannabis?** Not as a retail flower product. Fresh frozen is an input for extraction.

**Is live always better than cured?** We don't rank them. They're two ways of handling input material. Read the label and choose what fits you.

**Is fresh frozen the same as frozen flower in your freezer at home?** No. Fresh frozen means the plant was frozen *before* drying, at the production stage. Freezing dried flower at home is a different thing entirely.

## The bottom line

Fresh frozen vs cured cannabis is a harvest fork in the road. One path dries and cures the plant; the other freezes it soon after cutting and sends it to extraction. "Live" on a concentrate points to the frozen path. The label still does the real talking.

Coming by Weston Road? The [P60 visit page](/visit) has the details, and the [York weed dispensary page](/weed-dispensary-york) covers the area. P60 Cannabis is for adults 19 and over. Bring government-issued photo ID.`;

if (!BODY.startsWith(`# ${TITLE}\n`)) {
  throw new Error("Article H1 does not match the required title");
}
if (!BODY.includes("Last checked: October 27, 2026")) {
  throw new Error("Article is missing the Last checked line");
}
if (!BODY.includes(META_DESCRIPTION) || META_DESCRIPTION.length > 155) {
  throw new Error("Meta description must be one sentence from the intro, 155 characters or fewer");
}

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  mainEntityOfPage: CANONICAL,
  url: CANONICAL,
  datePublished: PUBLISHED,
  dateModified: PUBLISHED,
  author: {
    "@type": "Organization",
    name: "P60 Cannabis",
  },
  publisher: {
    "@type": "Organization",
    name: "P60 Cannabis",
  },
  description: META_DESCRIPTION,
};

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: META_DESCRIPTION,
  alternates: { canonical: CANONICAL },
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    title: TITLE,
    description: META_DESCRIPTION,
    url: CANONICAL,
    siteName: "P60 Cannabis",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: META_DESCRIPTION,
  },
};

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] && match[2]) {
      nodes.push(
        <a key={`${keyPrefix}-a-${index}`} href={match[2]}>
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      nodes.push(<strong key={`${keyPrefix}-s-${index}`}>{match[3]}</strong>);
    } else if (match[4]) {
      nodes.push(<em key={`${keyPrefix}-e-${index}`}>{match[4]}</em>);
    }
    last = match.index + match[0].length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBody(markdown: string) {
  return markdown
    .trim()
    .split(/\n\n+/)
    .map((block, index) => {
      const key = `block-${index}`;
      if (block.startsWith("# ")) {
        return <h1 key={key} dangerouslySetInnerHTML={{ __html: block.slice(2) }} />;
      }
      if (block.startsWith("## ")) {
        return <h2 key={key}>{renderInline(block.slice(3), key)}</h2>;
      }
      if (block.startsWith("|")) {
        const rows = block
          .split("\n")
          .filter((line) => !/^\|\s*-+/.test(line))
          .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
        const [head, ...bodyRows] = rows;
        return (
          <div key={key} className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {head.map((cell, cellIndex) => (
                    <th key={`${key}-h-${cellIndex}`} scope="col">
                      {cell ? renderInline(cell, `${key}-h-${cellIndex}`) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rowIndex) => (
                  <tr key={`${key}-r-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${key}-c-${rowIndex}-${cellIndex}`}>
                        {renderInline(cell, `${key}-c-${rowIndex}-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      const lines = block.split("\n");
      if (lines.every((line) => line.startsWith("- "))) {
        return (
          <ul key={key}>
            {lines.map((line, lineIndex) => (
              <li key={`${key}-li-${lineIndex}`}>{renderInline(line.slice(2), `${key}-li-${lineIndex}`)}</li>
            ))}
          </ul>
        );
      }
      if (lines.every((line) => /^\d+\. /.test(line))) {
        return (
          <ol key={key}>
            {lines.map((line, lineIndex) => (
              <li key={`${key}-ol-${lineIndex}`}>
                {renderInline(line.replace(/^\d+\. /, ""), `${key}-ol-${lineIndex}`)}
              </li>
            ))}
          </ol>
        );
      }
      return <p key={key}>{renderInline(block, key)}</p>;
    });
}

export default function FreshFrozenVsCuredCannabisPage() {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <article className={styles.article}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c") }}
          />
          {renderBody(BODY)}
        </article>
      </main>
      <Footer />
    </>
  );
}
