"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DurableCommandKeys } from "../../lib/pny-pos/durableCommand";
import styles from "./kitchen.module.css";
import { parseRefillSheetWords, type OcrWord, type RefillSheetDraftLine } from "./refillSheetOcr";

type Product = { sku: string; name: string; category: string; size: string; price_cents?: number; on_hand: number | null; sold_24h: number | null; sold_day?: number; sold_night?: number; pending_qty: number; suggested_refill_qty: number; requested_qty?: number; availability?: string; enabled?: boolean; approval_required?: boolean };
type HistoryRow = { kitchen_row_id: string; batch_id: string; sku: string; name: string; size: string; qty_sent: number; qty_received: number | null; status: string; variance_reason?: string | null; sent_by?: string; received_by?: string | null; approval_required?: boolean; created_at: string; sent_at_toronto?: string; received_at_toronto?: string | null };
type KitchenView = { authenticated: boolean; store_code?: string; stores?: { code: string; name: string }[]; products?: Product[]; history?: HistoryRow[] };
type Screen = "refill" | "confirm" | "history" | "sent" | "scan" | "delete";
type SortKey = "sku" | "on_hand" | "sold_24h" | "pending_qty";
type SortDirection = "asc" | "desc";
type Language = "vi" | "en";
type RefillLine = { sku: string; name: string; size: string; qty: number; approval_required?: boolean };
type ShadowReceiptLine = { sku: string; name: string; qty_sent: number; qty_received: number; variance: number; reason?: string | null };
type ShadowReceipt = { received_by: string; received_at_toronto: string; lines: ShadowReceiptLine[] };
type ShadowBatch = { id: string; store_code: "PNY01_TEST"; sender: string; sent_at: string; status: "PENDING" | "CONFIRMED" | "PARTIAL" | "REJECTED"; lines: RefillLine[]; receipt?: ShadowReceipt };
const SHADOW_KEY = "pnys-pny01-shadow-batches";
const LANGUAGE_KEY = "pnys-kitchen-language";
const isTestStore = process.env.NEXT_PUBLIC_TEST_STORE === "1";
const deploymentLabel = isTestStore ? "PNYS" : "PNY01";

const copy = {
  vi: {
    enterPin: "Nhập mã PIN Kitchen.", signIn: "Đăng nhập", logout: "Đăng xuất", testStore: "CỬA HÀNG THỬ NGHIỆM",
    newRefill: "Tạo hàng bổ sung", confirmBatch: "Xác nhận lô hàng", refillHistory: "Lịch sử bổ sung", sentToStore: "Đã gửi đến cửa hàng",
    store: "Cửa hàng", search: "Tìm SKU, tên hoặc kích cỡ", all: "Tất cả", requestedOnly: "Chỉ hàng được yêu cầu",
    sortBy: "Sắp xếp", onHand: "Tồn kho", sold24h: "Bán 24 giờ", pending: "Đang chờ", refill: "Bổ sung", refillQty: "SL bổ sung",
    useRequested: "Theo yêu cầu", requestedZero: "Chưa yêu cầu", approval: "Cần cửa hàng duyệt", unavailable: "KHÔNG CÓ DỮ LIỆU", noMatch: "Không tìm thấy SKU phù hợp.",
    confirmTitle: "Xác nhận lô bổ sung", confirmHelp: "Kiểm tra từng số lượng trước khi gửi. Tồn kho chỉ thay đổi sau khi nhân viên cửa hàng xác nhận đã nhận.",
    skus: "SKU", totalUnits: "tổng sản phẩm", history: "Lịch sử", waiting: "Chờ nhân viên xác nhận", batch: "Lô", sentBy: "gửi bởi", reason: "Lý do",
    sent: "đã gửi", received: "đã nhận", sentHeading: "Đã gửi hàng bổ sung đến", statusHelp: "Trạng thái: PENDING_CONFIRM. Nhân viên cửa hàng phải xác nhận số lượng đã nhận trước khi tồn kho thay đổi.",
    dashboard: "Trang chính", back: "Quay lại", sendToStore: "Gửi đến cửa hàng", done: "Xong", refillList: "DANH SÁCH BỔ SUNG", totalStock: "TỔNG TỒN KHO", refillTotal: "BỔ SUNG", qtyShort: "SL",
    edit: "Sửa", delete: "Xóa", saveChanges: "Lưu thay đổi", deleteTitle: "Xóa lô bổ sung?", deleteHelp: "Nhân viên cửa hàng sẽ không còn thấy lô này. Tồn kho chưa thay đổi.", deleted: "Đã xóa",
    scanSheet: "Chụp phiếu", scanTitle: "Kiểm tra dữ liệu từ ảnh", scanHelp: "Có thể chụp nhiều phần của phiếu. Kiểm tra và sửa tất cả SKU, số lượng trước khi dùng. Ảnh không được lưu.", addPhoto: "Thêm ảnh", photosRead: "ảnh đã đọc", useDraft: "Dùng bản nháp", addRow: "Thêm dòng", remove: "Bỏ", check: "Cần kiểm tra", confirmRow: "Đúng", rowsNeedCheck: "dòng cần kiểm tra. Không thể dùng bản nháp cho đến khi xác nhận.", readingPhoto: "Đang đọc ảnh", noScan: "Không đọc được dòng nào. Chụp lại ảnh rõ hơn hoặc thêm dòng thủ công.",
  },
  en: {
    enterPin: "Enter the Kitchen PIN.", signIn: "Sign in", logout: "Logout", testStore: "TEST STORE",
    newRefill: "New refill", confirmBatch: "Confirm batch", refillHistory: "Refill history", sentToStore: "Sent to store",
    store: "Store", search: "Search SKU, name or size", all: "All", requestedOnly: "Requested only",
    sortBy: "Sort by", onHand: "On hand", sold24h: "Sold 24h", pending: "Pending", refill: "Refill", refillQty: "Refill qty",
    useRequested: "Use request", requestedZero: "No request", approval: "Store approval required", unavailable: "UNAVAILABLE", noMatch: "No SKUs match this filter.",
    confirmTitle: "Confirm refill batch", confirmHelp: "Review every quantity before sending. Stock will not change until store staff confirms receipt.",
    skus: "SKUs", totalUnits: "total units", history: "History", waiting: "Waiting for staff", batch: "Batch", sentBy: "sent by", reason: "Reason",
    sent: "sent", received: "received", sentHeading: "Refill sent to", statusHelp: "Status: PENDING_CONFIRM. Store staff must confirm the received quantities before stock changes.",
    dashboard: "Dashboard", back: "Back", sendToStore: "Send to store", done: "Done", refillList: "REFILL LIST", totalStock: "TOTAL STOCK", refillTotal: "REFILL", qtyShort: "QTY",
    edit: "Edit", delete: "Delete", saveChanges: "Save changes", deleteTitle: "Delete refill batch?", deleteHelp: "Store staff will no longer see this batch. Stock has not changed.", deleted: "Deleted",
    scanSheet: "Scan sheet", scanTitle: "Check photo data", scanHelp: "You can photograph the sheet in several sections. Check and edit every SKU and quantity before using the draft. Photos are not stored.", addPhoto: "Add another photo", photosRead: "photos read", useDraft: "Use draft", addRow: "Add row", remove: "Remove", check: "Needs check", confirmRow: "Looks right", rowsNeedCheck: "rows need checking. The draft stays locked until they are confirmed.", readingPhoto: "Reading photo", noScan: "No rows were read. Take a clearer photo or add rows manually.",
  },
} as const;

const previewProducts: Product[] = [
  { sku: "240", name: "Preview Product", category: "ADD ONS", size: "each", price_cents: 500, on_hand: 0, sold_24h: 3, pending_qty: 0, suggested_refill_qty: 6, requested_qty: 5, enabled: true },
  { sku: "261-14g", name: "Daydream Diesel", category: "FLOWER", size: "14g", price_cents: 4000, on_hand: 3, sold_24h: 4, pending_qty: 2, suggested_refill_qty: 3 },
  { sku: "396-3g", name: "Preview Flower", category: "FLOWER", size: "3g", price_cents: 3000, on_hand: 0, sold_24h: 0, pending_qty: 4, suggested_refill_qty: 0 },
  { sku: "715", name: "Cigarettes", category: "CIGARETTES", size: "pack", price_cents: 250, on_hand: 12, sold_24h: 4, pending_qty: 0, suggested_refill_qty: 0 },
  { sku: "656", name: "Knock Out MW", category: "EDIBLES", size: "each", price_cents: 3500, on_hand: 0, sold_24h: 0, pending_qty: 0, suggested_refill_qty: 0, enabled: false, approval_required: true },
];
const previewHistory: HistoryRow[] = [
  { kitchen_row_id: "preview-pending", batch_id: "PNYS-PREVIEW", sku: "396-3g", name: "Preview Flower", size: "3g", qty_sent: 4, qty_received: null, status: "PENDING_CONFIRM", created_at: "2026-11-14T02:30:00.000Z" },
  { kitchen_row_id: "preview-confirmed", batch_id: "PNYS-EARLIER", sku: "261-14g", name: "Daydream Diesel", size: "14g", qty_sent: 2, qty_received: 2, status: "CONFIRMED", created_at: "2026-11-13T02:30:00.000Z" },
];
const noProducts: Product[] = [];

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error ?? "Request failed. Try again."));
  return body;
}

async function preprocessRefillPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const analysisScale = Math.min(1, 900 / bitmap.width);
    const analysis = document.createElement("canvas");
    analysis.width = Math.max(1, Math.round(bitmap.width * analysisScale));
    analysis.height = Math.max(1, Math.round(bitmap.height * analysisScale));
    const analysisContext = analysis.getContext("2d", { willReadFrequently: true });
    if (!analysisContext) return [file];
    analysisContext.drawImage(bitmap, 0, 0, analysis.width, analysis.height);
    const pixels = analysisContext.getImageData(0, 0, analysis.width, analysis.height).data;
    let minX = analysis.width, minY = analysis.height, maxX = 0, maxY = 0, found = 0;
    for (let y = 0; y < analysis.height; y += 3) for (let x = 0; x < analysis.width; x += 3) {
      const offset = (y * analysis.width + x) * 4;
      const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
      const light = (r + g + b) / 3;
      if (light < 168 || Math.max(r, g, b) - Math.min(r, g, b) > 62) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); found += 1;
    }
    const enoughPaper = found > (analysis.width * analysis.height) / 180;
    const inverse = 1 / analysisScale;
    const padding = 18 * inverse;
    const cropX = enoughPaper ? Math.max(0, minX * inverse - padding) : 0;
    const cropY = enoughPaper ? Math.max(0, minY * inverse - padding) : 0;
    const cropWidth = enoughPaper ? Math.min(bitmap.width - cropX, (maxX - minX) * inverse + padding * 2) : bitmap.width;
    const cropHeight = enoughPaper ? Math.min(bitmap.height - cropY, (maxY - minY) * inverse + padding * 2) : bitmap.height;
    const outputScale = Math.min(3, 1900 / cropWidth, 5200 / cropHeight);
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(cropWidth * outputScale));
    output.height = Math.max(1, Math.round(cropHeight * outputScale));
    const context = output.getContext("2d", { willReadFrequently: true });
    if (!context) return [file];
    context.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, output.width, output.height);
    const image = context.getImageData(0, 0, output.width, output.height);
    for (let index = 0; index < image.data.length; index += 4) {
      const luminance = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
      const adjusted = Math.max(0, Math.min(255, (luminance - 128) * 1.55 + 150));
      image.data[index] = adjusted; image.data[index + 1] = adjusted; image.data[index + 2] = adjusted;
    }
    context.putImageData(image, 0, 0);
    const contrast = await new Promise<Blob>((resolve) => output.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.92));
    const binary = document.createElement("canvas");
    binary.width = output.width; binary.height = output.height;
    const binaryContext = binary.getContext("2d", { willReadFrequently: true });
    if (!binaryContext) return [contrast];
    const binaryImage = context.getImageData(0, 0, output.width, output.height);
    for (let index = 0; index < binaryImage.data.length; index += 4) {
      const value = binaryImage.data[index] < 188 ? 0 : 255;
      binaryImage.data[index] = value; binaryImage.data[index + 1] = value; binaryImage.data[index + 2] = value;
    }
    binaryContext.putImageData(binaryImage, 0, 0);
    const threshold = await new Promise<Blob>((resolve) => binary.toBlob((blob) => resolve(blob ?? contrast), "image/jpeg", 0.95));
    return [contrast, threshold];
  } finally {
    bitmap.close();
  }
}

function screenTitle(screen: Screen, language: Language) {
  const text = copy[language];
  if (screen === "refill") return text.newRefill;
  if (screen === "confirm") return text.confirmBatch;
  if (screen === "history") return text.refillHistory;
  if (screen === "scan") return text.scanTitle;
  if (screen === "delete") return text.deleteTitle;
  return text.sentToStore;
}

function readShadowBatches() {
  try { return JSON.parse(localStorage.getItem(SHADOW_KEY) || "[]") as ShadowBatch[]; }
  catch { return [] as ShadowBatch[]; }
}

function withShadowReceipts(next: KitchenView): KitchenView {
  const batches = readShadowBatches();
  const receivedBySku = new Map<string, number>();
  for (const batch of batches) for (const line of batch.receipt?.lines ?? []) {
    receivedBySku.set(line.sku, (receivedBySku.get(line.sku) ?? 0) + line.qty_received);
  }
  const products = (next.products ?? []).map((product) => ({
    ...product,
    on_hand: product.on_hand == null ? null : product.on_hand + (receivedBySku.get(product.sku) ?? 0),
  }));
  const history = batches.flatMap((batch) => batch.lines.map((line) => {
    const received = batch.receipt?.lines.find((row) => row.sku === line.sku);
    return {
      kitchen_row_id: `${batch.id}:${line.sku}`,
      batch_id: batch.id,
      sku: line.sku,
      name: line.name,
      size: line.size,
      qty_sent: line.qty,
      qty_received: received?.qty_received ?? null,
      status: batch.status === "PENDING" ? "PENDING_CONFIRM" : batch.status,
      variance_reason: received?.reason ?? null,
      sent_by: batch.sender,
      received_by: batch.receipt?.received_by ?? null,
      created_at: batch.sent_at,
      sent_at_toronto: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }).format(new Date(batch.sent_at)),
      received_at_toronto: batch.receipt?.received_at_toronto ?? null,
      approval_required: line.approval_required,
    } satisfies HistoryRow;
  }));
  return { ...next, products, history };
}

export default function KitchenApp({ preview }: { preview?: "login" | Screen }) {
  const isPreview = Boolean(preview);
  const initialScreen = preview && preview !== "login" ? preview : "refill";
  const [view, setView] = useState<KitchenView>(() => preview === "login" ? { authenticated: false } : isPreview ? { authenticated: true, store_code: "PNYS", stores: [{ code: "PNYS", name: "PNYS Test Store" }], products: previewProducts, history: previewHistory } : { authenticated: false });
  const [pin, setPin] = useState("");
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [query, setQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState(isTestStore ? "PNYS" : "PNY01");
  const [skuRange, setSkuRange] = useState("all");
  const [requestedOnly, setRequestedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("sku");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [language, setLanguage] = useState<Language>("vi");
  const [qty, setQty] = useState<Record<string, string>>(() => preview === "sent" ? { "240": "6", "261-14g": "3" } : ({} as Record<string, string>));
  const [sentLines, setSentLines] = useState<RefillLine[]>(() => preview === "sent" ? [
    { sku: "240", name: "Preview Product", size: "each", qty: 6 },
    { sku: "261-14g", name: "Daydream Diesel", size: "14g", qty: 3 },
  ] : []);
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [scanLines, setScanLines] = useState<RefillSheetDraftLine[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPhotoCount, setScanPhotoCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const commands = useMemo(() => new DurableCommandKeys(), []);
  const text = copy[language];

  useEffect(() => {
    if (isPreview) return;
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === "vi" || saved === "en") window.setTimeout(() => setLanguage(saved), 0);
  }, [isPreview]);

  function chooseLanguage(next: Language) {
    setLanguage(next);
    if (!isPreview) localStorage.setItem(LANGUAGE_KEY, next);
  }

  async function load(storeCode?: string) {
    const query = storeCode ? `?store=${encodeURIComponent(storeCode)}` : "";
    const response = await fetch(`/api/pos/kitchen/state${query}`, { cache: "no-store", credentials: "same-origin" });
    if (response.status === 401) { setView({ authenticated: false }); return; }
    const next = await readJson(response) as unknown as KitchenView;
    setView(next);
    setSelectedStore(next.store_code ?? "PNYS");
  }

  useEffect(() => {
    if (isPreview) return;
    const controller = new AbortController();
    void fetch("/api/pos/kitchen/state", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => response.status === 401 ? ({ authenticated: false } as KitchenView) : await readJson(response) as unknown as KitchenView)
      .then((next) => setView(next))
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load Kitchen."); });
    return () => controller.abort();
  }, [isPreview]);

  useEffect(() => {
    if (isPreview || !view.authenticated || selectedStore === "PNY01_TEST") return;
    if (new URLSearchParams(window.location.search).get("store") !== "PNY01_TEST") return;
    void chooseStore("PNY01_TEST");
    // The query string is a one-time test-store handoff after Kitchen authentication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, view.authenticated, selectedStore]);

  useEffect(() => {
    if (isPreview || !view.authenticated || selectedStore !== "PNY01_TEST") return;
    const refresh = () => { void loadShadowStore(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [isPreview, view.authenticated, selectedStore]);

  const allProducts = view.products ?? noProducts;
  const historyBatches = useMemo(() => {
    const grouped = new Map<string, HistoryRow[]>();
    for (const row of view.history ?? []) grouped.set(row.batch_id, [...(grouped.get(row.batch_id) ?? []), row]);
    return [...grouped.entries()].map(([batch_id, rows]) => ({ batch_id, rows, pending: rows.some((row) => row.status === "PENDING_CONFIRM") && !rows.some((row) => ["CONFIRMED", "PARTIAL", "REJECTED"].includes(row.status)) }));
  }, [view.history]);
  const refillLines = useMemo(() => allProducts.flatMap((product) => {
    const raw = qty[product.sku] ?? "";
    const amount = /^\d+$/.test(raw) ? Number(raw) : 0;
    return amount > 0 ? [{ sku: product.sku, name: product.name, size: product.size, qty: amount, approval_required: product.approval_required }] : [];
  }), [allProducts, qty]);
  const totalUnits = refillLines.reduce((sum, line) => sum + line.qty, 0);
  const totalStockQty = allProducts.reduce((sum, product) => sum + Math.max(0, product.on_hand ?? 0), 0);
  const totalStockValueCents = allProducts.reduce((sum, product) => sum + Math.max(0, product.on_hand ?? 0) * Math.max(0, product.price_cents ?? 0), 0);
  const priceBySku = useMemo(() => new Map(allProducts.map((product) => [product.sku, product.price_cents ?? 0])), [allProducts]);
  const refillValueCents = refillLines.reduce((sum, line) => sum + line.qty * (priceBySku.get(line.sku) ?? 0), 0);
  const money = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
  const skuRanges = useMemo(() => {
    const highest = Math.max(1000, ...allProducts.map((product) => Number.parseInt(product.sku.match(/^\d+/)?.[0] ?? "", 10)).filter(Number.isFinite));
    const last = Math.max(100, Math.floor(highest / 100) * 100);
    return Array.from({ length: (last - 100) / 100 + 1 }, (_, index) => 100 + index * 100);
  }, [allProducts]);
  const products = allProducts.filter((product) => {
    const search = query.trim().toLowerCase();
    const matchesQuery = `${product.sku} ${product.name} ${product.size}`.toLowerCase().includes(search);
    if (!matchesQuery) return false;
    if (requestedOnly && (product.requested_qty ?? 0) <= 0) return false;
    if (!search && skuRange !== "all") {
      const base = Number.parseInt(product.sku.match(/^\d+/)?.[0] ?? "", 10);
      if (!Number.isFinite(base) || Math.floor(base / 100) * 100 !== Number(skuRange)) return false;
    }
    return true;
  }).sort((left, right) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    if (sortKey === "sku") return direction * left.sku.localeCompare(right.sku, "en", { numeric: true });
    const leftValue = left[sortKey];
    const rightValue = right[sortKey];
    if (leftValue == null && rightValue == null) return left.sku.localeCompare(right.sku, "en", { numeric: true });
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    return direction * (leftValue - rightValue || left.sku.localeCompare(right.sku, "en", { numeric: true }));
  });

  function changeSort(next: SortKey) {
    if (sortKey === next) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(next); setSortDirection("asc"); }
  }

  function sortLabel(label: string, key: SortKey) {
    return <><span>{label}</span><b aria-hidden="true">{sortKey === key ? sortDirection === "asc" ? "▲" : "▼" : "↕"}</b></>;
  }

  async function loadShadowStore() {
    const next = await readJson(await fetch("/api/pos/kitchen/pny01-shadow", { cache: "no-store", credentials: "same-origin" })) as unknown as KitchenView;
    setView((current) => ({ ...current, ...withShadowReceipts(next), stores: current.stores }));
    setSelectedStore("PNY01_TEST");
  }

  async function chooseStore(code: string) {
    setBusy(true); setError(""); setQty({}); setSkuRange("all");
    try {
      if (code === "PNY01_TEST") {
        await loadShadowStore();
      } else {
        await load(code);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load that store."); }
    finally { setBusy(false); }
  }

  async function signIn() {
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/kitchen/login", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ pin }) }));
      setPin(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!isPreview) await fetch("/api/pos/kitchen/logout", { method: "POST", credentials: "same-origin" });
    setPin(""); setQty({}); setView({ authenticated: false }); setScreen("refill");
  }

  function reviewBatch() {
    if (!refillLines.length) { setError("Enter a quantity for at least one SKU."); return; }
    setError(""); setScreen("confirm");
  }

  function beginEdit(batchId: string, rows: HistoryRow[]) {
    const pending = rows.filter((row) => row.status === "PENDING_CONFIRM");
    setQty(Object.fromEntries(pending.map((row) => [row.sku, String(row.qty_sent)])));
    setEditingBatch(batchId);
    setDeletingBatch(null);
    setQuery("");
    setSkuRange("all");
    setError("");
    setScreen("refill");
  }

  function askDelete(batchId: string) {
    setDeletingBatch(batchId);
    setError("");
    setScreen("delete");
  }

  async function deleteRefill() {
    if (!deletingBatch) return;
    const body = { store_code: selectedStore, batch_id: deletingBatch };
    const key = commands.key("kitchen-delete-refill", body);
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/kitchen/refills", { method: "DELETE", headers: { "content-type": "application/json", "idempotency-key": key }, credentials: "same-origin", body: JSON.stringify({ ...body, request_id: key }) }));
      commands.complete("kitchen-delete-refill", key);
      setDeletingBatch(null);
      await load(selectedStore);
      setScreen("history");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Refill was not deleted."); }
    finally { setBusy(false); }
  }

  async function readRefillPhoto(file: File) {
    setScreen("scan"); setBusy(true); setError(""); setScanProgress(0);
    let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
    try {
      const { createWorker, OEM, PSM } = await import("tesseract.js");
      worker = await createWorker("eng", OEM.DEFAULT, { logger: (message) => {
        if (message.status === "recognizing text") setScanProgress((current) => Math.max(current, Math.round(message.progress * 45)));
      } });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const prepared = await preprocessRefillPhoto(file);
      const combinedWords: OcrWord[] = [];
      for (const [index, image] of prepared.entries()) {
        const result = await worker.recognize(image, { rotateAuto: true }, { text: true, blocks: true });
        const words = (result.data.words ?? []).map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox })) as OcrWord[];
        combinedWords.push(...words);
        setScanProgress(45 + Math.round(((index + 1) / prepared.length) * 45));
      }
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: "0123456789" });
      const digitResult = await worker.recognize(prepared.at(-1) ?? prepared[0], { rotateAuto: true }, { text: true, blocks: true });
      combinedWords.push(...(digitResult.data.words ?? []).map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox })) as OcrWord[]);
      const detected = parseRefillSheetWords(combinedWords, allProducts);
      setScanLines((current) => {
        const merged = new Map(current.map((line) => [line.sku, line]));
        for (const line of detected) {
          const existing = merged.get(line.sku);
          if (!existing) { merged.set(line.sku, line); continue; }
          if (existing.qty === 0 && line.qty > 0) { merged.set(line.sku, { ...line, id: existing.id }); continue; }
          if (line.qty === 0 && existing.qty > 0) continue;
          if (existing.qty === line.qty) {
            merged.set(line.sku, existing.confidence >= line.confidence ? existing : { ...line, id: existing.id });
            continue;
          }
          merged.set(line.sku, {
            ...line,
            id: existing.id,
            confidence: 0,
            source: `CHECK duplicate: ${existing.qty} / ${line.qty}`,
            needsReview: true,
          });
        }
        return [...merged.values()].sort((left, right) => left.sku.localeCompare(right.sku, "en", { numeric: true }));
      });
      setScanPhotoCount((count) => count + 1);
      setScanProgress(100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that photo.");
    } finally {
      await worker?.terminate().catch(() => undefined);
      if (fileInput.current) fileInput.current.value = "";
      setBusy(false);
    }
  }

  function updateScanLine(id: string, patch: Partial<RefillSheetDraftLine>) {
    setScanLines((current) => current.map((line) => line.id === id ? { ...line, ...patch, needsReview: true, confidence: 0, source: "Edited — confirm this row" } : line));
  }

  function confirmScanLine(id: string) {
    const validSkus = new Set(allProducts.map((product) => product.sku));
    setScanLines((current) => current.map((line) => line.id === id && validSkus.has(line.sku) && Number.isInteger(line.qty) && line.qty > 0 && line.qty <= 999
      ? { ...line, needsReview: false, confidence: 100, source: "Checked manually" }
      : line));
  }

  function useScanDraft() {
    const validSkus = new Set(allProducts.map((product) => product.sku));
    if (!scanLines.length || scanLines.some((line) => line.needsReview || !validSkus.has(line.sku) || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 999)) {
      setError("Check every SKU and quantity before using this draft."); return;
    }
    if (new Set(scanLines.map((line) => line.sku)).size !== scanLines.length) {
      setError("Each SKU can appear only once."); return;
    }
    setQty(Object.fromEntries(scanLines.map((line) => [line.sku, String(line.qty)])));
    setQuery(""); setSkuRange("all"); setError(""); setScreen("refill");
  }

  async function sendRefill() {
    if (!refillLines.length) { setError("Enter a quantity for at least one SKU."); setScreen("refill"); return; }
    if (selectedStore === "PNY01_TEST") {
      const batch: ShadowBatch = { id: `PNY01-TEST-${Date.now()}`, store_code: "PNY01_TEST", sender: "Kitchen", sent_at: new Date().toISOString(), status: "PENDING", lines: refillLines };
      const existing = readShadowBatches();
      localStorage.setItem(SHADOW_KEY, JSON.stringify([...existing, batch]));
      setSentLines(refillLines); setQty({}); setScreen("sent"); return;
    }
    if (isPreview) { setSentLines(refillLines); setScreen("sent"); return; }
    const body = { store_code: selectedStore, ...(editingBatch ? { batch_id: editingBatch } : {}), lines: refillLines.map(({ sku, qty: amount }) => ({ sku, qty: amount })) };
    const slot = editingBatch ? "kitchen-edit-refill" : "kitchen-refill";
    const key = commands.key(slot, body);
    setBusy(true); setError("");
    try {
      await readJson(await fetch("/api/pos/kitchen/refills", { method: editingBatch ? "PATCH" : "POST", headers: { "content-type": "application/json", "idempotency-key": key }, credentials: "same-origin", body: JSON.stringify({ ...body, request_id: key }) }));
      commands.complete(slot, key); setSentLines(refillLines); setQty({}); setEditingBatch(null); await load(selectedStore); setScreen("sent");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Refill was not sent."); }
    finally { setBusy(false); }
  }

  if (!view.authenticated) return <main className={styles.login} data-testid="kitchen-login">
    <section className={styles.loginCard}>
      <div className={styles.language}><button type="button" aria-pressed={language === "vi"} onClick={() => chooseLanguage("vi")}>VN</button><button type="button" aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>ENG</button></div>
      {isTestStore ? <div className={styles.test}>{text.testStore}</div> : null}<h1>{deploymentLabel} Kitchen</h1><p>{text.enterPin}</p>
      <div className={styles.pinDots} aria-label={`${pin.length} digits entered`}>{"●".repeat(pin.length) || "○ ○ ○ ○"}</div>
      <div className={styles.keypad}>{["1","2","3","4","5","6","7","8","9","Clear","0","⌫"].map((key) => <button key={key} type="button" onClick={() => setPin((value) => key === "Clear" ? "" : key === "⌫" ? value.slice(0, -1) : value.length < 6 ? value + key : value)}>{key}</button>)}</div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button className={styles.signIn} type="button" disabled={busy || pin.length === 0} onClick={() => void signIn()}>{text.signIn}</button>
    </section>
  </main>;

  const batchLines = screen === "sent" ? sentLines : refillLines;
  const scanReviewCount = scanLines.filter((line) => line.needsReview).length;
  const batchTotal = batchLines.reduce((sum, line) => sum + line.qty, 0);
  const deletingRows = historyBatches.find((batch) => batch.batch_id === deletingBatch)?.rows.filter((row) => row.status === "PENDING_CONFIRM") ?? [];
  return <main className={styles.shell} data-testid="kitchen-shell" data-kitchen-screen={screen}>
    <header className={styles.top}>
      <div><strong>{selectedStore}</strong><span> · Kitchen</span></div>
      <div className={styles.topStats} aria-label={screenTitle(screen, language)}><span><small>{text.totalStock}</small><strong>{money(totalStockValueCents)}</strong><b>{text.qtyShort} {totalStockQty}</b></span><span><small>{text.refillTotal}</small><strong>{money(refillValueCents)}</strong><b>{text.qtyShort} {totalUnits}</b></span></div>
      <div className={styles.topActions}><div className={styles.language}><button type="button" aria-pressed={language === "vi"} onClick={() => chooseLanguage("vi")}>VN</button><button type="button" aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>ENG</button></div>{isTestStore ? <strong className={styles.test}>{text.testStore}</strong> : null}<button type="button" onClick={() => void logout()}>{text.logout}</button></div>
    </header>
    <div className={styles.middle}>
      {screen === "refill" ? <section data-testid="kitchen-refill">
        {editingBatch ? <div className={styles.editNotice}><strong>{text.edit}: {editingBatch}</strong><button type="button" onClick={() => { setEditingBatch(null); setQty({}); }}>{text.back}</button></div> : null}
        <div className={styles.controlsRow}>
          <label className={styles.controlField} htmlFor="kitchen-store"><span>{text.store}</span><select id="kitchen-store" className={styles.storeSelect} value={selectedStore} disabled={busy} onChange={(event) => void chooseStore(event.target.value)}>
            {[...(view.stores ?? [{ code: "PNY01", name: "P60 Cannabis" }]).filter((store) => store.code !== "PNY01_TEST"), ...(isTestStore ? [{ code: "PNY01_TEST", name: "PNY01 Stock Snapshot · Test Receiver" }] : [])].map((store) => <option key={store.code} value={store.code}>{store.code} · {store.name}</option>)}
          </select></label>
          <label className={styles.controlField} htmlFor="kitchen-search"><span>{text.search}</span><input id="kitchen-search" className={styles.search} placeholder={text.search} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        </div>
        <div className={styles.skuRanges} aria-label="SKU sections"><button type="button" aria-pressed={skuRange === "all"} onClick={() => setSkuRange("all")}>{text.all}</button><button type="button" className={styles.requestedOnly} aria-pressed={requestedOnly} onClick={() => setRequestedOnly((value) => !value)}>{text.requestedOnly}</button>{skuRanges.map((start) => <button key={start} type="button" aria-pressed={skuRange === String(start)} onClick={() => setSkuRange(String(start))}>{start}–{start + 99}</button>)}</div>
        <div className={styles.mobileSort} aria-label="Mobile sort"><strong>{text.sortBy}</strong><button data-column="sku" type="button" aria-pressed={sortKey === "sku"} onClick={() => changeSort("sku")}>{sortLabel("SKU", "sku")}</button><button data-column="stock" type="button" aria-pressed={sortKey === "on_hand"} onClick={() => changeSort("on_hand")}>{sortLabel(text.onHand, "on_hand")}</button><button data-column="sold" type="button" aria-pressed={sortKey === "sold_24h"} onClick={() => changeSort("sold_24h")}>{sortLabel(text.sold24h, "sold_24h")}</button><button data-column="pending" type="button" aria-pressed={sortKey === "pending_qty"} onClick={() => changeSort("pending_qty")}>{sortLabel(text.pending, "pending_qty")}</button></div>
        <div className={styles.legend}><button data-column="sku" type="button" aria-pressed={sortKey === "sku"} onClick={() => changeSort("sku")}>{sortLabel("SKU", "sku")}</button><button data-column="stock" type="button" aria-pressed={sortKey === "on_hand"} onClick={() => changeSort("on_hand")}>{sortLabel(text.onHand, "on_hand")}</button><button data-column="sold" type="button" aria-pressed={sortKey === "sold_24h"} onClick={() => changeSort("sold_24h")}>{sortLabel(text.sold24h, "sold_24h")}</button><button data-column="pending" type="button" aria-pressed={sortKey === "pending_qty"} onClick={() => changeSort("pending_qty")}>{sortLabel(text.pending, "pending_qty")}</button><span>{text.refill}</span></div>
        <div className={styles.products}>{products.map((product) => <article key={product.sku} className={styles.product} data-testid="kitchen-product" data-sku={product.sku}>
          <div className={styles.identity}><strong>{product.sku} · {product.size}</strong><span>{product.name}</span>{product.approval_required ? <em>{text.approval}</em> : null}</div>
          <span className={styles.metric}><small>{text.onHand}</small><strong>{product.on_hand ?? "—"}</strong>{product.on_hand == null ? <small>{product.availability ?? text.unavailable}</small> : null}</span>
          <span className={styles.metric}><small>{text.sold24h}</small><strong>{product.sold_24h ?? 0}</strong></span>
          <span className={styles.metric}><small>{text.pending}</small><strong>{product.pending_qty}</strong></span>
          <label className={styles.qty}><small>{text.refillQty}</small><input inputMode="numeric" aria-label={`Refill ${product.sku} ${product.size}`} value={qty[product.sku] ?? ""} onChange={(event) => setQty((current) => ({ ...current, [product.sku]: event.target.value.replace(/[^\d]/g, "") }))}/>{(product.requested_qty ?? 0) > 0 ? <button type="button" onClick={() => setQty((current) => ({ ...current, [product.sku]: String(product.requested_qty) }))}>{text.useRequested} {product.requested_qty}</button> : <small>{text.requestedZero}</small>}</label>
        </article>)}</div>
        {!products.length ? <p className={styles.empty}>{text.noMatch}</p> : null}
      </section> : null}
      {screen === "confirm" ? <section className={styles.confirm} data-testid="kitchen-confirm"><h1>{text.confirmTitle}</h1><p>{text.confirmHelp}</p><div className={styles.batch}>{batchLines.map((line) => <article key={line.sku}><div><strong>{line.sku} · {line.size}</strong><span>{line.name}</span>{line.approval_required ? <em>{text.approval}</em> : null}</div><strong>{line.qty}</strong></article>)}</div><div className={styles.total}><span>{batchLines.length} {text.skus}</span><strong>{batchTotal} {text.totalUnits}</strong></div></section> : null}
      {screen === "history" ? <section data-testid="kitchen-history"><h1>{text.refillHistory}</h1><div className={styles.history}>{historyBatches.map((batch) => <article className={styles.historyBatch} key={batch.batch_id}><header><div><strong>{text.batch} {batch.batch_id}</strong><small>{batch.rows[0]?.sent_at_toronto ? `${batch.rows[0].sent_at_toronto} Toronto` : ""} · {text.sentBy} {batch.rows[0]?.sent_by ?? "Kitchen"}</small></div>{batch.pending ? <div className={styles.batchActions}><button type="button" onClick={() => beginEdit(batch.batch_id, batch.rows)}>{text.edit}</button><button type="button" className={styles.deleteButton} onClick={() => askDelete(batch.batch_id)}>{text.delete}</button></div> : null}</header><div className={styles.historyLines}>{batch.rows.filter((row) => row.status !== "CANCELLED_BY_KITCHEN").map((row) => <div key={row.kitchen_row_id}><span><strong>{row.sku} · {row.size}</strong><small>{row.name}</small></span><span><strong>{row.qty_sent} {text.sent}{row.qty_received == null ? "" : ` · ${row.qty_received} ${text.received}`}</strong><small className={row.status === "PENDING_CONFIRM" ? styles.pending : styles.confirmed}>{row.status === "PENDING_CONFIRM" ? text.waiting : row.status}</small>{row.variance_reason ? <small>{text.reason}: {row.variance_reason}</small> : null}</span></div>)}</div></article>)}</div></section> : null}
      {screen === "scan" ? <section className={styles.scanReview} data-testid="kitchen-scan-review"><h1>{text.scanTitle}</h1><p>{text.scanHelp}</p><div className={styles.scanPhotoTools}><strong>{scanPhotoCount} {text.photosRead}</strong><button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{text.addPhoto}</button></div>{busy ? <div className={styles.scanProgress}><strong>{text.readingPhoto} · {scanProgress}%</strong><progress max="100" value={scanProgress}/></div> : null}{scanReviewCount ? <p className={styles.scanWarning}><strong>{scanReviewCount}</strong> {text.rowsNeedCheck}</p> : null}{!busy && !scanLines.length ? <p className={styles.empty}>{text.noScan}</p> : null}<datalist id="kitchen-scan-skus">{allProducts.map((product) => <option key={product.sku} value={product.sku}>{product.name} · {product.size}</option>)}</datalist><div className={styles.scanRows}>{scanLines.map((line) => <article key={line.id} data-review={line.needsReview ? "required" : "complete"}><label><span>SKU</span><input list="kitchen-scan-skus" value={line.sku} onChange={(event) => updateScanLine(line.id, { sku: event.target.value.trim() })}/></label><label><span>{text.qtyShort}</span><input inputMode="numeric" value={line.qty || ""} onChange={(event) => updateScanLine(line.id, { qty: Number(event.target.value.replace(/[^\d]/g, "")) })}/></label><div><small>{line.source}</small>{line.needsReview ? <button type="button" onClick={() => confirmScanLine(line.id)}>{text.confirmRow}</button> : <strong>✓</strong>}</div><button type="button" onClick={() => setScanLines((current) => current.filter((item) => item.id !== line.id))}>{text.remove}</button></article>)}</div><button type="button" className={styles.addRow} onClick={() => setScanLines((current) => [...current, { id: crypto.randomUUID(), sku: "", qty: 0, confidence: 0, source: "Manual", needsReview: true }])}>{text.addRow}</button></section> : null}
      {screen === "delete" ? <section className={styles.deleteConfirm} data-testid="kitchen-delete-confirm"><h1>{text.deleteTitle}</h1><p>{text.deleteHelp}</p><strong>{deletingBatch}</strong><div className={styles.batch}>{deletingRows.map((row) => <article key={row.kitchen_row_id}><span>{row.sku} · {row.size}</span><strong>{row.qty_sent}</strong></article>)}</div></section> : null}
      {screen === "sent" ? <section className={styles.sent} data-testid="kitchen-sent"><div className={styles.sentIcon}>✓</div><h1>{text.sentHeading} {selectedStore === "PNY01_TEST" ? "PNY01 TEST RECEIVER" : selectedStore}</h1><div className={styles.batch}>{batchLines.map((line) => <article key={line.sku}><span>{line.sku} · {line.size}</span><strong>{line.qty}</strong></article>)}</div><strong>{batchTotal} {text.totalUnits}</strong><p>{text.statusHelp}</p>{selectedStore === "PNY01_TEST" ? <Link className={styles.receiverLink} href="/pos/pny01-refill-preview">PNY01 TEST RECEIVER</Link> : <button type="button" onClick={() => setScreen("history")}>{text.refillHistory}</button>}</section> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
    <footer className={styles.bottom} data-testid="kitchen-actions">
      <input ref={fileInput} className={styles.fileInput} type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readRefillPhoto(file); }}/>
      {screen === "refill" ? <><button type="button" className={styles.secondary} onClick={() => setScreen("history")}>{text.history}</button><button type="button" className={styles.scan} disabled={busy} onClick={() => { setScanLines([]); setScanPhotoCount(0); fileInput.current?.click(); }}>{text.scanSheet}</button><button type="button" className={styles.primary} disabled={busy || totalUnits === 0} onClick={reviewBatch}>{text.refillList} · {totalUnits}</button></> : null}
      {screen === "confirm" ? <><button type="button" className={styles.secondary} disabled={busy} onClick={() => setScreen("refill")}>{text.back}</button><button type="button" className={styles.primary} disabled={busy} onClick={() => void sendRefill()}>{editingBatch ? text.saveChanges : text.sendToStore} · {batchTotal}</button></> : null}
      {screen === "history" ? <button type="button" className={styles.primary} onClick={() => setScreen("refill")}>{text.dashboard}</button> : null}
      {screen === "scan" ? <><button type="button" className={styles.secondary} disabled={busy} onClick={() => setScreen("refill")}>{text.back}</button><button type="button" className={styles.primary} disabled={busy || scanLines.length === 0 || scanReviewCount > 0} onClick={useScanDraft}>{text.useDraft}</button></> : null}
      {screen === "delete" ? <><button type="button" className={styles.secondary} disabled={busy} onClick={() => setScreen("history")}>{text.back}</button><button type="button" className={styles.danger} disabled={busy} onClick={() => void deleteRefill()}>{text.delete}</button></> : null}
      {screen === "sent" ? <button type="button" className={styles.primary} onClick={() => setScreen("refill")}>{text.done}</button> : null}
    </footer>
  </main>;
}
