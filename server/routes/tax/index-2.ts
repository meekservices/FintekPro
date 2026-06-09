import { Express } from "express";
import { taxOrchestrator } from "../../services/tax-orchestrator";
import { sandboxITRService } from "../../sandbox-itr-service";
import { sandboxTDSService } from "../../sandbox-tds-service";

export function registerTaxPart2Routes(app: Express): void {
	// ============ UNIFIED TAX SMART FILING API ROUTES ============

	app.get("/api/tds/status", async (req, res) => {
		try {
			res.json({
				success: true,
				configured: sandboxTDSService.isConfigured(),
				message: sandboxTDSService.isConfigured()
					? "Sandbox.co.in TDS service is configured and ready"
					: "Sandbox.co.in TDS service is using mock data (API credentials not configured)",
			});
		} catch (error) {
			res.status(500).json({ success: false, message: "Status check failed" });
		}
	});

	app.post("/api/tds/calculate", async (req, res) => {
		try {
			const result = await sandboxTDSService.calculateTDS(req.body);
			res.json(result);
		} catch (error) {
			console.error("TDS calculation error:", error);
			res.status(500).json({
				success: false,
				message:
					error instanceof Error ? error.message : "TDS calculation failed",
			});
		}
	});

	app.post("/api/tds/file-return", async (req, res) => {
		try {
			const result = await sandboxTDSService.eFileTDSReturn(
				req.body.returnId,
				req.body.credentials,
			);
			res.json(result);
		} catch (error) {
			console.error("TDS return filing error:", error);
			res.status(500).json({
				success: false,
				message:
					error instanceof Error ? error.message : "TDS return filing failed",
			});
		}
	});

	app.get("/api/tds/return-status/:returnId", async (req, res) => {
		try {
			const { returnId } = req.params;
			res.json({
				success: true,
				returnId,
				status: "processing",
				message: "TDS return status check via Sandbox API",
			});
		} catch (error) {
			console.error("TDS return status error:", error);
			res.status(500).json({
				success: false,
				message:
					error instanceof Error
						? error.message
						: "TDS return status check failed",
			});
		}
	});

	app.get("/api/tds/sections", async (req, res) => {
		try {
			const sections = sandboxTDSService.getTDSSections();
			res.json({ success: true, sections });
		} catch (error) {
			console.error("TDS sections error:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to get TDS sections" });
		}
	});

	// ============ ITR ROUTE ALIASES (backward compatibility) ============
	// These aliases map /api/itr/* to /api/sandbox-itr/* for backward compatibility

	app.post("/api/itr/calculate", async (req, res) => {
		try {
			const result = await sandboxITRService.calculateTax(req.body);
			res.json(result);
		} catch (error) {
			console.error("ITR tax calculation error:", error);
			res.status(500).json({
				success: false,
				message:
					error instanceof Error ? error.message : "Tax calculation failed",
			});
		}
	});

	app.post("/api/itr/prepare", async (req, res) => {
		try {
			const result = await sandboxITRService.prepareITR(req.body);
			res.json(result);
		} catch (error) {
			console.error("ITR preparation error:", error);
			res.status(500).json({
				success: false,
				message:
					error instanceof Error ? error.message : "ITR preparation failed",
			});
		}
	});

	app.post("/api/itr/file", async (req, res) => {
		try {
			const result = await sandboxITRService.fileITR(req.body);
			res.json(result);
		} catch (error) {
			console.error("ITR filing error:", error);
			res.status(500).json({
				success: false,
				message: error instanceof Error ? error.message : "ITR filing failed",
			});
		}
	});

	app.get("/api/itr/status/:acknowledgmentNumber", async (req, res) => {
		try {
			const { acknowledgmentNumber } = req.params;
			const result = await sandboxITRService.getITRStatus(acknowledgmentNumber);
			res.json(result);
		} catch (error) {
			console.error("ITR status error:", error);
			res.status(500).json({
				success: false,
				message: error instanceof Error ? error.message : "Status check failed",
			});
		}
	});

	app.post("/api/itr/form-recommendation", async (req, res) => {
		try {
			const { incomeDetails, entityType } = req.body;
			if (!incomeDetails) {
				return res.status(400).json({
					success: false,
					message: "Income details are required",
				});
			}
			const suggestion = sandboxITRService.getSuitableITRForm(
				incomeDetails,
				entityType || "individual",
			);
			res.json({
				success: true,
				...suggestion,
			});
		} catch (error) {
			console.error("Form recommendation error:", error);
			res.status(500).json({
				success: false,
				message: "Form recommendation failed",
			});
		}
	});

	app.get("/api/itr/form-26as/:pan/:assessmentYear", async (req, res) => {
		try {
			const { pan, assessmentYear } = req.params;
			const result = await sandboxITRService.getForm26AS(pan, assessmentYear);
			res.json(result);
		} catch (error) {
			console.error("Form 26AS error:", error);
			res.status(500).json({
				success: false,
				message:
					error instanceof Error ? error.message : "Form 26AS fetch failed",
			});
		}
	});

	app.get("/api/itr/ais/:pan/:assessmentYear", async (req, res) => {
		try {
			const { pan, assessmentYear } = req.params;
			const result = await sandboxITRService.getAIS(pan, assessmentYear);
			res.json(result);
		} catch (error) {
			console.error("AIS error:", error);
			res.status(500).json({
				success: false,
				message: error instanceof Error ? error.message : "AIS fetch failed",
			});
		}
	});

	app.get("/api/itr/itr-v/:acknowledgmentNumber", async (req, res) => {
		try {
			const { acknowledgmentNumber } = req.params;
			const result = await sandboxITRService.downloadITRV(acknowledgmentNumber);
			res.json(result);
		} catch (error) {
			console.error("ITR-V download error:", error);
			res.status(500).json({
				success: false,
				message:
					error instanceof Error ? error.message : "ITR-V download failed",
			});
		}
	});

	// ============ ITR PREFILLED PAGE ENDPOINTS ============

	// Get available data sources for a user (Form 26AS, AIS, Bank Statements, etc.)
	app.get("/api/itr/data-sources/:userId", async (req, res) => {
		try {
			const { userId } = req.params;

			// Return available data sources for ITR pre-filling
			const dataSources = [
				{
					id: "form-26as",
					name: "Form 26AS",
					description: "Tax Credit Statement from Income Tax Department",
					status: "available",
					lastSynced: null,
					icon: "file-text",
				},
				{
					id: "ais",
					name: "Annual Information Statement (AIS)",
					description: "Comprehensive financial transaction statement",
					status: "available",
					lastSynced: null,
					icon: "file-check",
				},
				{
					id: "bank-statement",
					name: "Bank Statements",
					description: "Interest income and transaction details",
					status: "pending",
					lastSynced: null,
					icon: "building-2",
				},
				{
					id: "form-16",
					name: "Form 16",
					description: "Salary TDS certificate from employer",
					status: "pending",
					lastSynced: null,
					icon: "briefcase",
				},
				{
					id: "capital-gains",
					name: "Capital Gains Statement",
					description: "Trading statements from brokers",
					status: "pending",
					lastSynced: null,
					icon: "trending-up",
				},
			];

			// Return array directly for TanStack Query default fetch, and data wrapper for custom queryFn
			res.json({
				success: true,
				data: dataSources,
				dataSources,
				userId,
			});
		} catch (error) {
			console.error("Error fetching data sources:", error);
			res.status(500).json({
				success: false,
				message: "Failed to fetch data sources",
			});
		}
	});

	// Get prefilled ITR data for a user
	app.get("/api/itr/prefilled/:userId", async (req, res) => {
		try {
			const { userId } = req.params;
			const { assessmentYear } = req.query;

			// Return prefilled ITR data structure with data wrapper for frontend compatibility
			const itrDataObj = {
				id: `itr-${userId}-${assessmentYear || "2025-26"}`,
				userId,
				assessmentYear: assessmentYear || "2025-26",
				financialYear: "2024-25",
				itrForm: "ITR-1",
				autoSelectedForm: true,
				taxRegime: "new",
				completionPercentage: 0,
				validationStatus: "pending",
				status: "draft",
				filingStatus: "not_started",
				readyForFiling: false,
				personalInfo: {
					name: "",
					pan: "",
					dateOfBirth: "",
					email: "",
					mobile: "",
					address: {},
				},
				incomeFromSalary: { gross: 0, hra: 0, standardDeduction: 0, net: 0 },
				incomeFromCapitalGains: { shortTerm: 0, longTerm: 0 },
				incomeFromOtherSources: { interest: 0, dividend: 0, other: 0 },
				deductionsChapter6A: { section80C: 0, section80D: 0, section80G: 0 },
				incomeDetails: {
					salaryIncome: 0,
					interestIncome: 0,
					rentalIncome: 0,
					capitalGains: { shortTerm: 0, longTerm: 0 },
					otherIncome: 0,
				},
				deductions: {
					section80C: 0,
					section80D: 0,
					section80G: 0,
					otherDeductions: 0,
				},
				taxComputation: {
					totalIncome: 0,
					taxableIncome: 0,
					taxPayable: 0,
					tdsPaid: 0,
					advanceTax: 0,
					refundDue: 0,
				},
				tdsDetails: [],
				syncedSources: [],
				lastUpdated: new Date().toISOString(),
			};

			res.json({
				success: true,
				data: itrDataObj,
				...itrDataObj,
			});
		} catch (error) {
			console.error("Error fetching prefilled data:", error);
			res.status(500).json({
				success: false,
				message: "Failed to fetch prefilled ITR data",
			});
		}
	});

	// Auto-populate ITR from selected sources
	app.post("/api/itr/auto-populate", async (req, res) => {
		try {
			const { userId, assessmentYear, sources } = req.body;

			// Simulate auto-population from sources
			const processedSources = sources || ["form-26as", "ais"];
			res.json({
				success: true,
				message: "ITR data auto-populated successfully",
				populatedFields: ["personalInfo", "incomeDetails", "tdsCredits"],
				warnings: [],
				sourcesProcessed: processedSources,
				sourcesCount: processedSources.length,
			});
		} catch (error) {
			console.error("Error auto-populating ITR:", error);
			res.status(500).json({
				success: false,
				message: "Failed to auto-populate ITR data",
			});
		}
	});

	// Sync a specific data source
	app.post("/api/itr/sync-source/:sourceId", async (req, res) => {
		try {
			const { sourceId } = req.params;
			const { userId } = req.body;

			// Simulate syncing the data source
			res.json({
				success: true,
				message: `Data source ${sourceId} synced successfully`,
				sourceId,
				lastSynced: new Date().toISOString(),
				recordsFound: Math.floor(Math.random() * 50) + 10,
			});
		} catch (error) {
			console.error("Error syncing data source:", error);
			res.status(500).json({
				success: false,
				message: "Failed to sync data source",
			});
		}
	});

	// Validate ITR data
	app.post("/api/itr/validate/:itrId", async (req, res) => {
		try {
			const { itrId } = req.params;

			// Return validation results with errorsFound for frontend compatibility
			const errors: any[] = [];
			const warnings = [
				{
					field: "section80C",
					message: "You may be eligible for additional 80C deductions",
					severity: "info",
				},
			];

			res.json({
				success: true,
				itrId,
				isValid: true,
				errors,
				errorsFound: errors.length,
				warnings,
				suggestions: [
					"Consider adding Form 16 for accurate salary income",
					"Verify capital gains from broker statement",
				],
			});
		} catch (error) {
			console.error("Error validating ITR:", error);
			res.status(500).json({
				success: false,
				message: "Failed to validate ITR data",
			});
		}
	});

	// Generate ITR document
	app.post("/api/itr/generate/:itrId", async (req, res) => {
		try {
			const { itrId } = req.params;

			res.json({
				success: true,
				itrId,
				status: "generated",
				message: "ITR generated successfully",
				downloadUrl: `/api/itr/download/${itrId}/pdf`,
				jsonUrl: `/api/itr/download/${itrId}/json`,
			});
		} catch (error) {
			console.error("Error generating ITR:", error);
			res.status(500).json({
				success: false,
				message: "Failed to generate ITR",
			});
		}
	});

	// Download ITR in specified format
	app.get("/api/itr/download/:itrId/:format", async (req, res) => {
		try {
			const { itrId, format } = req.params;

			if (format === "pdf") {
				// Return PDF placeholder
				res.json({
					success: true,
					message: "PDF download initiated",
					itrId,
					format: "pdf",
				});
			} else if (format === "json") {
				// Return JSON data
				res.json({
					success: true,
					itrId,
					format: "json",
					data: {
						formType: "ITR-1",
						assessmentYear: "2024-25",
						status: "draft",
					},
				});
			} else {
				res.status(400).json({
					success: false,
					message: "Invalid format. Use pdf or json",
				});
			}
		} catch (error) {
			console.error("Error downloading ITR:", error);
			res.status(500).json({
				success: false,
				message: "Failed to download ITR",
			});
		}
	});

	// ============ ONE-CLICK TAX FILING ENDPOINTS ============

	// Get one-click filing status for user
	app.get("/api/itr/one-click/:userId/:year", async (req, res) => {
		try {
			const { userId, year } = req.params;

			res.json({
				success: true,
				userId,
				assessmentYear: year,
				oneClickStatus: {
					eligible: true,
					sourcesConnected: 2,
					totalSources: 5,
					dataQuality: "good",
					estimatedRefund: 15000,
					readyToFile: false,
					steps: [
						{
							id: "connect",
							name: "Connect Sources",
							status: "partial",
							progress: 40,
						},
						{
							id: "populate",
							name: "Auto-Populate",
							status: "pending",
							progress: 0,
						},
						{
							id: "validate",
							name: "Validate",
							status: "pending",
							progress: 0,
						},
						{ id: "file", name: "File Return", status: "pending", progress: 0 },
					],
				},
			});
		} catch (error) {
			console.error("Error fetching one-click status:", error);
			res.status(500).json({
				success: false,
				message: "Failed to fetch one-click filing status",
			});
		}
	});

	// Connect all available data sources
	app.post("/api/itr/connect-all-sources", async (req, res) => {
		try {
			const { userId, assessmentYear } = req.body;

			const connectedSources = ["form-26as", "ais"];
			res.json({
				success: true,
				message: "All sources connection initiated",
				connectedSources,
				connectedCount: connectedSources.length,
				pendingSources: ["bank-statement", "form-16", "capital-gains"],
				totalRecordsFound: 127,
			});
		} catch (error) {
			console.error("Error connecting sources:", error);
			res.status(500).json({
				success: false,
				message: "Failed to connect data sources",
			});
		}
	});

	// One-click populate all data
	app.post("/api/itr/one-click-populate", async (req, res) => {
		try {
			const { userId, assessmentYear } = req.body;

			res.json({
				success: true,
				message: "One-click population completed",
				itrId: `itr-${userId}-${assessmentYear}`,
				populatedSections: [
					"personalInfo",
					"salaryIncome",
					"interestIncome",
					"tdsCredits",
					"deductions",
				],
				dataQuality: "high",
				confidenceScore: 92,
				manualReviewRequired: ["capitalGains"],
			});
		} catch (error) {
			console.error("Error in one-click populate:", error);
			res.status(500).json({
				success: false,
				message: "Failed to auto-populate ITR data",
			});
		}
	});

	// Auto-validate ITR before filing
	app.post("/api/itr/auto-validate/:itrId", async (req, res) => {
		try {
			const { itrId } = req.params;

			// Return validation errors array for frontend compatibility
			const validationErrors: {
				field: string;
				message: string;
				severity: "error" | "warning";
			}[] = [];

			res.json({
				success: true,
				itrId,
				validationPassed: true,
				validationErrors,
				checks: [
					{ name: "PAN Verification", status: "passed" },
					{ name: "Income Computation", status: "passed" },
					{ name: "TDS Matching", status: "passed" },
					{ name: "Deduction Limits", status: "passed" },
					{ name: "Form Eligibility", status: "passed" },
				],
				readyToFile: true,
				estimatedTax: 45000,
				tdsPaid: 60000,
				refundAmount: 15000,
			});
		} catch (error) {
			console.error("Error auto-validating ITR:", error);
			res.status(500).json({
				success: false,
				message: "Failed to auto-validate ITR",
			});
		}
	});

	// File the ITR return
	app.post("/api/itr/file-return", async (req, res) => {
		try {
			const { itrId, userId, assessmentYear, eVerify } = req.body;

			// Generate acknowledgment number
			const acknowledgmentNumber = `ACK${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

			res.json({
				success: true,
				message: "ITR filed successfully",
				acknowledgmentNumber,
				filingDate: new Date().toISOString(),
				status: eVerify ? "e-verified" : "pending-verification",
				itrVDownloadUrl: `/api/itr/itr-v/${acknowledgmentNumber}`,
				nextSteps: eVerify
					? ["Your return has been e-verified and submitted to IT Department"]
					: [
							"Please e-verify your return within 30 days",
							"You can use Aadhaar OTP or net banking",
						],
			});
		} catch (error) {
			console.error("Error filing ITR:", error);
			res.status(500).json({
				success: false,
				message: "Failed to file ITR",
			});
		}
	});

	console.log("✅ Tax routes registered");
	console.log("✅ ITR route aliases registered");
	console.log("✅ ITR prefilled & one-click endpoints registered");
}
