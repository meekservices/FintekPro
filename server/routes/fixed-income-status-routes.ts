import { Router, Request, Response } from "express";
import { fixedIncomeStatusEngine } from "../services/fixed-income-status-engine";
import { runDailyFixedIncomeRefresh } from "../cron/fixed-income-daily-refresh";
import { apiResponse } from "../utils/responses";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";
import { db } from "../db";
import { bondCatalog, fixedIncomeStatusLog } from "@shared/schema";
import {
	seedBondUniverse,
	getBondUniverseStats,
} from "../services/bond-universe-seeder";
import { eq, sql, and, desc } from "drizzle-orm";
import type {
	CorporateBond,
	FixedIncomeLog,
	StatusSummary,
} from "../types/fixedIncome";

const router: Router = Router();

/** Safely parse a query-string param that may be string | string[] | ParsedQs */
function queryInt(value: unknown, fallback: number): number {
	const n = Number.parseInt(String(value), 10);
	return Number.isNaN(n) ? fallback : n;
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

router.get(
	"/advisor/search",
	requireAuth,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { limit = "50", offset = "0" } = req.query;

			const bonds: CorporateBond[] = await db
				.select()
				.from(bondCatalog)
				.where(
					and(
						eq(bondCatalog.isListed, true),
						eq(bondCatalog.status, "published"),
					),
				)
				.limit(queryInt(limit, 50))
				.offset(queryInt(offset, 0))
				.orderBy(desc(bondCatalog.yieldToMaturity));

			const [totalRow] = await db
				.select({ count: sql<string>`count(*)` })
				.from(bondCatalog)
				.where(
					and(
						eq(bondCatalog.isListed, true),
						eq(bondCatalog.status, "published"),
					),
				);

			apiResponse.success(res, {
				bonds: bonds.map((b) => ({
					...b,
					canRecommend: true,
					canTransact: true,
				})),
				total: Number.parseInt(totalRow?.count ?? "0", 10),
				limit: queryInt(limit, 50),
				offset: queryInt(offset, 0),
			});
		} catch (err: unknown) {
			console.error("Error in advisor bond search:", errorMessage(err));
			apiResponse.serverError(res, "Failed to search bonds");
			return;
		}
	},
);

router.get(
	"/holdings",
	requireAuth,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { limit = "100", offset = "0" } = req.query;

			const bonds: CorporateBond[] = await db
				.select()
				.from(bondCatalog)
				.where(
					and(
						eq(bondCatalog.isListed, true),
						sql`${bondCatalog.status} IN ('published', 'draft')`,
					),
				)
				.limit(queryInt(limit, 100))
				.offset(queryInt(offset, 0));

			apiResponse.success(res, {
				bonds: bonds.map((b) => ({
					...b,
					canRecommend: b.status === "published",
					canTransact: b.status === "published",
					viewOnly: b.status === "draft",
					warningBanner:
						b.status === "draft"
							? "This instrument is shown for reference only and cannot be recommended or transacted."
							: null,
				})),
				total: bonds.length,
			});
		} catch (err: unknown) {
			console.error("Error fetching holdings:", errorMessage(err));
			apiResponse.serverError(res, "Failed to fetch holdings");
			return;
		}
	},
);

router.get(
	"/status/summary",
	requireAuth,
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const summary: StatusSummary =
				await fixedIncomeStatusEngine.getStatusSummary();
			apiResponse.success(res, summary);
			return;
		} catch (err: unknown) {
			console.error("Error fetching status summary:", errorMessage(err));
			apiResponse.serverError(res, "Failed to fetch status summary");
			return;
		}
	},
);

router.get(
	"/status/:isin",
	requireAuth,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { isin } = req.params;

			const [bond] = (await db
				.select()
				.from(bondCatalog)
				.where(eq(bondCatalog.isin, isin))) as (CorporateBond | undefined)[];

			if (!bond) {
				apiResponse.notFound(res, "Bond not found");
				return;
			}

			const history =
				await fixedIncomeStatusEngine.getStatusTransitionHistory(isin);

			apiResponse.success(res, {
				isin: bond.isin,
				bondName: bond.bondName,
				currentStatus: bond.status,
				statusReason: bond.unpublishReason,
				statusLastUpdated: bond.updatedAt,
				isListed: bond.isListed,
				liquidityScore: null,
				creditRating: bond.creditRating,
				history,
			});
		} catch (err: unknown) {
			console.error("Error fetching bond status:", errorMessage(err));
			apiResponse.serverError(res, "Failed to fetch bond status");
			return;
		}
	},
);

router.post(
	"/status/:isin/evaluate",
	requireAuth,
	requireRole(["admin"]),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { isin } = req.params;

			const evaluation =
				await fixedIncomeStatusEngine.evaluateInstrumentStatus(isin);

			if (!evaluation) {
				apiResponse.notFound(res, "Bond not found");
				return;
			}

			await fixedIncomeStatusEngine.updateInstrumentStatus(
				isin,
				evaluation,
				"manual",
			);

			apiResponse.success(res, {
				message: evaluation.changed
					? "Status updated"
					: "No status change needed",
				evaluation,
			});
		} catch (err: unknown) {
			console.error("Error evaluating bond status:", errorMessage(err));
			apiResponse.serverError(res, "Failed to evaluate bond status");
			return;
		}
	},
);

router.post(
	"/status/refresh-all",
	requireAuth,
	requireRole(["admin"]),
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const result = await runDailyFixedIncomeRefresh();
			apiResponse.success(res, result);
			return;
		} catch (err: unknown) {
			console.error("Error running status refresh:", errorMessage(err));
			apiResponse.serverError(res, "Failed to run status refresh");
			return;
		}
	},
);

router.get(
	"/status/log",
	requireAuth,
	requireRole(["admin"]),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { limit = "100", offset = "0" } = req.query;

			const logs: FixedIncomeLog[] = await db
				.select()
				.from(fixedIncomeStatusLog)
				.orderBy(desc(fixedIncomeStatusLog.createdAt))
				.limit(queryInt(limit, 100))
				.offset(queryInt(offset, 0));

			apiResponse.success(res, { logs });
			return;
		} catch (err: unknown) {
			console.error("Error fetching status logs:", errorMessage(err));
			apiResponse.serverError(res, "Failed to fetch status logs");
			return;
		}
	},
);

router.get(
	"/bonds/:type/:rating",
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { type, rating } = req.params;
			const { limit = "10", offset = "0" } = req.query;

			const bonds: CorporateBond[] = await db
				.select()
				.from(bondCatalog)
				.where(
					and(
						eq(bondCatalog.isListed, true),
						type !== "all" ? eq(bondCatalog.instrumentType, type) : sql`1=1`,
						rating !== "all"
							? eq(bondCatalog.creditRating, rating)
							: sql`1=1`,
					),
				)
				.limit(queryInt(limit, 10))
				.offset(queryInt(offset, 0))
				.orderBy(desc(bondCatalog.yieldToMaturity));

			apiResponse.success(res, {
				bonds: bonds.map((b) => ({
					...b,
					canRecommend: true,
					canTransact: true,
				})),
				total: bonds.length,
				limit: queryInt(limit, 10),
				offset: queryInt(offset, 0),
			});
		} catch (err: unknown) {
			console.error("Error in bond list:", errorMessage(err));
			apiResponse.serverError(res, "Failed to fetch bonds");
			return;
		}
	},
);

// Admin routes for bond universe seeding

router.post(
	"/admin/seed-universe",
	requireAuth,
	requireRole(["admin"]),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { count = 8000 } = req.body as { count?: number };
			const result = await seedBondUniverse(Math.min(count, 12000));
			apiResponse.success(res, result);
			return;
		} catch (err: unknown) {
			console.error("Error seeding bond universe:", errorMessage(err));
			apiResponse.serverError(res, "Failed to seed bond universe");
			return;
		}
	},
);

router.get(
	"/admin/universe-stats",
	requireAuth,
	requireRole(["admin"]),
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const stats = await getBondUniverseStats();
			apiResponse.success(res, stats);
			return;
		} catch (err: unknown) {
			console.error("Error fetching universe stats:", errorMessage(err));
			apiResponse.serverError(res, "Failed to fetch universe stats");
			return;
		}
	},
);

router.get(
	"/admin/audit-logs",
	requireAuth,
	requireRole(["admin"]),
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const logs: FixedIncomeLog[] = await db
				.select()
				.from(fixedIncomeStatusLog)
				.orderBy(desc(fixedIncomeStatusLog.createdAt))
				.limit(100);

			const formattedLogs = logs.map((log) => ({
				id: log.id.toString(),
				userId: log.triggeredBy ?? "system",
				eventType: "status_change",
				entityType: "fixed_income",
				entityId: log.isin ?? "N/A",
				eventDetails: {
					previousStatus: log.previousStatus,
					newStatus: log.newStatus,
					changeReason: log.changeReason,
					evaluationGates: log.evaluationGates,
				},
				createdAt: log.createdAt?.toISOString() ?? new Date().toISOString(),
			}));

			apiResponse.success(res, formattedLogs);
			return;
		} catch (err: unknown) {
			console.error(
				"Error fetching fixed income audit logs:",
				errorMessage(err),
			);
			apiResponse.serverError(res, "Failed to fetch audit logs");
			return;
		}
	},
);

export default router;
