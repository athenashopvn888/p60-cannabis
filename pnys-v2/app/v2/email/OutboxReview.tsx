"use client";

import { useState } from "react";

type Item = {
  outboxId: string;
  subject: string;
  status: string;
  closeVersion: number;
  parityHash: string;
};

export function OutboxReview() {
  const [masterKey, setMasterKey] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("Enter the Master key to inspect the isolated v2 outbox.");

  async function request(method: "GET" | "POST", body?: Record<string, string>) {
    const response = await fetch("/api/v2/outbox", {
      method,
      headers: { authorization: `Bearer ${masterKey}`, "x-v2-store-code": "ACD01", "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "OUTBOX_REQUEST_FAILED");
    return payload;
  }

  async function refresh() {
    try {
      const payload = await request("GET") as { items: Item[] };
      setItems(payload.items);
      setMessage(payload.items.length ? `${payload.items.length} v2 outbox item(s).` : "No corrected reports are waiting.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OUTBOX_REQUEST_FAILED");
    }
  }

  async function approve(outboxId: string) {
    try {
      await request("POST", { action: "approve", storeCode: "ACD01", outboxId });
      setMessage("Approved. Sending remains disabled in preview.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OUTBOX_APPROVE_FAILED");
    }
  }

  return (
    <section className="card stack">
      <h2>Corrected-report outbox</h2>
      <label className="field">Master access key
        <input type="password" autoComplete="off" value={masterKey} onChange={(event) => setMasterKey(event.target.value)} placeholder="Entered locally; never displayed" />
      </label>
      <div className="buttonRow">
        <button className="button buttonSecondary" onClick={refresh} disabled={!masterKey}>Refresh outbox</button>
        <button className="button buttonSecondary" disabled>Send disabled in preview</button>
      </div>
      <p className="notice">{message}</p>
      {items.map((item) => (
        <div className="metric" key={item.outboxId}>
          <span>{item.status} · close v{item.closeVersion} · {item.parityHash.slice(0, 12)}</span>
          <strong style={{ fontSize: "1rem" }}>{item.subject}</strong>
          {item.status === "DRAFT" ? <button className="button buttonPrimary" onClick={() => approve(item.outboxId)}>Approve</button> : null}
        </div>
      ))}
    </section>
  );
}
