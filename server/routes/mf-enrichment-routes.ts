import type { Express, Request, Response } from "express";
import { db } from "../db";
import {
	mutualFunds,
	mutualFundMetrics,
	mfAumHistory,
	mfEnrichmentAuditLogs,
	mfCategoryRules,
} from "@shared/schema";
import { eq, sql, desc, and, ilike, isNull, or, isNotNull } from "drizzle-orm";

export function registerMFEnrichmentRoutes(app: Express) {
	app.get("/api/funds/list", async (req: Request, res: Response) => {
		try {
			const {
				category,
				planType,
				riskLevel,
				search,
				page = "1",
				limit = "50",
				sortBy = "aum",
				sortOrder = "desc",
			} = req.query;
			const pageNum = Math.max(1, Number.parseInt(page as string) || 1);
			const limitNum = Math.min(
				100,
				Math.max(1, Number.parseInt(limit as string) || 50),
			);
			const offset = (pageNum - 1) * limitNum;

			const conditions: any[] = [eq(mutualFunds.schemeStatus, "active")];
			if (category)
				conditions.push(eq(mutualFunds.category, category as string));
			if (planType)
				conditions.push(eq(mutualFunds.planType, planType as string));
			if (riskLevel)
				conditions.push(eq(mutualFunds.riskLevel, riskLevel as string));
			if (search) conditions.push(ilike(mutualFunds.schemeName, `%${search}%`));

			const whereClause =
				conditions.length > 1 ? and(...conditions) : conditions[0];

			const [countResult] = await db
				.select({ count: sql<number>`COUNT(*)` })
				.from(mutualFunds)
				.where(whereClause);

			const sortColumn =
				sortBy === "nav"
					? mutualFunds.nav
					: sortBy === "returns_1y"
						? mutualFunds.returns1y
						: sortBy === "returns_3y"
							? mutualFunds.returns3y
							: sortBy === "expense_ratio"
								? mutualFunds.expenseRatio
								: sortBy === "name"
									? mutualFunds.schemeName
									: mutualFunds.aum;

			const orderDir =
				sortOrder === "asc" ? sql`ASC NULLS LAST` : sql`DESC NULLS LAST`;

			const funds = await db
				.select({
					schemeCode: mutualFunds.schemeCode,
					schemeName: mutualFunds.schemeName,
					category: mutualFunds.category,
					subCategory: mutualFunds.schemeSubCategory,
					fundHouse: mutualFunds.fundHouse,
					nav: mutualFunds.nav,
					aum: mutualFunds.aum,
					expenseRatio: mutualFunds.expenseRatio,
					riskLevel: mutualFunds.riskLevel,
					returns1y: mutualFunds.returns1y,
					returns3y: mutualFunds.returns3y,
					returns5y: mutualFunds.returns5y,
					planType: mutualFunds.planType,
					isin: mutualFunds.isin,
					launchDate: mutualFunds.launchDate,
					exitLoadPercent: mutualFunds.exitLoadPercent,
					exitLoadDays: mutualFunds.exitLoadDays,
					minSipAmount: mutualFunds.minSipAmount,
					minLumpsumAmount: mutualFunds.minLumpsumAmount,
					sharpeRatio: mutualFundMetrics.sharpeRatio,
					sortinoRatio: mutualFundMetrics.sortinoRatio,
					standardDeviation: mutualFundMetrics.standardDeviation,
					maxDrawdown: mutualFundMetrics.maxDrawdown,
					lastUpdated: mutualFunds.lastUpdated,
				})
				.from(mutualFunds)
				.leftJoin(
					mutualFundMetrics,
					and(
						eq(mutualFunds.schemeCode, mutualFundMetrics.schemeCode),
						eq(
							mutualFundMetrics.fiscalYear,
							sql`(
            SELECT fiscal_year FROM mutual_fund_metrics m2 
            WHERE m2.scheme_code = ${mutualFunds.schemeCode}
            ORDER BY m2.fiscal_year DESC LIMIT 1
          )`,
						),
					),
				)
				.where(whereClause)
				.orderBy(sql`${sortColumn} ${orderDir}`)
				.limit(limitNum)
				.offset(offset);

			res.json({
				success: true,
				data: funds,
				pagination: {
					page: pageNum,
					limit: limitNum,
					total: Number(countResult?.count || 0),
					totalPages: Math.ceil(Number(countResult?.count || 0) / limitNum),
				},
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	app.get("/api/funds/:schemeCode", async (req: Request, res: Response) => {
		try {
			const { schemeCode } = req.params;
			const [fund] = await db
				.select()
				.from(mutualFunds)
				.where(eq(mutualFunds.schemeCode, schemeCode))
				.limit(1);

			if (!fund) {
				return res
					.status(404)
					.json({ success: false, error: "Fund not found" });
			}

			res.json({ success: true, data: fund });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	app.get(
		"/api/funds/:schemeCode/aum-history",
		async (req: Request, res: Response) => {
			try {
				const { schemeCode } = req.params;
				const { days = "90" } = req.query;
				const daysNum = Math.min(365, Number.parseInt(days as string) || 90);

				const cutoffDate = new Date();
				cutoffDate.setDate(cutoffDate.getDate() - daysNum);

				const history = await db
					.select({
						asOfDate: mfAumHistory.asOfDate,
						aum: mfAumHistory.aum,
						source: mfAumHistory.source,
						dayOverDayChangePercent: mfAumHistory.dayOverDayChangePercent,
						anomalyFlag: mfAumHistory.anomalyFlag,
					})
					.from(mfAumHistory)
					.where(
						and(
							eq(mfAumHistory.schemeCode, schemeCode),
							sql`${mfAumHistory.asOfDate} >= ${cutoffDate.toISOString().split("T")[0]}`,
						),
					)
					.orderBy(desc(mfAumHistory.asOfDate))
					.limit(daysNum);

				res.json({ success: true, data: history });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	app.get(
		"/api/funds/category/:category",
		async (req: Request, res: Response) => {
			try {
				const { category } = req.params;
				const { planType, limit = "100" } = req.query;
				const limitNum = Math.min(500, Number.parseInt(limit as string) || 100);

				const conditions: any[] = [
					eq(mutualFunds.category, category),
					eq(mutualFunds.schemeStatus, "active"),
				];
				if (planType)
					conditions.push(eq(mutualFunds.planType, planType as string));

				const funds = await db
					.select({
						schemeCode: mutualFunds.schemeCode,
						schemeName: mutualFunds.schemeName,
						subCategory: mutualFunds.schemeSubCategory,
						fundHouse: mutualFunds.fundHouse,
						nav: mutualFunds.nav,
						aum: mutualFunds.aum,
						returns1y: mutualFunds.returns1y,
						returns3y: mutualFunds.returns3y,
						returns5y: mutualFunds.returns5y,
						riskLevel: mutualFunds.riskLevel,
						expenseRatio: mutualFunds.expenseRatio,
						planType: mutualFunds.planType,
					})
					.from(mutualFunds)
					.where(and(...conditions))
					.orderBy(sql`${mutualFunds.aum} DESC NULLS LAST`)
					.limit(limitNum);

				const rules = await db
					.select()
					.from(mfCategoryRules)
					.where(
						and(
							eq(mfCategoryRules.category, category),
							eq(mfCategoryRules.isActive, true),
						),
					);

				const rule =
					rules.length > 0
						? rules
						: await db
								.select()
								.from(mfCategoryRules)
								.where(
									and(
										eq(mfCategoryRules.subCategory, category),
										eq(mfCategoryRules.isActive, true),
									),
								)
								.limit(1);

				res.json({
					success: true,
					category,
					sebiRules: rule,
					data: funds,
					total: funds.length,
				});
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	app.get(
		"/api/funds/enrichment/audit",
		async (req: Request, res: Response) => {
			try {
				const { schemeCode, changeType, source, limit = "50" } = req.query;
				const limitNum = Math.min(200, Number.parseInt(limit as string) || 50);

				const conditions: any[] = [];
				if (schemeCode)
					conditions.push(
						eq(mfEnrichmentAuditLogs.schemeCode, schemeCode as string),
					);
				if (changeType)
					conditions.push(
						eq(mfEnrichmentAuditLogs.changeType, changeType as string),
					);
				if (source)
					conditions.push(eq(mfEnrichmentAuditLogs.source, source as string));

				const whereClause =
					conditions.length > 0 ? and(...conditions) : undefined;

				const logs = await db
					.select()
					.from(mfEnrichmentAuditLogs)
					.where(whereClause)
					.orderBy(desc(mfEnrichmentAuditLogs.createdAt))
					.limit(limitNum);

				res.json({ success: true, data: logs, total: logs.length });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	app.get(
		"/api/funds/sebi/category-rules",
		async (_req: Request, res: Response) => {
			try {
				const rules = await db
					.select()
					.from(mfCategoryRules)
					.where(eq(mfCategoryRules.isActive, true));
				res.json({ success: true, data: rules });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	app.get(
		"/api/funds/enrichment/null-stats",
		async (_req: Request, res: Response) => {
			try {
				const { mfComprehensiveEnrichmentService } = await import(
					"../services/mf-comprehensive-enrichment-service"
				);
				const stats =
					await mfComprehensiveEnrichmentService.getNullColumnStats();
				res.json({ success: true, stats });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	const isProduction =
		process.env.NODE_ENV === "production" ||
		process.env.REPLIT_DEPLOYMENT === "1";
	if (isProduction) {
		(async () => {
			try {
				const { sebiCategoryEngine } = await import(
					"../services/mf-sebi-category-engine"
				);
				const result = await sebiCategoryEngine.seedCategoryRules();
				if (result.seeded > 0) {
					console.log(`📋 [SEBI] Seeded ${result.seeded} category rules`);
				}
			} catch (e: any) {
				console.log(`[SEBI] Category rules seeding deferred: ${e.message}`);
			}
		})();
	} else {
		console.log(
			"⏭️ [SEBICategoryEngine] Auto-seed skipped (development mode - production only)",
		);
	}

	console.log("✅ MF Enrichment APIs registered (/api/funds/*)");
}
