import { createHash } from "node:crypto";
import { parseFlowerSku } from "./flowerSku.ts";
import type { SheetRow } from "./types.ts";

export const PAPER_BATCH = "PAPER-PNY01-U11-02-2026-064947";

const PAPER_TSV = `sku	name	3g	5g	14g	28g	qty
105	SPACE COOKIES				2	
106	GRANDADDY PURPLE				2	
107	NORTHERN LIGHTS				2	
170	JOKERZ	10			2	
172	LAVENDER KUSH	10			2	
187	CHOCOLATE KUSH	10			2	
188	PRE-ROLL PINK					50
189	AMNESIA HAZE 1G SAT					50
202	WHITE RHINO		3	1		
203	BLACK DIAMOND		3	1		
204	ROYAL GORILLA		3	1		
205	PINK STICKY ALIEN		3	1		
216	PURPLE DRAGON (S)		3	1		
219	SNOOP DOG KUSH		3	1		
222	GORILLA BUTTER		3	1		
224	ICE CREAM CAKE		3	1		
225	PURPLE KUSH OG		3	1		
231	SHATTER BAR INDICA					1
232	SHATTER BAR SATIVA					1
236	CRITICAL KUSH		3	1		
240	GRABBA					30
261	DAYDREAM DIESEL		3	1		
313	TENTH PLANET	2	2			
315	CANDY BRAIN PINK	2				
323	PINK GODZILLA	2	2			
328	SWEETHEART	2	2			
331	PINK SCORPION	2	2			
332	CALI PINK	2	2			
337	GOLDEN GAS	2	2			
340	FROZEN GRAPES	2	2			
345	GAS FACE	2	2			
347	PINK JEFE	2	2			
350	PURPLE HAZE	2	2			
373	CANDY KRUSH (S)	2	2			
376	OG KUSH	2	2			
388	AAA PINK KUSH 1G IND					20
389	AAA LAUGHING					20
403	PINK DIESEL	1	1			
404	REAPER DEATH PINK	1	1			
418	STRAWBERRY	1	1			
420	CHOCOLATE CHIP	1	1			
424	CRACK PINK	1	1			
425	COSMIC COOKIES	1	1			
426	PINK CADILAC	1	1			
427	PINK ALIEN COOKIES	1	1			
428	PINK SKYWALKER	1				
430	PLATINUM ROCKSTAR	1	1			
431	BLACK GAS	1	1			
474	PINK DEATH STAR	1	1			
488	PREMIUM - PINK					20
489	PREMIUM - MAUI					20
499	BLACK MAMBA (AAAA+)	1	1			
502	ALIEN SMACK PINK	1	1			
503	STRIPPERS SPIT	1	1			
506	PINK SUPERMAN	1	1			
509	JEDI PINK	1	1			
510	BLUE WAGU	1	1			
511	ASTRO PINK OG	1	1			
517	PINK POCKET	1	1			
563	PURPLE SKUNK SALE	1	1			
564	DANK SHATTER BAR					1
565	DANK SHATTER BAR					1
566	DANK SHATTER BAR					1
588	EXOTIC PINK					10
589	EXOTIC STRAWBERRY					10
593	MIKE TYSON KO	1	1			
600	MELON HEADZ					1
601	CHERRY BLASTERS					1
606	MELON HEADZ					1
`;

const SIZES = ["3g", "5g", "14g", "28g"] as const;

export type PaperLine = { sku: string; name: string; qty: number };

function stableUuid(key: string) {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = "89ab"[Number.parseInt(hex[16] ?? "0", 16) % 4] ?? "8";
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function paperLines(): PaperLine[] {
  const lines = PAPER_TSV.trim().split("\n");
  const header = lines[0]?.split("\t") ?? [];
  const col = (name: string) => header.indexOf(name);
  const rows: PaperLine[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split("\t");
    const sku = (cells[col("sku")] ?? "").trim();
    const name = (cells[col("name")] ?? "").trim();
    if (!sku) continue;
    for (const size of SIZES) {
      const qty = (cells[col(size)] ?? "").trim();
      if (!qty) continue;
      rows.push({ sku: `${sku}-${size}`, name: `${name} ${size}`, qty: Number(qty) });
    }
    const plain = (cells[col("qty")] ?? "").trim();
    if (plain) rows.push({ sku, name, qty: Number(plain) });
  }
  return rows.filter((row) => Number.isInteger(row.qty) && row.qty > 0);
}

function unsized(sku: string) {
  return !parseFlowerSku(sku);
}

export function planPaperRefills(existing: SheetRow[], catalogSkus: Set<string>) {
  const already = existing.some((row) => (row.batch_id ?? "") === PAPER_BATCH);
  const cancel = existing.flatMap((row) => {
    const sku = (row.sku ?? "").trim();
    const store = (row.store_code ?? "").trim();
    if (store && store !== "PNY01") return [];
    if (!sku || !unsized(sku)) return [];
    if ((row.batch_id ?? "") === PAPER_BATCH) return [];
    if ((row.kitchen_status ?? "").toUpperCase() === "CANCELLED") return [];
    const { _sheet_row, ...rest } = row;
    return [{ ...rest, kitchen_status: "CANCELLED" }];
  });
  const add = already
    ? []
    : paperLines().map((line) => {
        const id = stableUuid(`${PAPER_BATCH}:${line.sku}`);
        return {
          row_id: id,
          kitchen_row_id: id,
          batch_id: PAPER_BATCH,
          store_code: "PNY01",
          sku: line.sku,
          name: line.name,
          qty: String(line.qty),
          qty_sent: String(line.qty),
          kind: "REFILL",
          kitchen_status: "ACTIVE",
          created_at: "2026-11-04T00:00:00.000Z",
        };
      });
  const flagged = paperLines()
    .filter((line) => !catalogSkus.has(line.sku))
    .map((line) => line.sku);
  return { cancel, add, flagged, units: paperLines().reduce((sum, line) => sum + line.qty, 0) };
}
