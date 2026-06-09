// @ts-nocheck
import { Router, Request, Response } from "express";
import { z } from "zod";
import { reportOrchestratorService } from "../services/reports/report-orchestrator";
import { generatePortfolioReportPDF } from "../services/reports/pdf-renderer";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";
import { reportConfigSchema } from "@shared/schema";
import * as crypto from "crypto";

const router = Router();

router.get(
	"/api/portfolio-reports/clients-portfolios",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const { db } = await import("../db");
			const { users, portfolios } = await import("@shared/schema");
			const { eq, desc } = await import("drizzle-orm");

			const clients = await db
				.select({
					id: users.id,
					fullName: users.fullName,
					email: users.email,
				})
				.from(users)
				.orderBy(desc(users.createdAt))
				.limit(100);

			const clientPortfolios = await Promise.all(
				clients.map(async (client) => {
					try {
						const clientPortfolioList = await db
							.select({
								id: portfolios.id,
								userId: portfolios.userId,
								name: portfolios.name,
								totalValue: portfolios.totalValue,
								source: portfolios.source,
							})
							.from(portfolios)
							.where(eq(portfolios.userId, client.id));
						return {
							...client,
							portfolios: clientPortfolioList,
						};
					} catch {
						return { ...client, portfolios: [] };
					}
				}),
			);

			res.json({ success: true, clients: clientPortfolios });
		} catch (error) {
			console.error("[Portfolio Reports] Error fetching clients:", error);
			res.status(500).json({ error: "Failed to fetch clients and portfolios" });
		}
	},
);

router.post(
	"/api/portfolio-reports/validate",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const config = reportConfigSchema.parse(req.body);
			const validation =
				await reportOrchestratorService.runPreFlightValidation(config);
			res.json({ success: true, validation });
		} catch (error) {
			console.error("[Portfolio Reports] Validation error:", error);
			if (error instanceof z.ZodError) {
				return res
					.status(400)
					.json({ error: "Invalid configuration", details: error.issues });
			}
			res.status(500).json({ error: "Validation failed" });
		}
	},
);

router.post(
	"/api/portfolio-reports/generate",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { config, clientId, reportName, templateId } = req.body;
			const parsedConfig = reportConfigSchema.parse(config);

			const validation =
				await reportOrchestratorService.runPreFlightValidation(parsedConfig);
			if (!validation.success && validation.issues.length > 0) {
				return res.status(400).json({
					error: "Pre-flight validation failed",
					validation,
				});
			}

			const report = await reportOrchestratorService.createGeneratedReport(
				parsedConfig,
				userId,
				clientId,
				{ templateId, reportName },
			);

			await reportOrchestratorService.updateReportStatus(
				report.id,
				"generating",
			);

			try {
				const portfolioData = await reportOrchestratorService.getPortfolioData(
					parsedConfig.portfolioId,
				);
				if (!portfolioData) {
					throw new Error("Portfolio not found");
				}

				const pdfBuffer = await generatePortfolioReportPDF(
					parsedConfig,
					portfolioData,
				);
				const checksum = crypto
					.createHash("sha256")
					.update(pdfBuffer)
					.digest("hex");

				const base64Pdf = pdfBuffer.toString("base64");
				const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

				await reportOrchestratorService.updateReportStatus(
					report.id,
					"generated",
					{
						fileUrl: dataUrl,
						fileSize: pdfBuffer.length,
						hashChecksum: checksum,
					},
				);

				await reportOrchestratorService.logAudit(
					report.id,
					"generated",
					userId,
					{
						ipAddress: req.ip,
						userAgent: req.get("user-agent"),
					},
				);

				res.json({
					success: true,
					report: {
						...report,
						status: "generated",
						fileUrl: dataUrl,
						fileSize: pdfBuffer.length,
						hashChecksum: checksum,
					},
				});
			} catch (genError) {
				console.error("[Portfolio Reports] Generation error:", genError);
				await reportOrchestratorService.updateReportStatus(
					report.id,
					"failed",
					{
						errorMessage: (genError as Error).message,
					},
				);
				throw genError;
			}
		} catch (error) {
			console.error("[Portfolio Reports] Error generating report:", error);
			if (error instanceof z.ZodError) {
				return res
					.status(400)
					.json({ error: "Invalid configuration", details: error.issues });
			}
			res.status(500).json({ error: "Report generation failed" });
		}
	},
);

router.get(
	"/api/portfolio-reports/generated",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const reports =
				await reportOrchestratorService.getGeneratedReports(userId);
			res.json({ success: true, reports });
		} catch (error) {
			console.error("[Portfolio Reports] Error fetching reports:", error);
			res.status(500).json({ error: "Failed to fetch reports" });
		}
	},
);

router.get(
	"/api/portfolio-reports/generated/:id",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			const report = await reportOrchestratorService.getGeneratedReport(
				req.params.id,
			);

			if (!report) {
				return res.status(404).json({ error: "Report not found" });
			}

			await reportOrchestratorService.logAudit(
				report.id,
				"downloaded",
				userId,
				{
					ipAddress: req.ip,
					userAgent: req.get("user-agent"),
				},
			);

			res.json({ success: true, report });
		} catch (error) {
			console.error("[Portfolio Reports] Error fetching report:", error);
			res.status(500).json({ error: "Failed to fetch report" });
		}
	},
);

router.post(
	"/api/portfolio-reports/templates",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { name, config, description, isDefault, isPublic, category } =
				req.body;

			if (!name || !config) {
				return res.status(400).json({ error: "Name and config are required" });
			}

			const parsedConfig = reportConfigSchema.parse(config);

			const template = await reportOrchestratorService.saveTemplate(
				name,
				parsedConfig,
				userId,
				{ description, isDefault, isPublic, category },
			);

			res.json({ success: true, template });
		} catch (error) {
			console.error("[Portfolio Reports] Error saving template:", error);
			if (error instanceof z.ZodError) {
				return res
					.status(400)
					.json({ error: "Invalid configuration", details: error.issues });
			}
			res.status(500).json({ error: "Failed to save template" });
		}
	},
);

router.get(
	"/api/portfolio-reports/templates",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			let templates: any[] = [];
			try {
				templates = await reportOrchestratorService.getTemplates(userId);
			} catch (err: any) {
				if (err?.code === "42P01") {
					templates = [];
				} else {
					throw err;
				}
			}
			res.json({ success: true, templates });
		} catch (error) {
			console.error("[Portfolio Reports] Error fetching templates:", error);
			res.status(500).json({ error: "Failed to fetch templates" });
		}
	},
);

router.get(
	"/api/portfolio-reports/templates/:id",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const template = await reportOrchestratorService.getTemplate(
				req.params.id,
			);

			if (!template) {
				return res.status(404).json({ error: "Template not found" });
			}

			res.json({ success: true, template });
		} catch (error) {
			console.error("[Portfolio Reports] Error fetching template:", error);
			res.status(500).json({ error: "Failed to fetch template" });
		}
	},
);

router.delete(
	"/api/portfolio-reports/templates/:id",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			await reportOrchestratorService.deleteTemplate(req.params.id, userId);
			res.json({ success: true, message: "Template deleted" });
		} catch (error) {
			console.error("[Portfolio Reports] Error deleting template:", error);
			res.status(500).json({ error: "Failed to delete template" });
		}
	},
);

router.get(
	"/api/portfolio-reports/:id/audit",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const logs = await reportOrchestratorService.getAuditLogs(req.params.id);
			res.json({ success: true, logs });
		} catch (error) {
			console.error("[Portfolio Reports] Error fetching audit logs:", error);
			res.status(500).json({ error: "Failed to fetch audit logs" });
		}
	},
);

router.post(
	"/api/portfolio-reports/:id/attach-proposal",
	requireAuth,
	requireRole("agent", "partner", "admin"),
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { proposalId } = req.body;
			if (!proposalId) {
				return res.status(400).json({ error: "Proposal ID is required" });
			}

			await reportOrchestratorService.attachToProposal(
				req.params.id,
				proposalId,
				userId,
			);
			res.json({ success: true, message: "Report attached to proposal" });
		} catch (error) {
			console.error("[Portfolio Reports] Error attaching to proposal:", error);
			res.status(500).json({ error: "Failed to attach report to proposal" });
		}
	},
);

router.get(
	"/api/portfolio-reports/benchmarks",
	requireAuth,
	async (req: Request, res: Response) => {
		const benchmarks = [
			{ id: "nifty50", name: "NIFTY 50", type: "index" },
			{ id: "sensex", name: "BSE SENSEX", type: "index" },
			{ id: "nifty100", name: "NIFTY 100", type: "index" },
			{ id: "bse100", name: "BSE 100", type: "index" },
			{ id: "nifty_midcap", name: "NIFTY Midcap 100", type: "index" },
			{ id: "nifty_smallcap", name: "NIFTY Smallcap 100", type: "index" },
			{ id: "nifty_bank", name: "NIFTY Bank", type: "index" },
			{ id: "nifty_it", name: "NIFTY IT", type: "index" },
		];
		res.json({ success: true, benchmarks });
	},
);

router.get(
	"/api/portfolio-reports/sample",
	async (req: Request, res: Response) => {
		try {
			const sampleReport = {
				reportId: "sample-001",
				generatedAt: new Date().toISOString(),
				client: {
					name: "Rajesh Kumar",
					pan: "ABCPK1234L",
					email: "rajesh.kumar@email.com",
					riskProfile: "Moderate",
					investorType: "Individual",
				},
				agent: {
					name: "Priya Sharma",
					code: "AGT-2024-001",
					contact: "+91 98765 43210",
				},
				portfolio: {
					name: "Growth Portfolio",
					totalValue: 2545000,
					investedValue: 2150000,
					dayChange: 12500,
					dayChangePercent: 0.49,
					overallGain: 395000,
					overallGainPercent: 18.37,
					xirr: 14.52,
					cagr: 12.8,
				},
				assetAllocation: {
					current: [
						{
							asset: "Equity",
							value: 1527000,
							percentage: 60,
							color: "#4F46E5",
							subCategories: [
								{ name: "Large Cap", value: 764000, percentage: 30 },
								{ name: "Mid Cap", value: 509000, percentage: 20 },
								{ name: "Small Cap", value: 254000, percentage: 10 },
							],
						},
						{
							asset: "Debt",
							value: 763500,
							percentage: 30,
							color: "#10B981",
							subCategories: [
								{ name: "Corporate Bonds", value: 382000, percentage: 15 },
								{
									name: "Government Securities",
									value: 254500,
									percentage: 10,
								},
								{ name: "Liquid Funds", value: 127000, percentage: 5 },
							],
						},
						{ asset: "Gold", value: 178150, percentage: 7, color: "#F59E0B" },
						{
							asset: "Cash & Equivalents",
							value: 76350,
							percentage: 3,
							color: "#6B7280",
						},
					],
					target: [
						{ asset: "Equity", percentage: 55 },
						{ asset: "Debt", percentage: 35 },
						{ asset: "Gold", percentage: 5 },
						{ asset: "Cash & Equivalents", percentage: 5 },
					],
					rebalancingNeeded: true,
					driftPercentage: 5,
				},
				sectorExposure: [
					{ sector: "Financial Services", percentage: 28, value: 712600 },
					{ sector: "Information Technology", percentage: 22, value: 559900 },
					{ sector: "Consumer Goods", percentage: 15, value: 381750 },
					{ sector: "Healthcare", percentage: 12, value: 305400 },
					{ sector: "Energy", percentage: 10, value: 254500 },
					{ sector: "Others", percentage: 13, value: 330850 },
				],
				topHoldings: [
					{
						name: "HDFC Flexi Cap Fund",
						type: "Mutual Fund",
						value: 450000,
						percentage: 17.7,
						returns1Y: 18.5,
						rating: 5,
					},
					{
						name: "Reliance Industries",
						type: "Stock",
						value: 320000,
						percentage: 12.6,
						returns1Y: 22.3,
					},
					{
						name: "SBI Magnum Gilt Fund",
						type: "Mutual Fund",
						value: 280000,
						percentage: 11.0,
						returns1Y: 7.2,
						rating: 4,
					},
					{
						name: "ICICI Prudential Bluechip",
						type: "Mutual Fund",
						value: 250000,
						percentage: 9.8,
						returns1Y: 16.8,
						rating: 5,
					},
					{
						name: "TCS",
						type: "Stock",
						value: 220000,
						percentage: 8.6,
						returns1Y: 14.2,
					},
					{
						name: "HDFC Bank",
						type: "Stock",
						value: 180000,
						percentage: 7.1,
						returns1Y: 12.5,
					},
					{
						name: "Infosys",
						type: "Stock",
						value: 160000,
						percentage: 6.3,
						returns1Y: 8.9,
					},
					{
						name: "Axis Long Term Equity",
						type: "ELSS",
						value: 150000,
						percentage: 5.9,
						returns1Y: 19.2,
						rating: 4,
					},
				],
				riskMetrics: {
					beta: 0.85,
					sharpeRatio: 1.24,
					standardDeviation: 12.3,
					maxDrawdown: -8.2,
					volatility: "Moderate",
					riskScore: 65,
					riskCategory: "Moderate",
				},
				performanceHistory: [
					{ period: "1M", portfolioReturn: 2.1, benchmarkReturn: 1.8 },
					{ period: "3M", portfolioReturn: 5.4, benchmarkReturn: 4.9 },
					{ period: "6M", portfolioReturn: 8.7, benchmarkReturn: 7.2 },
					{ period: "1Y", portfolioReturn: 16.8, benchmarkReturn: 12.6 },
					{ period: "3Y", portfolioReturn: 42.5, benchmarkReturn: 35.8 },
					{ period: "5Y", portfolioReturn: 78.2, benchmarkReturn: 65.4 },
				],
				goals: [
					{
						name: "Retirement Corpus",
						targetAmount: 50000000,
						currentValue: 1200000,
						targetDate: "2045-01-01",
						progress: 24,
						onTrack: true,
					},
					{
						name: "Child Education",
						targetAmount: 5000000,
						currentValue: 800000,
						targetDate: "2032-06-01",
						progress: 45,
						onTrack: true,
					},
					{
						name: "House Down Payment",
						targetAmount: 3000000,
						currentValue: 545000,
						targetDate: "2028-01-01",
						progress: 18,
						onTrack: false,
						shortfall: 150000,
					},
				],
				freshInvestments: {
					lumpsumRecommendations: [
						{
							name: "Parag Parikh Flexi Cap Fund",
							category: "Equity - Flexi Cap",
							minAmount: 5000,
							expectedReturn: 14.5,
							riskLevel: "Moderate",
							rating: 5,
							matchScore: 95,
							reason: "Excellent diversification with international exposure",
						},
						{
							name: "HDFC Corporate Bond Fund",
							category: "Debt - Corporate Bond",
							minAmount: 5000,
							expectedReturn: 7.8,
							riskLevel: "Low",
							rating: 4,
							matchScore: 88,
							reason: "High quality AAA rated bonds for stable returns",
						},
						{
							name: "Mirae Asset Large Cap Fund",
							category: "Equity - Large Cap",
							minAmount: 5000,
							expectedReturn: 13.2,
							riskLevel: "Moderate",
							rating: 5,
							matchScore: 92,
							reason: "Consistent performer in large cap space",
						},
					],
					sipRecommendations: [
						{
							name: "Axis Small Cap Fund",
							category: "Equity - Small Cap",
							minSIP: 500,
							suggestedSIP: 5000,
							expectedReturn: 18.5,
							riskLevel: "High",
							rating: 5,
							matchScore: 90,
							reason: "High growth potential with SIP averaging benefit",
						},
						{
							name: "SBI Equity Hybrid Fund",
							category: "Hybrid - Balanced",
							minSIP: 500,
							suggestedSIP: 10000,
							expectedReturn: 11.5,
							riskLevel: "Moderate",
							rating: 4,
							matchScore: 93,
							reason: "Balanced approach with automatic rebalancing",
						},
						{
							name: "Kotak Emerging Equity Fund",
							category: "Equity - Mid Cap",
							minSIP: 1000,
							suggestedSIP: 7500,
							expectedReturn: 15.8,
							riskLevel: "Moderate-High",
							rating: 5,
							matchScore: 88,
							reason: "Strong mid-cap exposure for wealth creation",
						},
					],
					investableSurplus: 200000,
					suggestedAllocation: {
						lumpsum: 100000,
						sipMonthly: 15000,
					},
				},
				aiInsights: [
					{
						type: "opportunity",
						title: "Tax Loss Harvesting",
						description:
							"Switch from underperforming small cap fund to save ₹12,000 in taxes",
						priority: "high",
						actionable: true,
					},
					{
						type: "rebalancing",
						title: "Portfolio Rebalancing",
						description:
							"Equity allocation is 5% above target. Consider moving ₹1.2L to debt",
						priority: "medium",
						actionable: true,
					},
					{
						type: "risk",
						title: "Sector Concentration",
						description:
							"IT sector at 22% - consider diversifying into pharma or auto",
						priority: "low",
						actionable: false,
					},
					{
						type: "goal",
						title: "House Down Payment Gap",
						description:
							"Increase SIP by ₹8,000/month to stay on track for 2028 goal",
						priority: "high",
						actionable: true,
					},
				],
				comparisonWithBenchmark: {
					benchmarkName: "NIFTY 50 TRI",
					alpha: 4.2,
					tracking: "Outperforming",
					periods: [
						{ period: "1Y", portfolio: 16.8, benchmark: 12.6, difference: 4.2 },
						{ period: "3Y", portfolio: 42.5, benchmark: 35.8, difference: 6.7 },
						{
							period: "5Y",
							portfolio: 78.2,
							benchmark: 65.4,
							difference: 12.8,
						},
					],
				},
				disclaimers: [
					"Past performance is not indicative of future results.",
					"Mutual fund investments are subject to market risks. Read all scheme-related documents carefully.",
					"The recommendations provided are based on your risk profile and investment objectives.",
					"This report is for informational purposes only and does not constitute investment advice.",
				],
			};

			res.json({ success: true, report: sampleReport });
		} catch (error) {
			console.error(
				"[Portfolio Reports] Error generating sample report:",
				error,
			);
			res.status(500).json({ error: "Failed to generate sample report" });
		}
	},
);

router.get(
	"/api/portfolio-reports/customization-options",
	async (req: Request, res: Response) => {
		const options = {
			sections: [
				{
					id: "portfolioSnapshot",
					name: "Portfolio Snapshot",
					description: "Overview of portfolio value and returns",
					default: true,
				},
				{
					id: "assetAllocation",
					name: "Asset Allocation",
					description: "Donut chart with current vs target allocation",
					default: true,
				},
				{
					id: "sectorExposure",
					name: "Sector Exposure",
					description: "Breakdown by industry sectors",
					default: true,
				},
				{
					id: "topHoldings",
					name: "Top Holdings",
					description: "List of major investments",
					default: true,
				},
				{
					id: "riskMetrics",
					name: "Risk Metrics",
					description: "Beta, Sharpe ratio, volatility analysis",
					default: true,
				},
				{
					id: "performanceHistory",
					name: "Performance History",
					description: "Returns comparison with benchmark",
					default: true,
				},
				{
					id: "goals",
					name: "Goal Tracking",
					description: "Progress towards financial goals",
					default: false,
				},
				{
					id: "freshInvestments",
					name: "Fresh Investment Ideas",
					description: "Lumpsum and SIP recommendations",
					default: false,
				},
				{
					id: "aiInsights",
					name: "AI Insights",
					description: "Smart recommendations and alerts",
					default: true,
				},
				{
					id: "disclaimers",
					name: "Disclaimers",
					description: "SEBI-compliant disclosures",
					default: true,
				},
			],
			timePeriods: ["1M", "3M", "6M", "1Y", "3Y", "5Y", "Since Inception"],
			benchmarks: [
				{ id: "nifty50", name: "NIFTY 50 TRI" },
				{ id: "sensex", name: "BSE SENSEX TRI" },
				{ id: "nifty100", name: "NIFTY 100" },
				{ id: "nifty_midcap", name: "NIFTY Midcap 150" },
			],
			branding: {
				showLogo: true,
				showAgentDetails: true,
				customColor: "#4F46E5",
				watermark: false,
			},
			exportFormats: ["PDF", "Excel", "Web Link"],
		};

		res.json({ success: true, options });
	},
);

export default router;
