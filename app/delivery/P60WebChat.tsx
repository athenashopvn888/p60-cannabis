"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_SOD_WEB_CHAT_API_BASE || "https://milestone-1-demo.vercel.app").replace(/\/$/, "");
const SESSION_KEY = "sod-web-chat:P60";
const MAX_BYTES = 3 * 1024 * 1024;

type Message = { id: string; direction: "inbound" | "outbound"; body: string; at: number };
type Review = { id: string; status: string; receivedAt: number; expiresAt: number };
type CustomerIntent = "NEW_CUSTOMER" | "RETURNING_CUSTOMER";
type Conversation = { id: string; messages: Message[]; idReviews?: Review[]; customerIntent?: CustomerIntent };
type Availability = { state: "AVAILABLE" | "PAUSED"; message: string | null; resumeAt: number | null };
type UploadState = "idle" | "preparing" | "uploading" | "sent" | "error";

async function payload(response: Response) {
  const data = await response.json().catch(() => ({ message: "Web Chat is temporarily unavailable." }));
  if (!response.ok) throw new Error(data.message || "Web Chat is temporarily unavailable.");
  return data;
}

function readBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("We could not prepare that photo."));
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(blob);
  });
}

async function preparePhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG, or WebP photo.");
  let source: CanvasImageSource;
  let width = 0;
  let height = 0;
  let cleanup = () => {};
  try {
    if (typeof createImageBitmap !== "function") throw new Error("ImageBitmap unavailable");
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } catch {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("We could not open that photo. Please retake it."));
        image.src = objectUrl;
      });
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
    source = image;
    width = image.naturalWidth;
    height = image.naturalHeight;
    cleanup = () => URL.revokeObjectURL(objectUrl);
  }
  if (!width || !height) {
    cleanup();
    throw new Error("We could not open that photo. Please retake it.");
  }
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    cleanup();
    throw new Error("We could not prepare that photo on this phone.");
  }
  try {
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  } finally {
    cleanup();
  }
  let quality = 0.86;
  let photo: Blob | null = null;
  while (quality >= 0.5) {
    photo = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (photo && photo.size <= MAX_BYTES) break;
    quality -= 0.08;
  }
  if (!photo || photo.size > MAX_BYTES) throw new Error("That photo is too large. Please retake it closer to the ID.");
  return photo;
}

export default function P60WebChat() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem(SESSION_KEY) || "");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityUnavailable, setAvailabilityUnavailable] = useState(false);
  const [uploadAvailable, setUploadAvailable] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [intent, setIntent] = useState<CustomerIntent | "">("");
  const [firstMessage, setFirstMessage] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [retryExpanded, setRetryExpanded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef("");

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sod-chat-open", open);
    return () => document.body.classList.remove("sod-chat-open");
  }, [open]);

  const refresh = useCallback(async (activeToken: string) => {
    if (!activeToken) return;
    const response = await fetch(`${API_BASE}/api/web-chat/messages`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    if (response.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      setToken("");
      setConversation(null);
      return;
    }
    setConversation((await payload(response)).conversation);
  }, []);

  const refreshAvailability = useCallback(async () => {
    try {
      const data = await payload(await fetch(`${API_BASE}/api/web-chat/status`, { cache: "no-store" }));
      setAvailability(data.availability);
      setAvailabilityUnavailable(false);
    } catch {
      setAvailability(null);
      setAvailabilityUnavailable(true);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      if (token) void refresh(token).catch(() => setNotice("Your previous P60 chat could not be restored."));
      void fetch(`${API_BASE}/api/web-chat/id-review`, { cache: "no-store" })
        .then(payload)
        .then((data) => setUploadAvailable(Boolean(data.upload?.available)))
        .catch(() => setUploadAvailable(false));
      void refreshAvailability();
    }, 0);
    return () => window.clearTimeout(initial);
  }, [refresh, refreshAvailability, token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh(token).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh, token]);

  async function start(event: FormEvent) {
    event.preventDefault();
    if (!intent) {
      setNotice("Choose whether you are new or returning.");
      return;
    }
    if (!availability || availability.state !== "AVAILABLE") {
      setNotice(availability?.message || "Delivery status is temporarily unavailable. Please check back soon.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const data = await payload(await fetch(`${API_BASE}/api/web-chat/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: "P60", customerName: name, phone, intent, message: firstMessage }),
      }));
      localStorage.setItem(SESSION_KEY, data.token);
      setToken(data.token);
      setConversation(data.conversation);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Web Chat is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    try {
      const data = await payload(await fetch(`${API_BASE}/api/web-chat/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }));
      setMessage("");
      setConversation(data.conversation);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file || !token) return;
    setBusy(true);
    setUploadState("preparing");
    setUploadError("");
    setNotice("");
    try {
      const photo = await preparePhoto(file);
      setUploadState("uploading");
      const data = await payload(await fetch(`${API_BASE}/api/web-chat/id-review`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: "image/jpeg", imageBase64: await readBase64(photo) }),
      }));
      setConversation((current) => current ? { ...current, idReviews: [...(current.idReviews || []), data.review] } : current);
      setSelectedPhoto(null);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = "";
      setPhotoPreview("");
      setRetryExpanded(false);
      setUploadState("sent");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Photo could not be sent.");
      setUploadState("error");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function selectPhoto(file?: File) {
    if (!file) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const objectUrl = URL.createObjectURL(file);
    previewRef.current = objectUrl;
    setPhotoPreview(objectUrl);
    setSelectedPhoto(file);
    setUploadState("idle");
    setUploadError("");
    void uploadPhoto(file);
  }

  const latestReview = conversation?.idReviews?.at(-1);
  const reviewStatus = latestReview?.status || "NOT_SUBMITTED";
  const retryNeeded = reviewStatus === "REJECTED" || reviewStatus === "EXPIRED";
  const activeIntent = conversation?.customerIntent || intent;
  const showUpload = activeIntent === "NEW_CUSTOMER" && (reviewStatus === "NOT_SUBMITTED" || retryExpanded || ["preparing", "uploading", "error"].includes(uploadState));
  const paused = availability?.state === "PAUSED";
  const statusMessage = paused ? availability.message : availabilityUnavailable ? "Delivery status is temporarily unavailable. Please check back soon." : null;

  return (
    <aside className={`sod-web-chat ${open ? "open" : ""}`} aria-label="P60 Web Chat">
      <button className="sod-chat-launcher" type="button" onClick={() => { if (!open) void refreshAvailability(); setOpen((value) => !value); }} aria-expanded={open}>
        {open ? "Close chat" : "Web Chat"}
      </button>
      {open && <section className="sod-chat-panel" role="dialog" aria-modal="true" aria-label="P60 Web Chat">
      <header><div><strong>P60 Web Chat</strong><small>Start your delivery order with a dispatcher</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Minimize chat">×</button></header>
      <div className={`sod-availability-banner ${paused ? "paused" : "unavailable"}`} role="status" hidden={!statusMessage}>
        <strong>{paused ? "New delivery chats are paused" : "Delivery status unavailable"}</strong>
        <span>{statusMessage}{token ? " Your existing chat remains open." : ""}</span>
      </div>
      {!token ? (!availability || availability.state !== "AVAILABLE" ? <div className="sod-chat-start sod-chat-paused">
        <p>{statusMessage || "Checking delivery availability..."}</p>
        <button type="button" onClick={() => void refreshAvailability()}>Check again</button>
      </div> : <form className="sod-chat-start" onSubmit={start}>
        <div className="sod-chat-welcome"><h2>Ready to order?</h2><p>Welcome! First time ordering? Have a valid government-issued photo ID and a Canadian mobile number ready. Your mobile number will be used as your account number.</p><p>Use a mobile number that can receive verification texts.</p></div>
        <fieldset className="sod-intent-options"><legend>Tell us about your account</legend>
          <label className={intent === "NEW_CUSTOMER" ? "checked" : ""}><input required type="radio" name="customerIntent" value="NEW_CUSTOMER" checked={intent === "NEW_CUSTOMER"} onChange={() => setIntent("NEW_CUSTOMER")} /><span><strong>I&apos;m new</strong><small>Create my account and place my first order</small></span></label>
          <label className={intent === "RETURNING_CUSTOMER" ? "checked" : ""}><input required type="radio" name="customerIntent" value="RETURNING_CUSTOMER" checked={intent === "RETURNING_CUSTOMER"} onChange={() => setIntent("RETURNING_CUSTOMER")} /><span><strong>I&apos;m returning</strong><small>Use my existing mobile account and place an order</small></span></label>
        </fieldset>
        <label>Full name<input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
        <label>Canadian mobile number<input required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="647 555 0123" aria-describedby="sod-phone-help" /><small id="sod-phone-help">Must be able to receive verification texts. This becomes your account number.</small></label>
        <label>Order details (optional)<textarea maxLength={1000} value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} placeholder="List the products and quantities you want, or leave this blank and a dispatcher will help." /></label>
        <button type="submit" disabled={busy}>{busy ? "Starting…" : "Start order chat"}</button>
      </form>) : <>
        <div className="sod-chat-scroll">
          <div className="sod-chat-transcript" aria-live="polite">
            {(conversation?.messages || []).map((item) => <div className={item.direction} key={item.id}><span>{item.body}</span><small>{new Date(item.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div>)}
          </div>
          {reviewStatus === "PENDING_REVIEW" && <p className="sod-id-pending" role="status">ID sent - waiting for dispatcher review.</p>}
          {retryNeeded && !retryExpanded && <div className="sod-id-retry-prompt" role="status">
            <span>{reviewStatus === "REJECTED" ? "ID photo was not approved." : "ID photo expired."}</span>
            <button type="button" onClick={() => setRetryExpanded(true)}>Try ID photo again</button>
          </div>}
          {showUpload && <section className="sod-id-upload">
            <strong>New customer ID verification</strong>
            <p>Take one clear selfie while holding your government-issued photo ID beside your face.</p>
            <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(event) => selectPhoto(event.target.files?.[0])} />
            <button type="button" disabled={busy || !uploadAvailable} onClick={() => fileInput.current?.click()}>
              {!uploadAvailable ? "Private camera upload unavailable" : busy ? "Sending private photo..." : photoPreview ? "Retake selfie with ID" : "Take selfie with ID"}
            </button>
            {photoPreview && <figure className="sod-id-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Your selected selfie with ID" />
              <figcaption>Photo selected on this phone</figcaption>
            </figure>}
            {uploadState !== "idle" && <p className={`sod-id-upload-status ${uploadState === "error" ? "error" : ""}`} role="status">
              {uploadState === "preparing" ? "Preparing your private photo..."
                : uploadState === "uploading" ? "Sending privately to the dispatcher..."
                  : uploadState === "sent" ? "Photo sent privately for dispatcher review."
                    : uploadError}
            </p>}
            {uploadState === "error" && selectedPhoto && <button className="sod-id-retry" type="button" disabled={busy} onClick={() => void uploadPhoto(selectedPhoto)}>Try sending again</button>}
            <small>The photo is private, never sent by MMS, and deleted after dispatcher review or automatic expiry.</small>
          </section>}
        </div>
        <form className="sod-chat-composer" onSubmit={send}><textarea aria-label="Web Chat message" maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message" /><button type="submit" disabled={busy || !message.trim()}>Send</button></form>
      </>}
      {notice && <p className="sod-chat-notice" role="status">{notice}</p>}
      </section>}
    </aside>
  );
}
