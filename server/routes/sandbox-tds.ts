import { Express, Request, Response } from "express";
import { sandboxTDSService } from "../sandbox-tds-service";

export function registerSandboxTDSRoutes(app: Express): void {
	// ============================================================
	// CALCULATOR
	// ============================================================

	/**
	 * POST /api/tds/calculator/non-salary
	 * Calculate TDS on a non-salary payment via Sandbox API.
	 * Body: { deducteeType, isPanAvailable, residentialStatus,
	 *         is206abApplicable, isPanOperative, natureOfPayment,
	 *         creditAmount, creditDate }
	 */
	app.post(
		"/api/tds/calculator/non-salary",
		async (req: Request, res: Response) => {
			try {
				const {
					deducteeType,
					isPanAvailable,
					residentialStatus,
					is206abApplicable,
					isPanOperative,
					natureOfPayment,
					creditAmount,
					creditDate,
				} = req.body;

				if (
					!deducteeType ||
					!residentialStatus ||
					!natureOfPayment ||
					creditAmount === undefined
				) {
					return res
						.status(400)
						.json({
							success: false,
							message:
								"deducteeType, residentialStatus, natureOfPayment and creditAmount are required",
						});
				}

				const result = await sandboxTDSService.calculateNonSalaryTDSSandbox({
					deducteeType,
					isPanAvailable: isPanAvailable ?? true,
					residentialStatus,
					is206abApplicable: is206abApplicable ?? false,
					isPanOperative: isPanOperative ?? true,
					natureOfPayment,
					creditAmount: Number(creditAmount),
					creditDate: creditDate ?? Date.now(),
				});

				return res.json(result);
			} catch (error) {
				console.error("[TDS Calculator] non-salary error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error ? error.message : "Calculation failed",
					});
			}
		},
	);

	// ============================================================
	// TDS ANALYTICS — POTENTIAL NOTICES (JOB-BASED)
	// ============================================================

	/**
	 * POST /api/tds/analytics/potential-notices
	 * Submit TDS potential-notices analytics job.
	 * Body: { tan, quarter, form, financialYear }
	 * Returns: { job_id, json_url, status }
	 */
	app.post(
		"/api/tds/analytics/potential-notices",
		async (req: Request, res: Response) => {
			try {
				const { tan, quarter, form, financialYear } = req.body;
				if (!tan || !quarter || !form || !financialYear) {
					return res
						.status(400)
						.json({
							success: false,
							message: "tan, quarter, form and financialYear are required",
						});
				}
				const result = await sandboxTDSService.submitTDSAnalyticsJob({
					tan,
					quarter,
					form,
					financialYear,
				});
				return res.json(result);
			} catch (error) {
				console.error("[TDS Analytics] submit job error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to submit analytics job",
					});
			}
		},
	);

	/**
	 * GET /api/tds/analytics/potential-notices?job_id=...
	 * Poll TDS potential-notices job status.
	 * Returns job data; when status==="succeeded" → potential_notice_report_url is set.
	 */
	app.get(
		"/api/tds/analytics/potential-notices",
		async (req: Request, res: Response) => {
			try {
				const { job_id } = req.query;
				if (!job_id) {
					return res
						.status(400)
						.json({
							success: false,
							message: "job_id query param is required",
						});
				}
				const result = await sandboxTDSService.pollTDSAnalyticsJob(
					String(job_id),
				);
				return res.json(result);
			} catch (error) {
				console.error("[TDS Analytics] poll job error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to poll analytics job",
					});
			}
		},
	);

	// ============================================================
	// TCS ANALYTICS — POTENTIAL NOTICES (JOB-BASED)
	// ============================================================

	/**
	 * POST /api/tcs/analytics/potential-notices
	 * Submit TCS potential-notices analytics job.
	 * Body: { tan, quarter, financialYear }
	 */
	app.post(
		"/api/tcs/analytics/potential-notices",
		async (req: Request, res: Response) => {
			try {
				const { tan, quarter, financialYear } = req.body;
				if (!tan || !quarter || !financialYear) {
					return res
						.status(400)
						.json({
							success: false,
							message: "tan, quarter and financialYear are required",
						});
				}
				const result = await sandboxTDSService.submitTCSAnalyticsJob({
					tan,
					quarter,
					financialYear,
				});
				return res.json(result);
			} catch (error) {
				console.error("[TCS Analytics] submit job error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to submit TCS analytics job",
					});
			}
		},
	);

	/**
	 * GET /api/tcs/analytics/potential-notices?job_id=...
	 * Poll TCS potential-notices job status.
	 */
	app.get(
		"/api/tcs/analytics/potential-notices",
		async (req: Request, res: Response) => {
			try {
				const { job_id } = req.query;
				if (!job_id) {
					return res
						.status(400)
						.json({
							success: false,
							message: "job_id query param is required",
						});
				}
				const result = await sandboxTDSService.pollTCSAnalyticsJob(
					String(job_id),
				);
				return res.json(result);
			} catch (error) {
				console.error("[TCS Analytics] poll job error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to poll TCS analytics job",
					});
			}
		},
	);

	// ============================================================
	// TDS ANALYTICS — SALARY PAYMENTS (GAP 2, JOB-BASED)
	// ============================================================

	/**
	 * POST /api/tds/analytics/salary-payments/potential-notices
	 * Submit TDS salary-payments potential-notices analytics job (Form 24Q).
	 * Body: { tan, quarter, financialYear }
	 * Returns: { job_id, status }
	 */
	app.post(
		"/api/tds/analytics/salary-payments/potential-notices",
		async (req: Request, res: Response) => {
			try {
				const { tan, quarter, financialYear } = req.body;
				if (!tan || !quarter || !financialYear) {
					return res
						.status(400)
						.json({
							success: false,
							message: "tan, quarter and financialYear are required",
						});
				}
				if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
					return res
						.status(400)
						.json({
							success: false,
							message: "quarter must be Q1, Q2, Q3 or Q4",
						});
				}
				const result = await sandboxTDSService.submitSalaryTDSAnalyticsJob({
					tan,
					quarter,
					financialYear,
				});
				return res.json(result);
			} catch (error) {
				console.error("[TDS Salary Analytics] submit job error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to submit salary analytics job",
					});
			}
		},
	);

	/**
	 * GET /api/tds/analytics/salary-payments/potential-notices?job_id=...
	 * Poll TDS salary-payments analytics job status.
	 * When status==="succeeded" → data.potential_notice_report_url is set.
	 */
	app.get(
		"/api/tds/analytics/salary-payments/potential-notices",
		async (req: Request, res: Response) => {
			try {
				const { job_id } = req.query;
				if (!job_id) {
					return res
						.status(400)
						.json({
							success: false,
							message: "job_id query param is required",
						});
				}
				const result = await sandboxTDSService.pollSalaryTDSAnalyticsJob(
					String(job_id),
				);
				return res.json(result);
			} catch (error) {
				console.error("[TDS Salary Analytics] poll job error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to poll salary analytics job",
					});
			}
		},
	);

	// ============================================================
	// TDS ANALYTICS — NRI PAYMENTS / SECTION 195 (GAP 3, JOB-BASED)
	// ============================================================

	/**
	 * POST /api/tds/analytics/nri-payments/potential-notices
	 * Submit TDS NRI-payments potential-notices analytics job (Section 195 / Form 27Q).
	 * Body: { tan, quarter, financialYear }
	 * Returns: { job_id, status }
	 */
	app.post(
		"/api/tds/analytics/nri-payments/potential-notices",
		async (req: Request, res: Response) => {
			try {
				const { tan, quarter, financialYear } = req.body;
				if (!tan || !quarter || !financialYear) {
					return res
						.status(400)
						.json({
							success: false,
							message: "tan, quarter and financialYear are required",
						});
				}
				if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
					return res
						.status(400)
						.json({
							success: false,
							message: "quarter must be Q1, Q2, Q3 or Q4",
						});
				}
				const result = await sandboxTDSService.submitNRITDSAnalyticsJob({
					tan,
					quarter,
					financialYear,
				});
				return res.json(result);
			} catch (error) {
				console.error("[TDS NRI Analytics] submit job error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to submit NRI analytics job",
					});
			}
		},
	);

	/**
	 * GET /api/tds/analytics/nri-payments/potential-notices?job_id=...
	 * Poll TDS NRI-payments analytics job status (Section 195 / Form 27Q).
	 * When status==="succeeded" → data.potential_notice_report_url is set.
	 */
	app.get(
		"/api/tds/analytics/nri-payments/potential-notices",
		async (req: Request, res: Response) => {
			try {
				const { job_id } = req.query;
				if (!job_id) {
					return res
						.status(400)
						.json({
							success: false,
							message: "job_id query param is required",
						});
				}
				const result = await sandboxTDSService.pollNRITDSAnalyticsJob(
					String(job_id),
				);
				return res.json(result);
			} catch (error) {
				console.error("[TDS NRI Analytics] poll job error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to poll NRI analytics job",
					});
			}
		},
	);

	// ============================================================
	// TDS REPORTS — TXT GENERATION (JOB-BASED)
	// ============================================================

	/**
	 * POST /api/tds/reports/txt
	 * Submit TDS TXT report generation job.
	 * Body: { tan, quarter, form, financialYear, previousReceiptNumber? }
	 * Returns: { job_id, json_url } — upload Sheet JSON to json_url (PUT, no auth headers).
	 */
	app.post("/api/tds/reports/txt", async (req: Request, res: Response) => {
		try {
			const { tan, quarter, form, financialYear, previousReceiptNumber } =
				req.body;
			if (!tan || !quarter || !form || !financialYear) {
				return res
					.status(400)
					.json({
						success: false,
						message: "tan, quarter, form and financialYear are required",
					});
			}
			const result = await sandboxTDSService.submitTDSReportJob({
				tan,
				quarter,
				form,
				financialYear,
				previousReceiptNumber,
			});
			return res.json(result);
		} catch (error) {
			console.error("[TDS Reports] submit job error:", error);
			return res
				.status(500)
				.json({
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Failed to submit TDS report job",
				});
		}
	});

	/**
	 * GET /api/tds/reports/txt?job_id=...
	 * Poll TDS TXT report job status.
	 * When status==="succeeded" → data.txt_file_url is populated.
	 */
	app.get("/api/tds/reports/txt", async (req: Request, res: Response) => {
		try {
			const { job_id } = req.query;
			if (!job_id) {
				return res
					.status(400)
					.json({ success: false, message: "job_id query param is required" });
			}
			const result = await sandboxTDSService.pollTDSReportJob(String(job_id));
			return res.json(result);
		} catch (error) {
			console.error("[TDS Reports] poll job error:", error);
			return res
				.status(500)
				.json({
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Failed to poll TDS report job",
				});
		}
	});

	/**
	 * POST /api/tds/reports/txt/search
	 * Search / list prior TDS report jobs.
	 * Body: { tan, quarter?, form?, financialYear?, fromDate?, toDate?, pageSize?, lastEvaluatedKey? }
	 */
	app.post(
		"/api/tds/reports/txt/search",
		async (req: Request, res: Response) => {
			try {
				const {
					tan,
					quarter,
					form,
					financialYear,
					fromDate,
					toDate,
					pageSize,
					lastEvaluatedKey,
				} = req.body;
				if (!tan) {
					return res
						.status(400)
						.json({ success: false, message: "tan is required" });
				}
				const result = await sandboxTDSService.searchTDSReportJobs({
					tan,
					quarter,
					form,
					financialYear,
					fromDate: fromDate ? Number(fromDate) : undefined,
					toDate: toDate ? Number(toDate) : undefined,
					pageSize: pageSize ? Number(pageSize) : undefined,
					lastEvaluatedKey,
				});
				return res.json(result);
			} catch (error) {
				console.error("[TDS Reports] search jobs error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to search TDS report jobs",
					});
			}
		},
	);

	// ============================================================
	// TCS REPORTS — TXT GENERATION (JOB-BASED)
	// ============================================================

	/**
	 * POST /api/tcs/reports/txt
	 * Submit TCS TXT report generation job.
	 * Body: { tan, quarter, financialYear, previousReceiptNumber? }
	 */
	app.post("/api/tcs/reports/txt", async (req: Request, res: Response) => {
		try {
			const { tan, quarter, financialYear, previousReceiptNumber } = req.body;
			if (!tan || !quarter || !financialYear) {
				return res
					.status(400)
					.json({
						success: false,
						message: "tan, quarter and financialYear are required",
					});
			}
			const result = await sandboxTDSService.submitTCSReportJob({
				tan,
				quarter,
				financialYear,
				previousReceiptNumber,
			});
			return res.json(result);
		} catch (error) {
			console.error("[TCS Reports] submit job error:", error);
			return res
				.status(500)
				.json({
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Failed to submit TCS report job",
				});
		}
	});

	/**
	 * GET /api/tcs/reports/txt?job_id=...
	 * Poll TCS TXT report job status.
	 */
	app.get("/api/tcs/reports/txt", async (req: Request, res: Response) => {
		try {
			const { job_id } = req.query;
			if (!job_id) {
				return res
					.status(400)
					.json({ success: false, message: "job_id query param is required" });
			}
			const result = await sandboxTDSService.pollTCSReportJob(String(job_id));
			return res.json(result);
		} catch (error) {
			console.error("[TCS Reports] poll job error:", error);
			return res
				.status(500)
				.json({
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Failed to poll TCS report job",
				});
		}
	});

	/**
	 * POST /api/tcs/reports/txt/search
	 * Search / list prior TCS report jobs.
	 * Body: { tan, quarter?, financialYear?, fromDate?, toDate?, pageSize?, lastEvaluatedKey? }
	 */
	app.post(
		"/api/tcs/reports/txt/search",
		async (req: Request, res: Response) => {
			try {
				const {
					tan,
					quarter,
					financialYear,
					fromDate,
					toDate,
					pageSize,
					lastEvaluatedKey,
				} = req.body;
				if (!tan) {
					return res
						.status(400)
						.json({ success: false, message: "tan is required" });
				}
				const result = await sandboxTDSService.searchTCSReportJobs({
					tan,
					quarter,
					financialYear,
					fromDate: fromDate ? Number(fromDate) : undefined,
					toDate: toDate ? Number(toDate) : undefined,
					pageSize: pageSize ? Number(pageSize) : undefined,
					lastEvaluatedKey,
				});
				return res.json(result);
			} catch (error) {
				console.error("[TCS Reports] search jobs error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to search TCS report jobs",
					});
			}
		},
	);

	// ============================================================
	// COMPLIANCE — DOWNLOAD FORM 16 / 16A (JOB-BASED)
	// ============================================================

	/**
	 * POST /api/tds/compliance/traces/deductors/forms/:certificateType
	 * Submit TRACES Form 16 or Form 16A download job.
	 * :certificateType = "form-16" | "form-16a"
	 * Body: { username, password, tan, securityCaptcha: { ... }, rememberMe? }
	 */
	app.post(
		"/api/tds/compliance/traces/deductors/forms/:certificateType",
		async (req: Request, res: Response) => {
			try {
				const { certificateType } = req.params;
				if (certificateType !== "form-16" && certificateType !== "form-16a") {
					return res
						.status(400)
						.json({
							success: false,
							message: 'certificateType must be "form-16" or "form-16a"',
						});
				}

				const { username, password, tan, securityCaptcha, rememberMe } =
					req.body;
				if (!username || !password || !tan || !securityCaptcha) {
					return res
						.status(400)
						.json({
							success: false,
							message:
								"username, password, tan and securityCaptcha are required",
						});
				}

				const result = await sandboxTDSService.submitForm16Job(
					certificateType as "form-16" | "form-16a",
					{ username, password, tan, securityCaptcha, rememberMe },
				);
				return res.json(result);
			} catch (error) {
				console.error("[TDS Compliance] Form 16 submit error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to submit Form 16 job",
					});
			}
		},
	);

	/**
	 * POST /api/tds/compliance/traces/deductors/forms/:certificateType/status
	 * Poll TRACES Form 16 / 16A download job status.
	 * :certificateType = "form-16" | "form-16a"
	 * Body: { username, password, tan }
	 */
	app.post(
		"/api/tds/compliance/traces/deductors/forms/:certificateType/status",
		async (req: Request, res: Response) => {
			try {
				const { certificateType } = req.params;
				if (certificateType !== "form-16" && certificateType !== "form-16a") {
					return res
						.status(400)
						.json({
							success: false,
							message: 'certificateType must be "form-16" or "form-16a"',
						});
				}

				const { username, password, tan } = req.body;
				if (!username || !password || !tan) {
					return res
						.status(400)
						.json({
							success: false,
							message: "username, password and tan are required",
						});
				}

				const result = await sandboxTDSService.pollForm16JobStatus(
					certificateType as "form-16" | "form-16a",
					{ username, password, tan },
				);
				return res.json(result);
			} catch (error) {
				console.error("[TDS Compliance] Form 16 status error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to poll Form 16 status",
					});
			}
		},
	);

	// ============================================================
	// COMPLIANCE — FVU GENERATION (JOB-BASED)
	// ============================================================

	/**
	 * POST /api/tds/compliance/fvu/generate
	 * Submit FVU generation job.
	 * Body: { tan, financialYear, quarter, form, filingType }
	 * Returns: { job_id, txt_file_upload_url, csi_file_upload_url }
	 * → PUT your .txt + .csi to those URLs (no Sandbox auth headers), then poll.
	 */
	app.post(
		"/api/tds/compliance/fvu/generate",
		async (req: Request, res: Response) => {
			try {
				const { tan, financialYear, quarter, form, filingType } = req.body;
				if (!tan || !financialYear || !quarter || !form || !filingType) {
					return res
						.status(400)
						.json({
							success: false,
							message:
								"tan, financialYear, quarter, form and filingType are required",
						});
				}
				if (filingType !== "regular" && filingType !== "correction") {
					return res
						.status(400)
						.json({
							success: false,
							message: 'filingType must be "regular" or "correction"',
						});
				}
				const result = await sandboxTDSService.submitFVUGenerateJob({
					tan,
					financialYear,
					quarter,
					form,
					filingType,
				});
				return res.json(result);
			} catch (error) {
				console.error("[TDS Compliance] FVU generate error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to submit FVU generate job",
					});
			}
		},
	);

	/**
	 * GET /api/tds/compliance/fvu/generate?job_id=...
	 * Poll FVU generation job status.
	 * When status==="succeeded" → data.fvu_zip_file_url is populated.
	 */
	app.get(
		"/api/tds/compliance/fvu/generate",
		async (req: Request, res: Response) => {
			try {
				const { job_id } = req.query;
				if (!job_id) {
					return res
						.status(400)
						.json({
							success: false,
							message: "job_id query param is required",
						});
				}
				const result = await sandboxTDSService.pollFVUGenerateJob(
					String(job_id),
				);
				return res.json(result);
			} catch (error) {
				console.error("[TDS Compliance] FVU poll error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to poll FVU generate job",
					});
			}
		},
	);

	// ============================================================
	// COMPLIANCE — E-FILE (JOB-BASED)
	// ============================================================

	/**
	 * POST /api/tds/compliance/e-file
	 * Submit TDS e-file job.
	 * Body: { tan, financialYear, form, quarter }
	 * Returns: { job_id }
	 */
	app.post(
		"/api/tds/compliance/e-file",
		async (req: Request, res: Response) => {
			try {
				const { tan, financialYear, form, quarter } = req.body;
				if (!tan || !financialYear || !form || !quarter) {
					return res
						.status(400)
						.json({
							success: false,
							message: "tan, financialYear, form and quarter are required",
						});
				}
				const result = await sandboxTDSService.submitEFileJob({
					tan,
					financialYear,
					form,
					quarter,
				});
				return res.json(result);
			} catch (error) {
				console.error("[TDS Compliance] e-file submit error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to submit e-file job",
					});
			}
		},
	);

	/**
	 * GET /api/tds/compliance/e-file?job_id=...
	 * Poll e-file job status.
	 * When status==="succeeded" → data.receipt_number + data.receipt_file_url are populated.
	 */
	app.get("/api/tds/compliance/e-file", async (req: Request, res: Response) => {
		try {
			const { job_id } = req.query;
			if (!job_id) {
				return res
					.status(400)
					.json({ success: false, message: "job_id query param is required" });
			}
			const result = await sandboxTDSService.pollEFileJob(String(job_id));
			return res.json(result);
		} catch (error) {
			console.error("[TDS Compliance] e-file poll error:", error);
			return res
				.status(500)
				.json({
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Failed to poll e-file job",
				});
		}
	});

	// ============================================================
	// CONVENIENCE — SANDBOX SERVICE STATUS
	// ============================================================

	/**
	 * GET /api/tds/sandbox/status
	 * Returns whether Sandbox TDS API credentials are configured.
	 */
	app.get("/api/tds/sandbox/status", (_req: Request, res: Response) => {
		res.json({
			configured: sandboxTDSService.isConfigured(),
			endpoints: {
				calculator: ["POST /api/tds/calculator/non-salary"],
				analytics: [
					"POST /api/tds/analytics/potential-notices",
					"GET  /api/tds/analytics/potential-notices?job_id=",
					"POST /api/tcs/analytics/potential-notices",
					"GET  /api/tcs/analytics/potential-notices?job_id=",
					"POST /api/tds/analytics/salary-payments/potential-notices",
					"GET  /api/tds/analytics/salary-payments/potential-notices?job_id=",
					"POST /api/tds/analytics/nri-payments/potential-notices",
					"GET  /api/tds/analytics/nri-payments/potential-notices?job_id=",
				],
				reports: [
					"POST /api/tds/reports/txt",
					"GET  /api/tds/reports/txt?job_id=",
					"POST /api/tds/reports/txt/search",
					"POST /api/tcs/reports/txt",
					"GET  /api/tcs/reports/txt?job_id=",
					"POST /api/tcs/reports/txt/search",
				],
				compliance: [
					"POST /api/tds/compliance/traces/deductors/forms/:certificateType",
					"POST /api/tds/compliance/traces/deductors/forms/:certificateType/status",
					"POST /api/tds/compliance/fvu/generate",
					"GET  /api/tds/compliance/fvu/generate?job_id=",
					"POST /api/tds/compliance/e-file",
					"GET  /api/tds/compliance/e-file?job_id=",
				],
			},
		});
	});

	console.log(
		"✅ Sandbox TDS routes registered (Calculator / Analytics / Reports / Compliance)",
	);
}
