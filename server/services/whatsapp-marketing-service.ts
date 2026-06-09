// @ts-nocheck
import twilio from "twilio";
import { getTwilioClient } from "./twilio-client";
import { db } from "../db";
import {
	users,
	marketingCampaigns,
	campaignRecipients,
	whatsappContacts,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

interface WhatsAppMarketingResult {
	success: boolean;
	messageSid?: string;
	error?: string;
	status?: string;
	usedTemplate: boolean;
}

interface BulkWhatsAppResult {
	totalRecipients: number;
	sent: number;
	failed: number;
	templateUsed: boolean;
	results: Array<{
		mobile: string;
		success: boolean;
		messageSid?: string;
		error?: string;
	}>;
}

interface WhatsAppTemplate {
	contentSid: string;
	name: string;
	category: "marketing" | "utility" | "authentication";
	variables?: string[];
}

const MARKETING_TEMPLATES: Record<string, WhatsAppTemplate> = {
	welcome: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_WELCOME || "",
		name: "welcome_template",
		category: "marketing",
		variables: ["customer_name"],
	},
	ipo_alert: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_IPO || "",
		name: "ipo_alert_template",
		category: "marketing",
		variables: ["company_name", "open_date", "price_range"],
	},
	portfolio_update: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_PORTFOLIO || "",
		name: "portfolio_update_template",
		category: "utility",
		variables: ["portfolio_value", "change_percent"],
	},
	kyc_reminder: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_KYC || "",
		name: "kyc_reminder_template",
		category: "utility",
		variables: ["customer_name", "pending_step"],
	},
	promotion: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_PROMO || "",
		name: "promotion_template",
		category: "marketing",
		variables: ["offer_title", "offer_details", "cta_link"],
	},
	order_update: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_ORDER || "",
		name: "order_update_template",
		category: "utility",
		variables: ["order_id", "order_status", "order_details"],
	},
	dividend_alert: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_DIVIDEND || "",
		name: "dividend_alert_template",
		category: "utility",
		variables: ["company_name", "dividend_amount", "ex_date"],
	},
	mutual_fund: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_MF || "",
		name: "mutual_fund_template",
		category: "marketing",
		variables: ["fund_name", "returns", "min_investment"],
	},
	diwali_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_DIWALI || "",
		name: "diwali_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	holi_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_HOLI || "",
		name: "holi_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	eid_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_EID || "",
		name: "eid_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	christmas_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_CHRISTMAS || "",
		name: "christmas_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	new_year_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_NEWYEAR || "",
		name: "new_year_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	independence_day: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_INDEPENDENCE || "",
		name: "independence_day_template",
		category: "marketing",
		variables: ["customer_name", "year"],
	},
	republic_day: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_REPUBLIC || "",
		name: "republic_day_template",
		category: "marketing",
		variables: ["customer_name", "year"],
	},
	dussehra_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_DUSSEHRA || "",
		name: "dussehra_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	ganesh_chaturthi: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_GANESH || "",
		name: "ganesh_chaturthi_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	pongal_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_PONGAL || "",
		name: "pongal_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	onam_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_ONAM || "",
		name: "onam_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	raksha_bandhan: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_RAKHI || "",
		name: "raksha_bandhan_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	navratri_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_NAVRATRI || "",
		name: "navratri_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	makar_sankranti: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_SANKRANTI || "",
		name: "makar_sankranti_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	baisakhi_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_BAISAKHI || "",
		name: "baisakhi_greeting_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	guru_nanak_jayanti: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_GURUNANAK || "",
		name: "guru_nanak_jayanti_template",
		category: "marketing",
		variables: ["customer_name", "festival_year", "custom_message"],
	},
	birthday_greeting: {
		contentSid: process.env.TWILIO_WA_TEMPLATE_BIRTHDAY || "",
		name: "birthday_greeting_template",
		category: "marketing",
		variables: ["customer_name", "birthday_message"],
	},
};

class WhatsAppMarketingService {
	private client: any;
	private fromNumber: string = "";
	private isConfigured: boolean;

	private initPromise: Promise<void> | null = null;

	constructor() {
		this.initPromise = this.initialize();
	}

	private async initialize(): Promise<void> {
		try {
			this.client = await getTwilioClient();
			const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

			if (whatsappNumber) {
				this.fromNumber = whatsappNumber.startsWith("whatsapp:")
					? whatsappNumber
					: `whatsapp:${whatsappNumber}`;
				this.isConfigured = true;
				console.log(
					"✅ WhatsApp Marketing service initialized via shared Twilio client",
				);
				console.log(`   From: ${this.fromNumber}`);
			} else {
				throw new Error("TWILIO_WHATSAPP_NUMBER missing");
			}
		} catch (error: any) {
			this.isConfigured = false;
			console.log(
				`⚠️ WhatsApp Marketing service not configured: ${error.message}`,
			);
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initPromise) {
			await this.initPromise;
		}
	}

	async isAvailable(): Promise<boolean> {
		await this.ensureInitialized();
		return this.isConfigured;
	}

	private formatWhatsAppNumber(mobile: string): string {
		const cleaned = mobile.replace(/\D/g, "");
		if (cleaned.startsWith("91") && cleaned.length === 12) {
			return `whatsapp:+${cleaned}`;
		}
		if (cleaned.length === 10) {
			return `whatsapp:+91${cleaned}`;
		}
		return `whatsapp:+${cleaned}`;
	}

	async sendTemplateMessage(
		to: string,
		templateType: keyof typeof MARKETING_TEMPLATES,
		variables: Record<string, string>,
	): Promise<WhatsAppMarketingResult> {
		await this.ensureInitialized();

		if (!this.isConfigured) {
			console.log(
				`📱 WhatsApp template to ${to.substring(0, 6)}**** (not configured)`,
			);
			return {
				success: false,
				error: "WhatsApp Marketing service not configured",
				usedTemplate: true,
			};
		}

		const template = MARKETING_TEMPLATES[templateType];
		if (!template || !template.contentSid) {
			console.log(
				`⚠️ Template ${templateType} not configured, falling back to freeform`,
			);
			return {
				success: false,
				error: `Template ${templateType} not configured. Set TWILIO_WA_TEMPLATE_${templateType.toUpperCase()} env var.`,
				usedTemplate: false,
			};
		}

		try {
			const toNumber = this.formatWhatsAppNumber(to);

			const messageOptions: any = {
				from: this.fromNumber,
				to: toNumber,
				contentSid: template.contentSid,
			};

			if (template.variables && template.variables.length > 0) {
				const indexedVars: Record<string, string> = {};
				template.variables.forEach((key, idx) => {
					indexedVars[String(idx + 1)] = variables[key] ?? "";
				});
				messageOptions.contentVariables = JSON.stringify(indexedVars);
			}

			console.log(
				`📱 Sending WhatsApp template (${templateType}) to ${toNumber.substring(0, 15)}***`,
			);

			const result = await this.client.messages.create(messageOptions);

			console.log(`✅ WhatsApp template message sent - SID: ${result.sid}`);

			return {
				success: true,
				messageSid: result.sid,
				status: result.status,
				usedTemplate: true,
			};
		} catch (error: any) {
			console.error("❌ Failed to send WhatsApp template:", error.message);
			return { success: false, error: error.message, usedTemplate: true };
		}
	}

	async sendMarketingMessage(
		to: string,
		templateType: keyof typeof MARKETING_TEMPLATES,
		variables: Record<string, string>,
		_fallbackMessage?: string,
	): Promise<WhatsAppMarketingResult> {
		const hasConsent = await this.hasMarketingConsent(to);
		if (!hasConsent) {
			console.log(
				`🚫 WhatsApp marketing blocked - no consent: ${to.substring(0, 6)}****`,
			);
			return {
				success: false,
				error: "User has not consented to marketing communications",
				usedTemplate: false,
			};
		}

		const templateResult = await this.sendTemplateMessage(
			to,
			templateType,
			variables,
		);

		if (!templateResult.success && !templateResult.usedTemplate) {
			console.log(
				`⚠️ WhatsApp marketing requires approved template - freeform fallback disabled for compliance`,
			);
		}

		return templateResult;
	}

	async hasMarketingConsent(mobile: string): Promise<boolean> {
		try {
			const cleaned = mobile.replace(/\D/g, "");
			const last10Digits = cleaned.slice(-10);

			const [user] = await db
				.select({ marketingConsent: users.marketingConsent })
				.from(users)
				.where(sql`${users.mobile} LIKE ${"%" + last10Digits}`)
				.limit(1);

			return user?.marketingConsent === true;
		} catch (error) {
			console.error("Error checking marketing consent:", error);
			return false;
		}
	}

	async hasUserInitiatedContact(phoneNumber: string): Promise<boolean> {
		try {
			const cleaned = phoneNumber.replace(/\D/g, "");
			let normalized = "";
			if (cleaned.startsWith("91") && cleaned.length === 12) {
				normalized = `+${cleaned}`;
			} else if (cleaned.length === 10) {
				normalized = `+91${cleaned}`;
			} else {
				normalized = `+${cleaned}`;
			}

			const [contact] = await db
				.select()
				.from(whatsappContacts)
				.where(eq(whatsappContacts.phoneNumber, normalized))
				.limit(1);

			return contact?.hasInitiatedContact ?? false;
		} catch (error) {
			console.error("Error checking WhatsApp contact status:", error);
			return false;
		}
	}

	async sendBulkTemplateMessages(
		recipients: Array<{ mobile: string; name?: string; userId?: string }>,
		templateType: keyof typeof MARKETING_TEMPLATES,
		variablesGenerator: (recipient: {
			mobile: string;
			name?: string;
		}) => Record<string, string>,
		campaignId?: string,
	): Promise<BulkWhatsAppResult> {
		const results: BulkWhatsAppResult = {
			totalRecipients: recipients.length,
			sent: 0,
			failed: 0,
			templateUsed: true,
			results: [],
		};

		for (const recipient of recipients) {
			const hasConsent = await this.hasMarketingConsent(recipient.mobile);
			if (!hasConsent) {
				console.log(
					`🚫 WhatsApp bulk skipped - no consent: ${recipient.mobile.substring(0, 6)}****`,
				);
				results.results.push({
					mobile: recipient.mobile,
					success: false,
					error: "User has not consented to marketing communications",
				});
				results.failed++;
				continue;
			}

			const variables = variablesGenerator(recipient);
			const result = await this.sendTemplateMessage(
				recipient.mobile,
				templateType,
				variables,
			);

			results.results.push({
				mobile: recipient.mobile,
				success: result.success,
				messageSid: result.messageSid,
				error: result.error,
			});

			if (result.success) {
				results.sent++;
			} else {
				results.failed++;
			}

			await new Promise((resolve) => setTimeout(resolve, 200));
		}

		console.log(
			`📊 Bulk WhatsApp complete: ${results.sent}/${results.totalRecipients} sent, ${results.failed} failed`,
		);

		if (campaignId) {
			await this.updateCampaignStats(campaignId, results, recipients);
		}

		return results;
	}

	private async updateCampaignStats(
		campaignId: string,
		results: BulkWhatsAppResult,
		recipients: Array<{ mobile: string; name?: string; userId?: string }>,
	): Promise<void> {
		try {
			await db
				.update(marketingCampaigns)
				.set({
					sentCount: results.sent,
					status: "sent",
					updatedAt: new Date(),
				})
				.where(eq(marketingCampaigns.id, campaignId));

			for (let i = 0; i < recipients.length; i++) {
				const recipient = recipients[i];
				const result = results.results[i];

				await db
					.insert(campaignRecipients)
					.values({
						campaignId,
						userId: recipient.userId,
						mobile: recipient.mobile,
						fullName: recipient.name,
						status: result.success ? "sent" : "failed",
						sentAt: result.success ? new Date() : undefined,
						errorMessage: result.error,
					})
					.onConflictDoNothing();
			}
		} catch (error) {
			console.error("Error updating campaign stats:", error);
		}
	}

	async sendIPOAlert(
		to: string,
		details: {
			companyName: string;
			openDate: string;
			priceMin: number;
			priceMax: number;
		},
	): Promise<WhatsAppMarketingResult> {
		return this.sendMarketingMessage(
			to,
			"ipo_alert",
			{
				company_name: details.companyName,
				open_date: details.openDate,
				price_range: `₹${details.priceMin} - ₹${details.priceMax}`,
			},
			`🎯 FintekPro IPO Alert!\n\n${details.companyName} IPO opens ${details.openDate}.\nPrice: ₹${details.priceMin}-₹${details.priceMax}\n\nApply now on FintekPro!`,
		);
	}

	async sendPortfolioUpdate(
		to: string,
		details: { value: string; changePercent: string },
	): Promise<WhatsAppMarketingResult> {
		return this.sendMarketingMessage(
			to,
			"portfolio_update",
			{
				portfolio_value: details.value,
				change_percent: details.changePercent,
			},
			`📊 FintekPro Portfolio Update\n\nYour portfolio: ${details.value}\nToday: ${details.changePercent}%`,
		);
	}

	async sendKYCReminder(
		to: string,
		details: { customerName: string; pendingStep: string },
	): Promise<WhatsAppMarketingResult> {
		return this.sendMarketingMessage(
			to,
			"kyc_reminder",
			{
				customer_name: details.customerName,
				pending_step: details.pendingStep,
			},
			`🔐 Hi ${details.customerName}!\n\nComplete your KYC (${details.pendingStep}) to unlock all FintekPro features.`,
		);
	}

	async sendPromotion(
		to: string,
		details: { offerTitle: string; offerDetails: string; ctaLink?: string },
	): Promise<WhatsAppMarketingResult> {
		return this.sendMarketingMessage(
			to,
			"promotion",
			{
				offer_title: details.offerTitle,
				offer_details: details.offerDetails,
				cta_link: details.ctaLink || "https://fintekpro.com",
			},
			`🎁 FintekPro Special Offer!\n\n${details.offerTitle}\n\n${details.offerDetails}`,
		);
	}

	async sendMutualFundPromo(
		to: string,
		details: { fundName: string; returns: string; minInvestment: string },
	): Promise<WhatsAppMarketingResult> {
		return this.sendMarketingMessage(
			to,
			"mutual_fund",
			{
				fund_name: details.fundName,
				returns: details.returns,
				min_investment: details.minInvestment,
			},
			`📈 FintekPro MF Update!\n\n${details.fundName} delivered ${details.returns} returns.\nStart SIP from ${details.minInvestment}/month.`,
		);
	}

	async sendDividendAlert(
		to: string,
		details: { companyName: string; dividendAmount: string; exDate: string },
	): Promise<WhatsAppMarketingResult> {
		return this.sendMarketingMessage(
			to,
			"dividend_alert",
			{
				company_name: details.companyName,
				dividend_amount: details.dividendAmount,
				ex_date: details.exDate,
			},
			`💰 FintekPro Dividend Alert!\n\n${details.companyName} dividend: ${details.dividendAmount}\nEx-date: ${details.exDate}`,
		);
	}

	getAvailableTemplates(): Array<{
		type: string;
		name: string;
		configured: boolean;
		category: string;
	}> {
		return Object.entries(MARKETING_TEMPLATES).map(([type, template]) => ({
			type,
			name: template.name,
			configured: !!template.contentSid,
			category: template.category,
		}));
	}

	getStatus(): {
		configured: boolean;
		fromNumber: string;
		templates: Array<{ type: string; configured: boolean }>;
		capabilities: string[];
	} {
		return {
			configured: this.isConfigured,
			fromNumber: this.fromNumber || "Not configured",
			templates: this.getAvailableTemplates(),
			capabilities: this.isConfigured
				? [
						"template_messages",
						"bulk_marketing",
						"ipo_alerts",
						"portfolio_updates",
						"kyc_reminders",
						"promotions",
						"dividend_alerts",
					]
				: [],
		};
	}
}

export const whatsAppMarketingService = new WhatsAppMarketingService();
