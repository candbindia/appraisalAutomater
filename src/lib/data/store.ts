import type { Row, TableName } from "./schema";

/** Minimal table store. Both the Google Sheets store and the in-memory mock implement this. */
export interface TableStore {
  readonly kind: "sheets" | "memory";
  /** Read several tables in one round trip. A table/tab that does not exist reads as empty. */
  readTables(tables: TableName[]): Promise<Record<TableName, Row[]>>;
  /** Insert or replace rows by primary key (only the columns given are changed). */
  upsert(table: TableName, rows: Row[]): Promise<void>;
  /** Append rows without key matching (used for the audit log). */
  append(table: TableName, rows: Row[]): Promise<void>;
  /** Replace every data row in a table (used for a cycle's parameter sheet while HR edits it). */
  replaceAll(table: TableName, rows: Row[]): Promise<void>;
  /** Create the table/tab with its header row if it does not exist yet. */
  ensureTable(table: TableName): Promise<void>;
}
