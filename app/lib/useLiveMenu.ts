"use client";

import { useEffect, useState } from "react";
import type { FlowerProduct, ItemProduct } from "./products";

/**
 * Client-side read of the SAME endpoint /tv and /tv2 use (/api/tv-data), so client widgets
 * (homepage featured strains etc.) never show a build-time catalog. Grok 2026-10-09.
 */
function useTvList<T>(type: "flowers" | "items"): T[] {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/tv-data?type=${type}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (alive && Array.isArray(d)) setList(d as T[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [type]);
  return list;
}

export function useLiveFlowers(): FlowerProduct[] {
  return useTvList<FlowerProduct>("flowers");
}

export function useLiveItems(): ItemProduct[] {
  return useTvList<ItemProduct>("items");
}
