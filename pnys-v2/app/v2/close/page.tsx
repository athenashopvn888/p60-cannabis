import CloseSummary from "./CloseSummary";
import { loadLatestClose } from "@/src/server/readModel";

export const dynamic = "force-dynamic";

export default async function ClosePage() {
  const { input, result } = await loadLatestClose("ACD01");
  return <CloseSummary input={input} result={result} />;
}
