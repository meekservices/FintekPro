/**
 * Sector Consolidation Utility
 * Re-exports shared taxonomy and adds server-specific risk & allocation calculation helpers.
 */

export * from "@shared/sector-taxonomy";
import {
	BROAD_SECTORS,
	type BroadSector,
	SECTOR_MAPPING,
} from "@shared/sector-taxonomy";

/**
 * Get all broad sectors with their count of mapped granular sectors
 */
export function getBroadSectorStats(): Record<BroadSector, string[]> {
	const stats: Record<BroadSector, string[]> = {} as Record<
		BroadSector,
		string[]
	>;

	for (const sector of BROAD_SECTORS) {
		stats[sector] = [];
	}

	for (const [granular, broad] of Object.entries(SECTOR_MAPPING)) {
		stats[broad].push(granular);
	}

	return stats;
}

/**
 * Get risk level for a broad sector
 */
export function getSectorRiskLevel(
	broadSector: BroadSector,
): "Low" | "Moderate" | "High" | "Very High" {
	const riskMap: Record<
		BroadSector,
		"Low" | "Moderate" | "High" | "Very High"
	> = {
		"Banking & Finance": "Moderate",
		"Healthcare & Pharma": "Moderate",
		Technology: "High",
		"Consumer Goods & Retail": "Moderate",
		"Energy & Utilities": "Moderate",
		"Infrastructure & Construction": "High",
		Manufacturing: "Moderate",
		"Metals & Mining": "High",
		Chemicals: "High",
		"Real Estate": "Very High",
		Services: "Moderate",
		Others: "High",
	};

	return riskMap[broadSector] || "Moderate";
}

/**
 * Get recommended allocation for a broad sector based on risk profile
 */
export function getSectorAllocationWeight(
	broadSector: BroadSector,
	riskProfile: "conservative" | "moderate" | "aggressive",
): number {
	const allocations: Record<string, Record<BroadSector, number>> = {
		conservative: {
			"Banking & Finance": 25,
			"Healthcare & Pharma": 15,
			Technology: 10,
			"Consumer Goods & Retail": 20,
			"Energy & Utilities": 10,
			"Infrastructure & Construction": 5,
			Manufacturing: 5,
			"Metals & Mining": 2,
			Chemicals: 3,
			"Real Estate": 2,
			Services: 3,
			Others: 0,
		},
		moderate: {
			"Banking & Finance": 20,
			"Healthcare & Pharma": 12,
			Technology: 18,
			"Consumer Goods & Retail": 12,
			"Energy & Utilities": 8,
			"Infrastructure & Construction": 8,
			Manufacturing: 8,
			"Metals & Mining": 5,
			Chemicals: 4,
			"Real Estate": 3,
			Services: 2,
			Others: 0,
		},
		aggressive: {
			"Banking & Finance": 15,
			"Healthcare & Pharma": 10,
			Technology: 25,
			"Consumer Goods & Retail": 8,
			"Energy & Utilities": 5,
			"Infrastructure & Construction": 10,
			Manufacturing: 10,
			"Metals & Mining": 8,
			Chemicals: 5,
			"Real Estate": 4,
			Services: 0,
			Others: 0,
		},
	};

	return allocations[riskProfile]?.[broadSector] ?? 0;
}
