// @ts-nocheck
import { Router, Request, Response } from "express";
import { db } from "../db";
import {
	investmentProposals,
	investmentProposalItems,
	unifiedCartItems,
	users,
	mutualFunds,
	bondCatalog,
	listedStocks,
	aifMaster,
} from "@shared/schema";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { complianceMonitor } from "../compliance-monitor";

const router = Router();

// ── Product Name Resolver ─────────────────────────────────────────────────────
/**
 * Batch-resolves productName from the canonical instrument tables for any
 * proposal items where productName is NULL (e.g. AI-generated proposals that
 * only store productId/isin). Uses one query per asset type — no N+1 queries.
 *
 * @param items - Raw proposal items from DB
 * @returns Same items array with productName populated where missing
 */
async function resolveProductNames(
	items: Array<{
		productId?: string | null;
		productType?: string | null;
		productName?: string | null;
		isin?: string | null;
	}>,
): Promise<Map<string | undefined, string>> {
	/** key = productId or isin, value = resolved name */
	const nameMap = new Map<string | undefined, string>();

	// Group items by type that need resolution
	const mfIds = items
		.filter((i) => (i.productType === "mutual_fund" || i.productType === "mf") && !i.productName && i.productId)
		.map((i) => i.productId!);
	const bondIsins = items
		.filter((i) => i.productType === "bond" && !i.productName && (i.isin || i.productId))
		.map((i) => (i.isin || i.productId)!);
	const equitySymbols = items
		.filter((i) => (i.productType === "equity" || i.productType === "stock") && !i.productName && i.productId)
		.map((i) => i.productId!);
	const aifIds = items
		.filter((i) => (i.productType === "aif" || i.productType === "pms") && !i.productName && i.productId)
		.map((i) => i.productId!);

	if (mfIds.length > 0) {
		try {
			const rows = await db
				.select({ schemeCode: mutualFunds.schemeCode, schemeName: mutualFunds.schemeName })
				.from(mutualFunds)
				.where(inArray(mutualFunds.schemeCode, mfIds));
			rows.forEach((r) => r.schemeName && nameMap.set(r.schemeCode, r.schemeName));
		} catch (e) {
			console.warn("[ProposalNames] MF name lookup failed:", (e as Error).message);
		}
	}

	if (bondIsins.length > 0) {
		try {
			const rows = await db
				.select({ isin: bondCatalog.isin, issuerName: bondCatalog.issuerName })
				.from(bondCatalog)
				.where(inArray(bondCatalog.isin, bondIsins));
			rows.forEach((r) => r.issuerName && nameMap.set(r.isin ?? undefined, r.issuerName));
		} catch (e) {
			console.warn("[ProposalNames] Bond name lookup failed:", (e as Error).message);
		}
	}

	if (equitySymbols.length > 0) {
		try {
			const rows = await db
				.select({ symbol: listedStocks.symbol, companyName: listedStocks.companyName })
				.from(listedStocks)
				.where(inArray(listedStocks.symbol, equitySymbols));
			rows.forEach((r) => r.companyName && nameMap.set(r.symbol, r.companyName));
		} catch (e) {
			console.warn("[ProposalNames] Equity name lookup failed:", (e as Error).message);
		}
	}

	if (aifIds.length > 0) {
		try {
			const rows = await db
				.select({ id: aifMaster.id, fundName: (aifMaster as any).fundName ?? (aifMaster as any).name })
				.from(aifMaster)
				.where(inArray(aifMaster.id, aifIds));
			rows.forEach((r: any) => {
				const name = r.fundName ?? r.name;
				if (name) nameMap.set(r.id, name);
			});
		} catch (e) {
			console.warn("[ProposalNames] AIF name lookup failed:", (e as Error).message);
		}
	}

	return nameMap;
}

type ProposalSourceType =
	| "ai_rebalancing"
	| "ai_retirement"
	| "ai_goals"
	| "agent"
	| "self"
	| "ai"
	| "hybrid";

interface UnifiedProposalItem {
	id: string;
	proposalId: string;
	productType: string;
	productId?: string;
	productName: string;
	isin?: string;
	actionType?: "BUY" | "SELL" | "SWITCH" | "HOLD";
	amount: number;
	units?: number;
	rationale?: string;
	status: string;
}

interface UnifiedProposal {
	id: string;
	clientId: string;
	clientName?: string;
	agentId?: string;
	agentName?: string;
	title: string;
	description?: string;
	proposalSource: ProposalSourceType;
	aiSubSource?: "rebalancing" | "retirement" | "goals";
	status: string;
	totalAmount: number;
	validUntil?: string;
	createdAt: string;
	updatedAt?: string;
	items: UnifiedProposalItem[];
	approvedItemsCount?: number;
	rejectedItemsCount?: number;
	addedToCart?: boolean;
}

function mapProposalSource(
	source: string,
	aiSubType?: string,
): ProposalSourceType {
	if (source === "ai" && aiSubType) {
		switch (aiSubType) {
			case "rebalancing":
				return "ai_rebalancing";
			case "retirement":
				return "ai_retirement";
			case "goals":
				return "ai_goals";
			default:
				return "ai_rebalancing";
		}
	}
	switch (source) {
		case "ai":
			return "ai_rebalancing";
		case "agent":
			return "agent";
		case "client":
			return "self";
		case "self":
			return "self";
		case "hybrid":
			return "agent";
		default:
			return "agent";
	}
}

router.get("/", async (req: Request, res: Response) => {
	try {
		const user = req.user as any;
		if (!user) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const proposals = await db
			.select({
				id: investmentProposals.id,
				clientId: investmentProposals.clientId,
				agentId: investmentProposals.agentId,
				title: investmentProposals.title,
				description: investmentProposals.description,
				proposalSource: investmentProposals.proposalSource,
				aiSubType: investmentProposals.aiSubType,
				status: investmentProposals.status,
				totalInvestmentAmount: investmentProposals.totalInvestmentAmount,
				validUntil: investmentProposals.validUntil,
				createdAt: investmentProposals.createdAt,
				updatedAt: investmentProposals.updatedAt,
				addedToCartAt: investmentProposals.addedToCartAt,
			})
			.from(investmentProposals)
			.where(eq(investmentProposals.clientId, user.id))
			.orderBy(desc(investmentProposals.createdAt));

		const result: UnifiedProposal[] = [];

		const itemArrays = await Promise.all(
			proposals.map((proposal) =>
				db
					.select({
						id: investmentProposalItems.id,
						proposalId: investmentProposalItems.proposalId,
						productType: investmentProposalItems.productType,
						productId: investmentProposalItems.productId,
						productName: investmentProposalItems.productName,
						isin: investmentProposalItems.isin,
						actionType: investmentProposalItems.actionType,
						amount: investmentProposalItems.amount,
						units: investmentProposalItems.units,
						rationale: (investmentProposalItems as any).rationale,
						status: (investmentProposalItems as any).status,
					})
					.from(investmentProposalItems)
					.where(eq(investmentProposalItems.proposalId, proposal.id)),
			),
		);

		// Flatten all items for batch name resolution
		const allItems = itemArrays.flat();
		const nameMap = await resolveProductNames(allItems);

		let itemsIdx = 0;
		for (const proposal of proposals) {
			const items = itemArrays[itemsIdx++];
			const mappedSource = mapProposalSource(
				proposal.proposalSource || "agent",
				proposal.aiSubType || undefined,
			);

			const approvedCount = items.filter((i: any) => i.status === "approved").length;
			const rejectedCount = items.filter((i: any) => i.status === "rejected").length;

			result.push({
				id: proposal.id,
				clientId: proposal.clientId || "",
				agentId: proposal.agentId || undefined,
				title: proposal.title || "Untitled Proposal",
				description: proposal.description || undefined,
				proposalSource: mappedSource,
				aiSubSource: proposal.aiSubType as
					| "rebalancing"
					| "retirement"
					| "goals"
					| undefined,
				status: proposal.status || "draft",
				totalAmount: Number(proposal.totalInvestmentAmount) || 0,
				validUntil: proposal.validUntil?.toISOString() || undefined,
				createdAt: proposal.createdAt?.toISOString() || new Date().toISOString(),
				updatedAt: proposal.updatedAt?.toISOString() || undefined,
				items: items.map((item: any) => {
					// Resolve product name: DB value → nameMap lookup → productId fallback
					const resolvedName =
						item.productName ||
						nameMap.get(item.isin || item.productId) ||
						item.productId ||
						"Unknown Product";
					return {
						id: item.id,
						proposalId: item.proposalId,
						productType: item.productType || "mutual_fund",
						productId: item.productId || undefined,
						productName: resolvedName,
						isin: item.isin || undefined,
						actionType: item.actionType as
							| "BUY"
							| "SELL"
							| "SWITCH"
							| "HOLD"
							| undefined,
						amount: Number(item.amount) || 0,
						units: item.units ? Number(item.units) : undefined,
						rationale: item.rationale || undefined,
						status: item.status || "pending",
					};
				}),
				approvedItemsCount: approvedCount,
				rejectedItemsCount: rejectedCount,
				addedToCart: !!proposal.addedToCartAt,
			});
		}

		res.json(result);
	} catch (error) {
		console.error("[Unified Proposals] Error fetching proposals:", error);
		res.status(500).json({ error: "Failed to fetch proposals" });
	}
});

router.get("/:id", async (req: Request, res: Response) => {
	try {
		const user = req.user as any;
		if (!user) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { id } = req.params;

		const [proposal] = await db
			.select()
			.from(investmentProposals)
			.where(
				and(
					eq(investmentProposals.id, id),
					eq(investmentProposals.clientId, user.id),
				),
			);

		if (!proposal) {
			return res.status(404).json({ error: "Proposal not found" });
		}

		const items = await db
			.select()
			.from(investmentProposalItems)
			.where(eq(investmentProposalItems.proposalId, id));

		const mappedSource = mapProposalSource(
			proposal.proposalSource || "agent",
			proposal.aiSubType || undefined,
		);

		res.json({
			...proposal,
			proposalSource: mappedSource,
			items,
		});
	} catch (error) {
		console.error("[Unified Proposals] Error fetching proposal:", error);
		res.status(500).json({ error: "Failed to fetch proposal" });
	}
});

router.put("/:id/accept", async (req: Request, res: Response) => {
	try {
		const user = req.user as any;
		if (!user) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { id } = req.params;

		const [proposal] = await db
			.select()
			.from(investmentProposals)
			.where(
				and(
					eq(investmentProposals.id, id),
					eq(investmentProposals.clientId, user.id),
				),
			);

		if (!proposal) {
			return res.status(404).json({ error: "Proposal not found" });
		}

		await db
			.update(investmentProposals)
			.set({
				status: "approved",
				approvedAt: new Date(),
				updatedAt: new Date(),
			} as any)
			.where(eq(investmentProposals.id, id));

		await db
			.update(investmentProposalItems)
			.set({ status: "approved" } as any)
			.where(eq(investmentProposalItems.proposalId, id));

		res.json({ success: true, message: "Proposal approved" });
	} catch (error) {
		console.error("[Unified Proposals] Error accepting proposal:", error);
		res.status(500).json({ error: "Failed to accept proposal" });
	}
});

router.put("/:id/reject", async (req: Request, res: Response) => {
	try {
		const user = req.user as any;
		if (!user) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { id } = req.params;

		const [proposal] = await db
			.select()
			.from(investmentProposals)
			.where(
				and(
					eq(investmentProposals.id, id),
					eq(investmentProposals.clientId, user.id),
				),
			);

		if (!proposal) {
			return res.status(404).json({ error: "Proposal not found" });
		}

		await db
			.update(investmentProposals)
			.set({
				status: "rejected",
				updatedAt: new Date(),
			} as any)
			.where(eq(investmentProposals.id, id));

		await db
			.update(investmentProposalItems)
			.set({ status: "rejected" } as any)
			.where(eq(investmentProposalItems.proposalId, id));

		// Regulatory audit logging
		await complianceMonitor.logSuspiciousActivity({
			userId: (req as any).user?.id || "unknown",
			activityType: "PROPOSAL_REJECTED",
			details: `Proposal ${id} rejected by client`,
			severity: "low",
			metadata: { proposalId: id },
		});

		res.json({ success: true, message: "Proposal rejected" });
	} catch (error) {
		console.error("[Unified Proposals] Error rejecting proposal:", error);
		res.status(500).json({ error: "Failed to reject proposal" });
	}
});

router.post("/:id/add-to-cart", async (req: Request, res: Response) => {
	try {
		const user = req.user as any;
		if (!user) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { id } = req.params;
		const { orderType = "LUMPSUM" } = req.body;

		const [proposal] = await db
			.select()
			.from(investmentProposals)
			.where(
				and(
					eq(investmentProposals.id, id),
					eq(investmentProposals.clientId, user.id),
				),
			);

		if (!proposal) {
			return res.status(404).json({ error: "Proposal not found" });
		}

		if (proposal.status !== "approved") {
			return res
				.status(400)
				.json({ error: "Please approve the proposal first" });
		}

		const items = await db
			.select()
			.from(investmentProposalItems)
			.where(
				and(
					eq(investmentProposalItems.proposalId, id),
					eq((investmentProposalItems as any).status, "approved"),
				),
			);

		if (items.length === 0) {
			return res
				.status(400)
				.json({ error: "No approved items to add to cart" });
		}

		for (const item of items) {
			const cartItemId = nanoid();
			await db.insert(unifiedCartItems).values({
				id: cartItemId,
				userId: user.id,
				productCategory: item.productType || "mutual_fund",
				source:
					proposal.proposalSource === "ai"
						? "ai"
						: proposal.proposalSource === "agent"
							? "agent"
							: "client",
				sourceProposalId: id,
				amount: String((item as any).amount || 0),
				quantity: 1,
				displayName: item.productName || "Investment Item",
				metadata: {
					proposalItemId: item.id,
					orderType: orderType,
					productId: (item as any).productId,
					isin: (item as any).isin,
				},
			} as any);
		}

		await db
			.update(investmentProposals)
			.set({
				addedToCartAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(investmentProposals.id, id));

		res.json({
			success: true,
			message: "Items added to cart",
			itemsAdded: items.length,
		});
	} catch (error) {
		console.error("[Unified Proposals] Error adding to cart:", error);
		res.status(500).json({ error: "Failed to add to cart" });
	}
});

router.get("/by-category/:category", async (req: Request, res: Response) => {
	try {
		const user = req.user as any;
		if (!user) {
			return res.status(401).json({ error: "Authentication required" });
		}

		const { category } = req.params;

		const proposals = await db
			.select({
				id: investmentProposals.id,
				clientId: investmentProposals.clientId,
				title: investmentProposals.title,
				proposalSource: investmentProposals.proposalSource,
				aiSubType: investmentProposals.aiSubType,
				status: investmentProposals.status,
				createdAt: investmentProposals.createdAt,
				addedToCartAt: investmentProposals.addedToCartAt,
			})
			.from(investmentProposals)
			.where(eq(investmentProposals.clientId, user.id))
			.orderBy(desc(investmentProposals.createdAt));

		const result = [];

		for (const proposal of proposals) {
			const items = await db
				.select()
				.from(investmentProposalItems)
				.where(
					and(
						eq(investmentProposalItems.proposalId, proposal.id),
						eq(investmentProposalItems.productType, category),
					),
				);

			if (items.length > 0) {
				const mappedSource = mapProposalSource(
					proposal.proposalSource || "agent",
					proposal.aiSubType || undefined,
				);

				result.push({
					id: proposal.id,
					title: proposal.title,
					proposalSource: mappedSource,
					status: proposal.status,
					createdAt: proposal.createdAt?.toISOString(),
					addedToCart: !!proposal.addedToCartAt,
					items: items.map((item: any) => ({
						id: item.id,
						productType: item.productType,
						productName: item.productName,
						amount: Number((item as any).amount) || 0,
						actionType: item.actionType,
						status: item.status,
					})),
					categoryTotal: items.reduce(
						(sum: any, item: any) => sum + (Number((item as any).amount) || 0),
						0,
					),
				});
			}
		}

		res.json(result);
	} catch (error) {
		console.error(
			"[Unified Proposals] Error fetching category proposals:",
			error,
		);
		res.status(500).json({ error: "Failed to fetch category proposals" });
	}
});

export default router;
