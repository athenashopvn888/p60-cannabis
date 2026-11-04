"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./till.module.css";

/** True only while the shift is still inside the two-hour verify window. */
export function useVerifyOpen(deadline: string | null | undefined, onExpire?: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
    if (!deadline) return;
    const end = Date.parse(deadline);
    const finish = () => {
      setNow(Date.now());
      if (fired.current) return;
      fired.current = true;
      onExpire?.();
    };
    if (Date.now() >= end) {
      finish();
      return;
    }
    const id = window.setInterval(() => {
      if (Date.now() >= end) {
        window.clearInterval(id);
        finish();
      } else setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadline, onExpire]);
  if (!deadline) return false;
  return Date.parse(deadline) > now;
}

function clock(ms: number) {
  const left = Math.max(0, ms);
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function VerifyBanner({ deadline, onOpen }: { deadline: string; onOpen?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const label = `Verify stock count · ${clock(Date.parse(deadline) - now)}`;
  if (!onOpen) return <div className={styles.verifyBanner} data-testid="verify-banner">{label}</div>;
  return (
    <button type="button" className={styles.verifyBanner} data-testid="verify-banner" onClick={onOpen}>
      {label}
    </button>
  );
}
