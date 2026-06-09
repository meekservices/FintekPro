import { Router } from "express";
import { db } from "../db";
import {
	quantGovernancePolicy,
	quantRunLog,
	quantModelRegistry,
	quantRetrainingLog,
} from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { quantRetrainingScheduler } from "../services/quant/quant-retraining-scheduler";
import { quantRetrainingPipeline } from "../services/quant/quant-retraining-pipeline";

const router = Router();

router.get("/quant-policy", async (req, res) => {
	try {
		const policies = await db.select().from(quantGovernancePolicy);
		res.json(policies);
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

router.patch("/quant-policy/:riskProfile", async (req, res) => {
	try {
		const { riskProfile } = req.params;
		const {
			useMvo,
			useBlackLitterman,
			useAiDriftPrediction,
			riskAversion,
			tau,
			tacticalBudget,
			driftProbabilityTrigger,
			maxAssetWeight,
			minAssetWeight,
			covarianceLookbackDays,
			ewmaSpan,
			shrinkageIntensity,
			solverMaxIterations,
			solverTolerance,
		} = req.body;

		const dbUpdates: Record<string, unknown> = {};
		if (useMvo !== undefined) dbUpdates.useMvo = useMvo;
		if (useBlackLitterman !== undefined)
			dbUpdates.useBlackLitterman = useBlackLitterman;
		if (useAiDriftPrediction !== undefined)
			dbUpdates.useAiDriftPrediction = useAiDriftPrediction;
		if (riskAversion !== undefined) dbUpdates.riskAversion = riskAversion;
		if (tau !== undefined) dbUpdates.tau = tau;
		if (tacticalBudget !== undefined) dbUpdates.tacticalBudget = tacticalBudget;
		if (driftProbabilityTrigger !== undefined)
			dbUpdates.driftProbabilityTrigger = driftProbabilityTrigger;
		if (maxAssetWeight !== undefined) dbUpdates.maxAssetWeight = maxAssetWeight;
		if (minAssetWeight !== undefined) dbUpdates.minAssetWeight = minAssetWeight;
		if (covarianceLookbackDays !== undefined)
			dbUpdates.covarianceLookbackDays = covarianceLookbackDays;
		if (ewmaSpan !== undefined) dbUpdates.ewmaSpan = ewmaSpan;
		if (shrinkageIntensity !== undefined)
			dbUpdates.shrinkageIntensity = shrinkageIntensity;
		if (solverMaxIterations !== undefined)
			dbUpdates.solverMaxIterations = solverMaxIterations;
		if (solverTolerance !== undefined)
			dbUpdates.solverTolerance = solverTolerance;

		if (Object.keys(dbUpdates).length === 0) {
			return res.status(400).json({ error: "No valid fields to update" });
		}

		dbUpdates.updatedAt = new Date();

		const result = await db
			.update(quantGovernancePolicy)
			.set(dbUpdates)
			.where(eq(quantGovernancePolicy.riskProfile, riskProfile))
			.returning();

		if (result.length === 0) {
			return res
				.status(404)
				.json({ error: `Policy not found for risk profile: ${riskProfile}` });
		}

		res.json(result[0]);
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

router.get("/quant-logs", async (req, res) => {
	try {
		const limit = Math.min(Number(req.query.limit) || 50, 200);
		const modelType = req.query.modelType as string | undefined;
		const status = req.query.status as string | undefined;

		const query = db
			.select()
			.from(quantRunLog)
			.orderBy(desc(quantRunLog.createdAt))
			.limit(limit);

		const logs = await query;
		const filtered = logs.filter((l) => {
			if (modelType && l.modelType !== modelType) return false;
			if (status && l.status !== status) return false;
			return true;
		});

		res.json(filtered);
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

router.get("/model-registry", async (req, res) => {
	try {
		const status = req.query.status as string | undefined;
		const modelName = req.query.modelName as string | undefined;

		const models = await db
			.select()
			.from(quantModelRegistry)
			.orderBy(desc(quantModelRegistry.trainingDate))
			.limit(100);

		const filtered = models.filter((m) => {
			if (status && m.status !== status) return false;
			if (modelName && m.modelName !== modelName) return false;
			return true;
		});

		res.json(filtered);
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

router.get("/retraining-logs", async (req, res) => {
	try {
		const limit = Math.min(Number(req.query.limit) || 50, 200);
		const logs = await db
			.select()
			.from(quantRetrainingLog)
			.orderBy(desc(quantRetrainingLog.createdAt))
			.limit(limit);
		res.json(logs);
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

router.get("/model-health", async (req, res) => {
	try {
		const health = await quantRetrainingPipeline.getModelHealth();
		res.json(health);
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

router.post("/retrain", async (req, res) => {
	try {
		const { modelName } = req.body;
		console.log(`[Admin] Manual retrain triggered for: ${modelName || "ALL"}`);
		const result = await quantRetrainingScheduler.triggerManualRetrain(
			modelName || undefined,
		);
		res.json({ status: "completed", result });
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

router.get("/scheduler-status", async (req, res) => {
	try {
		const status = await quantRetrainingScheduler.getDetailedStatus();
		res.json(status);
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

router.post("/scheduler/start", async (req, res) => {
	try {
		quantRetrainingScheduler.start();
		res.json({ status: "started" });
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

router.post("/scheduler/stop", async (req, res) => {
	try {
		quantRetrainingScheduler.stop();
		res.json({ status: "stopped" });
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

export default router;
