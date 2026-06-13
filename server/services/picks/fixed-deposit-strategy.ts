import { db } from "../../db";
import { instrumentMaster } from "@shared/schema";
import { and, eq, or, sql, desc } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

interface FdCandidate {
	id: string;
	name: string;
	issuer?: string | null;
	interestRate?: string | null;
	tenure?: string | null;
	category?: string | null;
	assetClass?: string | null;
	lastPrice?: string | null;
}

/** Well-known high-yield FD options to use when the DB is empty */
const SYNTHETIC_FD_POOL: Array<{
	name: string;
	issuer: string;
	interestRate: number;
	tenureMonths: number;
	riskLevel: "low" | "medium";
}> = [
	{
		name: "SBI Fixed Deposit - 3 Year",
		issuer: "State Bank of India",
		interestRate: 6.8,
		tenureMonths: 36,
		riskLevel: "low",
	},
	{
		name: "HDFC Bank FD - 2 Year",
		issuer: "HDFC Bank",
		interestRate: 7.0,
		tenureMonths: 24,
		riskLevel: "low",
	},
	{
		name: "Shriram Finance FD - 1 Year",
		issuer: "Shriram Finance",
		interestRate: 8.85,
		tenureMonths: 12,
		riskLevel: "medium",
	},
	{
		name: "Bajaj Finance FD - 18 Month",
		issuer: "Bajaj Finance",
		interestRate: 8.6,
		tenureMonths: 18,
		riskLevel: "medium",
	},
	{
		name: "ICICI Bank FD - 1 Year",
		issuer: "ICICI Bank",
		interestRate: 6.9,
		tenureMonths: 12,
		riskLevel: "low",
	},
];

export class FixedDepositStrategy extends BaseStrategy {
	category: PickCategory = "fixed_deposits";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			// ── 1. Try fetching FD instruments from instrumentMaster ────────────────
			const fds = await db
				.select()
				.from(instrumentMaster)
				.where(
					or(
						eq(instrumentMaster.category, "FD"),
						eq(instrumentMaster.category, "fixed_deposit"),
						eq(instrumentMaster.assetClass, "fixed_deposit"),
					),
				)
				.orderBy(
					// prefer instruments with a known interest rate (interest_rate is NUMERIC — compare only IS NOT NULL)
					sql`CASE WHEN interest_rate IS NOT NULL THEN 0 ELSE 1 END`,
					desc(instrumentMaster.updatedAt),
				)
				.limit(20);

			// ── 2. Exclude recently-picked instruments ──────────────────────────────
			const freshFds = fds.filter((f) => !context.recentIds.has(f.id));

			// ── 3. Pick best candidate ───────────────────────────────────────────────
			if (freshFds.length > 0) {
				const topFd = freshFds[0] as FdCandidate;
				return this.buildPick(context, topFd);
			}

			// ── 4. Fallback: synthetic FD from well-known issuers ───────────────────
			// Pick a different synthetic each day by cycling through the pool
			const dayOfYear = Math.floor(
				(Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
					86_400_000,
			);
			const synth = SYNTHETIC_FD_POOL[dayOfYear % SYNTHETIC_FD_POOL.length];

			console.log(
				`[FixedDepositStrategy] No DB instruments found. Using synthetic FD: ${synth.name}`,
			);

			const unitInvestment = 100_000; // ₹1 lakh as unit for price representation
			const yearFraction = synth.tenureMonths / 12;
			const maturityAmount =
				unitInvestment * (1 + (synth.interestRate / 100) * yearFraction);
			const targetPrice = Math.round(maturityAmount * 100) / 100;
			const stoplossPrice = unitInvestment * 0.98; // 2% penalty for premature withdrawal

			const rationale = await context.service.generateRationale({
				category: "fixed_deposits",
				name: synth.name,
				currentPrice: unitInvestment,
				targetPrice,
				metrics: {
					interestRate: synth.interestRate,
					tenure: `${synth.tenureMonths} months`,
					issuer: synth.issuer,
					maturityAmount,
					taxBenefit: synth.tenureMonths >= 60 ? "80C eligible" : "Regular",
				},
			});

			return {
				category: "fixed_deposits",
				instrumentId: `synth_fd_${dayOfYear % SYNTHETIC_FD_POOL.length}`,
				instrumentName: synth.name,
				recoDate: context.today,
				recoPrice: unitInvestment,
				targetPrice,
				stoplossPrice,
				currentPrice: unitInvestment,
				status: "live",
				expiryDate: this.getExpiryDate(synth.tenureMonths * 30),
				rationale,
				riskLevel: synth.riskLevel,
				suitableFor: ["Conservative", "Moderate"],
				timeHorizon:
					synth.tenureMonths <= 12
						? "short_term"
						: synth.tenureMonths <= 24
							? "medium_term"
							: "long_term",
				confidenceScore: 90,
				sectorCategory: "Fixed Income",
				keyMetrics: {
					interestRate: synth.interestRate,
					tenure: `${synth.tenureMonths} months`,
					issuer: synth.issuer,
					maturityAmount: Math.round(maturityAmount),
					taxBenefit:
						synth.tenureMonths >= 60 ? "80C eligible" : "Regular income",
					investmentType: "Fixed Deposit",
					minInvestment: 10_000,
					suggestedAllocation: 8,
				},
			};
		} catch (error) {
			console.error("[FixedDepositStrategy] Error:", error);
			return null;
		}
	}

	private async buildPick(
		context: StrategyContext,
		fd: FdCandidate,
	): Promise<DailyPickData> {
		const interestRate = fd.interestRate
			? Number.parseFloat(fd.interestRate)
			: 7.5;
		const tenureStr = fd.tenure || "12";
		const tenureMonths = Number.parseInt(tenureStr) || 12;

		// Use ₹1 lakh as the unit investment for price normalization
		const unitInvestment = 100_000;
		const yearFraction = tenureMonths / 12;
		const maturityAmount =
			unitInvestment * (1 + (interestRate / 100) * yearFraction);
		const targetPrice = Math.round(maturityAmount * 100) / 100;
		const stoplossPrice = Math.round(unitInvestment * 0.98 * 100) / 100;

		const rationale = await context.service.generateRationale({
			category: "fixed_deposits",
			name: fd.name,
			currentPrice: unitInvestment,
			targetPrice,
			metrics: {
				interestRate,
				tenure: `${tenureMonths} months`,
				issuer: fd.issuer,
				maturityAmount,
			},
		});

		return {
			category: "fixed_deposits",
			instrumentId: fd.id,
			instrumentName: fd.name,
			recoDate: context.today,
			recoPrice: unitInvestment,
			targetPrice,
			stoplossPrice,
			currentPrice: unitInvestment,
			status: "live",
			expiryDate: this.getExpiryDate(tenureMonths * 30),
			rationale,
			riskLevel: interestRate > 8.5 ? "medium" : "low",
			suitableFor: ["Conservative", "Moderate"],
			timeHorizon:
				tenureMonths <= 12
					? "short_term"
					: tenureMonths <= 24
						? "medium_term"
						: "long_term",
			confidenceScore: 90,
			sectorCategory: "Fixed Income",
			keyMetrics: {
				interestRate,
				tenure: `${tenureMonths} months`,
				issuer: fd.issuer,
				maturityAmount: Math.round(maturityAmount),
				investmentType: "Fixed Deposit",
				category: fd.category,
				suggestedAllocation: 8,
			},
		};
	}

	score(fd: FdCandidate): number {
		const rate = fd.interestRate ? Number.parseFloat(fd.interestRate) : 0;
		if (rate >= 9) return 95;
		if (rate >= 8) return 85;
		if (rate >= 7) return 75;
		return 65;
	}

	async getLivePrice(instrumentId: string): Promise<number | null> {
		try {
			if (instrumentId.startsWith("synth_fd_")) return 100_000;
			const row = await db
				.select({ lastPrice: instrumentMaster.lastPrice })
				.from(instrumentMaster)
				.where(eq(instrumentMaster.id, instrumentId))
				.limit(1);
			return row[0]?.lastPrice ? Number.parseFloat(row[0].lastPrice) : 100_000;
		} catch {
			return 100_000;
		}
	}
}
