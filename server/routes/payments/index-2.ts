// @ts-nocheck
import { Express } from "express";
import { storage } from "../../storage";
import { cashfreeService } from "../../cashfree-service";
import { phonePeService } from "../../phonepe-service";
import { complianceMonitor } from "../../compliance-monitor";
import { clientMoneySegregationService } from "../../services/client-money-segregation-service";
import { dailyReconciliationService } from "../../services/daily-reconciliation-service";
import { registerFemaComplianceRoutes } from "../fema-compliance";
import { unifiedPaymentGateway } from "../../services/unified-payment-gateway";

export function registerPaymentPart2Routes(app: Express): void {
	// ==================== UNIFIED PAYMENT GATEWAY ROUTES ====================

	app.get("/api/phonepe/transactions", async (req, res) => {
		try {
			if (!req.user?.id) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const transactions = await storage.getPhonePeTransactionsByUserId(
				req.user.id,
			);

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "list_phonepe_transactions",
				outcome: "success",
				riskLevel: "low",
				userId: req.user.id,
			});

			res.json(transactions);
		} catch (error) {
			console.error("Error fetching PhonePe transactions:", error);
			res.status(500).json({ message: "Failed to fetch transactions" });
		}
	});

	// ==================== CLIENT MONEY SEGREGATION COMPLIANCE ROUTES ====================

	app.get(
		"/api/admin/compliance/client-money-segregation",
		async (req, res) => {
			try {
				if (
					!req.user?.role ||
					!["admin", "compliance_officer"].includes(req.user.role)
				) {
					return res
						.status(403)
						.json({
							message:
								"Forbidden - Admin or Compliance Officer access required",
						});
				}

				const complianceArtifacts =
					clientMoneySegregationService.generateComplianceArtifacts();

				complianceMonitor.logEvent({
					eventType: "data_access",
					action: "view_client_money_segregation_compliance",
					outcome: "success",
					riskLevel: "low",
					userId: req.user.id,
				});

				res.json({
					success: true,
					data: complianceArtifacts,
				});
			} catch (error) {
				console.error(
					"Error fetching client money segregation compliance:",
					error,
				);
				res.status(500).json({ message: "Failed to fetch compliance data" });
			}
		},
	);

	app.get("/api/admin/compliance/payment-flows", async (req, res) => {
		try {
			if (
				!req.user?.role ||
				!["admin", "compliance_officer"].includes(req.user.role)
			) {
				return res
					.status(403)
					.json({
						message: "Forbidden - Admin or Compliance Officer access required",
					});
			}

			const paymentFlows = clientMoneySegregationService.getAllPaymentFlows();
			const complianceStatus =
				clientMoneySegregationService.getComplianceStatus();

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "view_payment_flow_documentation",
				outcome: "success",
				riskLevel: "low",
				userId: req.user.id,
			});

			res.json({
				success: true,
				data: {
					paymentFlows,
					complianceStatus,
				},
			});
		} catch (error) {
			console.error("Error fetching payment flows:", error);
			res.status(500).json({ message: "Failed to fetch payment flows" });
		}
	});

	app.get("/api/admin/compliance/regulatory-disclosure", async (req, res) => {
		try {
			if (
				!req.user?.role ||
				!["admin", "compliance_officer"].includes(req.user.role)
			) {
				return res
					.status(403)
					.json({
						message: "Forbidden - Admin or Compliance Officer access required",
					});
			}

			const disclosure =
				clientMoneySegregationService.generateRegulatoryDisclosure();

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "generate_regulatory_disclosure",
				outcome: "success",
				riskLevel: "low",
				userId: req.user.id,
			});

			res.type("text/plain").send(disclosure);
		} catch (error) {
			console.error("Error generating regulatory disclosure:", error);
			res.status(500).json({ message: "Failed to generate disclosure" });
		}
	});

	app.post("/api/admin/compliance/validate-payment-flow", async (req, res) => {
		try {
			if (
				!req.user?.role ||
				!["admin", "compliance_officer"].includes(req.user.role)
			) {
				return res
					.status(403)
					.json({
						message: "Forbidden - Admin or Compliance Officer access required",
					});
			}

			const { productType, paymentMethod, counterparty } = req.body;

			if (!productType) {
				return res.status(400).json({ message: "productType is required" });
			}

			const validation = clientMoneySegregationService.validatePaymentFlow(
				productType,
				paymentMethod || "",
				counterparty || "",
			);

			complianceMonitor.logEvent({
				eventType: "compliance",
				action: "validate_payment_flow",
				resource: productType,
				outcome: validation.valid ? "success" : "failure",
				riskLevel: validation.valid ? "low" : "high",
				userId: req.user.id,
				metadata: { issues: validation.issues },
			});

			res.json({
				success: true,
				data: validation,
			});
		} catch (error) {
			console.error("Error validating payment flow:", error);
			res.status(500).json({ message: "Failed to validate payment flow" });
		}
	});

	// ==================== DAILY RECONCILIATION ROUTES ====================

	app.get("/api/admin/compliance/reconciliation/latest", async (req, res) => {
		try {
			if (
				!req.user?.role ||
				!["admin", "compliance_officer"].includes(req.user.role)
			) {
				return res
					.status(403)
					.json({
						message: "Forbidden - Admin or Compliance Officer access required",
					});
			}

			const latestReport = dailyReconciliationService.getLatestReport();

			complianceMonitor.logEvent({
				eventType: "data_access",
				action: "view_reconciliation_report",
				outcome: "success",
				riskLevel: "low",
				userId: req.user.id,
			});

			res.json({
				success: true,
				data: latestReport || null,
				lastRunDate: dailyReconciliationService.getLastRunDate(),
			});
		} catch (error) {
			console.error("Error fetching reconciliation report:", error);
			res
				.status(500)
				.json({ message: "Failed to fetch reconciliation report" });
		}
	});

	app.get("/api/admin/compliance/reconciliation/history", async (req, res) => {
		try {
			if (
				!req.user?.role ||
				!["admin", "compliance_officer"].includes(req.user.role)
			) {
				return res
					.status(403)
					.json({
						message: "Forbidden - Admin or Compliance Officer access required",
					});
			}

			const reports = dailyReconciliationService.getAllReports();

			res.json({
				success: true,
				data: reports,
				count: reports.length,
			});
		} catch (error) {
			console.error("Error fetching reconciliation history:", error);
			res
				.status(500)
				.json({ message: "Failed to fetch reconciliation history" });
		}
	});

	app.post("/api/admin/compliance/reconciliation/run", async (req, res) => {
		try {
			if (
				!req.user?.role ||
				!["admin", "compliance_officer"].includes(req.user.role)
			) {
				return res
					.status(403)
					.json({
						message: "Forbidden - Admin or Compliance Officer access required",
					});
			}

			if (dailyReconciliationService.isReconciliationRunning()) {
				return res.status(409).json({
					success: false,
					message: "Reconciliation already in progress",
				});
			}

			const { date } = req.body;
			const runDate = date ? new Date(date) : new Date();

			complianceMonitor.logEvent({
				eventType: "compliance",
				action: "trigger_reconciliation",
				resource: runDate.toISOString(),
				outcome: "success",
				riskLevel: "medium",
				userId: req.user.id,
			});

			const report = await dailyReconciliationService.runDailyReconciliation(
				runDate,
				req.user.id,
			);

			res.json({
				success: true,
				data: report,
				message: "Reconciliation completed successfully",
			});
		} catch (error) {
			console.error("Error running reconciliation:", error);
			res.status(500).json({ message: "Failed to run reconciliation" });
		}
	});

	app.get(
		"/api/admin/compliance/reconciliation/:reportId",
		async (req, res) => {
			try {
				if (
					!req.user?.role ||
					!["admin", "compliance_officer"].includes(req.user.role)
				) {
					return res
						.status(403)
						.json({
							message:
								"Forbidden - Admin or Compliance Officer access required",
						});
				}

				const { reportId } = req.params;
				const report = dailyReconciliationService.getReport(reportId);

				if (!report) {
					return res.status(404).json({ message: "Report not found" });
				}

				res.json({
					success: true,
					data: report,
				});
			} catch (error) {
				console.error("Error fetching reconciliation report:", error);
				res.status(500).json({ message: "Failed to fetch report" });
			}
		},
	);

	console.log("✅ Payment gateway routes registered (Cashfree, PhonePe)");
	console.log("✅ Client Money Segregation compliance routes registered");
	console.log("✅ Daily Reconciliation routes registered");

	registerFemaComplianceRoutes(app);
}
