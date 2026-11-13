"use client";

import { useEffect, useRef, useState } from "react";
import { matchScannedLabel, type ScanCatalogItem } from "../lib/pny-pos/labelScan";
import styles from "./ProductScanner.module.css";

type ScannerControls = { stop: () => void };
type NativeDetector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]> };
type NativeDetectorConstructor = new (options?: { formats?: string[] }) => NativeDetector;

function adaptiveThreshold(source: ImageData, windowSize = 31, offset = -5) {
  const { width, height, data } = source;
  const gray = new Uint8Array(width * height);
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const value = Math.round(data[pixel] * 0.299 + data[pixel + 1] * 0.587 + data[pixel + 2] * 0.114);
      gray[y * width + x] = value;
      row += value;
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
    }
  }
  const output = new Uint8ClampedArray(width * height * 4);
  const half = Math.floor(windowSize / 2);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height - 1, y + half);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      const sum = integral[(y1 + 1) * (width + 1) + x1 + 1]
        - integral[y0 * (width + 1) + x1 + 1]
        - integral[(y1 + 1) * (width + 1) + x0]
        + integral[y0 * (width + 1) + x0];
      const mean = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
      const value = gray[y * width + x] < mean - offset ? 0 : 255;
      const pixel = (y * width + x) * 4;
      output[pixel] = value;
      output[pixel + 1] = value;
      output[pixel + 2] = value;
      output[pixel + 3] = 255;
    }
  }
  return output;
}

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
    let enhancedTimer = 0;

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
        const constraints = {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: "continuous" }],
        } as unknown as MediaTrackConstraints;
        stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
        videoElement.srcObject = stream;
        await videoElement.play();

        const Detector = (globalThis as typeof globalThis & { BarcodeDetector?: NativeDetectorConstructor }).BarcodeDetector;
        if (Detector) {
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
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromStream(
          stream,
          videoElement,
          (result) => { if (result) accept(result.getText()); },
        );

        // Blurry printed bag QRs can defeat both Android BarcodeDetector and
        // the standard ZXing pass. Try the visible frame and progressively
        // tighter center crops with local contrast thresholding as a fallback.
        const { default: jsQR } = await import("jsqr");
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const scanEnhanced = () => {
          if (cancelled || !context || videoElement.readyState < 2) return;
          const sourceWidth = videoElement.videoWidth;
          const sourceHeight = videoElement.videoHeight;
          const crops = [1, 0.82, 0.64];
          for (const ratio of crops) {
            const side = Math.min(sourceWidth, sourceHeight) * ratio;
            const sx = (sourceWidth - side) / 2;
            const sy = (sourceHeight - side) / 2;
            const target = Math.min(760, Math.max(360, Math.round(side)));
            canvas.width = target;
            canvas.height = target;
            context.drawImage(videoElement, sx, sy, side, side, 0, 0, target, target);
            const frame = context.getImageData(0, 0, target, target);
            const normal = jsQR(frame.data, target, target, { inversionAttempts: "attemptBoth" });
            const enhanced = normal ?? jsQR(adaptiveThreshold(frame), target, target, { inversionAttempts: "attemptBoth" });
            if (enhanced?.data) {
              accept(enhanced.data);
              return;
            }
          }
          enhancedTimer = window.setTimeout(scanEnhanced, 500);
        };
        enhancedTimer = window.setTimeout(scanEnhanced, 250);
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
      window.clearTimeout(enhancedTimer);
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
