import { db } from "../db";
import { mutualFunds } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

interface NamingValidationResult {
	status: "PASSED" | "FAILED";
	reason?: string;
}

interface BulkValidationSummary {
	total: number;
	passed: number;
	failed: number;
	failures: Array<{ schemeCode: string; schemeName: string; reason: string }>;
}

// ── Block list: scheme names must NOT contain these phrases ─────────────────
const BLOCKED_PHRASES = [
	"guaranteed",
	"assured",
	"assured return",
	"fixed return",
	"capital protection",
	"capital guaranteed",
	"capital guarantee",
	"assured income",
	"guaranteed income",
	"guaranteed return",
];

// ── Category keyword map: name MUST contain at least one keyword ─────────────
// Keys match against fund.category (case-insensitive)
const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
	equity: [
		"equity",
		"elss",
		"nifty",
		"sensex",
		"bse",
		"nse",
		"growth",
		"bluechip",
		"multicap",
		"midcap",
		"smallcap",
		"largecap",
		"flexi",
		"focussed",
		"focused",
		"contra",
		"value",
		"dividend",
		"thematic",
		"sectoral",
		"esg",
		"momentum",
		"alpha",
	],
	debt: [
		"debt",
		"bond",
		"duration",
		"credit",
		"gilt",
		"liquid",
		"overnight",
		"money market",
		"floater",
		"banking",
		"psu",
		"income",
		"fixed income",
		"treasury",
		"corporate",
	],
	hybrid: [
		"hybrid",
		"balanced",
		"arbitrage",
		"equity savings",
		"multi asset",
		"dynamic asset",
		"blended",
		"asset allocation",
	],
	lifecycle: [], // Special rule: requires maturity year in name (handled separately)
	"solution oriented": [], // Retirement/children — no keyword requirement
	other: [], // Index, ETF, FoF — no keyword requirement (they have their own clear naming norms)
};

// Categories exempt from keyword requirement (SEBI doesn't mandate keyword in name)
const KEYWORD_EXEMPT_CATEGORIES = ["solution oriented", "other", "lifecycle"];

// Thematic/sectoral schemes exempt from general equity keyword check
// because their names reflect the theme, not the word "equity"
const THEMATIC_SUBCATEGORIES = [
	"sectoral/thematic",
	"sectoral",
	"thematic",
	"eq_sectoral_thematic",
];

class MfNamingComplianceService {
	private static instance: MfNamingComplianceService;

	static getInstance(): MfNamingComplianceService {
		if (!MfNamingComplianceService.instance) {
			MfNamingComplianceService.instance = new MfNamingComplianceService();
		}
		return MfNamingComplianceService.instance;
	}

	validateSchemeName(
		schemeCode: string,
		schemeName: string,
		category: string | null,
		lifecycleMetadata?: any,
	): NamingValidationResult {
		const nameLower = schemeName.toLowerCase();

		// Rule 1: Block list check
		for (const phrase of BLOCKED_PHRASES) {
			if (nameLower.includes(phrase)) {
				return {
					status: "FAILED",
					reason: `Scheme name contains misleading/prohibited term: "${phrase}". SEBI prohibits names implying guaranteed/assured returns (SEBI 2026 True-to-Label norms).`,
				};
			}
		}

		// Rule 2: Lifecycle maturity year requirement
		if (lifecycleMetadata && typeof lifecycleMetadata === "object") {
			const maturityYear = lifecycleMetadata.maturityYear;
			if (maturityYear && !nameLower.includes(String(maturityYear))) {
				return {
					status: "FAILED",
					reason: `Life Cycle Fund must include maturity year (${maturityYear}) in scheme name. Current name: "${schemeName}".`,
				};
			}
		}

		// Rule 3: Category keyword requirement
		const catLower = (category || "").toLowerCase();

		// Check if exempt
		const isExempt = KEYWORD_EXEMPT_CATEGORIES.some((exemptCat) =>
			catLower.includes(exemptCat),
		);

		// Check if thematic/sectoral (exempt from equity keyword)
		const isThematic = THEMATIC_SUBCATEGORIES.some((sub) =>
			catLower.includes(sub),
		);

		if (!isExempt && !isThematic) {
			const matchedGroup = Object.entries(CATEGORY_KEYWORD_MAP).find(([key]) =>
				catLower.includes(key),
			);
			if (matchedGroup) {
				const [groupName, keywords] = matchedGroup;
				if (keywords.length > 0) {
					const hasKeyword = keywords.some((kw) => nameLower.includes(kw));
					if (!hasKeyword) {
						return {
							status: "FAILED",
							reason: `${groupName.charAt(0).toUpperCase() + groupName.slice(1)} scheme name must reflect its category. Expected one of: ${keywords.slice(0, 6).join(", ")}. Current name: "${schemeName}".`,
						};
					}
				}
			}
		}

		return { status: "PASSED" };
	}

	async validateAndPersist(
		schemeCode: string,
		schemeName: string,
		category: string | null,
		lifecycleMetadata?: any,
	): Promise<NamingValidationResult> {
		const result = this.validateSchemeName(
			schemeCode,
			schemeName,
			category,
			lifecycleMetadata,
		);

		try {
			if (result.status === "FAILED") {
				await db.execute(sql`
          UPDATE mutual_funds
          SET naming_validation_status = 'FAILED',
              compliance_status = 'BLOCKED',
              compliance_blocked_reason = ${result.reason || "Naming validation failed"}
          WHERE scheme_code = ${schemeCode}
        `);
			} else {
				await db.execute(sql`
          UPDATE mutual_funds
          SET naming_validation_status = 'PASSED'
          WHERE scheme_code = ${schemeCode}
            AND naming_validation_status != 'PASSED'
        `);
			}
		} catch (e: any) {
			console.error(
				`[NamingCompliance] DB update error for ${schemeCode}:`,
				e.message,
			);
		}

		return result;
	}

	async runNamingValidationForAll(
		batchSize = 500,
	): Promise<BulkValidationSummary> {
		console.log("[NamingCompliance] Starting bulk naming validation...");

		let offset = 0;
		let total = 0,
			passed = 0,
			failed = 0;
		const failures: Array<{
			schemeCode: string;
			schemeName: string;
			reason: string;
		}> = [];

		while (true) {
			const batch = await db
				.select({
					schemeCode: mutualFunds.schemeCode,
					schemeName: mutualFunds.schemeName,
					category: mutualFunds.category,
					lifecycleMetadata: mutualFunds.lifecycleMetadata,
				})
				.from(mutualFunds)
				.where(eq(mutualFunds.isPublished, true))
				.limit(batchSize)
				.offset(offset);

			if (batch.length === 0) break;
			total += batch.length;

			for (const fund of batch) {
				const result = await this.validateAndPersist(
					fund.schemeCode,
					fund.schemeName || "",
					fund.category,
					fund.lifecycleMetadata,
				);

				if (result.status === "PASSED") {
					passed++;
				} else {
					failed++;
					if (failures.length < 200) {
						failures.push({
							schemeCode: fund.schemeCode,
							schemeName: fund.schemeName || "",
							reason: result.reason || "",
						});
					}
				}
			}

			offset += batchSize;
			console.log(
				`[NamingCompliance] Progress: ${total} processed (${passed} passed, ${failed} failed)`,
			);
		}

		console.log(
			`[NamingCompliance] Complete: ${total} total, ${passed} passed, ${failed} failed`,
		);
		return { total, passed, failed, failures };
	}
}

export const mfNamingComplianceService =
	MfNamingComplianceService.getInstance();
export default mfNamingComplianceService;
