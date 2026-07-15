/**
 * Mutual Funds Storage Facade
 *
 * Domain-scoped facade over DatabaseStorage for mutual fund data,
 * NAV history, and scheme metadata operations.
 *
 * @module data/mf-storage
 */

import { storage } from "../storage";
import type { IStorage } from "../storage-types";

type S = IStorage;

export const mfStorage = {
	getAllMutualFunds: (...a: Parameters<S["getAllMutualFunds"]>) => storage.getAllMutualFunds(...a),
	getMutualFund: (...a: Parameters<S["getMutualFund"]>) => storage.getMutualFund(...a),
	upsertMutualFund: (...a: Parameters<S["upsertMutualFund"]>) => storage.upsertMutualFund(...a),
	searchMutualFunds: (...a: Parameters<S["searchMutualFunds"]>) => storage.searchMutualFunds(...a),
} as const;
