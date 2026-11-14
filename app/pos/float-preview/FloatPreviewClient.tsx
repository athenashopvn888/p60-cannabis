"use client";

import { useState } from "react";
import OpeningFloatCheck from "../OpeningFloatCheck";

export default function FloatPreviewClient({ state }: { state: string }) {
  const mismatch = state === "mismatch" || state === "warning";
  const [value, setValue] = useState(mismatch ? "45.00" : "40.00");
  return <main style={{ minHeight: "100dvh", background: "#eef2f7" }}>
    <OpeningFloatCheck expectedCents={4000} value={value} busy={false} initialWarning={state === "warning"} onChange={setValue} onSave={() => undefined} />
  </main>;
}
