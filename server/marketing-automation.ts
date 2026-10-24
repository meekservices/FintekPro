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

	// AI-powered marketing campaign generator tailored by vendor / asset class
	async generateMarketingCampaign(targetAudience: string): Promise<{
		subject: string;
		content: string;
		whatsappMessage: string;
	}> {
		const marketData = await this.getLatestMarketData();
		const insight = await generateMarketInsight(marketData);

		const disclaimer = "\n\nDisclaimer: Investments in securities market are subject to market risks. Read all related documents carefully before investing. FintekPro is a decision-support platform and does not promise or guarantee returns.";
		const waDisclaimer = "\n\n⚠️ _Investments in securities market are subject to market risks. Read all related documents carefully before investing._";

		let subject = "Your Personalized Market Insights from FintekPro";
		let headline = "🏦 *FintekPro Market Update*";

		if (targetAudience.includes("iris") || targetAudience.includes("mf")) {
			subject = "Mutual Fund & Wealth Insights via FintekPro (IRIS Network)";
			headline = "📈 *FintekPro Wealth & Mutual Fund Digest (IRIS)*";
		} else if (targetAudience.includes("upstox") || targetAudience === "active_traders") {
			subject = "NSE / BSE Momentum & Equity Advisory via FintekPro (Upstox)";
			headline = "⚡ *FintekPro Domestic Equity Alert (Upstox / NSE)*";
		} else if (targetAudience.includes("alpaca") || targetAudience.includes("global")) {
			subject = "Global Dollar Diversification: US Equities via FintekPro (Alpaca)";
			headline = "🌎 *FintekPro Global Equity Insights (Alpaca / US Markets)*";
		}

		return {
			subject,
			content: `${insight}\n\nExplore personalized insights and optimize your portfolio with AI-powered analytics across domestic equities, mutual funds, and global assets.${disclaimer}`,
			whatsappMessage: `${headline}\n\n${insight}\n\n📱 Login to your account for detailed analytics and recommendations!${waDisclaimer}`,
		};
	}

	// Automated portfolio marketing with AI insights
	async sendPortfolioMarketingMessages(
		userSegment:
			| "new_users"
			| "active_traders"
			| "long_term_investors"
			| "iris_mf_investors"
			| "upstox_traders"
			| "alpaca_global_investors",
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
			`🎉 Welcome to FintekPro, ${userName}!\n\nYour journey to smarter investing starts here. Let's set up your profile for personalized analytics.`,
			`📊 *Getting Started:*\n1. Complete your investor profile\n2. Add your first investment\n3. Get AI-powered insights\n\nReady to analyze your portfolio with data-driven models?`,
			`🤖 *AI-Powered Features:*\n✅ Smart portfolio analysis\n✅ Market trend analysis\n✅ Risk assessment\n✅ Personalized recommendations\n\n_Note: Investments are subject to market risk. Past performance does not guarantee future results._`,
		];

		for (let i = 0; i < messages.length; i++) {
			await whatsappService.sendMessage(phoneNumber, messages[i]);
			if (i < messages.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 5000));
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
				segment === "new_users" || segment === "iris_mf_investors"
					? "prospect"
					: segment === "active_traders" || segment === "upstox_traders"
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
