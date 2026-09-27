"use client";

import { useEffect, useState } from "react";
import type { TvHiringConfig } from "../lib/tvHiring";
import styles from "./HiringRibbon.module.css";

const PHASE_CLASS = [styles.phaseHeadline, styles.phaseApply, styles.phaseUrl];

function hiringMessages(hiring: TvHiringConfig) {
  const headlineRole = [hiring.headline.trim(), hiring.role.trim()].filter(Boolean).join(" ");
  return [headlineRole, hiring.cta.trim(), hiring.displayUrl.trim()];
}

export default function HiringRibbon({ hiring }: { hiring: TvHiringConfig | null }) {
  const [phase, setPhase] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!hiring || reducedMotion || !hiring.displayUrl.trim()) return;
    const timer = window.setInterval(() => {
      setPhase((current) => (current + 1) % 3);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hiring, reducedMotion]);

  if (!hiring || !hiring.displayUrl.trim()) return null;

  const messages = hiringMessages(hiring);

  return (
    <div className={styles.hiringRibbon} role="status" aria-live="polite">
      <div className={styles.hiringViewport}>
        {messages.map((message, index) => (
          <span
            key={PHASE_CLASS[index]}
            className={`${styles.hiringPhase} ${PHASE_CLASS[index]} ${index === phase ? styles.isActive : ""}`}
          >
            <span className={styles.hiringPhaseText}>{message}</span>
          </span>
        ))}
        <span className={styles.hiringStatic}>{messages.join("  •  ")}</span>
      </div>
    </div>
  );
}
