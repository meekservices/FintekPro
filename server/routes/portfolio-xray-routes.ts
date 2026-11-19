/* eslint-disable no-console */
import { Router } from "express";
import { db } from "../db";
import { users, agentLeads, agents } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { computePortfolioXRay, PortfolioBreakdownInput } from "../services/portfolio-xray-engine";

const router = Router();

const diagnoseRequestSchema = z.object({
	partnerCode: z.string().optional(),
	name: z.string().min(2, "Name must be at least 2 characters"),
	phone: z.string().min(10, "Valid 10-digit mobile number is required"),
	email: z.string().email("Valid email required").optional().or(z.literal("")),
	city: z.string().optional(),
	equityMutualFunds: z.number().default(0),
	directStocks: z.number().default(0),
	debtAndFD: z.number().default(0),
	goldAndCommodities: z.number().default(0),
	cashAndLiquid: z.number().default(0),
	riskProfile: z.enum(["conservative", "balanced", "aggressive"]).default("balanced"),
	primaryGoal: z.enum(["wealth_growth", "tax_saving", "retirement", "regular_income"]).default("wealth_growth"),
});

// GET /api/public/portfolio-xray/partner/:code
router.get("/partner/:code", async (req, res) => {
	try {
		const { code } = req.params;
		if (!code || code === "default" || code === "general") {
			return res.json({
				success: true,
				partner: {
					id: "default",
					name: "FintekPro Wealth Advisory",
					designation: "SEBI Registered Advisory Partner",
					phone: "",
					email: "support@fintekpro.com",
					initials: "FP",
				},
			});
		}

		// Find user by id or userId
		const foundUsers = await db
			.select({
				id: users.id,
				userId: users.userId,
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
				mobile: users.mobile,
			})
			.from(users)
			.where(or(eq(users.id, code), eq(users.userId, code)))
			.limit(1);

		if (foundUsers.length === 0) {
			return res.json({
				success: true,
				partner: {
					id: "default",
					name: "FintekPro Wealth Advisory",
					designation: "SEBI Registered Advisory Partner",
					phone: "",
					email: "support@fintekpro.com",
					initials: "FP",
				},
			});
		}

		const partner = foundUsers[0];
		const fullName = `${partner.firstName || ""} ${partner.lastName || ""}`.trim() || partner.userId;
		const initials = fullName
			.split(" ")
			.map((n) => n[0])
			.join("")
			.slice(0, 2)
			.toUpperCase() || "FP";

		// Optional: Fetch partner record for ARN
		let designation = "FintekPro Financial Partner";
		try {
			const agentRec = await db
				.select()
				.from(agents)
				.where(eq(agents.userId, partner.id))
				.limit(1);

			if (agentRec.length > 0 && agentRec[0].arnCode) {
				designation = `AMFI Registered MFD (${agentRec[0].arnCode})`;
			}
		} catch (_err) {
			// fallback to standard designation
		}

		res.json({
			success: true,
			partner: {
				id: partner.id,
				name: fullName,
				designation,
				phone: partner.mobile || "",
				email: partner.email || "",
				initials,
			},
		});
	} catch (error: any) {
		console.error("Error fetching partner for X-Ray:", error);
		res.status(500).json({ error: "Failed to fetch partner details" });
	}
});

// POST /api/public/portfolio-xray/diagnose
router.post("/diagnose", async (req, res) => {
	try {
		const parsed = diagnoseRequestSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				error: "Validation failed",
				details: parsed.error.flatten().fieldErrors,
			});
		}

		const data = parsed.data;

		// 1. Compute Diagnostics using pure financial engine
		const input: PortfolioBreakdownInput = {
			equityMutualFunds: data.equityMutualFunds,
			directStocks: data.directStocks,
			debtAndFD: data.debtAndFD,
			goldAndCommodities: data.goldAndCommodities,
			cashAndLiquid: data.cashAndLiquid,
			riskProfile: data.riskProfile,
			primaryGoal: data.primaryGoal,
		};

		const diagnosticResult = computePortfolioXRay(input);

		// 2. Identify partner assignment
		let assignedAgentId: string | null = null;
		let partnerName = "FintekPro Wealth Advisory";

		if (data.partnerCode && data.partnerCode !== "default") {
			const foundUsers = await db
				.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, userId: users.userId })
				.from(users)
				.where(or(eq(users.id, data.partnerCode), eq(users.userId, data.partnerCode)))
				.limit(1);

			if (foundUsers.length > 0) {
				assignedAgentId = foundUsers[0].id;
				partnerName =
					`${foundUsers[0].firstName || ""} ${foundUsers[0].lastName || ""}`.trim() || foundUsers[0].userId;
			}
		}

		// Fallback: If no partner code provided, assign to default system partner or first agent
		if (!assignedAgentId) {
			const fallbackAgent = await db
				.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
				.from(users)
				.where(eq(users.roles, ["agent"]))
				.limit(1);

			if (fallbackAgent.length > 0) {
				assignedAgentId = fallbackAgent[0].id;
			}
		}

		// 3. Save Lead into `agentLeads`
		let leadId: string | null = null;
		if (assignedAgentId) {
			try {
				const cleanPhone = data.phone.replace(/\D/g, "").slice(-10);
				const totalVal = diagnosticResult.summary.totalPortfolioValue;

				// Calculate lead score (higher portfolio = higher score)
				let leadScore = 65;
				if (totalVal >= 10000000) leadScore = 95; // ₹1 Cr+
				else if (totalVal >= 5000000) leadScore = 90; // ₹50L+
				else if (totalVal >= 2500000) leadScore = 80; // ₹25L+
				else if (totalVal >= 1000000) leadScore = 75; // ₹10L+

				const noteSummary = `Portfolio X-Ray Lead Magnet: Total ₹${(totalVal / 100000).toFixed(1)}L | Health: ${diagnosticResult.summary.healthScore}/100 (${diagnosticResult.summary.healthCategory}) | Annual Fee Drag: ₹${diagnosticResult.feeDragAnalysis.annualExpenseLeakage.toLocaleString("en-IN")}/yr`;

				const [insertedLead] = await db
					.insert(agentLeads)
					.values({
						agentId: assignedAgentId,
						name: data.name,
						email: data.email || null,
						phone: cleanPhone,
						stage: "new",
						source: "portfolio_xray_magnet",
						potentialValue: totalVal.toString(),
						score: leadScore,
						notes: noteSummary,
						tags: ["lead_magnet", "portfolio_xray", "high_intent"],
					})
					.returning({ id: agentLeads.id });

				leadId = insertedLead.id;
			} catch (dbErr) {
				console.warn("Could not insert lead from public X-Ray magnet:", dbErr);
			}
		}

		res.json({
			success: true,
			leadId,
			partner: {
				id: assignedAgentId || "default",
				name: partnerName,
			},
			report: diagnosticResult,
		});
	} catch (error: any) {
		console.error("Public Portfolio X-Ray diagnose error:", error);
		res.status(500).json({ error: "Failed to generate portfolio diagnostic" });
	}
});

export default router;
