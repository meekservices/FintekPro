/**
 * server/storage/index.ts — Canonical storage entry point
 *
 * This barrel re-exports the unified `storage` singleton and `IStorage` interface.
 * Route files and services should import from here (not from `../storage`).
 *
 * The DatabaseStorage implementation lives in `server/storage.ts` while the
 * domain-split refactoring is in progress.  Once all sub-modules are extracted
 * (user-storage, portfolio-storage, market-storage, admin-storage, loan-storage,
 * tax-storage, unlisted-storage) this file will switch to importing from those.
 *
 * @purpose  Single canonical import path for the storage layer
 * @outputs  { storage, IStorage, DatabaseStorage }
 */
export { storage, DatabaseStorage } from "../storage";
export type { IStorage } from "../storage-types";
