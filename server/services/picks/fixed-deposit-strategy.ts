import { db } from "../../db";
import { instrumentMaster } from "@shared/schema";
import { eq, or, sql, desc } from "drizzle-orm";
import { logger } from "../../logger";
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
	creditRating?: string | null;
	isBank?: boolean;
}

/**
 * Calculates maturity amount using Indian quarterly compounding standard:
 * A = P * (1 + r / 400)^(4 * t)
 * For tenures < 6 months, simple interest applies.
 */
function calculateFdMaturityAmount(
	principal: number,
	annualRatePct: number,
	tenureMonths: number,
): number {
	const tYears = tenureMonths / 12;
	if (tenureMonths < 6) {
		return principal * (1 + (annualRatePct / 100) * tYears);
	}
	const quarters = 4 * tYears;
	return principal * Math.pow(1 + annualRatePct / 400, quarters);
}

/** Well-known high-yield FD options to use when the DB is empty */
const SYNTHETIC_FD_POOL: Array<{
	id: string;
	name: string;
	issuer: string;
	interestRate: number;
	tenureMonths: number;
	riskLevel: "low" | "medium";
	creditRating: string;
	isBank: boolean;
}> = [
	{
		id: "synth_fd_sbi_3y",
		name: "SBI Fixed Deposit - 3 Year",
		issuer: "State Bank of India",
		interestRate: 6.8,
		tenureMonths: 36,
		riskLevel: "low",
		creditRating: "SOVEREIGN/AAA",
		isBank: true,
	},
	{
		id: "synth_fd_hdfc_2y",
		name: "HDFC Bank FD - 2 Year",
		issuer: "HDFC Bank",
		interestRate: 7.0,
		tenureMonths: 24,
		riskLevel: "low",
		creditRating: "AAA",
		isBank: true,
	},
	{
		id: "synth_fd_bajaj_18m",
		name: "Bajaj Finance FD - 18 Month",
		issuer: "Bajaj Finance",
		interestRate: 8.6,
		tenureMonths: 18,
		riskLevel: "medium",
		creditRating: "AAA",
		isBank: false,
	},
	{
		id: "synth_fd_shriram_1y",
		name: "Shriram Finance FD - 1 Year",
		issuer: "Shriram Finance",
		interestRate: 8.85,
		tenureMonths: 12,
		riskLevel: "medium",
		creditRating: "AA+",
		isBank: false,
	},
	{
		id: "synth_fd_icici_1y",
		name: "ICICI Bank FD - 1 Year",
		issuer: "ICICI Bank",
		interestRate: 6.9,
		tenureMonths: 12,
		riskLevel: "low",
		creditRating: "AAA",
		isBank: true,
	},
];

export class FixedDepositStrategy extends BaseStrategy {
	category: PickCategory = "fixed_deposits";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			// ── 1. Try fetching FD instruments from instrumentMaster ────────────────
			let fds: any[] = [];
			try {
				fds = await db
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
			} catch {
				fds = [];
			}

			// ── 2. Exclude recently-picked instruments ──────────────────────────────
			const freshFds = this.filterRecentPicks(fds, context.recentIds);

			// ── 3. Pick best candidate ───────────────────────────────────────────────
			if (freshFds.length > 0) {
				const topFd = freshFds[0] as FdCandidate;
				return this.buildPick(context, topFd);
			}

			// ── 4. Fallback: synthetic FD from well-known issuers ───────────────────
			const freshSynth = this.filterRecentPicks(SYNTHETIC_FD_POOL, context.recentIds);
			const synth = freshSynth[0];

			logger.info(
				`[FixedDepositStrategy] No DB instruments found. Using synthetic FD: ${synth.name}`,
			);

			const unitInvestment = 100_000; // ₹1 lakh as unit for price representation
			const maturityAmount = calculateFdMaturityAmount(unitInvestment, synth.interestRate, synth.tenureMonths);
			const targetPrice = Math.round(maturityAmount * 100) / 100;
			const stoplossPrice = unitInvestment * 0.98; // 2% penalty for premature withdrawal
			const apy = Math.round((Math.pow(1 + synth.interestRate / 400, 4) - 1) * 10000) / 100;

			const rationale = await context.service.generateRationale({
				category: "fixed_deposits",
				name: synth.name,
				currentPrice: unitInvestment,
				targetPrice,
				metrics: {
					interestRate: synth.interestRate,
					annualizedYieldAPY: apy,
					tenure: `${synth.tenureMonths} months`,
					issuer: synth.issuer,
					creditRating: synth.creditRating,
					compoundingFrequency: "Quarterly",
					dicgcCoverage: synth.isBank ? "DICGC Insured up to ₹5 Lakhs" : "Corporate/NBFC High Safety",
					maturityAmount: Math.round(maturityAmount),
					taxBenefit: synth.tenureMonths >= 60 ? "80C eligible" : "Regular",
				},
			});

			const fdScore = this.score(synth);
			const confidenceScore = this.getConfidenceScore("fixed_deposits", fdScore, 100, 5);

			return {
				category: "fixed_deposits",
				instrumentId: synth.id,
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
				confidenceScore,
				sectorCategory: "Fixed Income",
				keyMetrics: {
					interestRate: synth.interestRate,
					annualizedYieldAPY: apy,
					compoundingFrequency: "Quarterly",
					creditRating: synth.creditRating,
					dicgcInsured: synth.isBank,
					dicgcNotice: synth.isBank ? "Principal & interest insured up to ₹5 Lakhs by RBI DICGC" : "Rated Corporate/NBFC Deposit",
					seniorCitizenRate: Math.round((synth.interestRate + 0.5) * 100) / 100,
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
			logger.error("[FixedDepositStrategy] Error:", error instanceof Error ? error : new Error(String(error)));
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
		const maturityAmount = calculateFdMaturityAmount(unitInvestment, interestRate, tenureMonths);
		const targetPrice = Math.round(maturityAmount * 100) / 100;
		const stoplossPrice = Math.round(unitInvestment * 0.98 * 100) / 100;
		const apy = Math.round((Math.pow(1 + interestRate / 400, 4) - 1) * 10000) / 100;

		const issuerLower = (fd.issuer || fd.name || "").toLowerCase();
		const isBank = fd.isBank ?? (issuerLower.includes("bank") || issuerLower.includes("sbi") || issuerLower.includes("hdfc") || issuerLower.includes("icici"));
		const rating = fd.creditRating || (isBank ? "SOVEREIGN/AAA" : "AAA");

		const rationale = await context.service.generateRationale({
			category: "fixed_deposits",
			name: fd.name,
			currentPrice: unitInvestment,
			targetPrice,
			metrics: {
				interestRate,
				annualizedYieldAPY: apy,
				compoundingFrequency: "Quarterly",
				tenure: `${tenureMonths} months`,
				issuer: fd.issuer,
				creditRating: rating,
				maturityAmount: Math.round(maturityAmount),
			},
		});

		const fdScore = this.score(fd);
		const confidenceScore = this.getConfidenceScore("fixed_deposits", fdScore, 100, 5);

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
			confidenceScore,
			sectorCategory: "Fixed Income",
			keyMetrics: {
				interestRate,
				annualizedYieldAPY: apy,
				compoundingFrequency: "Quarterly",
				creditRating: rating,
				dicgcInsured: isBank,
				dicgcNotice: isBank ? "Principal & interest insured up to ₹5 Lakhs by RBI DICGC" : "Rated Corporate/NBFC Deposit",
				seniorCitizenRate: Math.round((interestRate + 0.5) * 100) / 100,
				tenure: `${tenureMonths} months`,
				issuer: fd.issuer,
				maturityAmount: Math.round(maturityAmount),
				investmentType: "Fixed Deposit",
				category: fd.category,
				suggestedAllocation: 8,
			},
		};
	}

	score(fd: FdCandidate | any): number {
		let score = 50;
		const rate = fd.interestRate ? Number.parseFloat(String(fd.interestRate)) : 0;
		if (rate >= 8.5) score += 25;
		else if (rate >= 7.5) score += 20;
		else if (rate >= 6.8) score += 15;
		else if (rate >= 6.0) score += 10;

		// Credit quality & regulatory safety
		const issuerLower = String(fd.issuer || fd.name || "").toLowerCase();
		const isBank = fd.isBank ?? (issuerLower.includes("bank") || issuerLower.includes("sbi") || issuerLower.includes("hdfc") || issuerLower.includes("icici"));
		const rating = String(fd.creditRating || "").toUpperCase();

		if (isBank) {
			score += 20; // Scheduled Commercial Bank with RBI DICGC cover
		} else if (rating.includes("AAA")) {
			score += 15; // Prime AAA rated NBFC (e.g. Bajaj Finance)
		} else if (rating.includes("AA+")) {
			score += 10;
		} else if (rating.includes("AA")) {
			score += 5;
		} else if (rating.includes("A") || rating.includes("BBB")) {
			score -= 15; // Lower-rated credit spread penalty
		} else {
			score -= 5;
		}

		// Tenure sweet spot: 12–36 months
		const tenureMonths = Number.parseInt(String(fd.tenure || fd.tenureMonths || "12")) || 12;
		if (tenureMonths >= 12 && tenureMonths <= 36) score += 10;

		return Math.min(100, Math.max(25, score));
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
