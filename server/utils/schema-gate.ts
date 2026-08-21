/**
 * Schema-ready gate — resolves once background migrations complete (or are skipped).
 *
 * This is a standalone module (no imports from index.ts or db.ts) to avoid
 * circular dependency issues when schedulers import it.
 *
 * Data-fetching schedulers MUST await `schemaReady` before querying tables
 * that depend on migration-added columns (e.g. confidence_score on
 * financial_instruments_cache).
 *
 * @module server/utils/schema-gate
 */

let _resolve!: () => void;

/**
 * Promise that resolves when all background schema migrations have completed.
 * Safe to await from any module — no circular import risk.
 */
export const schemaReady = new Promise<void>((r) => {
  _resolve = r;
});

/**
 * Call this once after background migrations finish (or are skipped).
 * Idempotent — subsequent calls are no-ops.
 */
export function markSchemaReady(): void {
  _resolve();
}
