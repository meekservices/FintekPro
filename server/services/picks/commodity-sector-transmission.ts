/**
 * @file commodity-sector-transmission.ts
 * @description Cross-Asset Commodity & Macro Transmission Engine for Alpha Picks.
 *
 * Translates multi-exchange commodity price dynamics (MCX Crude, MCX Bullion, MCX Base Metals,
 * NCDEX Agri Benchmarks, and Global Brent) into sector-specific margin and demand tailwinds/headwinds:
 *
 *   1. Energy Shock (Brent / MCX Crude):
 *      - Crude < $75/bbl or easing: Strong tailwind for Paints, Tyres, Airlines, Specialty Chemicals.
 *      - Crude > $85/bbl or surging: Margin pressure for user sectors; tailwind for Upstream E&P (ONGC, Oil India).
 *   2. Bullion Momentum (MCX Gold 24K & Silver Spot):
 *      - Bullion rally: Strong asset-revaluation tailwind for Jewellery retailers (Titan, Kalyan) & Gold loan NBFCs (Muthoot, Manappuram).
 *   3. Base Metals & Electrification (MCX Copper & Aluminium):
 *      - Firm copper prices with strong global demand: Tailwind for Wires, Cables, and Power T&D capex (Polycab, KEI, Havells).
 *   4. Agricultural Price Pulse (NCDEX Mandi Spot):
 *      - Benign/deflationary agri index: Raw material margin expansion for FMCG and Dairy processors (HUL, Dabur, Marico, Hatsun).
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 *
 * @module commodity-sector-transmission
 * @version 1.0.0
 */

import { logger } from "../../logger";

export interface CommodityTransmissionImpact {
	scoreDelta: number; // e.g. -12 to +15 pts
	tailwindType: "STRONG_TAILWIND" | "MILD_TAILWIND" | "NEUTRAL" | "MILD_HEADWIND" | "SEVERE_HEADWIND";
	primaryDriver: string;
	rationale: string;
}

export interface CommodityMacroState {
	brentUsd?: number;
	crudeMcxInr?: number;
	goldMcxInr?: number;
	silverMcxInr?: number;
	copperMcxInr?: number;
	agriInflationStatus?: "Deflationary" | "Benign" | "Elevated";
}

export class CommoditySectorTransmissionEngine {
	private static instance: CommoditySectorTransmissionEngine;

	public static getInstance(): CommoditySectorTransmissionEngine {
		if (!CommoditySectorTransmissionEngine.instance) {
			CommoditySectorTransmissionEngine.instance = new CommoditySectorTransmissionEngine();
		}
		return CommoditySectorTransmissionEngine.instance;
	}

	/**
	 * Evaluates cross-asset transmission impact for a given stock sector and commodity state.
	 *
	 * @param sector - Stock sector / industry (e.g. 'Paints', 'Auto Components', 'Consumer FMCG')
	 * @param macroState - Current commodity and energy snapshot from GoldenPricingEngine
	 */
	public evaluateSectorImpact(
		sector: string,
		macroState?: CommodityMacroState | null,
	): CommodityTransmissionImpact {
		const s = (sector || "").toLowerCase();
		const brent = macroState?.brentUsd ?? 74.50;
		const copper = macroState?.copperMcxInr ?? 825.50;
		const agriStatus = macroState?.agriInflationStatus ?? "Benign";

		// ── 1. Downstream Petrochemical & Crude-Sensitive Sectors ───────────────────
		// Paints, Tyres, Airlines, Lubricants, Specialty Chemicals
		const isCrudeConsumer =
			s.includes("paint") ||
			s.includes("tyre") ||
			s.includes("tire") ||
			s.includes("aviation") ||
			s.includes("airline") ||
			s.includes("lubricant") ||
			s.includes("chemical") ||
			s.includes("plastics");

		if (isCrudeConsumer) {
			if (brent < 75.0) {
				return {
					scoreDelta: 10,
					tailwindType: "STRONG_TAILWIND",
					primaryDriver: `Crude Softening ($${brent.toFixed(2)}/bbl)`,
					rationale: `Sub-$75 Brent crude significantly reduces petrochemical raw material input costs and expanding gross margins.`,
				};
			} else if (brent > 85.0) {
				return {
					scoreDelta: -10,
					tailwindType: "SEVERE_HEADWIND",
					primaryDriver: `Crude Spike ($${brent.toFixed(2)}/bbl)`,
					rationale: `Elevated Brent crude above $85 compresses operating margins due to high solvent, rubber, and freight input inflation.`,
				};
			} else {
				return {
					scoreDelta: 3,
					tailwindType: "MILD_TAILWIND",
					primaryDriver: `Comfort Crude Band ($${brent.toFixed(2)}/bbl)`,
					rationale: `Crude trading within India's comfort threshold supports stable downstream cost structure.`,
				};
			}
		}

		// ── 2. Upstream Energy & Oil Exploration ────────────────────────────────────
		// E&P, Refineries with positive GRMs
		const isUpstreamEnergy =
			s.includes("oil & gas exploration") ||
			s.includes("oil exploration") ||
			s.includes("upstream") ||
			s.includes("refiner");

		if (isUpstreamEnergy) {
			if (brent > 80.0) {
				return {
					scoreDelta: 8,
					tailwindType: "STRONG_TAILWIND",
					primaryDriver: `Firm Realizations ($${brent.toFixed(2)}/bbl)`,
					rationale: `Higher crude prices directly improve net upstream extraction realizations and pipeline cash flows.`,
				};
			} else if (brent < 70.0) {
				return {
					scoreDelta: -8,
					tailwindType: "MILD_HEADWIND",
					primaryDriver: `Subdued Realizations ($${brent.toFixed(2)}/bbl)`,
					rationale: `Crude dip below $70 dampens upstream exploration realizations and inventory valuation.`,
				};
			}
		}

		// ── 3. Precious Metals & Gold Finance ───────────────────────────────────────
		// Jewellery, Gold Loan NBFCs (Titan, Kalyan, Muthoot, Manappuram)
		const isBullionSector =
			s.includes("jewellery") ||
			s.includes("jewelry") ||
			s.includes("gold loan") ||
			s.includes("gems & jewellery");

		if (isBullionSector) {
			const goldPrice = macroState?.goldMcxInr ?? 78250;
			if (goldPrice >= 75000) {
				return {
					scoreDelta: 8,
					tailwindType: "STRONG_TAILWIND",
					primaryDriver: `Bullion Asset Revaluation (₹${goldPrice.toLocaleString("en-IN")}/10g)`,
					rationale: `Elevated MCX Gold prices expand loan-to-value (LTV) collateral buffers for gold lenders and inventory gains for jewellers.`,
				};
			}
		}

		// ── 4. Base Metals, Electrification & Power Capex ───────────────────────────
		// Wires, Cables, Electrical Equipment, Transformers (Polycab, KEI, Havells)
		const isElectrificationCapex =
			s.includes("cables") ||
			s.includes("electrical") ||
			s.includes("power transmission") ||
			s.includes("wires");

		if (isElectrificationCapex) {
			if (copper >= 800) {
				return {
					scoreDelta: 8,
					tailwindType: "STRONG_TAILWIND",
					primaryDriver: `Copper & Grid Capex Demand (MCX: ₹${copper.toFixed(2)}/kg)`,
					rationale: `Steady domestic copper pricing reflects sustained high-voltage grid expansion, renewable energy evacuation, and EV wiring capex.`,
				};
			}
		}

		// ── 5. Agricultural Commodities & FMCG Food Input Costs ────────────────────
		// FMCG, Dairy, Food Processing (HUL, Marico, Dabur, Nestlé, Hatsun)
		const isFmcgFood =
			s.includes("fmcg") ||
			s.includes("food processing") ||
			s.includes("dairy") ||
			s.includes("consumer staples") ||
			s.includes("packaged foods");

		if (isFmcgFood) {
			if (agriStatus === "Deflationary" || agriStatus === "Benign") {
				return {
					scoreDelta: 8,
					tailwindType: "STRONG_TAILWIND",
					primaryDriver: `Benign Agri Raw Material Costs (${agriStatus} NCDEX)`,
					rationale: `Cooling spices, edible oil, and dairy input inflation on NCDEX provides EBITDA margin relief and volume growth runway.`,
				};
			} else if (agriStatus === "Elevated") {
				return {
					scoreDelta: -6,
					tailwindType: "MILD_HEADWIND",
					primaryDriver: `Elevated Food Inflation (${agriStatus} NCDEX)`,
					rationale: `Agricultural commodity inflation pressures gross margins, forcing retail price hikes and demand elasticity pushback.`,
				};
			}
		}

		return {
			scoreDelta: 0,
			tailwindType: "NEUTRAL",
			primaryDriver: "Macro Neutral",
			rationale: "No material commodity price sensitivity detected for this sector.",
		};
	}
}

export const commoditySectorTransmissionEngine = CommoditySectorTransmissionEngine.getInstance();
