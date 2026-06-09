import { db } from "./db";
import { userProfiles } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Product categories by KYC tier
export const PRODUCT_ACCESS_MATRIX = {
	basic: [
		"mutual_funds_regular",
		"equity_cash_limited", // up to ₹50K/day
		"ipo_retail",
		"government_securities",
		"fixed_deposits",
		"savings_products",
	],
	enhanced: [
		// All basic tier products plus:
		"mutual_funds_direct",
		"equity_cash_unlimited",
		"equity_delivery",
		"derivatives_fo", // Futures & Options
		"commodities_trading",
		"currency_derivatives",
		"global_trading",
		"unlisted_securities",
		"bonds_ncds",
		"mlds", // Market Linked Debentures
		"etf_trading",
		"margin_trading",
	],
	accredited_investor: [
		// All enhanced tier products plus:
		"aif_cat1", // Alternative Investment Funds Category I
		"aif_cat2",
		"aif_cat3",
		"pms", // Portfolio Management Services
		"pre_ipo_investments",
		"structured_products",
		"offshore_investments",
		"private_equity",
		"venture_capital",
		"real_estate_investment_trusts",
		"invoice_discounting",
		"startup_investments",
	],
};

// SEBI Accredited Investor thresholds (as of 2025)
export const ACCREDITED_INVESTOR_CRITERIA = {
	ANNUAL_INCOME_THRESHOLD: 20000000, // ₹2 Crore
	NET_WORTH_THRESHOLD: 75000000, // ₹7.5 Crore (excluding primary residence)
	PORTFOLIO_VALUE_THRESHOLD: 50000000, // ₹5 Crore in securities
	PROFESSIONAL_QUALIFICATIONS: [
		"CA",
		"CFA",
		"MBA_Finance",
		"CPA",
		"FRM",
		"ACCA",
	],
	MIN_EXPERIENCE_YEARS: 3, // For professional qualification route
};

interface TierUpgradeRequirement {
	tier: "basic" | "enhanced" | "accredited_investor";
	requirements: {
		field: string;
		label: string;
		completed: boolean;
		description: string;
	}[];
	canUpgrade: boolean;
	completionPercentage: number;
}

/**
 * Get KYC tier requirements and check if user can upgrade
 */
export async function getTierUpgradeRequirements(
	userId: string,
	targetTier: "enhanced" | "accredited_investor",
): Promise<TierUpgradeRequirement> {
	const profile = await db.query.userProfiles.findFirst({
		where: eq(userProfiles.userId, userId),
	});

	if (!profile) {
		throw new Error("User profile not found");
	}
	const profileData = profile as any; // Extra KYC fields (kycTier, accreditedInvestorStatus, etc.) not in Drizzle schema

	if (targetTier === "enhanced") {
		const requirements = [
			{
				field: "panNumber",
				label: "PAN Card",
				completed: !!profile.panNumber,
				description: "Valid PAN number verified",
			},
			{
				field: "aadharNumber",
				label: "Aadhaar Card",
				completed: !!profile.aadharNumber,
				description: "Aadhaar number verified",
			},
			{
				field: "videoKycCompleted",
				label: "Video KYC",
				completed: profileData.videoKycCompleted === true,
				description: "Live video KYC session completed",
			},
			{
				field: "annualIncome",
				label: "Income Proof",
				completed: !!profile.annualIncome,
				description: "Annual income documentation submitted",
			},
			{
				field: "riskTolerance",
				label: "Risk Assessment",
				completed: !!profile.riskTolerance,
				description: "Investment risk profile completed",
			},
			{
				field: "fatcaStatus",
				label: "FATCA Declaration",
				completed: profile.fatcaStatus === "Y",
				description: "FATCA/CRS declaration completed",
			},
			{
				field: "bankAccountNumber",
				label: "Bank Account",
				completed: !!profile.bankAccountNumber,
				description: "Bank account linked and verified",
			},
		];

		const completedCount = requirements.filter((r) => r.completed).length;
		const canUpgrade = completedCount === requirements.length;

		return {
			tier: "enhanced",
			requirements,
			canUpgrade,
			completionPercentage: Math.round(
				(completedCount / requirements.length) * 100,
			),
		};
	}

	if (targetTier === "accredited_investor") {
		// Check if user meets SEBI criteria
		const meetsIncomeCriteria =
			profileData.annualIncomeAmount &&
			Number(profileData.annualIncomeAmount) >=
				ACCREDITED_INVESTOR_CRITERIA.ANNUAL_INCOME_THRESHOLD;

		const meetsNetWorthCriteria =
			profileData.netWorthExcludingResidence &&
			Number(profileData.netWorthExcludingResidence) >=
				ACCREDITED_INVESTOR_CRITERIA.NET_WORTH_THRESHOLD;

		const meetsPortfolioCriteria =
			profileData.portfolioValueAmount &&
			Number(profileData.portfolioValueAmount) >=
				ACCREDITED_INVESTOR_CRITERIA.PORTFOLIO_VALUE_THRESHOLD;

		const meetsProfessionalCriteria =
			profileData.professionalQualification &&
			ACCREDITED_INVESTOR_CRITERIA.PROFESSIONAL_QUALIFICATIONS.includes(
				profileData.professionalQualification,
			) &&
			profileData.professionalQualificationVerified &&
			(profileData.professionalExperienceYears || 0) >=
				ACCREDITED_INVESTOR_CRITERIA.MIN_EXPERIENCE_YEARS;

		// Determine which qualification route user is taking
		const hasIncomeProof =
			profileData.incomeProofDocuments &&
			Array.isArray(profileData.incomeProofDocuments) &&
			profileData.incomeProofDocuments.length > 0;
		const hasCaCertificate = !!profileData.caCertificateUrl;
		const hasPortfolioStatement = !!profileData.portfolioStatementUrl;

		// Base requirements (always needed)
		const baseRequirements = [
			{
				field: "enhancedKycCompleted",
				label: "Enhanced KYC Completed",
				completed:
					profileData.kycTier === "enhanced" ||
					profileData.kycTier === "accredited_investor",
				description: "Enhanced KYC tier must be completed first",
			},
			{
				field: "complianceReview",
				label: "Compliance Clear",
				completed: profile.amlStatus === "clear" && profile.pepStatus === "N",
				description: "AML and PEP status must be clear",
			},
		];

		// Conditional requirements based on qualification route
		const conditionalRequirements: typeof baseRequirements = [];

		if (meetsIncomeCriteria && hasIncomeProof) {
			conditionalRequirements.push({
				field: "incomeQualification",
				label: "Income-Based Qualification (₹2Cr+)",
				completed: true,
				description: "Annual income ₹2Cr+ with proof documents",
			});
		} else if (meetsNetWorthCriteria && hasCaCertificate) {
			conditionalRequirements.push({
				field: "netWorthQualification",
				label: "Net Worth-Based Qualification (₹7.5Cr+)",
				completed: true,
				description:
					"Net worth ₹7.5Cr+ (excluding residence) with CA certificate",
			});
		} else if (meetsPortfolioCriteria && hasPortfolioStatement) {
			conditionalRequirements.push({
				field: "portfolioQualification",
				label: "Portfolio-Based Qualification (₹5Cr+)",
				completed: true,
				description: "Securities portfolio ₹5Cr+ with portfolio statement",
			});
		} else if (meetsProfessionalCriteria) {
			conditionalRequirements.push({
				field: "professionalQualification",
				label: "Professional Qualification",
				completed: true,
				description: `${profileData.professionalQualification} with ${profileData.professionalExperienceYears}+ years experience`,
			});
		} else {
			// User hasn't met any criteria yet - show all options
			conditionalRequirements.push({
				field: "anyQualification",
				label: "SEBI Accredited Investor Qualification",
				completed: false,
				description:
					"Choose ONE route: Income ₹2Cr+ with proof OR Net Worth ₹7.5Cr+ with CA cert OR Portfolio ₹5Cr+ with statement OR Professional qualification (CA/CFA/MBA)",
			});
		}

		const requirements = [...baseRequirements, ...conditionalRequirements];
		const completedCount = requirements.filter((r) => r.completed).length;
		const canUpgrade = completedCount === requirements.length;

		return {
			tier: "accredited_investor",
			requirements,
			canUpgrade,
			completionPercentage: Math.round(
				(completedCount / requirements.length) * 100,
			),
		};
	}

	throw new Error("Invalid target tier");
}

/**
 * Get all products accessible by user based on their KYC tier
 */
export async function getUserProductAccess(userId: string): Promise<{
	tier: string;
	unlockedProducts: string[];
	tierProducts: Record<string, string[]>;
}> {
	// Import dynamic KYC level calculator
	const { getUserKYCLevel } = await import("./middleware/kyc-level-gate");

	const { level, profile } = await getUserKYCLevel(userId);

	if (!profile) {
		throw new Error("User profile not found");
	}

	// Map dynamic KYC level to tier names
	// Level 0 = basic, Level 1 = basic (PAN only), Level 2 = enhanced (full KYC)
	let tier: string;
	let unlockedProducts: string[] = [];

	// Check for accredited investor status first
	const profileData = profile as any;
	const isAccredited = profileData.accreditedInvestorStatus === "verified";

	if (isAccredited) {
		tier = "accredited_investor";
		unlockedProducts = [
			...PRODUCT_ACCESS_MATRIX.basic,
			...PRODUCT_ACCESS_MATRIX.enhanced,
			...PRODUCT_ACCESS_MATRIX.accredited_investor,
		];
	} else if (level === "2") {
		tier = "enhanced";
		unlockedProducts = [
			...PRODUCT_ACCESS_MATRIX.basic,
			...PRODUCT_ACCESS_MATRIX.enhanced,
		];
	} else {
		// Level 0 or 1 = basic tier
		tier = "basic";
		unlockedProducts = [...PRODUCT_ACCESS_MATRIX.basic];
	}

	return {
		tier,
		unlockedProducts,
		tierProducts: PRODUCT_ACCESS_MATRIX,
	};
}

/**
 * Check if user has access to a specific product
 */
export async function hasProductAccess(
	userId: string,
	productCode: string,
): Promise<boolean> {
	const { unlockedProducts } = await getUserProductAccess(userId);
	return unlockedProducts.includes(productCode);
}

/**
 * Upgrade user to Enhanced KYC tier
 */
export async function upgradeToEnhancedKyc(userId: string): Promise<{
	success: boolean;
	message: string;
	newTier?: string;
}> {
	const requirements = await getTierUpgradeRequirements(userId, "enhanced");

	if (!requirements.canUpgrade) {
		return {
			success: false,
			message:
				"Enhanced KYC requirements not met. Please complete all required fields.",
		};
	}

	// Upgrade the tier
	await db
		.update(userProfiles)
		.set({
			kycTier: "enhanced",
			kycTierUpgradedAt: new Date(),
		} as any)
		.where(eq(userProfiles.userId, userId));

	// Update product access
	const { unlockedProducts } = await getUserProductAccess(userId);
	await db
		.update(userProfiles)
		.set({
			productsUnlocked: unlockedProducts,
			lastProductAccessUpdate: new Date(),
		} as any)
		.where(eq(userProfiles.userId, userId));

	return {
		success: true,
		message: "Successfully upgraded to Enhanced KYC tier",
		newTier: "enhanced",
	};
}

/**
 * Request Accredited Investor verification
 */
export async function requestAccreditedInvestorVerification(
	userId: string,
	verificationType:
		| "income_based"
		| "networth_based"
		| "portfolio_based"
		| "professional",
): Promise<{
	success: boolean;
	message: string;
}> {
	const profile = await db.query.userProfiles.findFirst({
		where: eq(userProfiles.userId, userId),
	});

	if (!profile) {
		return { success: false, message: "User profile not found" };
	}

	// Check if already verified or pending
	const profileData = profile as any;
	if (profileData.accreditedInvestorStatus === "verified") {
		return {
			success: false,
			message: "Already verified as Accredited Investor",
		};
	}

	if (profileData.accreditedInvestorStatus === "pending") {
		return { success: false, message: "Verification request already pending" };
	}

	// Validate qualification based on type
	let qualified = false;
	let rejectionReason = "";

	switch (verificationType) {
		case "income_based":
			qualified = !!(
				profileData.annualIncomeAmount &&
				Number(profileData.annualIncomeAmount) >=
					ACCREDITED_INVESTOR_CRITERIA.ANNUAL_INCOME_THRESHOLD
			);
			rejectionReason = qualified
				? ""
				: `Annual income must be ₹${ACCREDITED_INVESTOR_CRITERIA.ANNUAL_INCOME_THRESHOLD / 10000000} Crore or more`;
			break;

		case "networth_based":
			qualified = !!(
				profileData.netWorthExcludingResidence &&
				Number(profileData.netWorthExcludingResidence) >=
					ACCREDITED_INVESTOR_CRITERIA.NET_WORTH_THRESHOLD
			);
			rejectionReason = qualified
				? ""
				: `Net worth (excluding primary residence) must be ₹${ACCREDITED_INVESTOR_CRITERIA.NET_WORTH_THRESHOLD / 10000000} Crore or more`;
			break;

		case "portfolio_based":
			qualified = !!(
				profileData.portfolioValueAmount &&
				Number(profileData.portfolioValueAmount) >=
					ACCREDITED_INVESTOR_CRITERIA.PORTFOLIO_VALUE_THRESHOLD
			);
			rejectionReason = qualified
				? ""
				: `Securities portfolio value must be ₹${ACCREDITED_INVESTOR_CRITERIA.PORTFOLIO_VALUE_THRESHOLD / 10000000} Crore or more`;
			break;

		case "professional":
			qualified = !!(
				profileData.professionalQualification &&
				ACCREDITED_INVESTOR_CRITERIA.PROFESSIONAL_QUALIFICATIONS.includes(
					profileData.professionalQualification,
				) &&
				profileData.professionalQualificationVerified &&
				(profileData.professionalExperienceYears || 0) >=
					ACCREDITED_INVESTOR_CRITERIA.MIN_EXPERIENCE_YEARS
			);
			rejectionReason = qualified
				? ""
				: "Must have recognized professional qualification (CA/CFA/MBA Finance) with 3+ years experience";
			break;
	}

	if (!qualified) {
		return { success: false, message: rejectionReason };
	}

	// Submit for verification
	await db
		.update(userProfiles)
		.set({
			accreditedInvestorStatus: "pending",
			accreditedInvestorType: verificationType,
			kycTierUpgradeRequestedAt: new Date(),
		} as any)
		.where(eq(userProfiles.userId, userId));

	return {
		success: true,
		message:
			"Accredited Investor verification request submitted. Our compliance team will review within 2-3 business days.",
	};
}

/**
 * Verify Accredited Investor (Admin/Compliance Officer only)
 */
export async function verifyAccreditedInvestor(
	userId: string,
	verifiedBy: string,
	approved: boolean,
	rejectionReason?: string,
): Promise<{
	success: boolean;
	message: string;
}> {
	if (approved) {
		// Calculate expiry date (1 year from now)
		const expiryDate = new Date();
		expiryDate.setFullYear(expiryDate.getFullYear() + 1);

		await db
			.update(userProfiles)
			.set({
				kycTier: "accredited_investor",
				accreditedInvestorStatus: "verified",
				accreditedInvestorVerifiedAt: new Date(),
				accreditedInvestorVerifiedBy: verifiedBy,
				accreditedInvestorExpiryDate: expiryDate,
				kycTierUpgradedAt: new Date(),
			} as any)
			.where(eq(userProfiles.userId, userId));

		// Update product access
		const { unlockedProducts } = await getUserProductAccess(userId);
		await db
			.update(userProfiles)
			.set({
				productsUnlocked: unlockedProducts,
				lastProductAccessUpdate: new Date(),
			} as any)
			.where(eq(userProfiles.userId, userId));

		return {
			success: true,
			message:
				"Accredited Investor status verified successfully. User now has access to premium investment products.",
		};
	}
	await db
		.update(userProfiles)
		.set({
			accreditedInvestorStatus: "rejected",
			accreditedInvestorRejectionReason: rejectionReason,
		} as any)
		.where(eq(userProfiles.userId, userId));

	return {
		success: true,
		message: "Accredited Investor verification rejected.",
	};
}

/**
 * Get product recommendation based on user tier
 */
export function getProductUpgradePrompt(
	currentTier: string,
	productCode: string,
): {
	canAccess: boolean;
	requiredTier?: string;
	upgradeMessage?: string;
} {
	// Check which tier unlocks this product
	if (PRODUCT_ACCESS_MATRIX.basic.includes(productCode)) {
		return { canAccess: true };
	}

	if (PRODUCT_ACCESS_MATRIX.enhanced.includes(productCode)) {
		if (currentTier === "basic") {
			return {
				canAccess: false,
				requiredTier: "enhanced",
				upgradeMessage:
					"Complete Enhanced KYC to unlock this product. Includes Video KYC and income verification.",
			};
		}
		return { canAccess: true };
	}

	if (PRODUCT_ACCESS_MATRIX.accredited_investor.includes(productCode)) {
		if (currentTier === "basic") {
			return {
				canAccess: false,
				requiredTier: "accredited_investor",
				upgradeMessage:
					"This product requires Accredited Investor status. First complete Enhanced KYC, then apply for Accredited Investor verification.",
			};
		}
		if (currentTier === "enhanced") {
			return {
				canAccess: false,
				requiredTier: "accredited_investor",
				upgradeMessage:
					"Become an Accredited Investor to access this premium product. Requires ₹2Cr+ income OR ₹7.5Cr+ net worth OR ₹5Cr+ portfolio.",
			};
		}
		return { canAccess: true };
	}

	return { canAccess: false };
}
