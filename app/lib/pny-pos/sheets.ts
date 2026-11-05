import { createSign } from "node:crypto";
import { SheetUnavailable } from "./errors.ts";
import { HISTORY_CONFIG_TAB, historySheetConfig, planHistoryWrites, STOCK_HISTORY_HEADERS, STOCK_HISTORY_TAB, type StockHistoryRow } from "./stockHistory.ts";
import type { SheetRow } from "./types.ts";

export type SheetTabSpec = { title: string; headers: string[] };

/** Tabs the till must not overwrite. Items_raw_price is read for prices. SETB inventory pages stay untouched. */
const BLOCKED_WRITE_TABS = new Set(["Items_raw_price", "Products", "S_Stock", "K_Allocations", "Flowers_Raw", "Items_Raw"]);

export function sheetWriteAllowed(tab: string) {
  if (BLOCKED_WRITE_TABS.has(tab)) return false;
  if (/setb/i.test(tab)) return false;
  return true;
}

export type SheetClient = {
  configured: boolean;
  readRows(tab: string): Promise<SheetRow[]>;
  readGrid?(tab: string): Promise<string[][]>;
  writeGrid?(tab: string, grid: string[][]): Promise<void>;
  listTitles?(): Promise<string[]>;
  copyTabHidden?(from: string, to: string): Promise<void>;
  writeExactGrid?(tab: string, grid: string[][]): Promise<void>;
  repairPriceGrid?(tab: string, plan: { header: string[]; headerChanged: boolean; append: string[][]; updates: { row: number; values: string[] }[] }): Promise<void>;
  upsert(tab: string, rows: Record<string, string>[]): Promise<void>;
  appendRows(tab: string, rows: Record<string, string>[], idHeader: string): Promise<void>;
  appendStockHistory(rows: Record<string, string>[]): Promise<void>;
  deleteRows(tab: string, rowIds: string[]): Promise<void>;
  ensureTabs(specs: SheetTabSpec[]): Promise<void>;
};

export class LocalSheet implements SheetClient {
  configured = false;
  reachable = true;
  tabs: Record<string, Record<string, string>[]> = {};
  grids: Record<string, string[][]> = {};
  /** Other spreadsheets, keyed by id, then tab. Used for quarterly history files. */
  books: Record<string, Record<string, Record<string, string>[]>> = {};

  async readRows(tab: string): Promise<SheetRow[]> {
    if (!this.reachable) throw new SheetUnavailable();
    return (this.tabs[tab] ?? []).map((row, index) => ({ ...row, _sheet_row: String(index + 2) }));
  }

  async readGrid(tab: string) {
    if (!this.reachable) throw new SheetUnavailable();
    return this.grids[tab] ?? [];
  }

  async writeGrid(tab: string, grid: string[][]) {
    if ((tab !== "Flowers_Raw" && tab !== "Items_Raw") || grid.length === 0) return;
    this.grids[tab] = grid.map((row) => [...row]);
  }

  async ensureTabs(specs: SheetTabSpec[]) {
    for (const spec of specs) if (!this.tabs[spec.title]) this.tabs[spec.title] = [];
  }

  async appendStockHistory(rows: StockHistoryRow[]) {
    if (!this.reachable || rows.length === 0) return;
    const configRows = (this.tabs[HISTORY_CONFIG_TAB] ?? []).map((row) => ({
      key: row.key,
      quarter: row.quarter,
      spreadsheet_id: row.spreadsheet_id,
    }));
    for (const plan of planHistoryWrites(rows, historySheetConfig(configRows, process.env.PNY_HISTORY_SHEETS))) {
      if (!plan.spreadsheetId) {
        const list = this.tabs[STOCK_HISTORY_TAB] ?? [];
        for (const row of plan.rows) list.push({ ...row });
        this.tabs[STOCK_HISTORY_TAB] = list;
        continue;
      }
      const book = this.books[plan.spreadsheetId] ?? {};
      const list = book[plan.tab] ?? [];
      for (const row of plan.rows) list.push({ ...row });
      book[plan.tab] = list;
      this.books[plan.spreadsheetId] = book;
    }
  }

  async appendRows(tab: string, rows: Record<string, string>[], idHeader: string) {
    if (!this.reachable) throw new SheetUnavailable();
    const list = this.tabs[tab] ?? [];
    const have = new Set(list.map((row) => (row[idHeader] ?? row.SKU ?? "").trim()).filter(Boolean));
    for (const row of rows) {
      const id = (row[idHeader] ?? "").trim();
      if (!id || have.has(id)) continue;
      list.push({ ...row });
      have.add(id);
    }
    this.tabs[tab] = list;
  }

  async deleteRows(tab: string, rowIds: string[]) {
    if (!this.reachable) throw new SheetUnavailable();
    const drop = new Set(rowIds.filter(Boolean));
    if (drop.size === 0) return;
    this.tabs[tab] = (this.tabs[tab] ?? []).filter((row) => !drop.has(row.row_id ?? ""));
  }

  async upsert(tab: string, rows: Record<string, string>[]) {
    if (!this.reachable) throw new SheetUnavailable();
    const list = this.tabs[tab] ?? [];
    for (const row of rows) {
      const index = list.findIndex((existing) => existing.row_id === row.row_id);
      if (index >= 0) list[index] = { ...list[index], ...row };
      else list.push({ ...row });
    }
    this.tabs[tab] = list;
  }
}

type TokenCache = { token: string; exp: number };

export class GoogleSheet implements SheetClient {
  configured = true;
  private token: TokenCache | null = null;
  private sheetId: string;
  private email: string;
  private privateKey: string;

  constructor(sheetId: string, email: string, privateKey: string) {
    this.sheetId = sheetId;
    this.email = email;
    this.privateKey = privateKey;
  }

  private async accessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.exp - 60 > now) return this.token.token;
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claim = Buffer.from(
      JSON.stringify({
        iss: this.email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url");
    const unsigned = `${header}.${claim}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    const signature = signer.sign(this.privateKey.replace(/\\n/g, "\n")).toString("base64url");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    });
    if (!response.ok) throw new SheetUnavailable(`Google token failed (${response.status}).`);
    const json = (await response.json()) as { access_token?: string };
    if (!json.access_token) throw new SheetUnavailable("Google token response had no access token.");
    this.token = { token: json.access_token, exp: now + 3600 };
    return json.access_token;
  }

  private async sheetsFetch(path: string, init?: RequestInit, sheetId = this.sheetId): Promise<Record<string, unknown>> {
    const token = await this.accessToken();
    const send = () =>
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
      });
    let response = await send();
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      response = await send();
    }
    if (!response.ok) throw new SheetUnavailable(`Sheets ${path} failed (${response.status}).`, response.status);
    return response.json() as Promise<Record<string, unknown>>;
  }

  async ensureTabs(specs: SheetTabSpec[]) {
    const meta = await this.sheetsFetch("?fields=sheets.properties.title");
    const sheets = (meta.sheets as { properties?: { title?: string } }[] | undefined) ?? [];
    const have = new Set(sheets.map((sheet) => sheet.properties?.title ?? ""));
    const missing = specs.filter((spec) => !have.has(spec.title));
    if (missing.length === 0) return;
    await this.sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: missing.map((spec) => ({ addSheet: { properties: { title: spec.title } } })),
      }),
    });
    for (const spec of missing) {
      await this.sheetsFetch(`/values/${encodeURIComponent(`${spec.title}!A1`)}?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [spec.headers] }),
      });
    }
  }

  async readGrid(tab: string) {
    const data = await this.sheetsFetch(`/values/${encodeURIComponent(tab)}?majorDimension=ROWS`);
    const values = (data.values as string[][] | undefined) ?? [];
    return values.map((row) => row.map((cell) => String(cell ?? "")));
  }

  async writeGrid(tab: string, grid: string[][]) {
    if ((tab !== "Flowers_Raw" && tab !== "Items_Raw") || grid.length < 2) return;
    await this.ensureTabs([{ title: tab, headers: grid[0].map((cell) => String(cell ?? "")) }]);
    await this.sheetsFetch(`/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: grid }),
    });
  }

  async listTitles() {
    const meta = await this.sheetsFetch("?fields=sheets.properties.title");
    const sheets = (meta.sheets as { properties?: { title?: string } }[] | undefined) ?? [];
    return sheets.map((sheet) => sheet.properties?.title ?? "").filter(Boolean);
  }

  async copyTabHidden(from: string, to: string) {
    const values = await this.readGrid(from);
    await this.sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: to, hidden: true } } }] }),
    });
    if (values.length === 0) return;
    await this.sheetsFetch(`/values/${encodeURIComponent(`${to}!A1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    });
  }

  async writeExactGrid(tab: string, grid: string[][]) {
    if (tab !== "Items_raw_price" || grid.length === 0) return;
    await this.repairPriceGrid(tab, { header: grid[0] ?? [], headerChanged: true, append: grid.slice(1), updates: [] });
  }

  /** Add missing Items_raw_price rows and fill blank ones. Does not clear or delete. */
  async repairPriceGrid(tab: string, plan: { header: string[]; headerChanged: boolean; append: string[][]; updates: { row: number; values: string[] }[] }) {
    if (tab !== "Items_raw_price" || plan.header.length === 0) return;
    if (!plan.headerChanged && plan.append.length === 0 && plan.updates.length === 0) return;
    if (plan.headerChanged) {
      await this.sheetsFetch(`/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [plan.header] }),
      });
    }
    if (plan.updates.length > 0) {
      await this.sheetsFetch("/values:batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: plan.updates.map((update) => ({ range: `${tab}!A${update.row}`, values: [update.values] })),
        }),
      });
    }
    if (plan.append.length === 0) return;
    const current = await this.readGrid(tab);
    const headers = (current[0] ?? plan.header).map((cell) => String(cell ?? ""));
    const skuAt = Math.max(0, headers.findIndex((header) => header.trim().toLowerCase().replace(/[\s_]+/g, "") === "sku"));
    const have = new Set<string>();
    for (const row of current.slice(1)) {
      const sku = String(row[skuAt] ?? "").trim().replace(/\.0$/, "").replace(/\s+/g, "");
      if (/^\d+$/.test(sku)) have.add(sku);
    }
    const planSkuAt = Math.max(0, plan.header.findIndex((header) => header.trim().toLowerCase().replace(/[\s_]+/g, "") === "sku"));
    const append = plan.append.filter((row) => {
      const sku = String(row[planSkuAt] ?? "").trim().replace(/\.0$/, "").replace(/\s+/g, "");
      return /^\d+$/.test(sku) && !have.has(sku);
    });
    if (append.length === 0) return;
    await this.sheetsFetch(`/values/${encodeURIComponent(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: append }),
    });
  }

  async readRows(tab: string): Promise<SheetRow[]> {
    const data = await this.sheetsFetch(`/values/${encodeURIComponent(tab)}?majorDimension=ROWS`);
    const values = (data.values as string[][] | undefined) ?? [];
    if (values.length === 0) return [];
    const headers = values[0].map((cell) => String(cell ?? "").trim());
    return values.slice(1).map((cells, index) => {
      const row: SheetRow = { _sheet_row: String(index + 2) };
      headers.forEach((header, cellIndex) => {
        if (header) row[header] = String(cells[cellIndex] ?? "");
      });
      return row;
    });
  }

  async upsert(tab: string, rows: Record<string, string>[]) {
    if (!sheetWriteAllowed(tab) || rows.length === 0) return;
    const raw = await this.sheetsFetch(`/values/${encodeURIComponent(tab)}?majorDimension=ROWS`);
    const values = (raw.values as string[][] | undefined) ?? [];
    let headers = (values[0] ?? []).map((cell) => String(cell ?? "").trim());
    while (headers.length > 0 && headers[headers.length - 1] === "") headers.pop();
    if (headers.length === 0) headers = Object.keys(rows[0] ?? {});
    const extra = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => key && !headers.includes(key));
    if (extra.length || values.length === 0) {
      headers = [...headers, ...extra];
      await this.sheetsFetch(`/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [headers] }),
      });
    }
    const index = new Map<string, number>();
    const idColumn = Math.max(0, headers.indexOf("row_id"));
    values.slice(1).forEach((cells, indexInSheet) => {
      const id = String(cells[idColumn] ?? "");
      if (id) index.set(id, indexInSheet + 2);
    });
    const data: { range: string; values: string[][] }[] = [];
    const append: string[][] = [];
    for (const row of rows) {
      const line = headers.map((header) => row[header] ?? "");
      const at = row.row_id ? index.get(row.row_id) : undefined;
      if (at) data.push({ range: `${tab}!A${at}`, values: [line] });
      else append.push(line);
    }
    if (data.length) {
      await this.sheetsFetch(`/values:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ valueInputOption: "RAW", data }),
      });
    }
    if (append.length) {
      await this.sheetsFetch(`/values/${encodeURIComponent(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ values: append }),
      });
    }
  }

  async deleteRows(tab: string, rowIds: string[]) {
    if (!sheetWriteAllowed(tab)) return;
    const want = new Set(rowIds.map((id) => id.trim()).filter(Boolean));
    if (want.size === 0) return;
    const meta = await this.sheetsFetch("?fields=sheets.properties(title,sheetId)");
    const sheets = (meta.sheets as { properties?: { title?: string; sheetId?: number } }[] | undefined) ?? [];
    const sheetId = sheets.find((sheet) => sheet.properties?.title === tab)?.properties?.sheetId;
    if (sheetId == null) return;
    const raw = await this.sheetsFetch(`/values/${encodeURIComponent(tab)}?majorDimension=ROWS`);
    const values = (raw.values as string[][] | undefined) ?? [];
    const headers = (values[0] ?? []).map((cell) => String(cell ?? "").trim());
    const idColumn = headers.indexOf("row_id");
    if (idColumn < 0) return;
    const indexes = values.slice(1).flatMap((cells, index) => (want.has(String(cells[idColumn] ?? "").trim()) ? [index + 1] : []));
    if (indexes.length === 0) return;
    indexes.sort((left, right) => right - left);
    await this.sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: indexes.map((startIndex) => ({
          deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex, endIndex: startIndex + 1 } },
        })),
      }),
    });
  }

  private historyConfigAt = 0;
  private historyConfig = new Map<string, string>();

  private async loadHistoryConfig() {
    const now = Date.now();
    if (now - this.historyConfigAt < 60_000) return this.historyConfig;
    let rows: SheetRow[] = [];
    try {
      rows = await this.readRows(HISTORY_CONFIG_TAB);
    } catch {
      rows = [];
    }
    this.historyConfig = historySheetConfig(rows, process.env.PNY_HISTORY_SHEETS);
    this.historyConfigAt = now;
    return this.historyConfig;
  }

  private async ensureTabOn(sheetId: string, title: string, headers: readonly string[]) {
    const meta = await this.sheetsFetch("?fields=sheets.properties.title", undefined, sheetId);
    const sheets = (meta.sheets as { properties?: { title?: string } }[] | undefined) ?? [];
    if (sheets.some((sheet) => sheet.properties?.title === title)) return;
    await this.sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    }, sheetId);
    await this.sheetsFetch(`/values/${encodeURIComponent(`${title}!A1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [headers] }),
    }, sheetId);
  }

  private async appendValues(sheetId: string, tab: string, rows: StockHistoryRow[]) {
    const values = rows.map((row) => STOCK_HISTORY_HEADERS.map((header) => row[header] ?? ""));
    const append = () => this.sheetsFetch(`/values/${encodeURIComponent(`${tab}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values }),
    }, sheetId);
    try {
      await append();
    } catch (error) {
      if (!(error instanceof SheetUnavailable) || error.httpStatus !== 400) throw error;
      await this.ensureTabOn(sheetId, tab, STOCK_HISTORY_HEADERS);
      await append();
    }
  }

  async appendStockHistory(rows: StockHistoryRow[]) {
    if (!this.configured || rows.length === 0) return;
    const config = await this.loadHistoryConfig();
    for (const plan of planHistoryWrites(rows, config)) {
      const sheetId = plan.spreadsheetId ?? this.sheetId;
      await this.appendValues(sheetId, plan.tab, plan.rows);
    }
  }

  async appendRows(tab: string, rows: Record<string, string>[], idHeader: string) {
    if (rows.length === 0) return;
    if (tab !== "Items_raw_price" && !sheetWriteAllowed(tab)) return;
    const raw = await this.sheetsFetch(`/values/${encodeURIComponent(tab)}?majorDimension=ROWS`);
    const values = (raw.values as string[][] | undefined) ?? [];
    let headers = (values[0] ?? []).map((cell) => String(cell ?? "").trim());
    while (headers.length > 0 && headers[headers.length - 1] === "") headers.pop();
    const extra = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => key && !headers.includes(key));
    if (headers.length === 0) headers = Object.keys(rows[0] ?? {});
    else if (extra.length) headers = [...headers, ...extra];
    if (values.length === 0 || extra.length) {
      await this.sheetsFetch(`/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [headers] }),
      });
    }
    const idColumn = headers.findIndex((header) => header.toLowerCase() === idHeader.toLowerCase());
    const have = new Set<string>();
    if (idColumn >= 0) {
      for (const cells of values.slice(1)) {
        const id = String(cells[idColumn] ?? "").trim();
        if (id) have.add(id);
      }
    }
    const append = rows
      .filter((row) => {
        const id = (row[idHeader] ?? "").trim();
        return id && !have.has(id);
      })
      .map((row) => headers.map((header) => row[header] ?? ""));
    if (append.length === 0) return;
    await this.sheetsFetch(`/values/${encodeURIComponent(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: append }),
    });
  }
}

export function sheetFromEnv(): SheetClient {
  const id = process.env.GSHEET_ID?.trim() ?? "";
  const email = process.env.GOOGLE_SA_PNY_CLIENT_EMAIL?.trim() ?? "";
  const key = process.env.GOOGLE_SA_PNY_PRIVATE_KEY ?? "";
  if (id && email && key) return new GoogleSheet(id, email, key);
  return new LocalSheet();
}
