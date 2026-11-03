import { createSign } from "node:crypto";
import { SheetUnavailable } from "./errors.ts";
import type { SheetRow } from "./types.ts";

export type SheetTabSpec = { title: string; headers: string[] };

/** Tabs the till must not overwrite. Items_raw_price is read for prices. SETB inventory pages stay untouched. */
const BLOCKED_WRITE_TABS = new Set(["Items_raw_price", "Products", "S_Stock", "K_Allocations"]);

export function sheetWriteAllowed(tab: string) {
  if (BLOCKED_WRITE_TABS.has(tab)) return false;
  if (/setb/i.test(tab)) return false;
  return true;
}

export type SheetClient = {
  configured: boolean;
  readRows(tab: string): Promise<SheetRow[]>;
  upsert(tab: string, rows: Record<string, string>[]): Promise<void>;
  ensureTabs(specs: SheetTabSpec[]): Promise<void>;
};

export class LocalSheet implements SheetClient {
  configured = false;
  reachable = true;
  tabs: Record<string, Record<string, string>[]> = {};

  async readRows(tab: string): Promise<SheetRow[]> {
    if (!this.reachable) throw new SheetUnavailable();
    return (this.tabs[tab] ?? []).map((row, index) => ({ ...row, _sheet_row: String(index + 2) }));
  }

  async ensureTabs(specs: SheetTabSpec[]) {
    for (const spec of specs) if (!this.tabs[spec.title]) this.tabs[spec.title] = [];
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

  private async sheetsFetch(path: string, init?: RequestInit) {
    const token = await this.accessToken();
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (response.status === 429 && !(init?.headers as Record<string, string> | undefined)?.["x-sheets-retry"]) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return this.sheetsFetch(path, { ...init, headers: { ...(init?.headers ?? {}), "x-sheets-retry": "1" } });
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
}

export function sheetFromEnv(): SheetClient {
  const id = process.env.GSHEET_ID?.trim() ?? "";
  const email = process.env.GOOGLE_SA_PNY_CLIENT_EMAIL?.trim() ?? "";
  const key = process.env.GOOGLE_SA_PNY_PRIVATE_KEY ?? "";
  if (id && email && key) return new GoogleSheet(id, email, key);
  return new LocalSheet();
}
