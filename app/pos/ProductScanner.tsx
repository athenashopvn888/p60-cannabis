"use client";

import { useEffect, useRef, useState } from "react";
import { matchScannedLabel, type ScanCatalogItem } from "../lib/pny-pos/labelScan";
import styles from "./ProductScanner.module.css";

type ScannerControls = { stop: () => void };
type NativeDetector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]> };
type NativeDetectorConstructor = new (options?: { formats?: string[] }) => NativeDetector;

function successFeedback() {
  navigator.vibrate?.(80);
  try {
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
  } catch {
    // Vibration is enough when the browser blocks programmatic audio.
  }
}

export default function ProductScanner({
  catalog,
  label = "SCAN",
  onMatch,
}: {
  catalog: ScanCatalogItem[];
  label?: string;
  onMatch: (sku: string) => boolean | void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(false);
  const [decodedRaw, setDecodedRaw] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const catalogRef = useRef(catalog);
  const onMatchRef = useRef(onMatch);
  const lastAcceptedRef = useRef({ raw: "", at: 0 });

  useEffect(() => {
    catalogRef.current = catalog;
    onMatchRef.current = onMatch;
  }, [catalog, onMatch]);

  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let controls: ScannerControls | null = null;
    let timer = 0;

    const accept = (raw: string) => {
      if (cancelled) return;
      if (lastAcceptedRef.current.raw === raw) return;
      lastAcceptedRef.current = { raw, at: Date.now() };
      setDecodedRaw(raw);
      const result = matchScannedLabel(raw, catalogRef.current);
      if (!result.ok) {
        setFailure(true);
        setMessage("Not found");
        return;
      }
      if (result.thcHidden) {
        setFailure(true);
        setMessage("THC hidden this shift");
        return;
      }
      if (onMatchRef.current(result.sku) === false) {
        setFailure(true);
        setMessage("Not found");
        return;
      }
      successFeedback();
      setFailure(false);
      setMessage(`${result.sku} added`);
    };

    async function start(videoElement: HTMLVideoElement) {
      try {
        const Detector = (globalThis as typeof globalThis & { BarcodeDetector?: NativeDetectorConstructor }).BarcodeDetector;
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          videoElement.srcObject = stream;
          await videoElement.play();
          const detector = new Detector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"] });
          const detect = async () => {
            if (cancelled) return;
            try {
              const found = await detector.detect(videoElement);
              const raw = found.find((item) => item.rawValue)?.rawValue;
              if (raw) accept(raw);
            } catch {
              // A frame can fail while the camera is focusing; keep scanning.
            }
            timer = window.setTimeout(detect, 220);
          };
          void detect();
          return;
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoElement,
          (result) => { if (result) accept(result.getText()); },
        );
      } catch (error) {
        setFailure(true);
        setMessage(error instanceof Error && error.name === "NotAllowedError"
          ? "Camera permission is required. Manual search is still available."
          : "Camera could not start. Manual search is still available.");
      }
    }

    void start(video);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [open]);

  return (
    <>
      <button className={styles.scanButton} type="button" data-testid="scan-button" onClick={() => { lastAcceptedRef.current = { raw: "", at: 0 }; setMessage(""); setDecodedRaw(""); setFailure(false); setOpen(true); }}>
        {label}
      </button>
      {open ? (
        <div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="scanner-title" data-testid="product-scanner">
          <section className={styles.panel}>
            <div className={styles.heading}>
              <h2 id="scanner-title">Scan product label</h2>
              <button type="button" aria-label="Close scanner" onClick={() => setOpen(false)}>×</button>
            </div>
            <video ref={videoRef} className={styles.video} muted playsInline />
            <p className={failure ? styles.failure : styles.message} aria-live="assertive">{message || "Point the back camera at the QR or barcode."}</p>
            {decodedRaw ? <code className={styles.decoded} data-testid="decoded-label">Decoded: {decodedRaw}</code> : null}
            <button className={styles.close} type="button" onClick={() => setOpen(false)}>Close</button>
          </section>
        </div>
      ) : null}
    </>
  );
}
