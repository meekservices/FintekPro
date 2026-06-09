import { Router } from "express";
import { db } from "../db";
import {
	users,
	investmentProposals,
	aiProposalItems as proposalItems,
	ckycRecords,
	agentLeads,
	agentCommissions,
	portfolios,
	portfolioHoldings,
	clientAgentRelationships,
	customerCareAgents,
} from "@shared/schema";
import { eq, and, sql, gte, desc, inArray, or, between } from "drizzle-orm";

const router = Router();

// Helper to get customerCareAgent ID from user ID (via email matching)
// Returns null if no mapping found - caller should handle accordingly
async function getAgentIdForUser(
	userId: string | undefined,
): Promise<string | null> {
	if (!userId) return null;

	// Get user's email
	const userRecord = await db
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	if (!userRecord.length || !userRecord[0].email) return null;

	// Find matching customerCareAgent by email
	const agent = await db
		.select({ id: customerCareAgents.id })
		.from(customerCareAgents)
		.where(eq(customerCareAgents.email, userRecord[0].email))
		.limit(1);

	return agent[0]?.id || null;
}

// Helper to get agent's client IDs from clientAgentRelationships table
async function getAgentClientIds(agentId: string): Promise<string[]> {
	const clients = await db
		.select({ clientId: clientAgentRelationships.clientId })
		.from(clientAgentRelationships)
		.where(
			and(
				eq(clientAgentRelationships.agentId, agentId),
				eq(clientAgentRelationships.isActive, true),
			),
		);
	return clients.map((c) => c.clientId).filter(Boolean) as string[];
}

// Helper to calculate AUM from portfolio holdings
async function calculateAgentAUM(
	clientIds: string[],
): Promise<{ current: number; previous: number }> {
	if (clientIds.length === 0) return { current: 0, previous: 0 };

	// Get all portfolios for agent's clients
	const clientPortfolios = await db
		.select({ id: portfolios.id, totalValue: portfolios.totalValue })
		.from(portfolios)
		.where(inArray(portfolios.userId, clientIds));

	const portfolioIds = clientPortfolios.map((p) => p.id);

	if (portfolioIds.length === 0) {
		// Fallback to portfolio totalValue if no holdings
		const totalFromPortfolios = clientPortfolios.reduce(
			(sum, p) => sum + Number.parseFloat(p.totalValue || "0"),
			0,
		);
		return {
			current: totalFromPortfolios,
			previous: totalFromPortfolios * 0.9,
		};
	}

	// Sum current values from holdings
	const holdingsSum = await db
		.select({
			total: sql<string>`COALESCE(SUM(CAST(current_value AS DECIMAL)), 0)`,
		})
		.from(portfolioHoldings)
		.where(inArray(portfolioHoldings.portfolioId, portfolioIds));

	const currentAUM = Number.parseFloat(holdingsSum[0]?.total || "0");
	// For previous period, we'd need historical snapshots - estimate 90% for now
	return { current: currentAUM, previous: currentAUM * 0.9 };
}

router.get("/revenue/metrics/:period?", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) return res.status(401).json({ error: "Unauthorized" });

		const ccAgentId = await getAgentIdForUser(userId);
		const period = req.params.period || "6m";

		// Get agent's clients using USER ID (as clientAgentRelationships.agentId references users.id)
		const clients = await db
			.select({ clientId: clientAgentRelationships.clientId })
			.from(clientAgentRelationships)
			.where(
				and(
					eq(clientAgentRelationships.agentId, userId),
					eq(clientAgentRelationships.isActive, true),
				),
			);
		const clientIds = clients
			.map((c) => c.clientId)
			.filter(Boolean) as string[];

		// Calculate period date range
		const periodMonths =
			period === "1m" ? 1 : period === "3m" ? 3 : period === "1y" ? 12 : 6;
		const startDate = new Date();
		startDate.setMonth(startDate.getMonth() - periodMonths);
		const prevStartDate = new Date(startDate);
		prevStartDate.setMonth(prevStartDate.getMonth() - periodMonths);

		// Get real AUM from portfolio holdings
		const { current: currentAUM, previous: previousAUM } =
			await calculateAgentAUM(clientIds);
		const aumGrowth =
			previousAUM > 0 ? ((currentAUM - previousAUM) / previousAUM) * 100 : 0;

		// Get real commissions from agentCommissions table using customerCareAgent.id
		const commissions = ccAgentId
			? await db
					.select({
						agentNetCommission: agentCommissions.agentNetCommission,
						agentSettlementStatus: agentCommissions.agentSettlementStatus,
						transactionDate: agentCommissions.transactionDate,
					})
					.from(agentCommissions)
					.where(eq(agentCommissions.agentId, ccAgentId))
			: [];

		// Calculate commission metrics
		const pendingCommissions = commissions
			.filter((c) => c.agentSettlementStatus === "pending")
			.reduce(
				(sum, c) => sum + Number.parseFloat(c.agentNetCommission || "0"),
				0,
			);

		const realizedCommissions = commissions
			.filter((c) => c.agentSettlementStatus === "settled")
			.reduce(
				(sum, c) => sum + Number.parseFloat(c.agentNetCommission || "0"),
				0,
			);

		const totalRevenue = pendingCommissions + realizedCommissions;

		// Calculate revenue in current period vs previous
		const currentPeriodRevenue = commissions
			.filter(
				(c) => c.transactionDate && new Date(c.transactionDate) >= startDate,
			)
			.reduce(
				(sum, c) => sum + Number.parseFloat(c.agentNetCommission || "0"),
				0,
			);

		const prevPeriodRevenue = commissions
			.filter(
				(c) =>
					c.transactionDate &&
					new Date(c.transactionDate) >= prevStartDate &&
					new Date(c.transactionDate) < startDate,
			)
			.reduce(
				(sum, c) => sum + Number.parseFloat(c.agentNetCommission || "0"),
				0,
			);

		const revenueGrowth =
			prevPeriodRevenue > 0
				? ((currentPeriodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100
				: 0;

		// Get client counts from clientAgentRelationships
		const totalClientsResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(clientAgentRelationships)
			.where(eq(clientAgentRelationships.agentId, userId));

		// Get active clients (with portfolio activity in last 90 days)
		const activeClientsResult = await db
			.select({ count: sql<number>`count(DISTINCT user_id)` })
			.from(portfolios)
			.where(
				and(
					inArray(portfolios.userId, clientIds.length > 0 ? clientIds : [""]),
					gte(
						portfolios.updatedAt,
						new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
					),
				),
			);

		// Get proposal metrics using USER ID
		const proposals = await db
			.select()
			.from(investmentProposals)
			.where(eq(investmentProposals.agentId, userId));

		const proposalsSent = proposals.length;
		const proposalsConverted = proposals.filter(
			(p) => p.status === "approved",
		).length;
		const conversionRate =
			proposalsSent > 0 ? (proposalsConverted / proposalsSent) * 100 : 0;

		const totalProposalAmount = proposals.reduce(
			(sum, p) => sum + ((p as any).totalAmount || 0),
			0,
		);
		const avgDealSize =
			proposalsConverted > 0 ? totalProposalAmount / proposalsConverted : 0;

		const metrics = {
			totalAUM: currentAUM,
			aumGrowth: Math.round(aumGrowth * 10) / 10,
			totalRevenue,
			revenueGrowth: Math.round(revenueGrowth * 10) / 10,
			pendingCommissions,
			realizedCommissions,
			totalClients: Number(totalClientsResult[0]?.count) || 0,
			activeClients: Number(activeClientsResult[0]?.count) || 0,
			proposalsSent,
			proposalsConverted,
			conversionRate: Math.round(conversionRate * 10) / 10,
			avgDealSize: Math.round(avgDealSize),
		};

		res.json(metrics);
	} catch (error) {
		console.error("Error fetching revenue metrics:", error);
		res.status(500).json({ error: "Failed to fetch revenue metrics" });
	}
});

router.get("/revenue/product-mix", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) return res.status(401).json({ error: "Unauthorized" });
		const ccAgentId = await getAgentIdForUser(userId);

		// Return empty array if no agent mapping found
		if (!ccAgentId) {
			return res.json([]);
		}

		// Product type to display name and color mapping
		const productConfig: Record<string, { name: string; color: string }> = {
			mutual_funds: { name: "Mutual Funds", color: "#10b981" },
			pms: { name: "PMS", color: "#3b82f6" },
			aif: { name: "AIF", color: "#f59e0b" },
			bonds: { name: "Bonds", color: "#8b5cf6" },
			unlisted: { name: "Unlisted", color: "#ef4444" },
			equity: { name: "Equity", color: "#06b6d4" },
			insurance: { name: "Insurance", color: "#ec4899" },
			loans: { name: "Loans", color: "#84cc16" },
		};

		// Get commissions grouped by product type
		const commissionsByProduct = await db
			.select({
				productType: agentCommissions.productType,
				totalCommission: sql<string>`SUM(CAST(agent_net_commission AS DECIMAL))`,
			})
			.from(agentCommissions)
			.where(eq(agentCommissions.agentId, ccAgentId))
			.groupBy(agentCommissions.productType);

		const totalCommission = commissionsByProduct.reduce(
			(sum, p) => sum + Number.parseFloat(p.totalCommission || "0"),
			0,
		);

		const productMix = commissionsByProduct
			.map((p) => {
				const config = productConfig[p.productType] || {
					name: p.productType,
					color: "#6b7280",
				};
				const commission = Number.parseFloat(p.totalCommission || "0");
				return {
					name: config.name,
					value:
						totalCommission > 0
							? Math.round((commission / totalCommission) * 100)
							: 0,
					color: config.color,
					commission: Math.round(commission),
				};
			})
			.filter((p) => p.commission > 0);

		// If no real data, return empty array (frontend can show "No data" message)
		res.json(productMix.length > 0 ? productMix : []);
	} catch (error) {
		console.error("Error fetching product mix:", error);
		res.status(500).json({ error: "Failed to fetch product mix" });
	}
});

router.get("/revenue/trends/:period?", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) return res.status(401).json({ error: "Unauthorized" });
		const ccAgentId = await getAgentIdForUser(userId);
		const period = req.params.period || "6m";

		// Calculate how many months to show
		const periodMonths =
			period === "1m" ? 1 : period === "3m" ? 3 : period === "1y" ? 12 : 6;

		// Get commissions grouped by month using ccAgentId
		const monthlyCommissions = ccAgentId
			? await db
					.select({
						month: agentCommissions.month,
						revenue: sql<string>`SUM(CAST(agent_net_commission AS DECIMAL))`,
						transactionCount: sql<number>`COUNT(*)`,
					})
					.from(agentCommissions)
					.where(eq(agentCommissions.agentId, ccAgentId))
					.groupBy(agentCommissions.month)
					.orderBy(desc(agentCommissions.month))
					.limit(periodMonths)
			: [];

		// Get agent's clients using USER ID
		const clients = await db
			.select({ clientId: clientAgentRelationships.clientId })
			.from(clientAgentRelationships)
			.where(
				and(
					eq(clientAgentRelationships.agentId, userId),
					eq(clientAgentRelationships.isActive, true),
				),
			);
		const clientIds = clients
			.map((c) => c.clientId)
			.filter(Boolean) as string[];

		// Get monthly AUM snapshots from portfolios
		const portfolioData =
			clientIds.length > 0
				? await db
						.select({
							month: sql<string>`TO_CHAR(updated_at, 'YYYY-MM')`,
							aum: sql<string>`SUM(CAST(total_value AS DECIMAL))`,
						})
						.from(portfolios)
						.where(inArray(portfolios.userId, clientIds))
						.groupBy(sql`TO_CHAR(updated_at, 'YYYY-MM')`)
						.orderBy(desc(sql`TO_CHAR(updated_at, 'YYYY-MM')`))
						.limit(periodMonths)
				: [];

		// Build month labels for last N months
		const monthLabels: string[] = [];
		const now = new Date();
		for (let i = periodMonths - 1; i >= 0; i--) {
			const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
			monthLabels.push(date.toLocaleString("default", { month: "short" }));
		}

		// Create YYYY-MM keys for matching
		const monthKeys: string[] = [];
		for (let i = periodMonths - 1; i >= 0; i--) {
			const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
			monthKeys.push(
				`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
			);
		}

		// Build trends array
		const commissionMap = new Map(
			monthlyCommissions.map((c) => [
				c.month,
				Number.parseFloat(c.revenue || "0"),
			]),
		);
		const aumMap = new Map(
			portfolioData.map((p) => [p.month, Number.parseFloat(p.aum || "0")]),
		);

		// Calculate cumulative client count per month
		const cumulativeClients = clientIds.length;

		const trends = monthLabels.map((month, index) => {
			const key = monthKeys[index];
			return {
				month,
				aum: Math.round(aumMap.get(key) || 0),
				revenue: Math.round(commissionMap.get(key) || 0),
				clients: cumulativeClients,
			};
		});

		res.json(trends);
	} catch (error) {
		console.error("Error fetching trends:", error);
		res.status(500).json({ error: "Failed to fetch trends" });
	}
});

router.get("/revenue/commissions", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) return res.status(401).json({ error: "Unauthorized" });
		const ccAgentId = await getAgentIdForUser(userId);

		// Return empty array if no agent mapping found
		if (!ccAgentId) {
			return res.json([]);
		}

		// Product type display names
		const productNames: Record<string, string> = {
			mutual_funds: "Mutual Funds",
			pms: "PMS",
			aif: "AIF",
			bonds: "Bonds",
			unlisted: "Unlisted",
			equity: "Equity",
			insurance: "Insurance",
			loans: "Loans",
		};

		// Get commissions grouped by product type and settlement status
		const commissionData = await db
			.select({
				productType: agentCommissions.productType,
				settlementStatus: agentCommissions.agentSettlementStatus,
				total: sql<string>`SUM(CAST(agent_net_commission AS DECIMAL))`,
			})
			.from(agentCommissions)
			.where(eq(agentCommissions.agentId, ccAgentId))
			.groupBy(
				agentCommissions.productType,
				agentCommissions.agentSettlementStatus,
			);

		// Aggregate by product
		const productMap = new Map<string, { pending: number; realized: number }>();

		for (const row of commissionData) {
			const existing = productMap.get(row.productType) || {
				pending: 0,
				realized: 0,
			};
			const amount = Number.parseFloat(row.total || "0");

			if (row.settlementStatus === "pending") {
				existing.pending += amount;
			} else if (row.settlementStatus === "settled") {
				existing.realized += amount;
			}

			productMap.set(row.productType, existing);
		}

		// Convert to array format
		const commissions = Array.from(productMap.entries())
			.map(([productType, data]) => ({
				product: productNames[productType] || productType,
				pending: Math.round(data.pending),
				realized: Math.round(data.realized),
				total: Math.round(data.pending + data.realized),
			}))
			.filter((c) => c.total > 0);

		res.json(commissions);
	} catch (error) {
		console.error("Error fetching commissions:", error);
		res.status(500).json({ error: "Failed to fetch commissions" });
	}
});

export default router;
