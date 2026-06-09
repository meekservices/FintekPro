import { Express, Response } from "express";
import { db } from "../../db";
import { sql, desc, eq } from "drizzle-orm";
import {
	mutualFunds,
	signalResolutionLog,
	governancePolicy,
} from "@shared/schema";
import { signalOrchestrator } from "../../services/signal-orchestrator";
import { storage } from "../../storage";
import { adminService } from "../../admin-service";
import ckycDeferredRoutes from "./ckyc-deferred-routes";
import { registerSEBIComplianceRoutes } from "./sebi-compliance-routes";
import { auditIntegrityChecker } from "../../services/audit-integrity-checker";
import { platformStatsCache } from "../../services/platform-stats-cache";
import { riaValidationService } from "../../services/ria-validation-service";
import { insuranceSuitabilityService } from "../../services/insurance-suitability-service";
import { proxyToInsurance } from "../../clients/insurance-client";
import { beneficialOwnershipService } from "../../services/beneficial-ownership-service";
import { sebiScoresService } from "../../services/sebi-scores-service";
import { mfReturnsSyncService } from "../../services/mf-returns-sync-service";
import { requireAdmin } from "../../middleware/roleMiddleware";

async function ensureAgentNotificationsTable() {
	try {
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id          SERIAL PRIMARY KEY,
        agent_id    VARCHAR(255) NOT NULL,
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        type        TEXT NOT NULL DEFAULT 'info',
        link        TEXT,
        read_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id
        ON agent_notifications(agent_id)
    `);
		console.log("✅ [AgentNotifications] Table ready");
	} catch (err: any) {
		console.error("[AgentNotifications] Table init error:", err.message);
	}
}
ensureAgentNotificationsTable();

export function registerAdminPanelPart3Sub1Routes(app: Express): void {
	// Admin Dashboard - Overview statistics

	// Revenue Analytics API
	app.get("/api/admin/ai-insights/platform", requireAdmin, async (req, res) => {
		try {
			const platformInsights = [
				{
					id: "1",
					category: "market_trends",
					title: "Increased mutual fund investments",
					description:
						"Equity mutual fund investments have increased by 23% in the last 7 days, driven by market optimism.",
					severity: "low",
					timestamp: new Date().toISOString(),
					impact: "Positive trend indicates user confidence in market",
					affectedCount: 234,
					reasoning:
						"AI analysis of order patterns and market sentiment indicators",
				},
				{
					id: "2",
					category: "risk_alerts",
					title: "High volatility in small-cap stocks",
					description:
						"Small-cap stocks in portfolio showing 40% higher volatility than benchmark. Consider rebalancing recommendations.",
					severity: "high",
					timestamp: new Date(Date.now() - 3600000).toISOString(),
					impact: "Risk exposure above acceptable thresholds for 45 users",
					affectedCount: 45,
					reasoning:
						"Volatility analysis based on rolling 30-day standard deviation",
				},
				{
					id: "3",
					category: "opportunity",
					title: "Tax harvesting opportunity",
					description:
						"Identified 89 portfolios with tax loss harvesting potential before financial year end.",
					severity: "medium",
					timestamp: new Date(Date.now() - 7200000).toISOString(),
					impact: "Potential tax savings of ₹2.5L across identified portfolios",
					affectedCount: 89,
					reasoning: "Analysis of unrealized losses vs holding periods",
				},
				{
					id: "4",
					category: "anomaly",
					title: "Unusual trading pattern detected",
					description:
						"Trading volume 3x higher than usual for HDFC Bank shares across platform.",
					severity: "medium",
					timestamp: new Date(Date.now() - 1800000).toISOString(),
					impact: "May indicate news-driven trading or coordinated activity",
					affectedCount: 156,
					reasoning: "Statistical anomaly detection on trading volume patterns",
				},
			];
			res.json(platformInsights);
		} catch (error: any) {
			console.error("Error fetching AI platform insights:", error);
			res.status(500).json({ error: "Failed to fetch platform insights" });
		}
	});

	app.get(
		"/api/admin/ai-insights/recommendations",
		requireAdmin,
		async (req, res) => {
			try {
				const recommendations = [
					{
						id: 1,
						agentName: "Risk Management AI",
						recommendedAction:
							"Send rebalancing alerts to users with >30% deviation from target allocation",
						priority: "high",
						impactScore: 85,
						category: "portfolio",
						deadline: new Date(Date.now() + 86400000).toISOString(),
					},
					{
						id: 2,
						agentName: "Compliance AI",
						recommendedAction:
							"Review 23 pending KYC applications older than 48 hours",
						priority: "critical",
						impactScore: 95,
						category: "compliance",
						deadline: new Date(Date.now() + 43200000).toISOString(),
					},
					{
						id: 3,
						agentName: "Engagement AI",
						recommendedAction:
							"Launch personalized campaign for inactive users (30+ days)",
						priority: "medium",
						impactScore: 70,
						category: "marketing",
					},
					{
						id: 4,
						agentName: "Advisory AI",
						recommendedAction:
							"Update bond recommendations based on new RBI policy rates",
						priority: "high",
						impactScore: 80,
						category: "investment",
					},
				];
				res.json(recommendations);
			} catch (error: any) {
				console.error("Error fetching AI recommendations:", error);
				res.status(500).json({ error: "Failed to fetch recommendations" });
			}
		},
	);

	app.get("/api/admin/ai-insights/trends", requireAdmin, async (req, res) => {
		try {
			const trendData = [
				{
					date: "2026-01-01",
					riskScore: 32,
					alerts: 5,
					opportunities: 12,
					anomalies: 2,
				},
				{
					date: "2026-01-02",
					riskScore: 38,
					alerts: 8,
					opportunities: 10,
					anomalies: 1,
				},
				{
					date: "2026-01-03",
					riskScore: 35,
					alerts: 6,
					opportunities: 15,
					anomalies: 3,
				},
				{
					date: "2026-01-04",
					riskScore: 28,
					alerts: 4,
					opportunities: 18,
					anomalies: 1,
				},
			];
			res.json(trendData);
		} catch (error: any) {
			console.error("Error fetching AI trends:", error);
			res.status(500).json({ error: "Failed to fetch trends" });
		}
	});

	// Report Builder API
	app.get("/api/admin/report-builder", requireAdmin, async (req, res) => {
		res.json({
			templates: [
				{
					id: "1",
					name: "User Growth Report",
					description: "Daily/weekly user registration trends",
					category: "users",
					columns: ["date", "new_users", "active_users"],
					filters: {},
					createdBy: "admin",
				},
				{
					id: "2",
					name: "Revenue Summary",
					description: "Monthly revenue breakdown by product",
					category: "revenue",
					columns: ["product", "revenue", "transactions"],
					filters: {},
					schedule: {
						frequency: "monthly",
						time: "09:00",
						recipients: ["admin@fintekpro.com"],
					},
					createdBy: "admin",
				},
				{
					id: "3",
					name: "KYC Status Report",
					description: "KYC verification status summary",
					category: "kyc",
					columns: ["tier", "pending", "approved", "rejected"],
					filters: {},
					createdBy: "admin",
				},
				{
					id: "4",
					name: "Compliance Audit",
					description: "Regulatory compliance checklist",
					category: "compliance",
					columns: ["requirement", "status", "deadline"],
					filters: {},
					schedule: {
						frequency: "weekly",
						time: "08:00",
						recipients: ["compliance@fintekpro.com"],
					},
					createdBy: "admin",
				},
			],
			recentReports: [
				{
					id: "r1",
					templateId: "1",
					templateName: "User Growth Report",
					status: "completed",
					format: "pdf",
					createdAt: new Date().toISOString(),
					completedAt: new Date().toISOString(),
					downloadUrl: "#",
					fileSize: 125000,
				},
				{
					id: "r2",
					templateId: "2",
					templateName: "Revenue Summary",
					status: "completed",
					format: "excel",
					createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
					completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
					downloadUrl: "#",
					fileSize: 89000,
				},
			],
			availableColumns: {
				users: ["id", "name", "email", "created_at", "kyc_tier", "is_active"],
				revenue: ["product", "amount", "date", "status"],
				kyc: ["user_id", "tier", "status", "verified_at"],
			},
			stats: { totalTemplates: 4, reportsGenerated: 28, scheduledReports: 2 },
		});
	});

	app.post("/api/admin/reports/generate", requireAdmin, async (req, res) => {
		const { templateId, format } = req.body;
		res.json({
			id: `rep-${Date.now()}`,
			templateId,
			format,
			status: "pending",
			message: "Report generation queued",
		});
	});
	app.get("/api/admin/system-health", requireAdmin, async (req, res) => {
		try {
			const { getSystemHealth } = await import("../../services/system-health");
			const healthReport = await getSystemHealth();
			res.json(healthReport);
		} catch (error: any) {
			console.error("[System Health] Error:", error.message);
			res.status(500).json({
				error: "Failed to get system health",
				message: error.message,
				overallStatus: "critical",
				services: [],
				backgroundJobs: [],
				metrics: {
					uptime: 0,
					memoryUsage: { used: 0, total: 0, percentage: 0 },
					activeConnections: 0,
				},
				alerts: [],
			});
		}
	});

	app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
		try {
			// Use raw SQL to get accurate counts and avoid Drizzle column selection issues
			const totalUsersResult = await db.execute(
				sql`SELECT COUNT(*)::int AS count FROM users`,
			);
			const totalUsers = Number(totalUsersResult.rows[0]?.count || 0);

			const activeUsersResult = await db.execute(
				sql`SELECT COUNT(*)::int AS count FROM users WHERE is_active = true`,
			);
			const activeUsers = Number(activeUsersResult.rows[0]?.count || 0);

			const businessClientsResult = await db.execute(
				sql`SELECT COUNT(*)::int AS count FROM users WHERE 'business_client' = ANY(COALESCE(roles, ARRAY[]::varchar[]))`,
			);
			const businessClients = Number(businessClientsResult.rows[0]?.count || 0);

			const totalLoginsResult = await db.execute(
				sql`SELECT SUM(COALESCE(login_count, 0))::int AS count FROM users`,
			);
			const totalLogins = Number(totalLoginsResult.rows[0]?.count || 0);

			// Get new users today (registered in last 24 hours)
			const newUsersTodayResult = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM users 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);
			const newUsersToday = Number(newUsersTodayResult.rows[0]?.count || 0);

			// Get new users this week vs last week for growth calculation
			const thisWeekResult = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM users 
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `);
			const lastWeekResult = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM users 
        WHERE created_at >= NOW() - INTERVAL '14 days' 
        AND created_at < NOW() - INTERVAL '7 days'
      `);
			const thisWeekUsers = Number(thisWeekResult.rows[0]?.count || 0);
			const lastWeekUsers = Number(lastWeekResult.rows[0]?.count || 0);
			const clientGrowthPercent =
				lastWeekUsers > 0
					? Math.round(((thisWeekUsers - lastWeekUsers) / lastWeekUsers) * 100)
					: thisWeekUsers > 0
						? 100
						: 0;

			// Get real revenue from transactions (if available)
			let totalRevenue = 0;
			try {
				const revenueResult = await db.execute(sql`
          SELECT COALESCE(SUM(amount), 0)::numeric AS total 
          FROM transactions 
          WHERE status = 'completed' 
          AND created_at >= DATE_TRUNC('month', NOW())
        `);
				totalRevenue = Number(revenueResult.rows[0]?.total || 0);
			} catch (e: any) {
				console.log(
					"[Admin Dashboard] Revenue query fallback - transactions table may not exist:",
					e.message,
				);
				totalRevenue = 0;
			}

			// Get user growth data for last 7 days
			const userGrowthResult = await db.execute(sql`
        SELECT 
          TO_CHAR(created_at::date, 'Dy') as name,
          created_at::date as date,
          COUNT(*)::int as users
        FROM users 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY created_at::date
        ORDER BY created_at::date ASC
      `);

			// Build complete 7-day data with zeros for missing days
			const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
			const userGrowthData: { name: string; users: number }[] = [];
			for (let i = 6; i >= 0; i--) {
				const date = new Date();
				date.setDate(date.getDate() - i);
				const dayName = dayNames[date.getDay()];
				const dateStr = date.toISOString().split("T")[0];
				const found = userGrowthResult.rows.find(
					(r: any) =>
						r.date?.toISOString?.()?.split("T")[0] === dateStr ||
						String(r.date).split("T")[0] === dateStr,
				);
				userGrowthData.push({
					name: dayName,
					users: found ? Number(found.users) : 0,
				});
			}

			console.log(
				`Admin Dashboard Stats: ${totalUsers} users, ${businessClients} business clients, ${activeUsers} active users, ${newUsersToday} new today`,
			);

			const userStats = {
				totalUsers,
				activeUsers,
				businessClients,
				newUsersToday,
				totalLogins,
				avgSessionTime: "2.5 hours",
			};

			const activityMetrics = {
				dailyActiveUsers: activeUsers,
				weeklyActiveUsers: activeUsers,
				monthlyActiveUsers: activeUsers,
			};

			const platformInsights = {
				registrationTrend:
					clientGrowthPercent > 0
						? "up"
						: clientGrowthPercent < 0
							? "down"
							: "stable",
				engagementRate:
					totalUsers > 0 ? Math.min(0.95, activeUsers / totalUsers) : 0,
				revenue: totalRevenue,
			};

			// Format data to match frontend expectations
			res.json({
				// Top-level fields expected by frontend
				totalClients: totalUsers,
				activeClients: activeUsers,
				newClientsToday: newUsersToday,
				totalLogins,
				avgSessionTime: "2.5 hours",
				clientGrowthPercent,
				peakLogins: Math.floor(totalLogins / 30),
				loginsToday: Math.floor(totalLogins * 0.05),

				// User growth chart data
				userGrowthData,

				// Nested objects
				userStats,
				activityMetrics,
				platformInsights,
			});
		} catch (error) {
			console.error("Error fetching admin dashboard:", error);
			res.status(500).json({ error: "Failed to fetch dashboard data" });
		}
	});

	// Admin Stakeholder Stats - Aggregate counts for dashboard
	app.get("/api/admin/stakeholders/stats", requireAdmin, async (req, res) => {
		try {
			const partnersResult = await db.execute(
				sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active = true)::int AS active FROM partners`,
			);
			const agentsResult = await db.execute(
				sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active = true)::int AS active FROM agents`,
			);
			const suppliersResult = await db.execute(
				sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active = true)::int AS active FROM suppliers`,
			);

			res.json({
				stats: {
					totalPartners: Number(partnersResult.rows[0]?.total || 0),
					activePartners: Number(partnersResult.rows[0]?.active || 0),
					totalAgents: Number(agentsResult.rows[0]?.total || 0),
					activeAgents: Number(agentsResult.rows[0]?.active || 0),
					totalSuppliers: Number(suppliersResult.rows[0]?.total || 0),
					activeSuppliers: Number(suppliersResult.rows[0]?.active || 0),
				},
			});
		} catch (error) {
			console.error("Error fetching stakeholder stats:", error);
			res.status(500).json({ error: "Failed to fetch stakeholder stats" });
		}
	});

	// Admin Pending Orders Count - For dashboard quick actions
	app.get("/api/admin/pending-orders/count", requireAdmin, async (req, res) => {
		try {
			const unlistedDealsResult = await db.execute(
				sql`SELECT COUNT(*)::int AS count FROM unlisted_deals WHERE status IN ('pending', 'pending_verification', 'processing')`,
			);
			const bondOrdersResult = await db.execute(
				sql`SELECT COUNT(*)::int AS count FROM bond_orders WHERE order_status = 'pending' OR order_status = 'submitted'`,
			);

			res.json({
				unlistedPending: Number(unlistedDealsResult.rows[0]?.count || 0),
				bondPending: Number(bondOrdersResult.rows[0]?.count || 0),
				total:
					Number(unlistedDealsResult.rows[0]?.count || 0) +
					Number(bondOrdersResult.rows[0]?.count || 0),
			});
		} catch (error) {
			console.error("Error fetching pending orders count:", error);
			res.json({ unlistedPending: 0, bondPending: 0, total: 0 });
		}
	});
	// Admin Users Management - List users with filtering
	app.get("/api/admin/users", requireAdmin, async (req, res) => {
		try {
			const {
				page = "1",
				limit = "50",
				sortBy = "createdAt",
				sortOrder = "desc",
				role,
				isActive,
				searchTerm,
			} = req.query as any;

			const filter: any = {};
			if (role) filter.role = role;
			if (isActive !== undefined) filter.isActive = isActive === "true";
			if (searchTerm) filter.searchTerm = searchTerm;

			const result = await adminService.getUsers(
				Number.parseInt(page),
				Number.parseInt(limit),
				sortBy as "createdAt" | "loginCount" | "lastLoginAt",
				sortOrder as "asc" | "desc",
				filter,
			);

			res.json(result);
		} catch (error) {
			console.error("Error fetching users:", error);
			res.status(500).json({ error: "Failed to fetch users" });
		}
	});

	// Admin User Management - Update user role
	app.patch("/api/admin/users/:userId/role", requireAdmin, async (req, res) => {
		try {
			const { userId } = req.params;
			const { role } = req.body;

			if (!["user", "admin", "super_admin"].includes(role)) {
				return res.status(400).json({ error: "Invalid role" });
			}

			await storage.updateUserRole(userId, role);
			await adminService.logActivity({
				userId: req.user!.id,
				action: "admin_role_update",
				resource: `user:${userId}`,
				details: { newRole: role },
				ipAddress: req.ip,
			});

			res.json({ success: true, message: "User role updated successfully" });
		} catch (error) {
			console.error("Error updating user role:", error);
			res.status(500).json({ error: "Failed to update user role" });
		}
	});

	// Admin User Management - Update user status
	app.patch(
		"/api/admin/users/:userId/status",
		requireAdmin,
		async (req, res) => {
			try {
				const { userId } = req.params;
				const { isActive } = req.body;

				await storage.updateUserStatus(userId, isActive);
				await adminService.logActivity({
					userId: req.user!.id,
					action: "admin_status_update",
					resource: `user:${userId}`,
					details: { newStatus: isActive ? "active" : "inactive" },
					ipAddress: req.ip,
				});

				res.json({
					success: true,
					message: "User status updated successfully",
				});
			} catch (error) {
				console.error("Error updating user status:", error);
				res.status(500).json({ error: "Failed to update user status" });
			}
		},
	);

	// Admin Activity Monitoring - Get user activity
	app.get(
		"/api/admin/users/:userId/activity",
		requireAdmin,
		async (req, res) => {
			try {
				const { userId } = req.params;
				const { limit = "50" } = req.query as any;

				const activities = await adminService.getUserActivityHistory(
					userId,
					Number.parseInt(limit),
				);
				res.json(activities);
			} catch (error) {
				console.error("Error fetching user activity:", error);
				res.status(500).json({ error: "Failed to fetch user activity" });
			}
		},
	);

	// Admin User Guidance - Send guidance message
}
