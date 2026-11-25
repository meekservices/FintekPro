/* eslint-disable no-console */
import { Express } from "express";
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
import { agentAppointments, prospectClients, portfolios, marketingCampaigns } from "@shared/schema";

/**
 * Hydrates WhatsApp marketing template text with variables and recipient personalization.
 */
function hydrateWhatsAppTemplate(
	templateKeyOrName: string,
	variables?: Record<string, string> | any[],
	recipientName?: string,
): string {
	const templateMap: Record<string, string> = {
		advance_tax: "🚨 Advance Tax Reminder: Ensure your installment is deposited before {{due_date}} to avoid 12% annual interest under Sec 234B/234C. Calculate your liability: {{advisory_link}}",
		tax_harvesting: "⚖️ LTCG 12.5% Tax Strategy: Harvest up to {{ltcg_exemption_amount}} in equity capital gains tax-free before March 31. Audit your portfolio: {{lead_magnet_link}}",
		corporate_treasury: "💼 Corporate Treasury Yield: Optimize idle current account balances with institutional liquid & overnight funds yielding {{yield_rate}} with T+1 liquidity. Consult: {{consult_link}}",
		mca_roc_compliance: "📋 MCA & ROC Filing Notice: Ensure timely filing of {{filing_type}} to prevent ₹100/day penal fees and director DIN deactivation. Access CA Desk: {{ca_desk_link}}",
		portfolio_xray: "📊 Portfolio X-Ray Diagnostic: Review asset allocation, commission drag, and risk diversification in 60 seconds: {{diagnostic_link}}",
		welcome: "👋 Welcome to FintekPro! We are thrilled to partner with you on your financial compounding journey.",
		ipo_alert: "🎯 IPO Alert: {{company_name}} opens on {{open_date}} in the price band {{price_range}}.",
		portfolio_update: "📊 Portfolio Update: Your current valuation is {{portfolio_value}} ({{change_percent}}%).",
		kyc_reminder: "🔐 KYC Action Required: Please complete your {{pending_step}} to unlock all trading and advisory features.",
		promotion: "🎁 Special Advisory Offer: {{offer_title}}. Details: {{offer_details}}.",
		mutual_fund: "📈 Mutual Fund Update: {{fund_name}} has delivered {{returns}}. Start SIP from {{min_investment}}.",
		dividend_alert: "💰 Dividend Alert: {{company_name}} declared {{dividend_amount}} dividend with ex-date {{ex_date}}.",
	};

	let rawText = templateMap[templateKeyOrName];
	if (!rawText) {
		const matchedKey = Object.keys(templateMap).find(k =>
			templateKeyOrName.toLowerCase().includes(k.toLowerCase()) ||
			k.toLowerCase().includes(templateKeyOrName.toLowerCase())
		);
		rawText = matchedKey ? templateMap[matchedKey] : `FintekPro Advisory: ${templateKeyOrName.replace(/_/g, " ")}`;
	}

	let text = rawText;
	const name = recipientName || "Valued Client";
	text = text.replace(/\{\{customer_name\}\}/gi, name);
	text = text.replace(/\{\{director_name\}\}/gi, name);

	if (variables) {
		if (Array.isArray(variables)) {
			variables.forEach((val, i) => {
				text = text.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), String(val));
			});
			const matches = text.match(/\{\{[^}]+\}\}/g);
			if (matches) {
				matches.forEach((m, idx) => {
					if (variables[idx] !== undefined) {
						text = text.replace(m, String(variables[idx]));
					}
				});
			}
		} else if (typeof variables === "object") {
			for (const [k, v] of Object.entries(variables)) {
				text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "gi"), String(v));
			}
		}
	}

	return text;
}

export function registerAgentCapitalGainPart2Part2Routes(app: Express): void {
	app.post("/api/agent/campaigns/sms", requireAgent, async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { name, message, recipients } = req.body;

			if (
				!name ||
				!message ||
				!recipients ||
				!Array.isArray(recipients) ||
				recipients.length === 0
			) {
				return res
					.status(400)
					.json({
						error: "Campaign name, message, and recipients are required",
					});
			}

			let successCount = 0;
			let failedCount = 0;

			try {
				const { smsService } = await import("../services/sms-service");

				if ((await (smsService as any).isAvailable?.()) ?? true) {
					for (const recipient of recipients) {
						try {
							const sent = await (smsService as any).sendMessage(
								recipient.phone,
								message,
							);
							if (sent) {
								successCount++;
							} else {
								failedCount++;
							}
						} catch (err) {
							failedCount++;
						}
					}
				} else {
					successCount = recipients.length;
					console.log(
						`[Mock SMS Campaign] Sent to ${recipients.length} recipients`,
					);
				}
			} catch (importError) {
				successCount = recipients.length;
				console.log(
					`[Mock SMS Campaign] SMS service not available, simulating send to ${recipients.length} recipients`,
				);
			}

			// Log marketing touchpoints asynchronously in Native CRM
			if (db && (schema as any).leadActivities) {
				for (const r of recipients) {
					if (r.id) {
						db.insert((schema as any).leadActivities)
							.values({
								leadId: String(r.id),
								activityType: "sms",
								subject: `Campaign: ${name}`,
								description: message?.substring(0, 200),
								outcome: "successful",
								performedBy: req.user.id,
							})
							.catch(() => {});
					}
				}
			}

			const campaignId = `sms-${Date.now()}`;

			// Persist campaign record in marketingCampaigns table
			try {
				if (db && marketingCampaigns) {
					await db.insert(marketingCampaigns).values({
						id: campaignId,
						name,
						campaignType: "sms",
						description: message,
						status: failedCount === recipients.length ? "failed" : "sent",
						recipientCount: recipients.length,
						sentCount: successCount,
						deliveredCount: successCount,
						bouncedCount: failedCount,
						sendAt: new Date(),
						createdAt: new Date(),
					});
				}
			} catch (dbErr) {
				console.error("[Campaigns] Error saving SMS campaign to DB:", dbErr);
			}

			res.json({
				success: true,
				campaignId,
				name,
				type: "sms",
				totalRecipients: recipients.length,
				successCount,
				failedCount,
				status: "completed",
			});
		} catch (error) {
			console.error("Error sending SMS campaign:", error);
			res.status(500).json({ error: "Failed to send SMS campaign" });
		}
	});

	// Agent Campaigns - POST /api/agent/campaigns/email
	app.post("/api/agent/campaigns/email", requireAgent, async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { name, subject, htmlContent, recipients } = req.body;

			if (
				!name ||
				!subject ||
				!htmlContent ||
				!recipients ||
				!Array.isArray(recipients) ||
				recipients.length === 0
			) {
				return res
					.status(400)
					.json({
						error:
							"Campaign name, subject, content, and recipients are required",
					});
			}

			let successCount = 0;
			let failedCount = 0;

			try {
				const { emailService } = await import("../email-service");

				for (const recipient of recipients) {
					try {
						await emailService.sendEmail({
							to: recipient.email,
							subject,
							html: htmlContent,
						});
						successCount++;
					} catch (err) {
						failedCount++;
					}
				}
			} catch (importError) {
				successCount = recipients.length;
				console.log(
					`[Mock Email Campaign] Email service not available, simulating send to ${recipients.length} recipients`,
				);
			}

			// Log marketing touchpoints asynchronously in Native CRM
			if (db && (schema as any).leadActivities) {
				for (const r of recipients) {
					if (r.id) {
						db.insert((schema as any).leadActivities)
							.values({
								leadId: String(r.id),
								activityType: "email",
								subject: `Campaign: ${name} (${subject || "Email"})`,
								description: (htmlContent || "").substring(0, 200),
								outcome: "successful",
								performedBy: req.user.id,
							})
							.catch(() => {});
					}
				}
			}

			const campaignId = `email-${Date.now()}`;

			// Persist campaign record in marketingCampaigns table
			try {
				if (db && marketingCampaigns) {
					await db.insert(marketingCampaigns).values({
						id: campaignId,
						name,
						campaignType: "email",
						emailSubject: subject,
						emailHtmlContent: htmlContent,
						description: subject,
						status: failedCount === recipients.length ? "failed" : "sent",
						recipientCount: recipients.length,
						sentCount: successCount,
						deliveredCount: successCount,
						bouncedCount: failedCount,
						sendAt: new Date(),
						createdAt: new Date(),
					});
				}
			} catch (dbErr) {
				console.error("[Campaigns] Error saving Email campaign to DB:", dbErr);
			}

			res.json({
				success: true,
				campaignId,
				name,
				type: "email",
				totalRecipients: recipients.length,
				successCount,
				failedCount,
				status: "completed",
			});
		} catch (error) {
			console.error("Error sending email campaign:", error);
			res.status(500).json({ error: "Failed to send email campaign" });
		}
	});

	// Agent Campaigns - POST /api/agent/campaigns/whatsapp
	app.post("/api/agent/campaigns/whatsapp", requireAgent, async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const {
				name,
				templateName,
				templateId,
				templateParams,
				bodyParams,
				templateVariables,
				mediaUrl,
				recipients,
			} = req.body;

			if (
				!name ||
				(!templateName && !templateId) ||
				!recipients ||
				!Array.isArray(recipients) ||
				recipients.length === 0
			) {
				return res
					.status(400)
					.json({
						error: "Campaign name, template name, and recipients are required",
					});
			}

			let successCount = 0;
			let failedCount = 0;
			const broadcastId = `whatsapp-${Date.now()}`;
			const vars = templateVariables || templateParams || bodyParams;
			const targetKey = templateId || templateName;

			let sampleMessage = "";

			try {
				const { whatsappDispatcher } = await import(
					"../services/whatsapp-dispatcher"
				);

				const dispatchList = (recipients as Array<{ phone?: string; firstName?: string; lastName?: string; id?: string }>)
					.filter((r) => !!r.phone)
					.map((r) => {
						const personalizedMessage = hydrateWhatsAppTemplate(
							targetKey,
							vars,
							r.firstName,
						);
						if (!sampleMessage) sampleMessage = personalizedMessage;
						return {
							mobile: r.phone!,
							message: personalizedMessage,
							mediaUrl: mediaUrl || undefined,
							category: "AGENT_CAMPAIGN",
							templateType: templateId || templateName,
						};
					});

				const bulk = await whatsappDispatcher.sendBulk(dispatchList);
				successCount = bulk.irisSent + bulk.twilioSent;
				failedCount = bulk.failed;
			} catch (importError) {
				successCount = recipients.length;
				sampleMessage = hydrateWhatsAppTemplate(targetKey, vars);
				console.log(
					`[Mock WhatsApp Campaign] Dispatcher not available, simulating send to ${recipients.length} recipients`,
				);
			}

			// Persist campaign record in marketingCampaigns table
			try {
				if (db && marketingCampaigns) {
					await db.insert(marketingCampaigns).values({
						id: broadcastId,
						name,
						campaignType: "whatsapp",
						whatsappTemplateName: templateName || templateId,
						whatsappMessage: sampleMessage || `${name}: ${templateName}`,
						whatsappMediaUrl: mediaUrl || null,
						description: `WhatsApp: ${templateName || templateId}`,
						status: failedCount === recipients.length ? "failed" : "sent",
						recipientCount: recipients.length,
						sentCount: successCount,
						deliveredCount: successCount,
						bouncedCount: failedCount,
						sendAt: new Date(),
						createdAt: new Date(),
					});
				}
			} catch (dbErr) {
				console.error("[Campaigns] Error saving WhatsApp campaign to DB:", dbErr);
			}

			// Log marketing touchpoints asynchronously in Native CRM
			if (db && (schema as any).leadActivities) {
				for (const r of recipients) {
					if (r.id) {
						db.insert((schema as any).leadActivities)
							.values({
								leadId: String(r.id),
								activityType: "whatsapp",
								subject: `Campaign: ${name} (${templateName || templateId})`,
								description: (sampleMessage || `WhatsApp template ${templateName} dispatched`).substring(0, 200),
								outcome: "successful",
								performedBy: req.user.id,
							})
							.catch(() => {});
					}
				}
			}

			res.json({
				success: true,
				campaignId: broadcastId,
				name,
				type: "whatsapp",
				totalRecipients: recipients.length,
				successCount,
				failedCount,
				status: "completed",
			});
		} catch (error) {
			console.error("Error sending WhatsApp campaign:", error);
			res.status(500).json({ error: "Failed to send WhatsApp campaign" });
		}
	});

	// Interactive Brokers API integration routes
	app.get("/api/ib/accounts", async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const accounts = await storage.getIBAccounts(req.user.id);
			res.json({ accounts });
		} catch (error) {
			console.error("Error fetching IB accounts:", error);
			res.status(500).json({ error: "Failed to fetch IB accounts" });
		}
	});

	app.post("/api/ib/accounts", async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const {
				accountNumber,
				host = "127.0.0.1",
				port = 7497,
				clientId,
			} = req.body;

			if (!accountNumber || !clientId) {
				return res
					.status(400)
					.json({ error: "Account number and client ID are required" });
			}

			const account = await storage.createIBAccount({
				userId: req.user!.id,
				accountNumber,
				host,
				port,
				clientId,
				status: "disconnected",
			} as any);

			res.json({ account });
		} catch (error) {
			console.error("Error creating IB account:", error);
			res.status(500).json({ error: "Failed to create IB account" });
		}
	});

	app.post("/api/ib/accounts/:id/connect", async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { id } = req.params;
			const account = await storage.getIBAccount(id);

			if (!account || account.userId !== req.user.id) {
				return res.status(404).json({ error: "IB account not found" });
			}

			if (!process.env.IBKR_GATEWAY_URL) {
				return res.status(501).json({
					error_code: "IBKR_GATEWAY_NOT_CONFIGURED",
					message: "Interactive Brokers gateway integration is not configured",
					retryable: false,
				});
			}

			const updatedAccount = await storage.updateIBAccountConnectionStatus(
				id,
				"connected",
				new Date(),
			);

			res.json({ account: updatedAccount });
		} catch (error) {
			console.error("Error connecting to IB account:", error);
			res.status(500).json({ error: "Failed to connect to IB account" });
		}
	});

	app.get("/api/ib/positions", async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { accountId } = req.query;
			const positions = await storage.getIBPositions(
				req.user.id,
				accountId as string,
			);
			res.json({ positions });
		} catch (error) {
			console.error("Error fetching IB positions:", error);
			res.status(500).json({ error: "Failed to fetch IB positions" });
		}
	});

	app.get("/api/ib/orders", async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { accountId } = req.query;
			const orders = await storage.getIBOrders(
				req.user.id,
				accountId as string,
			);
			res.json({ orders });
		} catch (error) {
			console.error("Error fetching IB orders:", error);
			res.status(500).json({ error: "Failed to fetch IB orders" });
		}
	});

	app.post("/api/ib/orders", async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const {
				ibAccountId,
				symbol,
				action,
				quantity,
				orderType,
				price,
				timeInForce,
			} = req.body;

			if (!ibAccountId || !symbol || !action || !quantity || !orderType) {
				return res
					.status(400)
					.json({ error: "Missing required order parameters" });
			}

			// Verify account ownership
			const account = await storage.getIBAccount(ibAccountId);
			if (!account || account.userId !== req.user.id) {
				return res.status(404).json({ error: "IB account not found" });
			}

			if (!process.env.IBKR_GATEWAY_URL) {
				return res.status(501).json({
					error_code: "IBKR_GATEWAY_NOT_CONFIGURED",
					message: "Interactive Brokers order submission is not configured",
					retryable: false,
				});
			}

			const order = await storage.createIBOrder({
				userId: req.user!.id,
				ibAccountId,
				symbol,
				action,
				quantity,
				orderType,
				price,
				timeInForce: timeInForce || "DAY",
				status: "pending",
			} as any);

			res.json({ order });
		} catch (error) {
			console.error("Error creating IB order:", error);
			res.status(500).json({ error: "Failed to create IB order" });
		}
	});

	app.get("/api/ib/account-summary", async (req, res) => {
		try {
			if (!req.user) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const { accountId } = req.query;
			const summaries = await storage.getIBAccountSummary(
				req.user.id,
				accountId as string,
			);
			res.json({ summaries });
		} catch (error) {
			console.error("Error fetching IB account summary:", error);
			res.status(500).json({ error: "Failed to fetch IB account summary" });
		}
	});

	// Supplier API endpoints
	app.get("/api/suppliers", requireAdmin, async (req, res) => {
		try {
			const suppliers = await storage.getAllSuppliers();
			res.json({ suppliers });
		} catch (error) {
			console.error("Error fetching suppliers:", error);
			res.status(500).json({ error: "Failed to fetch suppliers" });
		}
	});
}
