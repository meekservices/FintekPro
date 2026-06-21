import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../logger";
import { formatMarketCap } from "./financialEngine";
import { fetchFromScreener } from "./dataService";
import { callPython } from "../../clients/python-client";

const BROWSER_HEADERS_GF = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
	"Accept-Language": "en-US,en;q=0.9",
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const peerEnrichCache = new Map<
	string,
	{
		roe: number | null;
		pe: number | null;
		pb: number | null;
		de: number | null;
		expiresAt: number;
	}
>();

/** Scrape P/E and P/B from Google Finance static HTML for Indian stocks */
async function fetchFromGoogleFinance(
	symbol: string,
): Promise<{ pe: number | null; pb: number | null }> {
	const fallback = { pe: null, pb: null };
	try {
		const url = `https://www.google.com/finance/quote/${symbol.toUpperCase()}:NSE`;
		const res = await fetch(url, {
			headers: BROWSER_HEADERS_GF,
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) return fallback;
		const html = await res.text();

		const parseNum = (s: string) => {
			const n = Number.parseFloat(s.replace(/,/g, ""));
			return Number.isNaN(n) ? null : n;
		};

		let pe: number | null = null;
		let pb: number | null = null;

		const peMatch = html.match(
			/[Pp]\s*\/\s*[Ee]\s+[Rr]atio[\s\S]{0,300}?>\s*([\d,\.]+)\s*</,
		);
		if (peMatch) pe = parseNum(peMatch[1]);

		const pbMatch = html.match(
			/[Pp]rice\s+\/\s+[Bb]ook[\s\S]{0,300}?>\s*([\d,\.]+)\s*</,
		);
		if (pbMatch) pb = parseNum(pbMatch[1]);

		const jsonMatches = [
			...html.matchAll(/\[["']P\/E ratio["'],["']([\d\.]+)["']\]/g),
		];
		if (jsonMatches.length && pe === null) pe = parseNum(jsonMatches[0][1]);

		if (pe !== null || pb !== null) {
			console.log(
				`[ResearchNote][Peer] Google Finance ${symbol}: PE=${pe ?? "N/A"}, PB=${pb ?? "N/A"}`,
			);
		}
		return { pe, pb };
	} catch {
		return fallback;
	}
}

/** Enrich a peer stock using Screener.in (primary) + Google Finance (secondary for PE/PB) */
async function enrichPeer(
	symbol: string,
): Promise<{
	roe: number | null;
	pe: number | null;
	pb: number | null;
	de: number | null;
	bookValue: number | null;
}> {
	const cached = peerEnrichCache.get(symbol);
	if (cached && cached.expiresAt > Date.now())
		return {
			roe: cached.roe,
			pe: cached.pe,
			pb: cached.pb,
			de: cached.de,
			bookValue: null,
		};

	const fallback = { roe: null, pe: null, pb: null, de: null, bookValue: null };
	try {
		const screener = await fetchFromScreener(symbol);
		const result = {
			roe: screener.roe,
			pe: screener.pe,
			pb: screener.pb,
			de: screener.debtToEquity,
			bookValue: screener.bookValue,
		};

		// 2nd tier: yfinance via Python sidecar (reliable, localhost, no rate limits)
		if (result.pe === null || result.pb === null || result.roe === null) {
			try {
				const pyResp = await callPython<{ results: Record<string, any> }>(
					"/market/peer-enrich",
					"POST",
					{ symbols: [symbol] },
				);
				const py = pyResp?.results?.[symbol];
				if (py) {
					const pf = (v: any) => {
						const n = Number.parseFloat(v);
						return Number.isNaN(n) ? null : n;
					};
					if (result.pe === null && py.pe != null) result.pe = pf(py.pe);
					if (result.pb === null && py.pb != null) result.pb = pf(py.pb);
					if (result.roe === null && py.roe != null) result.roe = pf(py.roe);
					if (result.de === null && py.debtToEquity != null)
						result.de = pf(py.debtToEquity);
					if (result.bookValue === null && py.bookValue != null)
						result.bookValue = pf(py.bookValue);
				}
			} catch {
				/* Python sidecar unavailable — non-critical */
			}
		}
		// 3rd tier: NSE API for P/B (reliable, official)
		if (result.pb === null) {
			try {
				await ensureNseCookies();
				const nseRes = await fetch(
					`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol.toUpperCase())}`,
					{
						headers: {
							...BROWSER_HEADERS,
							Accept: "application/json",
							Cookie: nseCookies,
							Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${symbol}`,
						},
						signal: AbortSignal.timeout(10_000),
					},
				);
				if (nseRes.ok) {
					const q = (await nseRes.json()) as any;
					const pb = Number.parseFloat(q?.metadata?.pdPriceToBV ?? "");
					if (!Number.isNaN(pb) && pb > 0) result.pb = pb;
				}
			} catch {
				/* non-critical */
			}
		}
		// 4th tier: Google Finance HTML scraping (fragile — JS-rendered page, last resort only)
		if (result.pe === null || result.pb === null) {
			const gf = await fetchFromGoogleFinance(symbol);
			if (result.pe === null && gf.pe !== null) result.pe = gf.pe;
			if (result.pb === null && gf.pb !== null) result.pb = gf.pb;
		}

		peerEnrichCache.set(symbol, {
			roe: result.roe,
			pe: result.pe,
			pb: result.pb,
			de: result.de,
			expiresAt: Date.now() + 30 * 60 * 1000,
		});

		// Write back to DB
		const sym = symbol.toUpperCase();
		if (result.roe !== null || result.de !== null) {
			(async () => {
				try {
					const upd = await db.execute(sql`
            UPDATE screener_financials
            SET
              roe            = COALESCE(${result.roe}, roe),
              debt_to_equity = COALESCE(${result.de}, debt_to_equity),
              last_updated   = NOW()
            WHERE symbol = ${sym}
          `);
					const rowsUpdated = (upd as any).rowCount ?? (upd as any).count ?? 0;
					if (!rowsUpdated) {
						await db.execute(sql`
              INSERT INTO screener_financials (symbol, roe, debt_to_equity, last_updated)
              VALUES (${sym}, ${result.roe}, ${result.de}, NOW())
            `);
					}
				} catch (e: any) {
					console.warn(
						`[ResearchNote][Peer] DB write-back failed for ${sym}:`,
						e?.message?.slice(0, 60),
					);
				}
			})();
		}
		if (result.pe !== null) {
			db.execute(sql`
        UPDATE listed_stocks SET pe_ratio = ${result.pe}, enrichment_status = 'complete', last_enriched_at = NOW()
        WHERE symbol = ${sym} AND (pe_ratio IS NULL OR pe_ratio::numeric = 20)
      `).catch(() => {});
		}

		console.log(
			`[ResearchNote][Peer] ${symbol}: ROE=${result.roe !== null ? (result.roe * 100).toFixed(1) + "%" : "N/A"}, PE=${result.pe ?? "N/A"}, PB=${result.pb ?? "N/A"}, BV=${result.bookValue ?? "N/A"}`,
		);
		return result;
	} catch (e: any) {
		console.warn(
			`[ResearchNote][Peer] Enrichment failed for ${symbol}:`,
			e?.message?.slice(0, 80),
		);
		peerEnrichCache.set(symbol, {
			...fallback,
			expiresAt: Date.now() + 5 * 60 * 1000,
		});
		return fallback;
	}
}

export interface ShareholdingData {
	promoterPct: number | null;
	promoterPrevPct: number | null;
	promoterChange: number | null;
	fiiPct: number | null;
	diiPct: number | null;
	mutualFundPct: number | null;
	publicPct: number | null;
	pledgedPct: number | null;
	quarter: string | null;
	prevQuarter: string | null;
}

export interface PeerData {
	symbol: string;
	name: string;
	price: number | null;
	pe: number | null;
	pb: number | null;
	roe: number | null;
	marketCap: number | null;
	marketCapFormatted: string;
	dividendYield: number | null;
	/** Analyst consensus rating: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | null */
	analystRating: string | null;
	/** Number of analysts covering this stock */
	numberOfAnalysts: number | null;
}

export interface SectorAverages {
	avgPE: number | null;
	avgPB: number | null;
	avgROE: number | null;
	avgROCE: number | null;
	avgDE: number | null;
	stockCount: number;
}

const shareholdingCache = new Map<
	string,
	{ data: ShareholdingData; expiresAt: number }
>();
const peersCache = new Map<
	string,
	{ data: PeerData[]; sectorAvg: SectorAverages; expiresAt: number }
>();
const CACHE_TTL = 15 * 60 * 1000;

const BROWSER_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	Accept: "application/json",
	"Accept-Language": "en-US,en;q=0.9",
};

let nseCookies = "";
let nseCookieExpiry = 0;

async function ensureNseCookies(): Promise<void> {
	if (Date.now() < nseCookieExpiry) return;
	try {
		const res = await fetch("https://www.nseindia.com", {
			headers: BROWSER_HEADERS,
		});
		const setCookie = res.headers.get("set-cookie") ?? "";
		if (setCookie) {
			nseCookies = setCookie
				.split(",")
				.map((c) => c.split(";")[0])
				.join("; ");
			nseCookieExpiry = Date.now() + 5 * 60 * 1000;
		}
	} catch (e) {
		logger.debug(
			"[OwnershipService] NSE cookie refresh failed — requests will proceed without cookies",
			{ error: e instanceof Error ? e.message : String(e) },
		);
	}
}

function formatDate(d: Date): string {
	return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

/** Detect if a symbol is an InvIT or REIT based on naming conventions */
function isInvITorREIT(sym: string): boolean {
	return /INVIT|REIT|TRUST|ROADS|HIGHWAYS|INFRA(?:INVEST|INVIT)/i.test(sym);
}

/**
 * Fetch unit-holding pattern for InvITs/REITs from NSE's dedicated endpoint.
 * InvITs use "sponsor" terminology instead of "promoter", and have a different API path.
 */
async function fetchInvITUnitHolding(
	sym: string,
): Promise<ShareholdingData | null> {
	try {
		await ensureNseCookies();
		const today = new Date();
		const sixMonthsAgo = new Date(today);
		sixMonthsAgo.setMonth(today.getMonth() - 6);

		// NSE dedicated unit-holding endpoint for InvITs/REITs
		const url = `https://www.nseindia.com/api/unit-holding-patterns?symbol=${encodeURIComponent(sym)}&from=${formatDate(sixMonthsAgo)}&to=${formatDate(today)}`;
		const res = await fetch(url, {
			headers: {
				...BROWSER_HEADERS,
				Cookie: nseCookies,
				Referer: "https://www.nseindia.com",
			},
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) throw new Error(`NSE unit-holding HTTP ${res.status}`);
		const raw = (await res.json()) as any;

		const records: any[] = Array.isArray(raw)
			? raw
			: raw?.data ??
				raw?.unitHoldingPatterns ??
				raw?.dateRecords ??
				raw?.records ??
				[];
		if (records.length < 1) throw new Error("No unit-holding records");

		const sorted = records.sort(
			(a: any, b: any) =>
				new Date(b.date ?? b.holdingDate ?? 0).getTime() -
				new Date(a.date ?? a.holdingDate ?? 0).getTime(),
		);
		const latest = sorted[0];
		const prev = sorted[1] ?? null;

		const pf = (v: any) => {
			const n = Number.parseFloat(String(v ?? ""));
			return Number.isNaN(n) ? null : n;
		};

		// Sponsor = Promoter equivalent for InvITs
		const promoterPct = pf(
			latest.sponsorAndSponsorGroupUnitHolding ??
				latest.sponsor ??
				latest.sponsorTotal ??
				latest.sponsorUnitHolding ??
				latest.sponsorGroup ??
				latest.promoterAndPromoterGroupShareHolding ??
				null,
		);
		const promoterPrevPct = prev
			? pf(
					prev.sponsorAndSponsorGroupUnitHolding ??
						prev.sponsor ??
						prev.sponsorTotal ??
						prev.sponsorUnitHolding ??
						prev.sponsorGroup ??
						prev.promoterAndPromoterGroupShareHolding ??
						null,
				)
			: null;

		const instPct = pf(
			latest.institutionUnitHolding ??
				latest.institutionalInvestors ??
				latest.institutions ??
				null,
		);
		const pubPct = pf(
			latest.publicUnitHolding ??
				latest.publicUnitHolders ??
				latest.public ??
				null,
		);

		const data: ShareholdingData = {
			promoterPct,
			promoterPrevPct,
			promoterChange:
				promoterPct !== null && promoterPrevPct !== null
					? Math.round((promoterPct - promoterPrevPct) * 100) / 100
					: null,
			fiiPct: null,
			diiPct: instPct, // InvITs don't separate FII/DII — use "institutions" as DII proxy
			mutualFundPct: pf(latest.mutualFunds ?? latest.mutualFund ?? null),
			publicPct: pubPct,
			pledgedPct: pf(
				latest.pledgedUnitPercentage ??
					latest.pledgedSharePercentage ??
					latest.pledged ??
					null,
			),
			quarter: latest.quarter ?? latest.holdingDate ?? latest.dateDesc ?? null,
			prevQuarter: prev?.quarter ?? prev?.holdingDate ?? prev?.dateDesc ?? null,
		};

		if (promoterPct !== null || pubPct !== null) {
			console.log(
				`[ResearchNote] Unit-holding (NSE InvIT) ${sym}: Sponsor ${promoterPct}%, Institutions ${instPct}%, Public ${pubPct}%`,
			);
			return data;
		}
		throw new Error("All unit-holding fields null");
	} catch (e: any) {
		console.warn(
			`[ResearchNote] NSE unit-holding failed for ${sym}:`,
			e?.message?.slice(0, 80),
		);
		return null;
	}
}

/**
 * Fetch shareholding from BSE API as a last resort.
 * BSE has separate endpoints for corporate and InvIT holding patterns.
 */
async function fetchShareholdingFromBSE(
	sym: string,
): Promise<ShareholdingData | null> {
	try {
		// BSE search for script code
		const searchRes = await fetch(
			`https://api.bseindia.com/BseIndiaAPI/api/fetchcomp/w?type=EQ&value=${encodeURIComponent(sym)}`,
			{
				headers: { ...BROWSER_HEADERS, Referer: "https://www.bseindia.com" },
				signal: AbortSignal.timeout(8_000),
			},
		);
		if (!searchRes.ok) return null;
		const results = (await searchRes.json()) as any;
		const scrip = results?.Table?.[0] ?? results?.[0];
		const scripcode = scrip?.SCRIP_CD ?? scrip?.scripCode;
		if (!scripcode) return null;

		// Fetch shareholding pattern from BSE
		const shRes = await fetch(
			`https://api.bseindia.com/BseIndiaAPI/api/ShareHoldingPatterns/w?scripcode=${scripcode}&qtrid=`,
			{
				headers: { ...BROWSER_HEADERS, Referer: "https://www.bseindia.com" },
				signal: AbortSignal.timeout(8_000),
			},
		);
		if (!shRes.ok) return null;
		const shData = (await shRes.json()) as any;

		const rows: any[] =
			shData?.ShareHoldingPatterns ?? shData?.Table ?? shData?.data ?? [];
		if (rows.length < 1) return null;

		// BSE groups data by category — find promoter/sponsor rows
		const pf = (v: any) => {
			const n = Number.parseFloat(String(v ?? ""));
			return Number.isNaN(n) ? null : n;
		};
		let promoterPct: number | null = null,
			fiiPct: number | null = null,
			diiPct: number | null = null;
		let publicPct: number | null = null,
			pledgedPct: number | null = null;

		for (const row of rows) {
			const cat = String(
				row.category ?? row.Category ?? row.shareholdercategory ?? "",
			).toLowerCase();
			const pct = pf(
				row.percentage ?? row.Percentage ?? row.noOfShares ?? null,
			);
			if (
				/promoter|sponsor/.test(cat) &&
				!/pledg/.test(cat) &&
				promoterPct === null
			)
				promoterPct = pct;
			else if (/fii|fpi|foreign/.test(cat) && fiiPct === null) fiiPct = pct;
			else if (/dii|domestic institution/.test(cat) && diiPct === null)
				diiPct = pct;
			else if (
				/public/.test(cat) &&
				!/institution/.test(cat) &&
				publicPct === null
			)
				publicPct = pct;
			else if (/pledg/.test(cat) && pledgedPct === null) pledgedPct = pct;
		}

		if (promoterPct === null && publicPct === null) return null;

		const data: ShareholdingData = {
			promoterPct,
			promoterPrevPct: null,
			promoterChange: null,
			fiiPct,
			diiPct,
			mutualFundPct: null,
			publicPct,
			pledgedPct,
			quarter: rows[0]?.quarter ?? rows[0]?.Quarter ?? null,
			prevQuarter: null,
		};
		console.log(
			`[ResearchNote] Shareholding (BSE) ${sym}: Promoter/Sponsor ${promoterPct}%, FII ${fiiPct}%, Public ${publicPct}%`,
		);
		return data;
	} catch (e: any) {
		console.warn(
			`[ResearchNote] BSE shareholding failed for ${sym}:`,
			e?.message?.slice(0, 60),
		);
		return null;
	}
}

/** Scrape shareholding pattern from Screener.in (fallback when NSE API fails) */
async function fetchShareholdingFromScreener(
	nseSymbol: string,
): Promise<ShareholdingData | null> {
	const sym = nseSymbol.toUpperCase();
	try {
		const searchRes = await fetch(
			`https://www.screener.in/api/company/search/?q=${encodeURIComponent(sym)}`,
			{
				headers: { ...BROWSER_HEADERS, Accept: "application/json" },
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!searchRes.ok) return null;
		const results = (await searchRes.json()) as any[];
		if (!results?.length) return null;

		const company =
			results.find((r: any) => r.url?.includes("consolidated")) ?? results[0];
		const pageRes = await fetch(`https://www.screener.in${company.url}`, {
			headers: {
				...BROWSER_HEADERS,
				Accept: "text/html",
				Referer: "https://www.screener.in/",
			},
			signal: AbortSignal.timeout(15_000),
		});
		if (!pageRes.ok) return null;
		const html = await pageRes.text();

		// Extract the #shareholding section
		const secStart = html.indexOf('id="shareholding"');
		if (secStart < 0) return null;
		const secEnd = html.indexOf("</section>", secStart);
		const section = html.slice(
			secStart,
			secEnd > 0 ? secEnd : secStart + 20000,
		);

		// Parse quarter headers from thead
		const theadMatch = section.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
		const quarters: string[] = [];
		if (theadMatch) {
			const thMatches = [
				...theadMatch[1].matchAll(/<th[^>]*>\s*([A-Za-z]+ \d{4})\s*<\/th>/g),
			];
			for (const m of thMatches) quarters.push(m[1]);
		}
		const prevQ = quarters.length >= 2 ? quarters[quarters.length - 2] : null;
		const latestQ = quarters.length >= 1 ? quarters[quarters.length - 1] : null;

		const parseNum = (s: string) => {
			const n = Number.parseFloat(s.replace(/,/g, ""));
			return Number.isNaN(n) ? null : n;
		};

		// Parse row values — extract last 2 numeric cells
		function extractRowValues(rowHtml: string): [number | null, number | null] {
			const cells = [
				...rowHtml.matchAll(/<td[^>]*>\s*([\d,\.]+)\s*<\/td>/g),
			].map((m) => parseNum(m[1]));
			if (cells.length === 0) return [null, null];
			return [
				cells.length >= 2 ? cells[cells.length - 2] : null,
				cells[cells.length - 1],
			];
		}

		// Parse shareholding using robust regex scan — find each <tr> block and extract label + last-two numbers
		let promoterPrevPct: number | null = null,
			promoterPct: number | null = null;
		let fiiPct: number | null = null,
			diiPct: number | null = null,
			publicPct: number | null = null;
		let pledgedPct: number | null = null;

		// Split on full <tr> blocks (including attributes) and work on the inner content
		const trBlocks = [...section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(
			(m) => m[1],
		);

		const extractNums = (html: string): number[] =>
			[...html.matchAll(/<td[^>]*>\s*(-?[\d,\.]+)%?\s*<\/td>/g)]
				.map((m) => parseNum(m[1]))
				.filter((v): v is number => v !== null);

		const extractLabelFromBlock = (html: string): string => {
			// Try class="text" <td> first
			const m1 =
				html.match(/<td[^>]*class="text"[^>]*>([\s\S]*?)<\/td>/i) ??
				html.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
			if (!m1) return "";
			return m1[1]
				.replace(/<[^>]+>/g, "")
				.replace(/&nbsp;/g, " ")
				.trim()
				.toLowerCase();
		};

		console.log(
			`[ResearchNote] Screener.in shareholding parse for ${sym}: trBlocks=${trBlocks.length}, quarters=${quarters.join("|")}`,
		);

		for (const block of trBlocks) {
			const label = extractLabelFromBlock(block);
			if (!label || /^\d+[\d.,]*$/.test(label)) continue;
			const nums = extractNums(block);
			if (nums.length === 0) continue;
			const latest = nums[nums.length - 1];
			const prev = nums.length >= 2 ? nums[nums.length - 2] : null;
			if (
				/promoter/.test(label) &&
				!/pledg/.test(label) &&
				promoterPct === null
			) {
				promoterPct = latest;
				promoterPrevPct = prev;
			} else if (
				/\bfiis?\b|\bfpis?\b|foreign institutional|foreign portfolio|foreign invest/.test(
					label,
				) &&
				fiiPct === null
			) {
				fiiPct = latest;
			} else if (
				/\bdiis?\b|domestic institutional|domestic invest/.test(label) &&
				diiPct === null
			) {
				diiPct = latest;
			} else if (
				/\bpublic\b/.test(label) &&
				!/institution/.test(label) &&
				publicPct === null
			) {
				publicPct = latest;
			} else if (/pledg/.test(label) && pledgedPct === null) {
				pledgedPct = latest;
			}
		}

		// Fallback: if FII+DII not found separately, check for "institutions" total row
		if (fiiPct === null && diiPct === null) {
			for (const block of trBlocks) {
				const label = extractLabelFromBlock(block);
				if (/institution/.test(label)) {
					const nums = extractNums(block);
					if (nums.length > 0) {
						fiiPct = nums[nums.length - 1];
						break;
					}
				}
			}
		}
		console.log(
			`[ResearchNote] Screener.in shareholding result for ${sym}: promoter=${promoterPct}, fii=${fiiPct}, dii=${diiPct}, public=${publicPct}`,
		);

		// Must have at least promoter%
		if (promoterPct === null) return null;

		const data: ShareholdingData = {
			promoterPct,
			promoterPrevPct,
			promoterChange:
				promoterPct !== null && promoterPrevPct !== null
					? Math.round((promoterPct - promoterPrevPct) * 100) / 100
					: null,
			fiiPct,
			diiPct,
			mutualFundPct: null,
			publicPct,
			pledgedPct,
			quarter: latestQ,
			prevQuarter: prevQ,
		};
		console.log(
			`[ResearchNote] Shareholding (Screener.in) ${sym}: Promoter ${promoterPct}% FII ${fiiPct}% DII ${diiPct}% Public ${publicPct}%`,
		);
		return data;
	} catch (e: any) {
		console.warn(
			`[ResearchNote] Screener.in shareholding failed for ${sym}:`,
			e?.message?.slice(0, 60),
		);
		return null;
	}
}

export async function fetchShareholding(
	nseSymbol: string,
): Promise<ShareholdingData | null> {
	const sym = nseSymbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
	const cached = shareholdingCache.get(sym);
	if (cached && cached.expiresAt > Date.now()) return cached.data;

	// For InvITs/REITs, try the dedicated unit-holding endpoint first
	if (isInvITorREIT(sym)) {
		const invitData = await fetchInvITUnitHolding(sym);
		if (invitData) {
			shareholdingCache.set(sym, {
				data: invitData,
				expiresAt: Date.now() + CACHE_TTL,
			});
			return invitData;
		}
	}

	try {
		await ensureNseCookies();
		const today = new Date();
		const sixMonthsAgo = new Date(today);
		sixMonthsAgo.setMonth(today.getMonth() - 6);

		const url = `https://www.nseindia.com/api/corporate-shareholding-patterns?symbol=${encodeURIComponent(sym)}&from=${formatDate(sixMonthsAgo)}&to=${formatDate(today)}`;

		const res = await fetch(url, {
			headers: {
				...BROWSER_HEADERS,
				Cookie: nseCookies,
				Referer: "https://www.nseindia.com",
			},
			signal: AbortSignal.timeout(10_000),
		});

		if (!res.ok) throw new Error(`NSE shareholding HTTP ${res.status}`);
		const raw = (await res.json()) as any;

		const records: any[] = Array.isArray(raw)
			? raw
			: raw?.data ??
				raw?.shareholdingPatterns ??
				raw?.dateRecords ??
				raw?.shareholdingPatternList ??
				[];
		if (records.length < 1) throw new Error("No shareholding records");

		const sorted = records.sort((a: any, b: any) => {
			const da = new Date(a.date ?? a.shareholdingDate ?? 0).getTime();
			const db_ = new Date(b.date ?? b.shareholdingDate ?? 0).getTime();
			return db_ - da;
		});

		const latest = sorted[0];
		const prev = sorted[1] ?? null;

		const pf = (v: any) => {
			const n = Number.parseFloat(String(v ?? ""));
			return Number.isNaN(n) ? null : n;
		};

		// Support both corporate (promoter) and InvIT/REIT (sponsor) field naming conventions
		const promoterPct = pf(
			latest.promoterAndPromoterGroupShareHolding ??
				latest.promoter ??
				latest.promoterTotal ??
				latest.sponsorAndSponsorGroupUnitHolding ??
				latest.sponsor ??
				latest.sponsorTotal ??
				latest.sponsorUnitHolding ??
				latest.sponsorGroup ??
				null,
		);
		const promoterPrevPct = prev
			? pf(
					prev.promoterAndPromoterGroupShareHolding ??
						prev.promoter ??
						prev.promoterTotal ??
						prev.sponsorAndSponsorGroupUnitHolding ??
						prev.sponsor ??
						prev.sponsorTotal ??
						prev.sponsorUnitHolding ??
						prev.sponsorGroup ??
						null,
				)
			: null;

		const fiiRaw = pf(
			latest.foreignInstitutionalInvestors ??
				latest.foreignPortfolioInvestors ??
				latest.fpi ??
				latest.fpiTotal ??
				latest.fii ??
				latest.fiiTotal ??
				latest.fiis ??
				latest.foreignUnitHolders ??
				latest.foreignInstitution ??
				null,
		);
		const diiRaw = pf(
			latest.domesticInstitutionalInvestors ??
				latest.domesticInstitutions ??
				latest.dii ??
				latest.diiTotal ??
				latest.diis ??
				latest.domesticUnitHolders ??
				latest.domesticInstitution ??
				null,
		);
		const pubRaw = pf(
			latest.public ??
				latest.publicShareholding ??
				latest.publicTotal ??
				latest.nonInstitutionShareHolding ??
				latest.publicUnitHolding ??
				latest.publicUnitHolders ??
				null,
		);

		// If FII/DII not in top-level, try to infer from institution total
		const instTotal = pf(
			latest.nonPromoterNonPublicShareholding ??
				latest.institutionShareHolding ??
				latest.institutions ??
				latest.institutionUnitHolding ??
				null,
		);
		const fiiResolved =
			fiiRaw ?? (instTotal !== null && diiRaw === null ? instTotal : null);
		const diiResolved = diiRaw;

		const data: ShareholdingData = {
			promoterPct,
			promoterPrevPct,
			promoterChange:
				promoterPct !== null && promoterPrevPct !== null
					? Math.round((promoterPct - promoterPrevPct) * 100) / 100
					: null,
			fiiPct: fiiResolved,
			diiPct: diiResolved,
			mutualFundPct: pf(latest.mutualFunds ?? latest.mutualFund),
			publicPct: pubRaw,
			pledgedPct: pf(latest.pledgedSharePercentage ?? latest.pledged),
			quarter:
				latest.quarter ?? latest.shareholdingDate ?? latest.dateDesc ?? null,
			prevQuarter:
				prev?.quarter ?? prev?.shareholdingDate ?? prev?.dateDesc ?? null,
		};

		shareholdingCache.set(sym, { data, expiresAt: Date.now() + CACHE_TTL });
		console.log(
			`[ResearchNote] Shareholding (NSE) ${sym}: Promoter ${data.promoterPct}% (Δ${data.promoterChange}%), FII ${data.fiiPct}%`,
		);
		return data;
	} catch (e: any) {
		console.warn(
			`[ResearchNote] NSE shareholding failed for ${sym}:`,
			e?.message?.slice(0, 60),
			"— trying Screener.in",
		);

		// Fallback 1: Screener.in scraper
		const screenerSh = await fetchShareholdingFromScreener(sym);
		if (screenerSh) {
			shareholdingCache.set(sym, {
				data: screenerSh,
				expiresAt: Date.now() + CACHE_TTL,
			});
			return screenerSh;
		}

		// Fallback 2: BSE API
		const bseSh = await fetchShareholdingFromBSE(sym);
		if (bseSh) {
			shareholdingCache.set(sym, {
				data: bseSh,
				expiresAt: Date.now() + CACHE_TTL,
			});
			return bseSh;
		}

		shareholdingCache.set(sym, {
			data: null as any,
			expiresAt: Date.now() + 5 * 60 * 1000,
		});
		return null;
	}
}

function mcapFmt(crores: number | null): string {
	if (!crores) return "N/A";
	// Normalize: if value > 1 billion it was stored in raw rupees (not crores) — convert
	const normalized = crores > 1e9 ? crores / 1e7 : crores;
	return `₹${Math.round(normalized).toLocaleString("en-IN")} Cr`;
}

/**
 * Compute sector averages from an array of already-enriched peer stocks + the target stock itself.
 * This gives accurate live averages instead of relying solely on potentially-stale DB data.
 */
function computeLiveSectorAverages(
	peers: PeerData[],
	targetSymbol: string,
	targetROE: number | null,
	targetPE: number | null,
	targetPB: number | null,
): SectorAverages {
	// Build full set: target stock + all enriched peers
	const all = [
		{ roe: targetROE, pe: targetPE, pb: targetPB },
		...peers.map((p) => ({ roe: p.roe, pe: p.pe, pb: p.pb })),
	];

	const validROE = all
		.map((s) => s.roe)
		.filter((v): v is number => v !== null && v > 0.001 && v < 1.5);
	const validPE = all
		.map((s) => s.pe)
		.filter((v): v is number => v !== null && v > 1 && v < 200);
	const validPB = all
		.map((s) => s.pb)
		.filter((v): v is number => v !== null && v > 0.1 && v < 50);

	const avg = (arr: number[]) =>
		arr.length
			? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10000) /
				10000
			: null;

	return {
		avgPE: validPE.length
			? Math.round((validPE.reduce((a, b) => a + b, 0) / validPE.length) * 10) /
				10
			: null,
		avgPB: validPB.length
			? Math.round(
					(validPB.reduce((a, b) => a + b, 0) / validPB.length) * 100,
				) / 100
			: null,
		avgROE: avg(validROE),
		avgROCE: null, // filled by DB-level average below
		avgDE: null,
		stockCount: all.length,
	};
}

export interface PeersAndAverage {
	peers: PeerData[];
	sectorAvg: SectorAverages;
}

/**
 * Fetch peers AND compute sector averages together, using live-enriched data for accuracy.
 * The sector average is computed from the enriched peer array + target stock's own metrics,
 * so it reflects real ROE/PE values rather than placeholder DB values.
 */
export async function fetchPeersAndAverage(
	sector: string | null,
	excludeSymbol: string,
	targetROE: number | null,
	targetPE: number | null,
	targetPB: number | null,
): Promise<PeersAndAverage> {
	const empty: PeersAndAverage = {
		peers: [],
		sectorAvg: {
			avgPE: null,
			avgPB: null,
			avgROE: null,
			avgROCE: null,
			avgDE: null,
			stockCount: 0,
		},
	};

	// Normalise: treat empty string the same as null
	const normalizedSector = sector?.trim() || null;

	// ── Sector auto-lookup from DB ──────────────────────────────────────────────
	// When sector is null/empty (common — DB enrichment doesn't always populate it),
	// look up sector + industry by symbol so peers can still be found via industry.
	const cleanSym = excludeSymbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
	let effectiveSector: string | null = normalizedSector;
	let effectiveIndustry: string | null = null;

	if (!effectiveSector) {
		try {
			const sectorRows = await db.execute(sql`
				SELECT sector, industry, broad_sector
				FROM listed_stocks
				WHERE UPPER(symbol) = ${cleanSym}
				LIMIT 1
			`);
			const sr = ((sectorRows as any).rows ?? sectorRows)[0] as any;
			if (sr) {
				effectiveSector = (sr.sector?.trim()) || (sr.broad_sector?.trim()) || null;
				effectiveIndustry = (sr.industry?.trim()) || null;
			}
		} catch {
			/* non-critical — continue with null sector */
		}
	}

	// Even after DB lookup, if we have no sector OR industry, return empty
	if (!effectiveSector && !effectiveIndustry) {
		logger.warn(`[OwnershipService.fetchPeersAndAverage] No sector/industry found for ${cleanSym} — peer comparison unavailable`);
		return empty;
	}

	const resolvedSector = effectiveSector ?? effectiveIndustry!;
	const cacheKey = `${resolvedSector}__${excludeSymbol}`;
	const cached = peersCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return { peers: cached.data, sectorAvg: cached.sectorAvg };
	}

	try {

		const rows = await db.execute(sql`
      SELECT
        ls.symbol, ls.company_name, ls.current_price, ls.pe_ratio, ls.pb_ratio,
        ls.market_cap_value,
        COALESCE(sf.roe, NULLIF(ls.roe::numeric, 0) / 100) AS roe,
        sf.roce, sf.debt_to_equity, sf.dividend_yield,
        ls.analyst_rating, ls.number_of_analysts
      FROM listed_stocks ls
      LEFT JOIN screener_financials sf ON sf.symbol = ls.symbol
      WHERE (
        (${effectiveSector} IS NOT NULL AND ls.sector = ${effectiveSector})
        OR (${effectiveSector} IS NULL AND ${effectiveIndustry} IS NOT NULL AND ls.industry = ${effectiveIndustry})
      )
        AND UPPER(ls.symbol) != ${cleanSym}
        AND ls.is_active = true
      ORDER BY ls.market_cap_value DESC NULLS LAST
      LIMIT 8
    `);

		const rawRows = (rows as any).rows ?? rows;
		const pf = (v: any) => {
			const n = Number.parseFloat(v);
			return Number.isNaN(n) ? null : n;
		};

		interface MutablePeer extends PeerData {
			_needsEnrich: boolean;
		}

		const peers: MutablePeer[] = rawRows.map((r: any) => {
			const mcapRaw = r.market_cap_value ? pf(r.market_cap_value) : null;
			// Normalize: if stored value > 1 billion it is in raw rupees, convert to crores
			const mcap = mcapRaw && mcapRaw > 1e9 ? mcapRaw / 1e7 : mcapRaw;
			const peFromDb = r.pe_ratio ? pf(r.pe_ratio) : null;
			const isPlaceholderPE = peFromDb !== null && peFromDb === 20;
			return {
				symbol: r.symbol,
				name: r.company_name,
				price: r.current_price ? pf(r.current_price) : null,
				pe: isPlaceholderPE ? null : peFromDb,
				pb: r.pb_ratio ? pf(r.pb_ratio) : null,
				roe: r.roe !== null && r.roe !== undefined ? pf(r.roe) : null,
				marketCap: mcap ? mcap * 1e7 : null,
				marketCapFormatted: mcapFmt(mcap),
				dividendYield: r.dividend_yield ? pf(r.dividend_yield) : null,
				analystRating: r.analyst_rating ?? null,
				numberOfAnalysts: r.number_of_analysts ? Number(r.number_of_analysts) : null,
				_needsEnrich: !r.roe || isPlaceholderPE,
			};
		});

		// Enrich peers missing ROE/PE via Screener.in + Google Finance (sequential to avoid rate limits)
		const needsEnrich = peers.filter(
			(p) => p._needsEnrich || p.roe === null || p.pe === null,
		);
		if (needsEnrich.length > 0) {
			console.log(
				`[ResearchNote] Enriching ${needsEnrich.length} peers via Screener.in: ${needsEnrich.map((p) => p.symbol).join(", ")}`,
			);
			for (let i = 0; i < needsEnrich.length; i++) {
				const peer = needsEnrich[i];
				if (i > 0) await new Promise((r) => setTimeout(r, 1200)); // stagger to avoid rate limiting
				try {
					const enriched = await enrichPeer(peer.symbol);
					if (enriched.roe !== null && peer.roe === null)
						peer.roe = enriched.roe;
					if (enriched.pe !== null && peer.pe === null) peer.pe = enriched.pe;
					if (enriched.pb !== null && peer.pb === null) peer.pb = enriched.pb;
					if (
						peer.pb === null &&
						peer.price !== null &&
						enriched.bookValue &&
						enriched.bookValue > 0
					) {
						peer.pb = Math.round((peer.price / enriched.bookValue) * 100) / 100;
					}
				} catch {
					/* already logged inside enrichPeer */
				}
			}
		}

		const finalPeers: PeerData[] = peers.map(({ _needsEnrich: _, ...p }) => p);

		// Compute live sector averages from enriched peer set + target stock
		const liveSectorAvg = computeLiveSectorAverages(
			finalPeers,
			cleanSym,
			targetROE,
			targetPE,
			targetPB,
		);
		// Fetch ROCE and D/E averages from DB (not live-enriched, but acceptable for those fields)
		try {
			const res2 = await db.execute(sql`
        SELECT
          ROUND(AVG(CASE WHEN sf.roce BETWEEN 0.01 AND 0.8 THEN sf.roce END)::numeric, 4) AS avg_roce,
          ROUND(AVG(CASE WHEN sf.debt_to_equity BETWEEN 0 AND 5 THEN sf.debt_to_equity END)::numeric, 2) AS avg_de
        FROM screener_financials sf
        INNER JOIN listed_stocks ls ON ls.symbol = sf.symbol
        WHERE (
          (${effectiveSector} IS NOT NULL AND ls.sector = ${effectiveSector})
          OR (${effectiveSector} IS NULL AND ${effectiveIndustry} IS NOT NULL AND ls.industry = ${effectiveIndustry})
        )
      `);
			const r1 = ((res2 as any).rows ?? res2)[0] as any;
			if (r1) {
				if (r1.avg_roce) liveSectorAvg.avgROCE = Number.parseFloat(r1.avg_roce);
				if (r1.avg_de) liveSectorAvg.avgDE = Number.parseFloat(r1.avg_de);
			}
		} catch {
			/* non-critical */
		}

		peersCache.set(cacheKey, {
			data: finalPeers,
			sectorAvg: liveSectorAvg,
			expiresAt: Date.now() + CACHE_TTL,
		});

		const avgRoeStr =
			liveSectorAvg.avgROE !== null
				? (liveSectorAvg.avgROE * 100).toFixed(1) + "%"
				: "N/A";
		console.log(
			`[ResearchNote] Peers for ${resolvedSector}: ${finalPeers.map((p) => `${p.symbol}(ROE:${p.roe !== null ? (p.roe * 100).toFixed(1) + "%" : "N/A"},PE:${p.pe ?? "N/A"},Analyst:${p.analystRating ?? "—"})`).join(", ")} | SectorAvg ROE:${avgRoeStr} PE:${liveSectorAvg.avgPE ?? "N/A"}`,
		);

		return { peers: finalPeers, sectorAvg: liveSectorAvg };
	} catch (e: any) {
		console.warn(`[ResearchNote] fetchPeersAndAverage failed:`, e?.message);
		return empty;
	}
}

// Keep old exports as thin wrappers for backward compatibility
export async function fetchPeers(
	sector: string | null,
	excludeSymbol: string,
): Promise<PeerData[]> {
	const result = await fetchPeersAndAverage(
		sector,
		excludeSymbol,
		null,
		null,
		null,
	);
	return result.peers;
}

export async function fetchSectorAverages(
	sector: string | null,
): Promise<SectorAverages> {
	const empty: SectorAverages = {
		avgPE: null,
		avgPB: null,
		avgROE: null,
		avgROCE: null,
		avgDE: null,
		stockCount: 0,
	};
	if (!sector) return empty;
	try {
		const res = await db.execute(sql`
      SELECT
        ROUND(AVG(CASE WHEN pe_ratio BETWEEN 2 AND 150 THEN pe_ratio END)::numeric, 1) AS avg_pe,
        ROUND(AVG(CASE WHEN pb_ratio BETWEEN 0.2 AND 30 THEN pb_ratio END)::numeric, 2) AS avg_pb,
        COUNT(*) AS stock_count
      FROM listed_stocks
      WHERE sector = ${sector} AND is_active = true
    `);
		const r0 = ((res as any).rows ?? res)[0] as any;
		const res2 = await db.execute(sql`
      SELECT
        ROUND(AVG(CASE WHEN sf.roe BETWEEN 0.01 AND 0.8 THEN sf.roe END)::numeric, 4) AS avg_roe,
        ROUND(AVG(CASE WHEN sf.roce BETWEEN 0.01 AND 0.8 THEN sf.roce END)::numeric, 4) AS avg_roce,
        ROUND(AVG(CASE WHEN sf.debt_to_equity BETWEEN 0 AND 5 THEN sf.debt_to_equity END)::numeric, 2) AS avg_de
      FROM screener_financials sf
      INNER JOIN listed_stocks ls ON ls.symbol = sf.symbol
      WHERE ls.sector = ${sector}
    `);
		const r1 = ((res2 as any).rows ?? res2)[0] as any;
		const pf = (v: any) =>
			v !== null && v !== undefined ? Number.parseFloat(v) : null;
		return {
			avgPE: pf(r0?.avg_pe),
			avgPB: pf(r0?.avg_pb),
			avgROE: pf(r1?.avg_roe),
			avgROCE: pf(r1?.avg_roce),
			avgDE: pf(r1?.avg_de),
			stockCount: Number.parseInt(r0?.stock_count ?? "0"),
		};
	} catch (e: any) {
		console.warn(`[ResearchNote] fetchSectorAverages failed:`, e?.message);
		return empty;
	}
}
