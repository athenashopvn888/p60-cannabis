import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCloseParity, calculateClose } from "../src/domain/close";
import { S00006_MATH_REGRESSION, TEST_CLOSE_INPUT, TEST_CLOSE_RESULT } from "./fixtures";
import { finalLabel } from "../src/domain/format";
import { buildCloseReportBundle } from "../src/domain/report";

test("canonical close follows approved accounting flow", () => {
  const result = calculateClose(TEST_CLOSE_INPUT);
  assert.equal(result.expectedCashCents, 70100);
  assert.equal(result.cashAccountedCents, 91800);
  assert.equal(result.finalVarianceCents, 21700);
  assert.equal(result.finalKind, "OVER");
  assert.equal(finalLabel(result.finalKind, result.finalVarianceCents), "OVER +$217.00");
});

test("S00006 canonical math regression stays OVER +$132", () => {
  const result = calculateClose(S00006_MATH_REGRESSION);
  assert.equal(result.totalShortQty, 23);
  assert.equal(result.totalShortCents, 8500);
  assert.equal(result.totalExtraQty, 1);
  assert.equal(result.totalExtraCents, 1000);
  assert.equal(result.netStockCents, -7500);
  assert.equal(result.expectedCashCents, 78600);
  assert.equal(result.cashAccountedCents, 91800);
  assert.equal(result.finalVarianceCents, 13200);
  assert.equal(result.finalKind, "OVER");
});

test("screen and email are blocked if stored and recalculated close differ", () => {
  const altered = structuredClone(TEST_CLOSE_RESULT);
  altered.totalShortCents += 1;
  assert.throws(() => assertCloseParity(altered, calculateClose(TEST_CLOSE_INPUT)), /CLOSE_PARITY_MISMATCH/);
  assert.throws(() => buildCloseReportBundle(TEST_CLOSE_INPUT, altered), /CLOSE_PARITY_MISMATCH/);
});

test("email body uses the same signs and canonical totals", () => {
  const report = buildCloseReportBundle(TEST_CLOSE_INPUT, TEST_CLOSE_RESULT);
  assert.match(report.body, /Stock shortage: −\$30\.00 \(3 units\)/);
  assert.match(report.body, /Stock extra: \+\$40\.00 \(2 units\)/);
  assert.match(report.body, /FINAL: OVER \+\$217\.00/);
  assert.doesNotMatch(report.body, /shift_id|uuid|message id/i);
});
