import type { Metadata } from "next";
import OpeningFoundStockPreview from "./OpeningFoundStockPreview";

export const metadata: Metadata = { title: "PNY01 unlisted opening stock preview" };

export default function Page() {
  return <OpeningFoundStockPreview />;
}
