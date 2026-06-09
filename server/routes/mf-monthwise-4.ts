import { Express } from "express";
import { randomInt } from "crypto";
import { storage } from "../storage";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, desc, sql, and, or } from "drizzle-orm";
import {
	generateMarketInsight,
	analyzePortfolio,
	generateInvestmentStory,
	explainFinancialConcept,
} from "../gemini-service";
import {
	marketStoryService,
	type MarketData as StoryMarketData,
} from "../market-story-service";
import { auditLogArchivalService } from "../services/audit-log-archival";
import { objectStorageClient as objectStorage } from "../objectStorage";
import { whatsappService } from "../whatsapp";
import { marketingService } from "../marketing-automation";
import { portfolioIntelligence } from "../portfolio-intelligence";
import { amfiService } from "../amfi-service";

export function registerMFMonthwiPart4Routes(app: Express): void {
	app.post("/api/ai/market-insight", async (req, res) => {
		try {
			const marketData = req.body;
			const insight = await generateMarketInsight(marketData);
			res.json({ insight });
		} catch (error) {
			console.error("Error generating market insight:", error);
			res.status(500).json({ error: "Failed to generate market insight" });
		}
	});

	app.post("/api/ai/portfolio-analysis", async (req, res) => {
		try {
			const portfolioData = req.body;
			const analysis = await analyzePortfolio(portfolioData);
			res.json(analysis);
		} catch (error) {
			console.error("Error analyzing portfolio:", error);
			res.status(500).json({ error: "Failed to analyze portfolio" });
		}
	});

	app.post("/api/ai/investment-story/:symbol", async (req, res) => {
		try {
			const { symbol } = req.params;
			const priceData = req.body;
			const story = await generateInvestmentStory(symbol, priceData);
			res.json({ story });
		} catch (error) {
			console.error("Error generating investment story:", error);
			res.status(500).json({ error: "Failed to generate investment story" });
		}
	});

	app.post("/api/ai/explain", async (req, res) => {
		try {
			const { concept } = req.body;
			if (!concept) {
				return res.status(400).json({ error: "Concept is required" });
			}
			const explanation = await explainFinancialConcept(concept);
			res.json({ explanation });
		} catch (error) {
			console.error("Error explaining concept:", error);
			res.status(500).json({ error: "Failed to explain concept" });
		}
	});

	// WhatsApp Business API endpoints
	app.get("/api/whatsapp/status", async (req, res) => {
		try {
			const isReady = whatsappService.isClientReady();
			res.json({
				status: isReady ? "ready" : "not_ready",
				ready: isReady,
			});
		} catch (error) {
			console.error("Error checking WhatsApp status:", error);
			res.status(500).json({ error: "Failed to check WhatsApp status" });
		}
	});

	app.post("/api/whatsapp/send", async (req, res) => {
		try {
			const { phoneNumber, message } = req.body;

			if (!phoneNumber || !message) {
				return res
					.status(400)
					.json({ error: "Phone number and message are required" });
			}

			const success = await whatsappService.sendMessage(phoneNumber, message);

			if (success) {
				res.json({ success: true, message: "Message sent successfully" });
			} else {
				res.status(500).json({ error: "Failed to send message" });
			}
		} catch (error) {
			console.error("Error sending WhatsApp message:", error);
			res.status(500).json({ error: "Failed to send WhatsApp message" });
		}
	});

	app.post("/api/whatsapp/portfolio-update", async (req, res) => {
		try {
			const { phoneNumber, portfolioData } = req.body;

			if (!phoneNumber || !portfolioData) {
				return res
					.status(400)
					.json({ error: "Phone number and portfolio data are required" });
			}

			const success = await whatsappService.sendPortfolioUpdate(
				phoneNumber,
				portfolioData,
			);

			if (success) {
				res.json({
					success: true,
					message: "Portfolio update sent successfully",
				});
			} else {
				res.status(500).json({ error: "Failed to send portfolio update" });
			}
		} catch (error) {
			console.error("Error sending portfolio update:", error);
			res.status(500).json({ error: "Failed to send portfolio update" });
		}
	});

	app.post("/api/whatsapp/market-alert", async (req, res) => {
		try {
			const { phoneNumber, alertData } = req.body;

			if (!phoneNumber || !alertData) {
				return res
					.status(400)
					.json({ error: "Phone number and alert data are required" });
			}

			const success = await whatsappService.sendMarketAlert(
				phoneNumber,
				alertData,
			);

			if (success) {
				res.json({ success: true, message: "Market alert sent successfully" });
			} else {
				res.status(500).json({ error: "Failed to send market alert" });
			}
		} catch (error) {
			console.error("Error sending market alert:", error);
			res.status(500).json({ error: "Failed to send market alert" });
		}
	});

	app.get("/api/whatsapp/chats", async (req, res) => {
		try {
			const chats = await whatsappService.getChats();
			res.json({ chats: chats.length, data: chats.slice(0, 10) }); // Return first 10 chats
		} catch (error) {
			console.error("Error getting WhatsApp chats:", error);
			res.status(500).json({ error: "Failed to get WhatsApp chats" });
		}
	});

	// Marketing Automation API endpoints
	app.post("/api/marketing/campaign", async (req, res) => {
		try {
			const { targetAudience } = req.body;
			const campaign = await marketingService.generateMarketingCampaign(
				targetAudience || "general",
			);
			res.json(campaign);
		} catch (error) {
			console.error("Error generating marketing campaign:", error);
			res.status(500).json({ error: "Failed to generate marketing campaign" });
		}
	});

	app.post("/api/marketing/send-campaigns", async (req, res) => {
		try {
			const { userSegment } = req.body;
			await marketingService.sendPortfolioMarketingMessages(
				userSegment || "new_users",
			);
			res.json({
				success: true,
				message: "Marketing campaigns sent successfully",
			});
		} catch (error) {
			console.error("Error sending marketing campaigns:", error);
			res.status(500).json({ error: "Failed to send marketing campaigns" });
		}
	});

	app.post("/api/marketing/onboarding", async (req, res) => {
		try {
			const { phoneNumber, userName } = req.body;
			if (!phoneNumber || !userName) {
				return res
					.status(400)
					.json({ error: "Phone number and user name are required" });
			}
			await marketingService.sendOnboardingSequence(phoneNumber, userName);
			res.json({ success: true, message: "Onboarding sequence initiated" });
		} catch (error) {
			console.error("Error sending onboarding sequence:", error);
			res.status(500).json({ error: "Failed to send onboarding sequence" });
		}
	});

	app.post("/api/marketing/market-alerts", async (req, res) => {
		try {
			await marketingService.sendMarketAlerts();
			res.json({ success: true, message: "Market alerts sent successfully" });
		} catch (error) {
			console.error("Error sending market alerts:", error);
			res.status(500).json({ error: "Failed to send market alerts" });
		}
	});

	// Portfolio Intelligence API endpoints
	app.get("/api/portfolio/:userId/optimize", async (req, res) => {
		try {
			const { userId } = req.params;
			const optimization =
				await portfolioIntelligence.optimizePortfolio(userId);
			res.json(optimization);
		} catch (error) {
			console.error("Error optimizing portfolio:", error);
			res.status(500).json({ error: "Failed to optimize portfolio" });
		}
	});

	app.get("/api/portfolio/:userId/report", async (req, res) => {
		try {
			const { userId } = req.params;
			const report =
				await portfolioIntelligence.generatePortfolioReport(userId);
			res.json({ report });
		} catch (error) {
			console.error("Error generating portfolio report:", error);
			res.status(500).json({ error: "Failed to generate portfolio report" });
		}
	});

	app.post("/api/portfolio/:userId/send-update", async (req, res) => {
		try {
			const { userId } = req.params;
			const { phoneNumber } = req.body;
			if (!phoneNumber) {
				return res.status(400).json({ error: "Phone number is required" });
			}
			await portfolioIntelligence.sendPortfolioUpdates(userId, phoneNumber);
			res.json({
				success: true,
				message: "Portfolio update sent successfully",
			});
		} catch (error) {
			console.error("Error sending portfolio update:", error);
			res.status(500).json({ error: "Failed to send portfolio update" });
		}
	});

	app.get("/api/portfolio/:userId/opportunities", async (req, res) => {
		try {
			const { userId } = req.params;
			const opportunities =
				await portfolioIntelligence.findInvestmentOpportunities(userId);
			res.json(opportunities);
		} catch (error) {
			console.error("Error finding investment opportunities:", error);
			res
				.status(500)
				.json({ error: "Failed to find investment opportunities" });
		}
	});

	app.get("/api/portfolio/:userId/rebalance", async (req, res) => {
		try {
			const { userId } = req.params;
			const recommendations =
				await portfolioIntelligence.getRebalancingRecommendations(userId);
			res.json(recommendations);
		} catch (error) {
			console.error("Error getting rebalancing recommendations:", error);
			res
				.status(500)
				.json({ error: "Failed to get rebalancing recommendations" });
		}
	});

	app.post("/api/portfolio/daily-insights", async (req, res) => {
		try {
			const { subscribers } = req.body;
			if (!subscribers || !Array.isArray(subscribers)) {
				return res.status(400).json({ error: "Subscribers array is required" });
			}
			await portfolioIntelligence.sendDailyMarketInsights(subscribers);
			res.json({ success: true, message: "Daily insights sent successfully" });
		} catch (error) {
			console.error("Error sending daily insights:", error);
			res.status(500).json({ error: "Failed to send daily insights" });
		}
	});

	// ============ UNIFIED OCR SERVICE ROUTES ============
}
