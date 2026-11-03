"use client";

import { useEffect } from "react";

/** How often an open till tab asks for /api/pos/state. Hidden tabs do not poll. */
export const POS_STATE_POLL_MS = 25_000;

export function usePosPoll(load: () => Promise<void>) {
  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const clear = () => {
      if (timer) window.clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      clear();
      if (stop || document.hidden) return;
      timer = window.setTimeout(() => void run(), POS_STATE_POLL_MS);
    };
    const run = async () => {
      if (stop || document.hidden) return;
      try {
        await load();
      } finally {
        schedule();
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        clear();
        return;
      }
      void run();
    };
    document.addEventListener("visibilitychange", onVisibility);
    void run();
    return () => {
      stop = true;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);
}
