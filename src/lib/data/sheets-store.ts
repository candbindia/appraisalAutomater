import "server-only";
import { JWT } from "google-auth-library";
import { headersFor, keyFor, type Row, type TableName } from "./schema";
import type { TableStore } from "./store";

/**
 * Google Sheets-backed store. Server-side only: credentials come from environment
 * variables and are never sent to the browser.
 *
 * Known limitations (acceptable for the PoC, revisit before production):
 * - No transactions: two people saving the same row at the same instant → last write wins.
 * - Writes are serialised within one server instance only.
 * - Sheets API quota is ~60 read requests/min per user; each page load uses one or two batched reads.
 */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const API = "https://sheets.googleapis.com/v4/spreadsheets";

function colLetter(n: number) {
  // 1 → A, 27 → AA
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function q(tab: string) {
  return `'${tab.replace(/'/g, "''")}'`;
}

class SheetsApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Google Sheets API ${status}: ${body.slice(0, 400)}`);
  }
}

export class SheetsStore implements TableStore {
  readonly kind = "sheets" as const;
  private jwt: JWT;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(
    private spreadsheetId: string,
    clientEmail: string,
    privateKey: string
  ) {
    this.jwt = new JWT({ email: clientEmail, key: privateKey.replace(/\\n/g, "\n"), scopes: SCOPES });
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const { token } = await this.jwt.getAccessToken();
    const res = await fetch(`${API}/${this.spreadsheetId}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    if (!res.ok) throw new SheetsApiError(res.status, await res.text());
    return (await res.json()) as T;
  }

  private static toRows(values: string[][] | undefined): Row[] {
    if (!values || values.length === 0) return [];
    const headers = values[0].map((h) => String(h).trim());
    return values
      .slice(1)
      .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? "")])));
  }

  private async tabs(): Promise<Map<string, number>> {
    const meta = await this.call<{ sheets: { properties: { title: string; sheetId: number } }[] }>(
      "?fields=sheets.properties(title,sheetId)"
    );
    return new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  }

  async readTables(tables: TableName[]) {
    const out: Record<TableName, Row[]> = {};
    if (tables.length === 0) return out;
    const fetchSome = async (list: TableName[]) => {
      if (list.length === 0) return;
      const params = new URLSearchParams();
      list.forEach((t) => params.append("ranges", q(t)));
      params.set("valueRenderOption", "FORMATTED_VALUE");
      const data = await this.call<{ valueRanges: { values?: string[][] }[] }>(`/values:batchGet?${params}`);
      list.forEach((t, i) => (out[t] = SheetsStore.toRows(data.valueRanges[i]?.values)));
    };
    try {
      await fetchSome(tables);
    } catch (e) {
      // A missing tab makes the whole batch fail; retry with only the tabs that exist.
      if (!(e instanceof SheetsApiError) || e.status !== 400) throw e;
      const existing = await this.tabs();
      tables.forEach((t) => (out[t] = []));
      await fetchSome(tables.filter((t) => existing.has(t)));
    }
    return out;
  }

  /** Serialise writes in this process to reduce read-modify-write races. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(fn, fn);
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  upsert(table: TableName, rows: Row[]): Promise<void> {
    const key = keyFor(table);
    if (!key) return this.append(table, rows);
    if (rows.length === 0) return Promise.resolve();
    return this.serial(async () => {
      const data = await this.call<{ values?: string[][] }>(`/values/${encodeURIComponent(q(table))}`);
      const values = data.values ?? [];
      if (values.length === 0) throw new Error(`Tab "${table}" has no header row. Run "npm run sheets:setup".`);
      const headers = values[0].map((h) => String(h).trim());
      const keyCol = headers.indexOf(key);
      if (keyCol < 0) throw new Error(`Tab "${table}" is missing the "${key}" column.`);

      const indexByKey = new Map<string, number>();
      values.slice(1).forEach((r, i) => indexByKey.set(String(r[keyCol] ?? ""), i + 2)); // sheet row number

      const updates: { range: string; values: string[][] }[] = [];
      const appends: string[][] = [];

      for (const row of rows) {
        const rowNum = indexByKey.get(row[key]);
        if (rowNum) {
          // Write only the columns we were given, so cells people typed into the sheet
          // (e.g. points) are never overwritten by a stale copy.
          const cols = headers.map((h, i) => (h in row && h !== key ? i : -1)).filter((i) => i >= 0);
          for (let s = 0; s < cols.length; ) {
            let e = s;
            while (e + 1 < cols.length && cols[e + 1] === cols[e] + 1) e++;
            updates.push({
              range: `${q(table)}!${colLetter(cols[s] + 1)}${rowNum}:${colLetter(cols[e] + 1)}${rowNum}`,
              values: [cols.slice(s, e + 1).map((i) => row[headers[i]])],
            });
            s = e + 1;
          }
        } else {
          appends.push(headers.map((h) => row[h] ?? ""));
        }
      }

      if (updates.length) {
        await this.call(`/values:batchUpdate`, {
          method: "POST",
          body: JSON.stringify({ valueInputOption: "RAW", data: updates }),
        });
      }
      if (appends.length) await this.appendRaw(table, appends);
    });
  }

  append(table: TableName, rows: Row[]): Promise<void> {
    if (rows.length === 0) return Promise.resolve();
    return this.serial(async () => {
      const data = await this.call<{ values?: string[][] }>(`/values/${encodeURIComponent(q(table) + "!1:1")}`);
      const headers = (data.values?.[0] ?? []).map((h) => String(h).trim());
      if (headers.length === 0) throw new Error(`Tab "${table}" has no header row. Run "npm run sheets:setup".`);
      await this.appendRaw(table, rows.map((r) => headers.map((h) => r[h] ?? "")));
    });
  }

  replaceAll(table: TableName, rows: Row[]): Promise<void> {
    return this.serial(async () => {
      const headers = [...headersFor(table)];
      const values = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
      // Write the new content first, then clear anything left below it, so the tab is never empty mid-save.
      await this.call(`/values/${encodeURIComponent(q(table) + "!A1")}?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values }),
      });
      await this.call(`/values/${encodeURIComponent(`${q(table)}!A${values.length + 1}:ZZ`)}:clear`, {
        method: "POST",
        body: "{}",
      });
    });
  }

  ensureTable(table: TableName): Promise<void> {
    return this.serial(async () => {
      const existing = await this.tabs();
      if (existing.has(table)) return;
      const res = await this.call<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: table, gridProperties: { frozenRowCount: 1 } } } }],
        }),
      });
      const sheetId = res.replies[0].addSheet.properties.sheetId;
      await this.call(`/values/${encodeURIComponent(q(table) + "!A1")}?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [[...headersFor(table)]] }),
      });
      await this.call(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.95, green: 0.67, blue: 0.24 } } },
                fields: "userEnteredFormat(textFormat,backgroundColor)",
              },
            },
          ],
        }),
      });
    });
  }

  private async appendRaw(table: TableName, values: string[][]) {
    await this.call(
      `/values/${encodeURIComponent(q(table) + "!A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values }) }
    );
  }
}
