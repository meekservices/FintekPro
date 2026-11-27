import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
	amount: number;
	currency: string;
	showSymbol?: boolean;
	compact?: boolean;
	colorSign?: boolean;
	className?: string;
}

const CURRENCY_LOCALES: Record<string, string> = {
	USD: "en-US",
	EUR: "de-DE",
	GBP: "en-GB",
	INR: "en-IN",
	JPY: "ja-JP",
	AUD: "en-AU",
	CAD: "en-CA",
	SGD: "en-SG",
	AED: "ar-AE",
};

/** Formats large Indian currency numbers into institutional Lakhs/Crores */
function formatIndianCompact(val: number, symbol: string): string {
	const absVal = Math.abs(val);
	const sign = val < 0 ? "-" : "";
	if (absVal >= 10000000) {
		return `${sign}${symbol}${(absVal / 10000000).toFixed(2)} Cr`;
	}
	if (absVal >= 100000) {
		return `${sign}${symbol}${(absVal / 100000).toFixed(2)} L`;
	}
	if (absVal >= 1000) {
		return `${sign}${symbol}${(absVal / 1000).toFixed(1)} K`;
	}
	return `${sign}${symbol}${absVal.toFixed(2)}`;
}

export function CurrencyDisplay({
	amount,
	currency,
	showSymbol = true,
	compact = false,
	colorSign = false,
	className,
}: CurrencyDisplayProps) {
	const locale = CURRENCY_LOCALES[currency] || "en-US";
	const symbol = showSymbol ? (currency === "INR" ? "₹" : currency === "USD" ? "$" : "") : "";

	let formattedAmount: string;
	if (compact && currency === "INR") {
		formattedAmount = formatIndianCompact(amount, symbol);
	} else {
		formattedAmount = new Intl.NumberFormat(locale, {
			style: showSymbol ? "currency" : "decimal",
			currency: currency,
			minimumFractionDigits: currency === "JPY" ? 0 : 2,
			maximumFractionDigits: currency === "JPY" ? 0 : 2,
		}).format(amount);
	}

	const colorClass = colorSign
		? amount > 0
			? "text-emerald-600 dark:text-emerald-400"
			: amount < 0
				? "text-rose-600 dark:text-rose-400"
				: ""
		: "";

	return (
		<span
			className={cn(
				"font-medium tabular-nums font-mono",
				colorClass,
				className,
			)}
			data-testid="currency-display"
		>
			{formattedAmount}
		</span>
	);
}
