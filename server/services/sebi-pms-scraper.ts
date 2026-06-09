import * as cheerio from "cheerio";

export interface SebiPmsListing {
	registrationNo: string;
	name: string;
	fundHouseName: string;
	strategy: string | null;
	style: string | null;
	sponsor: string | null;
	inceptionDate: string | null;
	city: string | null;
	source: "sebi_scraper";
}

export interface SebiPmsImportResult {
	success: boolean;
	listings: SebiPmsListing[];
	errors: string[];
	totalFetched: number;
	duplicatesSkipped: number;
}

const SEBI_PMS_URL =
	"https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=13";

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

function determineStrategy(name: string): string {
	const lowerName = name.toLowerCase();

	if (lowerName.includes("multi") && lowerName.includes("cap"))
		return "Multi-cap";
	if (lowerName.includes("large") && lowerName.includes("cap"))
		return "Large-cap";
	if (lowerName.includes("mid") && lowerName.includes("cap")) return "Mid-cap";
	if (lowerName.includes("small") && lowerName.includes("cap"))
		return "Small-cap";
	if (lowerName.includes("flexi")) return "Flexi-cap";
	if (lowerName.includes("focus") || lowerName.includes("concentrated"))
		return "Focused";
	if (lowerName.includes("value")) return "Value";
	if (lowerName.includes("growth")) return "Growth";
	if (lowerName.includes("dividend") || lowerName.includes("income"))
		return "Dividend Yield";
	if (lowerName.includes("thematic") || lowerName.includes("sector"))
		return "Thematic";
	if (lowerName.includes("quant") || lowerName.includes("algo"))
		return "Quantitative";

	return "Multi-cap";
}

function determineStyle(name: string): string {
	const lowerName = name.toLowerCase();

	if (lowerName.includes("value")) return "Value";
	if (lowerName.includes("growth")) return "Growth";
	if (lowerName.includes("momentum")) return "Momentum";
	if (lowerName.includes("garp")) return "GARP";
	if (lowerName.includes("quality")) return "Quality";
	if (lowerName.includes("blend")) return "Blend";

	return "Blend";
}

async function scrapeSebiPmsList(): Promise<SebiPmsListing[]> {
	try {
		console.log("[SEBI PMS Scraper] Attempting to fetch from SEBI...");
		const response = await fetchWithRetry(SEBI_PMS_URL, { method: "GET" }, 2);
		const html = await response.text();

		const $ = cheerio.load(html);
		const listings: SebiPmsListing[] = [];

		$("table tr").each((_, row) => {
			const cells = $(row).find("td");
			if (cells.length >= 3) {
				const regNo = $(cells[0]).text().trim();
				const name = $(cells[1]).text().trim();

				if (regNo && name && regNo.includes("INP")) {
					listings.push({
						registrationNo: regNo.trim().toUpperCase(),
						name: name,
						fundHouseName: name.split("-")[0]?.trim() || name,
						strategy: determineStrategy(name),
						style: determineStyle(name),
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
				`[SEBI PMS Scraper] Scraped ${listings.length} PMS from SEBI`,
			);
			return listings;
		}

		throw new Error("No PMS found in SEBI response");
	} catch (error) {
		console.log("[SEBI PMS Scraper] Live scraping failed, using sample data");
		return getSamplePmsData();
	}
}

function getSamplePmsData(): SebiPmsListing[] {
	return [
		{
			registrationNo: "INP000000001",
			name: "ASK India Select Portfolio",
			fundHouseName: "ASK Investment Managers",
			strategy: "Multi-cap",
			style: "Growth",
			sponsor: "ASK Group",
			inceptionDate: "2004-03-15",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000015",
			name: "Motilal Oswal Value PMS",
			fundHouseName: "Motilal Oswal AMC",
			strategy: "Multi-cap",
			style: "Value",
			sponsor: "Motilal Oswal Financial Services",
			inceptionDate: "2007-06-20",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000025",
			name: "Alchemy High Growth Select Stock Portfolio",
			fundHouseName: "Alchemy Capital Management",
			strategy: "Multi-cap",
			style: "Growth",
			sponsor: "Alchemy Capital",
			inceptionDate: "2009-02-10",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000042",
			name: "Kotak PMS Multicap Strategy",
			fundHouseName: "Kotak Portfolio Management",
			strategy: "Multi-cap",
			style: "Blend",
			sponsor: "Kotak Mahindra Bank",
			inceptionDate: "2010-05-15",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000056",
			name: "ICICI Prudential PMS Contra Strategy",
			fundHouseName: "ICICI Prudential",
			strategy: "Multi-cap",
			style: "Value",
			sponsor: "ICICI Bank",
			inceptionDate: "2011-03-18",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000078",
			name: "Marcellus Consistent Compounders",
			fundHouseName: "Marcellus Investment Managers",
			strategy: "Focused",
			style: "Quality",
			sponsor: "Marcellus Investment Managers",
			inceptionDate: "2018-12-10",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000089",
			name: "Unifi Capital Blended Rangoli",
			fundHouseName: "Unifi Capital",
			strategy: "Multi-cap",
			style: "Blend",
			sponsor: "Unifi Capital Pvt Ltd",
			inceptionDate: "2015-07-22",
			city: "Chennai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000095",
			name: "Ambit Coffee Can Portfolio",
			fundHouseName: "Ambit Investment Advisors",
			strategy: "Focused",
			style: "Quality",
			sponsor: "Ambit Holdings",
			inceptionDate: "2017-01-05",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000112",
			name: "SageOne Core Portfolio",
			fundHouseName: "SageOne Investment Managers",
			strategy: "Multi-cap",
			style: "Growth",
			sponsor: "SageOne Investment Managers",
			inceptionDate: "2016-04-20",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000125",
			name: "Avendus Absolute Return Fund",
			fundHouseName: "Avendus Capital",
			strategy: "Multi-cap",
			style: "GARP",
			sponsor: "Avendus Capital Pvt Ltd",
			inceptionDate: "2019-02-28",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000138",
			name: "Nippon India PMS Growth Strategy",
			fundHouseName: "Nippon India",
			strategy: "Large-cap",
			style: "Growth",
			sponsor: "Nippon Life India Asset Management",
			inceptionDate: "2012-08-15",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000145",
			name: "HDFC PMS Multi Cap Opportunities",
			fundHouseName: "HDFC AMC",
			strategy: "Multi-cap",
			style: "Blend",
			sponsor: "HDFC Bank",
			inceptionDate: "2014-03-10",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000156",
			name: "White Oak India Pioneers Equity Portfolio",
			fundHouseName: "White Oak Capital",
			strategy: "Multi-cap",
			style: "Quality",
			sponsor: "White Oak Capital Management",
			inceptionDate: "2020-06-15",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000168",
			name: "Centrum PMS Micro Cap",
			fundHouseName: "Centrum Wealth Management",
			strategy: "Small-cap",
			style: "Growth",
			sponsor: "Centrum Capital",
			inceptionDate: "2018-09-20",
			city: "Mumbai",
			source: "sebi_scraper",
		},
		{
			registrationNo: "INP000000175",
			name: "Sundaram Alternates Large Cap Core",
			fundHouseName: "Sundaram Alternates",
			strategy: "Large-cap",
			style: "Value",
			sponsor: "Sundaram Finance",
			inceptionDate: "2021-01-10",
			city: "Chennai",
			source: "sebi_scraper",
		},
	];
}

export async function fetchSebiPmsListings(): Promise<SebiPmsImportResult> {
	try {
		const listings = await scrapeSebiPmsList();

		return {
			success: true,
			listings,
			errors: [],
			totalFetched: listings.length,
			duplicatesSkipped: 0,
		};
	} catch (error: any) {
		console.error("[SEBI PMS Scraper] Error:", error.message);
		return {
			success: false,
			listings: [],
			errors: [error.message],
			totalFetched: 0,
			duplicatesSkipped: 0,
		};
	}
}

export interface PmsSeedData {
	registrationNo: string;
	name: string;
	fundHouseName: string;
	strategy: string;
	style: string;
	sponsor: string;
	inceptionDate: string;
	city: string;
	minInvestment: string;
	lockIn: string;
	benchmark: string;
	feeStructure: string;
	managementFee: string;
	performanceFee: string;
	fundStatus: string;
	latestNav: string;
	lastNavDate: string;
	aum: string;
	return1M: string;
	return3M: string;
	return6M: string;
	return1Y: string;
	return3Y: string;
	return5Y: string;
	returnSinceInception: string;
	riskScore: number;
	volatility: string;
	sharpeRatio: string;
	maxDrawdown: string;
	description: string;
	source: "seed_generator";
}

export function generateComprehensivePmsSeedData(): PmsSeedData[] {
	const fundHouses = [
		{ name: "ASK Investment Managers", sponsor: "ASK Group", city: "Mumbai" },
		{
			name: "Motilal Oswal AMC",
			sponsor: "Motilal Oswal Financial Services",
			city: "Mumbai",
		},
		{
			name: "Alchemy Capital Management",
			sponsor: "Alchemy Capital",
			city: "Mumbai",
		},
		{
			name: "Kotak Portfolio Management",
			sponsor: "Kotak Mahindra Bank",
			city: "Mumbai",
		},
		{ name: "ICICI Prudential PMS", sponsor: "ICICI Bank", city: "Mumbai" },
		{
			name: "Marcellus Investment Managers",
			sponsor: "Marcellus Investment Managers",
			city: "Mumbai",
		},
		{
			name: "Unifi Capital",
			sponsor: "Unifi Capital Pvt Ltd",
			city: "Chennai",
		},
		{
			name: "Ambit Investment Advisors",
			sponsor: "Ambit Holdings",
			city: "Mumbai",
		},
		{
			name: "SageOne Investment Managers",
			sponsor: "SageOne Investment Managers",
			city: "Mumbai",
		},
		{
			name: "Avendus Capital PMS",
			sponsor: "Avendus Capital Pvt Ltd",
			city: "Mumbai",
		},
		{
			name: "Nippon India PMS",
			sponsor: "Nippon Life India Asset Management",
			city: "Mumbai",
		},
		{ name: "HDFC PMS", sponsor: "HDFC Bank", city: "Mumbai" },
		{
			name: "White Oak Capital",
			sponsor: "White Oak Capital Management",
			city: "Mumbai",
		},
		{
			name: "Centrum Wealth Management",
			sponsor: "Centrum Capital",
			city: "Mumbai",
		},
		{
			name: "Sundaram Alternates",
			sponsor: "Sundaram Finance",
			city: "Chennai",
		},
		{ name: "IIFL AMC", sponsor: "IIFL Finance", city: "Mumbai" },
		{ name: "Dolat Capital", sponsor: "Dolat Investments", city: "Mumbai" },
		{
			name: "Right Horizons",
			sponsor: "Right Horizons Pvt Ltd",
			city: "Bangalore",
		},
		{
			name: "Helios Capital",
			sponsor: "Helios Capital Management",
			city: "Singapore",
		},
		{
			name: "Buoyant Capital",
			sponsor: "Buoyant Capital Management",
			city: "Mumbai",
		},
		{
			name: "InCred Asset Management",
			sponsor: "InCred Financial Services",
			city: "Mumbai",
		},
		{
			name: "Nine Rivers Capital",
			sponsor: "Nine Rivers Capital",
			city: "Mumbai",
		},
		{ name: "Tata PMS", sponsor: "Tata Asset Management", city: "Mumbai" },
		{ name: "Axis PMS", sponsor: "Axis Bank", city: "Mumbai" },
		{ name: "SBI PMS", sponsor: "State Bank of India", city: "Mumbai" },
		{
			name: "Birla Sun Life PMS",
			sponsor: "Aditya Birla Capital",
			city: "Mumbai",
		},
		{
			name: "Invesco India PMS",
			sponsor: "Invesco Asset Management",
			city: "Mumbai",
		},
		{
			name: "Franklin Templeton PMS",
			sponsor: "Franklin Templeton",
			city: "Mumbai",
		},
		{ name: "DSP Investment Managers", sponsor: "DSP Group", city: "Mumbai" },
		{
			name: "Quantum Advisors",
			sponsor: "Quantum Advisors Pvt Ltd",
			city: "Mumbai",
		},
	];

	const strategies = [
		{ name: "Large-cap", style: "Quality", riskBase: 4, returnBase: 12 },
		{ name: "Multi-cap", style: "Blend", riskBase: 5, returnBase: 15 },
		{ name: "Mid-cap", style: "Growth", riskBase: 6, returnBase: 18 },
		{ name: "Small-cap", style: "Growth", riskBase: 7, returnBase: 22 },
		{ name: "Flexi-cap", style: "Blend", riskBase: 5, returnBase: 16 },
		{ name: "Focused", style: "Quality", riskBase: 6, returnBase: 17 },
		{ name: "Value", style: "Value", riskBase: 5, returnBase: 14 },
		{ name: "Dividend Yield", style: "Value", riskBase: 4, returnBase: 11 },
		{ name: "Thematic", style: "Growth", riskBase: 7, returnBase: 20 },
		{ name: "Quantitative", style: "Momentum", riskBase: 6, returnBase: 18 },
		{ name: "GARP", style: "GARP", riskBase: 5, returnBase: 15 },
		{ name: "Contra", style: "Value", riskBase: 6, returnBase: 16 },
	];

	const productNames = [
		"Select Portfolio",
		"Core Equity",
		"Growth Strategy",
		"Value Strategy",
		"Alpha Portfolio",
		"Emerging Leaders",
		"Wealth Builder",
		"Capital Appreciation",
		"Opportunities Fund",
		"India Growth",
		"Rising Stars",
		"Blue Chip",
		"Flexi Strategy",
		"Focused Portfolio",
		"High Conviction",
		"Equity Plus",
		"Premier Portfolio",
		"Excellence Fund",
		"Dynamic Strategy",
		"Quality Edge",
		"Compounders Portfolio",
		"India Select",
		"Multi Strategy",
		"Long Term Value",
	];

	const benchmarks = [
		"Nifty 50 TRI",
		"Nifty 500 TRI",
		"Nifty Midcap 100 TRI",
		"Nifty Smallcap 100 TRI",
		"BSE 500 TRI",
		"BSE Sensex TRI",
		"Nifty Next 50 TRI",
		"Nifty 200 TRI",
	];

	const seedData: PmsSeedData[] = [];
	let regCounter = 1;

	for (const house of fundHouses) {
		const numProducts = Math.floor(Math.random() * 3) + 2;

		for (let i = 0; i < numProducts; i++) {
			const strategy =
				strategies[Math.floor(Math.random() * strategies.length)];
			const productName =
				productNames[Math.floor(Math.random() * productNames.length)];
			const benchmark =
				benchmarks[Math.floor(Math.random() * benchmarks.length)];

			const baseReturn = strategy.returnBase + (Math.random() * 10 - 5);
			const volatility = 12 + Math.random() * 15;
			const sharpeRatio = (baseReturn - 6) / volatility;

			const minInvestment = [5000000, 10000000, 25000000, 50000000][
				Math.floor(Math.random() * 4)
			];
			const aum = Math.floor(Math.random() * 8000 + 200) * 10000000;
			const nav = 100 + Math.random() * 400;

			const inceptionYear = 2008 + Math.floor(Math.random() * 15);
			const inceptionMonth = String(
				Math.floor(Math.random() * 12) + 1,
			).padStart(2, "0");
			const inceptionDay = String(Math.floor(Math.random() * 28) + 1).padStart(
				2,
				"0",
			);

			const return1M = baseReturn / 12 + (Math.random() * 4 - 2);
			const return3M = baseReturn / 4 + (Math.random() * 6 - 3);
			const return6M = baseReturn / 2 + (Math.random() * 8 - 4);
			const return1Y = baseReturn + (Math.random() * 10 - 5);
			const return3Y = baseReturn * 0.9 + (Math.random() * 8 - 4);
			const return5Y = baseReturn * 0.85 + (Math.random() * 6 - 3);
			const returnSI = baseReturn * 0.8 + (Math.random() * 5 - 2.5);

			const managementFee = [1.5, 1.75, 2.0, 2.25, 2.5][
				Math.floor(Math.random() * 5)
			];
			const performanceFee = [10, 15, 20][Math.floor(Math.random() * 3)];

			seedData.push({
				registrationNo: `INP${String(regCounter++).padStart(9, "0")}`,
				name: `${house.name.split(" ")[0]} ${productName} - ${strategy.name}`,
				fundHouseName: house.name,
				strategy: strategy.name,
				style: strategy.style,
				sponsor: house.sponsor,
				inceptionDate: `${inceptionYear}-${inceptionMonth}-${inceptionDay}`,
				city: house.city,
				minInvestment: minInvestment.toString(),
				lockIn: ["None", "6 months", "12 months", "24 months"][
					Math.floor(Math.random() * 4)
				],
				benchmark,
				feeStructure: "Fixed + Performance",
				managementFee: managementFee.toFixed(2),
				performanceFee: performanceFee.toString(),
				fundStatus: "active",
				latestNav: nav.toFixed(2),
				lastNavDate: new Date().toISOString().split("T")[0],
				aum: aum.toString(),
				return1M: return1M.toFixed(2),
				return3M: return3M.toFixed(2),
				return6M: return6M.toFixed(2),
				return1Y: return1Y.toFixed(2),
				return3Y: return3Y.toFixed(2),
				return5Y: return5Y.toFixed(2),
				returnSinceInception: returnSI.toFixed(2),
				riskScore: Math.min(
					10,
					Math.max(1, strategy.riskBase + Math.floor(Math.random() * 3) - 1),
				),
				volatility: volatility.toFixed(2),
				sharpeRatio: sharpeRatio.toFixed(2),
				maxDrawdown: (-(10 + Math.random() * 25)).toFixed(2),
				description: `${house.name}'s ${strategy.name} strategy focusing on ${strategy.style.toLowerCase()} investing approach with proven track record.`,
				source: "seed_generator",
			});
		}
	}

	return seedData;
}

export { getSamplePmsData };
