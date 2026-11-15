import { THC_SKUS } from "../../lib/pny-pos/thcSkuFlags";
import WeedPreview from "./WeedPreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "PNY01 WEED shift preview", robots: { index: false, follow: false } };

export default function WeedPreviewPage() {
  return <WeedPreview thcSkus={[...THC_SKUS]} />;
}
