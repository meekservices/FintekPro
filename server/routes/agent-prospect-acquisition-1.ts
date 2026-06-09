// @ts-nocheck
import { Express } from "express";
import { db } from "../db";
import { requireAgent } from "../middleware/roleMiddleware";
import {
	prospectClients,
	portfolios,
	prospectProposals,
	portfolioHoldings,
} from "@shared/schema";
import { eq, and, or, desc, sql, count, inArray } from "drizzle-orm";

export function registerAgentProspectAcquisitionPart1Routes(
	app: Express,
): void {
	app.get(
		"/api/agent/prospect-clients",
		requireAgent,
		async (req: any, res) => {
			try {
				const agentId = req.user.id;
				const { state, search, page = "1", limit = "20" } = req.query;

				const conditions: any[] = [eq(prospectClients.agentId, agentId)];

				if (state && typeof state === "string") {
					conditions.push(eq(prospectClients.state, state));
				}

				if (search && typeof search === "string") {
					conditions.push(
						or(
							sql`${prospectClients.name} ILIKE ${`%${search}%`}`,
							sql`${prospectClients.email} ILIKE ${`%${search}%`}`,
							sql`${prospectClients.mobile} ILIKE ${`%${search}%`}`,
							sql`${prospectClients.pan} ILIKE ${`%${search}%`}`,
						),
					);
				}

				const pageNum = Number.parseInt(page as string) || 1;
				const limitNum = Number.parseInt(limit as string) || 20;
				const offset = (pageNum - 1) * limitNum;

				const clients = await db
					.select()
					.from(prospectClients)
					.where(and(...conditions))
					.orderBy(desc(prospectClients.createdAt))
					.limit(limitNum)
					.offset(offset);

				// Get stats
				const [totalCount] = await db
					.select({ count: sql<number>`count(*)` })
					.from(prospectClients)
					.where(eq(prospectClients.agentId, agentId));

				const [prospectCount] = await db
					.select({ count: sql<number>`count(*)` })
					.from(prospectClients)
					.where(
						and(
							eq(prospectClients.agentId, agentId),
							eq(prospectClients.state, "prospect"),
						),
					);

				const [onboardedCount] = await db
					.select({ count: sql<number>`count(*)` })
					.from(prospectClients)
					.where(
						and(
							eq(prospectClients.agentId, agentId),
							eq(prospectClients.state, "onboarded"),
						),
					);

				const [activeCount] = await db
					.select({ count: sql<number>`count(*)` })
					.from(prospectClients)
					.where(
						and(
							eq(prospectClients.agentId, agentId),
							eq(prospectClients.state, "active_client"),
						),
					);

				// Fetch unified portfolio summaries for these prospects
				const prospectIds = clients.map((c) => c.id);

				// Get portfolio data from unified tables
				const portfolioData = await db
					.select({
						prospectId: portfolios.prospectId,
						portfolioId: portfolios.id,
						portfolioSource: portfolios.source,
						isVerified: portfolios.isVerified,
						sourceFileName: portfolios.sourceFileName,
						totalValue: portfolios.totalValue,
					})
					.from(portfolios)
					.where(
						inArray(
							portfolios.prospectId,
							prospectIds.length > 0 ? prospectIds : ["__none__"],
						),
					);

				// Get holdings counts
				const holdingsCounts =
					portfolioData.length > 0
						? await db
								.select({
									portfolioId: portfolioHoldings.portfolioId,
									count: sql<number>`count(*)`,
									totalCurrentValue: sql<number>`sum(COALESCE(current_value, 0))`,
								})
								.from(portfolioHoldings)
								.where(
									inArray(
										portfolioHoldings.portfolioId,
										portfolioData.map((p) => p.portfolioId),
									),
								)
								.groupBy(portfolioHoldings.portfolioId)
						: [];

				// Create lookup maps
				const portfolioByProspect = new Map(
					portfolioData.map((p) => [p.prospectId, p]),
				);
				const holdingsByPortfolio = new Map(
					holdingsCounts.map((h) => [h.portfolioId, h]),
				);

				// Enhance clients with unified portfolio data
				const enhancedClients = clients.map((client) => {
					const portfolio = portfolioByProspect.get(client.id);
					const holdings = portfolio
						? holdingsByPortfolio.get(portfolio.portfolioId)
						: null;

					return {
						...client,
						unifiedPortfolio: portfolio
							? {
									portfolioId: portfolio.portfolioId,
									source: portfolio.portfolioSource,
									sourceFileName: portfolio.sourceFileName,
									isVerified: portfolio.isVerified,
									totalValue: Number(
										holdings?.totalCurrentValue || portfolio.totalValue || 0,
									),
									holdingsCount: Number(holdings?.count || 0),
								}
							: null,
					};
				});

				res.json({
					prospects: enhancedClients,
					stats: {
						total: Number(totalCount?.count || 0),
						prospects: Number(prospectCount?.count || 0),
						onboarded: Number(onboardedCount?.count || 0),
						activeClients: Number(activeCount?.count || 0),
					},
					pagination: {
						page: pageNum,
						limit: limitNum,
						total: Number(totalCount?.count || 0),
						totalPages: Math.ceil(Number(totalCount?.count || 0) / limitNum),
					},
				});
			} catch (error) {
				console.error("Error fetching prospect clients:", error);
				res.status(500).json({ message: "Failed to fetch prospect clients" });
			}
		},
	);

	// POST /api/agent/prospect-clients - Create new prospect client
	app.post(
		"/api/agent/prospect-clients",
		requireAgent,
		async (req: any, res) => {
			try {
				const agentId = req.user.id;
				const { name, email, mobile, pan, clientType, indicativeRiskProfile } =
					req.body;

				if (!name) {
					return res.status(400).json({ message: "Name is required" });
				}

				// Check for duplicate PAN if provided
				if (pan) {
					const existingPan = await db
						.select()
						.from(prospectClients)
						.where(
							and(
								eq(prospectClients.agentId, agentId),
								eq(prospectClients.pan, pan.toUpperCase()),
							),
						)
						.limit(1);

					if (existingPan.length > 0) {
						return res
							.status(400)
							.json({ message: "A prospect with this PAN already exists" });
					}
				}

				const [newClient] = await db
					.insert(prospectClients)
					.values({
						agentId,
						name,
						email: email || null,
						mobile: mobile || null,
						pan: pan ? pan.toUpperCase() : null,
						clientType: clientType || "individual",
						indicativeRiskProfile: indicativeRiskProfile || null,
						state: "prospect",
					})
					.returning();

				// Sync prospect to Zoho CRM as Lead with agent attribution (using master connection resolver)
				try {
					const { ZohoCRMService } = await import("../zoho/services/crm");
					const { ZohoConnectionResolver } = await import(
						"../zoho/connection-resolver"
					);

					const connection =
						await ZohoConnectionResolver.resolveForAgent(agentId);

					if (connection) {
						// Get the master agent's Zoho Account ID for hierarchical linking
						const masterAgentZohoAccountId =
							await ZohoConnectionResolver.getMasterAgentZohoAccountId(
								connection.connectionId,
							);

						const zohoCRM = new ZohoCRMService(
							connection.connectionId,
							connection.zohoDataCenter,
						);
						await zohoCRM.syncProspectToLead({
							name,
							email: email || undefined,
							phone: mobile || undefined,
							agentId,
							prospectId: newClient.id,
							masterAgentZohoAccountId: masterAgentZohoAccountId || undefined,
							notes: `Client Type: ${clientType || "individual"}, Risk Profile: ${indicativeRiskProfile || "Not assessed"}`,
						});
						console.log(
							`✅ Prospect ${name} synced to Zoho CRM as Lead (via ${connection.isMaster ? "master" : "agent"} connection, parent: ${masterAgentZohoAccountId || "none"})`,
						);
					} else {
						console.log(
							`ℹ️ No Zoho connection configured - skipping CRM sync for prospect ${name}`,
						);
					}
				} catch (zohoError) {
					console.warn(
						"Zoho CRM prospect sync failed (non-blocking):",
						zohoError,
					);
				}

				res.status(201).json(newClient);
			} catch (error) {
				console.error("Error creating prospect client:", error);
				res.status(500).json({ message: "Failed to create prospect client" });
			}
		},
	);

	// GET /api/agent/prospect-clients/all - Get all prospects for the agent (without pagination)
	app.get(
		"/api/agent/prospect-clients/all",
		requireAgent,
		async (req: any, res) => {
			try {
				const agentId = req.user.id;

				const clients = await db
					.select()
					.from(prospectClients)
					.where(eq(prospectClients.agentId, agentId))
					.orderBy(desc(prospectClients.createdAt));

				res.json({ prospects: clients });
			} catch (error) {
				console.error("Error fetching all prospect clients:", error);
				res.status(500).json({ message: "Failed to fetch prospect clients" });
			}
		},
	);

	// GET /api/agent/prospect-clients/:id - Get single prospect with full details
	app.get(
		"/api/agent/prospect-clients/:id",
		requireAgent,
		async (req: any, res) => {
			try {
				const agentId = req.user.id;
				const { id } = req.params;

				const [client] = await db
					.select()
					.from(prospectClients)
					.where(
						and(
							eq(prospectClients.id, id),
							eq(prospectClients.agentId, agentId),
						),
					);

				if (!client) {
					return res.status(404).json({ message: "Prospect client not found" });
				}

				// Get related proposals
				const proposals = await db
					.select()
					.from(prospectProposals)
					.where(eq(prospectProposals.prospectEmail, client.email || ""))
					.orderBy(desc(prospectProposals.createdAt));

				res.json({ client, proposals });
			} catch (error) {
				console.error("Error fetching prospect client:", error);
				res.status(500).json({ message: "Failed to fetch prospect client" });
			}
		},
	);

	// PATCH /api/agent/prospect-clients/:id - Update prospect
	app.patch(
		"/api/agent/prospect-clients/:id",
		requireAgent,
		async (req: any, res) => {
			try {
				const agentId = req.user.id;
				const { id } = req.params;
				const updates = req.body;

				// Verify ownership
				const [existing] = await db
					.select()
					.from(prospectClients)
					.where(
						and(
							eq(prospectClients.id, id),
							eq(prospectClients.agentId, agentId),
						),
					);

				if (!existing) {
					return res.status(404).json({ message: "Prospect client not found" });
				}

				// Don't allow direct state updates through this endpoint
				updates.state = undefined;
				updates.agentId = undefined;
				updates.id = undefined;
				updates.createdAt = undefined;

				if (updates.pan) {
					updates.pan = updates.pan.toUpperCase();
				}

				const [updated] = await db
					.update(prospectClients)
					.set({ ...updates, updatedAt: new Date() })
					.where(eq(prospectClients.id, id))
					.returning();

				res.json(updated);
			} catch (error) {
				console.error("Error updating prospect client:", error);
				res.status(500).json({ message: "Failed to update prospect client" });
			}
		},
	);

	// PATCH /api/agent/prospect-clients/:id/state - Transition prospect state
	app.patch(
		"/api/agent/prospect-clients/:id/state",
		requireAgent,
		async (req: any, res) => {
			try {
				const agentId = req.user.id;
				const { id } = req.params;
				const { newState, convertedUserId } = req.body;

				// Verify ownership
				const [existing] = await db
					.select()
					.from(prospectClients)
					.where(
						and(
							eq(prospectClients.id, id),
							eq(prospectClients.agentId, agentId),
						),
					);

				if (!existing) {
					return res.status(404).json({ message: "Prospect client not found" });
				}

				// Validate state transition
				const validTransitions: Record<string, string[]> = {
					prospect: ["onboarded"],
					onboarded: ["active_client", "prospect"],
					active_client: ["onboarded"],
				};

				if (!validTransitions[existing.state]?.includes(newState)) {
					return res.status(400).json({
						message: `Invalid state transition from '${existing.state}' to '${newState}'`,
					});
				}

				const updateData: any = { state: newState, updatedAt: new Date() };

				if (newState === "active_client" && convertedUserId) {
					updateData.convertedUserId = convertedUserId;
					updateData.convertedAt = new Date();
				}

				const [updated] = await db
					.update(prospectClients)
					.set(updateData)
					.where(eq(prospectClients.id, id))
					.returning();

				res.json(updated);
			} catch (error) {
				console.error("Error transitioning prospect state:", error);
				res
					.status(500)
					.json({ message: "Failed to transition prospect state" });
			}
		},
	);

	// POST /api/agent/prospect-clients/:id/fetch-portfolio - Trigger PAN-based portfolio fetch (simulated)
	app.post(
		"/api/agent/prospect-clients/:id/fetch-portfolio",
		requireAgent,
		async (req: any, res) => {
			try {
				const agentId = req.user.id;
				const { id } = req.params;
				const { consentGranted } = req.body;

				const [client] = await db
					.select()
					.from(prospectClients)
					.where(
						and(
							eq(prospectClients.id, id),
							eq(prospectClients.agentId, agentId),
						),
					);

				if (!client) {
					return res.status(404).json({ message: "Prospect client not found" });
				}

				if (!client.pan) {
					return res
						.status(400)
						.json({ message: "PAN is required to fetch portfolio" });
				}

				if (!consentGranted) {
					return res
						.status(400)
						.json({ message: "Portfolio fetch consent is required" });
				}

				// Simulated portfolio data (in production, this would call NSDL/CDSL APIs)
				const simulatedPortfolio = {
					fetchedAt: new Date().toISOString(),
					source: "pan_fetch",
					holdings: [
						{
							name: "Reliance Industries",
							productType: "equity",
							symbol: "RELIANCE",
							quantity: 50,
							currentValue: 145000,
							purchaseValue: 120000,
						},
						{
							name: "HDFC Balanced Advantage Fund",
							productType: "mutual_fund",
							isin: "INF179K01UT8",
							quantity: 1000,
							currentValue: 85000,
							purchaseValue: 75000,
						},
						{
							name: "Tata Motors",
							productType: "equity",
							symbol: "TATAMOTORS",
							quantity: 100,
							currentValue: 95000,
							purchaseValue: 80000,
						},
						{
							name: "ICICI Prudential Bluechip Fund",
							productType: "mutual_fund",
							isin: "INF109K01Z48",
							quantity: 500,
							currentValue: 42000,
							purchaseValue: 38000,
						},
						{
							name: "SBI Corporate Bond Fund",
							productType: "debt_fund",
							isin: "INF200K01RZ5",
							quantity: 2000,
							currentValue: 68000,
							purchaseValue: 65000,
						},
					],
					totalValue: 435000,
					assetAllocation: { equity: 55, mutual_fund: 20, debt: 16, cash: 9 },
				};

				const [updated] = await db
					.update(prospectClients)
					.set({
						fetchedPortfolio: simulatedPortfolio,
						portfolioFetchConsent: true,
						portfolioFetchConsentAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(prospectClients.id, id))
					.returning();

				res.json({
					success: true,
					portfolio: simulatedPortfolio,
					client: updated,
				});
			} catch (error) {
				console.error("Error fetching portfolio:", error);
				res.status(500).json({ message: "Failed to fetch portfolio" });
			}
		},
	);

	// POST /api/agent/prospect-clients/:id/upload-portfolio - Handle PDF/Excel upload parsing
}
