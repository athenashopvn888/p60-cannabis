"use client";

import { useEffect, useState } from "react";
import styles from "./till.module.css";

function clock(ms: number) {
  const left = Math.max(0, ms);
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function VerifyBanner({ deadline, onOpen }: { deadline: string; onOpen: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <button type="button" className={styles.verifyBanner} data-testid="verify-banner" onClick={onOpen}>
      Verify stock count · {clock(Date.parse(deadline) - now)}
    </button>
  );
}
