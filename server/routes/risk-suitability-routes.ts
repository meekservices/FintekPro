import { Router } from "express";
import { riskSuitabilityEngine } from "../services/risk-suitability-engine";

const router = Router();

router.get("/questions", async (req, res) => {
	try {
		const questions = await riskSuitabilityEngine.getDefaultRiskQuestions();
		res.json(questions);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.post("/assess", async (req, res) => {
	try {
		const { userId, answers } = req.body;

		if (!userId || !answers || !Array.isArray(answers)) {
			return res
				.status(400)
				.json({ error: "userId and answers array required" });
		}

		const result = await riskSuitabilityEngine.calculateRiskScore(answers);
		await riskSuitabilityEngine.saveRiskProfile(userId, result, answers);

		res.json(result);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/profile/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const profile = await riskSuitabilityEngine.getRiskProfile(userId);

		if (!profile) {
			return res.status(404).json({ error: "Risk profile not found" });
		}

		res.json(profile);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/eligibility/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const eligibility =
			await riskSuitabilityEngine.getProductEligibility(userId);
		res.json(eligibility);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.post("/suitability-check", async (req, res) => {
	try {
		const { userId, productId, productType, investmentAmount } = req.body;

		if (
			!userId ||
			!productId ||
			!productType ||
			investmentAmount === undefined
		) {
			return res.status(400).json({
				error: "userId, productId, productType, and investmentAmount required",
			});
		}

		const result = await riskSuitabilityEngine.checkProductSuitability(
			userId,
			productId,
			productType,
			investmentAmount,
		);

		res.json(result);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/report/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const report = await riskSuitabilityEngine.getFullSuitabilityReport(userId);
		res.json(report);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

export default router;
