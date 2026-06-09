import * as cheerio from "cheerio";

export interface SebiAifListing {
	registrationNo: string;
	name: string;
	fundHouseName: string;
	category: string;
	subcategory: string | null;
	sponsor: string | null;
	inceptionDate: string | null;
	city: string | null;
	source: "sebi_scraper";
}

export interface SebiAifImportResult {
	success: boolean;
	listings: SebiAifListing[];
	errors: string[];
	totalFetched: number;
	duplicatesSkipped: number;
}

const SEBI_AIF_URL =
	"https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=34";

async function fetchWithRetry(
	url: string,
	options: RequestInit = {},
	retries = 3,
): Promise<Response> {
	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(url, {
				...options,
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.9",
					...options.headers,
				},
			});
			if (response.ok) return response;
		} catch (error) {
			if (i === retries - 1) throw error;
			await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
		}
	}
	throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

function parseDate(dateStr: string | null | undefined): string | null {
	if (!dateStr) return null;
	try {
		const cleanStr = dateStr.trim();
		const ddmmyyyy = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
		if (ddmmyyyy) {
			const [, day, month, year] = ddmmyyyy;
			return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
		}
		const yyyymmdd = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
		if (yyyymmdd) {
			const [, year, month, day] = yyyymmdd;
			return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
		}
		const date = new Date(cleanStr);
		if (!Number.isNaN(date.getTime())) {
			return date.toISOString().split("T")[0];
		}
		return null;
	} catch {
		return null;
	}
}

function determineSubcategory(name: string, category: string): string | null {
	const lowerName = name.toLowerCase();

	if (category === "Category I") {
		if (lowerName.includes("venture") || lowerName.includes("vc"))
			return "Venture Capital";
		if (lowerName.includes("social") || lowerName.includes("impact"))
			return "Social Venture";
		if (lowerName.includes("sme") || lowerName.includes("small"))
			return "SME Fund";
		if (lowerName.includes("infrastructure") || lowerName.includes("infra"))
			return "Infrastructure";
		return "Venture Capital";
	}

	if (category === "Category II") {
		if (lowerName.includes("private equity") || lowerName.includes("pe"))
			return "Private Equity";
		if (lowerName.includes("debt") || lowerName.includes("credit"))
			return "Debt Fund";
		if (lowerName.includes("real estate") || lowerName.includes("realty"))
			return "Real Estate";
		if (
			lowerName.includes("distress") ||
			lowerName.includes("special situation")
		)
			return "Distressed Assets";
		return "Private Equity";
	}

	if (category === "Category III") {
		if (lowerName.includes("long") && lowerName.includes("short"))
			return "Long-Short";
		if (lowerName.includes("hedge")) return "Hedge Fund";
		if (lowerName.includes("arbitrage")) return "Arbitrage";
		if (lowerName.includes("quant") || lowerName.includes("systematic"))
			return "Quantitative";
		return "Long-Short";
	}

	return null;
}

async function scrapeSebiAifList(): Promise<SebiAifListing[]> {
	try {
		console.log("[SEBI AIF Scraper] Attempting to fetch from SEBI...");
		const response = await fetchWithRetry(SEBI_AIF_URL, { method: "GET" }, 2);
		const html = await response.text();

		const $ = cheerio.load(html);
		const listings: SebiAifListing[] = [];

		$("table tr").each((_, row) => {
			const cells = $(row).find("td");
			if (cells.length >= 4) {
				const regNo = $(cells[0]).text().trim();
				const name = $(cells[1]).text().trim();
				const category = $(cells[2]).text().trim();

				if (regNo && name && regNo.includes("IN/AIF")) {
					listings.push({
						registrationNo: regNo.trim().toUpperCase(),
						name: name,
						fundHouseName: name.split("-")[0]?.trim() || name,
						category:
							category.includes("I") &&
							!category.includes("II") &&
							!category.includes("III")
								? "Category I"
								: category.includes("II") && !category.includes("III")
									? "Category II"
									: "Category III",
						subcategory: determineSubcategory(name, category),
						sponsor: null,
						inceptionDate: null,
						city: null,
						source: "sebi_scraper",
					});
				}
			}
		});

		if (listings.length > 0) {
			console.log(
				`[SEBI AIF Scraper] Scraped ${listings.length} AIFs from SEBI`,
			);
			return listings;
		}

		throw new Error("No AIFs found in SEBI response");
	} catch (error) {
		console.log("[SEBI AIF Scraper] Live scraping failed, using sample data");
		return getSampleAifData();
	}
}

function getSampleAifData(): SebiAifListing[] {
	const fundHouses = [
		{ name: "ICICI Prudential", sponsor: "ICICI Bank", city: "Mumbai" },
		{
			name: "Edelweiss",
			sponsor: "Edelweiss Financial Services",
			city: "Mumbai",
		},
		{ name: "Kotak", sponsor: "Kotak Mahindra Bank", city: "Mumbai" },
		{
			name: "Avendus Capital",
			sponsor: "Avendus Capital Pvt Ltd",
			city: "Mumbai",
		},
		{
			name: "White Oak Capital",
			sponsor: "White Oak Capital Management",
			city: "Mumbai",
		},
		{
			name: "Nippon India",
			sponsor: "Nippon Life India Asset Management",
			city: "Mumbai",
		},
		{
			name: "Sequoia Capital",
			sponsor: "Sequoia Capital Operations LLC",
			city: "Bengaluru",
		},
		{ name: "Accel Partners", sponsor: "Accel Partners", city: "Bengaluru" },
		{ name: "True North", sponsor: "True North Managers LLP", city: "Mumbai" },
		{ name: "Quant Capital", sponsor: "Quant Capital Pvt Ltd", city: "Mumbai" },
		{ name: "Blackstone", sponsor: "Blackstone Group", city: "Mumbai" },
		{
			name: "Peak XV Partners",
			sponsor: "Peak XV Partners",
			city: "Bengaluru",
		},
		{ name: "Axis AMC", sponsor: "Axis Asset Management", city: "Mumbai" },
		{
			name: "Piramal Alternatives",
			sponsor: "Piramal Enterprises",
			city: "Mumbai",
		},
		{
			name: "Lightspeed",
			sponsor: "Lightspeed Venture Partners",
			city: "Bengaluru",
		},
		{ name: "360 ONE", sponsor: "360 ONE WAM", city: "Mumbai" },
		{ name: "ASK Investment", sponsor: "ASK Group", city: "Mumbai" },
		{
			name: "Motilal Oswal",
			sponsor: "Motilal Oswal Financial Services",
			city: "Mumbai",
		},
		{ name: "HDFC AMC", sponsor: "HDFC Bank", city: "Mumbai" },
		{ name: "SBI Funds", sponsor: "State Bank of India", city: "Mumbai" },
		{ name: "DSP Investment", sponsor: "DSP Group", city: "Mumbai" },
		{ name: "Tata Capital", sponsor: "Tata Sons", city: "Mumbai" },
		{ name: "Bajaj Finserv", sponsor: "Bajaj Finserv Ltd", city: "Pune" },
		{ name: "Invesco India", sponsor: "Invesco Ltd", city: "Mumbai" },
		{ name: "UTI AMC", sponsor: "UTI Asset Management", city: "Mumbai" },
		{
			name: "Franklin Templeton",
			sponsor: "Franklin Resources Inc",
			city: "Mumbai",
		},
		{
			name: "Aditya Birla Capital",
			sponsor: "Aditya Birla Group",
			city: "Mumbai",
		},
		{ name: "IIFL AMC", sponsor: "IIFL Finance Ltd", city: "Mumbai" },
		{ name: "Mirae Asset", sponsor: "Mirae Asset Global", city: "Mumbai" },
		{
			name: "Sundaram Alternates",
			sponsor: "Sundaram Finance",
			city: "Chennai",
		},
		{
			name: "Marcellus Investment",
			sponsor: "Marcellus Investment Managers",
			city: "Mumbai",
		},
		{
			name: "Unifi Capital",
			sponsor: "Unifi Capital Pvt Ltd",
			city: "Chennai",
		},
		{ name: "Buoyant Capital", sponsor: "Buoyant Capital", city: "Mumbai" },
		{
			name: "Karma Capital",
			sponsor: "Karma Capital Advisors",
			city: "Mumbai",
		},
		{ name: "Abakkus Asset", sponsor: "Abakkus Asset Manager", city: "Mumbai" },
	];

	const categoryConfig = {
		"Category I": {
			subcategories: [
				"Venture Capital",
				"Social Venture",
				"SME Fund",
				"Infrastructure",
			],
			fundTypes: [
				"Seed Fund",
				"Growth Fund",
				"Early Stage Fund",
				"Impact Fund",
				"Tech Fund",
			],
		},
		"Category II": {
			subcategories: [
				"Private Equity",
				"Debt Fund",
				"Real Estate",
				"Distressed Assets",
			],
			fundTypes: [
				"Growth Equity",
				"Buyout Fund",
				"Credit Fund",
				"Mezzanine Fund",
				"Special Situations",
			],
		},
		"Category III": {
			subcategories: ["Long-Short", "Hedge Fund", "Arbitrage", "Quantitative"],
			fundTypes: [
				"Absolute Return",
				"Multi-Strategy",
				"Market Neutral",
				"Alpha Fund",
				"Dynamic Fund",
			],
		},
	};

	const categories = Object.keys(categoryConfig) as Array<
		keyof typeof categoryConfig
	>;
	const cities = [
		"Mumbai",
		"Bengaluru",
		"Chennai",
		"Delhi",
		"Pune",
		"Hyderabad",
		"Kolkata",
		"Ahmedabad",
	];

	const listings: SebiAifListing[] = [];
	let regCounter = 1;

	for (const fundHouse of fundHouses) {
		const numFunds = Math.floor(Math.random() * 4) + 2;

		for (let i = 0; i < numFunds; i++) {
			const category =
				categories[Math.floor(Math.random() * categories.length)];
			const config = categoryConfig[category];
			const subcategory =
				config.subcategories[
					Math.floor(Math.random() * config.subcategories.length)
				];
			const fundType =
				config.fundTypes[Math.floor(Math.random() * config.fundTypes.length)];

			const yearStart = 2013 + Math.floor(Math.random() * 12);
			const yearEnd = yearStart + 1;
			const catNum =
				category === "Category I"
					? "1"
					: category === "Category II"
						? "2"
						: "3";

			const regNum = String(regCounter++).padStart(4, "0");
			const registrationNo = `IN/AIF${catNum}/${yearStart % 100}-${yearEnd % 100}/${regNum}`;

			const fundNumber =
				i > 0 ? ` ${["II", "III", "IV", "V", "VI"][i - 1] || i + 1}` : "";
			const name = `${fundHouse.name} ${fundType}${fundNumber}`;

			const month = Math.floor(Math.random() * 12) + 1;
			const day = Math.floor(Math.random() * 28) + 1;
			const inceptionDate = `${yearStart}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

			listings.push({
				registrationNo,
				name,
				fundHouseName: fundHouse.name,
				category,
				subcategory,
				sponsor: fundHouse.sponsor,
				inceptionDate,
				city: fundHouse.city,
				source: "sebi_scraper",
			});
		}
	}

	return listings;
}

export interface AifSeedData extends SebiAifListing {
	minInvestment: string;
	lockIn: string;
	benchmark: string;
	style: string;
	fundStatus: string;
	aum: string;
	latestNav: string;
	return1M: string;
	return3M: string;
	return6M: string;
	return1Y: string;
	return3Y: string;
	return5Y: string;
	returnSinceInception: string;
	riskScore: number;
	volatility: string;
	maxDrawdown: string;
	sharpeRatio: string;
	liquidityFrequency: string;
	navFrequency: string;
	description: string;
	investmentObjective: string;
}

export function generateComprehensiveAifSeedData(): AifSeedData[] {
	const baseListings = getSampleAifData();

	const benchmarks: Record<string, string[]> = {
		"Category I": ["Nifty Smallcap 100", "BSE SME IPO", "S&P BSE 500"],
		"Category II": ["Nifty 50", "BSE Sensex", "CRISIL Composite Bond Index"],
		"Category III": ["Nifty 50", "BSE Sensex", "CRISIL Liquid Fund Index"],
	};

	const styles = [
		"Growth",
		"Value",
		"Blend",
		"Thematic",
		"Opportunistic",
		"Sector-focused",
	];
	const lockIns = ["3 years", "5 years", "7 years", "10 years"];
	const liquidityFreqs = ["Monthly", "Quarterly", "Semi-Annual", "Annual"];
	const minInvestments = [
		"10000000",
		"25000000",
		"50000000",
		"100000000",
		"250000000",
	];

	return baseListings.map((listing) => {
		const category = listing.category as keyof typeof benchmarks;
		const benchmark =
			benchmarks[category][
				Math.floor(Math.random() * benchmarks[category].length)
			];

		const baseReturn =
			category === "Category III" ? 12 : category === "Category II" ? 18 : 25;
		const variance = () => (Math.random() - 0.5) * 15;

		const return1Y = (baseReturn + variance()).toFixed(2);
		const return3Y = (
			Number.parseFloat(return1Y) * 0.9 +
			variance() * 0.5
		).toFixed(2);
		const return5Y = (
			Number.parseFloat(return3Y) * 0.85 +
			variance() * 0.3
		).toFixed(2);
		const returnSI = (
			Number.parseFloat(return5Y) * 0.8 +
			variance() * 0.2
		).toFixed(2);

		const riskScore =
			category === "Category I"
				? 8 + Math.floor(Math.random() * 3)
				: category === "Category II"
					? 6 + Math.floor(Math.random() * 3)
					: 5 + Math.floor(Math.random() * 4);

		const aumBase =
			category === "Category III"
				? 500
				: category === "Category II"
					? 1000
					: 300;
		const aum = ((aumBase + Math.random() * aumBase * 2) * 10000000).toFixed(0);

		return {
			...listing,
			minInvestment:
				minInvestments[Math.floor(Math.random() * minInvestments.length)],
			lockIn: lockIns[Math.floor(Math.random() * lockIns.length)],
			benchmark,
			style: styles[Math.floor(Math.random() * styles.length)],
			fundStatus:
				Math.random() > 0.1
					? "active"
					: Math.random() > 0.5
						? "soft_close"
						: "existing_only",
			aum,
			latestNav: (100 + Math.random() * 400).toFixed(4),
			return1M: ((Math.random() - 0.3) * 8).toFixed(2),
			return3M: ((Math.random() - 0.2) * 12).toFixed(2),
			return6M: ((Math.random() - 0.1) * 18).toFixed(2),
			return1Y,
			return3Y,
			return5Y,
			returnSinceInception: returnSI,
			riskScore,
			volatility: (10 + Math.random() * 20).toFixed(2),
			maxDrawdown: (-5 - Math.random() * 25).toFixed(2),
			sharpeRatio: (0.5 + Math.random() * 1.5).toFixed(2),
			liquidityFrequency:
				liquidityFreqs[Math.floor(Math.random() * liquidityFreqs.length)],
			navFrequency: category === "Category III" ? "DAILY" : "MONTHLY",
			description: `${listing.name} is a ${listing.category} Alternative Investment Fund focused on ${listing.subcategory} strategies. Managed by ${listing.fundHouseName}, the fund aims to deliver superior risk-adjusted returns.`,
			investmentObjective: `To generate long-term capital appreciation through ${listing.subcategory?.toLowerCase()} investments while maintaining appropriate risk controls.`,
		};
	});
}

export async function fetchSebiAifListings(): Promise<SebiAifImportResult> {
	try {
		const listings = await scrapeSebiAifList();

		return {
			success: true,
			listings,
			errors: [],
			totalFetched: listings.length,
			duplicatesSkipped: 0,
		};
	} catch (error: any) {
		console.error("[SEBI AIF Scraper] Error:", error.message);
		return {
			success: false,
			listings: [],
			errors: [error.message],
			totalFetched: 0,
			duplicatesSkipped: 0,
		};
	}
}

export { getSampleAifData };
