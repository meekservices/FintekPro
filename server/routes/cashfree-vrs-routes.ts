/**
 * Cashfree VRS (Secure ID) API Routes — Admin Testing & Service Endpoints
 * Covers all Cashfree Secure ID product APIs.
 */

import { Router } from "express";
import { requireAdmin } from "../middleware/roleMiddleware";
import {
	verifyPANLite,
	verifyPAN360,
	verifyDrivingLicense,
	verifyVoterId,
	verifyPassport,
	verifyUdyam,
	fetchUdyamByPAN,
	verifyGSTIN,
	verifyBankAccountV2,
	verifyIFSC,
	createReversePennyDrop,
	verifyUPIPennyDrop,
	matchNames,
	getVRSServiceStatus,
} from "../services/cashfree-vrs-service";

const router = Router();

// ─── Service Status ────────────────────────────────────────────────────────

router.get("/status", requireAdmin, (_req, res) => {
	res.json(getVRSServiceStatus());
});

// ─── Identity Document Verification ───────────────────────────────────────

router.post("/pan-lite", requireAdmin, async (req, res) => {
	const { pan, name, dob } = req.body;
	if (!pan) return res.status(400).json({ error: "pan is required" });
	const result = await verifyPANLite({ pan, name, dob });
	res.status(result.success ? 200 : 400).json(result);
});

router.post("/pan-360", requireAdmin, async (req, res) => {
	const { pan, name } = req.body;
	if (!pan) return res.status(400).json({ error: "pan is required" });
	const result = await verifyPAN360({ pan, name });
	res.status(result.success ? 200 : 400).json(result);
});

router.post("/driving-license", requireAdmin, async (req, res) => {
	const { dlNumber, dob, name } = req.body;
	if (!dlNumber || !dob)
		return res.status(400).json({ error: "dlNumber and dob are required" });
	const result = await verifyDrivingLicense({ dlNumber, dob, name });
	res.status(result.success ? 200 : 400).json(result);
});

router.post("/voter-id", requireAdmin, async (req, res) => {
	const { epicNumber, name } = req.body;
	if (!epicNumber)
		return res.status(400).json({ error: "epicNumber is required" });
	const result = await verifyVoterId({ epicNumber, name });
	res.status(result.success ? 200 : 400).json(result);
});

router.post("/passport", requireAdmin, async (req, res) => {
	const { fileNumber, name, dob } = req.body;
	if (!fileNumber || !name || !dob)
		return res
			.status(400)
			.json({ error: "fileNumber, name, and dob are required" });
	const result = await verifyPassport({ fileNumber, name, dob });
	res.status(result.success ? 200 : 400).json(result);
});

router.post("/udyam", requireAdmin, async (req, res) => {
	const { udyamNumber } = req.body;
	if (!udyamNumber)
		return res.status(400).json({ error: "udyamNumber is required" });
	const result = await verifyUdyam({ udyamNumber });
	res.status(result.success ? 200 : 400).json(result);
});

router.post("/pan-to-udyam", requireAdmin, async (req, res) => {
	const { pan } = req.body;
	if (!pan) return res.status(400).json({ error: "pan is required" });
	const result = await fetchUdyamByPAN({ pan });
	res.status(result.success ? 200 : 400).json(result);
});

// ─── Business Verification ─────────────────────────────────────────────────

router.post("/gstin", requireAdmin, async (req, res) => {
	const { gstin, businessName } = req.body;
	if (!gstin) return res.status(400).json({ error: "gstin is required" });
	const result = await verifyGSTIN({ gstin, businessName });
	res.status(result.success ? 200 : 400).json(result);
});

// ─── Banking Verification ──────────────────────────────────────────────────

router.post("/bank-account", requireAdmin, async (req, res) => {
	const { bankAccount, ifsc, name, phoneNumber } = req.body;
	if (!bankAccount || !ifsc)
		return res.status(400).json({ error: "bankAccount and ifsc are required" });
	const result = await verifyBankAccountV2({
		bankAccount,
		ifsc,
		name,
		phoneNumber,
	});
	res.status(result.success ? 200 : 400).json(result);
});

router.post("/ifsc", requireAdmin, async (req, res) => {
	const { ifsc } = req.body;
	if (!ifsc) return res.status(400).json({ error: "ifsc is required" });
	const result = await verifyIFSC({ ifsc });
	res.status(result.success ? 200 : 400).json(result);
});

router.post("/reverse-penny-drop", requireAdmin, async (req, res) => {
	const { name } = req.body;
	if (!name) return res.status(400).json({ error: "name is required" });
	const result = await createReversePennyDrop({ name });
	res.status(result.success ? 200 : 400).json(result);
});

router.post("/upi-penny-drop", requireAdmin, async (req, res) => {
	const { vpa, name } = req.body;
	if (!vpa)
		return res.status(400).json({ error: "vpa (UPI address) is required" });
	const result = await verifyUPIPennyDrop({ vpa, name });
	res.status(result.success ? 200 : 400).json(result);
});

// ─── Name Matching ─────────────────────────────────────────────────────────

router.post("/name-match", requireAdmin, async (req, res) => {
	const { name1, name2 } = req.body;
	if (!name1 || !name2)
		return res.status(400).json({ error: "name1 and name2 are required" });
	const result = await matchNames({ name1, name2 });
	res.status(result.success ? 200 : 400).json(result);
});

export default router;
