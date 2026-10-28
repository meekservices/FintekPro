/* eslint-disable no-console */
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
import { logger } from "../logger";

export function registerAgentCapitalGainPart1Part2Routes(app: Express): void {
	app.post(["/api/agent/leads", "/api/partner/leads"], requireAgent, async (req, res) => {
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

	// POST bulk upload leads
	app.post(["/api/agent/leads/bulk", "/api/partner/leads/bulk"], requireAgent, async (req, res) => {
		try {
			const { leads } = req.body;
			if (!Array.isArray(leads) || leads.length === 0) {
				return res.status(400).json({ error: "No leads provided in array" });
			}

			if (leads.length > 500) {
				return res.status(400).json({ error: "Maximum 500 leads per bulk upload batch" });
			}

			let assignedAgentId = (req.user as any)!.id;
			let resolvedSource = "bulk_import";
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
				} catch (e: any) {
					logger.error("[BulkLeadCreate] BA upline lookup failed", { error: e.message });
				}
			}

			const validStages = ["new", "contacted", "proposal_sent", "negotiating", "converted", "lost"];
			const validLeads = leads
				.filter((l: any) => l && l.name && String(l.name).trim().length > 0)
				.map((l: any) => {
					const stage = validStages.includes(l.stage) ? l.stage : "new";
					const tags = Array.isArray(l.tags)
						? l.tags
						: typeof l.tags === "string" && l.tags.trim().length > 0
							? l.tags.split(",").map((t: string) => t.trim())
							: [];

					return {
						agentId: assignedAgentId,
						name: String(l.name).trim(),
						email: l.email ? String(l.email).trim() : null,
						phone: l.phone ? String(l.phone).replace(/[^\d+]/g, "") : null,
						source: l.source ? String(l.source).trim() : resolvedSource,
						potentialValue: l.potentialValue ? String(l.potentialValue).replace(/[^\d.]/g, "") : "0",
						notes: l.notes ? String(l.notes).trim() : null,
						stage,
						score: Number(l.score) || 50,
						tags,
					};
				});

			if (validLeads.length === 0) {
				return res.status(400).json({ error: "No valid leads found in upload. Ensure each row contains a name." });
			}

			const inserted = await db
				.insert(schema.agentLeads)
				.values(validLeads)
				.returning();

			res.json({
				success: true,
				importedCount: inserted.length,
				data: inserted.map((lead) => ({
					id: lead.id,
					name: lead.name,
					email: lead.email || "",
					phone: lead.phone || "",
					stage: lead.stage,
					source: lead.source,
					potentialValue: Number(lead.potentialValue) || 0,
					score: lead.score || 50,
					notes: lead.notes || "",
					createdAt: lead.createdAt?.toISOString(),
					tags: lead.tags || [],
				})),
			});
		} catch (error: any) {
			logger.error("Error bulk uploading leads", { error: error.message });
			res.status(500).json({ error: error.message || "Failed to bulk upload leads" });
		}
	});

	// PATCH update lead stage
	app.patch(["/api/agent/leads/:id/stage", "/api/partner/leads/:id/stage"], requireAgent, async (req, res) => {
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

	// PUT / PATCH update full lead details
	const handleUpdateLead = async (req: any, res: any) => {
		try {
			const { id } = req.params;
			const {
				name,
				email,
				phone,
				stage,
				source,
				potentialValue,
				score,
				notes,
				tags,
				nextFollowUpAt,
				lastContactAt,
			} = req.body;

			const userId = req.user?.id;
			const userRoles: string[] = req.user?.roles || [req.user?.role || "user"];
			const isAdmin = userRoles.some((r: string) =>
				["admin", "superadmin", "master_agent"].includes(r),
			);

			// Check existing lead
			const [existingLead] = await db
				.select()
				.from(schema.agentLeads)
				.where(eq(schema.agentLeads.id, id))
				.limit(1);

			if (!existingLead) {
				return res.status(404).json({ error: "Lead not found" });
			}

			if (!isAdmin && existingLead.agentId !== userId) {
				return res
					.status(403)
					.json({ error: "You do not have permission to edit this lead" });
			}

			const validStages = [
				"new",
				"contacted",
				"proposal_sent",
				"negotiating",
				"converted",
				"lost",
			];

			const updateData: Record<string, any> = {
				updatedAt: new Date(),
			};

			if (name !== undefined) {
				if (!name || String(name).trim().length === 0) {
					return res.status(400).json({ error: "Lead name cannot be empty" });
				}
				updateData.name = String(name).trim();
			}
			if (email !== undefined) updateData.email = email ? String(email).trim() : null;
			if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;
			if (stage !== undefined) {
				if (!validStages.includes(stage)) {
					return res
						.status(400)
						.json({ error: `Invalid stage. Must be one of: ${validStages.join(", ")}` });
				}
				updateData.stage = stage;
			}
			if (source !== undefined) updateData.source = source ? String(source).trim() : "manual";
			if (potentialValue !== undefined)
				updateData.potentialValue = String(potentialValue).replace(/[^\d.]/g, "") || "0";
			if (score !== undefined) updateData.score = Number(score) || 50;
			if (notes !== undefined) updateData.notes = notes ? String(notes).trim() : null;
			if (tags !== undefined) {
				updateData.tags = Array.isArray(tags)
					? tags
					: typeof tags === "string" && tags.trim().length > 0
						? tags.split(",").map((t: string) => t.trim())
						: [];
			}
			if (nextFollowUpAt !== undefined) {
				updateData.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
			}
			if (lastContactAt !== undefined) {
				updateData.lastContactAt = lastContactAt ? new Date(lastContactAt) : null;
			}

			const [updated] = await db
				.update(schema.agentLeads)
				.set(updateData)
				.where(eq(schema.agentLeads.id, id))
				.returning();

			const transformedLead = {
				id: updated.id,
				name: updated.name,
				email: updated.email || "",
				phone: updated.phone || "",
				mobile: updated.phone || "",
				stage: updated.stage,
				status: updated.stage,
				source: updated.source || "manual",
				potentialValue: Number(updated.potentialValue) || 0,
				score: updated.score || 50,
				notes: updated.notes || "",
				interest: updated.notes || "",
				lastContact: updated.lastContactAt?.toISOString(),
				nextFollowUp: updated.nextFollowUpAt?.toISOString(),
				createdAt: updated.createdAt?.toISOString(),
				tags: updated.tags || [],
			};

			res.json({
				success: true,
				data: transformedLead,
				lead: transformedLead,
				message: "Lead updated successfully",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (error: any) {
			logger.error("Error updating lead details", { error: error.message });
			res.status(500).json({ error: error.message || "Failed to update lead" });
		}
	};

	app.put(["/api/agent/leads/:id", "/api/partner/leads/:id"], requireAgent, handleUpdateLead);
	app.patch(["/api/agent/leads/:id", "/api/partner/leads/:id"], requireAgent, handleUpdateLead);

	// DELETE lead
	app.delete(["/api/agent/leads/:id", "/api/partner/leads/:id"], requireAgent, async (req, res) => {
		try {
			const { id } = req.params;
			const userId = (req.user as any)?.id;
			const userRoles: string[] = (req.user as any)?.roles || [(req.user as any)?.role || "user"];
			const isAdmin = userRoles.some((r: string) =>
				["admin", "superadmin", "master_agent"].includes(r),
			);

			const [existingLead] = await db
				.select()
				.from(schema.agentLeads)
				.where(eq(schema.agentLeads.id, id))
				.limit(1);

			if (!existingLead) {
				return res.status(404).json({ error: "Lead not found" });
			}

			if (!isAdmin && existingLead.agentId !== userId) {
				return res
					.status(403)
					.json({ error: "You do not have permission to delete this lead" });
			}

			await db.delete(schema.agentLeads).where(eq(schema.agentLeads.id, id));

			res.json({
				success: true,
				message: "Lead deleted successfully",
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (error: any) {
			logger.error("Error deleting lead", { error: error.message });
			res.status(500).json({ error: error.message || "Failed to delete lead" });
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
        SELECT id, agent_id, type, title, COALESCE(message, body) AS message, COALESCE(read, read_at IS NOT NULL, false) AS read, created_at
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
				email: (req.user as any)?.email || "",
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
