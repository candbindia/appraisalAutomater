/**
 * One-time Google Sheet setup.
 *
 *   npm run sheets:setup          → creates any missing fixed tabs (Employees, Cycles, Appraisals, AuditLog) + header rows
 *   npm run sheets:setup -- --seed → also creates the per-cycle tabs ("Params 2026-10", "Scores 2026-10", …)
 *                                    and fills EMPTY tabs with the sample data (fictional people,
 *                                    parameters from Appraisal.xlsx)
 *
 * Safe to re-run: it never overwrites or deletes existing rows.
 * Reads credentials from .env.local.
 */
import { readFileSync, existsSync } from "node:fs";
import { JWT } from "google-auth-library";
import { BASE_TABLES, headersFor } from "../src/lib/data/schema";
import { buildSeed } from "../src/lib/data/seed";

function loadEnv(file = ".env.local") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

async function main() {
  loadEnv();
  const id = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!id || !email || !key) {
    console.error("Missing GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in .env.local");
    process.exit(1);
  }
  const seed = process.argv.includes("--seed");
  const jwt = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const { token } = await jwt.getAccessToken();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  const meta = await api<{ properties: { title: string }; sheets: { properties: { title: string; sheetId: number } }[] }>(
    "?fields=properties.title,sheets.properties"
  );
  console.log(`Connected to "${meta.properties.title}"`);

  const SEED = seed ? buildSeed() : {};
  const tables = [...new Set([...Object.keys(BASE_TABLES), ...Object.keys(SEED)])];
  const existing = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const missing = tables.filter((t) => !existing.has(t));
  if (missing.length) {
    const res = await api<{ replies: { addSheet: { properties: { title: string; sheetId: number } } }[] }>(
      ":batchUpdate",
      {
        method: "POST",
        body: JSON.stringify({
          requests: missing.map((title) => ({
            addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
          })),
        }),
      }
    );
    res.replies.forEach((r) => existing.set(r.addSheet.properties.title, r.addSheet.properties.sheetId));
    console.log(`Created tabs: ${missing.join(", ")}`);
  }

  for (const table of tables) {
    const headers = [...headersFor(table)];
    const q = `'${table}'`;
    const cur = await api<{ values?: string[][] }>(`/values/${encodeURIComponent(q)}`);
    const values = cur.values ?? [];

    if (values.length === 0) {
      await api(`/values/${encodeURIComponent(q + "!A1")}?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [headers] }),
      });
      await api(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: { sheetId: existing.get(table), startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.95, green: 0.67, blue: 0.24 } } },
                fields: "userEnteredFormat(textFormat,backgroundColor)",
              },
            },
          ],
        }),
      });
      console.log(`  ${table}: header row written`);
    } else {
      const have = values[0].map((h) => String(h).trim());
      const absent = headers.filter((h) => !have.includes(h));
      if (absent.length) console.warn(`  ${table}: header row is missing columns → ${absent.join(", ")} (add them manually)`);
      else console.log(`  ${table}: header row OK`);
    }

    const dataRows = values.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
    if (seed && SEED[table]?.length) {
      if (dataRows.length) {
        console.log(`  ${table}: already has ${dataRows.length} rows — sample data NOT added`);
      } else {
        const rows = SEED[table].map((r) => headers.map((h) => r[h] ?? ""));
        await api(`/values/${encodeURIComponent(q + "!A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
          method: "POST",
          body: JSON.stringify({ values: rows }),
        });
        console.log(`  ${table}: ${rows.length} sample rows added`);
      }
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/DECODER|PEM|private key/i.test(m)) {
    console.error('GOOGLE_PRIVATE_KEY looks malformed. Copy "private_key" from the JSON file exactly, inside double quotes, keeping the \\n sequences.');
  } else if (/403/.test(m)) {
    console.error("Access denied. Share the Google Sheet with the service account email as an Editor.\n" + m);
  } else if (/404/.test(m)) {
    console.error("Sheet not found. Check GOOGLE_SHEETS_ID (the long ID in the sheet URL).\n" + m);
  } else {
    console.error(m);
  }
  process.exit(1);
});
