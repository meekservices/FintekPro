// @ts-nocheck
import { Router } from "express";
import { db } from "../db";
import {
	comprehensiveHoldings,
	portfolios,
	portfolioHoldings,
	users,
} from "@shared/schema";
import { eq, and, sql, inArray, or } from "drizzle-orm";

import { requireAgentPortal } from "../middleware/roleMiddleware";

const router = Router();

// Middleware is imported above
const requireAuth = requireAgentPortal;

// In-memory cache: 15 minutes
const alertCache = new Map<string, { data: any; expiresAt: number }>();

async function fetchQuote(
	symbol: string,
): Promise<{ changePercent: number; currentPrice: number } | null> {
	try {
		const { unifiedStockPriceService } = await import(
			"../services/unified-stock-price-service"
		);
		const quote = await unifiedStockPriceService.getQuote(symbol);
		if (quote) {
			return {
				changePercent: quote.changePercent ?? quote.changesPercentage ?? 0,
				currentPrice: quote.price ?? quote.current ?? 0,
			};
		}
	} catch {}
	return null;
}

// GET /market-alerts
router.get("/market-alerts", requireAuth, async (req, res) => {
	try {
		const agentId = (req.user as any)?.id;
		const minMove = Number.parseFloat(String(req.query.minMove || "2.5"));
		const filterClientId = req.query.clientId as string | undefined;

		const cacheKey = `${agentId}:${minMove}`;
		const cached = alertCache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			const data = filterClientId
				? {
						...cached.data,
						alerts: cached.data.alerts.filter((a: any) =>
							a.clients.some((c: any) => c.clientId === filterClientId),
						),
					}
				: cached.data;
			return res.json({ ...data, cached: true });
		}

		// Get agent clients
		const agentClients = await db
			.select({
				id: users.id,
				firstName: users.firstName,
				lastName: users.lastName,
				mobile: users.mobile,
			})
			.from(users)
			.where(
				sql`${users.agentId} = ${agentId} AND 'client' = ANY(${users.roles})`,
			);

		if (agentClients.length === 0) {
			return res.json({
				generatedAt: new Date().toISOString(),
				alerts: [],
				cached: false,
			});
		}

		const clientIds = agentClients.map((c) => c.id);
		const clientMap = new Map(agentClients.map((c) => [c.id, c]));

		// Gather symbols from comprehensive_holdings
		const compH = await db
			.select({
				userId: comprehensiveHoldings.userId,
				symbol: comprehensiveHoldings.symbol,
				assetName: comprehensiveHoldings.assetName,
				marketValue: comprehensiveHoldings.marketValue,
			})
			.from(comprehensiveHoldings)
			.where(
				and(
					inArray(comprehensiveHoldings.userId, clientIds),
					or(
						sql`${comprehensiveHoldings.assetType} = 'equity'`,
						sql`${comprehensiveHoldings.assetType} = 'etf'`,
					),
				),
			)
			.limit(300);

		// Gather from portfolio_holdings
		const clientPortfolios = await db
			.select({ id: portfolios.id, userId: portfolios.userId })
			.from(portfolios)
			.where(inArray(portfolios.userId, clientIds));

		const portfolioIds = clientPortfolios.map((p) => p.id);
		const portfolioUserMap = new Map(
			clientPortfolios.map((p) => [p.id, p.userId]),
		);

		const pfH =
			portfolioIds.length > 0
				? await db
						.select({
							portfolioId: portfolioHoldings.portfolioId,
							symbol: portfolioHoldings.symbol,
							name: portfolioHoldings.name,
							currentValue: portfolioHoldings.currentValue,
						})
						.from(portfolioHoldings)
						.where(
							and(
								inArray(portfolioHoldings.portfolioId, portfolioIds),
								sql`${portfolioHoldings.symbol} IS NOT NULL`,
								sql`${portfolioHoldings.assetType} = 'equity' OR ${portfolioHoldings.assetType} = 'etf'`,
							),
						)
						.limit(300)
				: [];

		// Build symbol → [{clientId, holdingValue, name}] map
		const symbolClientMap = new Map<
			string,
			{
				symbol: string;
				name: string;
				clients: {
					clientId: string;
					clientName: string;
					holdingValue: number;
					phone?: string;
				}[];
			}
		>();

		for (const h of compH) {
			const sym = h.symbol?.toUpperCase();
			if (!sym || sym.length < 2) continue;
			const client = clientMap.get(h.userId || "");
			if (!client) continue;
			if (!symbolClientMap.has(sym))
				symbolClientMap.set(sym, {
					symbol: sym,
					name: h.assetName,
					clients: [],
				});
			symbolClientMap.get(sym)!.clients.push({
				clientId: h.userId || "",
				clientName: `${client.firstName || ""} ${client.lastName || ""}`.trim(),
				holdingValue: Number.parseFloat(String(h.marketValue || 0)),
				phone: client.mobile || undefined,
			});
		}

		for (const h of pfH) {
			const sym = h.symbol?.toUpperCase();
			if (!sym || sym.length < 2) continue;
			const userId = portfolioUserMap.get(h.portfolioId);
			const client = userId ? clientMap.get(userId) : undefined;
			if (!client) continue;
			if (!symbolClientMap.has(sym))
				symbolClientMap.set(sym, {
					symbol: sym,
					name: h.name || sym,
					clients: [],
				});
			symbolClientMap.get(sym)!.clients.push({
				clientId: userId || "",
				clientName: `${client.firstName || ""} ${client.lastName || ""}`.trim(),
				holdingValue: Number.parseFloat(String(h.currentValue || 0)),
				phone: client.mobile || undefined,
			});
		}

		// Fetch quotes for unique symbols (cap at 30 to avoid rate limits)
		const symbols = Array.from(symbolClientMap.keys()).slice(0, 30);
		const alerts: any[] = [];

		await Promise.allSettled(
			symbols.map(async (sym) => {
				const quote = await fetchQuote(sym);
				if (!quote) return;
				const { changePercent, currentPrice } = quote;
				if (Math.abs(changePercent) < minMove) return;
				const entry = symbolClientMap.get(sym)!;
				alerts.push({
					symbol: sym,
					name: entry.name,
					changePercent: Math.round(changePercent * 100) / 100,
					direction: changePercent >= 0 ? "up" : "down",
					currentPrice,
					clients: entry.clients,
				});
			}),
		);

		alerts.sort(
			(a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent),
		);

		const result = {
			generatedAt: new Date().toISOString(),
			alerts,
			cached: false,
		};
		alertCache.set(cacheKey, {
			data: result,
			expiresAt: Date.now() + 15 * 60 * 1000,
		});

		const filtered = filterClientId
			? {
					...result,
					alerts: alerts.filter((a: any) =>
						a.clients.some((c: any) => c.clientId === filterClientId),
					),
				}
			: result;

		res.json(filtered);
	} catch (err) {
		console.error("[Market Alerts] Error:", err);
		res.status(500).json({ error: "Failed to fetch market alerts" });
	}
});

export default router;
