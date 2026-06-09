// @ts-nocheck
import { Router } from "express";
import { db } from "../db";
import {
	platformFeeConfig,
	type InsertPlatformFeeConfig,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { feeCalculatorService } from "../services/fee-calculator-service";

const router = Router();

const DEFAULT_FEES: Partial<InsertPlatformFeeConfig>[] = [
	// REGULATORY FEES
	{
		feeCode: "STT_EQUITY_DELIVERY",
		feeName: "Securities Transaction Tax - Equity Delivery",
		feeDescription: "STT on equity delivery trades (buy & sell)",
		category: "regulatory",
		chargeType: "percentage",
		rateValue: "0.1",
		rateUnit: "percent",
		applicableTo: "equity",
		isGstApplicable: false,
		isRegulatory: true,
		regulatoryReference: "Securities Transaction Tax Act, 2004",
		statuteSection: "Section 98 - STT on sale of securities",
		payer: "both",
		displayOrder: 1,
		displayLabel: "STT",
	},
	{
		feeCode: "STT_EQUITY_INTRADAY",
		feeName: "Securities Transaction Tax - Equity Intraday",
		feeDescription: "STT on intraday trades (sell side only)",
		category: "regulatory",
		chargeType: "percentage",
		rateValue: "0.025",
		rateUnit: "percent",
		applicableTo: "equity",
		isGstApplicable: false,
		isRegulatory: true,
		regulatoryReference: "Securities Transaction Tax Act, 2004",
		payer: "client",
		displayOrder: 2,
		displayLabel: "STT (Intraday)",
	},
	{
		feeCode: "STT_MF_REDEMPTION",
		feeName: "Securities Transaction Tax - MF Redemption",
		feeDescription: "STT on equity mutual fund redemption/switch",
		category: "regulatory",
		chargeType: "percentage",
		rateValue: "0.001",
		rateUnit: "percent",
		applicableTo: "mutual_fund",
		isGstApplicable: false,
		isRegulatory: true,
		regulatoryReference: "Securities Transaction Tax Act, 2004",
		payer: "client",
		displayOrder: 3,
		displayLabel: "STT",
	},
	{
		feeCode: "STAMP_DUTY_UNLISTED",
		feeName: "Stamp Duty - Unlisted Shares",
		feeDescription: "Off-market transfer stamp duty per Indian Stamp Act",
		category: "regulatory",
		chargeType: "percentage",
		rateValue: "0.015",
		rateUnit: "percent",
		applicableTo: "unlisted",
		isGstApplicable: false,
		isRegulatory: true,
		regulatoryReference: "Indian Stamp Act 1899, Article 56A",
		payer: "seller",
		displayOrder: 4,
		displayLabel: "Stamp Duty",
	},
	{
		feeCode: "STAMP_DUTY_BOND",
		feeName: "Stamp Duty - Bonds/NCDs",
		feeDescription: "Transfer stamp duty on bonds and debentures",
		category: "regulatory",
		chargeType: "percentage",
		rateValue: "0.0001",
		rateUnit: "percent",
		applicableTo: "bond",
		isGstApplicable: false,
		isRegulatory: true,
		regulatoryReference: "Indian Stamp Act 1899, Article 27",
		payer: "client",
		displayOrder: 5,
		displayLabel: "Stamp Duty",
	},
	{
		feeCode: "SEBI_TURNOVER_FEE",
		feeName: "SEBI Turnover Fee",
		feeDescription: "SEBI regulatory fee on exchange transactions",
		category: "regulatory",
		chargeType: "percentage",
		rateValue: "0.0001",
		rateUnit: "percent",
		applicableTo: "all",
		isGstApplicable: true,
		isRegulatory: true,
		regulatoryReference: "SEBI (Fees) Regulations",
		payer: "client",
		displayOrder: 6,
		displayLabel: "SEBI Charges",
	},
	{
		feeCode: "GST_SERVICES",
		feeName: "Goods & Services Tax",
		feeDescription: "GST on brokerage and service fees",
		category: "regulatory",
		chargeType: "percentage",
		rateValue: "18",
		rateUnit: "percent",
		applicableTo: "all",
		isGstApplicable: false,
		isRegulatory: true,
		regulatoryReference: "CGST Act, 2017",
		payer: "client",
		displayOrder: 7,
		displayLabel: "GST (18%)",
	},

	// PLATFORM FEES
	{
		feeCode: "BROKERAGE_EQUITY",
		feeName: "Brokerage - Equity",
		feeDescription: "Trading brokerage for equity transactions",
		category: "platform",
		chargeType: "percentage",
		rateValue: "0.03",
		rateUnit: "percent",
		minAmount: "0",
		maxAmount: "20",
		applicableTo: "equity",
		isGstApplicable: true,
		investorTierRates: { retail: 0.03, sHNI: 0.02, bHNI: 0.015, qib: 0.01 },
		payer: "client",
		isWaivable: true,
		maxWaiverPercent: "50",
		displayOrder: 10,
		displayLabel: "Brokerage",
	},
	{
		feeCode: "BROKERAGE_BOND",
		feeName: "Brokerage - Bonds",
		feeDescription: "Brokerage for bond transactions",
		category: "platform",
		chargeType: "percentage",
		rateValue: "0.25",
		rateUnit: "percent",
		applicableTo: "bond",
		isGstApplicable: true,
		investorTierRates: { retail: 0.5, sHNI: 0.35, bHNI: 0.25, qib: 0.1 },
		payer: "client",
		isWaivable: true,
		maxWaiverPercent: "100",
		displayOrder: 11,
		displayLabel: "Brokerage",
	},
	{
		feeCode: "PLATFORM_FEE",
		feeName: "Platform Fee",
		feeDescription: "Technology and platform maintenance fee",
		category: "platform",
		chargeType: "percentage",
		rateValue: "0.05",
		rateUnit: "percent",
		applicableTo: "all",
		isGstApplicable: true,
		payer: "client",
		isWaivable: true,
		maxWaiverPercent: "100",
		displayOrder: 12,
		displayLabel: "Platform Fee",
	},
	{
		feeCode: "ACCOUNT_MAINTENANCE",
		feeName: "Account Maintenance Charge",
		feeDescription: "Annual demat/trading account maintenance",
		category: "platform",
		chargeType: "flat",
		rateValue: "300",
		rateUnit: "inr",
		applicableTo: "all",
		isGstApplicable: true,
		collectionPoint: "annual",
		payer: "client",
		isWaivable: true,
		maxWaiverPercent: "100",
		displayOrder: 13,
		displayLabel: "AMC",
	},

	// ADVISORY FEES
	{
		feeCode: "PORTFOLIO_REVIEW",
		feeName: "Portfolio Review",
		feeDescription: "Expert portfolio analysis and recommendations",
		category: "advisory",
		chargeType: "flat",
		rateValue: "999",
		rateUnit: "inr",
		applicableTo: "advisory",
		isGstApplicable: true,
		payer: "client",
		isWaivable: true,
		maxWaiverPercent: "100",
		displayOrder: 20,
		displayLabel: "Portfolio Review",
	},
	{
		feeCode: "TAX_PLANNING",
		feeName: "Tax Planning Consultation",
		feeDescription: "Expert tax planning and optimization session",
		category: "advisory",
		chargeType: "flat",
		rateValue: "1999",
		rateUnit: "inr",
		applicableTo: "tax_services",
		isGstApplicable: true,
		payer: "client",
		isWaivable: true,
		maxWaiverPercent: "50",
		displayOrder: 21,
		displayLabel: "Tax Consultation",
	},
	{
		feeCode: "FINANCIAL_PLANNING",
		feeName: "Financial Planning Service",
		feeDescription: "Comprehensive financial planning with expert advisor",
		category: "advisory",
		chargeType: "flat",
		rateValue: "4999",
		rateUnit: "inr",
		applicableTo: "advisory",
		isGstApplicable: true,
		payer: "client",
		isWaivable: true,
		maxWaiverPercent: "25",
		displayOrder: 22,
		displayLabel: "Financial Planning",
	},

	// DOCUMENT FEES
	{
		feeCode: "PHYSICAL_STATEMENT",
		feeName: "Physical Statement",
		feeDescription: "Physical copy of account statement",
		category: "document",
		chargeType: "flat",
		rateValue: "50",
		rateUnit: "inr",
		applicableTo: "all",
		isGstApplicable: true,
		payer: "client",
		displayOrder: 30,
		displayLabel: "Statement Charges",
	},
	{
		feeCode: "DEMAT_TRANSFER",
		feeName: "Demat Transfer",
		feeDescription: "Off-market transfer of securities to another demat",
		category: "document",
		chargeType: "flat",
		rateValue: "25",
		rateUnit: "inr",
		applicableTo: "all",
		isGstApplicable: true,
		payer: "client",
		displayOrder: 31,
		displayLabel: "Transfer Charges",
	},
	{
		feeCode: "PLEDGE_CREATION",
		feeName: "Pledge/Unpledge Charges",
		feeDescription: "Creating or releasing pledge on securities",
		category: "document",
		chargeType: "flat",
		rateValue: "25",
		rateUnit: "inr",
		applicableTo: "all",
		isGstApplicable: true,
		payer: "client",
		displayOrder: 32,
		displayLabel: "Pledge Charges",
	},

	// CONVENIENCE FEES
	{
		feeCode: "PAYMENT_GATEWAY",
		feeName: "Payment Gateway Charges",
		feeDescription: "Third-party payment processing fee (pass-through)",
		category: "convenience",
		chargeType: "percentage",
		rateValue: "1.5",
		rateUnit: "percent",
		applicableTo: "all",
		isGstApplicable: true,
		payer: "client",
		isWaivable: false,
		displayOrder: 40,
		displayLabel: "Payment Charges",
	},
	{
		feeCode: "RUSH_PROCESSING",
		feeName: "Rush Processing Fee",
		feeDescription: "Priority/same-day processing of requests",
		category: "convenience",
		chargeType: "percentage",
		rateValue: "25",
		rateUnit: "percent",
		applicableTo: "all",
		isGstApplicable: true,
		payer: "client",
		isWaivable: true,
		maxWaiverPercent: "100",
		displayOrder: 41,
		displayLabel: "Rush Fee",
	},

	// VALUE-ADDED SERVICES
	{
		feeCode: "AI_RECOMMENDATIONS",
		feeName: "AI-Powered Recommendations",
		feeDescription: "Premium AI analysis and personalized recommendations",
		category: "value_added",
		chargeType: "flat",
		rateValue: "299",
		rateUnit: "inr",
		applicableTo: "all",
		collectionPoint: "monthly",
		isGstApplicable: true,
		payer: "client",
		isWaivable: true,
		maxWaiverPercent: "100",
		displayOrder: 50,
		displayLabel: "AI Premium",
	},
	{
		feeCode: "API_ACCESS",
		feeName: "API Access",
		feeDescription: "Developer API access for advanced integrations",
		category: "value_added",
		chargeType: "flat",
		rateValue: "999",
		rateUnit: "inr",
		applicableTo: "all",
		collectionPoint: "monthly",
		isGstApplicable: true,
		payer: "client",
		displayOrder: 51,
		displayLabel: "API Access",
	},
];

router.get("/", requireAdmin, async (req, res) => {
	try {
		const { category, applicableTo, isActive } = req.query;

		const query = db.select().from(platformFeeConfig);

		const fees = await query.orderBy(platformFeeConfig.displayOrder);

		const filtered = fees.filter((fee) => {
			if (category && fee.category !== category) return false;
			if (applicableTo && fee.applicableTo !== applicableTo) return false;
			if (isActive !== undefined && fee.isActive !== (isActive === "true"))
				return false;
			return true;
		});

		const grouped = filtered.reduce(
			(acc, fee) => {
				const cat = fee.category || "other";
				if (!acc[cat]) acc[cat] = [];
				acc[cat].push(fee);
				return acc;
			},
			{} as Record<string, typeof fees>,
		);

		res.json({
			success: true,
			data: filtered,
			grouped,
			categories: [
				"regulatory",
				"platform",
				"advisory",
				"document",
				"convenience",
				"value_added",
			],
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/:id", requireAdmin, async (req, res) => {
	try {
		const [fee] = await db
			.select()
			.from(platformFeeConfig)
			.where(eq(platformFeeConfig.id, req.params.id))
			.limit(1);

		if (!fee) {
			return res.status(404).json({ success: false, error: "Fee not found" });
		}

		res.json({ success: true, data: fee });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/", requireAdmin, async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		const data = req.body;

		const [fee] = await db
			.insert(platformFeeConfig)
			.values({
				...data,
				createdBy: userId,
				updatedBy: userId,
			})
			.returning();

		res.json({ success: true, data: fee });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.put("/:id", requireAdmin, async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		const { id, createdAt, createdBy, ...data } = req.body;

		const [fee] = await db
			.update(platformFeeConfig)
			.set({
				...data,
				updatedAt: new Date(),
				updatedBy: userId,
			})
			.where(eq(platformFeeConfig.id, req.params.id))
			.returning();

		if (!fee) {
			return res.status(404).json({ success: false, error: "Fee not found" });
		}

		res.json({ success: true, data: fee });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.delete("/:id", requireAdmin, async (req, res) => {
	try {
		const [fee] = await db
			.delete(platformFeeConfig)
			.where(eq(platformFeeConfig.id, req.params.id))
			.returning();

		if (!fee) {
			return res.status(404).json({ success: false, error: "Fee not found" });
		}

		res.json({ success: true, message: "Fee deleted" });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/seed-defaults", requireAdmin, async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		let seeded = 0;
		let skipped = 0;

		for (const feeData of DEFAULT_FEES) {
			const existing = await db
				.select()
				.from(platformFeeConfig)
				.where(eq(platformFeeConfig.feeCode, feeData.feeCode!))
				.limit(1);

			if (existing.length === 0) {
				await db.insert(platformFeeConfig).values({
					...feeData,
					createdBy: userId,
					updatedBy: userId,
				} as any);
				seeded++;
			} else {
				skipped++;
			}
		}

		res.json({
			success: true,
			message: `Seeded ${seeded} fees, skipped ${skipped} existing`,
			seeded,
			skipped,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.patch("/:id/toggle", requireAdmin, async (req, res) => {
	try {
		const userId = (req as any).user?.id;

		const [current] = await db
			.select()
			.from(platformFeeConfig)
			.where(eq(platformFeeConfig.id, req.params.id))
			.limit(1);

		if (!current) {
			return res.status(404).json({ success: false, error: "Fee not found" });
		}

		const [fee] = await db
			.update(platformFeeConfig)
			.set({
				isActive: !current.isActive,
				updatedAt: new Date(),
				updatedBy: userId,
			})
			.where(eq(platformFeeConfig.id, req.params.id))
			.returning();

		res.json({ success: true, data: fee });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/calculate", async (req, res) => {
	try {
		const {
			transactionAmount,
			productType,
			investorTier,
			includeGst,
			applyWaivers,
			waiverPercent,
		} = req.body;

		const amount =
			typeof transactionAmount === "number"
				? transactionAmount
				: Number.parseFloat(transactionAmount);
		if (Number.isNaN(amount) || amount < 0) {
			return res
				.status(400)
				.json({
					success: false,
					error: "Valid transactionAmount is required (positive number)",
				});
		}

		const validProductTypes = [
			"all",
			"equity",
			"mutual_fund",
			"bond",
			"unlisted",
			"ipo",
			"derivatives",
			"loan",
			"tax_services",
			"advisory",
		];
		if (!productType || !validProductTypes.includes(productType)) {
			return res
				.status(400)
				.json({
					success: false,
					error: `productType must be one of: ${validProductTypes.join(", ")}`,
				});
		}

		const validTiers = ["retail", "sHNI", "bHNI", "qib"];
		const tier =
			investorTier && validTiers.includes(investorTier)
				? investorTier
				: "retail";

		const gstIncluded =
			includeGst === true || includeGst === "true" || includeGst === undefined;
		const applyWaiver = applyWaivers === true || applyWaivers === "true";
		const waiver =
			typeof waiverPercent === "number"
				? waiverPercent
				: Number.parseFloat(waiverPercent) || 0;

		const breakdown = await feeCalculatorService.calculateFees({
			transactionAmount: amount,
			productType,
			investorTier: tier as "retail" | "sHNI" | "bHNI" | "qib",
			includeGst: gstIncluded,
			applyWaivers: applyWaiver,
			waiverPercent: Math.min(Math.max(waiver, 0), 100),
		});

		res.json({ success: true, data: breakdown });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/calculate/stamp-duty/:productType/:amount", async (req, res) => {
	try {
		const { productType, amount } = req.params;
		const stampDuty = await feeCalculatorService.getStampDuty(
			productType,
			Number.parseFloat(amount),
		);
		res.json({
			success: true,
			data: { productType, amount: Number.parseFloat(amount), stampDuty },
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/calculate/stt/:productType/:amount", async (req, res) => {
	try {
		const { productType, amount } = req.params;
		const side = req.query.side as "buy" | "sell" | undefined;
		const stt = await feeCalculatorService.getSTT(
			productType,
			Number.parseFloat(amount),
			side || "both",
		);
		res.json({
			success: true,
			data: {
				productType,
				amount: Number.parseFloat(amount),
				stt,
				side: side || "both",
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/calculate/brokerage/:productType/:amount", async (req, res) => {
	try {
		const { productType, amount } = req.params;
		const investorTier = (req.query.tier as string) || "retail";
		const brokerage = await feeCalculatorService.getBrokerage(
			productType,
			Number.parseFloat(amount),
			investorTier,
		);
		res.json({
			success: true,
			data: {
				productType,
				amount: Number.parseFloat(amount),
				brokerage,
				investorTier,
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/clear-cache", requireAdmin, async (req, res) => {
	try {
		feeCalculatorService.clearCache();
		res.json({ success: true, message: "Fee cache cleared" });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

// Aggregated fee calculation for mixed-category baskets
router.post("/calculate-aggregated", async (req, res) => {
	try {
		const { items, investorTier, includeGst, applyWaivers, waiverPercent } =
			req.body;

		// Validate items array
		if (!items || !Array.isArray(items) || items.length === 0) {
			return res.status(400).json({
				success: false,
				error:
					"items array is required with at least one item containing productType and amount",
			});
		}

		const validProductTypes = [
			"equity",
			"mutual_fund",
			"bond",
			"unlisted",
			"ipo",
			"derivatives",
			"loan",
			"tax_services",
			"advisory",
			"pms",
			"aif",
		];

		// Validate and normalize each item
		const normalizedItems = items.map((item: any, index: number) => {
			const amount =
				typeof item.amount === "number"
					? item.amount
					: Number.parseFloat(item.amount);
			if (Number.isNaN(amount) || amount < 0) {
				throw new Error(
					`Invalid amount at index ${index}: must be a positive number`,
				);
			}
			if (!item.productType || !validProductTypes.includes(item.productType)) {
				throw new Error(
					`Invalid productType at index ${index}: must be one of ${validProductTypes.join(", ")}`,
				);
			}
			return { productType: item.productType, amount };
		});

		const validTiers = ["retail", "sHNI", "bHNI", "qib"];
		const tier =
			investorTier && validTiers.includes(investorTier)
				? investorTier
				: "retail";

		const gstIncluded =
			includeGst === true || includeGst === "true" || includeGst === undefined;
		const applyWaiver = applyWaivers === true || applyWaivers === "true";
		const waiver =
			typeof waiverPercent === "number"
				? waiverPercent
				: Number.parseFloat(waiverPercent) || 0;

		const breakdown = await feeCalculatorService.calculateAggregatedFees({
			items: normalizedItems,
			investorTier: tier as "retail" | "sHNI" | "bHNI" | "qib",
			includeGst: gstIncluded,
			applyWaivers: applyWaiver,
			waiverPercent: Math.min(Math.max(waiver, 0), 100),
		});

		res.json({ success: true, data: breakdown });
	} catch (error: any) {
		res.status(400).json({ success: false, error: error.message });
	}
});

export default router;
console.log("✅ Platform Fee Configuration routes registered");
