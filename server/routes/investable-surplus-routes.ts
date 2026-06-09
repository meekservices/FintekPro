// @ts-nocheck
import { Router } from "express";
import { investableSurplusEngine } from "../services/investable-surplus-engine";
import { db } from "../db";
import {
	incomeStreams,
	financialObligations,
	emergencyFunds,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Custom flexible schemas for frontend compatibility
const incomeStreamInputSchema = z.object({
	userId: z.string(),
	incomeType: z.string(),
	sourceName: z.string().optional(),
	grossAmount: z.string().or(z.number()).transform(String),
	netAmount: z.string().or(z.number()).transform(String),
	frequency: z.string().default("monthly"),
	stabilityScore: z.number().or(z.string().transform(Number)).default(100),
	isTaxable: z.boolean().default(true),
	taxRate: z.string().or(z.number()).optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	verified: z.boolean().default(false),
	isActive: z.boolean().default(true),
});

const obligationInputSchema = z.object({
	userId: z.string(),
	obligationType: z.string(),
	creditorName: z.string().optional(),
	institutionName: z.string().optional(),
	monthlyAmount: z.string().or(z.number()).transform(String),
	totalOutstanding: z
		.string()
		.or(z.number())
		.optional()
		.transform((val) => (val ? String(val) : undefined)),
	interestRate: z.string().or(z.number()).optional(),
	tenureMonths: z.number().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	isActive: z.boolean().default(true),
});

const emergencyFundInputSchema = z.object({
	userId: z.string(),
	monthlyExpenses: z.string().or(z.number()).transform(String),
	currentEmergencyFund: z.string().or(z.number()).transform(String),
	fundLocation: z.string().optional(),
	fundType: z.string().default("savings"),
});

// ============================================
// Income Streams CRUD
// ============================================

// Get all income streams for a user
router.get("/income-streams/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const streams = await db
			.select()
			.from(incomeStreams)
			.where(
				and(eq(incomeStreams.userId, userId), eq(incomeStreams.isActive, true)),
			);
		res.json(streams);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// Add income stream
router.post("/income-streams", async (req, res) => {
	try {
		const data = incomeStreamInputSchema.parse(req.body);
		const [stream] = await db.insert(incomeStreams).values(data).returning();
		res.json(stream);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			res
				.status(400)
				.json({ error: "Validation error", details: error.issues });
		} else {
			res.status(500).json({ error: error.message });
		}
	}
});

// Update income stream
router.patch("/income-streams/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const [updated] = await db
			.update(incomeStreams)
			.set({ ...req.body, updatedAt: new Date() })
			.where(eq(incomeStreams.id, id))
			.returning();
		if (!updated) {
			return res.status(404).json({ error: "Income stream not found" });
		}
		res.json(updated);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// Delete income stream (soft delete)
router.delete("/income-streams/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const [updated] = await db
			.update(incomeStreams)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(incomeStreams.id, id))
			.returning();
		if (!updated) {
			return res.status(404).json({ error: "Income stream not found" });
		}
		res.json({ success: true });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// ============================================
// Financial Obligations CRUD
// ============================================

// Get all obligations for a user
router.get("/obligations/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const obligations = await db
			.select()
			.from(financialObligations)
			.where(
				and(
					eq(financialObligations.userId, userId),
					eq(financialObligations.isActive, true),
				),
			);
		res.json(obligations);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// Add obligation
router.post("/obligations", async (req, res) => {
	try {
		const data = obligationInputSchema.parse(req.body);
		const [obligation] = await db
			.insert(financialObligations)
			.values(data)
			.returning();
		res.json(obligation);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			res
				.status(400)
				.json({ error: "Validation error", details: error.issues });
		} else {
			res.status(500).json({ error: error.message });
		}
	}
});

// Update obligation
router.patch("/obligations/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const [updated] = await db
			.update(financialObligations)
			.set({ ...req.body, updatedAt: new Date() })
			.where(eq(financialObligations.id, id))
			.returning();
		if (!updated) {
			return res.status(404).json({ error: "Obligation not found" });
		}
		res.json(updated);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// Delete obligation (soft delete)
router.delete("/obligations/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const [updated] = await db
			.update(financialObligations)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(financialObligations.id, id))
			.returning();
		if (!updated) {
			return res.status(404).json({ error: "Obligation not found" });
		}
		res.json({ success: true });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// ============================================
// Emergency Fund
// ============================================

// Get emergency fund status
router.get("/emergency-fund/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const status = await investableSurplusEngine.getEmergencyFundStatus(userId);
		res.json(status);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// Create/Update emergency fund
router.post("/emergency-fund", async (req, res) => {
	try {
		const data = emergencyFundInputSchema.parse(req.body);

		// Check if exists
		const existing = await db
			.select()
			.from(emergencyFunds)
			.where(eq(emergencyFunds.userId, data.userId))
			.limit(1);

		const monthlyExpenses = Number.parseFloat(
			(data.monthlyExpenses as string) || "0",
		);
		const requiredFund = monthlyExpenses * 6;
		const currentFund = Number.parseFloat(
			(data.currentEmergencyFund as string) || "0",
		);
		const coverageMonths =
			monthlyExpenses > 0 ? currentFund / monthlyExpenses : 0;
		const isAdequate = coverageMonths >= 6;
		const shortfall = Math.max(0, requiredFund - currentFund);

		const fundData = {
			...data,
			requiredEmergencyFund: requiredFund.toString(),
			emergencyFundCoverage: coverageMonths.toFixed(2),
			isAdequate,
			shortfall: shortfall.toString(),
			lastAssessedAt: new Date(),
			updatedAt: new Date(),
		};

		let result;
		if (existing.length > 0) {
			[result] = await db
				.update(emergencyFunds)
				.set(fundData)
				.where(eq(emergencyFunds.userId, data.userId))
				.returning();
		} else {
			[result] = await db.insert(emergencyFunds).values(fundData).returning();
		}

		res.json(result);
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			res
				.status(400)
				.json({ error: "Validation error", details: error.issues });
		} else {
			res.status(500).json({ error: error.message });
		}
	}
});

// ============================================
// Investable Surplus Calculation
// ============================================

// Calculate investable surplus for a user
router.get("/surplus/calculate/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const result =
			await investableSurplusEngine.calculateInvestableSurplus(userId);
		res.json(result);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// Get latest surplus calculation
router.get("/surplus/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const latest = await investableSurplusEngine.getLatestSurplus(userId);
		res.json(latest);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// Perform full assessment (calculate + save surplus + segment)
router.post("/surplus/assess/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const result = await investableSurplusEngine.performFullAssessment(userId);
		res.json(result);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// ============================================
// Client Segmentation
// ============================================

// Get client segment
router.get("/segment/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const segment = await investableSurplusEngine.getClientSegment(userId);
		if (!segment) {
			// Calculate on-the-fly if not exists
			const calculated =
				await investableSurplusEngine.determineClientSegment(userId);
			return res.json({ calculated, saved: null });
		}
		res.json(segment);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// Recalculate client segment
router.post("/segment/recalculate/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const { clientType } = req.body;

		// Calculate surplus first
		const surplusResult =
			await investableSurplusEngine.calculateInvestableSurplus(userId);

		// Determine segment
		const segmentResult = await investableSurplusEngine.determineClientSegment(
			userId,
			clientType,
		);

		// Save segment
		const saved = await investableSurplusEngine.saveClientSegment(
			userId,
			segmentResult,
			surplusResult.annualInvestableSurplus,
		);

		res.json({
			segment: saved,
			surplusUsed: surplusResult.annualInvestableSurplus,
		});
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

// ============================================
// Financial Summary (Dashboard Data)
// ============================================

// Get complete financial summary for dashboard
router.get("/summary/:userId", async (req, res) => {
	try {
		const { userId } = req.params;

		// Get all data in parallel
		const [streams, obligations, emergencyStatus, latestSurplus, segment] =
			await Promise.all([
				db
					.select()
					.from(incomeStreams)
					.where(
						and(
							eq(incomeStreams.userId, userId),
							eq(incomeStreams.isActive, true),
						),
					),
				db
					.select()
					.from(financialObligations)
					.where(
						and(
							eq(financialObligations.userId, userId),
							eq(financialObligations.isActive, true),
						),
					),
				investableSurplusEngine.getEmergencyFundStatus(userId),
				investableSurplusEngine.getLatestSurplus(userId),
				investableSurplusEngine.getClientSegment(userId),
			]);

		// Calculate live surplus
		const liveCalculation =
			await investableSurplusEngine.calculateInvestableSurplus(userId);

		res.json({
			incomeStreams: streams,
			obligations,
			emergencyFund: emergencyStatus,
			latestSurplus,
			segment,
			liveCalculation,
			summary: {
				totalMonthlyIncome: liveCalculation.totalNetIncome / 12,
				totalMonthlyObligations: liveCalculation.totalObligations / 12,
				monthlyInvestableSurplus: liveCalculation.monthlyInvestableSurplus,
				emergencyFundStatus: emergencyStatus.status,
				clientSegment: segment?.segment || "retail",
			},
		});
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

export default router;
