import { keyFor, type Row, type TableName } from "./schema";
import { buildSeed } from "./seed";
import type { TableStore } from "./store";

/**
 * In-memory store seeded with fictional people and the MC parameters from Appraisal.xlsx.
 * Used automatically when Google Sheets credentials are not configured.
 * Changes are lost when the dev server restarts.
 */
type Db = Record<TableName, Row[]>;

const g = globalThis as unknown as { __cbMemoryDb?: Db };

function db(): Db {
  if (!g.__cbMemoryDb) g.__cbMemoryDb = buildSeed();
  return g.__cbMemoryDb;
}

export class MemoryStore implements TableStore {
  readonly kind = "memory" as const;

  async readTables(tables: TableName[]) {
    const out: Record<TableName, Row[]> = {};
    for (const t of tables) out[t] = structuredClone(db()[t] ?? []);
    return out;
  }

  async upsert(table: TableName, rows: Row[]) {
    const key = keyFor(table);
    if (!key) return this.append(table, rows);
    const list = (db()[table] ??= []);
    for (const row of rows) {
      const i = list.findIndex((r) => r[key] === row[key]);
      if (i >= 0) list[i] = { ...list[i], ...row };
      else list.push({ ...row });
    }
  }

  async append(table: TableName, rows: Row[]) {
    (db()[table] ??= []).push(...rows.map((r) => ({ ...r })));
  }

  async replaceAll(table: TableName, rows: Row[]) {
    db()[table] = rows.map((r) => ({ ...r }));
  }

  async ensureTable(table: TableName) {
    db()[table] ??= [];
  }
}
