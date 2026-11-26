import CorrectionWorkbench from "./CorrectionWorkbench";
import { calculateClose } from "@/src/domain/close";
import { finalLabel } from "@/src/domain/format";
import { loadLatestClose } from "@/src/server/readModel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { shiftId, version, input, result } = await loadLatestClose("ACD01");
  const corrected = structuredClone(input);
  const line = corrected.lines.find((item) => item.sku === "396-3g");
  if (!line) throw new Error("ACD01 correction fixture missing 396-3g.");
  const beforeCount = line.countedQty;
  line.countedQty += 2;
  const after = calculateClose(corrected);
  return <CorrectionWorkbench shiftId={shiftId} version={version} preview={{
    beforeCount,
    afterCount: line.countedQty,
    beforeFinal: finalLabel(result.finalKind, result.finalVarianceCents),
    afterFinal: finalLabel(after.finalKind, after.finalVarianceCents),
    beforeStock: finalLabel(result.netStockKind, result.netStockCents),
    afterStock: finalLabel(after.netStockKind, after.netStockCents),
    parity: after.parityHash.slice(0, 16),
  }} />;
}
