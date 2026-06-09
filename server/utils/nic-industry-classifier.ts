/**
 * NIC-based Industry Classification Utility
 *
 * Derives industry and sector information from CIN (Corporate Identity Number).
 * The first character of CIN indicates the Principal Business Activity code based on
 * National Industrial Classification (NIC) 2008.
 *
 * CIN Format: L/UXXXXX[State][Year][PLC/PTC]NNNNNN
 * - First char (L/U): Listed (L) or Unlisted (U)
 * - Next 5 chars: NIC-2008 code (industry classification)
 * - Next 2 chars: State code
 * - Next 4 chars: Year of incorporation
 * - Next 3 chars: Company type (PLC = Public Limited Company, PTC = Private Limited)
 * - Last 6 chars: Serial number
 */

export interface IndustryClassification {
	nicCode: string;
	industry: string;
	sector: string;
	subSector?: string;
}

const NIC_INDUSTRY_MAP: Record<
	string,
	{ industry: string; sector: string; subSector?: string }
> = {
	"00": { industry: "Diversified Activities", sector: "Diversified" },
	"01": { industry: "Crop Production", sector: "Agriculture" },
	"02": { industry: "Forestry", sector: "Agriculture" },
	"03": { industry: "Fishing", sector: "Agriculture" },
	"04": { industry: "Agriculture Support", sector: "Agriculture" },
	"05": { industry: "Coal Mining", sector: "Mining" },
	"06": { industry: "Oil & Gas Extraction", sector: "Energy" },
	"07": { industry: "Metal Ore Mining", sector: "Mining" },
	"08": { industry: "Other Mining", sector: "Mining" },
	"09": { industry: "Mining Support", sector: "Mining" },
	"10": {
		industry: "Food Products",
		sector: "FMCG",
		subSector: "Food Processing",
	},
	"11": { industry: "Beverages", sector: "FMCG" },
	"12": { industry: "Tobacco", sector: "FMCG" },
	"13": { industry: "Textiles", sector: "Consumer Goods" },
	"14": { industry: "Apparel", sector: "Consumer Goods" },
	"15": { industry: "Leather Products", sector: "Consumer Goods" },
	"16": { industry: "Wood Products", sector: "Manufacturing" },
	"17": { industry: "Paper Products", sector: "Manufacturing" },
	"18": { industry: "Printing & Media", sector: "Media & Entertainment" },
	"19": { industry: "Coke & Petroleum", sector: "Energy" },
	"20": { industry: "Chemicals", sector: "Chemicals" },
	"21": { industry: "Pharmaceuticals", sector: "Healthcare" },
	"22": { industry: "Rubber & Plastics", sector: "Manufacturing" },
	"23": { industry: "Non-Metallic Minerals", sector: "Construction Materials" },
	"24": { industry: "Basic Metals", sector: "Metals & Mining" },
	"25": { industry: "Fabricated Metal Products", sector: "Manufacturing" },
	"26": {
		industry: "Electronics",
		sector: "Technology",
		subSector: "Hardware",
	},
	"27": { industry: "Electrical Equipment", sector: "Capital Goods" },
	"28": { industry: "Machinery & Equipment", sector: "Capital Goods" },
	"29": { industry: "Motor Vehicles", sector: "Automobile" },
	"30": { industry: "Other Transport Equipment", sector: "Automobile" },
	"31": { industry: "Furniture", sector: "Consumer Durables" },
	"32": { industry: "Other Manufacturing", sector: "Manufacturing" },
	"33": { industry: "Repair & Installation", sector: "Industrial Services" },
	"34": {
		industry: "Industrial Machinery Repair",
		sector: "Industrial Services",
	},
	"35": {
		industry: "Power Generation",
		sector: "Utilities",
		subSector: "Power",
	},
	"36": { industry: "Water Supply", sector: "Utilities" },
	"37": { industry: "Sewerage", sector: "Utilities" },
	"38": { industry: "Waste Management", sector: "Utilities" },
	"39": { industry: "Remediation", sector: "Utilities" },
	"40": { industry: "Energy Distribution", sector: "Utilities" },
	"41": { industry: "Building Construction", sector: "Construction" },
	"42": { industry: "Civil Engineering", sector: "Construction" },
	"43": { industry: "Specialized Construction", sector: "Construction" },
	"44": { industry: "Building Services", sector: "Construction" },
	"45": {
		industry: "Motor Vehicle Trade",
		sector: "Automobile",
		subSector: "Auto Dealers",
	},
	"46": { industry: "Wholesale Trade", sector: "Trading" },
	"47": { industry: "Retail Trade", sector: "Retail" },
	"48": {
		industry: "E-Commerce",
		sector: "Technology",
		subSector: "Digital Commerce",
	},
	"49": { industry: "Land Transport", sector: "Transportation" },
	"50": { industry: "Water Transport", sector: "Transportation" },
	"51": {
		industry: "Air Transport",
		sector: "Transportation",
		subSector: "Aviation",
	},
	"52": { industry: "Warehousing", sector: "Logistics" },
	"53": { industry: "Postal & Courier", sector: "Logistics" },
	"54": { industry: "Supply Chain Services", sector: "Logistics" },
	"55": { industry: "Accommodation", sector: "Hospitality" },
	"56": { industry: "Food & Beverage Services", sector: "Hospitality" },
	"57": { industry: "Catering Services", sector: "Hospitality" },
	"58": { industry: "Publishing", sector: "Media & Entertainment" },
	"59": { industry: "Film & Music", sector: "Media & Entertainment" },
	"60": { industry: "Broadcasting", sector: "Media & Entertainment" },
	"61": { industry: "Telecommunications", sector: "Telecom" },
	"62": {
		industry: "IT Services",
		sector: "Technology",
		subSector: "Software",
	},
	"63": { industry: "Information Services", sector: "Technology" },
	"64": {
		industry: "Financial Services",
		sector: "Financial Services",
		subSector: "Banking & Finance",
	},
	"65": {
		industry: "Insurance",
		sector: "Financial Services",
		subSector: "Insurance",
	},
	"66": {
		industry: "Financial Auxiliaries",
		sector: "Financial Services",
		subSector: "NBFC",
	},
	"67": {
		industry: "Stock Exchange Services",
		sector: "Financial Services",
		subSector: "Capital Markets",
	},
	"68": { industry: "Real Estate", sector: "Real Estate" },
	"69": { industry: "Legal & Accounting", sector: "Professional Services" },
	"70": { industry: "Management Consulting", sector: "Professional Services" },
	"71": {
		industry: "Architecture & Engineering",
		sector: "Professional Services",
	},
	"72": { industry: "R&D", sector: "Technology", subSector: "Research" },
	"73": { industry: "Advertising", sector: "Media & Entertainment" },
	"74": {
		industry: "Other Professional Services",
		sector: "Professional Services",
	},
	"75": { industry: "Veterinary", sector: "Healthcare" },
	"76": {
		industry: "Asset Management",
		sector: "Financial Services",
		subSector: "Asset Management",
	},
	"77": { industry: "Rental & Leasing", sector: "Financial Services" },
	"78": { industry: "Employment Services", sector: "Services" },
	"79": { industry: "Travel & Tourism", sector: "Hospitality" },
	"80": { industry: "Security Services", sector: "Services" },
	"81": { industry: "Facilities Management", sector: "Services" },
	"82": { industry: "Business Support", sector: "Services" },
	"83": { industry: "Administrative Services", sector: "Services" },
	"84": { industry: "Public Administration", sector: "Government" },
	"85": { industry: "Education", sector: "Education" },
	"86": { industry: "Healthcare Services", sector: "Healthcare" },
	"87": { industry: "Residential Care", sector: "Healthcare" },
	"88": { industry: "Social Work", sector: "Services" },
	"89": { industry: "Welfare Activities", sector: "Services" },
	"90": { industry: "Arts & Entertainment", sector: "Media & Entertainment" },
	"91": { industry: "Libraries & Museums", sector: "Media & Entertainment" },
	"92": { industry: "Gambling", sector: "Entertainment" },
	"93": { industry: "Sports & Recreation", sector: "Entertainment" },
	"94": { industry: "Membership Organizations", sector: "Services" },
	"95": { industry: "Repair Services", sector: "Services" },
	"96": { industry: "Personal Services", sector: "Services" },
	"97": { industry: "Household Services", sector: "Services" },
	"98": { industry: "Private Household Activities", sector: "Services" },
	"99": { industry: "Extraterritorial", sector: "Other" },
};

const NIC_FIRST_DIGIT_FALLBACK: Record<
	string,
	{ industry: string; sector: string }
> = {
	"0": { industry: "Agriculture & Mining", sector: "Primary" },
	"1": { industry: "Manufacturing", sector: "Manufacturing" },
	"2": { industry: "Manufacturing", sector: "Manufacturing" },
	"3": { industry: "Manufacturing & Utilities", sector: "Industrial" },
	"4": { industry: "Construction & Trade", sector: "Consumer Services" },
	"5": { industry: "Transport & Hospitality", sector: "Services" },
	"6": { industry: "IT & Financial Services", sector: "Services" },
	"7": { industry: "Professional Services", sector: "Services" },
	"8": { industry: "Education & Healthcare", sector: "Services" },
	"9": { industry: "Entertainment & Other", sector: "Services" },
};

export function classifyIndustryFromCIN(
	cin: string,
): IndustryClassification | null {
	if (!cin || cin.length < 6) {
		return null;
	}

	const nicCode = cin.substring(1, 6);
	const twoDigitCode = nicCode.substring(0, 2);

	if (NIC_INDUSTRY_MAP[twoDigitCode]) {
		const classification = NIC_INDUSTRY_MAP[twoDigitCode];
		return {
			nicCode: twoDigitCode,
			industry: classification.industry,
			sector: classification.sector,
			subSector: classification.subSector,
		};
	}

	const firstDigit = nicCode[0];
	if (NIC_FIRST_DIGIT_FALLBACK[firstDigit]) {
		const fallback = NIC_FIRST_DIGIT_FALLBACK[firstDigit];
		return {
			nicCode: firstDigit + "X",
			industry: fallback.industry,
			sector: fallback.sector,
		};
	}

	return {
		nicCode: nicCode,
		industry: "Diversified",
		sector: "Others",
	};
}

export function getSectorFromCIN(cin: string): string | null {
	const classification = classifyIndustryFromCIN(cin);
	return classification?.sector || null;
}

export function getIndustryFromCIN(cin: string): string | null {
	const classification = classifyIndustryFromCIN(cin);
	return classification?.industry || null;
}

export function enrichCompanyWithNICClassification(company: {
	cin?: string | null;
	sector?: string | null;
	industry?: string | null;
}): { sector: string; industry: string; source: "nic_derived" | "existing" } {
	const needsSector =
		!company.sector || company.sector.toLowerCase() === "unknown";
	const needsIndustry =
		!company.industry || company.industry.toLowerCase() === "unknown";

	if (!needsSector && !needsIndustry) {
		return {
			sector: company.sector!,
			industry: company.industry!,
			source: "existing",
		};
	}

	if (company.cin) {
		const classification = classifyIndustryFromCIN(company.cin);
		if (classification) {
			return {
				sector: needsSector ? classification.sector : company.sector!,
				industry: needsIndustry ? classification.industry : company.industry!,
				source: "nic_derived",
			};
		}
	}

	return {
		sector: company.sector || "Others",
		industry: company.industry || "Diversified",
		source: "existing",
	};
}
