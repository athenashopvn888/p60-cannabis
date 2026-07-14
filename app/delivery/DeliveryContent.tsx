"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import styles from "./delivery.module.css";

export default function DeliveryContent() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");

    try {
      // Save to Google Sheets via Apps Script
      const res = await fetch(
        `https://script.google.com/macros/s/AKfycbySrZYxI-NNnXfxY1jXOqHgT2HQi4zst2Fgte6FXTeymat_W_r0o1E3P83EfnVCjEk0/exec?action=delivery_email&email=${encodeURIComponent(email)}&store=PNY01`,
        { method: "GET", mode: "no-cors" }
      );
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("success"); // no-cors always succeeds visually
    }
  }

  return (
    <main className={styles.main}>
      <Navbar />
      <section className={styles.bannerSection}>
        <img
          src="/banners/p60-real/page-delivery.webp"
          alt="P60 Cannabis delivery preview"
          className={styles.bannerImg}
        />
      </section>
      <div className={styles.content}>
        <h1 className={styles.pageTitle}>
          Delivery <span className={styles.highlight}>Coming Soon</span>
        </h1>
        <p className={styles.pageSubtitle}>
          P60 Cannabis is preparing delivery updates for York shoppers.
          Sign up below to be the first to know when local delivery details are ready.
        </p>

        {/* Email signup */}
        <div className={styles.formSection}>
          <h2 className={styles.formTitle}>Get Notified When We Launch</h2>
          <p className={styles.formDesc}>
            Enter your email to join our delivery waitlist. We&apos;ll send you one email when delivery goes live.
          </p>
          <form onSubmit={handleSubmit}>
            <div className={styles.inputRow}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={styles.emailInput}
                required
                disabled={status === "loading"}
              />
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={status === "loading"}
              >
                {status === "loading" ? "Sending..." : "Notify Me"}
              </button>
            </div>
          </form>
          {status === "success" && (
            <p className={styles.successMsg}>
              You&apos;re on the list. We&apos;ll notify you when delivery launches.
            </p>
          )}
          {status === "error" && (
            <p className={styles.errorMsg}>
              Something went wrong. Please try again.
            </p>
          )}
        </div>

        {/* Info cards */}
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <span className={styles.infoIcon}>BOX</span>
            <h3 className={styles.infoTitle}>Delivery Updates</h3>
            <p className={styles.infoDesc}>Watch for local availability updates before planning a delivery order.</p>
          </div>
          <div className={styles.infoCard}>
            <span className={styles.infoIcon}>AREA</span>
            <h3 className={styles.infoTitle}>York / Weston Rd</h3>
            <p className={styles.infoDesc}>Built around the P60 Cannabis store at 1938 Weston Rd.</p>
          </div>
          <div className={styles.infoCard}>
            <span className={styles.infoIcon}>INFO</span>
            <h3 className={styles.infoTitle}>Menu First</h3>
            <p className={styles.infoDesc}>Use the current menu or staff for product, price, and availability details.</p>
          </div>
        </div>

        {/* CTA */}
        <div className={styles.ctaSection}>
          <p className={styles.ctaText}>
            Can&apos;t wait? Visit us in-store at <strong>1938 Weston Rd, York</strong> —
            we are <strong>Open Daily: 10:00 AM - 03:00 AM</strong>. Call <strong>(437) 522-2802</strong>.
          </p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
