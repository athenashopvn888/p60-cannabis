"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./tv.module.css";

/* -- Types -- */
interface PricePoint { regular: number; sale: number | null; }
interface Flower {
  sku: string; name: string; tier: string; type: "indica"|"sativa"|"hybrid";
  isHot: boolean; isSale: boolean; isMustTry?: boolean; thc: string;
  price3g: PricePoint|null; price5g: PricePoint|null;
  price14g: PricePoint|null; price28g: PricePoint|null;
  image: string; promoImage?: string|null;
}
interface Item {
  sku: string; name: string; category: string; type: string;
  thc: string; mg: string; price: string; image: string;
}

/* -- Constants -- */
const TIER_ACCENT: Record<string,string> = {
  EXOTIC:"#dc2626", PREMIUM:"#f97316", "AAA+":"#2563eb",
  AA:"#ea580c", BUDGET:"#16a34a", OZ:"#db2777"
};
const TIER_CROWN: Record<string,string> = {
  EXOTIC:"👑", PREMIUM:"👑", "AAA+":"👑", AA:"🏅", BUDGET:"💰", OZ:"🎯"
};
const TIER_UNIT: Record<string,string> = {
  EXOTIC:"$20/G", PREMIUM:"$15/G", "AAA+":"$10/G", AA:"$4/g", BUDGET:"$3/g"
};
const TIER_DEAL: Record<string,string> = {
  EXOTIC:"Buy 3g Get 3 FREE", PREMIUM:"Buy 3g Get 3 FREE",
  "AAA+":"Buy 3g Get 3 FREE", BUDGET:"$10 / 3g Special"
};

/* -- Helpers -- */
function fmtTHC(v: string): string {
  const s = String(v||"").trim(); if (!s) return "";
  const n = parseFloat(s);
  if (!isNaN(n)) return (n <= 1 ? Math.round(n*100) : Math.round(n)) + "%";
  return s;
}

/* -- Price cell with strikethrough for sale -- */
function PriceCell({ pp, color }: { pp: PricePoint|null; color?: string }) {
  if (!pp) return <span>-</span>;
  if (pp.sale !== null && pp.sale !== pp.regular) {
    return (
      <span>
        <span className={styles.oldPrice}>${pp.regular}</span>
        <b className={`${styles.salePrice} ${color || ''}`}>${pp.sale}</b>
      </span>
    );
  }
  return <b className={color || ''}>${pp.regular}</b>;
}

/* -- Type badge component -- */
function TypeTag({ type }: { type: string }) {
  const t = type?.toLowerCase();
  const label = t === "sativa" ? "SAT" : t === "indica" ? "IND" : t === "hybrid" ? "HYB" : "";
  if (!label) return null;
  const cls = t === "sativa" ? styles.tagSat : t === "indica" ? styles.tagInd : styles.tagHyb;
  return <span className={`${styles.tag} ${cls}`}>{label}</span>;
}

/* -- Vibe card -- */
const VIBE_MAP: Record<string, [string,string][]> = {
  indica: [["🛋️","Couch Lock"],["😌","Relax"],["🌙","Sleepy"]],
  sativa: [["⚡","Energy"],["🧠","Cerebral"],["🚀","Uplift"]],
  hybrid: [["🧘","Balance"],["🌿","Calm"],["✨","Creative"]],
};
function VibeCard({ type }: { type: string }) {
  const t = type?.toLowerCase();
  const vibes = VIBE_MAP[t] || VIBE_MAP.hybrid;
  return (
    <div className={styles.vibeSection}>
      <div className={styles.vibeHead}>EFFECTS</div>
      <div className={styles.vibePills}>
        {vibes.map(([emoji, label]) => (
          <span key={label} className={styles.vibePill}>
            <span className={styles.vibeEmoji}>{emoji}</span>
            <span className={styles.vibeLabel}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* -- Helpers -- */
function isShreds(name: string): boolean {
  return /shred/i.test(name);
}
function hasSalePrice(f: Flower): boolean {
  return !!(f.price3g?.sale || f.price5g?.sale || f.price14g?.sale || f.price28g?.sale);
}
function hasNameSale(name: string): boolean {
  return /\bSALE\b/i.test(name) || /ON\s*SALE/i.test(name);
}
function cleanName(name: string): string {
  return name
    .replace(/\s*\(?\s*AAA\+?\s*ON\s*SALE\s*\)?\s*$/i, '')
    .replace(/\s*\(?\s*AAA\+?\s*SALE!?\s*\)?\s*$/i, '')
    .replace(/\s*\bSALE!?\s*$/i, '')
    .replace(/\s*\bON\s*SALE\s*$/i, '')
    .trim();
}

/* ============================================================
   SLOT RESERVATION SYSTEM (matches original TVMenu.html)
   ============================================================
   Each tier shows max 10 rows at a time with reserved slots:
   SALE (max 2) → TOP PICK (max 1) → MUST TRY (max 1) → SATIVA (max 3) → INDICA (fills rest)
   Products rotate through their bucket windows over time.
   ============================================================ */
const MAX_VIS = 10;
const CAP_SALE = 2;
const CAP_TOP  = 1;
const CAP_MUST = 1;
const CAP_SAT  = 3;
const CAP_IND  = 3;

/** Build the visible window for a tier using the slot reservation system */
function buildSlotWindow(flowers: Flower[], hiIdx: number): { vis: Flower[]; hiW: number; hi: Flower | undefined } {
  if (!flowers.length) return { vis: [], hiW: 0, hi: undefined };

  // 1) Sort into buckets
  const saleAll: Flower[] = [];
  const topAll: Flower[] = [];
  const mustAll: Flower[] = [];
  const satAll: Flower[] = [];
  const indAll: Flower[] = [];

  for (const f of flowers) {
    if (f.isSale) { saleAll.push(f); continue; }
    if (f.isHot) { topAll.push(f); continue; }
    if (f.isMustTry) { mustAll.push(f); continue; }
    if (f.type === "sativa") satAll.push(f);
    else indAll.push(f);
  }

  // 2) Only first 1 TOP / 1 MUST — extras fall back to SAT/IND by type
  const topWin = topAll.slice(0, CAP_TOP);
  for (const r of topAll.slice(CAP_TOP)) {
    (r.type === "sativa" ? satAll : indAll).push(r);
  }
  const mustWin = mustAll.slice(0, CAP_MUST);
  for (const r of mustAll.slice(CAP_MUST)) {
    (r.type === "sativa" ? satAll : indAll).push(r);
  }

  // 3) Rotate offsets based on hiIdx (batch rotation)
  const cycle = Math.floor(hiIdx / MAX_VIS);

  // SALE: pick CAP_SALE items to show, overflow the REST into SAT/IND by type
  const saleOff = saleAll.length > CAP_SALE
    ? (cycle * CAP_SALE) % saleAll.length
    : 0;
  const saleWin: Flower[] = [];
  const saleOverflow: Flower[] = [];
  for (let i = 0; i < saleAll.length; i++) {
    const inWindow = saleAll.length <= CAP_SALE ||
      (i >= saleOff && i < saleOff + CAP_SALE) ||
      (saleOff + CAP_SALE > saleAll.length && i < (saleOff + CAP_SALE) % saleAll.length);
    if (inWindow && saleWin.length < CAP_SALE) {
      saleWin.push(saleAll[i]);
    } else {
      saleOverflow.push(saleAll[i]);
    }
  }
  // Overflow sale items go back to SAT/IND by type
  for (const r of saleOverflow) {
    (r.type === "sativa" ? satAll : indAll).push(r);
  }

  // SAT: rotate through all sativa items, CAP_SAT at a time
  const satOff = satAll.length > CAP_SAT
    ? (cycle * CAP_SAT) % satAll.length
    : 0;
  const satWin = satAll.length > CAP_SAT
    ? Array.from({length: CAP_SAT}, (_, i) => satAll[(satOff + i) % satAll.length])
    : satAll.slice(0, CAP_SAT);

  // IND: fills remaining slots
  const used = saleWin.length + topWin.length + mustWin.length + satWin.length;
  const remaining = Math.max(0, MAX_VIS - used);
  const indCap = Math.max(CAP_IND, remaining);
  const indOff = indAll.length > indCap
    ? (cycle * indCap) % indAll.length
    : 0;
  const indWin = indAll.length > indCap
    ? Array.from({length: indCap}, (_, i) => indAll[(indOff + i) % indAll.length])
    : indAll.slice(0, indCap);

  // 4) Assemble in fixed order: SALE → TOP → MUST → SAT → IND
  const vis = [...saleWin, ...topWin, ...mustWin, ...satWin, ...indWin].slice(0, MAX_VIS);

  // 5) Highlight within the visible window
  const hiW = vis.length ? hiIdx % vis.length : 0;
  const hi = vis[hiW] || flowers[0];

  return { vis, hiW, hi };
}

/* ============================================================
   FLOWER CARD
   ============================================================ */
function FlowerCard({
  tier, flowers, hiIdx, cardCls, tierCls, badgeCls
}: {
  tier: string; flowers: Flower[]; hiIdx: number;
  cardCls: string; tierCls: string; badgeCls: string;
}) {
  const accent = TIER_ACCENT[tier] || "#2563eb";

  const { vis, hiW, hi } = buildSlotWindow(flowers, hiIdx);

  const prevRef = useRef<string>("");
  const [fadeImg, setFadeImg] = useState("");
  const [prevImg, setPrevImg] = useState("");

  useEffect(() => {
    if (hi?.image && hi.image !== prevRef.current) {
      setPrevImg(prevRef.current);
      setFadeImg(hi.image);
      prevRef.current = hi.image;
    }
  }, [hi?.image]);

  const isTop3 = ["EXOTIC","PREMIUM","AAA+"].includes(tier);
  const isAA = tier === "AA";
  const isBudget = tier === "BUDGET";

  return (
    <div className={`${styles.card} ${cardCls} ${tierCls}`}>
      {/* HEADER */}
      <div className={`${styles.cardHeader} ${isTop3 ? styles.headerSheen : ""}`}
        style={{ background:`linear-gradient(180deg, ${accent} 0%, color-mix(in srgb, ${accent} 82%, #000 18%) 100%)` }}>
        <span className={styles.tierCrown}>{TIER_CROWN[tier]||"🌿"}</span>
        <span className={styles.headerTitle}>
          {isTop3 ? (
            <div className={styles.dealScroller}>
              <span className={styles.dealScrollInner}>
                <span>Buy 2g Get 1g FREE</span>
                <span>Buy 3g Get 3g FREE</span>
              </span>
            </div>
          ) : isAA ? <span className={styles.headerDeal}>$20 5g AA</span>
            : isBudget ? <span className={styles.headerDeal}>$10 / 3g Special</span>
            : TIER_DEAL[tier] ? <span className={styles.headerDeal}>{TIER_DEAL[tier]}</span> : null}
        </span>
        <div className={`${styles.tierBadge} ${badgeCls}`}>
          <span>{tier} {TIER_UNIT[tier]}</span>
        </div>
      </div>

      {/* BODY */}
      <div className={styles.cardBody}>
        {/* LEFT: Image + Detail */}
        <div className={styles.mediaSide}>
          <div className={styles.mediaFrame}>
            <div className={styles.mediaViewport}>
              {hi?.isSale && <div className={styles.saleBadge}>SALE</div>}
              {hi?.isHot && <div className={styles.topPickBadge}>TOP PICK</div>}
              {hi?.thc && <div className={styles.imgThcBadge}>{fmtTHC(hi.thc)}</div>}
              {prevImg && (
                <img src={prevImg} alt="" className={`${styles.budImg} ${styles.budImgFadeOut}`}
                  referrerPolicy="no-referrer" 
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
                const filename = t.src.split('/').pop();
                t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
              }
            }}
          />
              )}
              {fadeImg && (
                <img key={fadeImg} src={fadeImg} alt={hi?.name||""}
                  className={`${styles.budImg} ${styles.budImgFadeIn}`}
                  referrerPolicy="no-referrer" 
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
                const filename = t.src.split('/').pop();
                t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
              }
            }}
          />
              )}
              {hi?.type && (
                <div className={styles.imgTypeBadge}>
                  <span className={`${styles.imgType} ${
                    hi.type === "sativa" ? styles.imgTypeSat :
                    hi.type === "indica" ? styles.imgTypeInd : styles.imgTypeHyb
                  }`}>{hi.type.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Detail card */}
          <div className={styles.detailCard}>
            <div className={styles.detailAccent} style={{ background: accent }} />
            <div className={styles.detailName}>{hi?.name || ""}</div>
            <div className={styles.detailMeta}>
              {hi?.thc && <span className={styles.detailThc}>{fmtTHC(hi.thc)}</span>}
              {hi?.price3g && <><span className={styles.detailSep}>·</span><span>3g <b>${hi.price3g.sale ?? hi.price3g.regular}</b></span></>}
              {hi?.price5g && <><span className={styles.detailSep}>·</span><span>5g <b>${hi.price5g.sale ?? hi.price5g.regular}</b></span></>}
              {hi?.price14g && <><span className={styles.detailSep}>·</span><span>14g <b>${hi.price14g.sale ?? hi.price14g.regular}</b></span></>}
            </div>
          </div>

          {hi?.type && <VibeCard type={hi.type} />}
        </div>

        {/* RIGHT: List */}
        <div className={styles.listSide}>
          {/* Deal strip - top 3 only */}
          {isTop3 && (
            <div className={styles.dealStrip}>
              <div className={`${styles.dealBox} ${styles.dealBoxA}`}>
                <span className={styles.dealRotClip}>
                  <span className={`${styles.dealRotTrack} ${styles.dealTrackA}`}>
                    <span className={`${styles.dealRotLine} ${styles.dealTotal} ${styles.dealTotalGold}`}>3G TOTAL</span>
                    <span className={`${styles.dealRotLine} ${styles.dealBase}`}>Buy 2g</span>
                    <span className={`${styles.dealRotLine} ${styles.dealFree} ${styles.dealFreeGreen}`}>Get 1g FREE</span>
                    <span className={`${styles.dealRotLine} ${styles.dealTotal} ${styles.dealTotalGold}`}>3G TOTAL</span>
                  </span>
                </span>
              </div>
              <div className={`${styles.dealBox} ${styles.dealBoxB} ${styles.dealBoxBig}`}>
                <span className={styles.dealRotClip}>
                  <span className={`${styles.dealRotTrack} ${styles.dealTrackB}`}>
                    <span className={`${styles.dealRotLine} ${styles.dealTotal} ${styles.dealTotalRed}`}>6G TOTAL</span>
                    <span className={`${styles.dealRotLine} ${styles.dealBase}`}>Buy 3g</span>
                    <span className={`${styles.dealRotLine} ${styles.dealFree} ${styles.dealFreeGreen}`}>Get 3g FREE</span>
                    <span className={`${styles.dealRotLine} ${styles.dealTotal} ${styles.dealTotalRed}`}>6G TOTAL</span>
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Column headers */}
          {isTop3 ? (
            <div className={`${styles.listHead} ${styles.tTop3}`}>
              <div className={styles.mh}>Strain</div>
              <div className={styles.mh}>THC</div>
              <div className={styles.mh}>Price</div>
            </div>
          ) : isAA ? (
            <div className={`${styles.listHead} ${styles.tAA}`}>
              <div className={styles.mh}>Strain</div>
              <div className={styles.mh}>THC</div>
              <div className={styles.mh}>Price</div>
            </div>
          ) : (
            <div className={`${styles.listHead} ${styles.tBudget}`}>
              <div className={styles.mh}>Strain</div>
              <div className={styles.mh}>THC</div>
              <div className={styles.mh}>Price</div>
            </div>
          )}

          {vis.map((f, i) => {
            const isHi = i === hiW;
            const hiStyle = isHi ? {
              borderColor: `color-mix(in srgb, ${accent} 70%, rgba(2,6,23,.18) 30%)`,
              boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 50%, transparent 50%), 0 8px 20px rgba(2,6,23,.18), 0 0 28px color-mix(in srgb, ${accent} 70%, transparent 30%)`
            } : undefined;

            if (isTop3) {
              const p3 = f.price3g; const p5 = f.price5g;
              return (
                <div key={f.sku+i} className={`${styles.row} ${styles.tTop3} ${isHi?styles.rowHi:""}${f.isSale?" "+styles.rowSale:""}`} style={hiStyle}>
                  <div className={`${styles.mc} ${styles.mcStrain}`}>
                    {f.name}
                    {f.isSale && <span className={`${styles.tag} ${styles.tagSale}`}>SALE</span>}
                    {f.isHot && <span className={`${styles.tag} ${styles.tagHot}`}>TOP PICK</span>}
                    {f.isMustTry && <span className={`${styles.tag} ${styles.tagMust}`}>MUST TRY</span>}
                    <TypeTag type={f.type} />
                  </div>
                  <div className={`${styles.mc} ${styles.mcThc}`}>{fmtTHC(f.thc)}</div>
                  <div className={`${styles.mc} ${styles.mcPrice} ${styles.mcPriceDeal}`}>
                    {p3 && (
                      <div className={styles.pLine}>
                        <span className={styles.pLab}>{f.isSale ? "3G=" : "2G-3G"}</span>
                        <PriceCell pp={p3} color={styles.priceGreen} />
                      </div>
                    )}
                    {p5 && (
                      <div className={styles.pLine}>
                        <span className={styles.pLab}>{f.isSale ? "6G=" : "3G-6G"}</span>
                        <PriceCell pp={p5} color={styles.priceBlue} />
                      </div>
                    )}
                    {!p3 && !p5 && f.price14g && (
                      <div className={styles.pLine}>
                        <span className={styles.pLab}>14G</span>
                        <PriceCell pp={f.price14g} color={styles.priceBlue} />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (isAA) {
              return (
                <div key={f.sku+i} className={`${styles.row} ${styles.tAA} ${isHi?styles.rowHi:""}${f.isSale?" "+styles.rowSale:""}`} style={hiStyle}>
                  <div className={`${styles.mc} ${styles.mcStrain}`}>
                    {f.name}
                    {f.isSale && <span className={`${styles.tag} ${styles.tagSale}`}>SALE</span>}
                    {f.isHot && <span className={`${styles.tag} ${styles.tagHot}`}>TOP PICK</span>}
                    {f.isMustTry && <span className={`${styles.tag} ${styles.tagMust}`}>MUST TRY</span>}
                    <TypeTag type={f.type} />
                  </div>
                  <div className={`${styles.mc} ${styles.mcThc}`}>{fmtTHC(f.thc)}</div>
                  <div className={`${styles.mc} ${styles.mcPrice} ${styles.mcPriceDeal}`}>
                    {f.price5g && (
                      <div className={styles.pLine}>
                        <span className={styles.pLab}>5g</span>
                        <PriceCell pp={f.price5g} color={styles.priceGreen} />
                      </div>
                    )}
                    {f.price14g && (
                      <div className={styles.pLine}>
                        <span className={styles.pLab}>14g</span>
                        <PriceCell pp={f.price14g} color={styles.priceBlue} />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // BUDGET
            return (
              <div key={f.sku+i} className={`${styles.row} ${styles.tBudget} ${isHi?styles.rowHi:""}${f.isSale?" "+styles.rowSale:""}`} style={hiStyle}>
                <div className={`${styles.mc} ${styles.mcStrain}`}>
                  {f.name}
                  {f.isSale && <span className={`${styles.tag} ${styles.tagSale}`}>SALE</span>}
                  {f.isHot && <span className={`${styles.tag} ${styles.tagHot}`}>TOP PICK</span>}
                  {f.isMustTry && <span className={`${styles.tag} ${styles.tagMust}`}>MUST TRY</span>}
                  <TypeTag type={f.type} />
                </div>
                <div className={`${styles.mc} ${styles.mcThc}`}>{fmtTHC(f.thc)}</div>
                <div className={`${styles.mc} ${styles.mcPrice} ${styles.mcPriceDeal}`}>
                  {f.price3g && (
                    <div className={styles.pLine}>
                      <span className={styles.pLab}>3g</span>
                      <PriceCell pp={f.price3g} color={styles.priceGreen} />
                    </div>
                  )}
                  {f.price28g && (
                    <div className={styles.pLine}>
                      <span className={styles.pLab}>oz</span>
                      <PriceCell pp={f.price28g} color={styles.pricePink} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   OZ CARD
   ============================================================ */
function OZCard({ flowers, hiIdx }: { flowers: Flower[]; hiIdx: number }) {
  const accent = "#db2777";
  const sativa = flowers.filter(f => f.type === "sativa");
  const indica = flowers.filter(f => f.type !== "sativa");
  const hi = flowers[hiIdx] || flowers[0];

  const prevRef = useRef<string>("");
  const [fadeImg, setFadeImg] = useState("");
  const [prevImg, setPrevImg] = useState("");
  useEffect(() => {
    if (hi?.image && hi.image !== prevRef.current) {
      setPrevImg(prevRef.current);
      setFadeImg(hi.image);
      prevRef.current = hi.image;
    }
  }, [hi?.image]);

  return (
    <div className={`${styles.card} ${styles.cardOz} ${styles.tierOz}`}>
      <div className={`${styles.cardHeader}`}
        style={{ background:`linear-gradient(180deg, ${accent} 0%, color-mix(in srgb, ${accent} 82%, #000 18%) 100%)` }}>
        <span className={styles.tierCrown}>🎯</span>
        <span className={styles.headerTitle}><span className={styles.headerDeal}>$40 up OZ</span></span>
        <div className={`${styles.tierBadge} ${styles.tierBadgeOz}`}><span>OZ</span></div>
      </div>

      <div className={styles.ozBody}>
        <div className={styles.ozTop}>
          <div className={styles.ozImgWrap}>
            <div className={styles.mediaViewport}>
              {hi?.isHot && <div className={styles.topPickBadge}>TOP PICK</div>}
              {prevImg && <img src={prevImg} alt="" className={`${styles.budImg} ${styles.budImgFadeOut}`} referrerPolicy="no-referrer" 
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
                const filename = t.src.split('/').pop();
                t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
              }
            }}
          />}
              {fadeImg && <img key={fadeImg} src={fadeImg} alt={hi?.name||""} className={`${styles.budImg} ${styles.budImgFadeIn}`} referrerPolicy="no-referrer" 
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
                const filename = t.src.split('/').pop();
                t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
              }
            }}
          />}
              {hi?.type && (
                <div className={styles.imgTypeBadge}>
                  <span className={`${styles.imgType} ${hi.type==="sativa"?styles.imgTypeSat:styles.imgTypeInd}`}>{hi.type.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
          <div className={styles.ozDetail}>
            <div className={styles.ozDetailName}>{hi?.name||""}</div>
            <div className={styles.ozDetailMeta}>
              {hi?.thc && <span className={styles.ozDetailThc}>{fmtTHC(hi.thc)}</span>}
              {hi?.price28g && <><span className={styles.ozDetailSep}>·</span><span className={styles.ozDetailPrice}>oz <b>${hi.price28g.sale ?? hi.price28g.regular}</b></span></>}
            </div>
            {hi?.type && <VibeCard type={hi.type} />}
          </div>
        </div>

        <div className={styles.ozCols}>
          <div className={styles.ozCol}>
            <div className={styles.ozColHead}>SATIVA</div>
            <div className={styles.ozColHeadSub}>
              <span>Strain</span><span>OZ</span>
            </div>
            {sativa.length === 0 && <div className={styles.ozEmpty}>-</div>}
            {sativa.map((f,i) => (
              <div key={f.sku+i} className={`${styles.ozRow} ${f===hi?styles.ozRowHi:""}`}>
                <span className={styles.ozName}>
                  {f.name}
                  {f.isSale && <span className={`${styles.tag} ${styles.tagSale}`}>SALE</span>}
                  {f.isHot && <span className={`${styles.tag} ${styles.tagHot}`}>TOP PICK</span>}
                  {f.isMustTry && <span className={`${styles.tag} ${styles.tagMust}`}>MUST TRY</span>}
                  <TypeTag type={f.type} />
                  <span style={{fontSize:14,opacity:0.6,marginLeft:4}}>{fmtTHC(f.thc)}</span>
                </span>
                <span className={styles.ozPrice}>${f.price28g?.sale ?? f.price28g?.regular ?? "-"}</span>
              </div>
            ))}
          </div>
          <div className={styles.ozCol}>
            <div className={styles.ozColHead}>INDICA</div>
            <div className={styles.ozColHeadSub}>
              <span>Strain</span><span>OZ</span>
            </div>
            {indica.map((f,i) => (
              <div key={f.sku+i} className={`${styles.ozRow} ${f===hi?styles.ozRowHi:""}`}>
                <span className={styles.ozName}>
                  {f.name}
                  {f.isSale && <span className={`${styles.tag} ${styles.tagSale}`}>SALE</span>}
                  {f.isHot && <span className={`${styles.tag} ${styles.tagHot}`}>TOP PICK</span>}
                  {f.isMustTry && <span className={`${styles.tag} ${styles.tagMust}`}>MUST TRY</span>}
                  <TypeTag type={f.type} />
                  <span style={{fontSize:14,opacity:0.6,marginLeft:4}}>{fmtTHC(f.thc)}</span>
                </span>
                <span className={styles.ozPrice}>${f.price28g?.sale ?? f.price28g?.regular ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ADDONS CARD
   ============================================================ */
function AddOnsCard({ items, hiIdx }: { items: Item[]; hiIdx: number }) {
  const hi = items[hiIdx] || items[0];

  const prevRef = useRef<string>("");
  const [fadeImg, setFadeImg] = useState("");
  const [prevImg, setPrevImg] = useState("");
  useEffect(() => {
    if (hi?.image && hi.image !== prevRef.current) {
      setPrevImg(prevRef.current);
      setFadeImg(hi.image);
      prevRef.current = hi.image;
    }
  }, [hi?.image]);

  return (
    <div className={`${styles.card} ${styles.cardAddons}`}>
      <div className={styles.cardHeader}
        style={{ background:"linear-gradient(180deg, #16a34a 0%, #0d7a38 100%)", fontSize:28, justifyContent:"center" }}>
        ADD ONS
      </div>
      <div className={styles.addonsBody}>
        <div className={styles.addonsHero}>
          <div className={styles.addonsHeroImg}>
            <div className={styles.mediaViewport}>
              {prevImg && <img src={prevImg} alt="" className={`${styles.budImg} ${styles.budImgFadeOut}`} referrerPolicy="no-referrer" 
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
                const filename = t.src.split('/').pop();
                t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
              }
            }}
          />}
              {fadeImg && <img key={fadeImg} src={fadeImg} alt={hi?.name||""} className={`${styles.budImg} ${styles.budImgFadeIn}`} referrerPolicy="no-referrer" 
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
                const filename = t.src.split('/').pop();
                t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
              }
            }}
          />}
            </div>
          </div>
          <div className={styles.addonsDetailCard}>
            <div className={styles.addonsDetailName}>{hi?.name||""}</div>
            <div className={styles.addonsDetailPrice}>PRICE {(hi?.price||'').replace(/\[object.*\]/,'')}</div>
            <div className={styles.effectIcons}>🌿 ✨ 💚</div>
          </div>
        </div>

        <div className={styles.addonsListHead}>
          <span>ITEM</span><span>PRICE</span>
        </div>
        <div className={styles.addonsList}>
          {items.map((it,i) => (
            <div key={it.sku+i} className={`${styles.addonRow} ${i===hiIdx?styles.addonRowHi:""}`}
              style={i===hiIdx ? {borderColor:"rgba(34,197,94,.55)", boxShadow:"0 0 0 2px rgba(34,197,94,.35), 0 6px 16px rgba(2,6,23,.15)"} : undefined}>
              {it.image && <img src={it.image} alt={it.name} className={styles.addonImg} referrerPolicy="no-referrer" 
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
                const filename = t.src.split('/').pop();
                t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
              }
            }}
          />}
              <div className={styles.addonInfo}>
                <div className={styles.addonName}>{it.name}</div>
                <div className={styles.addonPrice}>{(it.price||'').replace(/\[object.*\]/,'')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   VERTICAL TICKER
   ============================================================ */
const TICKER_SLIDES = [
  "🔥 P60 Cannabis — 1938 Weston Rd, York",
  "200+ Strains In Stock",
  "Open Daily: 10:00 AM - 03:00 AM",
  "ALL SALES ARE FINAL",
];

function VerticalTicker() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [exitIdx, setExitIdx] = useState(-1);

  useEffect(() => {
    const iv = setInterval(() => {
      setExitIdx(activeIdx);
      setActiveIdx(prev => (prev + 1) % TICKER_SLIDES.length);
    }, 3000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  return (
    <div className={styles.ticker}>
      <div className={styles.tickerInner}>
        {TICKER_SLIDES.map((text, i) => (
          <div key={i} className={`${styles.tickerSlide} ${i === activeIdx ? styles.tickerActive : ""} ${i === exitIdx ? styles.tickerExit : ""}`}>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   MAIN TV PAGE
   ============================================================ */
export default function TVMenuPage() {
  const [bgUrl, setBgUrl] = useState("");
  useEffect(() => {
    fetch("https://athena-cannabis-images.vercel.app/backgrounds/list.json")
      .then(r => r.json())
      .then(data => {
        if (data && data.length) {
          const hourIndex = Math.floor(Date.now() / (3600 * 1000)) % data.length;
          setBgUrl(`https://athena-cannabis-images.vercel.app/backgrounds/${data[hourIndex]}`);
        }
      })
      .catch(err => console.warn("[BG] Load failed:", err));
  }, []);
  const [flowers, setFlowers] = useState<Record<string,Flower[]>>({});
  const [ozFlowers, setOzFlowers] = useState<Flower[]>([]);
  const [addOns, setAddOns] = useState<Item[]>([]);
  const [highlights, setHighlights] = useState<Record<string,number>>({});
  const [lastUpdate, setLastUpdate] = useState("");
  const [particles, setParticles] = useState<Array<{size:number;left:string;color:string;shadow:string;dur:string;delay:string}>>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const TIERS = ["EXOTIC","PREMIUM","AAA+","AA","BUDGET"];

  const loadData = useCallback(async () => {
    try {
      const [fRes, iRes] = await Promise.all([
        fetch("/api/tv-data?type=flowers"),
        fetch("/api/tv-data?type=items"),
      ]);
      const fData: Flower[] = fRes.ok ? await fRes.json() : [];
      const iData: Item[] = iRes.ok ? await iRes.json() : [];

      for (const f of fData) {
        if (!f.isSale && (hasSalePrice(f) || hasNameSale(f.name))) f.isSale = true;
        f.name = cleanName(f.name);
      }

      const grouped: Record<string,Flower[]> = {};
      for (const f of fData) {
        const t = String(f.tier||"").toUpperCase();
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(f);
      }

      // OZ: pull from ALL tiers — any flower with 28g pricing (matches original TVMenu)
      const oz: Flower[] = [];
      const ozSeen = new Set<string>();
      // First add any explicitly OZ-tier items
      for (const f of (grouped["OZ"] || [])) {
        if (!ozSeen.has(f.sku)) { oz.push(f); ozSeen.add(f.sku); }
      }
      // Then add items from all other tiers that have 28g pricing
      for (const tier of ["EXOTIC","PREMIUM","AAA+","AA","BUDGET"]) {
        for (const f of (grouped[tier] || [])) {
          if (f.price28g && !ozSeen.has(f.sku)) { oz.push(f); ozSeen.add(f.sku); }
        }
      }
      setOzFlowers(oz);

      if (grouped["BUDGET"]) {
        grouped["BUDGET"] = grouped["BUDGET"].filter(f => !isShreds(f.name));
      }
      setFlowers(grouped);

      setAddOns(iData.filter(it => it.category === "ADD ONS" || it.category === "PREROLLS").slice(0, 14));

      const hi: Record<string,number> = {};
      for (const t of TIERS) hi[t] = 0;
      hi["OZ"] = 0; hi["ADDONS"] = 0;
      setHighlights(hi);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) { console.warn("[TV] Load failed:", err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitToScreen = useCallback(() => {
    if (!wrapRef.current) return;
    const W = window.innerWidth, H = window.innerHeight;
    const s = Math.min(W / 3840, H / 2160);
    const tx = Math.round((W - 3840*s)/2);
    const ty = Math.round((H - 2160*s)/2);
    wrapRef.current.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
  }, []);

  useEffect(() => {
    const colors = ['rgba(220,38,38,.12)','rgba(245,158,11,.10)','rgba(59,130,246,.10)','rgba(16,185,129,.08)','rgba(168,85,247,.08)'];
    setParticles(Array.from({length: 25}, (_, i) => {
      const size = 4 + Math.random() * 8;
      const color = colors[i % colors.length];
      return {
        size,
        left: `${5 + Math.random() * 90}%`,
        color,
        shadow: `0 0 ${size*3}px ${color}`,
        dur: `${18 + Math.random() * 22}s`,
        delay: `${-Math.random() * 25}s`,
      };
    }));
    loadData(); fitToScreen();
    window.addEventListener("resize", fitToScreen);
    const refresh = setInterval(loadData, 5*60*1000);
    return () => { window.removeEventListener("resize", fitToScreen); clearInterval(refresh); };
  }, [loadData, fitToScreen]);

  useEffect(() => {
    if (!Object.keys(flowers).length) return;
    const interval = setInterval(() => {
      setHighlights(prev => {
        const next = {...prev};
        for (const t of TIERS) {
            const total = flowers[t]?.length || 1;
            next[t] = ((prev[t]||0)+1) % Math.max(MAX_VIS, total * MAX_VIS);
          }
        next["OZ"] = ((prev["OZ"]||0)+1) % Math.max(1, ozFlowers.length);
        next["ADDONS"] = ((prev["ADDONS"]||0)+1) % Math.max(1, addOns.length);
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [flowers, ozFlowers, addOns]);

  const CM: Record<string,{c:string;t:string;b:string}> = {
    EXOTIC:{c:styles.cardExotic,t:styles.tierExotic,b:styles.tierBadgeExotic},
    PREMIUM:{c:styles.cardPremium,t:styles.tierPremium,b:styles.tierBadgePremium},
    "AAA+":{c:styles.cardAaa,t:styles.tierAaa,b:styles.tierBadgeAaa},
    AA:{c:styles.cardAa,t:styles.tierAa,b:styles.tierBadgeAa},
    BUDGET:{c:styles.cardBudget,t:styles.tierBudget,b:styles.tierBadgeBudget},
  };

  return (
    <div className={styles.tvPage} style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover" } : undefined}>
      {/* Floating particles */}
      <div className={styles.particles}>
        {particles.map((p, i) => (
          <span key={i} className={styles.dot} style={{
            width: p.size, height: p.size,
            left: p.left,
            background: p.color,
            boxShadow: p.shadow,
            animationDuration: p.dur,
            animationDelay: p.delay,
          }} />
        ))}
      </div>
      <div className={styles.wrap} ref={wrapRef}>

        

        {/* GRID */}
        <div className={styles.stage}>
          <div className={styles.grid}>
            {/* Row 1: EXOTIC, PREMIUM, AAA+ */}
            {TIERS.slice(0,3).map(tier => (
              <FlowerCard key={tier} tier={tier} flowers={flowers[tier]||[]} hiIdx={highlights[tier]||0}
                cardCls={CM[tier].c} tierCls={CM[tier].t} badgeCls={CM[tier].b} />
            ))}
            {/* ADDONS right rail */}
            <AddOnsCard items={addOns} hiIdx={highlights["ADDONS"]||0} />
            {/* Row 2: AA, BUDGET, OZ */}
            {TIERS.slice(3).map(tier => (
              <FlowerCard key={tier} tier={tier} flowers={flowers[tier]||[]} hiIdx={highlights[tier]||0}
                cardCls={CM[tier].c} tierCls={CM[tier].t} badgeCls={CM[tier].b} />
            ))}
            <OZCard flowers={ozFlowers} hiIdx={highlights["OZ"]||0} />
          </div>
        </div>

        
      </div>
      <div className={styles.lastUpdated}>Updated: {lastUpdate}</div>
    </div>
  );
}
