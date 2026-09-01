import { db } from "../db";
import { symbolMapping, listedStocks, mutualFunds } from "@shared/schema";
import { sql, eq, and } from "drizzle-orm";

export class SymbolMappingService {
	/**
	 * seedSymbolMapping() — runs at boot to populate from existing data:
	 * - For each listed_stock with isin: INSERT NSE entry (provider='NSE', provider_symbol=symbol)
	 * - For each listed_stock with bse_code: INSERT BSE entry (provider='BSE', provider_symbol=bse_code)
	 * - For each listed_stock with exchange_info: Parse and insert entries
	 * - For each mutual_fund with isin: INSERT AMFI entry (provider='AMFI', provider_symbol=scheme_code)
	 */
	async seedSymbolMapping() {
		try {
			// Skip seeding if the table already has a healthy number of rows.
			// Re-seeding thousands of rows on every restart is expensive and unnecessary
			// once the initial seed is complete. Only run when table is empty or near-empty.
			const countResult = await db.execute(
				sql`SELECT COUNT(*)::int AS cnt FROM symbol_mapping`,
			);
			const existingCount: number =
				(countResult as any).rows?.[0]?.cnt ??
				(countResult as any)[0]?.cnt ??
				0;
			if (existingCount > 100) {
				console.log(
					`🌱 Symbol Mapping already seeded (${existingCount} rows) — skipping`,
				);
				return;
			}
			console.log("🌱 Starting Symbol Mapping seeding...");
			// 1. Seed from listed_stocks
			const stocks = await db
				.select()
				.from(listedStocks)
				.where(sql`isin IS NOT NULL`);
			console.log(`Found ${stocks.length} stocks to map`);

			for (const stock of stocks) {
				if (!stock.isin) continue;

				// NSE Mapping
				if (stock.symbol) {
					await this.upsertMapping({
						isin: stock.isin,
						provider: "NSE",
						providerSymbol: stock.symbol,
						providerName: stock.companyName,
						isPrimary: stock.dataSource === "nse",
					});
				}

				// BSE Mapping
				if (stock.bseCode) {
					await this.upsertMapping({
						isin: stock.isin,
						provider: "BSE",
						providerSymbol: stock.bseCode,
						providerName: stock.companyName,
						isPrimary: stock.dataSource === "bse",
					});
				}

				// Additional providers from exchange_info if it exists
				if (stock.exchangeInfo && typeof stock.exchangeInfo === "object") {
					const info = stock.exchangeInfo as any;
					if (info.global && Array.isArray(info.global)) {
						for (const g of info.global) {
							if (g.provider && g.symbol) {
								await this.upsertMapping({
									isin: stock.isin,
									provider: g.provider.toUpperCase(),
									providerSymbol: g.symbol,
									providerName: stock.companyName,
								});
							}
						}
					}
				}
			}

			// 2. Seed from mutual_funds
			const mfs = await db
				.select()
				.from(mutualFunds)
				.where(sql`isin IS NOT NULL`);
			console.log(`Found ${mfs.length} mutual funds to map`);

			for (const mf of mfs) {
				if (!mf.isin) continue;

				// AMFI Mapping
				if (mf.schemeCode) {
					await this.upsertMapping({
						isin: mf.isin,
						provider: "AMFI",
						providerSymbol: mf.schemeCode.toString(),
						providerName: mf.schemeName,
						isPrimary: true,
					});
				}
			}

			console.log("✅ Symbol Mapping seeding completed.");
		} catch (error) {
			console.error("❌ Error seeding Symbol Mapping:", error);
			throw error;
		}
	}

	private async upsertMapping(data: {
		isin: string;
		provider: string;
		providerSymbol: string;
		providerName?: string | null;
		isPrimary?: boolean;
	}) {
		try {
			await db
				.insert(symbolMapping)
				.values({
					isin: data.isin,
					provider: data.provider,
					providerSymbol: data.providerSymbol,
					providerName: data.providerName || null,
					isPrimary: data.isPrimary || false,
					isActive: true,
					lastVerifiedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [symbolMapping.isin, symbolMapping.provider],
					set: {
						providerSymbol: data.providerSymbol,
						providerName: data.providerName || null,
						isPrimary: data.isPrimary || false,
						lastVerifiedAt: new Date(),
					},
				});
		} catch (err) {
			// Log error but continue with other mappings
			console.error(
				`Failed to upsert mapping for ${data.isin} (${data.provider}):`,
				err,
			);
		}
	}

	/**
	 * resolveSymbol(provider: string, providerSymbol: string): Promise<string | null>
	 * returns ISIN
	 */
	async resolveSymbol(
		provider: string,
		providerSymbol: string,
	): Promise<string | null> {
		const results = await db
			.select({ isin: symbolMapping.isin })
			.from(symbolMapping)
			.where(
				and(
					eq(symbolMapping.provider, provider.toUpperCase()),
					eq(symbolMapping.providerSymbol, providerSymbol),
					eq(symbolMapping.isActive, true),
				),
			)
			.limit(1);

		return results.length > 0 ? results[0].isin : null;
	}

	/**
	 * lookupProviders(isin: string): Promise<SymbolMapping[]>
	 * returns all mappings for an ISIN
	 */
	async lookupProviders(isin: string) {
		return await db
			.select()
			.from(symbolMapping)
			.where(
				and(eq(symbolMapping.isin, isin), eq(symbolMapping.isActive, true)),
			);
	}

	/**
	 * rotateSymbol() — Atomically retire the old symbol and register the new one.
	 *
	 * Called when a company changes its NSE/BSE ticker (e.g. MOTHERSUMI → MOTHERSON).
	 * Steps:
	 *  1. Mark any existing active row for (isin, provider) as is_active = false
	 *  2. Upsert the new symbol as the active primary entry
	 *
	 * @param isin           - ISO 6166 identifier (stable through renames)
	 * @param provider       - Exchange identifier: NSE | BSE | AMFI | BLOOMBERG …
	 * @param newProviderSymbol - The new ticker / code assigned by the provider
	 * @param newProviderName   - Optional human-readable name update
	 * @edge_cases If the new symbol already exists as active for a different ISIN,
	 *             the upsert will silently overwrite that mapping's providerName only
	 *             (the unique index is on isin+provider so no cross-ISIN collision).
	 */
	async rotateSymbol(
		isin: string,
		provider: string,
		newProviderSymbol: string,
		newProviderName?: string | null,
	): Promise<void> {
		const normalizedProvider = provider.toUpperCase();
		// 1. Deactivate current active mapping for this ISIN + provider
		await db
			.update(symbolMapping)
			.set({ isActive: false })
			.where(
				and(
					eq(symbolMapping.isin, isin),
					eq(symbolMapping.provider, normalizedProvider),
					eq(symbolMapping.isActive, true),
				),
			);
		// 2. Upsert the new symbol as active primary
		await this.upsertMapping({
			isin,
			provider: normalizedProvider,
			providerSymbol: newProviderSymbol,
			providerName: newProviderName ?? null,
			isPrimary: true,
		});
	}

	/**
	 * deactivateMapping() — Mark an ISIN+provider mapping as inactive.
	 *
	 * Used when a stock is delisted or suspended from a given exchange.
	 * The mapping record is retained for audit purposes (not deleted).
	 *
	 * @param isin     - ISO 6166 identifier
	 * @param provider - Exchange identifier: NSE | BSE | AMFI …
	 */
	async deactivateMapping(isin: string, provider: string): Promise<void> {
		await db
			.update(symbolMapping)
			.set({ isActive: false })
			.where(
				and(
					eq(symbolMapping.isin, isin),
					eq(symbolMapping.provider, provider.toUpperCase()),
				),
			);
	}

	/**
	 * addMapping(data) — Add a new symbol mapping entry.
	 *
	 * General-purpose insert used by the admin symbol-map endpoint
	 * (/api/marketdata/symbol-map). For symbol rotation on rename,
	 * prefer rotateSymbol() which atomically deactivates the old entry.
	 *
	 * @param data - Validated insert payload (see insertSymbolMappingSchema)
	 */
	async addMapping(data: any) {
		return await db
			.insert(symbolMapping)
			.values({
				...data,
				provider: data.provider.toUpperCase(),
				lastVerifiedAt: new Date(),
			})
			.returning();
	}
}

export const symbolMappingService = new SymbolMappingService();
