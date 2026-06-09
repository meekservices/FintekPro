import { Express } from "express";
import { db } from "../db";
import { requireAdmin } from "../middleware/roleMiddleware";
import {
	requireLevel1,
	requireLevel2,
	injectKYCLevel,
} from "../middleware/kyc-level-gate";
import { validateKYC } from "../kyc-middleware";
import { nseNcbApi } from "../nseNcbApi";
import { bseBondApi } from "../bseBondApi";
import { bseDirectApi } from "../bseDirectApi";
import {
	governmentSecurities,
	corporateBonds,
	bondOrders,
	bondHoldings,
	insertBondOrderSchema,
} from "@shared/schema";
import { eq, desc, sql, and, or, gte, lte, inArray } from "drizzle-orm";
import { isProductionEnvironment } from "../utils/enrichment-guard";
import { bondOrderNotificationService } from "../services/bond-order-notification-service";
import { auditLogArchivalService } from "../services/audit-log-archival";
import { amfiService } from "../amfi-service";

export function registerBondTradingOrderPart4Part1Routes(app: Express): void {
	app.get("/api/cdsl/holdings", async (req, res) => {
		try {
			const { pan, fromDate, toDate, isin } = req.query;

			const cdslHoldings = [
				{
					id: "cdsl-holding-1",
					isin: "INE467B01029",
					symbol: "ASIANPAINT",
					companyName: "Asian Paints Limited",
					depository: "CDSL",
					dpId: "12018600",
					clientId: "00123456",
					holdingDate: "2025-01-27",
					quantity: 180,
					faceValue: 1,
					marketValue: 558000,
					currentPrice: 3100.25,
					avgCostPrice: 2980.5,
					totalCostValue: 536490,
					unrealizedGainLoss: 21510,
					gainLossPercentage: 4.01,
					pledgedQuantity: 0,
					lockedQuantity: 0,
					availableQuantity: 180,
					transactions: [
						{
							date: "2024-06-20",
							type: "BUY",
							quantity: 80,
							price: 2960.75,
							value: 236860,
						},
						{
							date: "2024-09-15",
							type: "BUY",
							quantity: 100,
							price: 2995.3,
							value: 299530,
						},
					],
				},
				{
					id: "cdsl-holding-2",
					isin: "INE081A01020",
					symbol: "WIPRO",
					companyName: "Wipro Limited",
					depository: "CDSL",
					dpId: "12018600",
					clientId: "00123456",
					holdingDate: "2025-01-27",
					quantity: 400,
					faceValue: 2,
					marketValue: 180000,
					currentPrice: 450.75,
					avgCostPrice: 425.8,
					totalCostValue: 170320,
					unrealizedGainLoss: 9680,
					gainLossPercentage: 5.68,
					pledgedQuantity: 100,
					lockedQuantity: 0,
					availableQuantity: 300,
					transactions: [
						{
							date: "2024-08-05",
							type: "BUY",
							quantity: 250,
							price: 420.6,
							value: 105150,
						},
						{
							date: "2024-10-30",
							type: "BUY",
							quantity: 150,
							price: 434.8,
							value: 65220,
						},
					],
				},
				{
					id: "cdsl-holding-3",
					isin: "INE758T01015",
					symbol: "BAJFINANCE",
					companyName: "Bajaj Finance Limited",
					depository: "CDSL",
					dpId: "12018600",
					clientId: "00123456",
					holdingDate: "2025-01-27",
					quantity: 120,
					faceValue: 2,
					marketValue: 825600,
					currentPrice: 6880.5,
					avgCostPrice: 6720.25,
					totalCostValue: 806430,
					unrealizedGainLoss: 19170,
					gainLossPercentage: 2.38,
					pledgedQuantity: 0,
					lockedQuantity: 10,
					availableQuantity: 110,
					transactions: [
						{
							date: "2024-07-12",
							type: "BUY",
							quantity: 70,
							price: 6695.5,
							value: 468685,
						},
						{
							date: "2024-11-25",
							type: "BUY",
							quantity: 50,
							price: 6754.9,
							value: 337745,
						},
					],
				},
			];

			// Filter by ISIN if provided
			const filteredHoldings = isin
				? cdslHoldings.filter((h: any) => h.isin === isin)
				: cdslHoldings;

			const summary = {
				totalHoldings: filteredHoldings.length,
				totalMarketValue: filteredHoldings.reduce(
					(sum: any, h: any) => sum + h.marketValue,
					0,
				),
				totalCostValue: filteredHoldings.reduce(
					(sum: any, h: any) => sum + h.totalCostValue,
					0,
				),
				totalUnrealizedGainLoss: filteredHoldings.reduce(
					(sum: any, h: any) => sum + h.unrealizedGainLoss,
					0,
				),
				averageGainLossPercentage: (
					filteredHoldings.reduce(
						(sum: any, h: any) => sum + h.gainLossPercentage,
						0,
					) / filteredHoldings.length
				).toFixed(2),
				totalPledgedValue: filteredHoldings.reduce(
					(sum: any, h: any) => sum + h.pledgedQuantity * h.currentPrice,
					0,
				),
			};

			res.json({
				status: "success",
				data: filteredHoldings,
				summary,
				depository: "CDSL",
				searchCriteria: { pan, fromDate, toDate, isin },
				lastUpdated: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error fetching CDSL holdings:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch CDSL holdings data",
			});
		}
	});

	// CDSL capital gains report
	app.get("/api/cdsl/capital-gains", async (req, res) => {
		try {
			const { pan, financialYear, transactionType } = req.query;

			const cdslCapitalGains = [
				{
					id: "cdsl-cg-1",
					isin: "INE467B01029",
					symbol: "ASIANPAINT",
					companyName: "Asian Paints Limited",
					depository: "CDSL",
					financialYear: "2024-25",
					transactionType: "LONG_TERM",
					buyDate: "2023-03-20",
					sellDate: "2024-07-15",
					buyPrice: 2650.8,
					sellPrice: 2850.25,
					quantity: 150,
					buyValue: 397620,
					sellValue: 427537.5,
					brokerage: 425,
					stt: 1068.84,
					otherCharges: 145.25,
					netRealizedGain: 28278.41,
					taxableGain: 28278.41,
					taxRate: 12.5,
					taxLiability: 3534.8,
					netGainAfterTax: 24743.61,
					holdingPeriod: 482, // days
				},
				{
					id: "cdsl-cg-2",
					isin: "INE081A01020",
					symbol: "WIPRO",
					companyName: "Wipro Limited",
					depository: "CDSL",
					financialYear: "2024-25",
					transactionType: "SHORT_TERM",
					buyDate: "2024-05-20",
					sellDate: "2024-10-10",
					buyPrice: 380.5,
					sellPrice: 425.75,
					quantity: 300,
					buyValue: 114150,
					sellValue: 127725,
					brokerage: 245,
					stt: 319.18,
					otherCharges: 68.5,
					netRealizedGain: 12942.32,
					taxableGain: 12942.32,
					taxRate: 20,
					taxLiability: 2588.46,
					netGainAfterTax: 10353.86,
					holdingPeriod: 143, // days
				},
				{
					id: "cdsl-cg-3",
					isin: "INE758T01015",
					symbol: "BAJFINANCE",
					companyName: "Bajaj Finance Limited",
					depository: "CDSL",
					financialYear: "2024-25",
					transactionType: "LONG_TERM",
					buyDate: "2023-01-10",
					sellDate: "2024-09-05",
					buyPrice: 6120.5,
					sellPrice: 6650.75,
					quantity: 80,
					buyValue: 489640,
					sellValue: 532060,
					brokerage: 520,
					stt: 1330.15,
					otherCharges: 175.8,
					netRealizedGain: 40034.05,
					taxableGain: 40034.05,
					taxRate: 12.5,
					taxLiability: 5004.26,
					netGainAfterTax: 35029.79,
					holdingPeriod: 603, // days
				},
			];

			// Filter by financial year and transaction type if provided
			let filteredGains = cdslCapitalGains;
			if (financialYear) {
				filteredGains = filteredGains.filter(
					(cg: any) => cg.financialYear === financialYear,
				);
			}
			if (transactionType) {
				filteredGains = filteredGains.filter(
					(cg: any) => cg.transactionType === transactionType,
				);
			}

			const summary = {
				totalTransactions: filteredGains.length,
				totalRealizedGains: filteredGains.reduce(
					(sum: any, cg: any) => sum + cg.netRealizedGain,
					0,
				),
				totalTaxLiability: filteredGains.reduce(
					(sum: any, cg: any) => sum + cg.taxLiability,
					0,
				),
				totalNetGainAfterTax: filteredGains.reduce(
					(sum: any, cg: any) => sum + cg.netGainAfterTax,
					0,
				),
				longTermGains: filteredGains.filter(
					(cg: any) => cg.transactionType === "LONG_TERM",
				).length,
				shortTermGains: filteredGains.filter(
					(cg: any) => cg.transactionType === "SHORT_TERM",
				).length,
				averageHoldingPeriod: Math.round(
					filteredGains.reduce(
						(sum: any, cg: any) => sum + cg.holdingPeriod,
						0,
					) / filteredGains.length,
				),
			};

			res.json({
				status: "success",
				data: filteredGains,
				summary,
				depository: "CDSL",
				searchCriteria: { pan, financialYear, transactionType },
				lastUpdated: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error fetching CDSL capital gains:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch CDSL capital gains data",
			});
		}
	});

	// Combined NSDL + CDSL comprehensive search
	app.get("/api/depository/combined-search", async (req, res) => {
		try {
			const {
				pan,
				fromDate,
				toDate,
				isin,
				reportType = "holdings",
			} = req.query;

			// Fetch from both depositories
			const [nsdlResponse, cdslResponse] = await Promise.all([
				fetch(
					`${req.protocol}://${req.get("host")}/api/nsdl/${reportType as string}?${new URLSearchParams(req.query as any)}`,
				),
				fetch(
					`${req.protocol}://${req.get("host")}/api/cdsl/${reportType as string}?${new URLSearchParams(req.query as any)}`,
				),
			]);

			const [nsdlData, cdslData] = await Promise.all([
				nsdlResponse.json(),
				cdslResponse.json(),
			]);

			const combinedData = [...nsdlData.data, ...cdslData.data];

			// Calculate combined statistics
			const combinedSummary = {
				totalRecords: combinedData.length,
				nsdlRecords: nsdlData.data.length,
				cdslRecords: cdslData.data.length,
				...(reportType === "holdings"
					? {
							totalMarketValue: combinedData.reduce(
								(sum: any, item: any) => sum + (item.marketValue || 0),
								0,
							),
							totalCostValue: combinedData.reduce(
								(sum: any, item: any) => sum + (item.totalCostValue || 0),
								0,
							),
							totalUnrealizedGainLoss: combinedData.reduce(
								(sum: any, item: any) => sum + (item.unrealizedGainLoss || 0),
								0,
							),
							averageGainLossPercentage: (
								combinedData.reduce(
									(sum: any, item: any) => sum + (item.gainLossPercentage || 0),
									0,
								) / combinedData.length
							).toFixed(2),
						}
					: {
							totalRealizedGains: combinedData.reduce(
								(sum: any, item: any) => sum + (item.netRealizedGain || 0),
								0,
							),
							totalTaxLiability: combinedData.reduce(
								(sum: any, item: any) => sum + (item.taxLiability || 0),
								0,
							),
							totalNetGainAfterTax: combinedData.reduce(
								(sum: any, item: any) => sum + (item.netGainAfterTax || 0),
								0,
							),
						}),
			};

			res.json({
				status: "success",
				data: combinedData,
				summary: combinedSummary,
				nsdlSummary: nsdlData.summary,
				cdslSummary: cdslData.summary,
				depositories: ["NSDL", "CDSL"],
				reportType,
				searchCriteria: { pan, fromDate, toDate, isin },
				lastUpdated: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error fetching combined depository data:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch combined depository data",
			});
		}
	});

	// Test routes — development/staging only, disabled in production
	if (!isProductionEnvironment()) {
		// Test AMFI integration
		app.get("/api/test-amfi", async (req, res) => {
			try {
				console.log("🧪 Testing AMFI integration...");
				const popularFunds = await amfiService.getPopularFundsWithPerformance();
				res.json({
					success: true,
					source:
						(popularFunds[0] as any)?.provenance?.primarySource || "unknown",
					fundsCount: popularFunds.length,
					sampleFund: popularFunds[0],
				});
			} catch (error) {
				console.error("❌ AMFI test failed:", error);
				res.status(500).json({ error: String(error) });
			}
		});

		// Twilio SMS test endpoint
		app.post("/api/test/twilio-sms", async (req, res) => {
			try {
				const { mobile } = req.body;

				if (!mobile) {
					return res.status(400).json({
						success: false,
						error: "Mobile number is required",
					});
				}

				const { smsService } = await import("../services/sms-service");

				if (!smsService.isAvailable()) {
					return res.status(503).json({
						success: false,
						error: "Twilio SMS service not configured",
						message:
							"Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER",
					});
				}

				const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
				console.log(`🧪 Testing Twilio SMS to ${mobile.substring(0, 4)}****`);

				const result = await smsService.sendOTP(mobile, testOTP);

				res.json({
					success: result,
					message: result ? "Test SMS sent successfully" : "Failed to send SMS",
					mobile: `${mobile.substring(0, 4)}****${mobile.slice(-2)}`,
					testOTP: process.env.NODE_ENV === "development" ? testOTP : undefined,
				});
			} catch (error: any) {
				console.error("❌ Twilio SMS test failed:", error);
				res.status(500).json({
					success: false,
					error: error.message || String(error),
				});
			}
		});

		// Twilio WhatsApp test endpoint
		app.post("/api/test/twilio-whatsapp", async (req, res) => {
			try {
				const { mobile, message, alertType, details } = req.body;

				if (!mobile) {
					return res
						.status(400)
						.json({ success: false, error: "Mobile number is required" });
				}

				const { twilioWhatsAppService } = await import(
					"../services/twilio-whatsapp-service"
				);

				if (!twilioWhatsAppService.isAvailable()) {
					return res.status(503).json({
						success: false,
						error: "WhatsApp service not configured",
						message: "Missing TWILIO_WHATSAPP_NUMBER or TWILIO_PHONE_NUMBER",
					});
				}

				let result;
				if (alertType && details) {
					result = await twilioWhatsAppService.sendPortfolioAlert(
						mobile,
						alertType,
						details,
					);
				} else {
					result = await twilioWhatsAppService.sendMessage(
						mobile,
						message || "Test message from FintekPro",
					);
				}

				res.json(result);
			} catch (error: any) {
				console.error("❌ WhatsApp test failed:", error);
				res.status(500).json({ success: false, error: error.message });
			}
		});

		// Twilio Verify test endpoint
		app.post("/api/test/twilio-verify", async (req, res) => {
			try {
				const { mobile, email, channel, code, action } = req.body;

				const { twilioVerifyService } = await import(
					"../services/twilio-verify-service"
				);

				if (!twilioVerifyService.isAvailable()) {
					return res.status(503).json({
						success: false,
						error: "Verify service not configured",
						message:
							"Missing TWILIO_VERIFY_SERVICE_SID - Create a Verify Service in Twilio Console",
					});
				}

				if (action === "check" && code) {
					const to = email || mobile;
					if (!to) {
						return res
							.status(400)
							.json({ success: false, error: "Mobile or email required" });
					}
					const result = await twilioVerifyService.checkVerification(to, code);
					return res.json(result);
				}

				const to = channel === "email" ? email : mobile;
				if (!to) {
					return res
						.status(400)
						.json({
							success: false,
							error: "Mobile or email required based on channel",
						});
				}

				const result = await twilioVerifyService.sendVerification(
					to,
					channel || "sms",
				);
				res.json(result);
			} catch (error: any) {
				console.error("❌ Verify test failed:", error);
				res.status(500).json({ success: false, error: error.message });
			}
		});

		// Twilio Voice OTP test endpoint
		app.post("/api/test/twilio-voice", async (req, res) => {
			try {
				const { mobile, otp } = req.body;

				if (!mobile) {
					return res
						.status(400)
						.json({ success: false, error: "Mobile number is required" });
				}

				const { twilioVoiceService } = await import(
					"../services/twilio-voice-service"
				);

				if (!twilioVoiceService.isAvailable()) {
					return res.status(503).json({
						success: false,
						error: "Voice service not configured",
						message: "Missing Twilio credentials",
					});
				}

				const testOTP =
					otp || Math.floor(100000 + Math.random() * 900000).toString();
				console.log(
					"🧪 Testing Twilio Voice OTP to " + mobile.substring(0, 4) + "****",
				);

				const result = await twilioVoiceService.sendOTPCall(mobile, testOTP);

				res.json({
					...result,
					testOTP: process.env.NODE_ENV === "development" ? testOTP : undefined,
				});
			} catch (error: any) {
				console.error("❌ Voice test failed:", error);
				res.status(500).json({ success: false, error: error.message });
			}
		});
	} // end !isProductionEnvironment() — test routes block

	// AMFI API endpoints for mutual fund data
	app.get("/api/amfi/mutual-funds", async (req, res) => {
		try {
			const {
				category,
				amc,
				nav_min,
				nav_max,
				returns_period = "1Y",
				sort_by = "returns",
			} = req.query;

			// Get real AMFI data
			const popularFunds = await amfiService.getPopularFundsWithPerformance();

			// Transform AMFI data to API format
			const amfiMutualFunds = popularFunds.map((fund, index) => ({
				id: `amfi-mf-${index + 1}`,
				scheme_code: fund.schemeCode,
				scheme_name: fund.schemeName,
				amc: fund.fundHouse,
				category: fund.category,
				sub_category: fund.category,
				nav: fund.currentNav,
				nav_date: fund.lastUpdated,
				fund_size: "N/A", // Not available in MF API
				expense_ratio: 1.2, // Default value, not available in free API
				min_investment: 5000,
				fund_manager: "N/A",
				benchmark: "N/A",
				launch_date: "N/A",
				returns: {
					"1D": null,
					"1W": null,
					"1M": fund.returns["1M"] || 0,
					"3M": null,
					"6M": fund.returns["6M"] || 0,
					"1Y": fund.returns["1Y"] || 0,
					"2Y": null,
					"3Y": fund.returns["3Y"] || 0,
					"5Y": fund.returns["5Y"] || 0,
					since_inception: null,
				},
				risk_level: "Moderate",
				rating: 4,
				exit_load: "1% if redeemed within 365 days",
			}));

			// Using only real AMFI data - mock funds removed

			// Filter by category if provided
			let filteredFunds = category
				? amfiMutualFunds.filter(
						(fund: any) =>
							fund.category
								.toLowerCase()
								.includes(String(category).toLowerCase()) ||
							fund.sub_category
								.toLowerCase()
								.includes(String(category).toLowerCase()),
					)
				: amfiMutualFunds;

			// Filter by AMC if provided
			if (amc) {
				filteredFunds = filteredFunds.filter((fund: any) =>
					fund.amc.toLowerCase().includes(String(amc).toLowerCase()),
				);
			}

			// Filter by NAV range if provided
			if (nav_min) {
				filteredFunds = filteredFunds.filter(
					(fund: any) => fund.nav >= Number.parseFloat(String(nav_min)),
				);
			}
			if (nav_max) {
				filteredFunds = filteredFunds.filter(
					(fund: any) => fund.nav <= Number.parseFloat(String(nav_max)),
				);
			}

			// Sort by returns or other criteria
			if (sort_by === "returns") {
				const period = String(returns_period || "1Y");
				filteredFunds.sort(
					(a: any, b: any) =>
						((b.returns as any)[period] || 0) -
						((a.returns as any)[period] || 0),
				);
			} else if (sort_by === "nav") {
				filteredFunds.sort((a: any, b: any) => b.nav - a.nav);
			} else if (sort_by === "fund_size") {
				filteredFunds.sort((a: any, b: any) => {
					const parseSize = (size: any) =>
						Number.parseFloat(size.replace(/[₹,\sCr]/g, ""));
					return parseSize(b.fund_size) - parseSize(a.fund_size);
				});
			}

			const summary = {
				totalFunds: filteredFunds.length,
				avgReturns1Y: (
					filteredFunds.reduce(
						(sum: any, fund: any) => sum + fund.returns["1Y"],
						0,
					) / filteredFunds.length
				).toFixed(2),
				avgExpenseRatio: (
					filteredFunds.reduce(
						(sum: any, fund: any) => sum + fund.expense_ratio,
						0,
					) / filteredFunds.length
				).toFixed(2),
				topPerformer: filteredFunds[0]?.scheme_name || "N/A",
				categories: Array.from(
					new Set(filteredFunds.map((fund: any) => fund.category)),
				),
				amcList: Array.from(
					new Set(filteredFunds.map((fund: any) => fund.amc)),
				),
			};

			res.json({
				status: "success",
				data: filteredFunds,
				summary,
				filters: { category, amc, nav_min, nav_max, returns_period, sort_by },
				lastUpdated: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error fetching AMFI mutual funds:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch mutual fund data from AMFI",
			});
		}
	});

	// AMFI NAV history endpoint
}
