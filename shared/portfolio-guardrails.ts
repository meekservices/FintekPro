/**
 * @file portfolio-guardrails.ts
 * @description FintekPro FASP-AI v3.0 & APRE §5.2 Quantitative Allocation Guardrails
 * Single source of truth for AI portfolio strategy weight allocation and concentration limits.
 */

export interface RiskGuardLimits {
	maxSingleWeight: number;
	maxSectorWeight: number;
	minFloor: number;
	label: string;
}

export interface PortfolioStockCandidate {
	id: string | number;
	symbol: string;
	companyName?: string;
	sector?: string;
	confidence?: number;
	[key: string]: any;
}

/**
 * Returns calibrated concentration limits by risk profile and basket size.
 */
export function getRiskGuardLimits(
	riskProfile: string = "moderate",
	basketSize: number = 4,
): RiskGuardLimits {
	const p = (riskProfile || "moderate").toLowerCase();
	if (basketSize <= 1) {
		return { maxSingleWeight: 100, maxSectorWeight: 100, minFloor: 100, label: "Single Holding" };
	}
	if (basketSize === 2) {
		return { maxSingleWeight: 60, maxSectorWeight: 75, minFloor: 15, label: "2-Stock Pair" };
	}
	if (basketSize === 3) {
		return { maxSingleWeight: 40, maxSectorWeight: 60, minFloor: 10, label: "3-Stock Basket" };
	}

	if (p.includes("conservative") || p.includes("low")) {
		return { maxSingleWeight: 30, maxSectorWeight: 45, minFloor: 5, label: "Conservative (APRE §5.2)" };
	}
	if (p.includes("high")) {
		return { maxSingleWeight: 15, maxSectorWeight: 30, minFloor: 2, label: "High Risk (APRE §5.2)" };
	}
	if (p.includes("aggressive")) {
		return { maxSingleWeight: 20, maxSectorWeight: 35, minFloor: 3, label: "Aggressive (APRE §5.2)" };
	}
	// Default: Moderate / All-Weather
	return { maxSingleWeight: 25, maxSectorWeight: 40, minFloor: 4, label: "Moderate (APRE §5.2)" };
}

/**
 * Computes guarded portfolio weights adhering to:
 * 1. Single asset concentration cap (APRE §5.2 / SEBI PMS)
 * 2. Sector concentration cap (max 30-45% per sector)
 * 3. Minimum position floor (prevents micro-allocations)
 * 4. Pure deterministic normalization to exact 100.00%
 */
export function computeGuardedPortfolioWeights(
	stocks: PortfolioStockCandidate[],
	riskProfile: string = "moderate",
): Record<string, number> {
	if (!stocks || stocks.length === 0) return {};
	const n = stocks.length;
	const idOf = (s: PortfolioStockCandidate) => String(s.id ?? s.symbol);
	if (n === 1) return { [idOf(stocks[0])]: 100 };

	const limits = getRiskGuardLimits(riskProfile, n);
	const rawWeights = stocks.map((s) => Math.max(10, Number(s.confidence) || 70));
	const sumRaw = rawWeights.reduce((a, b) => a + b, 0) || 1;
	let normalized = rawWeights.map((w) => (w / sumRaw) * 100);

	const uniqueSectors = new Set(stocks.map((s) => s.sector || "General"));
	const hasMultipleSectors = uniqueSectors.size > 1;

	// Determine feasible sector cap (must be at least 100 / uniqueSectors.size)
	const effectiveSectorCap = hasMultipleSectors
		? Math.max(limits.maxSectorWeight, Math.ceil(100 / uniqueSectors.size) + 5)
		: 100;

	// Calculates exact allowable headroom taking BOTH single-stock and sector limits into account
	const getEffectiveHeadroom = (idx: number, cur: number[]) => {
		const singleHeadroom = Math.max(0, limits.maxSingleWeight - cur[idx]);
		if (!hasMultipleSectors) return singleHeadroom;

		const sec = stocks[idx].sector || "General";
		const secTotal = cur.reduce(
			(acc, w, j) => ((stocks[j].sector || "General") === sec ? acc + w : acc),
			0,
		);
		const sectorHeadroom = Math.max(0, effectiveSectorCap - secTotal);
		return Math.min(singleHeadroom, sectorHeadroom);
	};

	const distributeExcess = (indices: number[], excess: number) => {
		if (indices.length === 0 || excess <= 0.001) return;
		let rem = excess;
		for (let iter = 0; iter < 4 && rem > 0.001; iter++) {
			const headrooms = indices.map((i) => getEffectiveHeadroom(i, normalized));
			const totalHeadroom = headrooms.reduce((acc, h) => acc + h, 0);
			if (totalHeadroom <= 0.001) break;

			const allocated = Math.min(rem, totalHeadroom);
			indices.forEach((idx, pos) => {
				const h = headrooms[pos];
				if (h > 0.001) {
					const share = (h / totalHeadroom) * allocated;
					normalized[idx] += share;
				}
			});
			rem -= allocated;
		}
	};

	// Multi-pass iterative capping
	for (let pass = 0; pass < 5; pass++) {
		// Guardrail 1: Single asset concentration cap
		let singleExcess = 0;
		normalized = normalized.map((w) => {
			if (w > limits.maxSingleWeight) {
				singleExcess += w - limits.maxSingleWeight;
				return limits.maxSingleWeight;
			}
			return w;
		});

		const uncappedIndices = normalized
			.map((w, idx) => (w < limits.maxSingleWeight ? idx : -1))
			.filter((idx) => idx !== -1);
		distributeExcess(uncappedIndices, singleExcess);

		// Guardrail 2: Sector Concentration Cap
		if (hasMultipleSectors) {
			const sectorTotals: Record<string, number> = {};
			stocks.forEach((s, idx) => {
				const sec = s.sector || "General";
				sectorTotals[sec] = (sectorTotals[sec] || 0) + normalized[idx];
			});

			let sectorExcess = 0;
			const cappedSectors = new Set<string>();
			for (const [sec, total] of Object.entries(sectorTotals)) {
				if (total > effectiveSectorCap) {
					sectorExcess += total - effectiveSectorCap;
					cappedSectors.add(sec);
					const scale = effectiveSectorCap / total;
					stocks.forEach((s, idx) => {
						if ((s.sector || "General") === sec) {
							normalized[idx] *= scale;
						}
					});
				}
			}

			if (sectorExcess > 0) {
				const nonCappedIndices = stocks
					.map((s, idx) => (!cappedSectors.has(s.sector || "General") ? idx : -1))
					.filter((idx) => idx !== -1);
				distributeExcess(nonCappedIndices, sectorExcess);
			}
		}

		// Guardrail 3: Minimum Position Floor
		if (n * limits.minFloor <= 90) {
			let floorDeficit = 0;
			normalized = normalized.map((w) => {
				if (w < limits.minFloor) {
					floorDeficit += limits.minFloor - w;
					return limits.minFloor;
				}
				return w;
			});

			const aboveFloorIndices = normalized
				.map((w, idx) => (w > limits.minFloor + 1 ? idx : -1))
				.filter((idx) => idx !== -1);
			if (aboveFloorIndices.length > 0 && floorDeficit > 0) {
				const totalSurplus = aboveFloorIndices.reduce(
					(acc, idx) => acc + (normalized[idx] - limits.minFloor),
					0,
				);
				if (totalSurplus > 0) {
					aboveFloorIndices.forEach((idx) => {
						const surplus = normalized[idx] - limits.minFloor;
						const deduction = (surplus / totalSurplus) * floorDeficit;
						normalized[idx] = Math.max(limits.minFloor, normalized[idx] - deduction);
					});
				}
			}
		}
	}

	// Final reconciliation to exact 100% respecting effective headroom
	const curSum = normalized.reduce((a, b) => a + b, 0);
	if (curSum < 100 - 0.001) {
		const eligible = normalized.map((_, idx) => idx);
		distributeExcess(eligible, 100 - curSum);
	}

	// Final exact penny-rounding adjustment so sum is precisely 100.00
	const weightMap: Record<string, number> = {};
	let runningTotal = 0;
	stocks.forEach((s, idx) => {
		const key = idOf(s);
		if (idx === n - 1) {
			const remainder = parseFloat((100 - runningTotal).toFixed(2));
			weightMap[key] = Math.min(limits.maxSingleWeight, Math.max(limits.minFloor, remainder));
		} else {
			const val = parseFloat(normalized[idx].toFixed(2));
			weightMap[key] = val;
			runningTotal += val;
		}
	});

	// If there's any penny rounding difference, resolve it safely
	const finalSum = Object.values(weightMap).reduce((a, b) => a + b, 0);
	const delta = parseFloat((100 - finalSum).toFixed(2));
	if (Math.abs(delta) > 0.001) {
		const sortedKeys = [...stocks]
			.map((s) => idOf(s))
			.sort((a, b) => (delta > 0 ? weightMap[a] - weightMap[b] : weightMap[b] - weightMap[a]));
		for (const k of sortedKeys) {
			const idx = stocks.findIndex((s) => idOf(s) === k);
			const h = getEffectiveHeadroom(idx, Object.values(weightMap));
			if (delta > 0 && h >= delta) {
				weightMap[k] = parseFloat((weightMap[k] + delta).toFixed(2));
				break;
			} else if (delta < 0 && weightMap[k] + delta >= limits.minFloor) {
				weightMap[k] = parseFloat((weightMap[k] + delta).toFixed(2));
				break;
			}
		}
	}

	return weightMap;
}
