"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TvHiringConfig } from "../lib/tvHiring";
import { TV_POLICY_MESSAGE } from "../lib/tvPolicy";
import styles from "./HiringRibbon.module.css";

const PHASE_CLASS = [styles.phaseHeadline, styles.phaseApply, styles.phaseUrl];
const ROTATE_MS = 3000;
const POLICY_FONT_PX = 60;
const POLICY_TRACKING_PX = 3;
const POLICY_MIN_FONT_PX = 32;

function trimmed(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function hiringLines(hiring: TvHiringConfig): string[] {
  const headlineRole = [hiring.headline.trim(), hiring.role.trim()].filter(Boolean).join(" ");
  return [headlineRole, hiring.cta.trim(), hiring.displayUrl.trim()];
}

/** Shrink the policy copy until it stays on one line inside the ribbon. */
function fitPolicyLine(node: HTMLSpanElement) {
  const phase = node.parentElement;
  if (!phase) return;
  const phaseStyle = window.getComputedStyle(phase);
  const padX = parseFloat(phaseStyle.paddingLeft) + parseFloat(phaseStyle.paddingRight);
  const available = phase.clientWidth - padX;
  if (available <= 0) return;

  node.style.display = "inline-block";
  node.style.maxWidth = "none";
  node.style.overflow = "visible";
  node.style.textOverflow = "clip";

  let size = POLICY_FONT_PX;
  let tracking = POLICY_TRACKING_PX;
  node.style.fontSize = `${size}px`;
  node.style.letterSpacing = `${tracking}px`;

  while (size > POLICY_MIN_FONT_PX && node.scrollWidth > available + 1) {
    size -= 1;
    tracking = Math.max(0.5, Math.round(((POLICY_TRACKING_PX * size) / POLICY_FONT_PX) * 10) / 10);
    node.style.fontSize = `${size}px`;
    node.style.letterSpacing = `${tracking}px`;
  }

  node.style.display = "";
  node.style.maxWidth = "";
  node.style.overflow = "";
  node.style.textOverflow = "";
}

export default function HiringRibbon({ hiring }: { hiring: TvHiringConfig | null }) {
  const policy = trimmed(TV_POLICY_MESSAGE);
  const hiringOn = hiring !== null && trimmed(hiring.displayUrl).length > 0;
  const messages = [
    ...(hiringOn && hiring ? hiringLines(hiring) : []),
    ...(policy ? [policy] : []),
  ];
  const policyIndex = policy ? messages.length - 1 : -1;
  const rotating = hiringOn && messages.length > 1;

  const [phase, setPhase] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const policyRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!rotating || reducedMotion) return;
    const timer = window.setInterval(() => {
      setPhase((current) => (current + 1) % messages.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating, reducedMotion, messages.length]);

  useLayoutEffect(() => {
    if (policyRef.current) fitPolicyLine(policyRef.current);
  }, [policy, messages.length, phase, reducedMotion]);

  if (messages.length === 0) return null;

  const activeIndex = rotating && !reducedMotion ? phase % messages.length : policyIndex;

  return (
    <div className={styles.hiringRibbon} role="status" aria-live="polite">
      <div className={styles.hiringViewport}>
        {messages.map((message, index) => {
          const isPolicy = index === policyIndex;
          const phaseClass = isPolicy ? styles.phasePolicy : PHASE_CLASS[index];
          return (
            <span
              key={isPolicy ? "policy" : phaseClass}
              className={`${styles.hiringPhase} ${phaseClass} ${index === activeIndex ? styles.isActive : ""}`}
            >
              <span
                className={styles.hiringPhaseText}
                ref={isPolicy ? policyRef : undefined}
              >
                {message}
              </span>
            </span>
          );
        })}
        <span className={styles.hiringStatic}>{messages.join("  •  ")}</span>
      </div>
    </div>
  );
}
