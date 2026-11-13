"use client";

import { useState } from "react";
import { formatMoney } from "../lib/pny-pos/money";
import type { AdjustLine } from "../lib/pny-pos/tillLedger";
import CountCard from "./CountCard";
import TillSummary from "./TillSummary";
import type { OffLine } from "./SkuOffList";
import VerifyBanner, { useVerifyOpen } from "./VerifyBanner";
import styles from "./till.module.css";
import type { ScanCatalogItem } from "../lib/pny-pos/labelScan";

export type CloseLine = {
  sku: string;
  text?: string;
  name: string;
  price_cents: number;
  counted_qty: number | null;
};

type Totals = { sales_cents: number; cash_sales_cents: number; debit_sales_cents: number; cash_on_hand_cents: number; deposited_cents: number };

export default function CloseShift({
  lines,
  knownLines,
  totals,
  savedDeposit,
  busy,
  error,
  onSaveCount,
  onSubmitCount,
  onSaveDeposit,
  onConfirm,
  onClose,
  onDone,
  weedInStore,
  summaryMeta,
  stockCheck,
  floatExpectedCents,
  floatFoundCents,
  deadline,
  initialStep,
  resumeSummary,
  scanCatalog = [],
}: {
  lines: CloseLine[];
  knownLines?: { sku: string; text: string; counted_qty: number | null }[];
  totals: Totals;
  savedDeposit: number | null;
  busy: boolean;
  error: string;
  onSaveCount: (sku: string, counted_qty: number) => Promise<void>;
  onSubmitCount?: (confirmBlanksZero?: boolean) => Promise<void>;
  onSaveDeposit: (cents: number, floatCents: number) => Promise<{ deposit_code?: string | null } | void>;
  onConfirm: (depositCents: number, floatCents: number, finalDepositCode?: string | null) => Promise<void | string>;
  onClose: () => void;
  onDone?: () => void;
  weedInStore?: boolean | null;
  summaryMeta: {
    storeLabel: string;
    staffName: string;
    startedAt: string;
    endedAt: string | null;
    deposits: { code: string | null; amountCents: number }[];
    finalDepositCode?: string | null;
  };
  stockCheck?: {
    opening: { offCount: number; ready?: boolean; lines: OffLine[] };
    closing: { offCount: number; ready?: boolean; lines: OffLine[] };
    refills?: { count: number; lines: { sku: string; text: string; sent: number; received: number; diff: number; cents?: number }[] };
  };
  floatExpectedCents?: number | null;
  floatFoundCents?: number | null;
  deadline?: string | null;
  initialStep?: "count" | "deposit";
  /** When set (after session revoke remount), jump straight to summary with locked cash figures. */
  resumeSummary?: { depositCents: number; floatCents: number; closeLabel?: string } | null;
  scanCatalog?: ScanCatalogItem[];
}) {
  const [step, setStep] = useState<"count" | "deposit" | "summary">(
    resumeSummary ? "summary" : (initialStep ?? (lines.length === 0 ? "deposit" : "count")),
  );
  const [finalDepositCode, setFinalDepositCode] = useState<string | null>(summaryMeta.finalDepositCode ?? null);
  const [deposit, setDeposit] = useState(
    resumeSummary
      ? (resumeSummary.depositCents / 100).toFixed(2)
      : savedDeposit == null
        ? ""
        : (savedDeposit / 100).toFixed(2),
  );
  const [floatLeft, setFloatLeft] = useState(
    resumeSummary ? (resumeSummary.floatCents / 100).toFixed(2) : "0.00",
  );
  const [localError, setLocalError] = useState("");
  const [locking, setLocking] = useState(false);
  const [closeLabel, setCloseLabel] = useState(resumeSummary?.closeLabel ?? "");
  const verifyOpen = useVerifyOpen(deadline);
  const depositCents = Math.round(Number(deposit || 0) * 100);
  const drop = Number.isFinite(depositCents) ? depositCents : 0;
  const parsedFloat = Math.round(Number(floatLeft || 0) * 100);
  const floatCents = Number.isFinite(parsedFloat) && parsedFloat > 0 ? parsedFloat : 0;
  const deposited = totals.deposited_cents + drop;
  const adjust = (lines: OffLine[]): AdjustLine[] => lines.filter((line) => line.off !== 0).map((line) => ({
    sku: line.sku,
    text: line.text,
    units: line.off,
    cents: line.cents ?? 0,
  }));
  const refills: AdjustLine[] = (stockCheck?.refills?.lines ?? []).filter((line) => line.diff !== 0).map((line) => ({
    sku: line.sku,
    text: line.text,
    units: line.diff,
    cents: line.cents ?? 0,
  }));
  const summaryDeposits = [
    ...summaryMeta.deposits,
    ...(drop > 0 && !(finalDepositCode && summaryMeta.deposits.some((row) => row.code === finalDepositCode))
      ? [{ code: finalDepositCode, amountCents: drop }]
      : []),
  ];

  return (
    <section className={styles.close} data-testid="pos-close">
      <header className={styles.header}>
        <div className={styles.headerTop}>
          {step === "summary" ? (
            <span className={styles.backLink} aria-hidden="true" style={{ visibility: "hidden" }}>Back</span>
          ) : (
            <button className={styles.backLink} type="button" onClick={onClose}>Back</button>
          )}
          <div className={styles.brand}>End Shift</div>
        </div>
      </header>
      <div className={styles.closeBody}>
        {step === "count" ? (
          <>
            {verifyOpen && deadline ? <VerifyBanner deadline={deadline} /> : null}
            <CountCard
              lines={lines.map((line) => ({ sku: line.sku, text: line.text || `#${line.sku}`, counted_qty: line.counted_qty }))}
              knownLines={knownLines}
              allowExtra
              purpose="closing"
              busy={busy}
              scanCatalog={scanCatalog}
              onSave={onSaveCount}
              onSubmit={async (confirmBlanksZero) => {
                await onSubmitCount?.(confirmBlanksZero);
                setStep("deposit");
              }}
            />
          </>
        ) : null}

        {step === "deposit" ? (
          <form data-testid="close-deposit" onSubmit={(event) => {
            event.preventDefault();
            if (locking) return;
            setLocking(true);
            void onSaveDeposit(depositCents, floatCents).then(async (saved) => {
              const code = saved && typeof saved === "object" ? saved.deposit_code ?? null : null;
              setFinalDepositCode(code);
              const label = await onConfirm(depositCents, floatCents, code);
              if (typeof label === "string") setCloseLabel(label);
              setStep("summary");
            }).catch((err: unknown) => {
              setLocking(false);
              setLocalError(err instanceof Error ? err.message : "Deposit was not saved");
            });
          }}>
            <h2>Final deposit</h2>
            <p>Cash on hand before this drop is {formatMoney(totals.cash_on_hand_cents)}.</p>
            <label className={styles.fieldLabel} htmlFor="final-deposit">Deposit</label>
            <input id="final-deposit" className={styles.qtyInput} inputMode="decimal" aria-label="Final deposit" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
            <label className={styles.fieldLabel} htmlFor="float-left">Float left in the till</label>
            <input id="float-left" className={styles.qtyInput} inputMode="decimal" aria-label="Float left in the till" data-testid="float-left-input" value={floatLeft} onChange={(event) => setFloatLeft(event.target.value)} />
            <p>Leave this at 0.00 when the drawer is emptied.</p>
            <button className={styles.primary} type="submit" disabled={busy || locking}>Save deposit</button>
          </form>
        ) : null}

        {step === "summary" ? (
          <div data-testid="close-summary">
            <div className={styles.accountantBanner} data-testid="close-summary-banner" role="status">
              TAKE A PICTURE OF THIS SCREEN AND POST IT IN THE TILL GROUP FOR THE ACCOUNTANT
            </div>
            <TillSummary
              weedInStore={weedInStore}
              storeLabel={summaryMeta.storeLabel}
              staffName={summaryMeta.staffName}
              startedAt={summaryMeta.startedAt}
              endedAt={summaryMeta.endedAt ?? summaryMeta.startedAt}
              closeLabel={closeLabel}
              deposits={summaryDeposits}
              cashSalesCents={totals.cash_sales_cents}
              depositedCents={deposited}
              floatCents={floatCents}
              openLines={adjust(stockCheck?.opening.lines ?? [])}
              refillLines={refills}
              closeLines={adjust(stockCheck?.closing.lines ?? [])}
              floatExpectedCents={floatExpectedCents}
              floatFoundCents={floatFoundCents}
            />
            <p data-testid="shift-locked">Shift closed</p>
            <button
              className={styles.primary}
              type="button"
              data-testid="close-summary-done"
              onClick={() => (onDone ? onDone() : onClose())}
            >
              Done, I posted it
            </button>
          </div>
        ) : null}
        {localError || error ? <p className={styles.error}>{localError || error}</p> : null}
      </div>
    </section>
  );
}
