// @ts-nocheck
import { Express, Request } from "express";
import { storage } from "../storage";
import { yieldTrackerService } from "../yield-tracker-service";
import { smartInvestmentService } from "../smart-investment-service";
import {
	insertInvestmentIdeaSchema,
	insertYieldTrackerSchema,
} from "@shared/schema";

// Local compliance monitor stub - logs to console for audit trail
const complianceMonitor = {
	logEvent: (event: Record<string, unknown>) => {
		console.log("[ComplianceAudit]", JSON.stringify(event));
	},
};

import {
	logSuspiciousTransaction,
	checkSuspiciousValues,
} from "../utils/compliance-utils";

export function registerInvestmentIdeasRoutes(app: Express): void {
	app.get("/api/investment-ideas", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const ideas = await storage.getActiveInvestmentIdeas(
				(req.session as any).user.id,
			);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_investment_ideas",
				resource: (req.session as any).user.id,
				userId: (req.session as any).user.id,
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
				outcome: "success",
				riskLevel: "low",
			});

			res.json(ideas);
		} catch (error) {
			console.error("Error fetching investment ideas:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_investment_ideas",
				userId: (req.session as any)?.user?.id,
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
				outcome: "failure",
				riskLevel: "medium",
				details: {
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
			res.status(500).json({ message: "Failed to fetch investment ideas" });
		}
	});

	// Generate new investment recommendations
	app.post("/api/investment-ideas/generate", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const { symbols } = req.body;
			if (!symbols || !Array.isArray(symbols)) {
				return res.status(400).json({ message: "Symbols array is required" });
			}

			const recommendations =
				await smartInvestmentService.getMarketRecommendations(
					symbols,
					(req.session as any).user.id,
				);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "generate_investment_ideas",
				resource: symbols.join(","),
				userId: (req.session as any).user.id,
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
				outcome: "success",
				riskLevel: "low",
			});

			res.json({ recommendations });
		} catch (error) {
			console.error("Error generating investment ideas:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "generate_investment_ideas",
				userId: (req.session as any)?.user?.id,
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
				outcome: "failure",
				riskLevel: "medium",
				details: {
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
			res.status(500).json({ message: "Failed to generate investment ideas" });
		}
	});

	// Save investment idea
	app.post("/api/investment-ideas", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const ideaData = insertInvestmentIdeaSchema.parse({
				...req.body,
				userId: (req.session as any).user.id,
			});

			// Regulatory Hardening: Data Integrity Guard
			const amount = Number.parseFloat(ideaData.recommendedInvestment || "0");
			const suspiciousCheck = checkSuspiciousValues(amount);
			if (suspiciousCheck.isSuspicious) {
				logSuspiciousTransaction(
					(req.session as any).user.id,
					amount,
					suspiciousCheck.reason!,
				);
				complianceMonitor.logEvent({
					eventType: "compliance_warning",
					action: "suspicious_value_detected",
					userId: (req.session as any).user.id,
					details: suspiciousCheck.reason,
				});
				// For now we just flag it in logs, but could block it if required by user
			}

			const idea = await storage.createInvestmentIdea(ideaData);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "create_investment_idea",
				resource: idea.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(idea);
		} catch (error) {
			console.error("Error creating investment idea:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "create_investment_idea",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to create investment idea" });
		}
	});

	// Get specific investment idea
	app.get("/api/investment-ideas/:id", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const idea = await storage.getInvestmentIdea(req.params.id);
			if (!idea) {
				return res.status(404).json({ message: "Investment idea not found" });
			}

			if (idea.userId !== (req.session as any).user.id) {
				return res.status(403).json({ message: "Access denied" });
			}

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_investment_idea",
				resource: req.params.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(idea);
		} catch (error) {
			console.error("Error fetching investment idea:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_investment_idea",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to fetch investment idea" });
		}
	});

	// Update investment idea
	app.put("/api/investment-ideas/:id", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const idea = await storage.getInvestmentIdea(req.params.id);
			if (!idea) {
				return res.status(404).json({ message: "Investment idea not found" });
			}

			if (idea.userId !== (req.session as any).user.id) {
				return res.status(403).json({ message: "Access denied" });
			}

			const updated = await storage.updateInvestmentIdea(
				req.params.id,
				req.body,
			);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "update_investment_idea",
				resource: req.params.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(updated);
		} catch (error) {
			console.error("Error updating investment idea:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "update_investment_idea",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to update investment idea" });
		}
	});

	// Get investment idea tracking data
	app.get("/api/investment-ideas/:id/tracking", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const idea = await storage.getInvestmentIdea(req.params.id);
			if (!idea || idea.userId !== (req.session as any).user.id) {
				return res.status(403).json({ message: "Access denied" });
			}

			const tracking = await storage.getInvestmentIdeaTracking(req.params.id);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_idea_tracking",
				resource: req.params.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(tracking);
		} catch (error) {
			console.error("Error fetching tracking data:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_idea_tracking",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to fetch tracking data" });
		}
	});

	// Get user alerts
	app.get("/api/investment-alerts", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const alerts = await storage.getInvestmentIdeaAlerts(
				(req.session as any).user.id,
			);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_investment_alerts",
				resource: (req.session as any).user.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(alerts);
		} catch (error) {
			console.error("Error fetching alerts:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_investment_alerts",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to fetch alerts" });
		}
	});

	// Get unread alerts
	app.get("/api/investment-alerts/unread", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const alerts = await storage.getUnreadAlerts(
				(req.session as any).user.id,
			);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_unread_alerts",
				resource: (req.session as any).user.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(alerts);
		} catch (error) {
			console.error("Error fetching unread alerts:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_unread_alerts",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to fetch unread alerts" });
		}
	});

	// Mark alert as read
	app.put("/api/investment-alerts/:id/read", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const alert = await storage.markInvestmentIdeaAlertAsRead(req.params.id);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "mark_alert_read",
				resource: req.params.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(alert);
		} catch (error) {
			console.error("Error marking alert as read:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "mark_alert_read",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to mark alert as read" });
		}
	});

	// Get yield trackers
	app.get("/api/yield-tracker", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const trackers = await storage.getYieldTrackers(
				(req.session as any).user.id,
			);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_yield_trackers",
				resource: (req.session as any).user.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(trackers);
		} catch (error) {
			console.error("Error fetching yield trackers:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_yield_trackers",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to fetch yield trackers" });
		}
	});

	// Create yield tracker
	app.post("/api/yield-tracker", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const trackerData = insertYieldTrackerSchema.parse({
				...req.body,
				userId: (req.session as any).user.id,
			});

			// Regulatory Hardening: Data Integrity Guard
			const amount = Number.parseFloat(trackerData.initialInvestment || "0");
			const suspiciousCheck = checkSuspiciousValues(amount);
			if (suspiciousCheck.isSuspicious) {
				logSuspiciousTransaction(
					(req.session as any).user.id,
					amount,
					suspiciousCheck.reason!,
				);
				complianceMonitor.logEvent({
					eventType: "compliance_warning",
					action: "suspicious_value_detected",
					userId: (req.session as any).user.id,
					details: suspiciousCheck.reason,
				});
			}

			const tracker = await storage.createYieldTracker(trackerData);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "create_yield_tracker",
				resource: tracker.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(tracker);
		} catch (error) {
			console.error("Error creating yield tracker:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "create_yield_tracker",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to create yield tracker" });
		}
	});

	// Update yield tracker
	app.put("/api/yield-tracker/:id", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const tracker = await storage.getYieldTracker(req.params.id);
			if (!tracker || tracker.userId !== (req.session as any).user.id) {
				return res.status(403).json({ message: "Access denied" });
			}

			const updated = await storage.updateYieldTracker(req.params.id, req.body);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "update_yield_tracker",
				resource: req.params.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(updated);
		} catch (error) {
			console.error("Error updating yield tracker:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "update_yield_tracker",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to update yield tracker" });
		}
	});

	// Get AI-powered investment recommendations for popular symbols
	app.get("/api/investment-ideas/recommendations/popular", async (req, res) => {
		try {
			const popularSymbols = [
				"RELIANCE",
				"TCS",
				"HDFC",
				"INFY",
				"ICICIBANK",
				"KOTAKBANK",
				"LT",
				"HDFCBANK",
			];
			const recommendations =
				await smartInvestmentService.getMarketRecommendations(
					popularSymbols.slice(0, 5),
					"system",
				);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_popular_recommendations",
				outcome: "success",
				riskLevel: "low",
			});

			res.json({ recommendations });
		} catch (error) {
			console.error("Error fetching popular recommendations:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_popular_recommendations",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to fetch recommendations" });
		}
	});

	// Yield Tracker Service Routes

	// Create new yield tracker
	app.post("/api/yield-tracker/create", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const tracker = await yieldTrackerService.createTracker(
				(req.session as any).user.id,
				req.body,
			);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "create_yield_tracker",
				resource: tracker.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(tracker);
		} catch (error) {
			console.error("Error creating yield tracker:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "create_yield_tracker",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to create yield tracker" });
		}
	});

	// Update tracker price with market data
	app.put("/api/yield-tracker/:id/price", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const { currentPrice, marketData } = req.body;
			if (!currentPrice) {
				return res.status(400).json({ message: "Current price is required" });
			}

			const tracker = await yieldTrackerService.updateTrackerPrice(
				req.params.id,
				currentPrice,
				marketData,
			);
			if (!tracker) {
				return res.status(404).json({ message: "Tracker not found" });
			}

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "update_tracker_price",
				resource: req.params.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(tracker);
		} catch (error) {
			console.error("Error updating tracker price:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "update_tracker_price",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to update tracker price" });
		}
	});

	// Get yield metrics for tracker
	app.get("/api/yield-tracker/:id/metrics", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const tracker = await storage.getYieldTracker(req.params.id);
			if (!tracker) {
				return res.status(404).json({ message: "Tracker not found" });
			}

			if (tracker.userId !== (req.session as any).user.id) {
				return res.status(403).json({ message: "Access denied" });
			}

			const metrics = yieldTrackerService.calculateYieldMetrics(tracker);
			const benchmarkComparison =
				yieldTrackerService.calculateBenchmarkComparison(tracker);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_yield_metrics",
				resource: req.params.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json({ metrics, benchmarkComparison });
		} catch (error) {
			console.error("Error calculating yield metrics:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_yield_metrics",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to calculate yield metrics" });
		}
	});

	// Get performance analysis
	app.get("/api/yield-tracker/performance-analysis", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const { period = "1Y" } = req.query;
			const analysis = await yieldTrackerService.generatePerformanceAnalysis(
				(req.session as any).user.id,
				period as string,
			);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_performance_analysis",
				resource: (req.session as any).user.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(analysis);
		} catch (error) {
			console.error("Error generating performance analysis:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_performance_analysis",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res
				.status(500)
				.json({ message: "Failed to generate performance analysis" });
		}
	});

	// Get portfolio yield summary
	app.get("/api/yield-tracker/portfolio-yield", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const { portfolioId } = req.query;
			const portfolioYield = await yieldTrackerService.calculatePortfolioYield(
				(req.session as any).user.id,
				portfolioId as string,
			);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_portfolio_yield",
				resource: (req.session as any).user.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(portfolioYield);
		} catch (error) {
			console.error("Error calculating portfolio yield:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_portfolio_yield",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to calculate portfolio yield" });
		}
	});

	// Get optimization suggestions
	app.get("/api/yield-tracker/optimization-suggestions", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const suggestions =
				await yieldTrackerService.generateOptimizationSuggestions(
					(req.session as any).user.id,
				);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_optimization_suggestions",
				resource: (req.session as any).user.id,
				outcome: "success",
				riskLevel: "low",
			});

			res.json(suggestions);
		} catch (error) {
			console.error("Error generating optimization suggestions:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "read_optimization_suggestions",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res
				.status(500)
				.json({ message: "Failed to generate optimization suggestions" });
		}
	});

	// Bulk tracker price update (for scheduled updates)
	app.post("/api/yield-tracker/bulk-update", async (req, res) => {
		try {
			if (!(req.session as any)?.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const { updates } = req.body; // Array of { trackerId, currentPrice, marketData }
			if (!Array.isArray(updates)) {
				return res.status(400).json({ message: "Updates array is required" });
			}

			const results = [];
			for (const update of updates) {
				try {
					const tracker = await yieldTrackerService.updateTrackerPrice(
						update.trackerId,
						update.currentPrice,
						update.marketData,
					);
					if (tracker) {
						results.push({
							trackerId: update.trackerId,
							success: true,
							data: tracker,
						});
					} else {
						results.push({
							trackerId: update.trackerId,
							success: false,
							error: "Tracker not found",
						});
					}
				} catch (err) {
					results.push({
						trackerId: update.trackerId,
						success: false,
						error: err instanceof Error ? err.message : "Unknown error",
					});
				}
			}

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "bulk_update_trackers",
				resource: `${updates.length}_trackers`,
				outcome: "success",
				riskLevel: "low",
			});

			res.json({ results });
		} catch (error) {
			console.error("Error bulk updating trackers:", error);
			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "bulk_update_trackers",
				outcome: "failure",
				riskLevel: "medium",
				error: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(500).json({ message: "Failed to bulk update trackers" });
		}
	});
}
