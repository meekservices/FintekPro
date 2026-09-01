import { Router, Request, Response } from "express";
import { schemeGovernanceService } from "../services/scheme-governance-service";
import { LEGACY_PURCHASE_RESTRICTED_FUNDS } from "../services/agent-prospect-wizard-service";
import { instrumentNameSyncService } from "../services/instrument-name-sync-service";
import { requireAdmin } from "../middleware/roleMiddleware";

const router = Router();

router.get("/renames", async (req: Request, res: Response) => {
	try {
		const limit = Number.parseInt(req.query.limit as string) || 50;
		const renames = await schemeGovernanceService.getRecentRenames(limit);
		res.json({ success: true, data: renames, count: renames.length });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/transaction-rules", async (req: Request, res: Response) => {
	try {
		const restricted = req.query.restricted === "true";
		const status = req.query.status as string | undefined;
		const rules = await schemeGovernanceService.getTransactionRules({
			restricted,
			subscriptionStatus: status,
		});
		res.json({ success: true, data: rules, count: rules.length });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/transaction-rules/seed", async (req: Request, res: Response) => {
	try {
		const result =
			await schemeGovernanceService.seedTransactionRulesFromRegistry(
				LEGACY_PURCHASE_RESTRICTED_FUNDS,
			);
		res.json({ success: true, ...result });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/validate-scheme", async (req: Request, res: Response) => {
	try {
		const { schemeName } = req.body;
		if (!schemeName) {
			return res
				.status(400)
				.json({ success: false, error: "schemeName required" });
		}
		const result = await schemeGovernanceService.validateSchemeName(schemeName);
		res.json({ success: true, ...result });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/check-eligibility", async (req: Request, res: Response) => {
	try {
		const { identifier, identifierType, investmentType, amount } = req.body;
		if (!identifier) {
			return res
				.status(400)
				.json({ success: false, error: "identifier required" });
		}
		const result = await schemeGovernanceService.checkEligibility(
			identifier,
			identifierType || "name",
		);
		res.json({ success: true, ...result });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get(
	"/proposal/:proposalId/audit",
	async (req: Request, res: Response) => {
		try {
			const trail = await schemeGovernanceService.getProposalAuditTrail(
				req.params.proposalId,
			);
			res.json({ success: true, data: trail, count: trail.length });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/proposal/:proposalId/versions",
	async (req: Request, res: Response) => {
		try {
			const versions = await schemeGovernanceService.getProposalVersions(
				req.params.proposalId,
			);
			res.json({ success: true, data: versions, count: versions.length });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get("/compliance-report", async (req: Request, res: Response) => {
	try {
		const restrictedRules = await schemeGovernanceService.getTransactionRules({
			restricted: true,
		});
		const recentRenames = await schemeGovernanceService.getRecentRenames(20);

		res.json({
			success: true,
			report: {
				generatedAt: new Date().toISOString(),
				restrictedSchemes: restrictedRules.length,
				recentRenames: recentRenames.length,
				details: {
					restrictions: restrictedRules.map((r) => ({
						schemeName: r.schemeName,
						schemeCode: r.schemeCode,
						isin: r.isin,
						lumpsumAllowed: r.lumpsumAllowed,
						sipAllowed: r.sipAllowed,
						status: r.subscriptionStatus,
						reason: r.restrictionReason,
						alternative: r.alternativeSchemeName,
						effectiveFrom: r.effectiveFrom,
					})),
					renames: recentRenames,
				},
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/resolve-isin", async (req: Request, res: Response) => {
	try {
		const { isin } = req.body;
		if (!isin) {
			return res.status(400).json({ success: false, error: "isin required" });
		}
		const result = await schemeGovernanceService.resolveSchemeByIsin(isin);
		res.json({ success: true, ...result });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

// ── Listed Equity Name / Symbol Change Routes ─────────────────────────────────
// All routes below are admin-only and operate on company_rename_log +
// listed_stocks using the InstrumentNameSyncService.

/**
 * POST /sync-stock-names
 * Triggers a live sync against NSE EQUITY_L.csv master.
 *
 * Query params:
 *   dryRun=true  — detect diffs but do NOT write to DB (default: false)
 *
 * Body (optional, for file-upload fallback):
 *   { csv: "<raw EQUITY_L.csv content>" }
 *
 * @response { success, data: InstrumentNameSyncResult, meta }
 */
router.post(
	"/sync-stock-names",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const dryRun = req.query.dryRun === "true";
			const rawCsv = typeof req.body?.csv === "string" ? req.body.csv : undefined;

			const result = await instrumentNameSyncService.syncFromNSEMaster(rawCsv, dryRun);

			return res.json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: "1.0",
					dryRun,
				},
			});
		} catch (error: any) {
			return res.status(500).json({
				success: false,
				error: { error_code: "NAME_SYNC_FAILED", message: error.message, retryable: true },
			});
		}
	},
);

/**
 * GET /stock-renames
 * Returns recent company rename log entries (paginated).
 *
 * Query params:
 *   limit  — max rows (default 50, max 200)
 *
 * @response { success, data: CompanyRenameLog[], count, meta }
 */
router.get(
	"/stock-renames",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const limit = Math.min(Number.parseInt(req.query.limit as string) || 50, 200);
			const renames = await instrumentNameSyncService.getRecentRenames(limit);
			return res.json({
				success: true,
				data: renames,
				count: renames.length,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (error: any) {
			return res.status(500).json({ success: false, error: error.message });
		}
	},
);

/**
 * POST /stock-renames/manual
 * Admin-logs a company rename (for BSE-only stocks, corrections, etc.).
 *
 * @body {
 *   isin: string,
 *   oldName: string,
 *   newName: string,
 *   oldSymbol?: string,
 *   newSymbol?: string,
 *   exchange?: "NSE" | "BSE",
 *   effectiveDate?: string (YYYY-MM-DD)
 * }
 *
 * @response { success, meta }
 */
router.post(
	"/stock-renames/manual",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { isin, oldName, newName, oldSymbol, newSymbol, exchange, effectiveDate } = req.body;

			if (!isin || !oldName || !newName) {
				return res.status(400).json({
					success: false,
					error: { error_code: "MISSING_FIELDS", message: "isin, oldName, newName are required", retryable: false },
				});
			}

			await instrumentNameSyncService.manualRename({
				isin, oldName, newName, oldSymbol, newSymbol, exchange, effectiveDate,
			});

			return res.json({
				success: true,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (error: any) {
			return res.status(500).json({ success: false, error: error.message });
		}
	},
);

export default router;
