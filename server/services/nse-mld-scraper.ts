import * as cheerio from "cheerio";

export interface NseMldListing {
	isin: string;
	name: string;
	issuer: string;
	issueDate: string | null;
	maturityDate: string | null;
	faceValue: string;
	couponRate: string | null;
	creditRating: string | null;
	listingType: "listed";
	exchange: "NSE";
	source: "nse_scraper";
}

export interface NseMldImportResult {
	success: boolean;
	listings: NseMldListing[];
	errors: string[];
	totalFetched: number;
	duplicatesSkipped: number;
}

const NSE_DEBT_URL =
	"https://www.nseindia.com/market-data/bonds-traded-in-capital-market";
const NSE_CORP_BONDS_API =
	"https://www.nseindia.com/api/liveBonds-traded-in-capital-market";

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
					Accept: "application/json, text/html, */*",
					"Accept-Language": "en-US,en;q=0.9",
					Referer: "https://www.nseindia.com/",
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

function parseFaceValue(fvStr: string | null | undefined): string {
	if (!fvStr) return "100000";
	const cleanStr = fvStr.replace(/[₹,\s]/g, "");
	const num = Number.parseFloat(cleanStr);
	if (Number.isNaN(num)) return "100000";
	return num.toString();
}

function isMLD(name: string, issuer: string): boolean {
	const lowerName = name.toLowerCase();
	const lowerIssuer = issuer.toLowerCase();
	const mldKeywords = [
		"market linked",
		"mld",
		"market-linked",
		"linked debenture",
		"principal protected",
		"index linked",
		"equity linked",
		"structured",
	];
	return mldKeywords.some(
		(keyword) => lowerName.includes(keyword) || lowerIssuer.includes(keyword),
	);
}

export async function scrapeNseMldListings(): Promise<NseMldImportResult> {
	const listings: NseMldListing[] = [];
	const errors: string[] = [];

	try {
		console.log("[NSE MLD Scraper] Fetching NSE corporate bonds data...");

		const response = await fetchWithRetry(NSE_CORP_BONDS_API, {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
		});

		const data = await response.json();

		if (!Array.isArray(data?.data)) {
			console.log(
				"[NSE MLD Scraper] API response is not in expected format, trying HTML scrape...",
			);
			return await scrapeNseDebtHtml();
		}

		console.log(
			`[NSE MLD Scraper] Found ${data.data.length} debt securities from NSE API`,
		);

		for (const item of data.data) {
			try {
				const securityName =
					item.symbol || item.securityName || item.security || "";
				const issuerName =
					item.issuerName ||
					item.issuer ||
					item.company ||
					securityName.split(" ")[0] ||
					"";

				if (!isMLD(securityName, issuerName)) continue;

				const isin = item.isin || item.ISIN || "";
				if (!isin) continue;

				listings.push({
					isin: isin.trim().toUpperCase(),
					name: securityName.trim(),
					issuer: issuerName.trim(),
					issueDate: parseDate(item.issueDate || item.issue_date),
					maturityDate: parseDate(
						item.maturityDate || item.maturity_date || item.redemptionDate,
					),
					faceValue: parseFaceValue(item.faceValue || item.face_value),
					couponRate: item.couponRate || item.coupon_rate || null,
					creditRating: item.rating || item.creditRating || null,
					listingType: "listed",
					exchange: "NSE",
					source: "nse_scraper",
				});
			} catch (itemError: any) {
				errors.push(`Failed to parse item: ${itemError.message}`);
			}
		}

		return {
			success: true,
			listings,
			errors,
			totalFetched: data.data.length,
			duplicatesSkipped: 0,
		};
	} catch (error: any) {
		console.error(
			"[NSE MLD Scraper] Error fetching from NSE API:",
			error.message,
		);
		errors.push(`NSE API Error: ${error.message}`);

		try {
			return await scrapeNseDebtHtml();
		} catch (htmlError: any) {
			errors.push(`NSE HTML Scrape Error: ${htmlError.message}`);
			return {
				success: false,
				listings: [],
				errors,
				totalFetched: 0,
				duplicatesSkipped: 0,
			};
		}
	}
}

async function scrapeNseDebtHtml(): Promise<NseMldImportResult> {
	const listings: NseMldListing[] = [];
	const errors: string[] = [];

	try {
		console.log(
			"[NSE MLD Scraper] Attempting HTML scrape from NSE debt page...",
		);

		const response = await fetchWithRetry(NSE_DEBT_URL);
		const html = await response.text();
		const $ = cheerio.load(html);

		let totalRows = 0;

		$("table tbody tr").each((_, row) => {
			totalRows++;
			const cells = $(row).find("td");
			if (cells.length < 4) return;

			const isin = $(cells[0]).text().trim();
			const name = $(cells[1]).text().trim();
			const issuer = $(cells[2]).text().trim() || name.split(" ")[0];
			const maturityDate = $(cells[3]).text().trim();
			const faceValue = cells.length > 4 ? $(cells[4]).text().trim() : "";
			const couponRate = cells.length > 5 ? $(cells[5]).text().trim() : "";
			const creditRating = cells.length > 6 ? $(cells[6]).text().trim() : "";

			if (!isin || !name) return;
			if (!isMLD(name, issuer)) return;

			listings.push({
				isin: isin.trim().toUpperCase(),
				name,
				issuer,
				issueDate: null,
				maturityDate: parseDate(maturityDate),
				faceValue: parseFaceValue(faceValue),
				couponRate: couponRate || null,
				creditRating: creditRating || null,
				listingType: "listed",
				exchange: "NSE",
				source: "nse_scraper",
			});
		});

		console.log(
			`[NSE MLD Scraper] HTML scrape found ${listings.length} MLDs from ${totalRows} rows`,
		);

		return {
			success: true,
			listings,
			errors,
			totalFetched: totalRows,
			duplicatesSkipped: 0,
		};
	} catch (error: any) {
		console.error("[NSE MLD Scraper] HTML scrape error:", error.message);
		errors.push(`HTML Scrape Error: ${error.message}`);
		return {
			success: false,
			listings: [],
			errors,
			totalFetched: 0,
			duplicatesSkipped: 0,
		};
	}
}

export function generateSampleNseMldListings(): NseMldListing[] {
	const issuers = [
		{ name: "HDFC Ltd", rating: "AAA" },
		{ name: "Bajaj Finance Ltd", rating: "AAA" },
		{ name: "L&T Finance Ltd", rating: "AA+" },
		{ name: "Tata Capital Ltd", rating: "AAA" },
		{ name: "Mahindra & Mahindra Financial", rating: "AA+" },
		{ name: "Aditya Birla Capital Ltd", rating: "AAA" },
		{ name: "Hero FinCorp Ltd", rating: "AA+" },
		{ name: "TVS Credit Services Ltd", rating: "AA" },
		{ name: "Godrej Capital Ltd", rating: "AA+" },
		{ name: "Nippon Life India Asset", rating: "AAA" },
		{ name: "ICICI Prudential Life", rating: "AAA" },
		{ name: "HDFC Life Insurance", rating: "AAA" },
		{ name: "SBI Life Insurance", rating: "AAA" },
		{ name: "Max Life Insurance", rating: "AA+" },
		{ name: "Birla Sun Life", rating: "AAA" },
		{ name: "PNB Housing Finance", rating: "AA" },
		{ name: "Can Fin Homes Ltd", rating: "AA+" },
		{ name: "LIC Housing Finance", rating: "AAA" },
		{ name: "IRFC Ltd", rating: "AAA" },
		{ name: "REC Ltd", rating: "AAA" },
		{ name: "PFC Ltd", rating: "AAA" },
		{ name: "NABARD", rating: "AAA" },
		{ name: "SIDBI", rating: "AAA" },
		{ name: "NHB", rating: "AAA" },
		{ name: "EXIM Bank", rating: "AAA" },
	];

	const mldTypes = [
		"Market Linked Debentures",
		"Principal Protected MLD",
		"Index Linked NCD",
		"Structured MLD",
		"Capital Protected MLD",
		"Nifty 50 Linked MLD",
		"Sensex Linked MLD",
		"Gold Linked MLD",
	];

	const tenors = [2, 3, 4, 5, 7, 10];
	const faceValues = ["100000", "500000", "1000000", "250000"];

	const listings: NseMldListing[] = [];
	let isinCounter = 200;

	for (const issuer of issuers) {
		const numMlds = Math.floor(Math.random() * 3) + 2;

		for (let i = 0; i < numMlds; i++) {
			const mldType = mldTypes[Math.floor(Math.random() * mldTypes.length)];
			const tenor = tenors[Math.floor(Math.random() * tenors.length)];
			const series = `N${i + 1}`;

			const issueYear = 2023 + Math.floor(Math.random() * 2);
			const issueMonth = Math.floor(Math.random() * 12) + 1;
			const maturityYear = issueYear + tenor;

			const isinNum = String(isinCounter++).padStart(3, "0");

			listings.push({
				isin: `INE${isinNum}A08${String(200 + isinCounter).slice(-3)}`,
				name: `${issuer.name.split(" ")[0]} ${mldType} Series ${series} ${maturityYear}`,
				issuer: issuer.name,
				issueDate: `${issueYear}-${String(issueMonth).padStart(2, "0")}-01`,
				maturityDate: `${maturityYear}-${String(issueMonth).padStart(2, "0")}-01`,
				faceValue: faceValues[Math.floor(Math.random() * faceValues.length)],
				couponRate: null,
				creditRating: issuer.rating,
				listingType: "listed",
				exchange: "NSE",
				source: "nse_scraper",
			});
		}
	}

	return listings;
}
