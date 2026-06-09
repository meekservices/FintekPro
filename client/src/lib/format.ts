/**
 * @file format.ts
 * @description Centralised number / currency / date formatting utilities.
 *
 * Previously, each page/component defined its own inline `formatCurrency` function
 * (20+ copies found in the codebase). Import from here instead.
 *
 * Usage:
 *   import { formatCurrency, formatINR, formatPercent, formatDate } from "@/lib/format";
 */

// ─── Currency ────────────────────────────────────────────────────────────────

/**
 * Formats a number as Indian Rupees using compact Indian notation.
 * - ≥ 1 Crore  → "₹X.XX Cr"
 * - ≥ 1 Lakh   → "₹X.XX L"
 * - < 1 Lakh   → "₹X,XX,XXX" (full Intl.NumberFormat en-IN)
 *
 * @param amount - The numeric value to format (undefined/NaN → "₹0")
 * @param decimals - Decimal places for Cr/L suffix (default 2)
 */
export function formatCurrency(
	amount: number | string | undefined | null,
	decimals = 2,
): string {
	const n =
		typeof amount === "string" ? Number.parseFloat(amount) : amount ?? 0;
	if (!Number.isFinite(n)) return "₹0";

	if (n >= 1_00_00_000) {
		return `₹${(n / 1_00_00_000).toFixed(decimals)} Cr`;
	}
	if (n >= 1_00_000) {
		return `₹${(n / 1_00_000).toFixed(decimals)} L`;
	}
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(n);
}

/**
 * Alias for formatCurrency — matches legacy naming used in several files.
 */
export const formatINR = formatCurrency;

/**
 * Formats a number as currency with full decimal precision (no compact suffix).
 * Useful for showing exact NAV / price values.
 */
export function formatCurrencyExact(
	amount: number | string | undefined | null,
	fractionDigits = 2,
): string {
	const n =
		typeof amount === "string" ? Number.parseFloat(amount) : amount ?? 0;
	if (!Number.isFinite(n)) return "₹0.00";
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(n);
}

// ─── Percentage ──────────────────────────────────────────────────────────────

/**
 * Formats a decimal or percentage number as a percentage string.
 * @param value     - The value (e.g. 12.5 → "12.50%", 0.125 if isDecimal → "12.50%")
 * @param isDecimal - If true, multiplies by 100 first (default false)
 * @param decimals  - Decimal places (default 2)
 */
export function formatPercent(
	value: number | string | undefined | null,
	isDecimal = false,
	decimals = 2,
): string {
	const n = typeof value === "string" ? Number.parseFloat(value) : value ?? 0;
	if (!Number.isFinite(n)) return "0.00%";
	const pct = isDecimal ? n * 100 : n;
	return `${pct.toFixed(decimals)}%`;
}

// ─── Numbers ─────────────────────────────────────────────────────────────────

/**
 * Formats a number with Indian comma grouping (no currency symbol).
 * e.g. 1234567 → "12,34,567"
 */
export function formatIndianNumber(
	value: number | string | undefined | null,
): string {
	const n = typeof value === "string" ? Number.parseFloat(value) : value ?? 0;
	if (!Number.isFinite(n)) return "0";
	return new Intl.NumberFormat("en-IN").format(n);
}

/**
 * Compact label for large numbers — no rupee symbol.
 * e.g. 1_50_00_000 → "1.50 Cr", 50_000 → "50.00 K"
 */
export function formatCompactNumber(
	value: number | string | undefined | null,
	decimals = 2,
): string {
	const n = typeof value === "string" ? Number.parseFloat(value) : value ?? 0;
	if (!Number.isFinite(n)) return "0";
	if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(decimals)} Cr`;
	if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(decimals)} L`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(decimals)} K`;
	return String(n.toFixed(decimals));
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/**
 * Formats an ISO date string or Date object to dd MMM yyyy.
 * e.g. "2024-03-15" → "15 Mar 2024"
 */
export function formatDate(
	date: string | Date | undefined | null,
	locale = "en-IN",
): string {
	if (!date) return "—";
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString(locale, {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

/**
 * Returns a relative time label: "2 days ago", "Just now", etc.
 */
export function formatRelativeTime(
	date: string | Date | undefined | null,
): string {
	if (!date) return "—";
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return "—";
	const diffMs = Date.now() - d.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	const diffHours = Math.floor(diffMins / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 30) return `${diffDays}d ago`;
	return formatDate(d);
}
