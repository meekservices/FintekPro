/**
 * API Gateway Readiness
 *
 * Checks whether the backing API provider for each instrument type is configured
 * and ready to accept transactions. This is the single source of truth for
 * "Coming Soon" vs "Available" per instrument.
 *
 * Design principle:
 *  - Client never gets a raw "API key missing" error — they see a graceful "Coming Soon" banner.
 *  - Admin is notified in parallel via adminParallelNotifier so corrective action can be taken.
 *  - Results are cached at module load time (env keys don't change at runtime).
 */

import { logger } from "../logger";

export type InstrumentType =
	| "mutual_fund"
	| "sip"
	| "us_stock"
	| "indian_stock"
	| "bond"
	| "nps"
	| "fixed_deposit"
	| "ipo"
	| "gold"
	| "insurance"
	| "unlisted_equity"
	| "pms"
	| "aif"
	| "sgb"
	| "reit_invit";

export interface GatewayConfig {
	provider: string;
	displayName: string;
	/** Required env keys — all must be non-empty for the gateway to be considered ready */
	envKeys: string[];
	/**
	 * If true, the gateway is deliberately disabled regardless of env keys.
	 * Used for gateways still being onboarded (e.g. IIFL API keys pending).
	 */
	comingSoon?: boolean;
	/** Human-readable note shown in admin notifications */
	adminNote?: string;
	/** Message shown to the client when this gateway is not ready */
	clientMessage?: string;
}

const INSTRUMENT_GATEWAYS: Record<InstrumentType, GatewayConfig> = {
	mutual_fund: {
		provider: "iris_kfintech",
		displayName: "KFintech (Iris) — Mutual Funds",
		envKeys: ["IRIS_USERNAME", "IRIS_PASSWORD"],
		clientMessage:
			"Mutual fund orders are being set up. Please check back shortly.",
		adminNote:
			"Missing Iris/KFintech credentials. Add IRIS_USERNAME and IRIS_PASSWORD to Railway variables.",
	},
	sip: {
		provider: "iris_kfintech",
		displayName: "KFintech (Iris) — SIP",
		envKeys: ["IRIS_USERNAME", "IRIS_PASSWORD"],
		clientMessage:
			"SIP registration is being set up. Please check back shortly.",
		adminNote:
			"Missing Iris/KFintech credentials. Add IRIS_USERNAME and IRIS_PASSWORD.",
	},
	us_stock: {
		provider: "alpaca",
		displayName: "Alpaca Broker — US Stocks",
		envKeys: ["ALPACA_API_KEY", "ALPACA_SECRET_KEY", "ALPACA_BASE_URL"],
		clientMessage: "US stock trading is coming soon.",
		adminNote:
			"Missing Alpaca credentials. Add ALPACA_API_KEY, ALPACA_SECRET_KEY, ALPACA_BASE_URL.",
	},
	indian_stock: {
		provider: "iifl",
		displayName: "IIFL Securities — Indian Stocks",
		envKeys: ["IIFL_API_KEY", "IIFL_SECRET_KEY"],
		comingSoon: true, // ← API keys pending from IIFL
		clientMessage:
			"Indian stock trading is coming soon. We are finalising our partnership with IIFL Securities.",
		adminNote:
			"IIFL API keys are still being procured. Contact IIFL onboarding to expedite.",
	},
	bond: {
		provider: "bse_star",
		displayName: "BSE STAR MF — Bonds",
		envKeys: ["BSE_STAR_API_KEY", "BSE_STAR_MEMBER_ID"],
		clientMessage:
			"Bond purchases are being set up. Please check back shortly.",
		adminNote: "Missing BSE STAR credentials for bond orders.",
	},
	nps: {
		provider: "nps_trust",
		displayName: "NPS Trust — National Pension System",
		envKeys: ["NPS_API_KEY"],
		clientMessage: "NPS investment is coming soon.",
		adminNote: "Missing NPS_API_KEY. Configure with NPS Trust / Protean.",
	},
	fixed_deposit: {
		provider: "bse_star",
		displayName: "BSE STAR MF — Fixed Deposits",
		envKeys: ["BSE_STAR_API_KEY", "BSE_STAR_MEMBER_ID"],
		clientMessage: "Fixed deposit booking is being set up.",
		adminNote: "Missing BSE STAR credentials for FD orders.",
	},
	ipo: {
		provider: "bse_star",
		displayName: "BSE STAR MF — IPO Applications",
		envKeys: ["BSE_STAR_API_KEY", "BSE_STAR_MEMBER_ID"],
		clientMessage: "IPO applications are being set up.",
		adminNote: "Missing BSE STAR credentials for IPO applications.",
	},
	gold: {
		provider: "augmont",
		displayName: "Augmont — Digital Gold",
		envKeys: ["AUGMONT_API_KEY"],
		clientMessage: "Digital gold purchases are coming soon.",
		adminNote:
			"Missing AUGMONT_API_KEY. Contact Augmont to obtain credentials.",
	},
	insurance: {
		provider: "sandbox_insurance",
		displayName: "Sandbox.co.in — Insurance Marketplace",
		envKeys: ["SANDBOX_BASE_URL"],
		clientMessage: "Insurance purchases are being set up.",
		adminNote: "Missing SANDBOX_BASE_URL. Check Sandbox.co.in integration.",
	},
	unlisted_equity: {
		provider: "internal_otc",
		displayName: "Internal OTC — Unlisted Equity",
		envKeys: ["SANDBOX_BASE_URL"],
		clientMessage: "Unlisted equity orders are being set up.",
		adminNote: "Unlisted equity OTC flow requires Sandbox configuration.",
	},
	pms: {
		provider: "internal_pms",
		displayName: "Internal — Portfolio Management Services",
		envKeys: [], // Manual advisory, no gateway key required
		clientMessage: "PMS onboarding is managed by your advisor.",
		adminNote: "",
	},
	aif: {
		provider: "internal_aif",
		displayName: "Internal — Alternative Investment Funds",
		envKeys: [],
		clientMessage: "AIF subscriptions are managed by your advisor.",
		adminNote: "",
	},
	sgb: {
		provider: "rbi_sgb",
		displayName: "RBI — Sovereign Gold Bonds",
		envKeys: ["BSE_STAR_API_KEY"],
		clientMessage:
			"SGB subscription windows open periodically. No active window currently.",
		adminNote: "SGB orders route via BSE STAR. Ensure BSE_STAR_API_KEY is set.",
	},
	reit_invit: {
		provider: "bse_star",
		displayName: "BSE STAR MF — REIT / InvIT",
		envKeys: ["BSE_STAR_API_KEY"],
		clientMessage: "REIT/InvIT purchases are being set up.",
		adminNote: "Missing BSE STAR credentials for REIT/InvIT orders.",
	},
};

export interface GatewayReadiness {
	ready: boolean;
	comingSoon: boolean;
	provider: string;
	displayName: string;
	missingKeys: string[];
	clientMessage: string;
	adminNote: string;
}

// Module-level cache — computed once at startup
const _readinessCache = new Map<InstrumentType, GatewayReadiness>();

function computeReadiness(instrumentType: InstrumentType): GatewayReadiness {
	const config = INSTRUMENT_GATEWAYS[instrumentType];
	if (!config) {
		return {
			ready: false,
			comingSoon: true,
			provider: "unknown",
			displayName: "Unknown",
			missingKeys: [],
			clientMessage: "This service is coming soon.",
			adminNote: `No gateway configured for instrument type: ${instrumentType}`,
		};
	}

	if (config.comingSoon) {
		return {
			ready: false,
			comingSoon: true,
			provider: config.provider,
			displayName: config.displayName,
			missingKeys: config.envKeys, // Treat all keys as missing for coming-soon gateways
			clientMessage: config.clientMessage ?? "This service is coming soon.",
			adminNote: config.adminNote ?? "",
		};
	}

	// All required env keys must be non-empty
	let missingKeys = config.envKeys.filter(
		(k) => !process.env[k] || process.env[k]!.trim() === "",
	);

	// Special handling for iris_kfintech which supports both IRIS_ and KFINTECH_ prefixes
	if (config.provider === "iris_kfintech") {
		const hasIris = !!(process.env.IRIS_USERNAME && process.env.IRIS_PASSWORD);
		const hasKfin = !!(
			process.env.KFINTECH_USERNAME && process.env.KFINTECH_PASSWORD
		);
		if (hasIris || hasKfin) {
			missingKeys = [];
		}
	}

	return {
		ready: missingKeys.length === 0,
		comingSoon: false,
		provider: config.provider,
		displayName: config.displayName,
		missingKeys,
		clientMessage:
			missingKeys.length > 0
				? config.clientMessage ?? "This service is temporarily unavailable."
				: "",
		adminNote:
			missingKeys.length > 0
				? config.adminNote ?? `Missing credentials: ${missingKeys.join(", ")}`
				: "",
	};
}

/**
 * Check if the API gateway for an instrument type is ready to accept transactions.
 * Results are cached at module load time.
 */
export function checkGateway(instrumentType: InstrumentType): GatewayReadiness {
	if (_readinessCache.has(instrumentType)) {
		return _readinessCache.get(instrumentType)!;
	}
	const result = computeReadiness(instrumentType);
	_readinessCache.set(instrumentType, result);
	return result;
}

/**
 * Get a summary of all gateway statuses — used in admin dashboard.
 */
export function getAllGatewayStatuses(): Record<
	InstrumentType,
	GatewayReadiness
> {
	const result = {} as Record<InstrumentType, GatewayReadiness>;
	for (const key of Object.keys(INSTRUMENT_GATEWAYS) as InstrumentType[]) {
		result[key] = checkGateway(key);
	}
	return result;
}

/**
 * Log readiness summary at server boot.
 */
export function logGatewayReadinessSummary(): void {
	const all = getAllGatewayStatuses();
	const ready = Object.entries(all)
		.filter(([, v]) => v.ready)
		.map(([k]) => k);
	const comingSoon = Object.entries(all)
		.filter(([, v]) => v.comingSoon)
		.map(([k]) => k);
	const unavailable = Object.entries(all)
		.filter(([, v]) => !v.ready && !v.comingSoon)
		.map(([k]) => k);

	logger.info("[GatewayReadiness] Boot summary", {
		ready: ready.join(", ") || "none",
		comingSoon: comingSoon.join(", ") || "none",
		unavailable: unavailable.length > 0 ? unavailable.join(", ") : "none",
	});

	if (unavailable.length > 0) {
		logger.warn(
			"[GatewayReadiness] Some gateways are unavailable due to missing credentials",
			{
				instruments: unavailable,
			},
		);
	}
}

/** Invalidate cache — call this if env changes at runtime (e.g. via admin portal) */
export function invalidateGatewayCache(instrumentType?: InstrumentType): void {
	if (instrumentType) {
		_readinessCache.delete(instrumentType);
	} else {
		_readinessCache.clear();
	}
}
