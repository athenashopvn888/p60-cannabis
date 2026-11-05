import type { Metadata } from "next";
import type { ReactNode } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import styles from "./article.module.css";

const TITLE = "How to Use a Bong: A Calm, Step-by-Step Guide from Weston Road";
const CANONICAL = "https://www.p60cannabis.com/resources/how-to-use-a-bong";
const PUBLISHED = "2026-11-05";
const META_DESCRIPTION =
  "This is P60 Cannabis's plain walkthrough of how to use a bong, written for adults 19+ who would like a calm explanation rather than a dare.";

const BODY = `# How to Use a Bong: A Calm, Step-by-Step Guide from Weston Road

Last checked: October 30, 2026

A bong looks more complicated than it is. A chamber, some water, a stem and a bowl. Once you know what each part does, the rest follows. This is P60 Cannabis's plain walkthrough of **how to use a bong**, written for adults 19+ who would like a calm explanation rather than a dare. No product picks and no claims about effects.

## Glossary first: the parts of a bong

- **Base:** the bottom chamber that holds water.
- **Tube (neck):** the long upright section.
- **Mouthpiece:** the opening at the top.
- **Downstem:** the narrow tube that runs from the bowl into the water.
- **Bowl (slide):** the removable cup that holds the flower.
- **Carb:** a hole on some bongs that you cover and uncover. Many bongs use the slide instead: you lift it out to clear the chamber.
- **Percolator:** an optional diffuser inside the tube.
- **Ice catcher:** small notches in the neck on some designs.

## Step 1: Add water

Pour cool water through the mouthpiece until the bottom of the downstem sits just under the surface. A short way under is enough. Too much water and it splashes up the tube when you pull. Too little and the smoke never passes through it.

Test it with a gentle pull before you load anything. You should hear an even bubbling, not a splash.

## Step 2: Prepare the flower

Break the flower into even, coarse pieces. Bong slides pull hard, so a fine grind gets sucked into the downstem. Remove any stems.

## Step 3: Pack the slide

Load the slide loosely to the rim, never heaped above it. Press very lightly so it holds together when tipped. A larger piece at the bottom helps keep smaller bits from being pulled through.

## Step 4: Get into position

Hold the bong by the base or the lower tube with one hand, keeping it upright. Place your mouth inside the mouthpiece rim, not on top of it, so the seal is airtight. Have your lighter in the other hand.

## Step 5: Light and pull slowly

Bring the flame to one edge of the bowl and pull gently. Slow and steady is the method. The chamber fills as you pull. There's no need to empty it in one breath.

## Step 6: Clear the chamber

When you're ready, lift the slide out (or release the carb) and pull to clear the chamber. Then replace the slide.

## Step 7: Empty and rinse afterwards

Old water smells bad quickly. Pour it out after each session and rinse the base with fresh water. A regular clean with isopropyl alcohol and coarse salt keeps resin from building up.

## Common first-time mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Too much water | Water reaches your mouth | Fill to just above the downstem |
| Grind too fine | Flower pulled into water | Use a coarser grind |
| Lips on top of the rim | Air leaks, weak pull | Mouth inside the rim |
| Lighting the whole bowl | Burns through at once | Light one edge |
| Pulling too hard | Water splashes up the tube | Slow, steady pull |

## Etiquette and safety at home

- Keep the bong on a stable, flat surface when it's not in your hands. Glass breaks.
- Keep lighters away from curtains and paper.
- Store glass out of reach of children and pets.
- Don't share a mouthpiece without wiping it.

## Bong, pipe or pre-roll?

They're simply different formats. Some people prefer pre-rolls because they need no equipment and no cleaning. Our comparison of [pre-rolls vs flower](/resources/pre-roll-guides/pre-rolls-vs-flower) sets out the trade-offs, and our [cannabis 101 hub](/resources/cannabis-101) covers the basics in one place.

## Quick answers

**How much water do I put in a bong?** Just enough to cover the bottom of the downstem.

**Do I need ice?** No. It's optional on designs with an ice catcher.

**Is there a right way for how to use a bong?** The steps above are the standard method; adjust to your piece.

## Learn more at P60 Cannabis

P60 Cannabis is at 1938 Weston Rd, Toronto. Want to know how freshly harvested flower differs from cured flower? Read our [fresh frozen vs cured](/resources/fresh-frozen-vs-cured-cannabis) explainer. Adults 19+ only. Bring government-issued photo ID.`;

if (!BODY.startsWith(`# ${TITLE}\n`)) {
  throw new Error("Article H1 does not match the required title");
}
if (!BODY.includes("Last checked: October 30, 2026")) {
  throw new Error("Article is missing the Last checked line");
}
const plainBody = BODY.replace(/\*\*/g, "");
if (!plainBody.includes(META_DESCRIPTION) || META_DESCRIPTION.length > 155) {
  throw new Error("Meta description must be one sentence from the intro, 155 characters or fewer");
}
const articleLinks = [...BODY.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
const allowedLinks = [
  "/resources/cannabis-101",
  "/resources/fresh-frozen-vs-cured-cannabis",
  "/resources/pre-roll-guides/pre-rolls-vs-flower",
];
if (articleLinks.length !== allowedLinks.length || articleLinks.some((href) => !allowedLinks.includes(href))) {
  throw new Error("Article links must stay limited to the three body links");
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

export default function HowToUseABongPage() {
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
