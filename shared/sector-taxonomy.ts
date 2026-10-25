/**
 * shared/sector-taxonomy.ts
 *
 * Comprehensive Indian Financial Market Sector & Sub-sector Taxonomy.
 * Groups 185+ granular NSE/BSE sectors into 12 canonical Macro Sectors
 * with cascading sub-sector relationships for the Multi-Product Screener,
 * Portfolio Analysis, and FASP-AI Advisory.
 */

export const MACRO_SECTORS = [
	"Banking & Finance",
	"Technology",
	"Healthcare & Pharma",
	"Manufacturing",
	"Infrastructure & Construction",
	"Consumer Goods & Retail",
	"Energy & Utilities",
	"Metals & Mining",
	"Chemicals",
	"Real Estate",
	"Services",
	"Others",
] as const;

export type Macrosector = (typeof MACRO_SECTORS)[number];
export type BroadSector = Macrosector;
export const BROAD_SECTORS = MACRO_SECTORS;

/**
 * Complete mapping of granular NSE/BSE sectors to canonical Macro Sectors
 */
export const SECTOR_MAPPING: Record<string, Macrosector> = {
	// ─── Technology ─────────────────────────────────────────────────────────────
	"Computers - Software & Consulting": "Technology",
	"IT Enabled Services": "Technology",
	"Computers Hardware & Equipments": "Technology",
	"Data Processing Services": "Technology",
	"Software Products": "Technology",
	"Business Process Outsourcing (BPO)/ Knowledge Process Outsourcing (KPO)": "Technology",
	"E-Learning": "Technology",
	"Web based media and service": "Technology",
	"Financial Technology (Fintech)": "Technology",
	"Healthcare Research Analytics & Technology": "Technology",
	"IT Services - Consulting": "Technology",
	"IT Services - Cloud & Infrastructure": "Technology",
	"AI & Data Analytics": "Technology",

	// ─── Banking & Finance ──────────────────────────────────────────────────────
	"Private Sector Bank": "Banking & Finance",
	"Public Sector Bank": "Banking & Finance",
	"Other Bank": "Banking & Finance",
	"Non Banking Financial Company (NBFC)": "Banking & Finance",
	"Housing Finance Company": "Banking & Finance",
	"Microfinance Institutions": "Banking & Finance",
	"Asset Management Company": "Banking & Finance",
	"Investment Company": "Banking & Finance",
	"Financial Institution": "Banking & Finance",
	"Financial Products Distributor": "Banking & Finance",
	"Other Financial Services": "Banking & Finance",
	"Other Capital Market related Services": "Banking & Finance",
	"Stockbroking & Allied": "Banking & Finance",
	"Depositories Clearing Houses and Other Intermediaries": "Banking & Finance",
	"Exchange and Data Platform": "Banking & Finance",
	"Ratings": "Banking & Finance",
	"Insurance Distributors": "Banking & Finance",
	"General Insurance": "Banking & Finance",
	"Life Insurance": "Banking & Finance",

	// ─── Healthcare & Pharma ────────────────────────────────────────────────────
	"Pharmaceuticals": "Healthcare & Pharma",
	"Biotechnology": "Healthcare & Pharma",
	"Hospital": "Healthcare & Pharma",
	"Healthcare Service Provider": "Healthcare & Pharma",
	"Medical Equipment & Supplies": "Healthcare & Pharma",
	"Pharmacy Retail": "Healthcare & Pharma",
	"Wellness": "Healthcare & Pharma",
	"Diagnostic Chains & Labs": "Healthcare & Pharma",
	"Active Pharmaceutical Ingredients (API)": "Healthcare & Pharma",

	// ─── Manufacturing (Automotive, Capital Goods, Engineering) ────────────────
	"Auto Components & Equipments": "Manufacturing",
	"2/3 Wheelers": "Manufacturing",
	"Commercial Vehicles": "Manufacturing",
	"Passenger Cars & Utility Vehicles": "Manufacturing",
	"Construction Vehicles": "Manufacturing",
	"Tractors": "Manufacturing",
	"Cycles": "Manufacturing",
	"Auto Dealer": "Manufacturing",
	"Heavy Electrical Equipment": "Manufacturing",
	"Other Electrical Equipment": "Manufacturing",
	"Industrial Products": "Manufacturing",
	"Other Industrial Products": "Manufacturing",
	"Compressors Pumps & Diesel Engines": "Manufacturing",
	"Abrasives & Bearings": "Manufacturing",
	"Castings & Forgings": "Manufacturing",
	"Cables - Electricals": "Manufacturing",
	"Electrodes & Refractories": "Manufacturing",
	"Consumer Electronics": "Manufacturing",
	"Household Appliances": "Manufacturing",
	"Packaging": "Manufacturing",
	"Tyres & Rubber Products": "Manufacturing",
	"Rubber": "Manufacturing",
	"Glass - Consumer": "Manufacturing",
	"Glass - Industrial": "Manufacturing",
	"Ceramics": "Manufacturing",
	"Sanitary Ware": "Manufacturing",
	"Plywood Boards/ Laminates": "Manufacturing",
	"Furniture Home Furnishing": "Manufacturing",
	"Plastic Products - Consumer": "Manufacturing",
	"Plastic Products - Industrial": "Manufacturing",
	"Aerospace & Defense": "Manufacturing",
	"Ship Building & Allied Services": "Manufacturing",
	"Railway Wagons": "Manufacturing",
	"Explosives": "Manufacturing",

	// ─── Infrastructure & Construction ─────────────────────────────────────────
	"Civil Construction": "Infrastructure & Construction",
	"Cement & Cement Products": "Infrastructure & Construction",
	"Other Construction Materials": "Infrastructure & Construction",
	"Granites & Marbles": "Infrastructure & Construction",
	"Road Assets - Toll Annuity Hybrid-Annuity": "Infrastructure & Construction",
	"Port & Port services": "Infrastructure & Construction",
	"Airport & Airport services": "Infrastructure & Construction",
	"Dredging": "Infrastructure & Construction",
	"Water Supply & Management": "Infrastructure & Construction",
	"Waste Management": "Infrastructure & Construction",
	"Telecom - Infrastructure": "Infrastructure & Construction",

	// ─── Consumer Goods & Retail ───────────────────────────────────────────────
	"Diversified FMCG": "Consumer Goods & Retail",
	"Packaged Foods": "Consumer Goods & Retail",
	"Other Food Products": "Consumer Goods & Retail",
	"Dairy Products": "Consumer Goods & Retail",
	"Meat Products including Poultry": "Consumer Goods & Retail",
	"Seafood": "Consumer Goods & Retail",
	"Edible Oil": "Consumer Goods & Retail",
	"Sugar": "Consumer Goods & Retail",
	"Tea & Coffee": "Consumer Goods & Retail",
	"Other Beverages": "Consumer Goods & Retail",
	"Breweries & Distilleries": "Consumer Goods & Retail",
	"Cigarettes & Tobacco Products": "Consumer Goods & Retail",
	"Personal Care": "Consumer Goods & Retail",
	"Household Products": "Consumer Goods & Retail",
	"Houseware": "Consumer Goods & Retail",
	"Garments & Apparels": "Consumer Goods & Retail",
	"Footwear": "Consumer Goods & Retail",
	"Leather And Leather Products": "Consumer Goods & Retail",
	"Gems Jewellery And Watches": "Consumer Goods & Retail",
	"Diversified Retail": "Consumer Goods & Retail",
	"Speciality Retail": "Consumer Goods & Retail",
	"E-Retail/ E-Commerce": "Consumer Goods & Retail",
	"Internet & Catalogue Retail": "Consumer Goods & Retail",
	"Stationary": "Consumer Goods & Retail",
	"Leisure Products": "Consumer Goods & Retail",
	"Diversified consumer products": "Consumer Goods & Retail",

	// ─── Energy & Utilities ─────────────────────────────────────────────────────
	"Power Generation": "Energy & Utilities",
	"Power Distribution": "Energy & Utilities",
	"Power - Transmission": "Energy & Utilities",
	"Power Trading": "Energy & Utilities",
	"Integrated Power Utilities": "Energy & Utilities",
	"Oil Exploration & Production": "Energy & Utilities",
	"Refineries & Marketing": "Energy & Utilities",
	"Oil Equipment & Services": "Energy & Utilities",
	"Oil Storage & Transportation": "Energy & Utilities",
	"Gas Transmission/Marketing": "Energy & Utilities",
	"LPG/CNG/PNG/LNG Supplier": "Energy & Utilities",
	"Coal": "Energy & Utilities",
	"Offshore Support Solution Drilling": "Energy & Utilities",
	"Renewable Energy (Solar & Wind)": "Energy & Utilities",

	// ─── Metals & Mining ────────────────────────────────────────────────────────
	"Iron & Steel": "Metals & Mining",
	"Iron & Steel Products": "Metals & Mining",
	"Sponge Iron": "Metals & Mining",
	"Aluminium": "Metals & Mining",
	"Aluminium Copper & Zinc Products": "Metals & Mining",
	"Copper": "Metals & Mining",
	"Zinc": "Metals & Mining",
	"Diversified Metals": "Metals & Mining",
	"Ferro & Silica Manganese": "Metals & Mining",
	"Industrial Minerals": "Metals & Mining",
	"Carbon Black": "Metals & Mining",
	"Industrial Gases": "Metals & Mining",

	// ─── Chemicals ──────────────────────────────────────────────────────────────
	"Specialty Chemicals": "Chemicals",
	"Commodity Chemicals": "Chemicals",
	"Petrochemicals": "Chemicals",
	"Fertilizers": "Chemicals",
	"Pesticides & Agrochemicals": "Chemicals",
	"Dyes And Pigments": "Chemicals",
	"Paints": "Chemicals",
	"Lubricants": "Chemicals",
	"Printing Inks": "Chemicals",

	// ─── Real Estate ────────────────────────────────────────────────────────────
	"Residential Commercial Projects": "Real Estate",
	"Real Estate related services": "Real Estate",

	// ─── Services (Logistics, Media, Telecom, Hospitality) ─────────────────────
	"Logistics Solution Provider": "Services",
	"Shipping": "Services",
	"Road Transport": "Services",
	"Transport Related Services": "Services",
	"Airline": "Services",
	"Hotels & Resorts": "Services",
	"Restaurants": "Services",
	"Tour Travel Related Services": "Services",
	"Amusement Parks/ Other Recreation": "Services",
	"Digital Entertainment": "Services",
	"Media & Entertainment": "Services",
	"Film Production Distribution & Exhibition": "Services",
	"TV Broadcasting & Software Production": "Services",
	"Electronic Media": "Services",
	"Print Media": "Services",
	"Printing & Publication": "Services",
	"Advertising & Media Agencies": "Services",
	"Education": "Services",
	"Consulting Services": "Services",
	"Diversified Commercial Services": "Services",
	"Other Consumer Services": "Services",
	"Telecom - Cellular & Fixed line services": "Services",
	"Telecom - Equipment & Accessories": "Services",
	"Other Telecom Services": "Services",

	// ─── Others (Textiles, Agriculture, Holding Companies, Diversified) ────────
	"Other Textile Products": "Others",
	"Jute & Jute Products": "Others",
	"Paper & Paper Products": "Others",
	"Other Agricultural Products": "Others",
	"Animal Feed": "Others",
	"Trading & Distributors": "Others",
	"TRADING": "Others",
	"Trading - Auto Components": "Others",
	"Trading - Chemicals": "Others",
	"Trading - Coal": "Others",
	"Trading - Gas": "Others",
	"Trading - Metals": "Others",
	"Trading - Minerals": "Others",
	"Trading - Textile Products": "Others",
	"Dealers—Commercial Vehicles Tractors Construction Vehicles": "Others",
	"Holding Company": "Others",
	"Diversified": "Others",
	"NA": "Others",
};

/**
 * Maps any granular or legacy sector string to a canonical Macro Sector
 */
export function mapGranularToMacroSector(granularSector?: string | null): Macrosector {
	if (!granularSector || granularSector.trim() === "") return "Others";

	const trimmed = granularSector.trim();

	// Direct match
	if (SECTOR_MAPPING[trimmed]) {
		return SECTOR_MAPPING[trimmed];
	}

	// Exact match with a Macro Sector name
	if ((MACRO_SECTORS as readonly string[]).includes(trimmed)) {
		return trimmed as Macrosector;
	}

	const normalized = trimmed.toLowerCase();

	// Fuzzy lookup in mapping table
	for (const [key, value] of Object.entries(SECTOR_MAPPING)) {
		if (key.toLowerCase() === normalized) {
			return value;
		}
	}

	// Keyword heuristics
	if (normalized.includes("bank") || normalized.includes("finance") || normalized.includes("insurance") || normalized.includes("nbfc") || normalized.includes("lending")) {
		return "Banking & Finance";
	}
	if (normalized.includes("pharma") || normalized.includes("health") || normalized.includes("hospital") || normalized.includes("drug") || normalized.includes("biotech")) {
		return "Healthcare & Pharma";
	}
	if (normalized.includes("software") || normalized.includes("tech") || normalized.includes("it ") || normalized.includes("data") || normalized.includes("cloud")) {
		return "Technology";
	}
	if (normalized.includes("power") || normalized.includes("energy") || normalized.includes("oil") || normalized.includes("gas") || normalized.includes("petro") || normalized.includes("solar")) {
		return "Energy & Utilities";
	}
	if (normalized.includes("steel") || normalized.includes("metal") || normalized.includes("mining") || normalized.includes("iron") || normalized.includes("aluminium") || normalized.includes("zinc") || normalized.includes("copper")) {
		return "Metals & Mining";
	}
	if (normalized.includes("chemical") || normalized.includes("fertilizer") || normalized.includes("pesticide") || normalized.includes("paint")) {
		return "Chemicals";
	}
	if (normalized.includes("cement") || normalized.includes("construct") || normalized.includes("infra") || normalized.includes("road") || normalized.includes("port") || normalized.includes("pipe")) {
		return "Infrastructure & Construction";
	}
	if (normalized.includes("real estate") || normalized.includes("residential") || normalized.includes("property") || normalized.includes("realty")) {
		return "Real Estate";
	}
	if (normalized.includes("fmcg") || normalized.includes("consumer") || normalized.includes("retail") || normalized.includes("food") || normalized.includes("apparel") || normalized.includes("textile") || normalized.includes("jewel")) {
		return "Consumer Goods & Retail";
	}
	if (normalized.includes("auto") || normalized.includes("motor") || normalized.includes("vehicle") || normalized.includes("engine") || normalized.includes("gear") || normalized.includes("machine") || normalized.includes("industrial") || normalized.includes("bearing") || normalized.includes("forge")) {
		return "Manufacturing";
	}
	if (normalized.includes("hotel") || normalized.includes("media") || normalized.includes("telecom") || normalized.includes("logistic") || normalized.includes("transport") || normalized.includes("travel") || normalized.includes("air")) {
		return "Services";
	}

	return "Others";
}

export const mapToBroadSector = mapGranularToMacroSector;

/**
 * Check if a given sector name is one of the 12 Macro Sectors
 */
export function isMacroSector(sectorName?: string | null): boolean {
	if (!sectorName) return false;
	return (MACRO_SECTORS as readonly string[]).includes(sectorName.trim());
}

/**
 * Returns all granular sub-sectors mapped to a given Macro Sector
 */
export function getSubsectorsForMacroSector(macroSector: string): string[] {
	const list: string[] = [];
	for (const [sub, macro] of Object.entries(SECTOR_MAPPING)) {
		if (macro.toLowerCase() === macroSector.toLowerCase().trim()) {
			list.push(sub);
		}
	}
	return list.sort();
}

/**
 * Returns the hierarchical taxonomy structure of all Macro Sectors with their Sub-sectors
 */
export function getMacroSectorsWithSubsectors(): Array<{
	macroSector: Macrosector;
	subSectors: string[];
}> {
	return MACRO_SECTORS.map((m) => ({
		macroSector: m,
		subSectors: getSubsectorsForMacroSector(m),
	}));
}
