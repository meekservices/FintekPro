export interface PriceLevels {
	support: number;
	resistance: number;
	stopLoss: number;
	target1: number;
	target2: number;
}

export function priceLevels(price: number): PriceLevels {
	return {
		support: Number.parseFloat((price * 0.9).toFixed(2)),
		resistance: Number.parseFloat((price * 1.15).toFixed(2)),
		stopLoss: Number.parseFloat((price * 0.85).toFixed(2)),
		target1: Number.parseFloat((price * 1.15).toFixed(2)),
		target2: Number.parseFloat((price * 1.25).toFixed(2)),
	};
}

export function weekRange52Position(
	price: number | null,
	low: number | null,
	high: number | null,
): string {
	if (!price || !low || !high) return "N/A";
	const pos = ((price - low) / (high - low)) * 100;
	if (pos < 30) return `Near 52W Low (${pos.toFixed(0)}% from bottom)`;
	if (pos > 70) return `Near 52W High (${pos.toFixed(0)}% from bottom)`;
	return `Mid Range (${pos.toFixed(0)}% from 52W Low)`;
}

export function momentumSignal(
	price: number | null,
	fiftyTwoWeekHigh: number | null,
	fiftyTwoWeekLow: number | null,
): number {
	if (!price || !fiftyTwoWeekHigh || !fiftyTwoWeekLow) return 50;
	const range = fiftyTwoWeekHigh - fiftyTwoWeekLow;
	if (range === 0) return 50;
	const pos = ((price - fiftyTwoWeekLow) / range) * 100;
	return Math.min(100, Math.max(0, pos));
}
