import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";

// Lazy-loaded to avoid blocking the boot sequence (Cloud SQL init hangs on cold start)
const getService = async () =>
	(await import("../services/regulatory-audit-norms-service"))
		.regulatoryAuditNormsService;

const router = Router();

router.use(requireAuth);

/**
 * GET /api/admin/regulatory-audit/norms
 * Returns the full list of regulatory norms with metadata.
 */
router.get("/norms", async (_req: Request, res: Response) => {
	try {
		const svc = await getService();
		const norms = svc.getNorms();
		res.json({ success: true, data: norms, total: norms.length });
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

/**
 * GET /api/admin/regulatory-audit/readiness
 * Runs all automated checks and returns the full audit readiness report.
 * Results are cached for 5 minutes.  Use ?force=1 to bypass cache.
 */
router.get("/readiness", async (req: Request, res: Response) => {
	try {
		const svc = await getService();
		const force = req.query.force === "1";
		const report = await svc.runAllChecks(force);
		res.json({ success: true, data: report });
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

/**
 * POST /api/admin/regulatory-audit/check/:normId
 * Runs a single norm check on demand (always live, no cache).
 */
router.post("/check/:normId", async (req: Request, res: Response) => {
	try {
		const svc = await getService();
		const { normId } = req.params;
		const result = await svc.runSingleCheck(normId);
		res.json({ success: true, data: result });
	} catch (err: any) {
		const code = err.message.includes("not found") ? 404 : 500;
		res.status(code).json({ success: false, error: err.message });
	}
});

/**
 * GET /api/admin/regulatory-audit/norm/:normId
 * Returns metadata for a single norm.
 */
router.get("/norm/:normId", async (req: Request, res: Response) => {
	try {
		const svc = await getService();
		const norm = svc.getNorm(req.params.normId);
		if (!norm)
			return res.status(404).json({ success: false, error: "Norm not found" });
		res.json({ success: true, data: norm });
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

/**
 * POST /api/admin/regulatory-audit/remediate/:normId
 * Triggers statutory remediation action for a specific norm.
 */
router.post("/remediate/:normId", async (req: Request, res: Response) => {
	try {
		const svc = await getService();
		const { normId } = req.params;
		const actor = (req as any).user;
		const result = await svc.remediateNorm(normId, req.body, actor);
		res.json(result);
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

/**
 * POST /api/admin/regulatory-audit/form-a-filing
 * Records SEBI Annual Compliance Report Form A filing details.
 */
router.post("/form-a-filing", async (req: Request, res: Response) => {
	try {
		const svc = await getService();
		const actor = (req as any).user;
		const result = await svc.recordFormAFiling({
			...req.body,
			filedByUserId: actor?.id,
			actorRole: actor?.role,
		});
		res.json(result);
	} catch (err: any) {
		res.status(400).json({ success: false, error: err.message });
	}
});

/**
 * GET /api/admin/regulatory-audit/export-dossier
 * Generates and returns the cryptographically sealed SEBI/AMFI Regulatory Audit Dossier.
 */
router.get("/export-dossier", async (req: Request, res: Response) => {
	try {
		const svc = await getService();
		const user = (req as any).user;
		const dossier = await svc.generateAuditDossier(user?.email || user?.id || "admin");
		res.json({ success: true, data: dossier });
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

export default router;
