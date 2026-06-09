import { Express } from "express";
import { db } from "../db";
import {
	crmInteractions,
	crmOpportunities,
	crmTasks,
	crmClientTags,
	crmActivityLog,
	users,
} from "@shared/schema";
import { eq, desc, and, or, sql, gte, lte } from "drizzle-orm";

export function registerCrmRoutes(app: Express) {
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
				activityTimeline,
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
