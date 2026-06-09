import axios from "axios";
import { getSharedNseHeaders } from "./dataService";

export interface ResolvedCompany {
	symbol: string;
	name: string;
	exchange: string;
	sector?: string;
}

export interface ExternalSearchResult {
	symbol: string;
	company_name: string;
	sector: string | null;
	exchange: string;
	isin: null;
	nse_code: string | null;
	bse_code: string | null;
	cin: null;
	type: "external";
}

export async function resolveCompany(query: string): Promise<ResolvedCompany> {
	const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=IN&quotesCount=5&newsCount=0`;

	try {
		const res = await axios.get(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
			timeout: 8000,
		});

		const quotes = res.data?.quotes || [];
		if (!quotes.length) {
			throw new Error(`No results found for: ${query}`);
		}

		const stock = quotes[0];
		return {
			symbol: stock.symbol,
			name: stock.shortname || stock.longname || query,
			exchange: stock.exchange || "NSE",
			sector: stock.sector || undefined,
		};
	} catch (err: any) {
		if (err.message?.startsWith("No results")) throw err;
		const nseSymbol = query.toUpperCase().replace(/\.NS$/, "") + ".NS";
		return {
			symbol: nseSymbol,
			name: query,
			exchange: "NSE",
		};
	}
}

/**
 * Search external sources (NSE autocomplete → Yahoo Finance) for stocks/InvITs/REITs.
 * Used as a fallback when the local DB returns sparse results.
 * Returns candidates in a shape compatible with the /search endpoint response.
 */
export async function searchExternal(
	q: string,
): Promise<ExternalSearchResult[]> {
	const results: ExternalSearchResult[] = [];
	const seen = new Set<string>();

	// ── 1. NSE Autocomplete ────────────────────────────────────────────────────
	try {
		const headers = await getSharedNseHeaders();
		const url = `https://www.nseindia.com/api/search/autocomplete?q=${encodeURIComponent(q)}&type=EQ`;
		const res = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(4000),
		});
		if (res.ok) {
			const data = (await res.json()) as any;
			const symbols: any[] = data?.symbols ?? [];
			for (const s of symbols.slice(0, 8)) {
				const sym: string = (s.symbol ?? s.data ?? "").toUpperCase();
				const name: string = s.symbol_info ?? s.company_name ?? s.name ?? sym;
				if (!sym || seen.has(sym)) continue;
				seen.add(sym);
				results.push({
					symbol: sym,
					company_name: name,
					sector: s.industry ?? s.sector ?? null,
					exchange: "NSE",
					isin: null,
					nse_code: "EQ",
					bse_code: null,
					cin: null,
					type: "external",
				});
			}
		}
	} catch {
		// NSE autocomplete is best-effort
	}

	// ── 2. Yahoo Finance search (fills gaps NSE misses — BSE-only, REITs, InvITs) ──
	if (results.length < 5) {
		try {
			const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=IN&quotesCount=8&newsCount=0&enableFuzzyQuery=false`;
			const res = await axios.get(url, {
				headers: { "User-Agent": "Mozilla/5.0" },
				timeout: 5000,
			});
			const quotes: any[] = res.data?.quotes ?? [];
			for (const s of quotes) {
				const rawSym: string = s.symbol ?? "";
				if (!rawSym) continue;
				// Normalise to clean ticker (strip .NS / .BO) for dedup, keep suffix for lookup
				const cleanSym = rawSym.replace(/\.(NS|BO)$/i, "").toUpperCase();
				if (seen.has(cleanSym)) continue;
				// Only include Indian exchange results
				const exchRaw: string = (s.exchange ?? "").toUpperCase();
				if (!["NSI", "BSE", "BSI", "BOM"].some((x) => exchRaw.includes(x)))
					continue;
				seen.add(cleanSym);
				const isBse =
					rawSym.toUpperCase().endsWith(".BO") ||
					["BSE", "BSI", "BOM"].some((x) => exchRaw.includes(x));
				results.push({
					symbol: cleanSym,
					company_name: s.shortname || s.longname || cleanSym,
					sector: s.sector ?? null,
					exchange: isBse ? "BSE" : "NSE",
					isin: null,
					nse_code: isBse ? null : "EQ",
					bse_code: isBse ? s.symbol?.replace(/\.BO$/i, "") ?? null : null,
					cin: null,
					type: "external",
				});
			}
		} catch {
			// Yahoo Finance is best-effort
		}
	}

	return results;
}
