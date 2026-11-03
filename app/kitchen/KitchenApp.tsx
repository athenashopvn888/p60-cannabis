"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ProductPhoto } from "../pos/ProductPhoto";
import styles from "./kitchen.module.css";

type Product = { sku: string; name: string; category: string; image_url?: string | null; qty: number };
type CountLine = { sku: string; name: string; system_qty: number };
type Receipt = {
  kitchen_row_id: string;
  sku: string;
  name: string;
  qty_sent: number;
  qty_received: number | null;
  status: string;
  kind: string;
};
type View = {
  authenticated?: boolean;
  demo?: boolean;
  demo_label?: string | null;
  demo_pin?: string | null;
  shift?: { staff_name: string; opening_confirmed?: boolean; status: string };
  products?: Product[];
  count_lines?: CountLine[];
  receipts?: Receipt[];
  end_shift_message?: string;
  error?: string;
  code?: string;
};
type Tab = "send" | "end" | "history";
type Kind = "ALLOCATION" | "REFILL";
type Lang = "en" | "vi";

const STORES = [{ code: "PNY01", name: "P60 Cannabis" }] as const;
const LANG_KEY = "pny-kitchen-lang";
const langListeners = new Set<() => void>();

const COPY = {
  en: {
    loading: "Loading kitchen…",
    kitchen: "Kitchen",
    signIn: "Sign in",
    signOut: "Sign out",
    pinHelp: "Enter the 4-digit shift PIN. Five wrong tries lock the shift.",
    clear: "Clear",
    send: "Send",
    end: "End",
    history: "History",
    allocation: "Allocation",
    refill: "Refill",
    sendAllocation: "Send Allocation",
    sendRefill: "Send Refill",
    search: "Search name or SKU",
    sendNote: "Allocation is the first send. Refill adds more during the shift. Both land on the selected store till.",
    needQty: "Enter a quantity for at least one item.",
    endSummary: "Summary will post to BOT HUB within 5 min.",
    tillOpen: "The till stays open until staff end it on the POS.",
    emptyHistory: "No allocation or refill has been sent this shift.",
    sent: "sent",
    received: "received",
    failed: "Something went wrong.",
    store: "Store",
    language: "Language",
    sendType: "Send type",
    categories: "Categories",
    all: "All",
    decrease: "Decrease",
    increase: "Increase",
    confirmed: "Confirmed",
    partial: "Partial",
    rejected: "Rejected",
    pending: "Pending",
  },
  vi: {
    loading: "Đang tải bếp…",
    kitchen: "Bếp",
    signIn: "Đăng nhập",
    signOut: "Đăng xuất",
    pinHelp: "Nhập mã PIN ca 4 số. Năm lần sai sẽ khóa ca.",
    clear: "Xóa",
    send: "Gửi",
    end: "Kết ca",
    history: "Lịch sử",
    allocation: "Phân bổ",
    refill: "Bổ sung",
    sendAllocation: "Gửi phân bổ",
    sendRefill: "Gửi bổ sung",
    search: "Tìm tên hoặc SKU",
    sendNote: "Phân bổ là lần gửi đầu. Bổ sung thêm hàng trong ca. Cả hai vào két cửa hàng đang chọn.",
    needQty: "Nhập số lượng cho ít nhất một món.",
    endSummary: "Bản tóm tắt sẽ gửi lên BOT HUB trong vòng 5 phút.",
    tillOpen: "Két vẫn mở cho đến khi nhân viên kết ca trên POS.",
    emptyHistory: "Ca này chưa gửi phân bổ hoặc bổ sung.",
    sent: "đã gửi",
    received: "đã nhận",
    failed: "Có lỗi xảy ra.",
    store: "Cửa hàng",
    language: "Ngôn ngữ",
    sendType: "Loại gửi",
    categories: "Danh mục",
    all: "Tất cả",
    decrease: "Giảm",
    increase: "Tăng",
    confirmed: "Đã xác nhận",
    partial: "Thiếu",
    rejected: "Từ chối",
    pending: "Đang chờ",
  },
} as const;

function readLang(): Lang {
  return window.localStorage.getItem(LANG_KEY) === "vi" ? "vi" : "en";
}

function subscribeLang(listener: () => void) {
  langListeners.add(listener);
  return () => langListeners.delete(listener);
}

function chooseLang(next: Lang) {
  window.localStorage.setItem(LANG_KEY, next);
  langListeners.forEach((listener) => listener());
}

async function post(url: string, body: unknown, key?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["idempotency-key"] = key;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), credentials: "same-origin" });
  const data = await response.json();
  if (!response.ok) {
    const failure = new Error(data.error || "Request failed") as Error & { code?: string };
    failure.code = typeof data.code === "string" ? data.code : undefined;
    throw failure;
  }
  return data;
}

function failureText(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    return code ? `${error.message} (${code})` : error.message;
  }
  return fallback;
}

export default function KitchenApp() {
  const lang = useSyncExternalStore(subscribeLang, readLang, () => "en" as Lang);
  const t = COPY[lang];
  const [view, setView] = useState<View | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("send");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [kind, setKind] = useState<Kind>("ALLOCATION");
  const [sendQty, setSendQty] = useState<Record<string, string>>({});
  const [store, setStore] = useState<(typeof STORES)[number]["code"]>(STORES[0].code);

  const load = useCallback(async () => {
    const response = await fetch("/api/kitchen/state", { cache: "no-store", credentials: "same-origin" });
    const data = (await response.json()) as View;
    setView(data);
    if (!data.authenticated && data.error) setError(data.code ? `${data.error} (${data.code})` : data.error);
  }, []);

  useEffect(() => {
    let stop = false;
    const run = () => {
      if (!stop) void load();
    };
    run();
    const timer = window.setInterval(run, 8000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [load]);

  const photos = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of view?.products ?? []) map.set(product.sku, product);
    return map;
  }, [view?.products]);

  const categories = useMemo(
    () => [...new Set((view?.products ?? []).map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [view?.products],
  );
  const activeCategory = category !== "All" && categories.includes(category) ? category : "All";
  const q = query.trim().toLowerCase();
  const sendLines = (view?.products ?? []).filter((product) => {
    if (activeCategory !== "All" && product.category !== activeCategory) return false;
    if (!q) return true;
    return product.sku.includes(q) || product.name.toLowerCase().includes(q);
  });

  function bump(sku: string, delta: number) {
    setSendQty((current) => {
      const next = Math.max(0, Math.min(999, (Number(current[sku]) || 0) + delta));
      const copy = { ...current };
      if (next === 0) delete copy[sku];
      else copy[sku] = String(next);
      return copy;
    });
  }

  async function signIn() {
    setError("");
    setBusy(true);
    try {
      await post("/api/kitchen/login", { pin });
      setPin("");
      setTab("send");
      await load();
    } catch (err) {
      setError(failureText(err, t.failed));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await post("/api/kitchen/logout", {});
    setView(null);
    await load();
  }

  async function sendStock() {
    setError("");
    const lines = Object.entries(sendQty)
      .map(([sku, value]) => ({ sku, qty: Number(value) }))
      .filter((line) => Number.isInteger(line.qty) && line.qty > 0);
    if (lines.length === 0) {
      setError(t.needQty);
      return;
    }
    setBusy(true);
    try {
      await post("/api/kitchen/refill", { kind, lines, store }, crypto.randomUUID());
      setSendQty({});
      await load();
      setTab("history");
    } catch (err) {
      setError(failureText(err, t.failed));
    } finally {
      setBusy(false);
    }
  }

  function statusLabel(status: string) {
    if (status === "CONFIRMED") return t.confirmed;
    if (status === "PARTIAL") return t.partial;
    if (status === "REJECTED") return t.rejected;
    if (status === "PENDING_CONFIRM") return t.pending;
    return status;
  }

  function kindLabel(value: string) {
    if (value === "ALLOCATION") return t.allocation;
    if (value === "REFILL") return t.refill;
    return value;
  }

  const sendLabel = kind === "ALLOCATION" ? t.sendAllocation : t.sendRefill;

  if (!view) return <main className={styles.shell}>{t.loading}</main>;

  if (!view.authenticated) {
    const digits = [
      { id: "1", label: "1" },
      { id: "2", label: "2" },
      { id: "3", label: "3" },
      { id: "4", label: "4" },
      { id: "5", label: "5" },
      { id: "6", label: "6" },
      { id: "7", label: "7" },
      { id: "8", label: "8" },
      { id: "9", label: "9" },
      { id: "clear", label: t.clear },
      { id: "0", label: "0" },
      { id: "back", label: "⌫" },
    ];
    return (
      <main className={styles.shell} data-testid="kitchen-login">
        {view.demo ? <div className={styles.demo}>{view.demo_label} · PIN {view.demo_pin}</div> : null}
        <section className={styles.pin}>
          <div className={styles.storeRow}>
            <select className={styles.store} aria-label={t.store} value={store} onChange={(event) => setStore(event.target.value as (typeof STORES)[number]["code"])}>
              {STORES.map((item) => (
                <option key={item.code} value={item.code}>{item.code} · {item.name}</option>
              ))}
            </select>
            <div className={styles.lang} role="group" aria-label={t.language}>
              <button type="button" aria-pressed={lang === "en"} onClick={() => chooseLang("en")}>ENG</button>
              <button type="button" aria-pressed={lang === "vi"} onClick={() => chooseLang("vi")}>VN</button>
            </div>
          </div>
          <h1>{t.kitchen}</h1>
          <p>{t.pinHelp}</p>
          <div className={styles.pinDisplay} aria-live="polite">{pin.replace(/./g, "•") || " "}</div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.keys}>
            {digits.map((digit) => (
              <button
                key={digit.id}
                type="button"
                onClick={() => {
                  if (digit.id === "clear") setPin("");
                  else if (digit.id === "back") setPin((current) => current.slice(0, -1));
                  else setPin((current) => (current + digit.label).slice(0, 4));
                }}
              >
                {digit.label}
              </button>
            ))}
          </div>
          <button className={styles.primary} type="button" disabled={pin.length !== 4 || busy} onClick={() => void signIn()}>
            {t.signIn}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell} data-testid="kitchen-shell" data-lang={lang}>
      {view.demo ? <div className={styles.demo}>{view.demo_label}</div> : null}
      <header className={styles.header}>
        <div className={styles.storeRow}>
          <select className={styles.store} aria-label={t.store} data-testid="kitchen-store" value={store} onChange={(event) => setStore(event.target.value as (typeof STORES)[number]["code"])}>
            {STORES.map((item) => (
              <option key={item.code} value={item.code}>{item.code} · {item.name}</option>
            ))}
          </select>
          <div className={styles.lang} role="group" aria-label={t.language}>
            <button type="button" aria-pressed={lang === "en"} onClick={() => chooseLang("en")}>ENG</button>
            <button type="button" aria-pressed={lang === "vi"} onClick={() => chooseLang("vi")}>VN</button>
          </div>
        </div>
        <div className={styles.headerTop}>
          <div className={styles.brand}>{t.kitchen} · {view.shift?.staff_name}</div>
          <button className={styles.ghost} type="button" onClick={() => void signOut()}>{t.signOut}</button>
        </div>
        <div className={styles.tabs}>
          {([
            ["send", t.send],
            ["end", t.end],
            ["history", t.history],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={tab === id} className={tab === id ? styles.tabOn : undefined} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </header>
      <div className={styles.body}>
        {error ? <p className={styles.error}>{error}</p> : null}
        {tab === "send" ? (
          <section data-testid="kitchen-send">
            <div className={styles.sendBar}>
              <button className={styles.primary} type="button" disabled={busy} onClick={() => void sendStock()}>
                {sendLabel}
              </button>
            </div>
            <p className={styles.note}>{t.sendNote}</p>
            <div className={styles.kind} role="group" aria-label={t.sendType}>
              <button type="button" aria-pressed={kind === "ALLOCATION"} className={kind === "ALLOCATION" ? styles.kindOn : undefined} onClick={() => setKind("ALLOCATION")}>{t.allocation}</button>
              <button type="button" aria-pressed={kind === "REFILL"} className={kind === "REFILL" ? styles.kindOn : undefined} onClick={() => setKind("REFILL")}>{t.refill}</button>
            </div>
            {categories.length > 0 ? (
              <div className={styles.chips} role="tablist" aria-label={t.categories} data-testid="kitchen-categories">
                {["All", ...categories].map((name) => (
                  <button key={name} type="button" role="tab" aria-selected={activeCategory === name} data-category={name} className={activeCategory === name ? styles.chipOn : styles.chip} onClick={() => setCategory(name)}>
                    {name === "All" ? t.all : name}
                  </button>
                ))}
              </div>
            ) : null}
            <input className={styles.search} value={query} placeholder={t.search} aria-label={t.search} onChange={(event) => setQuery(event.target.value)} />
            {sendLines.map((product) => {
              const qty = Number(sendQty[product.sku]) || 0;
              return (
                <article key={product.sku} className={styles.card}>
                  <ProductPhoto src={product.image_url} alt={product.name} className={styles.photo} placeholderClassName={styles.photoPh} />
                  <div>
                    <div className={styles.name}>{product.sku} · {product.name}</div>
                    <div className={styles.meta}>{product.category}</div>
                    <div className={styles.stepper}>
                      <button type="button" aria-label={`${t.decrease} ${product.name}`} disabled={qty === 0} onClick={() => bump(product.sku, -1)}>−</button>
                      <strong>{qty}</strong>
                      <button type="button" aria-label={`${t.increase} ${product.name}`} disabled={qty >= 999} onClick={() => bump(product.sku, 1)}>+</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
        {tab === "end" ? (
          <section data-testid="kitchen-end">
            <p className={styles.note}>{t.endSummary} {t.tillOpen}</p>
            {(view.count_lines ?? []).map((line) => {
              const photo = photos.get(line.sku);
              return (
                <article key={line.sku} className={styles.card}>
                  <ProductPhoto src={photo?.image_url} alt={line.name} className={styles.photo} placeholderClassName={styles.photoPh} />
                  <div>
                    <div className={styles.name}>{line.name}</div>
                    <div className={styles.meta}>{line.sku} · OH {line.system_qty}</div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
        {tab === "history" ? (
          <section data-testid="kitchen-history">
            {(view.receipts ?? []).length === 0 ? <p className={styles.note}>{t.emptyHistory}</p> : null}
            {(view.receipts ?? []).map((row) => (
              <article key={row.kitchen_row_id} className={styles.history}>
                <strong>{row.name}</strong>
                <div className={styles.meta}>{kindLabel(row.kind)} · {row.sku} · {t.sent} {row.qty_sent} · {t.received} {row.qty_received ?? "—"} · {statusLabel(row.status)}</div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
