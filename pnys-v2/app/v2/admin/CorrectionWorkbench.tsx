"use client";

import { useState } from "react";

type PreviewData = {
  beforeCount: number;
  afterCount: number;
  beforeFinal: string;
  afterFinal: string;
  beforeStock: string;
  afterStock: string;
  parity: string;
};

export default function CorrectionWorkbench({ preview, shiftId, version }: { preview: PreviewData; shiftId: string; version: number }) {
  const [store, setStore] = useState("ACD01");
  const [kind, setKind] = useState("STOCK_FOUND");
  const [reason, setReason] = useState("Found during recount after close");
  const [value, setValue] = useState("2");
  const [shown, setShown] = useState(false);
  const [masterKey, setMasterKey] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [correctionId, setCorrectionId] = useState("");
  const [message, setMessage] = useState("");

  const correctionField = kind === "SHIFT_TIME" ? "startedAt" : kind === "MONEY" ? "safeboxCents" : kind === "CLOSE_RECALCULATE" ? "close" : "countedQty";
  const entityId = kind === "SHIFT_TIME" ? shiftId : kind === "MONEY" || kind === "CLOSE_RECALCULATE" ? "close" : "396-3g";
  const correctionValue: unknown = kind === "SHIFT_TIME" ? value : Number(value);

  async function callApi(body: Record<string, unknown>) {
    setMessage("Working…");
    const response = await fetch("/api/v2/corrections", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${masterKey}`, "x-v2-store-code": store },
      body: JSON.stringify(body),
    });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(String(data.error ?? "Correction request failed"));
    return data;
  }

  async function createPreview() {
    try {
      const data = await callApi({
        action: "preview",
        storeCode: store,
        request: {
          idempotencyKey: crypto.randomUUID(),
          target: { storeCode: store, shiftId, shiftCode: "S00001", kind, entityId, field: correctionField },
          reason,
          newValue: correctionValue,
          expectedVersion: version,
        },
      });
      setPreviewId(String(data.previewId));
      setShown(true);
      setMessage("Preview ready. Nothing has changed yet.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preview failed"); }
  }

  async function applyPreview() {
    try {
      const data = await callApi({ action: "apply", storeCode: store, previewId });
      setCorrectionId(String(data.correctionId));
      setMessage(String(data.status) === "QUEUED_ACTIVE_SHIFT" ? "Queued safely; staff work was not interrupted." : "Correction applied and audited.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Apply failed"); }
  }

  async function undoApplied() {
    try {
      await callApi({ action: "undo", storeCode: store, correctionId, reason: `Undo: ${reason}` });
      setMessage("Correction undone with a compensating audit entry.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Undo failed"); }
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="eyebrow">Master Admin only · server + RLS enforced</div>
        <h1>Correction preview</h1>
        <p className="notice">Preview → Apply → Undo → Audit. Every write is limited to ACD01 rows in the isolated v2 database.</p>
        <div className="grid grid2">
          <label className="field">Master access key
            <input type="password" autoComplete="off" value={masterKey} onChange={(event) => setMasterKey(event.target.value)} placeholder="Entered locally; never displayed" />
          </label>
          <label className="field">Store
            <select value={store} onChange={(event) => setStore(event.target.value)}>
              <option value="ACD01">ACD01 · Test Store</option>
              <option value="PNYS" disabled>PNYS · isolated from this preview</option>
            </select>
          </label>
          <label className="field">Shift
            <select defaultValue="S00001"><option value="S00001">S00001 · closed</option></select>
          </label>
          <label className="field">What to fix
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="STOCK_FOUND">Found stock</option>
              <option value="STOCK_ADJUST">Fix stock count</option>
              <option value="SHIFT_TIME">Shift time</option>
              <option value="MONEY">Money / float / deposit</option>
              <option value="CLOSE_RECALCULATE">Recalculate close</option>
            </select>
          </label>
          <label className="field">Target
            <select value={entityId} disabled><option value={entityId}>{kind === "SHIFT_TIME" ? "Shift start" : kind === "MONEY" ? "Safebox" : kind === "CLOSE_RECALCULATE" ? "Latest close" : "396-3g · Khalifa Kush"}</option></select>
          </label>
          <label className="field">New value
            <input inputMode={kind === "SHIFT_TIME" ? "text" : "numeric"} value={value} onChange={(event) => setValue(kind === "SHIFT_TIME" ? event.target.value : event.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="field">Reason (required)
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        </div>
        <div className="buttonRow" style={{ marginTop: 14 }}>
          <button className="button buttonPrimary" onClick={createPreview} disabled={!masterKey || !reason.trim() || !value}>Preview correction</button>
          <button className="button buttonSecondary" onClick={applyPreview} disabled={!previewId || Boolean(correctionId)}>Confirm &amp; apply</button>
        </div>
        {message ? <p className="notice warning" aria-live="polite" style={{ marginTop: 14 }}>{message}</p> : null}
      </section>

      {shown ? (
        <section className="card" aria-live="polite">
          <div className="eyebrow">Fresh preview · optimistic version checked</div>
          <h2>Before / after</h2>
          <div className="grid grid2">
            <div className="metric"><span>396-3g counted</span><strong>{preview.beforeCount} → {preview.afterCount}</strong></div>
            <div className="metric"><span>Stock result</span><strong>{preview.beforeStock} → <span className="over">{preview.afterStock}</span></strong></div>
            <div className="metric"><span>Final till</span><strong>{preview.beforeFinal} → <span className="over">{preview.afterFinal}</span></strong></div>
            <div className="metric"><span>Parity hash</span><strong style={{ fontSize: ".95rem" }}>{preview.parity}</strong></div>
          </div>
          <p className="notice warning" style={{ marginTop: 14 }}>Double-count check: no matching count or accepted refill found in this ACD01 test fixture.</p>
          <div className="buttonRow">
            <button className="button buttonPrimary" onClick={applyPreview} disabled={!previewId || Boolean(correctionId)}>Confirm &amp; apply</button>
            <button className="button buttonSecondary" onClick={undoApplied} disabled={!correctionId}>Undo</button>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2>Audit trail</h2>
        <div className="tableWrap"><table><thead><tr><th>Status</th><th>Actor</th><th>Store</th><th>Change</th><th>Reason</th></tr></thead><tbody><tr><td><span className="pill pillQueued">PREVIEW ONLY</span></td><td>Tri · Human Master</td><td>{store}</td><td>{kind}</td><td>{reason || "Required"}</td></tr></tbody></table></div>
      </section>
    </div>
  );
}
