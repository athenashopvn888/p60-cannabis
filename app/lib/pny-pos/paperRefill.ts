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

/** Plain pack and unit counts. 593, 600, 601, and 606 are already in part 1. */
const PAPER_PART2_TSV = `sku	name	qty
607	CHERRY BLASTERS	1
609	BUZZY PEACHES	1
610	BERRY BOMBS	1
611	STONED BERRIES	1
612	BERRY BOMBS	1
613	STELLAR GUMMIES	1
614	STELLAR GUMMIES	1
615	STELLAR GUMMIES	1
631	MINDF'CK CHOCO	1
633	MIND F'CK GUMMIES	1
635	TRIPNOTIK MILK	1
636	TRIPNOTIK DARK	1
637	TRIPNOTIK GUMMIES	1
643	SHATTER IND 150 MG	1
644	SHATTER SAT 150 MG	1
645	SHATTER IND 600 MG	1
646	SHATTER SAT 600 MG	1
650	Galaxy Gummies INDICA	1
651	Galaxy Gummies SATIVA	1
655	KNOCK OUT LW	1
656	KNOCK OUT MW	1
657	KNOCK OUT HW	1
668	red ROSE GRABBA	2
669	red HERRING GRABBA	2
680	SOUR 150MG	1
681	SOUR 150MG	1
691	STONER PATCH THC	1
701	BACKWOODS RUSSIAN	1
704	BACKWOODS HONEY	1
705	BACKWOODS VANILLA	1
706	BACKWOODS HONEY	1
707	BACKWOODS BLACK	1
709	RAW CONNOISSEUR	5
710	RAW KING SIZE BLACK	10
711	RAW PAPER ORGANIC	5
713	RAW PAPER CONES	2
714	BACKWOODS CIGAR	1
717	RAW PAPER CONES	2
720	LIGHTER BIG	10
721	BACKWOODS	1
800	GAS GANG THCVape N	1
803	2g GAS GANG Vol.3	1
813	DRIZZLE SWITCH 3in1	1
861	GC DARTH VADER	1
868	NEW AFGHAN HASH	1
887	GOOBER NVape PEN	2
888	GOOBER NVape PEN	2
889	GOOBER NVape PEN	2
921	MARS ROCKETS	1
930	KNOCK-OUT HYBRID	1
931	KNOCK-OUT INDICA	1
932	KNOCK-OUT SATIVA	1
933	KNOCK-OUT GRABBA	1
940	2G VAPE KNOCK-OUT	1
945	MOONROCKETS	1
946	MOONROCKETS	1
947	MOONROCKETS	1
960	FRAZZLE STILLIEZL	1
961	DUMMY BEARS 200MG	1
962	DUMMY BEARS	1
963	DUMMY BEARS	1
965	GOOBER THC	1
969	NERD BOMBS 2x200mg	1
1000	BB LIGHTS	30
1002	BB FULL	30
1005	CANADIAN LIGHTS	20
1006	CANADIAN FULL	20
1008	PUTTERS	10
1010	PLAYFARE	10
1011	CANADIAN GOOSE	10
1012	CANADIAN GOOSE	10
1013	CANADIAN MENTHOL	10
1014	CANADIAN CLASSICS	10
1015	CANADIAN CLASSICS	10
1016	ROLLED GOLD LIGHTS	10
1017	NEXUS FULL	10
1018	NEXUS LIGHTS	10
1019	TIME FULL	10
1026	BELMONT KING SIZE	8
1027	MARLBORO	10
1061	FLAVOR BEAST 50K	1
1070	GEEK UNIVERSE 25K	1
1072	GEEK PROMAX 30K	1
1080	OVNS 2500 5% NVape	1
1081	OVNS 10000 5% NVape	1
1082	OVNS 22K NVape	1
1084	OVNS DISPOSABLE	1
`;

const SIZES = ["3g", "5g", "14g", "28g"] as const;
const ALREADY_LOADED = new Set(["593", "600", "601", "606"]);

export type PaperLine = { sku: string; name: string; qty: number };

function stableUuid(key: string) {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = "89ab"[Number.parseInt(hex[16] ?? "0", 16) % 4] ?? "8";
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function linesFromSizedSheet(tsv: string): PaperLine[] {
  const lines = tsv.trim().split("\n");
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

export function paperPart2Lines(): PaperLine[] {
  const lines = PAPER_PART2_TSV.trim().split("\n");
  const rows: PaperLine[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [skuRaw, nameRaw, qtyRaw] = line.split("\t");
    const sku = (skuRaw ?? "").trim();
    const name = (nameRaw ?? "").trim();
    const qty = Number((qtyRaw ?? "").trim());
    if (!sku || ALREADY_LOADED.has(sku) || !Number.isInteger(qty) || qty <= 0) continue;
    rows.push({ sku, name, qty });
  }
  return rows;
}

export function paperLines(): PaperLine[] {
  return [...linesFromSizedSheet(PAPER_TSV), ...paperPart2Lines()];
}

function unsized(sku: string) {
  return !parseFlowerSku(sku);
}

function loadedSkus(existing: SheetRow[]) {
  const skus = new Set<string>();
  for (const row of existing) {
    const store = (row.store_code ?? "").trim();
    if (store && store !== "PNY01") continue;
    if ((row.kitchen_status ?? "").toUpperCase() === "CANCELLED") continue;
    const sku = (row.sku ?? "").trim();
    if (sku) skus.add(sku);
  }
  return skus;
}

function refillRow(line: PaperLine, createdAt: string) {
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
    created_at: createdAt,
  };
}

export function planPaperRefills(existing: SheetRow[], catalogSkus: Set<string>): { cancel: SheetRow[]; add: SheetRow[]; flagged: string[]; units: number } {
  const loaded = loadedSkus(existing);
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
  const part2 = new Set(paperPart2Lines().map((line) => line.sku));
  const add = paperLines()
    .filter((line) => !loaded.has(line.sku))
    .map((line) => refillRow(line, part2.has(line.sku) ? "2026-11-04T01:45:00.000Z" : "2026-11-04T00:00:00.000Z"));
  const flagged = paperLines()
    .filter((line) => !catalogSkus.has(line.sku))
    .map((line) => line.sku);
  return { cancel, add, flagged, units: paperLines().reduce((sum, line) => sum + line.qty, 0) };
}
