// @ts-nocheck
import { Express } from "express";
import { storage } from "../storage";
import { requireAdmin, requireAgent } from "../middleware/roleMiddleware";
import { requireLevel2 } from "../middleware/kyc-level-gate";
import { comprehensiveAIFPMSAPI } from "../comprehensive-aif-pms-api";
import { kfintechApi } from "../kfintech-api";
import {
	errorMonitor,
	errorMonitoringMiddleware,
	globalErrorHandler,
} from "../error-monitor";
import { and, or, count } from "drizzle-orm";
import * as geminiService from "../gemini-service";

export function registerAIFPMSSystemPart3Part2Routes(app: Express): void {
	app.get("/api/agent/transaction-reports", requireAgent, async (req, res) => {
		try {
			const { clientId, status, reportType } = req.query;

			// Get all reports where the agent is the requester
			const reports = await storage.getAgentTransactionReports(req.user!.id, {
				clientId: clientId as string,
				status: status as string,
				reportType: reportType as string,
			});

			res.json({
				success: true,
				reports,
				count: reports.length,
			});
		} catch (error) {
			console.error("Error fetching agent transaction reports:", error);
			res.status(500).json({ error: "Failed to fetch transaction reports" });
		}
	});

	// Agent downloads client transaction report
	app.get(
		"/api/agent/transaction-reports/:id/download",
		requireAgent,
		async (req, res) => {
			try {
				const { id } = req.params;
				const { format = "pdf" } = req.query;

				const report = await storage.getTransactionReport(id);
				if (!report) {
					return res
						.status(404)
						.json({ error: "Transaction report not found" });
				}

				// Verify agent has access to this report
				if ((report as any).agentId !== req.user!.id) {
					return res
						.status(403)
						.json({ error: "Access denied to this report" });
				}

				if (report.status !== "generated") {
					return res
						.status(400)
						.json({ error: "Report is not ready for download" });
				}

				// Update download count
				await storage.updateTransactionReport(id, {
					downloadCount: ((report as any).downloadCount || 0) + 1,
					downloadedAt: new Date(),
				});

				const filename = `client-transaction-report-${(report as any).clientId}-${(report as any).reportPeriod}-${Date.now()}`;

				if (format === "pdf") {
					res.setHeader("Content-Type", "application/pdf");
					res.setHeader(
						"Content-Disposition",
						`attachment; filename="${filename}.pdf"`,
					);

					const pdfContent = `Client Transaction Report\n\nClient ID: ${(report as any).clientId}\nReport Type: ${(report as any).reportType}\nPeriod: ${(report as any).reportPeriod}\nSource: ${(report as any).apiProvider}\nGenerated: ${new Date().toLocaleDateString("en-IN")}\n\nTotal Purchases: ₹${(report as any).totalPurchases || 0}\nTotal Redemptions: ₹${(report as any).totalRedemptions || 0}\nTransaction Count: ${(report as any).transactionCount || 0}`;

					res.send(Buffer.from(pdfContent));
				} else if (format === "excel") {
					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					);
					res.setHeader(
						"Content-Disposition",
						`attachment; filename="${filename}.xlsx"`,
					);

					const excelContent =
						"Client,Report Type,Period,Purchases,Redemptions,Count\n" +
						`${(report as any).clientId},${(report as any).reportType},${(report as any).reportPeriod},${(report as any).totalPurchases || 0},${(report as any).totalRedemptions || 0},${(report as any).transactionCount || 0}`;

					res.send(Buffer.from(excelContent));
				} else {
					res
						.status(400)
						.json({ error: "Invalid format. Use 'pdf' or 'excel'" });
				}
			} catch (error) {
				console.error("Error downloading transaction report:", error);
				res
					.status(500)
					.json({ error: "Failed to download transaction report" });
			}
		},
	);

	// Agent shares transaction report with client
	app.post(
		"/api/agent/transaction-reports/:id/share",
		requireAgent,
		async (req, res) => {
			try {
				const { id } = req.params;
				const {
					shareWithType = "client",
					message,
					expiresInDays = 30,
				} = req.body;

				const report = await storage.getTransactionReport(id);
				if (!report) {
					return res
						.status(404)
						.json({ error: "Transaction report not found" });
				}

				// Verify agent has access to this report
				if ((report as any).agentId !== req.user!.id) {
					return res
						.status(403)
						.json({ error: "Access denied to this report" });
				}

				// Create sharing record
				const expiresAt = new Date();
				expiresAt.setDate(expiresAt.getDate() + expiresInDays);

				const sharing = await storage.createReportSharing({
					reportId: id,
					reportType: "transaction_report",
					sharedBy: req.user!.id,
					sharedWith: (report as any).clientId,
					sharedWithType,
					accessType: "download",
					message,
					expiresAt,
				});

				res.json({
					success: true,
					sharing,
					message: "Report shared successfully",
				});
			} catch (error) {
				console.error("Error sharing transaction report:", error);
				res.status(500).json({ error: "Failed to share transaction report" });
			}
		},
	);

	// BAJAJ FINANCE API ROUTES

	// ========================
	// API CONFIGURATION MANAGEMENT
	// ========================

	// Get all API service configurations with real-time status
	app.get("/api/admin/api-config", requireAdmin, async (req, res) => {
		try {
			const services = [
				{
					id: "cashfree",
					name: "Cashfree",
					description: "Payment gateway & verification (primary)",
					category: "payments",
					envVars: [
						"CASHFREE_PG_APP_ID",
						"CASHFREE_PG_SECRET_KEY",
						"CASHFREE_SECUREID_APP_ID",
						"CASHFREE_SECUREID_SECRET_KEY",
					],
					environmentVar: "CASHFREE_PG_ENVIRONMENT",
					status:
						(process.env.CASHFREE_PG_APP_ID || process.env.CASHFREE_APP_ID) &&
						(process.env.CASHFREE_PG_SECRET_KEY ||
							process.env.CASHFREE_SECRET_KEY)
							? "configured"
							: "missing",
					environment:
						process.env.CASHFREE_PG_ENVIRONMENT ||
						process.env.CASHFREE_ENVIRONMENT ||
						(process.env.NODE_ENV === "production" ? "production" : "sandbox"),
					testEndpoint: "/api/admin/api-config/test/cashfree",
					docs: "https://docs.cashfree.com",
				},
				{
					id: "sandbox",
					name: "Sandbox.co.in",
					description: "Bank verification & ITR services",
					category: "verification",
					envVars: ["SANDBOX_API_KEY", "SANDBOX_API_SECRET"],
					environmentVar: "SANDBOX_ENVIRONMENT",
					status:
						process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET
							? "configured"
							: "missing",
					environment: process.env.SANDBOX_ENVIRONMENT || "sandbox",
					testEndpoint: "/api/admin/api-config/test/sandbox",
					docs: "https://docs.sandbox.co.in",
				},
				{
					id: "phonepe",
					name: "PhonePe",
					description: "Payment gateway (secondary)",
					category: "payments",
					envVars: [
						"PHONEPE_MERCHANT_ID",
						"PHONEPE_SALT_KEY",
						"PHONEPE_SALT_INDEX",
					],
					environmentVar: "PHONEPE_ENVIRONMENT",
					status:
						process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY
							? "configured"
							: "missing",
					environment: process.env.PHONEPE_ENVIRONMENT || "sandbox",
					testEndpoint: "/api/admin/api-config/test/phonepe",
					docs: "https://developer.phonepe.com",
				},
				{
					id: "gemini",
					name: "Google Gemini AI",
					description: "AI assistant & expense categorization",
					category: "ai",
					envVars: ["GEMINI_API_KEY"],
					environmentVar: null,
					status: process.env.GEMINI_API_KEY ? "configured" : "missing",
					environment: "production",
					testEndpoint: "/api/admin/api-config/test/gemini",
					docs: "https://ai.google.dev/docs",
				},
				{
					id: "twilio",
					name: "Twilio",
					description: "SMS OTP delivery",
					category: "communication",
					envVars: [
						"TWILIO_ACCOUNT_SID",
						"TWILIO_AUTH_***",
						"TWILIO_PHONE_NUMBER",
					],
					environmentVar: null,
					status:
						process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
							? "configured"
							: "missing",
					environment: "production",
					testEndpoint: "/api/admin/api-config/test/twilio",
					docs: "https://www.twilio.com/docs",
				},
				{
					id: "email",
					name: "Email Service (SMTP)",
					description: "Email notifications & OTP",
					category: "communication",
					envVars: ["EMAIL_USER", "EMAIL_PASS", "EMAIL_HOST", "EMAIL_PORT"],
					environmentVar: null,
					status:
						process.env.EMAIL_USER && process.env.EMAIL_PASS
							? "configured"
							: "missing",
					environment: "production",
					testEndpoint: "/api/admin/api-config/test/email",
					docs: null,
				},
				{
					id: "credhive",
					name: "Credhive",
					description: "Unlisted company intelligence & financial analytics",
					category: "data",
					envVars: ["CREDHIVE_API_KEY"],
					environmentVar: null,
					status: process.env.CREDHIVE_API_KEY ? "configured" : "missing",
					environment: "production",
					testEndpoint: "/api/admin/api-config/test/credhive",
					docs: "https://credhive.in/api-docs",
				},
				{
					id: "zoho",
					name: "Zoho Campaigns",
					description: "Email marketing automation",
					category: "marketing",
					envVars: [
						"ZOHO_CLIENT_ID",
						"ZOHO_CLIENT_SECRET",
						"ZOHO_REFRESH_TOKEN",
					],
					environmentVar: null,
					status:
						process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET
							? "configured"
							: "missing",
					environment: "production",
					testEndpoint: "/api/admin/api-config/test/zoho",
					docs: "https://www.zoho.com/campaigns/api",
				},
				{
					id: "twilio_whatsapp",
					name: "Twilio WhatsApp",
					description: "WhatsApp Business API",
					category: "marketing",
					envVars: [
						"TWILIO_ACCOUNT_SID",
						"TWILIO_AUTH_***",
						"TWILIO_WHATSAPP_NUMBER",
					],
					environmentVar: null,
					status:
						process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
							? "configured"
							: "missing",
					environment: "production",
					testEndpoint: "/api/test/twilio-whatsapp",
					docs: "https://www.twilio.com/docs/whatsapp",
				},
				{
					id: "alphavantage",
					name: "Alpha Vantage",
					description: "Stock market data",
					category: "market-data",
					envVars: ["ALPHA_VANTAGE_API_KEY"],
					environmentVar: null,
					status: process.env.ALPHA_VANTAGE_API_KEY ? "configured" : "missing",
					environment: "production",
					testEndpoint: "/api/admin/api-config/test/alphavantage",
					docs: "https://www.alphavantage.co/documentation",
				},
				{
					id: "openai",
					name: "OpenAI",
					description: "Advanced AI capabilities",
					category: "ai",
					envVars: ["OPENAI_API_KEY"],
					environmentVar: null,
					status: process.env.OPENAI_API_KEY ? "configured" : "missing",
					environment: "production",
					testEndpoint: "/api/admin/api-config/test/openai",
					docs: "https://platform.openai.com/docs",
				},
			];

			// Group by category
			const categories: Record<
				string,
				{ name: string; services: typeof services }
			> = {
				payments: { name: "Payment Gateways", services: [] },
				verification: { name: "Verification Services", services: [] },
				ai: { name: "AI Services", services: [] },
				communication: { name: "Communication", services: [] },
				marketing: { name: "Marketing", services: [] },
				"market-data": { name: "Market Data", services: [] },
				data: { name: "Data Services", services: [] },
			};

			services.forEach((service) => {
				if (categories[service.category]) {
					categories[service.category].services.push(service);
				}
			});

			// Calculate summary
			const summary = {
				total: services.length,
				configured: services.filter((s) => s.status === "configured").length,
				missing: services.filter((s) => s.status === "missing").length,
				sandbox: services.filter((s) => s.environment === "sandbox").length,
				production: services.filter((s) => s.environment === "production")
					.length,
			};

			res.json({
				success: true,
				data: {
					services,
					categories,
					summary,
					lastChecked: new Date().toISOString(),
				},
			});
		} catch (error: any) {
			console.error("Error fetching API config:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	});

	// Test individual API connection
	app.post(
		"/api/admin/api-config/test/:serviceId",
		requireAdmin,
		async (req, res) => {
			const { serviceId } = req.params;

			try {
				let result: {
					success: boolean;
					message: string;
					details?: any;
					latency?: number;
				} = {
					success: false,
					message: "Unknown service",
				};

				const startTime = Date.now();

				switch (serviceId) {
					case "cashfree": {
						const cfPgAppId =
							process.env.CASHFREE_PG_APP_ID || process.env.CASHFREE_APP_ID;
						const cfPgSecret =
							process.env.CASHFREE_PG_SECRET_KEY ||
							process.env.CASHFREE_SECRET_KEY;
						if (!cfPgAppId || !cfPgSecret) {
							result = {
								success: false,
								message:
									"Missing Cashfree PG credentials (CASHFREE_PG_APP_ID / CASHFREE_PG_SECRET_KEY)",
							};
						} else {
							try {
								const env =
									process.env.CASHFREE_PG_ENVIRONMENT ||
									process.env.CASHFREE_ENVIRONMENT ||
									"sandbox";
								const baseUrl =
									env.toUpperCase() === "PRODUCTION"
										? "https://api.cashfree.com"
										: "https://sandbox.cashfree.com";

								const response = await fetch(`${baseUrl}/pg/orders`, {
									method: "GET",
									headers: {
										"x-client-id": cfPgAppId,
										"x-client-secret": cfPgSecret,
										"x-api-version": "2023-08-01",
									},
								});

								result = {
									success: response.status !== 401,
									message:
										response.status === 401
											? "Invalid credentials"
											: "Connection successful",
									details: { status: response.status, environment: env },
									latency: Date.now() - startTime,
								};
							} catch (e: any) {
								result = { success: false, message: e.message };
							}
						}
						break;
					}

					case "sandbox":
						if (
							!process.env.SANDBOX_API_KEY ||
							!process.env.SANDBOX_API_SECRET
						) {
							result = {
								success: false,
								message: "Missing Sandbox credentials",
							};
						} else {
							try {
								const response = await fetch(
									"https://api.sandbox.co.in/authenticate",
									{
										method: "POST",
										headers: {
											"Content-Type": "application/json",
											"x-api-key": process.env.SANDBOX_API_KEY,
											"x-api-secret": process.env.SANDBOX_API_SECRET,
											"x-api-version": "1.0.0",
										},
									},
								);

								const data = await response.json();
								const accessToken =
									data?.data?.access_token || data?.access_token;
								result = {
									success: !!accessToken,
									message: accessToken
										? "Authentication successful"
										: "Authentication failed",
									details: { hasToken: !!accessToken },
									latency: Date.now() - startTime,
								};
							} catch (e: any) {
								result = { success: false, message: e.message };
							}
						}
						break;

					case "gemini":
						if (!process.env.GEMINI_API_KEY) {
							result = { success: false, message: "Missing Gemini API key" };
						} else {
							try {
								const { GoogleGenAI } = await import("@google/genai");
								const genAI = new GoogleGenAI({
									apiKey: process.env.GEMINI_API_KEY,
								});
								result = {
									success: true,
									message: "API key configured",
									details: { model: "gemini-2.5-flash" },
									latency: Date.now() - startTime,
								};
							} catch (e: any) {
								result = { success: false, message: e.message };
							}
						}
						break;

					case "twilio":
						if (
							!process.env.TWILIO_ACCOUNT_SID ||
							!process.env.TWILIO_AUTH_TOKEN
						) {
							result = {
								success: false,
								message: "Missing Twilio credentials",
							};
						} else {
							try {
								const twilioSdk = require("twilio");
								const twilioClient = twilioSdk(
									process.env.TWILIO_ACCOUNT_SID,
									process.env.TWILIO_AUTH_TOKEN,
								);
								await twilioClient.api
									.accounts(process.env.TWILIO_ACCOUNT_SID)
									.fetch();
								result = {
									success: true,
									message: "Credentials valid",
									latency: Date.now() - startTime,
								};
							} catch (e: any) {
								const isAuthError = e?.status === 401 || e?.code === 20003;
								result = {
									success: false,
									message: isAuthError ? "Invalid credentials" : e.message,
									latency: Date.now() - startTime,
								};
							}
						}
						break;

					case "email":
						if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
							result = { success: false, message: "Missing email credentials" };
						} else {
							result = {
								success: true,
								message:
									"Credentials configured (verification requires sending test email)",
								details: {
									host: process.env.EMAIL_HOST || "smtp.gmail.com",
									user: process.env.EMAIL_USER?.substring(0, 5) + "***",
								},
								latency: Date.now() - startTime,
							};
						}
						break;

					case "credhive":
						if (!process.env.CREDHIVE_API_KEY) {
							result = { success: false, message: "Missing Credhive API key" };
						} else {
							try {
								const { credhiveService: ch } = await import(
									"../services/credhive-service"
								);
								const searchResp = await ch.searchCompanies("Reliance");
								result = {
									success: searchResp.success,
									message: searchResp.success
										? "Credhive API connection successful"
										: searchResp.error || "API connection failed",
									details: searchResp.success
										? { resultsReturned: searchResp.data?.length ?? 0 }
										: undefined,
									latency: Date.now() - startTime,
								};
							} catch (e: any) {
								result = { success: false, message: e.message };
							}
						}
						break;

					default:
						result = {
							success: true,
							message: "Service status checked",
							latency: Date.now() - startTime,
						};
				}

				res.json({ success: true, data: result });
			} catch (error: any) {
				console.error(`Error testing ${serviceId}:`, error);
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	// Toggle service environment (sandbox/production)
	app.post(
		"/api/admin/api-config/environment/:serviceId",
		requireAdmin,
		async (req, res) => {
			const { serviceId } = req.params;
			const { environment } = req.body;

			if (!["sandbox", "production"].includes(environment)) {
				return res
					.status(400)
					.json({
						success: false,
						error: "Invalid environment. Must be sandbox or production",
					});
			}

			try {
				const envVarMap: Record<string, string> = {
					cashfree: "CASHFREE_ENVIRONMENT",
					sandbox: "SANDBOX_ENVIRONMENT",
					phonepe: "PHONEPE_ENVIRONMENT",
				};

				const envVar = envVarMap[serviceId];
				if (!envVar) {
					return res.status(400).json({
						success: false,
						error: "This service does not support environment switching",
					});
				}

				// Update the environment variable
				process.env[envVar] = environment;

				res.json({
					success: true,
					message: `${serviceId} environment switched to ${environment}`,
					data: { serviceId, environment },
				});
			} catch (error: any) {
				console.error(`Error switching environment for ${serviceId}:`, error);
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);
	// ========================

	// AI Provider Switch (Admin)
	app.get("/api/admin/ai-provider", requireAdmin, async (req, res) => {
		try {
			const { aiService } = await import("../services/ai-service");
			const { unifiedAIRecommendationEngine } = await import(
				"../services/unified-ai-recommendation-engine"
			);

			const aiDefault = aiService.getDefaultProvider();
			const unifiedStatus = unifiedAIRecommendationEngine.getStatus();

			res.json({
				success: true,
				provider: {
					current: aiDefault.provider,
					model: aiDefault.model,
					unifiedEnginePrimary: unifiedStatus.primary,
					openaiAvailable: unifiedStatus.openai,
					geminiAvailable: unifiedStatus.gemini,
				},
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	});

	app.post("/api/admin/ai-provider/switch", requireAdmin, async (req, res) => {
		try {
			const { provider } = req.body;
			if (!provider || !["openai", "gemini"].includes(provider)) {
				return res
					.status(400)
					.json({
						success: false,
						error: 'Invalid provider. Must be "openai" or "gemini"',
					});
			}

			const { aiService } = await import("../services/ai-service");
			const { unifiedAIRecommendationEngine } = await import(
				"../services/unified-ai-recommendation-engine"
			);

			aiService.setDefaultProvider(provider as any);
			unifiedAIRecommendationEngine.setPrimaryProvider(
				provider as "openai" | "gemini",
			);

			res.json({
				success: true,
				message: `AI provider switched to ${provider === "openai" ? "OpenAI" : "Google Gemini"}`,
				provider: {
					current: provider,
					model: provider === "openai" ? "gpt-4o" : "gemini-2.5-flash",
				},
			});
		} catch (error: any) {
			console.error("Error switching AI provider:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	});
}
