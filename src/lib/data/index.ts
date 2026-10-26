import "server-only";
import { MemoryStore } from "./memory-store";
import { SheetsStore } from "./sheets-store";
import type { TableStore } from "./store";

let store: TableStore | null = null;

/**
 * Picks the data source:
 * - Google Sheets when GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are set
 * - otherwise the in-memory fictional dataset (DATA_SOURCE=memory forces this)
 */
export function getStore(): TableStore {
  if (store) return store;
  const id = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const forceMemory = process.env.DATA_SOURCE === "memory";
  store = !forceMemory && id && email && key ? new SheetsStore(id, email, key) : new MemoryStore();
  return store;
}
