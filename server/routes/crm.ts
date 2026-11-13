/* eslint-disable no-console */
import { Express } from "express";
import { db } from "../db";
import {
	crmInteractions,
	crmOpportunities,
	crmTasks,
	crmClientTags,
	crmActivityLog,
	users,
	userNotifications,
} from "@shared/schema";
import { prospectLeads } from "@shared/schema/crm";
import { eq, desc, and, or, sql, gte, lte, ilike } from "drizzle-orm";

export function registerCrmRoutes(app: Express) {
	// ================== Native CRM Leads (Standalone / Replaces Zoho CRM) ==================

	// Get all leads (with search, status filtering, and partner assignment)
	app.get("/api/crm/leads", async (req, res) => {
		try {
			const { search, status, partnerId, limit = "200", offset = "0" } = req.query;
			const maxLimit = Math.min(Number.parseInt(limit as string, 10) || 200, 500);
			const pageOffset = Number.parseInt(offset as string, 10) || 0;

			const conditions = [];

			if (status && status !== "all") {
				conditions.push(eq(prospectLeads.status, (status as string).toLowerCase()));
			}

			if (partnerId) {
				conditions.push(eq(prospectLeads.assignedTo, partnerId as string));
			}

			if (search) {
				const term = `%${search}%`;
				conditions.push(
					or(
						ilike(prospectLeads.companyName, term),
						ilike(prospectLeads.primaryContactName, term),
						ilike(prospectLeads.primaryEmail, term),
						ilike(prospectLeads.primaryMobile, term),
					),
				);
			}

			const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

			const rows = await db
				.select()
				.from(prospectLeads)
				.where(whereClause)
				.orderBy(desc(prospectLeads.createdAt))
				.limit(maxLimit)
				.offset(pageOffset);

			// Count total matching leads
			const [countResult] = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(prospectLeads)
				.where(whereClause);

			const statusMap: Record<string, string> = {
				new: "New",
				contacted: "Contacted",
				qualified: "Qualified",
				converted: "Converted",
				rejected: "Not Qualified",
				on_hold: "Contacted",
			};

			// Format leads for both native UI and backward-compatible ZohoLead consumers
			const formattedLeads = rows.map((l) => {
				const names = (l.primaryContactName || l.companyName || "").trim().split(" ");
				const firstName = names[0] || "";
				const lastName = names.slice(1).join(" ") || "";
				const fullName = l.primaryContactName || l.companyName || "Lead";

				return {
					id: l.id,
					First_Name: firstName,
					Last_Name: lastName,
					Full_Name: fullName,
					Email: l.primaryEmail || "",
					Phone: l.primaryMobile || "",
					Mobile: l.primaryMobile || "",
					Company: l.companyName || fullName,
					Lead_Status: statusMap[l.status] || "New",
					Lead_Source: l.source || "Native CRM",
					Created_Time: l.createdAt?.toISOString() || new Date().toISOString(),
					Modified_Time: l.updatedAt?.toISOString() || l.createdAt?.toISOString() || new Date().toISOString(),
					Owner: l.assignedTo ? { name: "Assigned Partner", email: "" } : undefined,
					cin: l.cin,
					leadScore: l.leadScore,
					wealthScore: l.wealthScore,
					activityScore: l.activityScore,
					compositeScore: l.compositeScore,
					notes: l.notes,
					source: l.source,
					rawStatus: l.status,
				};
			});

			res.json({
				success: true,
				connected: true, // Native CRM is always connected (no external Zoho OAuth dependency)
				leads: formattedLeads,
				total: countResult?.count || formattedLeads.length,
				source: "fintekpro_native_crm",
			});
		} catch (error: any) {
			console.error("Error fetching CRM leads:", error);
			res.status(500).json({ success: false, error: "Failed to fetch CRM leads" });
		}
	});

	// Get single lead details
	app.get("/api/crm/leads/:id", async (req, res) => {
		try {
			const { id } = req.params;
			const [lead] = await db
				.select()
				.from(prospectLeads)
				.where(eq(prospectLeads.id, id))
				.limit(1);

			if (!lead) {
				return res.status(404).json({ success: false, error: "Lead not found" });
			}

			// Fetch recent interactions linked to this lead if available
			res.json({
				success: true,
				connected: true,
				lead,
			});
		} catch (error: any) {
			console.error("Error fetching CRM lead:", error);
			res.status(500).json({ success: false, error: "Failed to fetch lead" });
		}
	});

	// Create a new lead directly in native CRM
	app.post("/api/crm/leads", async (req, res) => {
		try {
			const {
				companyName,
				primaryContactName,
				primaryEmail,
				primaryMobile,
				status = "new",
				source = "native_crm",
				notes,
				assignedTo,
				cin,
			} = req.body;

			if (!companyName && !primaryContactName) {
				return res.status(400).json({
					success: false,
					error: "Either company name or contact name is required",
				});
			}

			const [newLead] = await db
				.insert(prospectLeads)
				.values({
					companyName: companyName || primaryContactName,
					primaryContactName: primaryContactName || companyName,
					primaryEmail: primaryEmail || null,
					primaryMobile: primaryMobile || null,
					status: status.toLowerCase(),
					source,
					notes,
					assignedTo: assignedTo || (req as any).user?.id || null,
					cin: cin || null,
				})
				.returning();

			// Log creation in CRM activity log
			const partnerId = (req as any).user?.id || assignedTo;
			if (partnerId) {
				await db.insert(crmActivityLog).values({
					agentId: partnerId,
					activityType: "lead",
					action: "created",
					entityId: newLead.id,
					summary: `Created lead: ${newLead.primaryContactName || newLead.companyName}`,
				}).catch(() => {});
			}

			res.status(201).json({
				success: true,
				lead: newLead,
				message: "Lead created successfully in native CRM",
			});
		} catch (error: any) {
			console.error("Error creating CRM lead:", error);
			res.status(500).json({ success: false, error: "Failed to create lead" });
		}
	});

	// Update lead status or details
	app.patch("/api/crm/leads/:id", async (req, res) => {
		try {
			const { id } = req.params;
			const { status, notes, assignedTo, primaryEmail, primaryMobile, companyName, primaryContactName } = req.body;

			const updates: Record<string, any> = { updatedAt: new Date() };
			if (status) updates.status = status.toLowerCase();
			if (notes !== undefined) updates.notes = notes;
			if (assignedTo !== undefined) updates.assignedTo = assignedTo;
			if (primaryEmail !== undefined) updates.primaryEmail = primaryEmail;
			if (primaryMobile !== undefined) updates.primaryMobile = primaryMobile;
			if (companyName !== undefined) updates.companyName = companyName;
			if (primaryContactName !== undefined) updates.primaryContactName = primaryContactName;

			const [updatedLead] = await db
				.update(prospectLeads)
				.set(updates)
				.where(eq(prospectLeads.id, id))
				.returning();

			if (!updatedLead) {
				return res.status(404).json({ success: false, error: "Lead not found" });
			}

			res.json({
				success: true,
				lead: updatedLead,
				message: "Lead updated successfully",
			});
		} catch (error: any) {
			console.error("Error updating CRM lead:", error);
			res.status(500).json({ success: false, error: "Failed to update lead" });
		}
	});

	// Delete a lead
	app.delete("/api/crm/leads/:id", async (req, res) => {
		try {
			const { id } = req.params;
			await db.delete(prospectLeads).where(eq(prospectLeads.id, id));
			res.json({ success: true, message: "Lead removed from CRM" });
		} catch (error: any) {
			console.error("Error deleting CRM lead:", error);
			res.status(500).json({ success: false, error: "Failed to delete lead" });
		}
	});

	// Real-time sync endpoint (no-op since database is real-time, ensures UI compatibility)
	app.post("/api/crm/sync", async (req, res) => {
		try {
			const [countResult] = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(prospectLeads);

			res.json({
				success: true,
				connected: true,
				synced: countResult?.count || 0,
				message: "Native CRM is synchronized with database in real-time",
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// ================== CRM Interactions ==================

	// Get all interactions for a client
	app.get("/api/crm/clients/:clientId/interactions", async (req, res) => {
		try {
			const { clientId } = req.params;
			const interactions = await db
				.select()
				.from(crmInteractions)
				.where(eq(crmInteractions.clientId, clientId))
				.orderBy(desc(crmInteractions.createdAt));
			res.json(interactions);
		} catch (error) {
			console.error("Error fetching interactions:", error);
			res.status(500).json({ error: "Failed to fetch interactions" });
		}
	});

	// Create a new interaction
	app.post("/api/crm/interactions", async (req, res) => {
		try {
			const [interaction] = await db
				.insert(crmInteractions)
				.values(req.body)
				.returning();

			// Log activity
			await db.insert(crmActivityLog).values({
				agentId: req.body.agentId,
				clientId: req.body.clientId,
				activityType: "interaction",
				action: "created",
				entityId: interaction.id,
				entityType: req.body.type,
				summary: `Added ${req.body.type}: ${req.body.subject || "No subject"}`,
			});

			res.json(interaction);
		} catch (error) {
			console.error("Error creating interaction:", error);
			res.status(500).json({ error: "Failed to create interaction" });
		}
	});

	// ================== CRM Opportunities ==================

	// Get all opportunities for an agent
	app.get("/api/crm/opportunities", async (req, res) => {
		try {
			const agentId = req.query.agentId as string;
			const opportunities = await db
				.select()
				.from(crmOpportunities)
				.where(agentId ? eq(crmOpportunities.agentId, agentId) : sql`1=1`)
				.orderBy(desc(crmOpportunities.createdAt));
			res.json(opportunities);
		} catch (error) {
			console.error("Error fetching opportunities:", error);
			res.status(500).json({ error: "Failed to fetch opportunities" });
		}
	});

	// Get opportunities by stage (for Kanban board)
	app.get("/api/crm/opportunities/by-stage", async (req, res) => {
		try {
			const agentId = req.query.agentId as string;
			const opportunities = await db
				.select()
				.from(crmOpportunities)
				.where(agentId ? eq(crmOpportunities.agentId, agentId) : sql`1=1`)
				.orderBy(crmOpportunities.stage, desc(crmOpportunities.createdAt));

			// Group by stage
			const grouped = {
				lead: opportunities.filter((o) => o.stage === "lead"),
				qualified: opportunities.filter((o) => o.stage === "qualified"),
				proposal: opportunities.filter((o) => o.stage === "proposal"),
				negotiation: opportunities.filter((o) => o.stage === "negotiation"),
				won: opportunities.filter((o) => o.stage === "won"),
				lost: opportunities.filter((o) => o.stage === "lost"),
			};
			res.json(grouped);
		} catch (error) {
			console.error("Error fetching opportunities by stage:", error);
			res.status(500).json({ error: "Failed to fetch opportunities" });
		}
	});

	// Create opportunity
	app.post("/api/crm/opportunities", async (req, res) => {
		try {
			const [opportunity] = await db
				.insert(crmOpportunities)
				.values(req.body)
				.returning();

			await db.insert(crmActivityLog).values({
				agentId: req.body.agentId,
				clientId: req.body.clientId,
				activityType: "opportunity",
				action: "created",
				entityId: opportunity.id,
				summary: `Created opportunity: ${req.body.name}`,
			});

			res.json(opportunity);
		} catch (error) {
			console.error("Error creating opportunity:", error);
			res.status(500).json({ error: "Failed to create opportunity" });
		}
	});

	// Update opportunity stage (for drag-drop)
	app.patch("/api/crm/opportunities/:id/stage", async (req, res) => {
		try {
			const { id } = req.params;
			const { stage, agentId } = req.body;

			const [opportunity] = await db
				.update(crmOpportunities)
				.set({ stage, updatedAt: new Date() })
				.where(eq(crmOpportunities.id, id))
				.returning();

			await db.insert(crmActivityLog).values({
				agentId,
				clientId: opportunity.clientId,
				activityType: "opportunity",
				action: "stage_changed",
				entityId: id,
				summary: `Moved to stage: ${stage}`,
			});

			res.json(opportunity);
		} catch (error) {
			console.error("Error updating opportunity stage:", error);
			res.status(500).json({ error: "Failed to update opportunity" });
		}
	});

	// ================== CRM Tasks ==================

	// Get tasks for agent
	app.get("/api/crm/tasks", async (req, res) => {
		try {
			const agentId = req.query.agentId as string;
			const status = req.query.status as string;

			let query = db.select().from(crmTasks);
			if (agentId) {
				query = query.where(eq(crmTasks.agentId, agentId)) as any;
			}
			const tasks = await query.orderBy(crmTasks.dueDate);
			res.json(tasks);
		} catch (error) {
			console.error("Error fetching tasks:", error);
			res.status(500).json({ error: "Failed to fetch tasks" });
		}
	});

	// Create task
	app.post("/api/crm/tasks", async (req, res) => {
		try {
			const [task] = await db.insert(crmTasks).values(req.body).returning();

			await db.insert(crmActivityLog).values({
				agentId: req.body.agentId,
				clientId: req.body.clientId,
				activityType: "task",
				action: "created",
				entityId: task.id,
				summary: `Created task: ${req.body.title}`,
			});

			res.json(task);
		} catch (error) {
			console.error("Error creating task:", error);
			res.status(500).json({ error: "Failed to create task" });
		}
	});

	// Update task status
	app.patch("/api/crm/tasks/:id", async (req, res) => {
		try {
			const { id } = req.params;
			const updates = { ...req.body, updatedAt: new Date() };
			if (req.body.status === "completed") {
				updates.completedAt = new Date();
			}

			const [task] = await db
				.update(crmTasks)
				.set(updates)
				.where(eq(crmTasks.id, id))
				.returning();

			res.json(task);
		} catch (error) {
			console.error("Error updating task:", error);
			res.status(500).json({ error: "Failed to update task" });
		}
	});

	// ================== Client 360 View ==================

	// Get client 360 overview
	app.get("/api/crm/clients/:clientId/overview", async (req, res) => {
		try {
			const { clientId } = req.params;

			// Fetch client details
			const [client] = await db
				.select()
				.from(users)
				.where(eq(users.id, clientId));

			// Fetch recent interactions
			const recentInteractions = await db
				.select()
				.from(crmInteractions)
				.where(eq(crmInteractions.clientId, clientId))
				.orderBy(desc(crmInteractions.createdAt))
				.limit(10);

			// Fetch active opportunities
			const opportunities = await db
				.select()
				.from(crmOpportunities)
				.where(
					and(
						eq(crmOpportunities.clientId, clientId),
						eq(crmOpportunities.status, "open"),
					),
				);

			// Fetch pending tasks
			const pendingTasks = await db
				.select()
				.from(crmTasks)
				.where(
					and(eq(crmTasks.clientId, clientId), eq(crmTasks.status, "pending")),
				);

			// Fetch tags
			const tags = await db
				.select()
				.from(crmClientTags)
				.where(eq(crmClientTags.clientId, clientId));

			// Fetch activity timeline
			const activityTimeline = await db
				.select()
				.from(crmActivityLog)
				.where(eq(crmActivityLog.clientId, clientId))
				.orderBy(desc(crmActivityLog.createdAt))
				.limit(20);

			// Fetch automated communication & notification history (IRIS, WhatsApp, SIP reminders)
			const communicationHistory = await db
				.select()
				.from(userNotifications)
				.where(eq(userNotifications.userId, clientId))
				.orderBy(desc(userNotifications.createdAt))
				.limit(20);

			// Merge automated notices into combined chronological timeline
			const formattedNotices = communicationHistory.map((n) => ({
				id: `notice-${n.id}`,
				clientId,
				activityType: "automated_notice",
				subject: n.title,
				description: n.message,
				summary: `📢 [Automated] ${n.title}: ${n.message}`,
				createdAt: n.createdAt,
			}));

			const combinedTimeline = [...activityTimeline, ...formattedNotices].sort(
				(a, b) =>
					new Date(b.createdAt || 0).getTime() -
					new Date(a.createdAt || 0).getTime(),
			).slice(0, 30);

			// Calculate stats
			const totalOpportunityValue = opportunities.reduce(
				(sum, o) => sum + Number(o.expectedAmount || 0),
				0,
			);
			const totalInteractions = recentInteractions.length;

			res.json({
				client,
				recentInteractions,
				opportunities,
				pendingTasks,
				tags: tags.map((t) => t.tag),
				activityTimeline: combinedTimeline,
				communicationHistory,
				stats: {
					totalOpportunityValue,
					totalInteractions,
					activeOpportunities: opportunities.length,
					pendingTasksCount: pendingTasks.length,
				},
			});
		} catch (error) {
			console.error("Error fetching client overview:", error);
			res.status(500).json({ error: "Failed to fetch client overview" });
		}
	});

	// ================== Client Tags ==================

	// Add tag to client
	app.post("/api/crm/clients/:clientId/tags", async (req, res) => {
		try {
			const { clientId } = req.params;
			const [tag] = await db
				.insert(crmClientTags)
				.values({ ...req.body, clientId })
				.returning();
			res.json(tag);
		} catch (error) {
			console.error("Error adding tag:", error);
			res.status(500).json({ error: "Failed to add tag" });
		}
	});

	// Remove tag from client
	app.delete("/api/crm/clients/:clientId/tags/:tagId", async (req, res) => {
		try {
			const { tagId } = req.params;
			await db.delete(crmClientTags).where(eq(crmClientTags.id, tagId));
			res.json({ success: true });
		} catch (error) {
			console.error("Error removing tag:", error);
			res.status(500).json({ error: "Failed to remove tag" });
		}
	});

	// ================== CRM Analytics ==================

	// Get CRM dashboard stats
	app.get("/api/crm/analytics/dashboard", async (req, res) => {
		try {
			const agentIdParam = req.query.agentId;
			const agentId =
				agentIdParam && agentIdParam !== "undefined"
					? String(agentIdParam)
					: null;

			// Pipeline value by stage
			let opportunities;
			if (agentId) {
				opportunities = await db
					.select()
					.from(crmOpportunities)
					.where(eq(crmOpportunities.agentId, agentId));
			} else {
				opportunities = await db.select().from(crmOpportunities);
			}

			const pipelineByStage = {
				lead: { count: 0, value: 0 },
				qualified: { count: 0, value: 0 },
				proposal: { count: 0, value: 0 },
				negotiation: { count: 0, value: 0 },
				won: { count: 0, value: 0 },
				lost: { count: 0, value: 0 },
			};

			opportunities.forEach((o) => {
				const stage = o.stage as keyof typeof pipelineByStage;
				if (pipelineByStage[stage]) {
					pipelineByStage[stage].count++;
					pipelineByStage[stage].value += Number(o.expectedAmount || 0);
				}
			});

			// Task stats
			let tasks;
			if (agentId) {
				tasks = await db
					.select()
					.from(crmTasks)
					.where(eq(crmTasks.agentId, agentId));
			} else {
				tasks = await db.select().from(crmTasks);
			}

			const taskStats = {
				pending: tasks.filter((t) => t.status === "pending").length,
				completed: tasks.filter((t) => t.status === "completed").length,
				overdue: tasks.filter(
					(t) =>
						t.status === "pending" &&
						t.dueDate &&
						new Date(t.dueDate) < new Date(),
				).length,
			};

			// Interaction stats (last 30 days)
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			let interactions;
			if (agentId) {
				interactions = await db
					.select()
					.from(crmInteractions)
					.where(
						and(
							eq(crmInteractions.agentId, agentId),
							gte(crmInteractions.createdAt, thirtyDaysAgo),
						),
					);
			} else {
				interactions = await db
					.select()
					.from(crmInteractions)
					.where(gte(crmInteractions.createdAt, thirtyDaysAgo));
			}

			const interactionsByType = {
				call: interactions.filter((i) => i.type === "call").length,
				email: interactions.filter((i) => i.type === "email").length,
				meeting: interactions.filter((i) => i.type === "meeting").length,
				note: interactions.filter((i) => i.type === "note").length,
			};

			res.json({
				pipelineByStage,
				taskStats,
				interactionsByType,
				totalPipelineValue: opportunities
					.filter((o) => o.status === "open")
					.reduce((s, o) => s + Number(o.expectedAmount || 0), 0),
				wonValue: opportunities
					.filter((o) => o.status === "won")
					.reduce(
						(s, o) => s + Number(o.actualAmount || o.expectedAmount || 0),
						0,
					),
			});
		} catch (error: any) {
			console.error("Error fetching CRM analytics:", error?.message || error);
			res.status(500).json({ error: "Failed to fetch analytics" });
		}
	});

	console.log("✅ CRM routes registered");
}
