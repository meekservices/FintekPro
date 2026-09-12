/**
 * String Utilities for Alpaca Compliance
 *
 * Alpaca's Broker API requires ASCII (32-126) for core identity data.
 */

/**
 * Normalizes a string to ASCII by:
 * 1. Decomposing Unicode (NFD) to separate base characters from accents.
 * 2. Removing non-spacing marks (accents).
 * 3. Removing any remaining non-ASCII characters.
 * 4. Trimming whitespace.
 */
export function toAlpacaAscii(str: string): string {
	if (!str) return "";

	// 1. Normalize to NFD (Canonical Decomposition)
	// This turns 'é' into 'e' + '́'
	const normalized = str.normalize("NFD");

	// 2. Remove non-spacing marks (U+0300 to U+036F)
	// and keep only ASCII 32-126
	let result = "";
	for (let i = 0; i < normalized.length; i++) {
		const code = normalized.charCodeAt(i);
		// ASCII range 32-126
		if (code >= 32 && code <= 126) {
			result += normalized[i];
		}
	}

	return result.trim();
}

/**
 * Specifically cleans alphanumeric strings like Tax IDs or Postal Codes.
 */
export function cleanAlphanumeric(str: string): string {
	if (!str) return "";
	return str.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Normalizes company names to eliminate duplicate cards and listings.
 * Handles corporate entity suffixes (Ltd, Limited, Pvt Ltd), parenthetical aliases,
 * exchange/product markers, and canonical name aliases.
 *
 * Examples:
 * - "Tata Play Ltd" & "Tata Play" -> "tataplay"
 * - "Boat Lifestyle (Imagine Marketing Ltd)" & "Imagine Marketing Ltd" -> "boatlifestyle"
 * - "National Stock Exchange of India (NSE)" & "NSE" -> "nse"
 * - "Lenskart Solutions Ltd" & "Lenskart" -> "lenskart"
 */
export function normalizeCompanyName(name: string): string {
	if (!name) return "";
	const lower = name.toLowerCase().trim();

	// Canonical mapping for well-known pre-IPO and unlisted market companies
	if (lower.includes("tata play")) return "tataplay";
	if (lower.includes("boat") || lower.includes("imagine marketing")) return "boatlifestyle";
	if (lower.includes("lenskart")) return "lenskart";
	if (lower.includes("national stock exchange") || lower.includes(" nse ") || lower.startsWith("nse ") || lower === "nse") return "nse";
	if (lower.includes("bagmane")) return "bagmaneprimeofficereit";
	if (lower.includes("swiggy")) return "swiggy";
	if (lower.includes("ola electric") || lower.includes("ola consumer") || lower.includes("ola")) return "ola";
	if (lower.includes("firstcry") || lower.includes("brainbees")) return "firstcry";
	if (lower.includes("reliance retail") || lower.includes("jio platforms") || lower.includes("reliance jio")) return "reliancejio";
	if (lower.includes("veegaland")) return "veegaland";
	if (lower.includes("shakti polytarp")) return "shaktipolytarp";
	if (lower.includes("manika plastech")) return "manikaplastech";
	if (lower.includes("vama wovenfab") || lower.includes("vama")) return "vamawovenfab";
	if (lower.includes("century business")) return "centurybusiness";
	if (lower.includes("injecto polymer")) return "injectopolymers";
	if (lower.includes("om galaxy")) return "omgalaxy";
	if (lower.includes("raksan transformer")) return "raksantransformers";
	if (lower.includes("speedex")) return "speedex";
	if (lower.includes("panchatv")) return "panchatv";

	return lower
		.replace(/\([^)]*\)/g, "")
		.replace(/\b(ltd|limited|pvt|private|corp|corporation|inc|incorporated|llp|holdings|holding|services|service|technologies|technology|solutions|solution|india|company|co)\b/gi, "")
		.replace(/\b(proposed|bse|nse|reit)\b/gi, "")
		.replace(/[^a-z0-9]/g, "")
		.trim();
}
