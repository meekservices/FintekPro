/**
 * Bond Storage Facade
 *
 * Domain-scoped facade over DatabaseStorage for fixed-income instruments:
 * bonds, NCDs, G-Secs, T-Bills, and treasury operations.
 *
 * Note: Bond-specific methods will be enumerated here as the storage.ts
 * decomposition progresses. Currently a placeholder that imports from the
 * central storage singleton.
 *
 * @module data/bond-storage
 */

import { storage } from "../storage";

// Bond-domain methods are sparsely named in storage.ts (mixed with portfolio).
// Export the storage singleton directly for bond contexts until full extraction.
export const bondStorage = storage;
