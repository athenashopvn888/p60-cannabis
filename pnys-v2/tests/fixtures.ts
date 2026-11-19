import { calculateClose, type CloseInput } from "../src/domain/close";

export const TEST_CLOSE_INPUT: CloseInput = {
  storeCode: "TEST01",
  shiftCode: "T00001",
  staffName: "Test Staff",
  openingCashCents: 5200,
  cashSalesCents: 65900,
  safeboxCents: 83500,
  closingFloatCents: 8300,
  lines: [
    { sku: "172-3g", name: "Lavender Kush 3g", expectedQty: 8, countedQty: 7, unitPriceCents: 2000 },
    { sku: "240", name: "Grabba", expectedQty: 12, countedQty: 10, unitPriceCents: 500 },
    { sku: "396-3g", name: "Khalifa Kush 3g", expectedQty: 18, countedQty: 20, unitPriceCents: 2000 },
    { sku: "593-6g", name: "Mike Tyson KO 6g", expectedQty: 4, countedQty: 4, unitPriceCents: 4000 },
  ],
};

export const TEST_CLOSE_RESULT = calculateClose(TEST_CLOSE_INPUT);

export const S00006_MATH_REGRESSION: CloseInput = {
  storeCode: "TEST01",
  shiftCode: "REG006",
  staffName: "Regression Staff",
  openingCashCents: 5200,
  cashSalesCents: 65900,
  safeboxCents: 83500,
  closingFloatCents: 8300,
  lines: [
    { sku: "matched-fixture", name: "Matched fixture", expectedQty: 30, countedQty: 30, unitPriceCents: 2000 },
    { sku: "short-fixture-a", name: "Regression short fixture A", expectedQty: 17, countedQty: 0, unitPriceCents: 500 },
    { sku: "short-fixture-b", name: "Regression short fixture B", expectedQty: 6, countedQty: 0, unitPriceCents: 0 },
    { sku: "extra-fixture", name: "Regression extra fixture", expectedQty: 0, countedQty: 1, unitPriceCents: 1000 },
  ],
};
