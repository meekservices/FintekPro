import {
	generateMarketInsight,
	analyzePortfolio,
	explainFinancialConcept,
} from "./gemini-service";
import { whatsappService } from "./whatsapp";
import { storage } from "./storage";
import { db } from "./db";
import { prospectClients } from "@shared/schema";
import { eq, and, sql, lt } from "drizzle-orm";
import { logger } from "./logger";

export class MarketingAutomationService {
	private campaignRunning = false;

	// AI-powered marketing campaign generator
	async generateMarketingCampaign(targetAudience: string): Promise<{
		subject: string;
		content: string;
		whatsappMessage: string;
	}> {
		const marketData = await this.getLatestMarketData();
		const insight = await generateMarketInsight(marketData);

		return {
			subject: "Your Personalized Market Insights from FintekPro",
			content: `${insight}\n\nDon't miss out on these opportunities! Visit FintekPro to optimize your portfolio with AI-powered recommendations.`,
			whatsappMessage: `🏦 *FintekPro Market Update*\n\n${insight}\n\n📱 Login to your account for detailed analysis and recommendations!`,
		};
	}

	// Automated portfolio marketing with AI insights
	async sendPortfolioMarketingMessages(
		userSegment: "new_users" | "active_traders" | "long_term_investors",
	): Promise<void> {
		if (this.campaignRunning) return;
		this.campaignRunning = true;

		try {
			const recipients = await this.getUsersBySegment(userSegment);
			const marketingContent = await this.generateMarketingCampaign(userSegment);

			for (const user of recipients) {
				if (user.phone) {
					await whatsappService.sendMessage(
						user.phone,
						this.personalizeMessage(marketingContent.whatsappMessage, user),
					);
					// Delay to avoid rate limiting
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}
			}

			logger.info("[Marketing]", {
				event: "MARKETING_CAMPAIGN_SENT",
				segment: userSegment,
				recipient_count: recipients.length,
				status: "success",
			});
		} catch (error: any) {
			logger.error("[Marketing]", { event: "MARKETING_CAMPAIGN_ERROR", error: error.message, retryable: true });
		} finally {
			this.campaignRunning = false;
		}
	}

	// AI-powered customer onboarding sequence
	async sendOnboardingSequence(
		phoneNumber: string,
		userName: string,
	): Promise<void> {
		const messages = [
			`🎉 Welcome to FintekPro, ${userName}!\n\nYour journey to smarter investing starts here. Let's set up your profile for personalized recommendations.`,
			`📊 *Getting Started:*\n1. Complete your investor profile\n2. Add your first investment\n3. Get AI-powered insights\n\nReady to build wealth with data-driven decisions?`,
			`🤖 *AI-Powered Features:*\n✅ Smart portfolio analysis\n✅ Market trend predictions\n✅ Risk assessment\n✅ Personalized recommendations\n\nYour financial success is our priority!`,
		];

		for (let i = 0; i < messages.length; i++) {
			await whatsappService.sendMessage(phoneNumber, messages[i]);
			if (i < messages.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 30000));
			}
		}
	}

	// Automated market alerts with AI analysis
	async sendMarketAlerts(): Promise<void> {
		try {
			const marketData = await this.getLatestMarketData();
			const significantMovements = this.detectSignificantMovements(marketData);

			if (significantMovements.length > 0) {
				const analysis = await generateMarketInsight(significantMovements);
				const subscribers = await this.getMarketAlertSubscribers();

				for (const subscriber of subscribers) {
					const alertMessage = `🚨 *Market Alert*\n\n${analysis}\n\n📱 Check your FintekPro portfolio for impact analysis!`;
					await whatsappService.sendMessage(subscriber.phone, alertMessage);
				}
			}
		} catch (error: any) {
			logger.error("[Marketing]", { event: "MARKET_ALERT_ERROR", error: error.message, retryable: true });
		}
	}

	// AI-driven customer retention campaigns
	async sendRetentionCampaigns(): Promise<void> {
		const inactiveUsers = await this.getInactiveUsers();

		for (const user of inactiveUsers) {
			const explanation = await explainFinancialConcept("portfolio diversification");
			const retentionMessage = `💡 *Financial Tip for ${user.name}*\n\n${explanation}\n\n🎯 Come back to FintekPro and optimize your investments with our AI advisor!`;

			if (user.phone) {
				await whatsappService.sendMessage(user.phone, retentionMessage);
			}
		}
	}

	private personalizeMessage(template: string, user: any): string {
		return template.replace(/FintekPro/g, `FintekPro for ${user.name || "you"}`);
	}

	private async getLatestMarketData(): Promise<any> {
		return {
			indices: [
				{ symbol: "NIFTY50", price: 24500, change: 1.5 },
				{ symbol: "SENSEX", price: 81000, change: 2.1 },
			],
			topGainers: [
				{ symbol: "RELIANCE", change: 3.2 },
				{ symbol: "TCS", change: 2.8 },
			],
		};
	}

	private detectSignificantMovements(marketData: any): any[] {
		return marketData.indices.filter((index: any) => Math.abs(index.change) > 2);
	}

	/**
	 * Fetch real prospect clients from DB, segmented by prospect state.
	 * Replaces the previous hard-coded mock user list.
	 *
	 * @param segment - "new_users" → state=prospect, "active_traders" → state=active_client, "long_term_investors" → state=onboarded
	 */
	private async getUsersBySegment(segment: string): Promise<any[]> {
		try {
			const stateFilter =
				segment === "new_users"
					? "prospect"
					: segment === "active_traders"
					? "active_client"
					: "onboarded";

			const prospects = await db
				.select({
					id: prospectClients.id,
					name: prospectClients.name,
					phone: prospectClients.mobile,
				})
				.from(prospectClients)
				.where(
					and(
						eq(prospectClients.state, stateFilter),
						sql`${prospectClients.mobile} IS NOT NULL`,
					),
				)
				.limit(100); // Safety cap — respect WhatsApp rate limits

			return prospects.map((p) => ({ id: p.id, name: p.name, phone: p.phone }));
		} catch {
			return [];
		}
	}

	/**
	 * Fetch active client subscribers for market alerts.
	 */
	private async getMarketAlertSubscribers(): Promise<any[]> {
		try {
			const subscribers = await db
				.select({
					id: prospectClients.id,
					name: prospectClients.name,
					phone: prospectClients.mobile,
				})
				.from(prospectClients)
				.where(
					and(
						eq(prospectClients.state, "active_client"),
						sql`${prospectClients.mobile} IS NOT NULL`,
					),
				)
				.limit(50);
			return subscribers.map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
		} catch {
			return [];
		}
	}

	/**
	 * Fetch prospects inactive for more than 30 days.
	 */
	private async getInactiveUsers(): Promise<any[]> {
		try {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const inactive = await db
				.select({
					id: prospectClients.id,
					name: prospectClients.name,
					phone: prospectClients.mobile,
				})
				.from(prospectClients)
				.where(
					and(
						eq(prospectClients.state, "prospect"),
						lt(prospectClients.updatedAt, thirtyDaysAgo),
						sql`${prospectClients.mobile} IS NOT NULL`,
					),
				)
				.limit(50);
			return inactive.map((u) => ({ id: u.id, name: u.name, phone: u.phone }));
		} catch {
			return [];
		}
	}
}

export const marketingService = new MarketingAutomationService();
