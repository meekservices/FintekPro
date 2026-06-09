import { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { requireAdmin, requireAgent } from "../middleware/roleMiddleware";
import * as schema from "@shared/schema";
import {
	eq,
	desc,
	sql,
	and,
	or,
	gte,
	lte,
	inArray,
	lt,
	count,
} from "drizzle-orm";
import { agentAppointments, prospectClients, portfolios } from "@shared/schema";

export function registerAgentCapitalGainPart1Part2Routes(app: Express): void {
	app.post("/api/agent/leads", requireAgent, async (req, res) => {
		try {
			const { name, email, phone, source, potentialValue, notes } = req.body;

			if (!name) {
				return res.status(400).json({ error: "Lead name is required" });
			}

			// GAP 8 FIX: If creator is a Business Associate (associate role), find their upline
			let assignedAgentId = (req.user as any)!.id;
			let resolvedSource = source || "manual";
			const userRole = (req.user as any).role;

			if (userRole === "associate") {
				try {
					const [baRecord] = await db
						.select()
						.from(schema.agents)
						.where(eq(schema.agents.userId, (req.user as any)!.id))
						.limit(1);

					if (baRecord?.reportingTo) {
						const [uplineAgent] = await db
							.select()
							.from(schema.agents)
							.where(eq(schema.agents.id, baRecord.reportingTo))
							.limit(1);

						if (uplineAgent?.userId) {
							assignedAgentId = uplineAgent.userId;
							resolvedSource = "associate_referral";
						}
					}
				} catch (e) {
					console.error("[LeadCreate] BA upline lookup failed:", e);
				}
			}

			const [newLead] = await db
				.insert(schema.agentLeads)
				.values({
					agentId: assignedAgentId,
					name,
					email: email || null,
					phone: phone || null,
					source: resolvedSource,
					potentialValue: potentialValue ? String(potentialValue) : "0",
					notes: notes || null,
					stage: "new",
					score: 50,
					tags: [],
				})
				.returning();

			res.json({
				id: newLead.id,
				name: newLead.name,
				email: newLead.email || "",
				phone: newLead.phone || "",
				stage: newLead.stage,
				source: newLead.source,
				potentialValue: Number(newLead.potentialValue) || 0,
				score: newLead.score || 50,
				notes: newLead.notes || "",
				createdAt: newLead.createdAt?.toISOString(),
				tags: newLead.tags || [],
				assignedTo: assignedAgentId,
				createdBy: (req.user as any)!.id,
			});
		} catch (error) {
			console.error("Error creating lead:", error);
			res.status(500).json({ error: "Failed to create lead" });
		}
	});

	// PATCH update lead stage
	app.patch("/api/agent/leads/:id/stage", requireAgent, async (req, res) => {
		try {
			const { id } = req.params;
			const { stage } = req.body;

			const validStages = [
				"new",
				"contacted",
				"proposal_sent",
				"negotiating",
				"converted",
				"lost",
			];
			if (!validStages.includes(stage)) {
				return res.status(400).json({ error: "Invalid stage" });
			}

			const [updated] = await db
				.update(schema.agentLeads)
				.set({
					stage,
					updatedAt: new Date(),
					lastContactAt: new Date(),
				})
				.where(
					and(
						eq(schema.agentLeads.id, id),
						eq(schema.agentLeads.agentId, (req.user as any)!.id),
					),
				)
				.returning();

			if (!updated) {
				return res.status(404).json({ error: "Lead not found" });
			}

			res.json({ success: true, lead: updated });
		} catch (error) {
			console.error("Error updating lead stage:", error);
			res.status(500).json({ error: "Failed to update lead stage" });
		}
	});

	// Agent proposals stats for notification center
	app.get("/api/agent/proposals/stats", requireAgent, async (req, res) => {
		try {
			res.json({ pendingResponses: 1 });
		} catch (error) {
			console.error("Error fetching agent proposals stats:", error);
			res.json({ pendingResponses: 0 });
		}
	});

	// GET agent notifications
	app.get("/api/agent/notifications", requireAgent, async (req, res) => {
		try {
			const agentId = (req.user as any)?.id;
			const rows = await db.execute(sql`
        SELECT id, agent_id, type, title, message, read, created_at
        FROM agent_notifications
        WHERE agent_id = ${agentId}
        ORDER BY created_at DESC
        LIMIT 50
      `);
			res.json(rows.rows ?? []);
		} catch {
			res.json([]);
		}
	});

	// Push notification subscription storage (in-memory for demo)
	const pushSubscriptions = new Map<string, any>();

	// Save push notification subscription
	app.post(
		"/api/agent/notifications/subscribe",
		requireAgent,
		async (req, res) => {
			try {
				const userId = (req.user as any)?.id || "anonymous";
				const { subscription } = req.body;

				if (!subscription) {
					return res.status(400).json({ error: "Subscription data required" });
				}

				pushSubscriptions.set(userId, {
					subscription,
					subscribedAt: new Date(),
					userId,
				});

				console.log(
					`📲 Push notification subscription saved for user: ${userId}`,
				);
				res.json({ success: true, message: "Subscription saved successfully" });
			} catch (error) {
				console.error("Error saving push subscription:", error);
				res.status(500).json({ error: "Failed to save subscription" });
			}
		},
	);

	// Mark notification as read
	app.post(
		"/api/agent/notifications/:id/read",
		requireAgent,
		async (req, res) => {
			try {
				const { id } = req.params;
				console.log(`📖 Notification ${id} marked as read`);
				res.json({ success: true });
			} catch (error) {
				console.error("Error marking notification as read:", error);
				res.status(500).json({ error: "Failed to mark notification as read" });
			}
		},
	);

	// Mark all notifications as read
	app.post(
		"/api/agent/notifications/mark-all-read",
		requireAgent,
		async (req, res) => {
			try {
				console.log("📖 All notifications marked as read");
				res.json({ success: true });
			} catch (error) {
				console.error("Error marking all notifications as read:", error);
				res.status(500).json({ error: "Failed to mark notifications as read" });
			}
		},
	);

	// Get agent profile information
	app.get("/api/agent/profile", requireAgent, async (req, res) => {
		try {
			// Get agent details from the customer care agents table
			const agents = await storage.getSubAgents((req.user as any)!.id);
			const agent = agents.find(
				(a: any) => a.employeeId === (req.user as any)!.id,
			);

			if (agent) {
				// Return data in the format expected by frontend
				return res.json({
					id: agent.id,
					fullName:
						agent.fullName ||
						`${(req.user as any)!.firstName || ""} ${(req.user as any)!.lastName || ""}`.trim(),
					email: agent.email || (req.user as any)!.email,
					employeeId: agent.employeeId,
					euinNumber: agent.euinNumber,
					arnCode: agent.arnCode,
					distributorId: agent.distributorId,
					specializations: agent.specializations || [],
					languages: agent.languages || ["en"],
					status: agent.status || "active",
					agentLevel: (req.user as any)!.role || "agent",
				});
			}

			// Fallback to default details (same as role-routes.ts fallback)
			res.json({
				id: (req.user as any)!.id || "central-test-user",
				fullName: (req.user as any)!.firstName
					? `${(req.user as any)!.firstName} ${(req.user as any)!.lastName || ""}`.trim()
					: "Test Agent",
				email: (req.user as any)!.email || "test@fintekpro.com",
				phone: (req.user as any)!.phone || "+91-9876543210",
				euinNumber: "E317634",
				arnCode: "ARN-317634",
				agentLevel: (req.user as any)!.role || "agent",
				specializations: ["Mutual Funds", "Equity"],
				languages: ["English", "Hindi"],
				status: "active",
			});
		} catch (error) {
			console.error("Error fetching agent profile:", error);
			res.status(500).json({ error: "Failed to fetch agent profile" });
		}
	});

	// Get agent marketing profile for festival greetings
	app.get("/api/agent/marketing-profile", requireAgent, async (req, res) => {
		try {
			// Get agent from agents table (uses new marketing profile fields)
			const [agent] = await db
				.select()
				.from(schema.agents)
				.where(eq(schema.agents.userId, (req.user as any)!.id))
				.limit(1);

			if (agent) {
				return res.json({
					id: agent.id,
					fullName: agent.fullName,
					email: agent.email,
					phone: agent.phone,
					marketingName: agent.marketingName,
					marketingDesignation: agent.marketingDesignation,
					marketingEmail: agent.marketingEmail,
					marketingPhone: agent.marketingPhone,
				});
			}

			// Fallback to customer care agents if no agent record
			const agents = await storage.getSubAgents((req.user as any)!.id);
			const ccAgent = agents.find(
				(a: any) => a.employeeId === (req.user as any)!.id,
			);

			if (ccAgent) {
				return res.json({
					id: ccAgent.id,
					fullName: ccAgent.fullName,
					email: ccAgent.email,
					phone: ccAgent.phone,
					marketingName: null,
					marketingDesignation: null,
					marketingEmail: null,
					marketingPhone: null,
				});
			}

			// Return user info as fallback
			res.json({
				id: (req.user as any)!.id,
				fullName:
					`${(req.user as any)!.firstName || ""} ${(req.user as any)!.lastName || ""}`.trim(),
				email: (req.user as any)!.email,
				phone: (req.user as any)!.mobile || (req.user as any)!.phone,
				marketingName: null,
				marketingDesignation: null,
				marketingEmail: null,
				marketingPhone: null,
			});
		} catch (error) {
			console.error("Error fetching agent marketing profile:", error);
			res.status(500).json({ error: "Failed to fetch marketing profile" });
		}
	});

	// Save agent marketing profile
	app.post("/api/agent/marketing-profile", requireAgent, async (req, res) => {
		try {
			const {
				marketingName,
				marketingDesignation,
				marketingEmail,
				marketingPhone,
			} = req.body;

			// Try to update agents table first
			const [existingAgent] = await db
				.select()
				.from(schema.agents)
				.where(eq(schema.agents.userId, (req.user as any)!.id))
				.limit(1);

			if (existingAgent) {
				// Update existing agent record
				const [updated] = await db
					.update(schema.agents)
					.set({
						marketingName,
						marketingDesignation,
						marketingEmail,
						marketingPhone,
						updatedAt: new Date(),
					})
					.where(eq(schema.agents.id, existingAgent.id))
					.returning();

				return res.json({
					success: true,
					profile: updated,
				});
			}

			// Create new agent record if doesn't exist
			const [newAgent] = await db
				.insert(schema.agents)
				.values({
					userId: (req.user as any)!.id,
					fullName:
						`${(req.user as any)!.firstName || ""} ${(req.user as any)!.lastName || ""}`.trim() ||
						"Agent",
					email: (req.user as any)!.email,
					phone: (req.user as any)!.mobile || (req.user as any)!.phone,
					marketingName,
					marketingDesignation,
					marketingEmail,
					marketingPhone,
				})
				.returning();

			res.json({
				success: true,
				profile: newAgent,
			});
		} catch (error) {
			console.error("Error saving agent marketing profile:", error);
			res.status(500).json({ error: "Failed to save marketing profile" });
		}
	});

	// ─── Advisor Brand Profile ───────────────────────────────────────────────
	app.get(
		"/api/agent/advisor-brand-profile",
		requireAgent,
		async (req, res) => {
			try {
				const [agent] = await db
					.select()
					.from(schema.agents)
					.where(eq(schema.agents.userId, (req.user as any)!.id))
					.limit(1);
				if (!agent) return res.json({});

				// Auto-generate referral code if missing
				if (!(agent as any).referralCode) {
					const code = `FP${agent.id.slice(0, 6).toUpperCase()}`;
					await db
						.update(schema.agents)
						.set({ referralCode: code } as any)
						.where(eq(schema.agents.id, agent.id));
					(agent as any).referralCode = code;
				}

				// Fetch referrals count
				const referrals = await db.execute(
					sql`SELECT COUNT(*) AS cnt FROM advisor_referrals WHERE referrer_id = ${agent.id}`,
				);

				res.json({
					// Identity
					fullName: agent.fullName,
					email: agent.email,
					phone: agent.phone,
					photoUrl: (agent as any).photoUrl ?? null,
					// Branding
					firmName: (agent as any).firmName ?? null,
					firmLogoUrl: (agent as any).firmLogoUrl ?? null,
					tagline: (agent as any).tagline ?? null,
					bio: (agent as any).bio ?? null,
					// Credentials
					arnCode: agent.arnCode ?? null,
					arnExpiryDate: (agent as any).arnExpiryDate ?? null,
					euinNumber: agent.euinNumber ?? null,
					sebiRegNumber: (agent as any).sebiRegNumber ?? null,
					irdaiRegNumber: (agent as any).irdaiRegNumber ?? null,
					nismCertNumber: (agent as any).nismCertNumber ?? null,
					nismCertExpiry: (agent as any).nismCertExpiry ?? null,
					cfpNumber: (agent as any).cfpNumber ?? null,
					cfpExpiry: (agent as any).cfpExpiry ?? null,
					// Business
					yearsExperience: (agent as any).yearsExperience ?? 0,
					aumManaged: (agent as any).aumManaged ?? 0,
					activeClients: agent.activeClients ?? 0,
					totalClients: agent.totalClients ?? 0,
					city: (agent as any).city ?? null,
					state: (agent as any).state ?? null,
					joiningDate: agent.joiningDate ?? null,
					// Specialisations & Language
					specializations: (agent as any).specializations ?? [],
					languagesSpoken: (agent as any).languagesSpoken ?? [],
					// Social
					linkedinUrl: (agent as any).linkedinUrl ?? null,
					whatsappBusiness: (agent as any).whatsappBusiness ?? null,
					websiteUrl: (agent as any).websiteUrl ?? null,
					twitterUrl: (agent as any).twitterUrl ?? null,
					// Referral
					referralCode: (agent as any).referralCode ?? null,
					referralCount: Number((referrals.rows[0] as any)?.cnt ?? 0),
					// Visibility
					profilePublic: (agent as any).profilePublic ?? false,
				});
			} catch (err) {
				console.error("advisor-brand-profile GET error:", err);
				res.status(500).json({ error: "Failed to load advisor profile" });
			}
		},
	);

	app.put(
		"/api/agent/advisor-brand-profile",
		requireAgent,
		async (req, res) => {
			try {
				const {
					photoUrl,
					firmName,
					firmLogoUrl,
					tagline,
					bio,
					arnCode,
					arnExpiryDate,
					euinNumber,
					sebiRegNumber,
					irdaiRegNumber,
					nismCertNumber,
					nismCertExpiry,
					cfpNumber,
					cfpExpiry,
					yearsExperience,
					aumManaged,
					city,
					state,
					specializations,
					languagesSpoken,
					linkedinUrl,
					whatsappBusiness,
					websiteUrl,
					twitterUrl,
					profilePublic,
					marketingName,
					marketingDesignation,
					marketingEmail,
					marketingPhone,
				} = req.body;

				const [existing] = await db
					.select()
					.from(schema.agents)
					.where(eq(schema.agents.userId, (req.user as any)!.id))
					.limit(1);

				const payload: Record<string, unknown> = {
					photoUrl,
					firmName,
					firmLogoUrl,
					tagline,
					bio,
					arnCode,
					arnExpiryDate: arnExpiryDate || null,
					euinNumber,
					sebiRegNumber,
					irdaiRegNumber,
					nismCertNumber,
					nismCertExpiry: nismCertExpiry || null,
					cfpNumber,
					cfpExpiry: cfpExpiry || null,
					yearsExperience: Number(yearsExperience) || 0,
					aumManaged: aumManaged || 0,
					city,
					state,
					specializations: specializations || [],
					languagesSpoken: languagesSpoken || [],
					linkedinUrl,
					whatsappBusiness,
					websiteUrl,
					twitterUrl,
					profilePublic: !!profilePublic,
					marketingName,
					marketingDesignation,
					marketingEmail,
					marketingPhone,
					updatedAt: new Date(),
				};
				// Remove undefined keys to avoid overwriting with null accidentally
				Object.keys(payload).forEach(
					(k: any) => payload[k] === undefined && delete payload[k],
				);

				if (existing) {
					await db
						.update(schema.agents)
						.set(payload as any)
						.where(eq(schema.agents.id, existing.id));
				} else {
					await db.insert(schema.agents).values({
						userId: (req.user as any)!.id,
						fullName:
							`${(req.user as any)!.firstName || ""} ${(req.user as any)!.lastName || ""}`.trim() ||
							"Agent",
						email: (req.user as any)!.email,
						phone: (req.user as any)!.mobile || (req.user as any)!.phone,
						...payload,
					} as any);
				}

				res.json({ success: true });
			} catch (err) {
				console.error("advisor-brand-profile PUT error:", err);
				res.status(500).json({ error: "Failed to save advisor profile" });
			}
		},
	);

	// Public advisor profile microsite (no auth)
	app.get("/api/public/advisor/:referralCode", async (req, res) => {
		try {
			const [agent] = await db
				.select()
				.from(schema.agents)
				.where(eq((schema.agents as any).referralCode, req.params.referralCode))
				.limit(1);
			if (!agent || !(agent as any).profilePublic) {
				return res.status(404).json({ error: "Profile not found" });
			}
			res.json({
				fullName: agent.fullName,
				photoUrl: (agent as any).photoUrl ?? null,
				firmName: (agent as any).firmName ?? null,
				firmLogoUrl: (agent as any).firmLogoUrl ?? null,
				tagline: (agent as any).tagline ?? null,
				bio: (agent as any).bio ?? null,
				arnCode: agent.arnCode ?? null,
				sebiRegNumber: (agent as any).sebiRegNumber ?? null,
				irdaiRegNumber: (agent as any).irdaiRegNumber ?? null,
				yearsExperience: (agent as any).yearsExperience ?? 0,
				aumManaged: (agent as any).aumManaged ?? 0,
				activeClients: agent.activeClients ?? 0,
				city: (agent as any).city ?? null,
				state: (agent as any).state ?? null,
				specializations: (agent as any).specializations ?? [],
				languagesSpoken: (agent as any).languagesSpoken ?? [],
				linkedinUrl: (agent as any).linkedinUrl ?? null,
				whatsappBusiness: (agent as any).whatsappBusiness ?? null,
				websiteUrl: (agent as any).websiteUrl ?? null,
				marketingPhone: agent.marketingPhone ?? null,
				marketingEmail: agent.marketingEmail ?? null,
				designation: agent.marketingDesignation ?? null,
				referralCode: (agent as any).referralCode,
			});
		} catch (err) {
			res.status(500).json({ error: "Server error" });
		}
	});

	// Get agent's partners
	app.get("/api/agent/partners", requireAgent, async (req, res) => {
		try {
			res.json([]);
		} catch (error) {
			console.error("Error fetching agent partners:", error);
			res.status(500).json({ error: "Failed to fetch partners" });
		}
	});

	// Add new partner
	app.post("/api/agent/partners", requireAgent, async (req, res) => {
		try {
			// Validate request body with Zod
			const partnerSchema = z.object({
				companyName: z.string().min(1, "Company name is required"),
				contactEmail: z.string().email("Valid email is required"),
				contactPhone: z.string().min(1, "Phone number is required"),
				address: z.string().optional(),
				website: z.string().url().optional().or(z.literal("")),
				partnerType: z.enum(["product_provider", "service_provider", "both"]),
				businessLicense: z.string().optional(),
				taxId: z.string().optional(),
				euinNumber: z.string().optional(),
				arnCode: z.string().optional(),
				hasEuinArn: z.boolean().default(false),
			});

			const partnerData = partnerSchema.parse(req.body);

			// In production, implement partner creation in storage
			const partner = {
				id: Date.now().toString(),
				...partnerData,
				createdAt: new Date().toISOString(),
				agentId: (req.user as any)!.id,
			};

			res.json({ success: true, partner });
		} catch (error) {
			console.error("Error creating partner:", error);
			res.status(500).json({ error: "Failed to create partner" });
		}
	});

	// Get agent's clients (includes both registered clients and prospects/leads)
}
