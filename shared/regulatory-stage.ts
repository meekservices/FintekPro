/**
 * Regulatory Stage Taxonomy and Demarcation (SEBI & MCA)
 *
 * Implements strict regulatory demarcations under Indian Financial Regulations:
 * 1. Unlisted Equity: Registered under Companies Act, 2013 (MCA). Traded via off-market / OTC private transfers.
 * 2. Pre-IPO: Governed by SEBI (ICDR) Regulations, 2018. DRHP filed, SEBI observation, or formal Pre-IPO funding.
 * 3. Live IPO: Governed by SEBI (ICDR) Regulations, 2018. RHP filed, public bidding window active via ASBA on NSE/BSE.
 * 4. Privately Listed: Governed by SEBI (REIT / InvIT / NCS) Regulations. Listed on NSE/BSE institutional segment only (Min ₹25L).
 * 5. Listed: Governed by SEBI (LODR) Regulations, 2015. Publicly traded on NSE/BSE secondary cash equity market.
 */

export type RegulatoryStage =
	| "unlisted"
	| "pre_ipo"
	| "ipo"
	| "privately_listed"
	| "listed";

export interface RegulatoryStageConfig {
	key: RegulatoryStage;
	label: string;
	badgeLabel: string;
	shortLabel: string;
	regulator: "MCA" | "SEBI";
	actOrRegulation: string;
	description: string;
	tradingPlatform: string;
	investorEligibility: string;
	stepIndex: number; // 0 = Unlisted, 1 = Pre-IPO, 2 = Live IPO, 3 = Listed (-1 for Privately Listed)
	badgeBg: string;
	badgeText: string;
	badgeBorder: string;
	dotColor: string;
}

export const REGULATORY_STAGES: Record<RegulatoryStage, RegulatoryStageConfig> = {
	unlisted: {
		key: "unlisted",
		label: "Unlisted Equity (MCA)",
		badgeLabel: "Unlisted Equity",
		shortLabel: "Unlisted",
		regulator: "MCA",
		actOrRegulation: "Companies Act, 2013 · OTC Transfer",
		description:
			"Unlisted public or private company registered with ROC/MCA. Secondary transfers occur through off-market / OTC demat transfers. No public DRHP filed with SEBI.",
		tradingPlatform: "Off-Market OTC / Demat Settlement",
		investorEligibility: "Retail / HNI / Private Secondary",
		stepIndex: 0,
		badgeBg: "bg-slate-100 dark:bg-slate-800",
		badgeText: "text-slate-800 dark:text-slate-200",
		badgeBorder: "border-slate-300 dark:border-slate-700",
		dotColor: "bg-slate-500",
	},
	pre_ipo: {
		key: "pre_ipo",
		label: "Pre-IPO (SEBI ICDR)",
		badgeLabel: "Pre-IPO",
		shortLabel: "Pre-IPO",
		regulator: "SEBI",
		actOrRegulation: "SEBI (ICDR) Regulations, 2018 · DRHP Stage",
		description:
			"Company has submitted Draft Red Herring Prospectus (DRHP) to SEBI, received regulatory observation/approval, or is raising formal Pre-IPO funding ahead of listing.",
		tradingPlatform: "Private Placement / Pre-IPO Secondary",
		investorEligibility: "Accredited / HNI / Private Placement",
		stepIndex: 1,
		badgeBg: "bg-purple-100 dark:bg-purple-950/60",
		badgeText: "text-purple-800 dark:text-purple-200",
		badgeBorder: "border-purple-300 dark:border-purple-800",
		dotColor: "bg-purple-500",
	},
	ipo: {
		key: "ipo",
		label: "Live IPO (Public Issue)",
		badgeLabel: "Live IPO",
		shortLabel: "IPO",
		regulator: "SEBI",
		actOrRegulation: "SEBI (ICDR) Regulations, 2018 · ASBA Issue",
		description:
			"Red Herring Prospectus (RHP) registered with ROC. Public subscription bidding window is open via ASBA on NSE / BSE bidding platforms.",
		tradingPlatform: "NSE / BSE ASBA Primary Window",
		investorEligibility: "Retail (UPI) / HNI / Institutional QIB",
		stepIndex: 2,
		badgeBg: "bg-emerald-100 dark:bg-emerald-950/60",
		badgeText: "text-emerald-800 dark:text-emerald-200",
		badgeBorder: "border-emerald-300 dark:border-emerald-800",
		dotColor: "bg-emerald-500",
	},
	privately_listed: {
		key: "privately_listed",
		label: "Privately Listed (Institutional)",
		badgeLabel: "Privately Listed",
		shortLabel: "Priv. Listed",
		regulator: "SEBI",
		actOrRegulation: "SEBI (REIT / InvIT / NCS) Regulations",
		description:
			"Privately placed and listed on NSE/BSE institutional segment. Traded strictly among institutional / eligible investors (typical min lot ₹25 Lakhs). Not open to public retail secondary equity trading.",
		tradingPlatform: "NSE / BSE Institutional Placement Segment",
		investorEligibility: "Institutional / QIB / HNI (Min ₹25 Lakhs)",
		stepIndex: -1,
		badgeBg: "bg-indigo-100 dark:bg-indigo-950/60",
		badgeText: "text-indigo-800 dark:text-indigo-200",
		badgeBorder: "border-indigo-300 dark:border-indigo-800",
		dotColor: "bg-indigo-500",
	},
	listed: {
		key: "listed",
		label: "NSE / BSE Listed (SEBI LODR)",
		badgeLabel: "NSE / BSE Listed",
		shortLabel: "Listed",
		regulator: "SEBI",
		actOrRegulation: "SEBI (LODR) Regulations, 2015",
		description:
			"Publicly traded on the secondary cash equity market of NSE and BSE with continuous real-time order matching and public liquidity.",
		tradingPlatform: "NSE / BSE Secondary Cash Market",
		investorEligibility: "All Public Retail & Institutional Investors",
		stepIndex: 3,
		badgeBg: "bg-blue-100 dark:bg-blue-950/60",
		badgeText: "text-blue-800 dark:text-blue-200",
		badgeBorder: "border-blue-300 dark:border-blue-800",
		dotColor: "bg-blue-500",
	},
};

/**
 * Visual lifecycle continuum steps for an asset moving from Unlisted to Listed.
 */
export const REGULATORY_LIFECYCLE_STEPS = [
	{ key: "unlisted", label: "Unlisted", subtext: "MCA · OTC", regulator: "MCA" },
	{ key: "pre_ipo", label: "Pre-IPO", subtext: "SEBI · DRHP", regulator: "SEBI" },
	{ key: "ipo", label: "Live IPO", subtext: "SEBI · ASBA", regulator: "SEBI" },
	{ key: "listed", label: "Listed", subtext: "NSE / BSE", regulator: "SEBI" },
] as const;

const KNOWN_PRIVATELY_LISTED_NAMES = [
	"bagmane",
	"cube highways",
	"anzen india",
	"interise",
	"irb infrastructure trust",
	"oriental infratrust",
	"shrem invit",
	"citius",
	"ampin",
	"anantam",
	"capital infra",
	"indus infra",
	"intelligent supply chain",
	"maple infrastructure",
	"ndr invit",
	"nxt-infra",
	"office realty",
	"360 one real estate",
	"energy infrastructure",
];

const KNOWN_CONFIRMED_LISTED_NAMES = [
	"swiggy",
	"lenskart",
	"zomato",
	"paytm",
	"nykaa",
	"delhivery",
	"mamaearth",
	"honasa",
	"ola electric",
	"firstcry",
	"brainbees",
	"ixigo",
	"traxcn",
	"urban company",
	"mobikwik",
];

/**
 * Normalizes any raw stage string or pick/company attributes into an authoritative RegulatoryStage.
 */
export function normalizeRegulatoryStage(
	stage?: string | null,
	category?: string | null,
	name?: string | null,
): RegulatoryStage {
	const rawName = (name || "").toLowerCase().trim();
	const rawStage = (stage || "").toLowerCase().trim();
	const rawCat = (category || "").toLowerCase().trim();

	// 1. Check known privately listed trusts
	if (KNOWN_PRIVATELY_LISTED_NAMES.some((k) => rawName.includes(k))) {
		return "privately_listed";
	}

	// 2. Check known listed companies
	if (KNOWN_CONFIRMED_LISTED_NAMES.some((k) => rawName.includes(k))) {
		return "listed";
	}

	// 3. Stage string checks
	if (rawStage === "privately_listed" || rawStage === "private_placement" || rawStage === "privately_placed") {
		return "privately_listed";
	}
	if (
		rawStage === "pre_ipo" ||
		rawStage === "drhp_filed" ||
		rawStage === "sebi_approved" ||
		rawCat === "pre_ipo"
	) {
		return "pre_ipo";
	}
	if (
		rawStage === "ipo" ||
		rawStage === "ipo_open" ||
		rawStage === "ipo_announced" ||
		rawStage === "live_ipo" ||
		rawCat === "ipo"
	) {
		return "ipo";
	}
	if (rawStage === "listed" || rawCat === "listed_stocks") {
		return "listed";
	}

	// 4. Default for unlisted assets, growth, mature, etc.
	return "unlisted";
}

/**
 * Returns complete regulatory stage metadata given a stage or company attributes.
 */
export function getRegulatoryStageConfig(
	stage?: string | null,
	category?: string | null,
	name?: string | null,
): RegulatoryStageConfig {
	const normalized = normalizeRegulatoryStage(stage, category, name);
	return REGULATORY_STAGES[normalized];
}
