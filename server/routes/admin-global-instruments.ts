import { Router } from "express";
import { db } from "../db";
import {
	globalInstruments,
	insertGlobalInstrumentSchema,
} from "@shared/schema";
import { eq, and, ilike, sql, desc, asc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const listQuerySchema = z.object({
	assetClass: z.enum(["stock", "etf", "mutual_fund", "bond"]).optional(),
	market: z.string().optional(),
	exchange: z.string().optional(),
	search: z.string().optional(),
	isActive: z.enum(["true", "false"]).optional(),
	page: z.string().optional(),
	limit: z.string().optional(),
	sortBy: z.string().optional(),
	sortOrder: z.enum(["asc", "desc"]).optional(),
});

router.get("/", async (req, res) => {
	try {
		const query = listQuerySchema.parse(req.query);
		const page = Number.parseInt(query.page || "1");
		const limit = Number.parseInt(query.limit || "50");
		const offset = (page - 1) * limit;

		const conditions = [];

		if (query.assetClass) {
			conditions.push(eq(globalInstruments.assetClass, query.assetClass));
		}
		if (query.market) {
			conditions.push(eq(globalInstruments.market, query.market));
		}
		if (query.exchange) {
			conditions.push(eq(globalInstruments.exchange, query.exchange));
		}
		if (query.isActive !== undefined) {
			conditions.push(
				eq(globalInstruments.isActive, query.isActive === "true"),
			);
		}
		if (query.search) {
			conditions.push(
				sql`(${globalInstruments.symbol} ILIKE ${`%${query.search}%`} OR ${globalInstruments.name} ILIKE ${`%${query.search}%`})`,
			);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [instruments, countResult] = await Promise.all([
			db
				.select()
				.from(globalInstruments)
				.where(whereClause)
				.orderBy(
					query.sortOrder === "asc"
						? asc(globalInstruments.symbol)
						: desc(globalInstruments.createdAt),
				)
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)` })
				.from(globalInstruments)
				.where(whereClause),
		]);

		const total = Number(countResult[0]?.count || 0);

		res.json({
			success: true,
			data: instruments,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		});
	} catch (error: any) {
		console.error("[GlobalInstruments] List error:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/stats", async (req, res) => {
	try {
		const stats = await db
			.select({
				assetClass: globalInstruments.assetClass,
				market: globalInstruments.market,
				count: sql<number>`count(*)`,
				activeCount: sql<number>`count(*) filter (where ${globalInstruments.isActive} = true)`,
			})
			.from(globalInstruments)
			.groupBy(globalInstruments.assetClass, globalInstruments.market);

		const byAssetClass: Record<string, number> = {};
		const byMarket: Record<string, number> = {};
		let total = 0;
		let active = 0;

		stats.forEach((row) => {
			const count = Number(row.count);
			const activeC = Number(row.activeCount);
			total += count;
			active += activeC;
			byAssetClass[row.assetClass] =
				(byAssetClass[row.assetClass] || 0) + count;
			byMarket[row.market] = (byMarket[row.market] || 0) + count;
		});

		res.json({
			success: true,
			stats: { total, active, byAssetClass, byMarket },
		});
	} catch (error: any) {
		console.error("[GlobalInstruments] Stats error:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const [instrument] = await db
			.select()
			.from(globalInstruments)
			.where(eq(globalInstruments.id, id))
			.limit(1);

		if (!instrument) {
			return res
				.status(404)
				.json({ success: false, error: "Instrument not found" });
		}

		res.json({ success: true, data: instrument });
	} catch (error: any) {
		console.error("[GlobalInstruments] Get error:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/", async (req, res) => {
	try {
		const data = insertGlobalInstrumentSchema.parse(req.body);

		const existing = await db
			.select()
			.from(globalInstruments)
			.where(
				and(
					eq(globalInstruments.symbol, data.symbol),
					eq(globalInstruments.exchange, data.exchange),
				),
			)
			.limit(1);

		if (existing.length > 0) {
			return res.status(400).json({
				success: false,
				error: `Instrument ${data.symbol} already exists on ${data.exchange}`,
			});
		}

		const [created] = await db
			.insert(globalInstruments)
			.values(data)
			.returning();

		res.json({ success: true, data: created });
	} catch (error: any) {
		console.error("[GlobalInstruments] Create error:", error);
		res.status(400).json({ success: false, error: error.message });
	}
});

router.put("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const data = insertGlobalInstrumentSchema.partial().parse(req.body);

		const [updated] = await db
			.update(globalInstruments)
			.set({ ...data, lastUpdated: new Date() })
			.where(eq(globalInstruments.id, id))
			.returning();

		if (!updated) {
			return res
				.status(404)
				.json({ success: false, error: "Instrument not found" });
		}

		res.json({ success: true, data: updated });
	} catch (error: any) {
		console.error("[GlobalInstruments] Update error:", error);
		res.status(400).json({ success: false, error: error.message });
	}
});

router.delete("/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const [deleted] = await db
			.delete(globalInstruments)
			.where(eq(globalInstruments.id, id))
			.returning();

		if (!deleted) {
			return res
				.status(404)
				.json({ success: false, error: "Instrument not found" });
		}

		res.json({ success: true, message: "Instrument deleted" });
	} catch (error: any) {
		console.error("[GlobalInstruments] Delete error:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/toggle/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const { isActive } = req.body;

		const [updated] = await db
			.update(globalInstruments)
			.set({ isActive, lastUpdated: new Date() })
			.where(eq(globalInstruments.id, id))
			.returning();

		if (!updated) {
			return res
				.status(404)
				.json({ success: false, error: "Instrument not found" });
		}

		res.json({ success: true, data: updated });
	} catch (error: any) {
		console.error("[GlobalInstruments] Toggle error:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

const bulkImportSchema = z.array(
	z.object({
		symbol: z.string().min(1),
		name: z.string().min(1),
		assetClass: z.enum(["stock", "etf", "mutual_fund", "bond"]),
		exchange: z.string().min(1),
		market: z.string().min(1),
		currency: z.string().min(3).max(3),
		isin: z.string().optional(),
		sector: z.string().optional(),
		industry: z.string().optional(),
		marketCapCategory: z.string().optional(),
	}),
);

router.post("/bulk-import", async (req, res) => {
	try {
		const instruments = bulkImportSchema.parse(req.body.instruments);

		let imported = 0;
		let skipped = 0;
		const errors: string[] = [];

		for (const inst of instruments) {
			try {
				const existing = await db
					.select()
					.from(globalInstruments)
					.where(
						and(
							eq(globalInstruments.symbol, inst.symbol),
							eq(globalInstruments.exchange, inst.exchange),
						),
					)
					.limit(1);

				if (existing.length > 0) {
					skipped++;
					continue;
				}

				await db.insert(globalInstruments).values({
					...inst,
					isActive: true,
				});
				imported++;
			} catch (e: any) {
				errors.push(`${inst.symbol}: ${e.message}`);
			}
		}

		res.json({
			success: true,
			result: { imported, skipped, errors: errors.slice(0, 10) },
		});
	} catch (error: any) {
		console.error("[GlobalInstruments] Bulk import error:", error);
		res.status(400).json({ success: false, error: error.message });
	}
});

router.post("/seed-sample", async (req, res) => {
	try {
		const sampleData = [
			{
				symbol: "AAPL",
				name: "Apple Inc.",
				assetClass: "stock",
				exchange: "NASDAQ",
				market: "US",
				currency: "USD",
				sector: "Technology",
				marketCapCategory: "mega",
			},
			{
				symbol: "MSFT",
				name: "Microsoft Corporation",
				assetClass: "stock",
				exchange: "NASDAQ",
				market: "US",
				currency: "USD",
				sector: "Technology",
				marketCapCategory: "mega",
			},
			{
				symbol: "GOOGL",
				name: "Alphabet Inc.",
				assetClass: "stock",
				exchange: "NASDAQ",
				market: "US",
				currency: "USD",
				sector: "Technology",
				marketCapCategory: "mega",
			},
			{
				symbol: "AMZN",
				name: "Amazon.com Inc.",
				assetClass: "stock",
				exchange: "NASDAQ",
				market: "US",
				currency: "USD",
				sector: "Consumer Discretionary",
				marketCapCategory: "mega",
			},
			{
				symbol: "TSLA",
				name: "Tesla Inc.",
				assetClass: "stock",
				exchange: "NASDAQ",
				market: "US",
				currency: "USD",
				sector: "Consumer Discretionary",
				marketCapCategory: "large",
			},
			{
				symbol: "NVDA",
				name: "NVIDIA Corporation",
				assetClass: "stock",
				exchange: "NASDAQ",
				market: "US",
				currency: "USD",
				sector: "Technology",
				marketCapCategory: "mega",
			},
			{
				symbol: "META",
				name: "Meta Platforms Inc.",
				assetClass: "stock",
				exchange: "NASDAQ",
				market: "US",
				currency: "USD",
				sector: "Communication Services",
				marketCapCategory: "mega",
			},
			{
				symbol: "BRK.B",
				name: "Berkshire Hathaway Inc.",
				assetClass: "stock",
				exchange: "NYSE",
				market: "US",
				currency: "USD",
				sector: "Financials",
				marketCapCategory: "mega",
			},
			{
				symbol: "JPM",
				name: "JPMorgan Chase & Co.",
				assetClass: "stock",
				exchange: "NYSE",
				market: "US",
				currency: "USD",
				sector: "Financials",
				marketCapCategory: "mega",
			},
			{
				symbol: "V",
				name: "Visa Inc.",
				assetClass: "stock",
				exchange: "NYSE",
				market: "US",
				currency: "USD",
				sector: "Financials",
				marketCapCategory: "mega",
			},
			{
				symbol: "SPY",
				name: "SPDR S&P 500 ETF Trust",
				assetClass: "etf",
				exchange: "NYSE",
				market: "US",
				currency: "USD",
				sector: "Index",
				marketCapCategory: "large",
			},
			{
				symbol: "QQQ",
				name: "Invesco QQQ Trust",
				assetClass: "etf",
				exchange: "NASDAQ",
				market: "US",
				currency: "USD",
				sector: "Technology",
				marketCapCategory: "large",
			},
			{
				symbol: "VTI",
				name: "Vanguard Total Stock Market ETF",
				assetClass: "etf",
				exchange: "NYSE",
				market: "US",
				currency: "USD",
				sector: "Index",
				marketCapCategory: "large",
			},
			{
				symbol: "IVV",
				name: "iShares Core S&P 500 ETF",
				assetClass: "etf",
				exchange: "NYSE",
				market: "US",
				currency: "USD",
				sector: "Index",
				marketCapCategory: "large",
			},
			{
				symbol: "VOO",
				name: "Vanguard S&P 500 ETF",
				assetClass: "etf",
				exchange: "NYSE",
				market: "US",
				currency: "USD",
				sector: "Index",
				marketCapCategory: "large",
			},
			{
				symbol: "9988.HK",
				name: "Alibaba Group Holding Ltd",
				assetClass: "stock",
				exchange: "HKEX",
				market: "HK",
				currency: "HKD",
				sector: "Technology",
				marketCapCategory: "mega",
			},
			{
				symbol: "0700.HK",
				name: "Tencent Holdings Ltd",
				assetClass: "stock",
				exchange: "HKEX",
				market: "HK",
				currency: "HKD",
				sector: "Technology",
				marketCapCategory: "mega",
			},
			{
				symbol: "7203.T",
				name: "Toyota Motor Corporation",
				assetClass: "stock",
				exchange: "TSE",
				market: "JP",
				currency: "JPY",
				sector: "Consumer Discretionary",
				marketCapCategory: "mega",
			},
			{
				symbol: "6758.T",
				name: "Sony Group Corporation",
				assetClass: "stock",
				exchange: "TSE",
				market: "JP",
				currency: "JPY",
				sector: "Technology",
				marketCapCategory: "large",
			},
			{
				symbol: "HSBA.L",
				name: "HSBC Holdings plc",
				assetClass: "stock",
				exchange: "LSE",
				market: "UK",
				currency: "GBP",
				sector: "Financials",
				marketCapCategory: "mega",
			},
			{
				symbol: "BP.L",
				name: "BP plc",
				assetClass: "stock",
				exchange: "LSE",
				market: "UK",
				currency: "GBP",
				sector: "Energy",
				marketCapCategory: "large",
			},
			{
				symbol: "SAP.DE",
				name: "SAP SE",
				assetClass: "stock",
				exchange: "XETRA",
				market: "EU",
				currency: "EUR",
				sector: "Technology",
				marketCapCategory: "mega",
			},
			{
				symbol: "ASML.AS",
				name: "ASML Holding NV",
				assetClass: "stock",
				exchange: "AMS",
				market: "EU",
				currency: "EUR",
				sector: "Technology",
				marketCapCategory: "mega",
			},
		];

		let imported = 0;
		let skipped = 0;

		for (const inst of sampleData) {
			const existing = await db
				.select()
				.from(globalInstruments)
				.where(
					and(
						eq(globalInstruments.symbol, inst.symbol),
						eq(globalInstruments.exchange, inst.exchange),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				skipped++;
				continue;
			}

			await db.insert(globalInstruments).values({
				...inst,
				isActive: true,
			});
			imported++;
		}

		res.json({
			success: true,
			message: `Sample data seeded: ${imported} imported, ${skipped} skipped (already exist)`,
		});
	} catch (error: any) {
		console.error("[GlobalInstruments] Seed sample error:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

export default router;
