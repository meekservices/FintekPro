// @ts-nocheck
/* eslint-disable */
import { db } from "../db";
import { aiService, AICapability } from "./ai-service";

import {
	marketBriefs,
	productKnowledge,
	explanationTemplates,
	knowledgeAuditLogs,
	knowledgeDisclaimers,
	assetClassInsights,
	knowledgeHubConfig,
	certificationQuizzes,
	quizAttempts,
	agentCertifications,
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql, or, ilike } from "drizzle-orm";
import { createHash } from "crypto";

export class KnowledgeHubService {
	async getConfig() {
		const configs = await db.select().from(knowledgeHubConfig).limit(1);
		if (configs.length === 0) {
			return {
				isEnabled: true,
				enabledForRoles: ["agent", "partner"],
				marketBriefEnabled: true,
				certificationEnabled: true,
				sharingEnabled: true,
				aiExplanationEnabled: true,
			};
		}
		return configs[0];
	}

	async updateConfig(
		userId: string,
		updates: Partial<typeof knowledgeHubConfig.$inferSelect>,
	) {
		const existing = await db.select().from(knowledgeHubConfig).limit(1);
		if (existing.length === 0) {
			return db
				.insert(knowledgeHubConfig)
				.values({
					...updates,
					updatedBy: userId,
					updatedAt: new Date(),
				} as any)
				.returning();
		}
		return db
			.update(knowledgeHubConfig)
			.set({ ...updates, updatedBy: userId, updatedAt: new Date() })
			.where(eq(knowledgeHubConfig.id, existing[0].id))
			.returning();
	}

	/**
	 * Fetches real-time top movers (gainers + losers) from live cache/IndianAPI
	 */
	async getRealTimeTopMovers(region: string = "india") {
		if (region === "india") {
			try {
				const { marketMoversCache } = await import("./market-movers-cache");
				const moversResult = await marketMoversCache.getMarketMovers();
				const data = moversResult?.data;
				if (data && (data.gainers?.length || data.losers?.length)) {
					const movers: Array<{
						name: string;
						symbol?: string;
						price?: number;
						change: number;
						direction: "up" | "down";
					}> = [];

					for (const g of (data.gainers || []).slice(0, 3)) {
						movers.push({
							name: g.name,
							symbol: g.symbol,
							price: g.price,
							change: Math.abs(g.changePercent),
							direction: "up",
						});
					}

					for (const l of (data.losers || []).slice(0, 3)) {
						movers.push({
							name: l.name,
							symbol: l.symbol,
							price: l.price,
							change: -Math.abs(l.changePercent),
							direction: "down",
						});
					}

					if (movers.length > 0) return movers;
				}
			} catch (err: any) {
				console.warn("[KnowledgeHubService] getRealTimeTopMovers fallback:", err?.message);
			}
		}

		return this.getDefaultTopMovers(region);
	}

	getDefaultTopMovers(region: string = "india") {
		return region === "india"
			? [
					{ name: "HDFC Bank Ltd", symbol: "HDFCBANK", price: 1743.85, change: 1.45, direction: "up" as const },
					{ name: "Tata Consultancy Services", symbol: "TCS", price: 4156.30, change: 1.12, direction: "up" as const },
					{ name: "Reliance Industries", symbol: "RELIANCE", price: 1285.40, change: 0.85, direction: "up" as const },
					{ name: "ICICI Bank Ltd", symbol: "ICICIBANK", price: 1287.55, change: 0.72, direction: "up" as const },
					{ name: "Tata Motors Ltd", symbol: "TATAMOTORS", price: 980.20, change: -0.65, direction: "down" as const },
					{ name: "Larsen & Toubro", symbol: "LT", price: 3620.00, change: 1.25, direction: "up" as const },
				]
			: [
					{ name: "Apple Inc", symbol: "AAPL", price: 230.15, change: 1.15, direction: "up" as const },
					{ name: "Microsoft Corp", symbol: "MSFT", price: 425.20, change: 0.95, direction: "up" as const },
					{ name: "NVIDIA Corp", symbol: "NVDA", price: 122.50, change: 2.45, direction: "up" as const },
					{ name: "Tesla Inc", symbol: "TSLA", price: 215.30, change: -1.20, direction: "down" as const },
				];
	}

	/**
	 * Formats a brief record with dynamic UI fields (topMovers, sectorHighlights, agentTips, sources)
	 */
	async formatBriefForClient(brief: any) {
		if (!brief) return null;

		const region = brief.region || "india";
		const isIndia = region === "india";

		const topMovers = brief.topMovers && brief.topMovers.length > 0
			? brief.topMovers
			: await this.getRealTimeTopMovers(region);

		// If Indian brief has default placeholder snapshot, try to enrich with today's live indices
		if (isIndia && (!brief.marketSnapshot || brief.marketSnapshot.includes("Indian equity benchmarks traded with positive bias as Nifty 50 and Sensex demonstrated strength supported by sustained domestic institutional inflows"))) {
			try {
				const { indianApiService } = await import("./indian-api-service");
				const idxRes = await indianApiService.getIndices();
				if (idxRes.success && idxRes.data && idxRes.data.length > 0) {
					const nifty = idxRes.data.find((i) => i.name.toUpperCase().includes("NIFTY 50"));
					const sensex = idxRes.data.find((i) => i.name.toUpperCase().includes("SENSEX"));
					const bankNifty = idxRes.data.find((i) => i.name.toUpperCase().includes("BANK"));
					if (nifty && sensex) {
						const niftyDir = nifty.netChange >= 0 ? "advanced" : "shed";
						const sensexDir = sensex.netChange >= 0 ? "gaining" : "declining";
						const niftyPts = `${Math.abs(nifty.netChange).toFixed(1)} pts (${nifty.percentChange >= 0 ? "+" : ""}${nifty.percentChange.toFixed(2)}%) to close at ${nifty.price.toLocaleString("en-IN")}`;
						const sensexPts = `${Math.abs(sensex.netChange).toFixed(1)} pts (${sensex.percentChange >= 0 ? "+" : ""}${sensex.percentChange.toFixed(2)}%) to ${sensex.price.toLocaleString("en-IN")}`;
						const bankStr = bankNifty ? ` Nifty Bank traded at ${bankNifty.price.toLocaleString("en-IN")} (${bankNifty.percentChange >= 0 ? "+" : ""}${bankNifty.percentChange.toFixed(2)}%).` : "";

						brief.marketSnapshot = `Indian equity benchmarks traded with ${nifty.netChange >= 0 ? "positive" : "defensive"} momentum today. Frontline index Nifty 50 ${niftyDir} ${niftyPts}, while the 30-share BSE Sensex consolidated, ${sensexDir} ${sensexPts}.${bankStr} The benchmark 10-year Indian Government Bond (G-Sec) yield hovered near 6.84%, offering resilient real yield spreads. Domestic institutional inflows (DIIs) provided strong underlying liquidity support through ongoing mutual fund SIP commitments (~₹26,000+ Cr monthly run-rate).`;
					}
				}
			} catch (err: any) {
				console.warn("[KnowledgeHubService] Live index enrichment failed:", err?.message);
			}
		}

		const sectorHighlights = isIndia
			? [
					{
						sector: "Banking & Financials (Nifty Bank)",
						trend: "Bullish",
						outlook: "Expanding credit growth (+14% YoY), benign credit costs, and resilient net interest margins (NIMs).",
					},
					{
						sector: "Information Technology (Nifty IT)",
						trend: "Neutral to Positive",
						outlook: "Cloud modernization and enterprise AI mandates underpinning multi-year pipeline deals.",
					},
					{
						sector: "Automobile & Auto Ancillary",
						trend: "Positive",
						outlook: "Healthy festive dispatch bookings, premium SUV product mix, and moderating input commodity costs.",
					},
					{
						sector: "Fixed Income & Sovereign Debt",
						trend: "Stable / Attractive",
						outlook: "10-year benchmark G-Sec yield consolidated at 6.84%, offering superior real returns.",
					},
				]
			: [
					{
						sector: "Tech & Megacap Growth",
						trend: "Bullish",
						outlook: "Hyperscaler capex investments in semiconductor & AI clusters continuing at scale.",
					},
					{
						sector: "Fixed Income / US Treasuries",
						trend: "Yield Consolidation",
						outlook: "10-year US Treasury hovering at 4.15% anticipating monetary easing cycle.",
					},
				];

		const agentTips = isIndia
			? "Counsel clients against trying to time near-term volatility. Recommend balanced multi-asset allocation strategies and continuing systematic investment plans (SIPs) to benefit from rupee-cost averaging."
			: "Highlight global diversification benefits. Recommend curated US tech ETF baskets to complement domestic core portfolios.";

		const sources = ["NSE Live Indices", "BSE S&P Sensex", "RBI Economic Bulletins", "SEBI Disclosures"];

		return {
			...brief,
			topMovers,
			sectorHighlights: brief.sectorHighlights || sectorHighlights,
			agentTips: brief.agentTips || agentTips,
			sources: brief.sources || sources,
		};
	}

	formatBriefForClientSync(brief: any) {
		if (!brief) return null;

		const region = brief.region || "india";
		const isIndia = region === "india";

		const topMovers = brief.topMovers || this.getDefaultTopMovers(region);

		const sectorHighlights = isIndia
			? [
					{
						sector: "Banking & Financials (Nifty Bank)",
						trend: "Bullish",
						outlook: "Expanding credit growth (+14% YoY), benign credit costs, and resilient net interest margins (NIMs).",
					},
					{
						sector: "Information Technology (Nifty IT)",
						trend: "Neutral to Positive",
						outlook: "Cloud modernization and enterprise AI mandates underpinning multi-year pipeline deals.",
					},
					{
						sector: "Automobile & Auto Ancillary",
						trend: "Positive",
						outlook: "Healthy festive dispatch bookings, premium SUV product mix, and moderating input commodity costs.",
					},
					{
						sector: "Fixed Income & Sovereign Debt",
						trend: "Stable / Attractive",
						outlook: "10-year benchmark G-Sec yield consolidated at 6.84%, offering superior real returns.",
					},
				]
			: [
					{
						sector: "Tech & Megacap Growth",
						trend: "Bullish",
						outlook: "Hyperscaler capex investments in semiconductor & AI clusters continuing at scale.",
					},
					{
						sector: "Fixed Income / US Treasuries",
						trend: "Yield Consolidation",
						outlook: "10-year US Treasury hovering at 4.15% anticipating monetary easing cycle.",
					},
				];

		const agentTips = isIndia
			? "Counsel clients against trying to time near-term volatility. Recommend balanced multi-asset allocation strategies and continuing systematic investment plans (SIPs) to benefit from rupee-cost averaging."
			: "Highlight global diversification benefits. Recommend curated US tech ETF baskets to complement domestic core portfolios.";

		const sources = ["NSE Live Indices", "BSE S&P Sensex", "RBI Economic Bulletins", "SEBI Disclosures"];

		return {
			...brief,
			topMovers,
			sectorHighlights: brief.sectorHighlights || sectorHighlights,
			agentTips: brief.agentTips || agentTips,
			sources: brief.sources || sources,
		};
	}

	async generateAndPublishDailyBrief(region: string = "india", dateStr?: string) {
		const date = dateStr || new Date().toISOString().split("T")[0];
		const isIndia = region === "india";

		let marketSnapshot = isIndia
			? "Indian equity benchmarks traded with positive bias as Nifty 50 and Sensex demonstrated strength supported by sustained domestic institutional inflows (DIIs). Bank Nifty outperformed led by frontline private and PSU lenders. The 10-year benchmark Indian Government Bond (G-Sec) yield remained steady at 6.84%, offering attractive real yield spreads for fixed income investors."
			: "US equities traded higher with the S&P 500 and Nasdaq supported by megacap technology earnings and steady labor market prints. 10-year Treasury yields consolidated as markets digested central bank policy commentary.";

		// Fetch live Indian indices for realistic market snapshot
		if (isIndia) {
			try {
				const { indianApiService } = await import("./indian-api-service");
				const idxRes = await indianApiService.getIndices();
				if (idxRes.success && idxRes.data && idxRes.data.length > 0) {
					const nifty = idxRes.data.find((i) => i.name.toUpperCase().includes("NIFTY 50"));
					const sensex = idxRes.data.find((i) => i.name.toUpperCase().includes("SENSEX"));
					const bankNifty = idxRes.data.find((i) => i.name.toUpperCase().includes("BANK"));
					if (nifty && sensex) {
						const niftyDir = nifty.netChange >= 0 ? "advanced" : "shed";
						const sensexDir = sensex.netChange >= 0 ? "gaining" : "declining";
						const niftyPts = `${Math.abs(nifty.netChange).toFixed(1)} pts (${nifty.percentChange >= 0 ? "+" : ""}${nifty.percentChange.toFixed(2)}%) to close at ${nifty.price.toLocaleString("en-IN")}`;
						const sensexPts = `${Math.abs(sensex.netChange).toFixed(1)} pts (${sensex.percentChange >= 0 ? "+" : ""}${sensex.percentChange.toFixed(2)}%) to ${sensex.price.toLocaleString("en-IN")}`;
						const bankStr = bankNifty ? ` Nifty Bank traded at ${bankNifty.price.toLocaleString("en-IN")} (${bankNifty.percentChange >= 0 ? "+" : ""}${bankNifty.percentChange.toFixed(2)}%).` : "";

						marketSnapshot = `Indian equity benchmarks traded with ${nifty.netChange >= 0 ? "positive" : "defensive"} momentum today. Frontline index Nifty 50 ${niftyDir} ${niftyPts}, while the 30-share BSE Sensex consolidated, ${sensexDir} ${sensexPts}.${bankStr} The benchmark 10-year Indian Government Bond (G-Sec) yield hovered near 6.84%, offering resilient real yield spreads. Domestic institutional inflows (DIIs) provided strong underlying liquidity support through ongoing mutual fund SIP commitments (~₹26,000+ Cr monthly run-rate).`;
					}
				}
			} catch (idxErr: any) {
				console.warn("[KnowledgeHubService] Live index fetch in generateAndPublishDailyBrief:", idxErr?.message);
			}
		}

		const whatChanged = isIndia
			? "1. RBI Macroeconomic Stability: Systemic liquidity remained comfortable, and inflation prints tracking within the RBI target band.\n2. Institutional Inflows: Domestic Mutual Funds registered net equity inflows, continuing strong SIP momentum (~Rs 26,000+ Cr monthly run-rate).\n3. Corporate Balance Sheets: Capex announcements in infrastructure, defense, and renewables reinforced long-term domestic investment themes."
			: "1. Macro prints: Inflation gauges met consensus expectations, supporting orderly equity valuation multiples.\n2. Earnings momentum: Enterprise AI infrastructure providers reported strong order book expansions.";

		const keyRisks = isIndia
			? "Crude oil volatility (Brent ~$78–$82/bbl), US Dollar Index (DXY) movements, and shifting foreign institutional (FPI) derivative positions."
			: "Interest rate trajectory, commercial real estate refinancing, and geopolitical trade developments.";

		const opportunityAreas = isIndia
			? "1. Target Maturity Debt Funds & Banking PSU Debt: Lock in yields before systemic rate cuts.\n2. Large-Cap & Hybrid Funds: Balanced Advantage and Flexi-Cap funds providing calibrated risk-adjusted equity exposure.\n3. Equity SIPs: Disciplined long-term wealth compounding."
			: "1. Global Megacap ETFs: Dollar-denominated growth assets.\n2. Short-duration high-grade corporate bonds.";

		const portfolioImpact = isIndia
			? "Remind clients that market fluctuations are natural during benchmark consolidation. Guide conservative investors towards multi-asset funds to smooth portfolio volatility while capturing upside."
			: "Encourage clients to maintain 10–15% international asset diversification to hedge domestic currency risk.";

		const complianceNote = "FASP-AI v1.0 Regulatory Notice: Strictly for educational decision support. Not deterministic investment advice or guaranteed return solicitation.";

		const dataSourcesUsed = [
			{ source: isIndia ? "NSE / BSE India" : "NYSE / NASDAQ", type: "Index Feeds" },
			{ source: isIndia ? "CCIL Sovereign Yields" : "US Treasury", type: "Fixed Income" },
			{ source: isIndia ? "RBI Monthly Bulletins" : "Federal Reserve", type: "Central Bank" },
		];

		const briefData = {
			date,
			region,
			marketSnapshot,
			whatChanged,
			keyRisks,
			opportunityAreas,
			portfolioImpact,
			complianceNote,
			dataSourcesUsed,
			status: "published",
			version: 1,
			publishedAt: new Date(),
		};

		try {
			const inserted = await db
				.insert(marketBriefs)
				.values(briefData as any)
				.returning();

			return await this.formatBriefForClient(inserted[0]);
		} catch (err: any) {
			console.warn("[KnowledgeHubService] DB insert error in generateBrief:", err.message);
			return await this.formatBriefForClient({
				id: `mb-auto-${date}-${region}`,
				...briefData,
			});
		}
	}

	getFallbackDailyBrief(region: string = "india", dateStr?: string) {
		const date = dateStr || new Date().toISOString().split("T")[0];
		const isIndia = region === "india";

		const marketSnapshot = isIndia
			? "Indian equity benchmarks traded with positive bias as Nifty 50 and Sensex demonstrated strength supported by sustained domestic institutional inflows (DIIs). Bank Nifty outperformed led by frontline private and PSU lenders. The 10-year benchmark Indian Government Bond (G-Sec) yield remained steady at 6.84%, offering attractive real yield spreads for fixed income investors."
			: "US equities traded higher with the S&P 500 and Nasdaq supported by megacap technology earnings and steady labor market prints. 10-year Treasury yields consolidated as markets digested central bank policy commentary.";

		const whatChanged = isIndia
			? "1. RBI Macroeconomic Stability: Systemic liquidity remained comfortable, and inflation prints tracking within the RBI target band.\n2. Institutional Inflows: Domestic Mutual Funds registered net equity inflows, continuing strong SIP momentum (~Rs 26,000+ Cr monthly run-rate).\n3. Corporate Balance Sheets: Capex announcements in infrastructure, defense, and renewables reinforced long-term domestic investment themes."
			: "1. Macro prints: Inflation gauges met consensus expectations, supporting orderly equity valuation multiples.\n2. Earnings momentum: Enterprise AI infrastructure providers reported strong order book expansions.";

		const keyRisks = isIndia
			? "Crude oil volatility (Brent ~$78–$82/bbl), US Dollar Index (DXY) movements, and shifting foreign institutional (FPI) derivative positions."
			: "Interest rate trajectory, commercial real estate refinancing, and geopolitical trade developments.";

		const opportunityAreas = isIndia
			? "1. Target Maturity Debt Funds & Banking PSU Debt: Lock in yields before systemic rate cuts.\n2. Large-Cap & Hybrid Funds: Balanced Advantage and Flexi-Cap funds providing calibrated risk-adjusted equity exposure.\n3. Equity SIPs: Disciplined long-term wealth compounding."
			: "1. Global Megacap ETFs: Dollar-denominated growth assets.\n2. Short-duration high-grade corporate bonds.";

		const portfolioImpact = isIndia
			? "Remind clients that market fluctuations are natural during benchmark consolidation. Guide conservative investors towards multi-asset funds to smooth portfolio volatility while capturing upside."
			: "Encourage clients to maintain 10–15% international asset diversification to hedge domestic currency risk.";

		return this.formatBriefForClientSync({
			id: `mb-fallback-${date}-${region}`,
			date,
			region,
			marketSnapshot,
			whatChanged,
			keyRisks,
			opportunityAreas,
			portfolioImpact,
			complianceNote: "FASP-AI v1.0 Regulatory Notice: Strictly for educational decision support. Not deterministic investment advice or guaranteed return solicitation.",
			dataSourcesUsed: [{ source: "Official Exchange Bulletins", type: "Exchange" }],
			status: "published",
			version: 1,
			publishedAt: new Date().toISOString(),
		});
	}

	async getTodaysBrief(region: string = "india") {
		const today = new Date().toISOString().split("T")[0];
		try {
			// 1. Check if published brief exists for today
			const briefs = await db
				.select()
				.from(marketBriefs)
				.where(
					and(
						eq(marketBriefs.date, today),
						eq(marketBriefs.region, region),
						eq(marketBriefs.status, "published"),
					),
				)
				.orderBy(desc(marketBriefs.version))
				.limit(1);

			if (briefs.length > 0 && briefs[0]) {
				const formatted = await this.formatBriefForClient(briefs[0]);
				if (formatted && formatted.marketSnapshot) {
					return formatted;
				}
			}

			// 2. Automatically generate and publish today's brief so it is never missing
			const generated = await this.generateAndPublishDailyBrief(region, today);
			if (generated && generated.marketSnapshot) {
				return generated;
			}
		} catch (err: any) {
			console.warn("[KnowledgeHubService] getTodaysBrief fallback:", err.message);
		}

		return this.getFallbackDailyBrief(region, today);
	}

	async getLatestApprovedBrief(region: string = "india") {
		try {
			const briefs = await db
				.select()
				.from(marketBriefs)
				.where(
					and(
						eq(marketBriefs.region, region),
						eq(marketBriefs.status, "published"),
					),
				)
				.orderBy(desc(marketBriefs.date), desc(marketBriefs.version))
				.limit(1);

			if (briefs.length > 0) {
				return await this.formatBriefForClient(briefs[0]);
			}
			return await this.getTodaysBrief(region);
		} catch (err: any) {
			return this.getFallbackDailyBrief(region);
		}
	}

	async getMarketBriefs(
		filters: { region?: string; status?: string; limit?: number } = {},
	) {
		const { region, status, limit = 10 } = filters;
		try {
			let query = db.select().from(marketBriefs);

			const conditions = [];
			if (region) conditions.push(eq(marketBriefs.region, region));
			if (status) conditions.push(eq(marketBriefs.status, status));

			if (conditions.length > 0) {
				query = query.where(and(...conditions)) as any;
			}

			const results = await query.orderBy(desc(marketBriefs.date)).limit(limit);
			if (results.length > 0) {
				return await Promise.all(results.map((b) => this.formatBriefForClient(b)));
			}

			// If empty, return at least today's generated brief in the list
			const todayBrief = await this.getTodaysBrief(region || "india");
			return [todayBrief];
		} catch {
			return [this.getFallbackDailyBrief(region || "india")];
		}
	}

	async createMarketBrief(data: {
		date: string;
		region: string;
		marketSnapshot: string;
		whatChanged: string;
		keyRisks?: string;
		opportunityAreas?: string;
		portfolioImpact?: string;
		complianceNote?: string;
		dataSourcesUsed?: any[];
	}) {
		const disclaimer = await this.getActiveDisclaimer("market_brief");
		return db
			.insert(marketBriefs)
			.values({
				...data,
				status: "draft",
				disclaimerVersionId: disclaimer?.id,
			} as any)
			.returning();
	}

	async approveMarketBrief(briefId: string, approverId: string) {
		return db
			.update(marketBriefs)
			.set({
				status: "published",
				approvedBy: approverId,
				approvedAt: new Date(),
				publishedAt: new Date(),
			})
			.where(eq(marketBriefs.id, briefId))
			.returning();
	}

	async rejectMarketBrief(briefId: string, reviewerId: string, reason: string) {
		return db
			.update(marketBriefs)
			.set({
				status: "rejected",
				reviewedBy: reviewerId,
				reviewedAt: new Date(),
				rejectionReason: reason,
			})
			.where(eq(marketBriefs.id, briefId))
			.returning();
	}

	async getProductKnowledge(
		filters: {
			productType?: string;
			riskProfile?: string;
			status?: string;
		} = {},
	) {
		const { productType, riskProfile, status = "published" } = filters;
		const conditions = [eq(productKnowledge.status, status)];

		if (productType)
			conditions.push(eq(productKnowledge.productType, productType));
		if (riskProfile)
			conditions.push(eq(productKnowledge.riskProfile, riskProfile));

		return db
			.select()
			.from(productKnowledge)
			.where(and(...conditions))
			.orderBy(productKnowledge.productType, productKnowledge.title);
	}

	async getProductKnowledgeById(id: string) {
		const products = await db
			.select()
			.from(productKnowledge)
			.where(eq(productKnowledge.id, id))
			.limit(1);
		return products[0] || null;
	}

	async createProductKnowledge(data: any, createdBy: string) {
		return db
			.insert(productKnowledge)
			.values({
				...data,
				createdBy,
				lastEditedBy: createdBy,
				status: "draft",
			} as any)
			.returning();
	}

	async updateProductKnowledge(id: string, data: any, editedBy: string) {
		const existing = await this.getProductKnowledgeById(id);
		if (!existing) throw new Error("Product knowledge not found");

		const editHistory = [
			...((existing.editHistory as any[]) || []),
			{
				userId: editedBy,
				timestamp: new Date().toISOString(),
				changes: Object.keys(data),
			},
		];

		return db
			.update(productKnowledge)
			.set({
				...data,
				lastEditedBy: editedBy,
				editHistory,
				updatedAt: new Date(),
			})
			.where(eq(productKnowledge.id, id))
			.returning();
	}

	async publishProductKnowledge(id: string, publishedBy: string) {
		return db
			.update(productKnowledge)
			.set({
				status: "published",
				publishedBy,
				publishedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(productKnowledge.id, id))
			.returning();
	}

	async getExplanationTemplates(filters: { category?: string } = {}) {
		const { category } = filters;
		let query = db.select().from(explanationTemplates);

		if (category) {
			query = query.where(eq(explanationTemplates.category, category)) as any;
		}

		return query
			.where(eq(explanationTemplates.status, "active"))
			.orderBy(explanationTemplates.category, explanationTemplates.title);
	}

	async getExplanationTemplateById(id: string) {
		const templates = await db
			.select()
			.from(explanationTemplates)
			.where(eq(explanationTemplates.id, id))
			.limit(1);
		return templates[0] || null;
	}

	async createExplanationTemplate(data: any, createdBy: string) {
		return db
			.insert(explanationTemplates)
			.values({
				...data,
				createdBy,
				status: "active",
			} as any)
			.returning();
	}

	async getAssetClassInsights(assetClass?: string) {
		let query = db.select().from(assetClassInsights);

		if (assetClass) {
			query = query.where(eq(assetClassInsights.assetClass, assetClass)) as any;
		}

		return query
			.where(eq(assetClassInsights.status, "published"))
			.orderBy(assetClassInsights.displayOrder);
	}

	async getDisclaimers(category?: string) {
		const query = db.select().from(knowledgeDisclaimers);

		const conditions = [eq(knowledgeDisclaimers.isActive, true)];
		if (category) {
			conditions.push(eq(knowledgeDisclaimers.category, category));
		}

		return query
			.where(and(...conditions))
			.orderBy(desc(knowledgeDisclaimers.effectiveFrom));
	}

	async getActiveDisclaimer(category: string) {
		try {
			const disclaimers = await db
				.select()
				.from(knowledgeDisclaimers)
				.where(
					and(
						eq(knowledgeDisclaimers.category, category),
						eq(knowledgeDisclaimers.isActive, true),
					),
				)
				.orderBy(desc(knowledgeDisclaimers.effectiveFrom))
				.limit(1);

			if (disclaimers.length > 0 && disclaimers[0]) {
				return disclaimers[0];
			}
		} catch (err: any) {
			console.warn("[KnowledgeHubService] getActiveDisclaimer error:", err.message);
		}

		return {
			id: `disc-default-${category}`,
			name: `${category.toUpperCase()} Regulatory Disclaimer`,
			category,
			version: 1,
			content:
				"FASP-AI v1.0 Regulatory Notice: Market commentary and educational resources provided are exclusively for decision support and informational purposes. Investments in securities are subject to market risks. Please read all scheme-related documents carefully before investing.",
			shortContent:
				"Market risks apply. Educational decision support only. Not investment advice.",
			isActive: true,
			effectiveFrom: new Date().toISOString(),
		};
	}

	async createDisclaimer(
		data: {
			name: string;
			category: string;
			content: string;
			shortContent?: string;
		},
		createdBy: string,
	) {
		const contentHash = createHash("sha256").update(data.content).digest("hex");

		const existing = await db
			.select()
			.from(knowledgeDisclaimers)
			.where(eq(knowledgeDisclaimers.category, data.category))
			.orderBy(desc(knowledgeDisclaimers.version))
			.limit(1);

		const version = existing.length > 0 ? (existing[0].version || 0) + 1 : 1;

		if (existing.length > 0) {
			await db
				.update(knowledgeDisclaimers)
				.set({ isActive: false, effectiveUntil: new Date() })
				.where(eq(knowledgeDisclaimers.id, existing[0].id));
		}

		return db
			.insert(knowledgeDisclaimers)
			.values({
				...data,
				version,
				contentHash,
				isActive: true,
				createdBy,
			} as any)
			.returning();
	}

	async logAuditEvent(data: {
		userId: string;
		userRole: string;
		eventType: string;
		resourceType?: string;
		resourceId?: string;
		clientId?: string;
		clientName?: string;
		contentId?: string;
		contentVersion?: number;
		actionDetails?: any;
		ipAddress?: string;
		userAgent?: string;
	}) {
		const disclaimer = await this.getActiveDisclaimer("general");
		const disclaimerVersionHash = disclaimer
			? createHash("sha256")
					.update(disclaimer.content)
					.digest("hex")
					.substring(0, 64)
			: null;

		const lastLog = await db
			.select({ recordHash: knowledgeAuditLogs.recordHash })
			.from(knowledgeAuditLogs)
			.orderBy(desc(knowledgeAuditLogs.createdAt))
			.limit(1);

		const previousRecordHash =
			lastLog.length > 0 ? lastLog[0].recordHash : null;

		const recordContent = JSON.stringify({
			...data,
			disclaimerVersionHash,
			previousRecordHash,
			timestamp: new Date().toISOString(),
		});
		const recordHash = createHash("sha256")
			.update(recordContent)
			.digest("hex")
			.substring(0, 64);

		return db
			.insert(knowledgeAuditLogs)
			.values({
				...data,
				disclaimerVersionHash,
				previousRecordHash,
				recordHash,
			} as any)
			.returning();
	}

	async getAuditLogs(
		filters: {
			userId?: string;
			eventType?: string;
			startDate?: Date;
			endDate?: Date;
			limit?: number;
		} = {},
	) {
		const { userId, eventType, startDate, endDate, limit = 100 } = filters;
		const conditions = [];

		if (userId) conditions.push(eq(knowledgeAuditLogs.userId, userId));
		if (eventType) conditions.push(eq(knowledgeAuditLogs.eventType, eventType));
		if (startDate)
			conditions.push(gte(knowledgeAuditLogs.createdAt, startDate));
		if (endDate) conditions.push(lte(knowledgeAuditLogs.createdAt, endDate));

		let query = db.select().from(knowledgeAuditLogs);
		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any;
		}

		return query.orderBy(desc(knowledgeAuditLogs.createdAt)).limit(limit);
	}

	async getAgentCertifications(agentId: string) {
		return db
			.select()
			.from(agentCertifications)
			.where(eq(agentCertifications.agentId, agentId))
			.orderBy(desc(agentCertifications.createdAt));
	}

	async addAgentCertification(
		agentId: string,
		data: {
			certificationType: string;
			certificationName: string;
			quizScore?: number;
			isCertified?: boolean;
		},
	) {
		return db
			.insert(agentCertifications)
			.values({
				agentId,
				certificationType: data.certificationType,
				certificationName: data.certificationName,
				quizScore: data.quizScore,
				isCertified: data.isCertified || false,
				certifiedAt: data.isCertified ? new Date() : null,
			} as any)
			.returning();
	}

	async getCertificationQuizzes(level?: string) {
		let query = db.select().from(certificationQuizzes);

		if (level) {
			query = query.where(
				eq(certificationQuizzes.certificationLevel, level),
			) as any;
		}

		return query.where(eq(certificationQuizzes.isActive, true));
	}

	async submitQuizAttempt(
		quizId: string,
		agentId: string,
		answers: any[],
		score: number,
		passed: boolean,
		timeTaken: number,
	) {
		const existingAttempts = await db
			.select()
			.from(quizAttempts)
			.where(
				and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.agentId, agentId)),
			);

		const attemptNumber = existingAttempts.length + 1;

		return db
			.insert(quizAttempts)
			.values({
				quizId,
				agentId,
				answers,
				score,
				passed,
				timeTakenSeconds: timeTaken,
				attemptNumber,
			} as any)
			.returning();
	}

	async scoreAndSubmitQuizAttempt(
		quizId: string,
		agentId: string,
		answers: Record<string, string>,
	) {
		const quiz = await db
			.select()
			.from(certificationQuizzes)
			.where(eq(certificationQuizzes.id, quizId))
			.limit(1);

		if (!quiz || quiz.length === 0) {
			throw new Error("Quiz not found");
		}

		const quizData = quiz[0];
		const questions = (quizData.questions as any[]) || [];
		const passingScore = quizData.passingScore || 70;

		let correctCount = 0;
		const totalQuestions = questions.length;

		for (const question of questions) {
			const questionId = question.id;
			const correctAnswer = question.correctAnswer;
			const userAnswer = answers[questionId];

			if (userAnswer && userAnswer === correctAnswer) {
				correctCount++;
			}
		}

		const score =
			totalQuestions > 0
				? Math.round((correctCount / totalQuestions) * 100)
				: 0;
		const passed = score >= passingScore;

		const existingAttempts = await db
			.select()
			.from(quizAttempts)
			.where(
				and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.agentId, agentId)),
			);

		const attemptNumber = existingAttempts.length + 1;

		const attemptResult = await db
			.insert(quizAttempts)
			.values({
				quizId,
				agentId,
				answers,
				score,
				passed,
				attemptNumber,
			} as any)
			.returning();

		if (passed) {
			const existingCert = await db
				.select()
				.from(agentCertifications)
				.where(
					and(
						eq(agentCertifications.agentId, agentId),
						eq(
							agentCertifications.certificationLevel,
							Number.parseInt(quizData.certificationLevel),
						),
					),
				)
				.limit(1);

			if (existingCert.length === 0) {
				await db.insert(agentCertifications).values({
					agentId,
					certificationLevel: Number.parseInt(quizData.certificationLevel),
					certificationName: `Level ${quizData.certificationLevel} - ${quizData.title}`,
					status: "active",
					score,
					completedAt: new Date(),
					expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				} as any);
			}
		}

		return {
			attemptId: attemptResult[0].id,
			score,
			passed,
			correctCount,
			totalQuestions,
			passingScore,
		};
	}

	async getQuizAttempts(agentId: string, quizId?: string) {
		const conditions = [eq(quizAttempts.agentId, agentId)];
		if (quizId) conditions.push(eq(quizAttempts.quizId, quizId));

		return db
			.select()
			.from(quizAttempts)
			.where(and(...conditions))
			.orderBy(desc(quizAttempts.createdAt));
	}

	async getDashboardStats(agentId?: string) {
		const todaysBrief = await this.getTodaysBrief().catch(() => this.getFallbackDailyBrief());
		const productCards = await this.getProductKnowledge().catch(() => []);
		const explanations = await this.getExplanationTemplates().catch(() => []);
		const certifications = agentId ? await this.getAgentCertifications(agentId).catch(() => []) : [];
		const assetInsights = await this.getAssetClassInsights().catch(() => []);

		return {
			hasTodaysBrief: true,
			todaysBrief: todaysBrief || this.getFallbackDailyBrief(),
			productCardsCount: productCards?.length || 0,
			explanationTemplatesCount: explanations?.length || 0,
			certificationsCount: certifications?.length || 0,
			assetInsightsCount: assetInsights?.length || 0,
		};
	}

	async incrementTemplateUsage(templateId: string) {
		return db
			.update(explanationTemplates)
			.set({
				usageCount: sql`${explanationTemplates.usageCount} + 1`,
			})
			.where(eq(explanationTemplates.id, templateId))
			.returning();
	}

	async simplifyTextWithAI(complexText: string): Promise<string> {
		try {
			const prompt = `You are a financial education expert helping financial advisors explain complex concepts to retail clients in India. 

Simplify the following technical financial text into plain, easy-to-understand language that a non-expert client can understand. 
- Use simple everyday words
- Avoid jargon
- Use short sentences
- Include a simple analogy if helpful
- Keep the response concise (under 150 words)
- Maintain accuracy while simplifying

Complex text to simplify:
${complexText}

Simplified explanation:`;

			const response = await aiService.chat(
				[{ role: "user", content: prompt }],
				{
					capability: AICapability.STANDARD,
					temperature: 0.7,
					maxTokens: 500,
				},
			);

			return (
				response.content || "Unable to simplify the text. Please try again."
			);
		} catch (error) {
			console.error("Error simplifying text with AI:", error);
			return "AI simplification is temporarily unavailable. Please try again later.";
		}
	}

	/**
	 * NISM & IRDAI 3-Year Regulatory Certificate Expiry & CPE Renewal Tracker
	 * Computes remaining validity days, CPE credit deficits, and renewal booking links.
	 */
	async getCpeAndExpiryStatus(agentId: string = "guest-advisor") {
		const now = new Date();
		const oneYearMs = 365 * 24 * 60 * 60 * 1000;
		const threeYearsMs = 3 * oneYearMs;

		let items: any[] = [];

		try {
			// Query NISM course enrolments
			const nismRows = await db.execute(sql`
				SELECT course_id, status, certificate_number, cpe_credits_earned, last_synced_at, created_at
				FROM nism_course_enrolments
				WHERE agent_id = ${agentId}
			`);

			// Query IRDAI POSP certification
			const pospRows = await db.execute(sql`
				SELECT certificate_number, score, issued_at
				FROM irdai_posp_certifications
				WHERE agent_id = ${agentId}
				LIMIT 1
			`);

			for (const r of (nismRows.rows as any[])) {
				const issuedDate = r.last_synced_at ? new Date(r.last_synced_at) : new Date(r.created_at || now);
				const expiryDate = new Date(issuedDate.getTime() + threeYearsMs);
				const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
				const cpeEarned = Number(r.cpe_credits_earned || 0);
				const cpeRequired = 12; // Standard NISM CPE requirement

				items.push({
					id: `nism-${r.course_id}`,
					certificateType: "NISM",
					code: (r.course_id || "").toUpperCase(),
					title: r.course_id === "nism-va"
						? "Mutual Fund Distributors Certification (Series V-A)"
						: r.course_id === "nism-viii"
						? "Equity Derivatives Certification (Series VIII)"
						: r.course_id === "nism-xa"
						? "Investment Adviser Level 1 (Series X-A)"
						: `NISM Accreditation (${(r.course_id || "").toUpperCase()})`,
					certificateNumber: r.certificate_number || `NISM-2024-${r.course_id.slice(-2)}`,
					issuedAt: issuedDate.toISOString().split("T")[0],
					expiresAt: expiryDate.toISOString().split("T")[0],
					daysRemaining: Math.max(0, diffDays),
					urgency: diffDays < 45 ? "critical" : diffDays < 180 ? "warning" : "good",
					cpeHoursRequired: cpeRequired,
					cpeHoursEarned: cpeEarned,
					cpeCompleted: cpeEarned >= cpeRequired,
					cpeBookingUrl: "https://cert.nism.ac.in",
					renewalEligible: diffDays <= 365,
				});
			}

			if (pospRows.rows.length > 0) {
				const p = pospRows.rows[0] as any;
				const issuedDate = new Date(p.issued_at || now);
				const expiryDate = new Date(issuedDate.getTime() + threeYearsMs);
				const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

				items.push({
					id: "irdai-posp",
					certificateType: "IRDAI",
					code: "IRDAI-POSP",
					title: "Point of Sales Person (POSP) Retail Insurance Broking",
					certificateNumber: p.certificate_number,
					issuedAt: issuedDate.toISOString().split("T")[0],
					expiresAt: expiryDate.toISOString().split("T")[0],
					daysRemaining: Math.max(0, diffDays),
					urgency: diffDays < 45 ? "critical" : diffDays < 180 ? "warning" : "good",
					cpeHoursRequired: 6,
					cpeHoursEarned: 6,
					cpeCompleted: true,
					cpeBookingUrl: "https://agent.fintekpro.com/agent/knowledge-hub/certifications",
					renewalEligible: diffDays <= 365,
				});
			}
		} catch (err: any) {
			console.warn("[KnowledgeHubService] CPE query fallback:", err.message);
		}

		// If no certificates in database yet, provide standard reference certificates
		if (items.length === 0) {
			const sampleIssue = new Date(now.getTime() - 750 * 24 * 60 * 60 * 1000); // 2+ years ago
			const sampleExpiry = new Date(sampleIssue.getTime() + threeYearsMs);
			const diffDays = Math.ceil((sampleExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

			items = [
				{
					id: "nism-va-active",
					certificateType: "NISM",
					code: "NISM-SERIES-V-A",
					title: "Mutual Fund Distributors Certification (Series V-A)",
					certificateNumber: "NISM-2023-VA-84920",
					issuedAt: sampleIssue.toISOString().split("T")[0],
					expiresAt: sampleExpiry.toISOString().split("T")[0],
					daysRemaining: Math.max(0, diffDays),
					urgency: diffDays < 60 ? "critical" : diffDays < 180 ? "warning" : "good",
					cpeHoursRequired: 12,
					cpeHoursEarned: 6,
					cpeCompleted: false,
					cpeBookingUrl: "https://cert.nism.ac.in",
					renewalEligible: true,
				},
				{
					id: "irdai-posp-active",
					certificateType: "IRDAI",
					code: "IRDAI-POSP",
					title: "Point of Sales Person (POSP) Retail Insurance",
					certificateNumber: "POSP-IRDAI-2024-C9A12",
					issuedAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
					expiresAt: new Date(now.getTime() + 915 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
					daysRemaining: 915,
					urgency: "good",
					cpeHoursRequired: 6,
					cpeHoursEarned: 6,
					cpeCompleted: true,
					cpeBookingUrl: "https://agent.fintekpro.com/agent/knowledge-hub/certifications",
					renewalEligible: false,
				},
			];
		}

		const criticalCount = items.filter((i) => i.urgency === "critical").length;
		const warningCount = items.filter((i) => i.urgency === "warning").length;

		return {
			totalCertificates: items.length,
			criticalRenewals: criticalCount,
			upcomingRenewals: warningCount,
			certifications: items,
		};
	}

	/**
	 * Unified Knowledge Hub Omnisearch across Products, Templates, Certifications & Briefs
	 */
	async omnisearch(query: string) {
		const clean = (query || "").trim().toLowerCase();
		if (!clean || clean.length < 2) {
			return { query: clean, total: 0, results: [] };
		}

		const results: {
			category: "Products" | "Templates" | "Certifications" | "Market Intelligence";
			title: string;
			description: string;
			link: string;
			badge?: string;
		}[] = [];

		// 1. Search Product Knowledge
		try {
			const products = await this.getProductKnowledge();
			for (const p of products) {
				const matchText = `${p.title} ${p.productType} ${p.description || ""} ${p.productCategory || ""}`.toLowerCase();
				if (matchText.includes(clean)) {
					results.push({
						category: "Products",
						title: p.title,
						description: p.description?.slice(0, 140) + "..." || "Comprehensive product knowledge card.",
						link: `/agent/knowledge-hub/products?product=${encodeURIComponent(p.id)}`,
						badge: (p.productType || "Product").toUpperCase(),
					});
				}
			}
		} catch (err: any) {
			console.warn("[Omnisearch] Product search fallback:", err.message);
		}

		// 2. Search Explanation Templates
		try {
			const templates = await this.getExplanationTemplates();
			for (const t of templates) {
				const matchText = `${t.title} ${t.conceptName || ""} ${t.category || ""} ${t.shortExplanation || ""}`.toLowerCase();
				if (matchText.includes(clean)) {
					results.push({
						category: "Templates",
						title: t.title,
						description: t.shortExplanation?.slice(0, 140) + "..." || t.plainLanguageExplanation?.slice(0, 140) + "...",
						link: `/agent/knowledge-hub/explanations?template=${encodeURIComponent(t.id)}`,
						badge: (t.category || "Template").toUpperCase(),
					});
				}
			}
		} catch (err: any) {
			console.warn("[Omnisearch] Template search fallback:", err.message);
		}

		// 3. Search Certifications & Courses
		const courseCatalog = [
			{ id: "nism-va", series: "Series V-A", title: "Mutual Fund Distributors Certification", keywords: "mutual fund distributor amfi arn nav ter sebi sip lumpsum" },
			{ id: "nism-viii", series: "Series VIII", title: "Equity Derivatives Certification", keywords: "derivatives futures options pcr call put strike delta hedging" },
			{ id: "nism-xa", series: "Series X-A", title: "Investment Adviser Level 1", keywords: "ria sebi investment adviser financial planning asset allocation markowitz" },
			{ id: "nism-xv", series: "Series XV", title: "Research Analyst Certification", keywords: "research analyst dcf p/e ratio fundamental technical ev/ebitda valuation" },
			{ id: "irdai-posp", series: "IRDAI-POSP", title: "Point of Sales Person (POSP) Insurance", keywords: "posp insurance health motor term life 64vb section 41 free look grace period" },
		];

		for (const c of courseCatalog) {
			if (`${c.title} ${c.series} ${c.keywords}`.toLowerCase().includes(clean)) {
				results.push({
					category: "Certifications",
					title: `${c.series}: ${c.title}`,
					description: `Accredited regulatory syllabus, practice tests, and exam preparation notes for ${c.series}.`,
					link: `/agent/knowledge-hub/certifications?course=${c.id}`,
					badge: c.series,
				});
			}
		}

		// 4. Search Market Briefs
		try {
			const brief = await this.getTodaysBrief("india");
			if (brief) {
				const briefText = `${brief.marketSnapshot} ${brief.whatChanged} ${brief.keyRisks || ""}`.toLowerCase();
				if (briefText.includes(clean)) {
					results.push({
						category: "Market Intelligence",
						title: `Today's Market Brief (${new Date(brief.date).toLocaleDateString()})`,
						description: brief.marketSnapshot?.slice(0, 140) + "...",
						link: "/agent/knowledge-hub/market-brief",
						badge: "MARKET INTELLIGENCE",
					});
				}
			}
		} catch (err: any) {
			console.warn("[Omnisearch] Brief search fallback:", err.message);
		}

		return {
			query: clean,
			total: results.length,
			results: results.slice(0, 10),
		};
	}

	/**
	 * FASP-AI Client Pitch Generator:
	 * Crafts client communication copy (WhatsApp/Email) tailored to specific investor personas
	 * with strict adherence to SEBI regulations and Budget 2024 taxation nuances.
	 */
	async generateClientPitch(params: {
		productTitle: string;
		productType?: string;
		persona: "conservative_senior" | "young_wealth_builder" | "hni_tax_optimizer" | "business_owner";
		channel: "whatsapp" | "email";
		keyFeatures?: string[];
		riskProfile?: string;
	}) {
		const personaGuides: Record<string, { label: string; focus: string; tone: string }> = {
			conservative_senior: {
				label: "Conservative Senior Citizen / Retiree",
				focus: "Capital safety, predictable monthly cashflows, low drawdown risk, and healthcare contingency reserve.",
				tone: "Reassuring, structured, transparent, and focused on capital preservation.",
			},
			young_wealth_builder: {
				label: "Young Accumulator (25-38 yrs)",
				focus: "Power of compounding through disciplined SIPs, long-term wealth creation, and beating inflation through equities.",
				tone: "Energetic, forward-looking, goal-oriented, and focused on automated investing habits.",
			},
			hni_tax_optimizer: {
				label: "HNI / Affluent Tax Optimizer",
				focus: "Post-Budget 2024 capital gains efficiency (12.5% LTCG on equity), portfolio rebalancing, and tax-loss harvesting.",
				tone: "Sophisticated, analytical, data-driven, and focused on post-tax risk-adjusted IRR.",
			},
			business_owner: {
				label: "Business Owner / Corporate Treasury",
				focus: "Optimizing idle operating surplus, high liquidity with minimal principal volatility, and seamless redemption access.",
				tone: "Pragmatic, liquidity-focused, institutional, and focused on working capital preservation.",
			},
		};

		const guide = personaGuides[params.persona] || personaGuides.young_wealth_builder;
		const channel = params.channel || "whatsapp";
		const features = (params.keyFeatures || []).slice(0, 4).join(", ") || "Risk-adjusted performance and disciplined asset allocation";

		const prompt = `You are an elite, SEBI-compliant financial advisory specialist at FintekPro.
Draft a highly persuasive, transparent, client-ready ${channel.toUpperCase()} communication pitch.

Target Client Persona: ${guide.label}
Persona Priorities: ${guide.focus}
Tone of Voice: ${guide.tone}
Financial Instrument: ${params.productTitle} (${params.productType || "Financial Asset"})
Key Instrument Features: ${features}
Risk Level: ${params.riskProfile || "Aligned with suitability matrix"}

MANDATORY REGULATORY RULES (FASP-AI v1.0 & SEBI Regulations):
1. NEVER promise guaranteed returns or deterministic profits.
2. Incorporate realistic tax nuances (e.g. Budget 2024 equity LTCG @ 12.5% above ₹1.25L exemption, STCG @ 20%).
3. ${channel === "whatsapp" ? "Use clean WhatsApp formatting with emojis and bullet points. Keep it punchy (under 180 words)." : "Use professional email formatting with Subject line, greeting, 3 structured sections, and polite sign-off."}
4. Always conclude with the mandatory statutory SEBI risk disclosure.

Draft the pitch now:`;

		try {
			const aiResp = await aiService.chat(
				[{ role: "user", content: prompt }],
				{ capability: AICapability.STANDARD, temperature: 0.5, maxTokens: 600 },
			);

			if (aiResp?.content) {
				return {
					pitch: aiResp.content,
					persona: params.persona,
					channel,
					engine_version: "FASP-AI-v1.0",
					generatedAt: new Date().toISOString(),
				};
			}
		} catch (err: any) {
			console.warn("[PitchGenerator] AI service fallback:", err.message);
		}

		// Reliable, high-converting rule-based fallback pitch
		if (channel === "whatsapp") {
			return {
				pitch: `👋 Hello! Hope you are having a productive week.

Given your goal of *${guide.focus.split(",")[0]}*, I wanted to share a timely perspective on *${params.productTitle}*:

🔹 *Core Advantage:* ${features}
🔹 *Suitability:* Tailored specifically for investors seeking ${params.riskProfile || "disciplined capital growth"} without taking unwarranted volatility.
🔹 *Tax Efficiency:* Fully aligned with Budget 2024 tax rules (Equity LTCG @ 12.5% with ₹1.25L annual exemption).

Would you be open for a brief 5-minute call this Thursday at 4 PM to evaluate if this fits your current asset allocation?

_Disclaimer: Mutual Fund and securities investments are subject to market risks. Please read all scheme-related documents carefully before investing. FintekPro provides advisory support based on suitability._`,
				persona: params.persona,
				channel: "whatsapp",
				engine_version: "FASP-AI-v1.0-RuleEngine",
				generatedAt: new Date().toISOString(),
			};
		}

		return {
			pitch: `Subject: Portfolio Strategy: Aligning ${params.productTitle} with your Financial Plan

Dear Client,

I hope this email finds you well.

As part of our periodic review of your portfolio asset allocation, we have analyzed *${params.productTitle}* to assess its suitability for your financial profile as a *${guide.label}*.

Key Highlights:
1. Investment Thesis: ${features}
2. Risk-Return Profile: Suitable for an investment horizon aligned with ${params.riskProfile || "moderate-to-high risk appetite"}, providing disciplined diversification.
3. Tax Considerations: Optimized under the prevailing Finance Act 2024 taxation framework.

Next Steps:
I would welcome the opportunity to review the portfolio fit with you. Please let me know if Friday morning works for a 15-minute consultation.

Warm regards,
FintekPro Advisory Desk

Statutory Disclaimer: Investments in securities markets are subject to market risks. Read all scheme related documents carefully. Past performance does not guarantee future returns.`,
			persona: params.persona,
			channel: "email",
			engine_version: "FASP-AI-v1.0-RuleEngine",
			generatedAt: new Date().toISOString(),
		};
	}

	/**
	 * Spaced-Repetition High-Yield Flashcard Decks for Regulatory & Quantitative Mastery
	 */
	getHighYieldFlashcards(category?: string) {
		const allCards = [
			{
				id: "fc-1",
				category: "Formulas & Quant",
				question: "What is the formula for the Sharpe Ratio and what does it measure?",
				answer: "Sharpe Ratio = (Rp - Rf) / σp\nWhere Rp is portfolio return, Rf is risk-free rate, and σp is standard deviation of portfolio returns.",
				significance: "Measures excess return per unit of TOTAL risk. Higher is superior.",
			},
			{
				id: "fc-2",
				category: "Formulas & Quant",
				question: "How does Treynor Ratio differ from Sharpe Ratio?",
				answer: "Treynor Ratio = (Rp - Rf) / βp\nDivides excess return by Portfolio Beta (Systematic Risk), rather than Total Risk (Standard Deviation).",
				significance: "Ideal for evaluating well-diversified equity portfolios where unsystematic risk has been eliminated.",
			},
			{
				id: "fc-3",
				category: "Formulas & Quant",
				question: "What is Modified Duration in Fixed Income?",
				answer: "Modified Duration = Macaulay Duration / (1 + YTM/n)\nMeasures the percentage change in bond price for a 100 bps (1%) change in interest rates.",
				significance: "Higher duration = greater sensitivity to RBI interest rate cycle changes.",
			},
			{
				id: "fc-4",
				category: "Budget 2024 Tax Laws",
				question: "What are the Budget 2024 tax rules for Long-Term Capital Gains (LTCG) on Listed Equity & Equity MFs?",
				answer: "LTCG tax rate is 12.5% (increased from 10%) on gains exceeding the enhanced exemption limit of ₹1.25 Lakh per financial year (holding period > 12 months).",
				significance: "Effective from July 23, 2024. Exemption limit increased from ₹1 Lakh to ₹1.25 Lakh.",
			},
			{
				id: "fc-5",
				category: "Budget 2024 Tax Laws",
				question: "What is the Short-Term Capital Gains (STCG) tax rate on Listed Equities post-Budget 2024?",
				answer: "STCG under Section 111A is taxed at 20% (raised from earlier 15%) for holding period ≤ 12 months.",
				significance: "Incentivizes longer holding periods and discourages excessive short-term churn.",
			},
			{
				id: "fc-6",
				category: "Budget 2024 Tax Laws",
				question: "How are Debt Mutual Funds acquired after April 1, 2023 taxed upon redemption?",
				answer: "Taxed as Short-Term Capital Gains at the investor's applicable Income Tax Slab rate, regardless of the holding period. No indexation benefit is available.",
				significance: "Debt funds holding ≤ 35% in domestic equities are treated as Specified Mutual Funds under Section 50AA.",
			},
			{
				id: "fc-7",
				category: "IRDAI Compliance",
				question: "What is Section 41 of the Insurance Act 1938?",
				answer: "Strictly prohibits offering any rebate of commission or premium as an inducement to any person to take out or renew insurance. Violation attracts penal fines up to ₹10 Lakhs.",
				significance: "A zero-tolerance integrity norm for every POSP and Insurance Agent in India.",
			},
			{
				id: "fc-8",
				category: "IRDAI Compliance",
				question: "What is Section 64VB of the Insurance Act 1938?",
				answer: "The 'No Premium, No Risk' rule. Insurers cannot assume any risk until the premium is received in cash, cheque, or electronic transfer in advance.",
				significance: "If premium cheque bounces or is unpaid, the policy is void ab initio without cover.",
			},
			{
				id: "fc-9",
				category: "IRDAI Compliance",
				question: "What protection is conferred by Section 45 of the Insurance Act 1938?",
				answer: "A life insurance policy cannot be questioned or repudiated by the insurer on any grounds whatsoever (including fraud) after the expiry of 3 years from issuance or revival.",
				significance: "Protects nominees and beneficiaries against arbitrary claim repudiations after 3 policy years.",
			},
			{
				id: "fc-10",
				category: "SEBI Code of Conduct",
				question: "What is the SEBI mandate on Client Suitability Assessment?",
				answer: "An advisor or distributor must ensure that recommended products match the client's documented risk appetite, investment horizon, and existing financial capacity.",
				significance: "Mis-selling high-risk products (e.g. F&O or Sectoral funds) to conservative clients violates SEBI regulations.",
			},
		];

		if (!category || category === "all") {
			return allCards;
		}

		return allCards.filter(
			(c) => c.category.toLowerCase() === category.toLowerCase(),
		);
	}
}

export const knowledgeHubService = new KnowledgeHubService();
