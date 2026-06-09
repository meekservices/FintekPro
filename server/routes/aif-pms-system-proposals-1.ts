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

export function registerAIFPMSSystemPart1Routes(app: Express): void {
	app.get(
		"/api/admin/capital-gains-reports/export",
		requireAdmin,
		async (req, res) => {
			try {
				const {
					format = "csv",
					financialYear,
					source,
					fromDate,
					toDate,
				} = req.query;

				// Mock admin-level capital gains reports data
				const allReports = [
					{
						id: "cgr_admin_1",
						userId: "user1",
						userEmail: "user1@example.com",
						userName: "John Doe",
						financialYear: "2023-24",
						reportType: "capital_gains",
						source: "nsdl",
						totalShortTermGains: "125430.50",
						totalLongTermGains: "89750.25",
						totalDividend: "15600.00",
						totalTdsDeducted: "2340.75",
						status: "completed",
						createdAt: "2024-01-15T10:30:00Z",
					},
					{
						id: "cgr_admin_2",
						userId: "user2",
						userEmail: "user2@example.com",
						userName: "Jane Smith",
						financialYear: "2023-24",
						reportType: "capital_gains",
						source: "cdsl",
						totalShortTermGains: "98650.75",
						totalLongTermGains: "156320.40",
						totalDividend: "22800.00",
						totalTdsDeducted: "3420.15",
						status: "completed",
						createdAt: "2024-01-15T11:45:00Z",
					},
					{
						id: "cgr_admin_3",
						userId: "user3",
						userEmail: "user3@example.com",
						userName: "Mike Johnson",
						financialYear: "2022-23",
						reportType: "capital_gains",
						source: "nsdl",
						totalShortTermGains: "75200.25",
						totalLongTermGains: "112450.80",
						totalDividend: "18900.00",
						totalTdsDeducted: "1890.50",
						status: "completed",
						createdAt: "2024-01-20T09:15:00Z",
					},
				];

				// Apply filters
				let filteredReports = allReports;
				if (financialYear) {
					filteredReports = filteredReports.filter(
						(r) => r.financialYear === financialYear,
					);
				}
				if (source) {
					filteredReports = filteredReports.filter((r) => r.source === source);
				}

				const filename = `admin-capital-gains-export-${Date.now()}`;

				if (format === "csv") {
					const csvContent = [
						"User ID,User Email,User Name,Financial Year,Source,LTCG,STCG,Dividend,TDS,Status,Created Date",
						...filteredReports.map(
							(r) =>
								`${r.userId},${r.userEmail},${r.userName},${r.financialYear},${r.source.toUpperCase()},${r.totalLongTermGains},${r.totalShortTermGains},${r.totalDividend},${r.totalTdsDeducted},${r.status},${new Date(r.createdAt).toLocaleDateString("en-IN")}`,
						),
					].join("\n");

					res.setHeader("Content-Type", "text/csv");
					res.setHeader(
						"Content-Disposition",
						`attachment; filename="${filename}.csv"`,
					);
					res.send(csvContent);
				} else if (format === "excel") {
					// Mock Excel generation
					const excelContent = filteredReports.map((r) => ({
						"User ID": r.userId,
						"User Email": r.userEmail,
						"User Name": r.userName,
						"Financial Year": r.financialYear,
						Source: r.source.toUpperCase(),
						"Long Term Gains": `₹${r.totalLongTermGains}`,
						"Short Term Gains": `₹${r.totalShortTermGains}`,
						Dividend: `₹${r.totalDividend}`,
						"TDS Deducted": `₹${r.totalTdsDeducted}`,
						Status: r.status,
						"Created Date": new Date(r.createdAt).toLocaleDateString("en-IN"),
					}));

					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					);
					res.setHeader(
						"Content-Disposition",
						`attachment; filename="${filename}.xlsx"`,
					);
					res.json(excelContent); // In real implementation, generate actual Excel file
				} else {
					res.setHeader("Content-Type", "application/json");
					res.setHeader(
						"Content-Disposition",
						`attachment; filename="${filename}.json"`,
					);
					res.json({
						exportType: "capital_gains_reports",
						exportDate: new Date().toISOString(),
						totalRecords: filteredReports.length,
						data: filteredReports,
					});
				}
			} catch (error) {
				console.error("Error exporting capital gains reports:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to export capital gains reports",
				});
			}
		},
	);

	// Export all transaction reports (Admin only)
	app.get(
		"/api/admin/transaction-reports/export",
		requireAdmin,
		async (req, res) => {
			try {
				const {
					format = "csv",
					financialYear,
					source,
					assetType,
					fromDate,
					toDate,
				} = req.query;

				// Mock admin-level transaction reports data
				const allReports = [
					{
						id: "tr_admin_1",
						userId: "user1",
						userEmail: "user1@example.com",
						userName: "John Doe",
						financialYear: "2023-24",
						reportType: "transaction_summary",
						source: "iris",
						assetType: "mutual_funds",
						totalPurchases: "500000.00",
						totalRedemptions: "250000.00",
						totalSwitches: "100000.00",
						totalDividendReceived: "15000.00",
						totalBrokerage: "2500.00",
						totalTaxes: "7500.00",
						transactionCount: 25,
						status: "completed",
						createdAt: "2024-01-15T10:30:00Z",
					},
					{
						id: "tr_admin_2",
						userId: "user2",
						userEmail: "user2@example.com",
						userName: "Jane Smith",
						financialYear: "2023-24",
						reportType: "transaction_summary",
						source: "kfintech",
						assetType: "mutual_funds",
						totalPurchases: "750000.00",
						totalRedemptions: "300000.00",
						totalSwitches: "150000.00",
						totalDividendReceived: "22500.00",
						totalBrokerage: "3750.00",
						totalTaxes: "11250.00",
						transactionCount: 38,
						status: "completed",
						createdAt: "2024-01-15T11:45:00Z",
					},
					{
						id: "tr_admin_3",
						userId: "user3",
						userEmail: "user3@example.com",
						userName: "Mike Johnson",
						financialYear: "2022-23",
						reportType: "transaction_summary",
						source: "cams",
						assetType: "mutual_funds",
						totalPurchases: "400000.00",
						totalRedemptions: "180000.00",
						totalSwitches: "80000.00",
						totalDividendReceived: "12000.00",
						totalBrokerage: "2000.00",
						totalTaxes: "6000.00",
						transactionCount: 20,
						status: "completed",
						createdAt: "2024-01-20T09:15:00Z",
					},
				];

				// Apply filters
				let filteredReports = allReports;
				if (financialYear) {
					filteredReports = filteredReports.filter(
						(r) => r.financialYear === financialYear,
					);
				}
				if (source) {
					filteredReports = filteredReports.filter((r) => r.source === source);
				}
				if (assetType) {
					filteredReports = filteredReports.filter(
						(r) => r.assetType === assetType,
					);
				}

				const filename = `admin-transaction-reports-export-${Date.now()}`;

				if (format === "csv") {
					const csvContent = [
						"User ID,User Email,User Name,Financial Year,Source,Asset Type,Purchases,Redemptions,Switches,Dividend,Brokerage,Taxes,Transaction Count,Status,Created Date",
						...filteredReports.map(
							(r) =>
								`${r.userId},${r.userEmail},${r.userName},${r.financialYear},${r.source.toUpperCase()},${r.assetType},${r.totalPurchases},${r.totalRedemptions},${r.totalSwitches},${r.totalDividendReceived},${r.totalBrokerage},${r.totalTaxes},${r.transactionCount},${r.status},${new Date(r.createdAt).toLocaleDateString("en-IN")}`,
						),
					].join("\n");

					res.setHeader("Content-Type", "text/csv");
					res.setHeader(
						"Content-Disposition",
						`attachment; filename="${filename}.csv"`,
					);
					res.send(csvContent);
				} else if (format === "excel") {
					// Mock Excel generation
					const excelContent = filteredReports.map((r) => ({
						"User ID": r.userId,
						"User Email": r.userEmail,
						"User Name": r.userName,
						"Financial Year": r.financialYear,
						Source: r.source.toUpperCase(),
						"Asset Type": r.assetType,
						"Total Purchases": `₹${r.totalPurchases}`,
						"Total Redemptions": `₹${r.totalRedemptions}`,
						"Total Switches": `₹${r.totalSwitches}`,
						"Dividend Received": `₹${r.totalDividendReceived}`,
						Brokerage: `₹${r.totalBrokerage}`,
						Taxes: `₹${r.totalTaxes}`,
						"Transaction Count": r.transactionCount,
						Status: r.status,
						"Created Date": new Date(r.createdAt).toLocaleDateString("en-IN"),
					}));

					res.setHeader(
						"Content-Type",
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					);
					res.setHeader(
						"Content-Disposition",
						`attachment; filename="${filename}.xlsx"`,
					);
					res.json(excelContent); // In real implementation, generate actual Excel file
				} else {
					res.setHeader("Content-Type", "application/json");
					res.setHeader(
						"Content-Disposition",
						`attachment; filename="${filename}.json"`,
					);
					res.json({
						exportType: "transaction_reports",
						exportDate: new Date().toISOString(),
						totalRecords: filteredReports.length,
						data: filteredReports,
					});
				}
			} catch (error) {
				console.error("Error exporting transaction reports:", error);
				res.status(500).json({
					status: "error",
					error: "Failed to export transaction reports",
				});
			}
		},
	);

	// Get admin report statistics
	app.get("/api/admin/reports/stats", requireAdmin, async (req, res) => {
		try {
			const stats = {
				capitalGainsReports: {
					total: 156,
					completed: 142,
					pending: 8,
					failed: 6,
					thisMonth: 23,
					lastMonth: 18,
				},
				transactionReports: {
					total: 234,
					completed: 221,
					pending: 9,
					failed: 4,
					thisMonth: 31,
					lastMonth: 27,
				},
				totalUsers: 89,
				activeUsers: 76,
				totalReports: 390,
				reportsThisMonth: 54,
				averageProcessingTime: "2.3 minutes",
			};

			res.json({
				status: "success",
				data: stats,
			});
		} catch (error) {
			console.error("Error fetching admin report stats:", error);
			res.status(500).json({
				status: "error",
				error: "Failed to fetch admin report statistics",
			});
		}
	});

	// ============ END ADMIN REPORTS EXPORT ROUTES ============

	// AMFI Real Data API endpoint
	app.get("/api/amfi/real-data", async (req, res) => {
		try {
			const amfiData = await comprehensiveAIFPMSAPI.getAMFIMutualFundData();
			res.json({
				status: "success",
				data: amfiData.slice(0, 100), // Limit to first 100 for demo
				count: amfiData.length,
				source: "AMFI_OFFICIAL_API",
			});
		} catch (error) {
			console.error("Error fetching AMFI real data:", error);
			res.status(500).json({ error: "Failed to fetch AMFI real data" });
		}
	});

	// Comprehensive AIF and PMS API endpoints with detailed data
	app.get("/api/comprehensive/aif", async (req, res) => {
		try {
			const category = req.query.category as string;
			const aifData = await comprehensiveAIFPMSAPI.getComprehensiveAIFData(
				undefined,
				category,
			);
			res.json({
				status: "success",
				data: aifData,
				count: aifData.length,
			});
		} catch (error) {
			console.error("Error fetching comprehensive AIF data:", error);
			res.status(500).json({ error: "Failed to fetch comprehensive AIF data" });
		}
	});

	app.get("/api/comprehensive/aif/:aifId", async (req, res) => {
		try {
			const aifData = await comprehensiveAIFPMSAPI.getComprehensiveAIFData(
				req.params.aifId,
			);
			res.json({
				status: "success",
				data: aifData[0] || null,
			});
		} catch (error) {
			console.error("Error fetching specific AIF data:", error);
			res.status(500).json({ error: "Failed to fetch AIF details" });
		}
	});

	app.get("/api/comprehensive/aif/filter", async (req, res) => {
		try {
			const filters = {
				category: req.query.category as string,
				subCategory: req.query.subCategory as string,
				fundManager: req.query.fundManager as string,
				minAUM: req.query.minAUM
					? Number.parseInt(req.query.minAUM as string) * 10000000
					: undefined, // Convert Cr to actual value
				maxAUM: req.query.maxAUM
					? Number.parseInt(req.query.maxAUM as string) * 10000000
					: undefined,
				minReturns1Y: req.query.minReturns1Y
					? Number.parseFloat(req.query.minReturns1Y as string)
					: undefined,
				riskRating: req.query.riskRating as string,
			};

			const aifData = await comprehensiveAIFPMSAPI.getAIFByFilters(filters);

			// Enhanced response with performance analytics
			const performanceAnalytics = {
				topPerformers: aifData
					.sort(
						(a, b) =>
							(b.pastPerformance?.["1Y"] || 0) -
							(a.pastPerformance?.["1Y"] || 0),
					)
					.slice(0, 5),
				categoryWisePerformance: {
					"Category I":
						aifData
							.filter((f) => f.category === "Category I")
							.reduce((sum, f) => sum + (f.pastPerformance?.["1Y"] || 0), 0) /
							aifData.filter((f) => f.category === "Category I").length || 0,
					"Category II":
						aifData
							.filter((f) => f.category === "Category II")
							.reduce((sum, f) => sum + (f.pastPerformance?.["1Y"] || 0), 0) /
							aifData.filter((f) => f.category === "Category II").length || 0,
					"Category III":
						aifData
							.filter((f) => f.category === "Category III")
							.reduce((sum, f) => sum + (f.pastPerformance?.["1Y"] || 0), 0) /
							aifData.filter((f) => f.category === "Category III").length || 0,
				},
				riskMetrics: {
					avgVolatility:
						aifData.reduce(
							(sum, f) => sum + (f.riskMetrics?.volatility || 0),
							0,
						) / aifData.length,
					avgSharpeRatio:
						aifData.reduce(
							(sum, f) => sum + (f.riskMetrics?.sharpeRatio || 0),
							0,
						) / aifData.length,
					avgMaxDrawdown:
						aifData.reduce(
							(sum, f) => sum + Math.abs(f.riskMetrics?.maxDrawdown || 0),
							0,
						) / aifData.length,
				},
			};

			res.json({
				status: "success",
				data: aifData,
				count: aifData.length,
				filters: filters,
				analytics: performanceAnalytics,
				dataSources: ["SEBI", "PMS Bazaar", "PMS World"],
				lastUpdated: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error filtering AIF data:", error);
			res.status(500).json({ error: "Failed to filter AIF data" });
		}
	});

	app.get("/api/comprehensive/pms", async (req, res) => {
		try {
			const category = req.query.category as string;
			const pmsData = await comprehensiveAIFPMSAPI.getComprehensivePMSData(
				undefined,
				category,
			);
			res.json({
				status: "success",
				data: pmsData,
				count: pmsData.length,
			});
		} catch (error) {
			console.error("Error fetching comprehensive PMS data:", error);
			res.status(500).json({ error: "Failed to fetch comprehensive PMS data" });
		}
	});

	app.get("/api/comprehensive/pms/:pmsId", async (req, res) => {
		try {
			const pmsData = await comprehensiveAIFPMSAPI.getComprehensivePMSData(
				req.params.pmsId,
			);
			res.json({
				status: "success",
				data: pmsData[0] || null,
			});
		} catch (error) {
			console.error("Error fetching specific PMS data:", error);
			res.status(500).json({ error: "Failed to fetch PMS details" });
		}
	});

	app.get("/api/comprehensive/pms/filter", async (req, res) => {
		try {
			const filters = {
				category: req.query.category as string,
				subCategory: req.query.subCategory as string,
				fundManager: req.query.fundManager as string,
				minAUM: req.query.minAUM
					? Number.parseInt(req.query.minAUM as string)
					: undefined,
				maxAUM: req.query.maxAUM
					? Number.parseInt(req.query.maxAUM as string)
					: undefined,
				minReturns1Y: req.query.minReturns1Y
					? Number.parseFloat(req.query.minReturns1Y as string)
					: undefined,
				investmentStyle: req.query.investmentStyle as string,
			};

			const pmsData = await comprehensiveAIFPMSAPI.getPMSByFilters(filters);
			res.json({
				status: "success",
				data: pmsData,
				count: pmsData.length,
				filters: filters,
			});
		} catch (error) {
			console.error("Error filtering PMS data:", error);
			res.status(500).json({ error: "Failed to filter PMS data" });
		}
	});

	// Enhanced AIF Analytics API
	app.get("/api/aif/analytics", requireLevel2, async (req, res) => {
		try {
			const { timeframe = "1Y", category } = req.query;

			// Fetch comprehensive AIF data for analytics
			const aifData = await comprehensiveAIFPMSAPI.getComprehensiveAIFData(
				undefined,
				category as string,
			);

			// Market-wide analytics
			const marketAnalytics = {
				industryOverview: {
					totalAUM: aifData.reduce(
						(sum, fund) => sum + (fund.currentAUM || 0),
						0,
					),
					totalFunds: aifData.length,
					averagePerformance:
						aifData.reduce(
							(sum, fund) =>
								sum +
								((fund.pastPerformance as any)?.[timeframe as string] || 0),
							0,
						) / aifData.length,
					categoryDistribution: {
						"Category I":
							(aifData.filter((f) => f.category === "Category I").length /
								aifData.length) *
							100,
						"Category II":
							(aifData.filter((f) => f.category === "Category II").length /
								aifData.length) *
							100,
						"Category III":
							(aifData.filter((f) => f.category === "Category III").length /
								aifData.length) *
							100,
					},
				},
				performanceMetrics: {
					topPerformers: aifData
						.sort(
							(a, b) =>
								(b.pastPerformance?.[timeframe as string] || 0) -
								(a.pastPerformance?.[timeframe as string] || 0),
						)
						.slice(0, 10)
						.map((fund) => ({
							name: fund.schemaName,
							aifId: fund.aifId,
							category: fund.category,
							returns:
								(fund.pastPerformance as any)?.[timeframe as string] || 0,
							aum: fund.currentAUM,
							riskRating: fund.riskMetrics?.volatility || 0,
						})),
					categoryPerformance: [
						"Category I",
						"Category II",
						"Category III",
					].map((cat) => ({
						category: cat,
						avgReturns:
							aifData
								.filter((f) => f.category === cat)
								.reduce(
									(sum, f) =>
										sum + (f.pastPerformance?.[timeframe as string] || 0),
									0,
								) / aifData.filter((f) => f.category === cat).length || 0,
						fundCount: aifData.filter((f) => f.category === cat).length,
						totalAUM: aifData
							.filter((f) => f.category === cat)
							.reduce((sum, f) => sum + (f.currentAUM || 0), 0),
					})),
					riskMetrics: {
						avgVolatility:
							aifData.reduce(
								(sum, f) => sum + (f.riskMetrics?.volatility || 0),
								0,
							) / aifData.length,
						avgSharpeRatio:
							aifData.reduce(
								(sum, f) => sum + (f.riskMetrics?.sharpeRatio || 0),
								0,
							) / aifData.length,
						highestReturns: Math.max(
							...aifData.map(
								(f) => f.pastPerformance?.[timeframe as string] || 0,
							),
						),
						lowestReturns: Math.min(
							...aifData.map(
								(f) => f.pastPerformance?.[timeframe as string] || 0,
							),
						),
					},
				},
				marketTrends: {
					growthFunds: aifData.filter((f) =>
						f.fundType?.toLowerCase().includes("growth"),
					).length,
					valueFunds: aifData.filter((f) =>
						f.fundType?.toLowerCase().includes("value"),
					).length,
					sectorFunds: aifData.filter((f) =>
						f.subCategory?.toLowerCase().includes("sector"),
					).length,
					avgManagementFee:
						aifData.reduce((sum, f) => sum + (f.managementFee || 0), 0) /
						aifData.length,
					avgPerformanceFee:
						aifData.reduce((sum, f) => sum + (f.performanceFee || 0), 0) /
						aifData.length,
				},
			};

			res.json({
				status: "success",
				timeframe,
				category: category || "all",
				analytics: marketAnalytics,
				dataPoints: aifData.length,
				lastUpdated: new Date().toISOString(),
				dataSources: ["SEBI", "PMS Bazaar", "PMS World"],
			});
		} catch (error) {
			console.error("Error generating AIF analytics:", error);
			res.status(500).json({ error: "Failed to generate AIF analytics" });
		}
	});

	// Enable error monitoring middleware
	app.use(errorMonitoringMiddleware);

	// Gemini AI Error Analysis and Replit Agent Integration Endpoints
	app.get("/api/system/health", async (req, res) => {
		try {
			const health = errorMonitor.getSystemHealth();

			// Check API health status
			await errorMonitor.checkApiHealth(
				"AlphaVantage",
				"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=demo",
			);

			res.json({
				status: "success",
				health: health,
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
			});
		} catch (error) {
			console.error("Health check error:", error);
			res.status(500).json({ error: "Health check failed" });
		}
	});

	app.get("/api/system/errors/analysis", async (req, res) => {
		try {
			const analysis = await errorMonitor.generateErrorAnalysis();
			res.json({
				status: "success",
				analysis: analysis,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Error analysis failed:", error);
			res.status(500).json({ error: "Error analysis failed" });
		}
	});

	app.get("/api/system/code/analysis/:filePath(*)", async (req, res) => {
		try {
			const filePath = req.params.filePath;
			const analysis = await errorMonitor.analyzeCodeErrors(filePath);
			res.json({
				status: "success",
				file: filePath,
				analysis: analysis,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Code analysis failed:", error);
			res.status(500).json({ error: "Code analysis failed" });
		}
	});

	app.get("/api/replit-agent/instructions", async (req, res) => {
		try {
			const instructions = await errorMonitor.generateReplitAgentInstructions();

			res.json({
				status: "success",
				instructions: instructions,
				timestamp: new Date().toISOString(),
				message:
					"Comprehensive Replit Agent instructions generated by Gemini AI",
			});
		} catch (error) {
			console.error("Agent instructions generation failed:", error);
			res.status(500).json({ error: "Agent instructions generation failed" });
		}
	});
}
