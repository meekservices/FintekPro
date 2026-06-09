/**
 * Zoho Campaigns API Service
 *
 * Email marketing platform for creating, sending, and tracking campaigns.
 * Features: email campaigns, subscriber list management, analytics, automation.
 *
 * API Documentation: https://www.zoho.com/campaigns/help/api/v1.1/
 */

import axios, { AxiosInstance } from "axios";

interface ZohoCampaignsConfig {
	accessToken: string;
	refreshToken?: string;
	clientId?: string;
	clientSecret?: string;
	datacenter?: string; // 'com' | 'eu' | 'in' | 'com.au' | 'jp'
}

interface EmailCampaign {
	campaignKey: string;
	campaignName: string;
	subject: string;
	fromEmail: string;
	fromName?: string;
	replyTo?: string;
	htmlContent: string;
	textContent?: string;
	status: "draft" | "scheduled" | "sent" | "sending" | "failed";
	scheduledTime?: string;
	listKeys?: string[];
	segmentKeys?: string[];
}

interface ContactList {
	listKey: string;
	listName: string;
	description?: string;
	contactCount: number;
	createdTime: string;
	modifiedTime: string;
}

interface Contact {
	emailAddress: string;
	firstName?: string;
	lastName?: string;
	phoneNumber?: string;
	company?: string;
	customFields?: Record<string, string>;
}

interface CampaignStats {
	campaignKey: string;
	campaignName: string;
	sentCount: number;
	deliveredCount: number;
	bouncedCount: number;
	openedCount: number;
	clickedCount: number;
	unsubscribedCount: number;
	spamReportCount: number;
	openRate: number;
	clickRate: number;
	bounceRate: number;
}

export class ZohoCampaignsService {
	private client: AxiosInstance;
	private accessToken: string;
	private refreshToken?: string;
	private clientId?: string;
	private clientSecret?: string;
	private datacenter: string;

	constructor(config: ZohoCampaignsConfig) {
		this.accessToken = config.accessToken;
		this.refreshToken = config.refreshToken;
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;
		this.datacenter = config.datacenter || "com";

		const baseUrl = `https://campaigns.zoho.${this.datacenter}/api/v1.1`;

		this.client = axios.create({
			baseURL: baseUrl,
			timeout: 30000,
			headers: {
				Authorization: `Zoho-oauthtoken ${this.accessToken}`,
				"Content-Type": "application/json",
			},
		});

		// Add response interceptor for token refresh
		this.client.interceptors.response.use(
			(response) => response,
			async (error) => {
				if (error.response?.status === 401 && this.refreshToken) {
					await this.refreshAccessToken();
					// Retry original request with new token
					error.config.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;
					return this.client.request(error.config);
				}
				return Promise.reject(error);
			},
		);
	}

	/**
	 * Refresh OAuth access token
	 */
	private async refreshAccessToken(): Promise<void> {
		if (!this.refreshToken || !this.clientId || !this.clientSecret) {
			throw new Error("Missing OAuth credentials for token refresh");
		}

		try {
			const response = await axios.post(
				`https://accounts.zoho.${this.datacenter}/oauth/v2/token`,
				null,
				{
					params: {
						refresh_token: this.refreshToken,
						client_id: this.clientId,
						client_secret: this.clientSecret,
						grant_type: "refresh_token",
					},
				},
			);

			this.accessToken = response.data.access_token;
			this.client.defaults.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;

			console.log("✅ Zoho Campaigns access token refreshed");
		} catch (error) {
			console.error("❌ Failed to refresh Zoho access token:", error);
			throw error;
		}
	}

	/**
	 * Get all contact lists
	 */
	async getContactLists(): Promise<ContactList[]> {
		try {
			const response = await this.client.get("/lists");
			return response.data.list_of_details || [];
		} catch (error) {
			console.error("❌ Error fetching Zoho contact lists:", error);
			return [];
		}
	}

	/**
	 * Create a new contact list
	 */
	async createContactList(
		name: string,
		description?: string,
	): Promise<string | null> {
		try {
			const response = await this.client.post("/lists", {
				listname: name,
				description: description || "",
			});
			return response.data.list_key;
		} catch (error) {
			console.error("❌ Error creating Zoho contact list:", error);
			return null;
		}
	}

	/**
	 * Add contact to a list
	 */
	async addContact(listKey: string, contact: Contact): Promise<boolean> {
		try {
			const contactData = {
				contactinfo: {
					"Contact Email": contact.emailAddress,
					"First Name": contact.firstName || "",
					"Last Name": contact.lastName || "",
					"Phone Number": contact.phoneNumber || "",
					Company: contact.company || "",
					...contact.customFields,
				},
			};

			await this.client.post(`/lists/${listKey}/contacts`, contactData);
			return true;
		} catch (error) {
			console.error("❌ Error adding contact to Zoho list:", error);
			return false;
		}
	}

	/**
	 * Add multiple contacts to a list
	 */
	async addContactsBulk(
		listKey: string,
		contacts: Contact[],
	): Promise<{
		successCount: number;
		failedCount: number;
	}> {
		try {
			const contactsData = contacts.map((contact) => ({
				"Contact Email": contact.emailAddress,
				"First Name": contact.firstName || "",
				"Last Name": contact.lastName || "",
				"Phone Number": contact.phoneNumber || "",
				Company: contact.company || "",
				...contact.customFields,
			}));

			const response = await this.client.post(`/lists/${listKey}/contacts`, {
				contactinfo: contactsData,
			});

			return {
				successCount: response.data.success_count || 0,
				failedCount: response.data.failed_count || 0,
			};
		} catch (error) {
			console.error("❌ Error bulk adding contacts to Zoho list:", error);
			return { successCount: 0, failedCount: contacts.length };
		}
	}

	/**
	 * Create email campaign
	 */
	async createCampaign(campaign: {
		name: string;
		subject: string;
		fromEmail: string;
		fromName?: string;
		replyTo?: string;
		htmlContent: string;
		textContent?: string;
		listKeys?: string[];
	}): Promise<string | null> {
		try {
			const response = await this.client.post("/campaigns", {
				campaign_name: campaign.name,
				subject: campaign.subject,
				from_email: campaign.fromEmail,
				from_name: campaign.fromName || campaign.fromEmail,
				reply_to: campaign.replyTo || campaign.fromEmail,
				html_content: campaign.htmlContent,
				text_content: campaign.textContent || "",
				list_keys: campaign.listKeys || [],
			});

			return response.data.campaign_key;
		} catch (error) {
			console.error("❌ Error creating Zoho campaign:", error);
			return null;
		}
	}

	/**
	 * Schedule a campaign
	 */
	async scheduleCampaign(
		campaignKey: string,
		scheduledTime: Date,
	): Promise<boolean> {
		try {
			await this.client.post(`/campaigns/${campaignKey}/schedule`, {
				schedule_time: scheduledTime.toISOString(),
			});
			return true;
		} catch (error) {
			console.error("❌ Error scheduling Zoho campaign:", error);
			return false;
		}
	}

	/**
	 * Send campaign immediately
	 */
	async sendCampaign(campaignKey: string): Promise<boolean> {
		try {
			await this.client.post(`/campaigns/${campaignKey}/send`);
			return true;
		} catch (error) {
			console.error("❌ Error sending Zoho campaign:", error);
			return false;
		}
	}

	/**
	 * Get campaign statistics
	 */
	async getCampaignStats(campaignKey: string): Promise<CampaignStats | null> {
		try {
			const response = await this.client.get(`/campaigns/${campaignKey}/stats`);
			const data = response.data;

			return {
				campaignKey,
				campaignName: data.campaign_name || "",
				sentCount: data.sent_count || 0,
				deliveredCount: data.delivered_count || 0,
				bouncedCount: data.bounced_count || 0,
				openedCount: data.opened_count || 0,
				clickedCount: data.clicked_count || 0,
				unsubscribedCount: data.unsubscribed_count || 0,
				spamReportCount: data.spam_report_count || 0,
				openRate: data.open_rate || 0,
				clickRate: data.click_rate || 0,
				bounceRate: data.bounce_rate || 0,
			};
		} catch (error) {
			console.error("❌ Error fetching Zoho campaign stats:", error);
			return null;
		}
	}

	/**
	 * Get all campaigns
	 */
	async getCampaigns(
		status?: "draft" | "scheduled" | "sent",
	): Promise<EmailCampaign[]> {
		try {
			const params = status ? { status } : {};
			const response = await this.client.get("/campaigns", { params });
			return response.data.list_of_campaigns || [];
		} catch (error) {
			console.error("❌ Error fetching Zoho campaigns:", error);
			return [];
		}
	}

	/**
	 * Get campaign details
	 */
	async getCampaignDetails(campaignKey: string): Promise<EmailCampaign | null> {
		try {
			const response = await this.client.get(`/campaigns/${campaignKey}`);
			return response.data;
		} catch (error) {
			console.error("❌ Error fetching Zoho campaign details:", error);
			return null;
		}
	}

	/**
	 * Delete a campaign
	 */
	async deleteCampaign(campaignKey: string): Promise<boolean> {
		try {
			await this.client.delete(`/campaigns/${campaignKey}`);
			return true;
		} catch (error) {
			console.error("❌ Error deleting Zoho campaign:", error);
			return false;
		}
	}

	/**
	 * Get campaign click report
	 */
	async getCampaignClicks(campaignKey: string): Promise<
		Array<{
			linkUrl: string;
			clickCount: number;
		}>
	> {
		try {
			const response = await this.client.get(
				`/campaigns/${campaignKey}/clicks`,
			);
			return response.data.click_details || [];
		} catch (error) {
			console.error("❌ Error fetching Zoho campaign clicks:", error);
			return [];
		}
	}

	/**
	 * Get unsubscribed contacts from campaign
	 */
	async getUnsubscribes(campaignKey: string): Promise<string[]> {
		try {
			const response = await this.client.get(
				`/campaigns/${campaignKey}/unsubscribes`,
			);
			return response.data.unsubscribed_emails || [];
		} catch (error) {
			console.error("❌ Error fetching Zoho unsubscribes:", error);
			return [];
		}
	}

	/**
	 * Create and send test campaign
	 */
	async sendTestEmail(
		campaignKey: string,
		testEmails: string[],
	): Promise<boolean> {
		try {
			await this.client.post(`/campaigns/${campaignKey}/test`, {
				test_emails: testEmails,
			});
			return true;
		} catch (error) {
			console.error("❌ Error sending Zoho test email:", error);
			return false;
		}
	}

	/**
	 * Sync campaign metrics from Zoho to our database
	 */
	async syncCampaignMetrics(
		campaignKey: string,
	): Promise<CampaignStats | null> {
		const stats = await this.getCampaignStats(campaignKey);

		if (stats) {
			console.log(`📊 Synced metrics for campaign ${campaignKey}:`, {
				sent: stats.sentCount,
				opened: stats.openedCount,
				clicked: stats.clickedCount,
				openRate: `${stats.openRate}%`,
				clickRate: `${stats.clickRate}%`,
			});
		}

		return stats;
	}

	/**
	 * Send festival greeting campaign
	 * Creates a temporary mailing list, adds recipients, creates and sends the campaign
	 */
	async sendFestivalGreeting(options: {
		festivalName: string;
		subject: string;
		htmlContent: string;
		recipients: Array<{ email: string; name: string }>;
		fromEmail?: string;
		fromName?: string;
	}): Promise<{ campaignKey: string; sentCount: number }> {
		const timestamp = Date.now();
		const listName = `Festival_${options.festivalName.replace(/\s+/g, "_")}_${timestamp}`;

		try {
			// Create a temporary mailing list
			const listKey = await this.createContactList(
				listName,
				`Festival greeting list for ${options.festivalName}`,
			);

			if (!listKey) {
				throw new Error("Failed to create mailing list");
			}

			// Add recipients to the list using bulk add
			const contacts: Contact[] = options.recipients.map((r) => ({
				emailAddress: r.email,
				firstName: r.name.split(" ")[0] || "",
				lastName: r.name.split(" ").slice(1).join(" ") || "",
			}));

			await this.addContactsBulk(listKey, contacts);

			// Create the campaign
			const campaignName = `${options.festivalName} Greetings - ${new Date().toLocaleDateString()}`;
			const campaignKey = await this.createCampaign({
				name: campaignName,
				subject: options.subject,
				fromEmail: options.fromEmail || "noreply@fintekpro.com",
				fromName: options.fromName || "FintekPro",
				htmlContent: options.htmlContent,
				listKeys: [listKey],
			});

			if (!campaignKey) {
				throw new Error("Failed to create campaign");
			}

			// Schedule for immediate send (1 minute from now)
			const sendTime = new Date(Date.now() + 60000);
			await this.scheduleCampaign(campaignKey, sendTime);

			console.log(
				`✅ Festival greeting campaign created: ${campaignKey} for ${options.recipients.length} recipients`,
			);

			return {
				campaignKey,
				sentCount: options.recipients.length,
			};
		} catch (error) {
			console.error("❌ Error sending festival greeting via Zoho:", error);
			throw error;
		}
	}
}

let zohoCampaignsService: ZohoCampaignsService | null = null;
export async function initZohoCampaignsService(): Promise<ZohoCampaignsService | null> {
	if (zohoCampaignsService) return zohoCampaignsService;

	const clientId = process.env.ZOHO_CLIENT_ID;
	const clientSecret = process.env.ZOHO_CLIENT_SECRET;
	const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
	const datacenter = process.env.ZOHO_DATACENTER || "in";

	if (!clientId || !clientSecret || !refreshToken) {
		console.warn(
			"⚠️ Zoho OAuth credentials not configured. Email campaigns will not be available.",
		);
		return null;
	}

	try {
		const response = await axios.post(
			`https://accounts.zoho.${datacenter}/oauth/v2/token`,
			null,
			{
				params: {
					refresh_token: refreshToken,
					client_id: clientId,
					client_secret: clientSecret,
					grant_type: "refresh_token",
				},
			},
		);

		if (!response.data?.access_token) {
			console.error(
				"❌ Zoho Campaigns: Failed to obtain access token from refresh token",
			);
			return null;
		}

		zohoCampaignsService = new ZohoCampaignsService({
			accessToken: response.data.access_token,
			refreshToken,
			clientId,
			clientSecret,
			datacenter,
		});

		console.log(
			"✅ Zoho Campaigns service initialized (using shared refresh token)",
		);
		return zohoCampaignsService;
	} catch (error: any) {
		console.error(
			"❌ Zoho Campaigns initialization failed:",
			error.response?.data || error.message,
		);
		return null;
	}
}

export function getZohoCampaignsService(): ZohoCampaignsService {
	if (!zohoCampaignsService) {
		const accessToken = process.env.ZOHO_CAMPAIGNS_ACCESS_TOKEN;
		const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
		const clientId = process.env.ZOHO_CLIENT_ID;
		const clientSecret = process.env.ZOHO_CLIENT_SECRET;

		if (!accessToken && !refreshToken) {
			console.warn(
				"⚠️ Zoho Campaigns: No access token or refresh token configured. Email campaigns will not be available.",
			);
			throw new Error("Zoho Campaigns credentials not configured");
		}

		if (accessToken) {
			zohoCampaignsService = new ZohoCampaignsService({
				accessToken,
				refreshToken: refreshToken,
				clientId,
				clientSecret,
				datacenter: process.env.ZOHO_DATACENTER || "in",
			});
			console.log(
				"✅ Zoho Campaigns service initialized (direct access token)",
			);
		} else {
			throw new Error(
				"Zoho Campaigns not yet initialized. Call initZohoCampaignsService() first or set ZOHO_CAMPAIGNS_ACCESS_TOKEN.",
			);
		}
	}

	return zohoCampaignsService;
}
