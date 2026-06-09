/**
 * XBRL Parser Service for Indian Exchange Filings
 *
 * Parses XBRL/iXBRL documents from NSE/BSE to extract financial metrics.
 * Provides 0.95 confidence for XBRL data (highest priority source).
 *
 * Supported Indian XBRL Taxonomies:
 * - in-gaap (Indian GAAP)
 * - in-as (IndAS / Indian Accounting Standards)
 * - SEBI taxonomy extensions
 */

import { XMLParser } from "fast-xml-parser";
import * as crypto from "crypto";

export interface XBRLExtractedMetric {
	metric: string;
	canonicalName: string;
	value: number | null;
	valueText?: string;
	unit: string;
	period: string;
	periodEnd: string;
	context: string;
	xbrlTag: string;
	confidence: number;
	sourceCell?: string;
}

export interface XBRLParseResult {
	success: boolean;
	companyName?: string;
	cin?: string;
	isin?: string;
	financialYear?: string;
	period?: string;
	metrics: XBRLExtractedMetric[];
	rawContexts: Record<string, any>;
	extractionMethod: "XBRL";
	overallConfidence: number;
	errors: string[];
	parsingDurationMs: number;
}

const INDIAN_XBRL_NAMESPACES = [
	"in-gaap",
	"in-as",
	"in-bse",
	"in-nse",
	"http://www.infosys.com/",
	"http://www.tatamotors.com/",
];

const CANONICAL_METRIC_MAP: Record<
	string,
	{ canonical: string; priority: number }
> = {
	RevenueFromOperations: { canonical: "revenue", priority: 1 },
	TotalIncome: { canonical: "revenue", priority: 2 },
	Revenue: { canonical: "revenue", priority: 3 },
	TotalRevenue: { canonical: "revenue", priority: 2 },
	NetRevenue: { canonical: "revenue", priority: 4 },
	IncomeFromOperations: { canonical: "revenue", priority: 3 },

	ProfitBeforeExceptionalItemsAndTax: { canonical: "pbt", priority: 1 },
	ProfitBeforeTax: { canonical: "pbt", priority: 2 },

	ProfitLossForPeriod: { canonical: "pat", priority: 1 },
	ProfitAfterTax: { canonical: "pat", priority: 2 },
	NetProfit: { canonical: "pat", priority: 3 },
	NetProfitLossAfterTax: { canonical: "pat", priority: 2 },
	ProfitLossAttributableToOwnersOfParent: { canonical: "pat", priority: 1 },

	EBITDA: { canonical: "ebitda", priority: 1 },
	EarningsBeforeInterestTaxDepreciationAmortization: {
		canonical: "ebitda",
		priority: 2,
	},

	BasicEarningsPerShare: { canonical: "eps", priority: 1 },
	EarningsPerShareBasic: { canonical: "eps", priority: 2 },
	DilutedEarningsPerShare: { canonical: "eps_diluted", priority: 1 },
	EarningsPerShareDiluted: { canonical: "eps_diluted", priority: 2 },

	TotalAssets: { canonical: "total_assets", priority: 1 },
	Assets: { canonical: "total_assets", priority: 2 },

	TotalLiabilities: { canonical: "total_liabilities", priority: 1 },
	Liabilities: { canonical: "total_liabilities", priority: 2 },

	TotalEquity: { canonical: "net_worth", priority: 1 },
	Equity: { canonical: "net_worth", priority: 2 },
	ShareholdersEquity: { canonical: "net_worth", priority: 2 },
	EquityAttributableToOwnersOfParent: { canonical: "net_worth", priority: 1 },
	TotalShareholdersFunds: { canonical: "net_worth", priority: 3 },
	NetWorth: { canonical: "net_worth", priority: 1 },

	DebtEquityRatio: { canonical: "debt_equity_ratio", priority: 1 },
	CurrentRatio: { canonical: "current_ratio", priority: 1 },

	ShareCapital: { canonical: "share_capital", priority: 1 },
	PaidUpEquityShareCapital: { canonical: "share_capital", priority: 2 },

	ReservesAndSurplus: { canonical: "reserves", priority: 1 },
	Reserves: { canonical: "reserves", priority: 2 },
	OtherEquity: { canonical: "reserves", priority: 3 },

	DepreciationAndAmortisationExpense: {
		canonical: "depreciation",
		priority: 1,
	},
	DepreciationExpense: { canonical: "depreciation", priority: 2 },

	FinanceCosts: { canonical: "interest_expense", priority: 1 },
	InterestExpense: { canonical: "interest_expense", priority: 2 },

	IncomeTaxExpense: { canonical: "tax_expense", priority: 1 },
	TaxExpense: { canonical: "tax_expense", priority: 2 },
};

const INDIAN_LABEL_MAP: Record<string, string> = {
	"Total Income": "TotalIncome",
	"Revenue from Operations": "RevenueFromOperations",
	"Profit After Tax": "ProfitAfterTax",
	"Profit for the Period": "ProfitLossForPeriod",
	"Net Profit for the Period": "NetProfit",
	"Equity Shareholders Funds": "TotalShareholdersFunds",
	"Shareholders' Funds": "TotalShareholdersFunds",
	"Total Assets": "TotalAssets",
	"Total Liabilities": "TotalLiabilities",
	"Basic EPS": "BasicEarningsPerShare",
	"Diluted EPS": "DilutedEarningsPerShare",
	"Share Capital": "ShareCapital",
	"Reserves and Surplus": "ReservesAndSurplus",
	Depreciation: "DepreciationExpense",
	"Finance Costs": "FinanceCosts",
	"Tax Expense": "IncomeTaxExpense",
};

class XBRLParserService {
	private xmlParser: XMLParser;

	constructor() {
		this.xmlParser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			allowBooleanAttributes: true,
			parseTagValue: true,
			parseAttributeValue: true,
			trimValues: true,
			isArray: (name) => ["context", "unit"].includes(name.toLowerCase()),
		});

		console.log("✅ XBRL Parser Service initialized");
	}

	async parseXBRL(
		content: string,
		sourceUrl?: string,
	): Promise<XBRLParseResult> {
		const startTime = Date.now();
		const result: XBRLParseResult = {
			success: false,
			metrics: [],
			rawContexts: {},
			extractionMethod: "XBRL",
			overallConfidence: 0,
			errors: [],
			parsingDurationMs: 0,
		};

		try {
			const isIXBRL =
				content.includes("ix:") ||
				content.includes("<html") ||
				content.includes("<HTML");
			const xmlContent = isIXBRL ? this.extractXBRLFromIXBRL(content) : content;

			const parsed = this.xmlParser.parse(xmlContent);

			const xbrlRoot = this.findXBRLRoot(parsed);
			if (!xbrlRoot) {
				result.errors.push("No XBRL root element found");
				return result;
			}

			result.rawContexts = this.extractContexts(xbrlRoot);

			const companyInfo = this.extractCompanyInfo(xbrlRoot);
			result.companyName = companyInfo.name;
			result.cin = companyInfo.cin;
			result.isin = companyInfo.isin;
			result.financialYear = companyInfo.financialYear;
			result.period = companyInfo.period;

			result.metrics = this.extractMetrics(xbrlRoot, result.rawContexts);

			result.overallConfidence = this.calculateOverallConfidence(
				result.metrics,
			);
			result.success = result.metrics.length > 0;

			console.log(
				`[XBRL] Parsed ${result.metrics.length} metrics with ${(result.overallConfidence * 100).toFixed(1)}% confidence`,
			);
		} catch (error: any) {
			result.errors.push(`Parse error: ${error.message}`);
			console.error(`[XBRL] Parse error: ${error.message}`);
		}

		result.parsingDurationMs = Date.now() - startTime;
		return result;
	}

	private extractXBRLFromIXBRL(content: string): string {
		const extractedContent = content;

		const ixNonNumericPattern =
			/<ix:nonNumeric[^>]*name="([^"]+)"[^>]*>([^<]*)<\/ix:nonNumeric>/gi;
		const ixNumericPattern =
			/<ix:nonFraction[^>]*name="([^"]+)"[^>]*>([^<]*)<\/ix:nonFraction>/gi;

		let match;
		const elements: string[] = [];

		while ((match = ixNonNumericPattern.exec(content)) !== null) {
			elements.push(`<${match[1]}>${match[2]}</${match[1]}>`);
		}

		while ((match = ixNumericPattern.exec(content)) !== null) {
			const value = this.parseNumericValue(match[2]);
			elements.push(`<${match[1]}>${value}</${match[1]}>`);
		}

		if (elements.length > 0) {
			return `<xbrl>${elements.join("\n")}</xbrl>`;
		}

		return extractedContent;
	}

	private findXBRLRoot(parsed: any): any {
		const keys = Object.keys(parsed);

		for (const key of keys) {
			const lowerKey = key.toLowerCase();
			if (lowerKey.includes("xbrl") || lowerKey.includes("html")) {
				return parsed[key];
			}
		}

		return parsed[keys[0]];
	}

	private extractContexts(xbrlRoot: any): Record<string, any> {
		const contexts: Record<string, any> = {};

		const contextElements = xbrlRoot.context || xbrlRoot["xbrli:context"] || [];
		const contextArray = Array.isArray(contextElements)
			? contextElements
			: [contextElements];

		for (const ctx of contextArray) {
			if (!ctx) continue;

			const id = ctx["@_id"];
			if (!id) continue;

			const period = ctx.period || ctx["xbrli:period"] || {};
			const entity = ctx.entity || ctx["xbrli:entity"] || {};

			contexts[id] = {
				id,
				instant: period.instant || period["xbrli:instant"],
				startDate: period.startDate || period["xbrli:startDate"],
				endDate: period.endDate || period["xbrli:endDate"],
				entity: entity.identifier || entity["xbrli:identifier"],
			};
		}

		return contexts;
	}

	private extractCompanyInfo(xbrlRoot: any): {
		name?: string;
		cin?: string;
		isin?: string;
		financialYear?: string;
		period?: string;
	} {
		const info: any = {};

		const companyNameTags = [
			"NameOfCompany",
			"CompanyName",
			"in-gaap:NameOfCompany",
			"CorporateIdentificationNumber",
			"CIN",
		];

		for (const tag of companyNameTags) {
			if (xbrlRoot[tag]) {
				if (tag.includes("Name")) {
					info.name = this.extractTextValue(xbrlRoot[tag]);
				}
				if (tag.includes("CIN") || tag.includes("Corporate")) {
					info.cin = this.extractTextValue(xbrlRoot[tag]);
				}
			}
		}

		return info;
	}

	private extractMetrics(
		xbrlRoot: any,
		contexts: Record<string, any>,
	): XBRLExtractedMetric[] {
		const metrics: XBRLExtractedMetric[] = [];
		const processedCanonicals = new Map<string, XBRLExtractedMetric>();

		const flattenObject = (obj: any, prefix = ""): Record<string, any> => {
			const flat: Record<string, any> = {};

			for (const key of Object.keys(obj)) {
				if (key.startsWith("@_") || key === "context" || key === "unit")
					continue;

				const value = obj[key];
				const fullKey = prefix ? `${prefix}:${key}` : key;

				if (
					typeof value === "object" &&
					value !== null &&
					!Array.isArray(value)
				) {
					Object.assign(flat, flattenObject(value, fullKey));
				} else {
					flat[fullKey] = value;
				}
			}

			return flat;
		};

		const flatElements = flattenObject(xbrlRoot);

		for (const [tag, value] of Object.entries(flatElements)) {
			const cleanTag = tag.split(":").pop() || tag;

			const mapping = CANONICAL_METRIC_MAP[cleanTag];
			if (!mapping) continue;

			const numericValue = this.parseNumericValue(value);
			if (numericValue === null) continue;

			const metric: XBRLExtractedMetric = {
				metric: cleanTag,
				canonicalName: mapping.canonical,
				value: numericValue,
				valueText: String(value),
				unit: "INR",
				period: "",
				periodEnd: "",
				context: "",
				xbrlTag: tag,
				confidence: 0.95,
			};

			const existing = processedCanonicals.get(mapping.canonical);
			if (
				!existing ||
				mapping.priority <
					(CANONICAL_METRIC_MAP[existing.metric]?.priority || 99)
			) {
				processedCanonicals.set(mapping.canonical, metric);
			}
		}

		return Array.from(processedCanonicals.values());
	}

	private parseNumericValue(value: any): number | null {
		if (value === null || value === undefined) return null;

		const strValue = String(value).trim();
		if (!strValue || strValue === "-" || strValue.toLowerCase() === "nil")
			return null;

		const cleanValue = strValue
			.replace(/[,\s]/g, "")
			.replace(/\(([^)]+)\)/, "-$1")
			.replace(/[^\d.-]/g, "");

		const num = Number.parseFloat(cleanValue);
		return Number.isNaN(num) ? null : num;
	}

	private extractTextValue(value: any): string | undefined {
		if (typeof value === "string") return value;
		if (typeof value === "object" && value !== null) {
			return value["#text"] || value._ || String(value);
		}
		return undefined;
	}

	private calculateOverallConfidence(metrics: XBRLExtractedMetric[]): number {
		if (metrics.length === 0) return 0;

		const hasRevenue = metrics.some((m) => m.canonicalName === "revenue");
		const hasPAT = metrics.some((m) => m.canonicalName === "pat");
		const hasAssets = metrics.some((m) => m.canonicalName === "total_assets");

		let confidence = 0.85;

		if (hasRevenue) confidence += 0.03;
		if (hasPAT) confidence += 0.03;
		if (hasAssets) confidence += 0.02;

		if (metrics.length >= 5) confidence += 0.02;
		if (metrics.length >= 10) confidence += 0.05;

		return Math.min(confidence, 0.95);
	}

	getCanonicalName(indianLabel: string): string | null {
		const normalized = indianLabel.trim();

		const directMapping = INDIAN_LABEL_MAP[normalized];
		if (directMapping) {
			return CANONICAL_METRIC_MAP[directMapping]?.canonical || null;
		}

		for (const [xbrlTag, mapping] of Object.entries(CANONICAL_METRIC_MAP)) {
			const tagLower = xbrlTag.toLowerCase();
			const labelLower = normalized.toLowerCase();

			if (tagLower.includes(labelLower) || labelLower.includes(tagLower)) {
				return mapping.canonical;
			}
		}

		return null;
	}

	getSupportedMetrics(): string[] {
		const canonicals = new Set(
			Object.values(CANONICAL_METRIC_MAP).map((m) => m.canonical),
		);
		return Array.from(canonicals);
	}

	async parseFromUrl(url: string): Promise<XBRLParseResult> {
		const axios = (await import("axios")).default;

		const result: XBRLParseResult = {
			success: false,
			metrics: [],
			rawContexts: {},
			extractionMethod: "XBRL",
			overallConfidence: 0,
			errors: [],
			parsingDurationMs: 0,
		};

		try {
			const response = await axios.get(url, {
				timeout: 30000,
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					Accept: "application/xml, text/xml, application/xhtml+xml, */*",
				},
				maxContentLength: 50 * 1024 * 1024,
			});

			return this.parseXBRL(response.data, url);
		} catch (error: any) {
			result.errors.push(`Fetch error: ${error.message}`);
			return result;
		}
	}

	async extractAndPersistMetrics(
		filingId: string,
		companyId: string,
		parseResult: XBRLParseResult,
	): Promise<{ inserted: number; errors: string[] }> {
		const { db } = await import("../db");
		const { sql } = await import("drizzle-orm");

		const result = { inserted: 0, errors: [] as string[] };

		for (const metric of parseResult.metrics) {
			try {
				const hashData = `${companyId}|${metric.canonicalName}|${metric.value}|${parseResult.financialYear}`;
				const hashCurrent = crypto
					.createHash("sha256")
					.update(hashData)
					.digest("hex")
					.slice(0, 16);

				await db.execute(sql`
          INSERT INTO exchange_financial_audit_log (
            company_id, filing_id, exchange, metric, metric_value,
            metric_value_text, financial_year, period, currency,
            extraction_method, extraction_confidence, extracted_by,
            extraction_source, hash_current
          ) VALUES (
            ${companyId}, ${filingId}, 'NSE', ${metric.canonicalName},
            ${metric.value?.toString()}, ${metric.valueText}, 
            ${parseResult.financialYear || "FY2024-25"}, ${metric.period || "ANNUAL"},
            ${metric.unit || "INR"}, 'XBRL', ${metric.confidence.toString()},
            'AUTO', ${metric.xbrlTag}, ${hashCurrent}
          )
        `);

				result.inserted++;
			} catch (error: any) {
				result.errors.push(
					`Failed to insert ${metric.canonicalName}: ${error.message}`,
				);
			}
		}

		return result;
	}
}

export const xbrlParserService = new XBRLParserService();
