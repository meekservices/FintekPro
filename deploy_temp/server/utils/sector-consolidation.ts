/**
 * Sector Consolidation Utility
 * Maps 185+ granular NSE/BSE sectors to 12 broad sectors for AI recommendations
 */

export const BROAD_SECTORS = [
  'Technology',
  'Banking & Finance', 
  'Healthcare & Pharma',
  'Manufacturing',
  'Infrastructure & Construction',
  'Consumer Goods & Retail',
  'Energy & Utilities',
  'Metals & Mining',
  'Chemicals',
  'Real Estate',
  'Services',
  'Others'
] as const;

export type BroadSector = typeof BROAD_SECTORS[number];

const SECTOR_MAPPING: Record<string, BroadSector> = {
  // Technology
  'Computers - Software & Consulting': 'Technology',
  'IT Enabled Services': 'Technology',
  'Computers Hardware & Equipments': 'Technology',
  'Data Processing Services': 'Technology',
  'Software Products': 'Technology',
  'Business Process Outsourcing (BPO)/ Knowledge Process Outsourcing (KPO)': 'Technology',
  'E-Learning': 'Technology',
  'Web based media and service': 'Technology',
  'Financial Technology (Fintech)': 'Technology',
  'Healthcare Research Analytics & Technology': 'Technology',
  
  // Banking & Finance
  'Private Sector Bank': 'Banking & Finance',
  'Public Sector Bank': 'Banking & Finance',
  'Other Bank': 'Banking & Finance',
  'Non Banking Financial Company (NBFC)': 'Banking & Finance',
  'Housing Finance Company': 'Banking & Finance',
  'Microfinance Institutions': 'Banking & Finance',
  'Asset Management Company': 'Banking & Finance',
  'Investment Company': 'Banking & Finance',
  'Financial Institution': 'Banking & Finance',
  'Financial Products Distributor': 'Banking & Finance',
  'Other Financial Services': 'Banking & Finance',
  'Other Capital Market related Services': 'Banking & Finance',
  'Stockbroking & Allied': 'Banking & Finance',
  'Depositories Clearing Houses and Other Intermediaries': 'Banking & Finance',
  'Exchange and Data Platform': 'Banking & Finance',
  'Ratings': 'Banking & Finance',
  'Insurance Distributors': 'Banking & Finance',
  'General Insurance': 'Banking & Finance',
  'Life Insurance': 'Banking & Finance',
  
  // Healthcare & Pharma
  'Pharmaceuticals': 'Healthcare & Pharma',
  'Biotechnology': 'Healthcare & Pharma',
  'Hospital': 'Healthcare & Pharma',
  'Healthcare Service Provider': 'Healthcare & Pharma',
  'Medical Equipment & Supplies': 'Healthcare & Pharma',
  'Pharmacy Retail': 'Healthcare & Pharma',
  'Wellness': 'Healthcare & Pharma',
  
  // Manufacturing
  'Auto Components & Equipments': 'Manufacturing',
  '2/3 Wheelers': 'Manufacturing',
  'Commercial Vehicles': 'Manufacturing',
  'Passenger Cars & Utility Vehicles': 'Manufacturing',
  'Construction Vehicles': 'Manufacturing',
  'Tractors': 'Manufacturing',
  'Cycles': 'Manufacturing',
  'Auto Dealer': 'Manufacturing',
  'Heavy Electrical Equipment': 'Manufacturing',
  'Other Electrical Equipment': 'Manufacturing',
  'Industrial Products': 'Manufacturing',
  'Other Industrial Products': 'Manufacturing',
  'Compressors Pumps & Diesel Engines': 'Manufacturing',
  'Abrasives & Bearings': 'Manufacturing',
  'Castings & Forgings': 'Manufacturing',
  'Cables - Electricals': 'Manufacturing',
  'Electrodes & Refractories': 'Manufacturing',
  'Consumer Electronics': 'Manufacturing',
  'Household Appliances': 'Manufacturing',
  'Packaging': 'Manufacturing',
  'Tyres & Rubber Products': 'Manufacturing',
  'Rubber': 'Manufacturing',
  'Glass - Consumer': 'Manufacturing',
  'Glass - Industrial': 'Manufacturing',
  'Ceramics': 'Manufacturing',
  'Sanitary Ware': 'Manufacturing',
  'Plywood Boards/ Laminates': 'Manufacturing',
  'Furniture Home Furnishing': 'Manufacturing',
  'Plastic Products - Consumer': 'Manufacturing',
  'Plastic Products - Industrial': 'Manufacturing',
  'Aerospace & Defense': 'Manufacturing',
  'Ship Building & Allied Services': 'Manufacturing',
  'Railway Wagons': 'Manufacturing',
  'Explosives': 'Manufacturing',
  
  // Infrastructure & Construction
  'Civil Construction': 'Infrastructure & Construction',
  'Cement & Cement Products': 'Infrastructure & Construction',
  'Other Construction Materials': 'Infrastructure & Construction',
  'Granites & Marbles': 'Infrastructure & Construction',
  'Road Assets - Toll Annuity Hybrid-Annuity': 'Infrastructure & Construction',
  'Port & Port services': 'Infrastructure & Construction',
  'Airport & Airport services': 'Infrastructure & Construction',
  'Dredging': 'Infrastructure & Construction',
  'Water Supply & Management': 'Infrastructure & Construction',
  'Waste Management': 'Infrastructure & Construction',
  'Telecom - Infrastructure': 'Infrastructure & Construction',
  
  // Consumer Goods & Retail
  'Diversified FMCG': 'Consumer Goods & Retail',
  'Packaged Foods': 'Consumer Goods & Retail',
  'Other Food Products': 'Consumer Goods & Retail',
  'Dairy Products': 'Consumer Goods & Retail',
  'Meat Products including Poultry': 'Consumer Goods & Retail',
  'Seafood': 'Consumer Goods & Retail',
  'Edible Oil': 'Consumer Goods & Retail',
  'Sugar': 'Consumer Goods & Retail',
  'Tea & Coffee': 'Consumer Goods & Retail',
  'Other Beverages': 'Consumer Goods & Retail',
  'Breweries & Distilleries': 'Consumer Goods & Retail',
  'Cigarettes & Tobacco Products': 'Consumer Goods & Retail',
  'Personal Care': 'Consumer Goods & Retail',
  'Household Products': 'Consumer Goods & Retail',
  'Houseware': 'Consumer Goods & Retail',
  'Garments & Apparels': 'Consumer Goods & Retail',
  'Footwear': 'Consumer Goods & Retail',
  'Leather And Leather Products': 'Consumer Goods & Retail',
  'Gems Jewellery And Watches': 'Consumer Goods & Retail',
  'Diversified Retail': 'Consumer Goods & Retail',
  'Speciality Retail': 'Consumer Goods & Retail',
  'E-Retail/ E-Commerce': 'Consumer Goods & Retail',
  'Internet & Catalogue Retail': 'Consumer Goods & Retail',
  'Stationary': 'Consumer Goods & Retail',
  'Leisure Products': 'Consumer Goods & Retail',
  'Diversified consumer products': 'Consumer Goods & Retail',
  
  // Energy & Utilities
  'Power Generation': 'Energy & Utilities',
  'Power Distribution': 'Energy & Utilities',
  'Power - Transmission': 'Energy & Utilities',
  'Power Trading': 'Energy & Utilities',
  'Integrated Power Utilities': 'Energy & Utilities',
  'Oil Exploration & Production': 'Energy & Utilities',
  'Refineries & Marketing': 'Energy & Utilities',
  'Oil Equipment & Services': 'Energy & Utilities',
  'Oil Storage & Transportation': 'Energy & Utilities',
  'Gas Transmission/Marketing': 'Energy & Utilities',
  'LPG/CNG/PNG/LNG Supplier': 'Energy & Utilities',
  'Coal': 'Energy & Utilities',
  'Offshore Support Solution Drilling': 'Energy & Utilities',
  
  // Metals & Mining
  'Iron & Steel': 'Metals & Mining',
  'Iron & Steel Products': 'Metals & Mining',
  'Sponge Iron': 'Metals & Mining',
  'Aluminium': 'Metals & Mining',
  'Aluminium Copper & Zinc Products': 'Metals & Mining',
  'Copper': 'Metals & Mining',
  'Zinc': 'Metals & Mining',
  'Diversified Metals': 'Metals & Mining',
  'Ferro & Silica Manganese': 'Metals & Mining',
  'Industrial Minerals': 'Metals & Mining',
  'Carbon Black': 'Metals & Mining',
  'Industrial Gases': 'Metals & Mining',
  
  // Chemicals
  'Specialty Chemicals': 'Chemicals',
  'Commodity Chemicals': 'Chemicals',
  'Petrochemicals': 'Chemicals',
  'Fertilizers': 'Chemicals',
  'Pesticides & Agrochemicals': 'Chemicals',
  'Dyes And Pigments': 'Chemicals',
  'Paints': 'Chemicals',
  'Lubricants': 'Chemicals',
  'Printing Inks': 'Chemicals',
  
  // Real Estate
  'Residential Commercial Projects': 'Real Estate',
  'Real Estate related services': 'Real Estate',
  
  // Services
  'Logistics Solution Provider': 'Services',
  'Shipping': 'Services',
  'Road Transport': 'Services',
  'Transport Related Services': 'Services',
  'Airline': 'Services',
  'Hotels & Resorts': 'Services',
  'Restaurants': 'Services',
  'Tour Travel Related Services': 'Services',
  'Amusement Parks/ Other Recreation': 'Services',
  'Digital Entertainment': 'Services',
  'Media & Entertainment': 'Services',
  'Film Production Distribution & Exhibition': 'Services',
  'TV Broadcasting & Software Production': 'Services',
  'Electronic Media': 'Services',
  'Print Media': 'Services',
  'Printing & Publication': 'Services',
  'Advertising & Media Agencies': 'Services',
  'Education': 'Services',
  'Consulting Services': 'Services',
  'Diversified Commercial Services': 'Services',
  'Other Consumer Services': 'Services',
  'Telecom - Cellular & Fixed line services': 'Services',
  'Telecom - Equipment & Accessories': 'Services',
  'Other Telecom Services': 'Services',
  
  // Others (Textiles, Agriculture, Trading, Holding companies, etc.)
  'Other Textile Products': 'Others',
  'Jute & Jute Products': 'Others',
  'Paper & Paper Products': 'Others',
  'Other Agricultural Products': 'Others',
  'Animal Feed': 'Others',
  'Trading & Distributors': 'Others',
  'TRADING': 'Others',
  'Trading - Auto Components': 'Others',
  'Trading - Chemicals': 'Others',
  'Trading - Coal': 'Others',
  'Trading - Gas': 'Others',
  'Trading - Metals': 'Others',
  'Trading - Minerals': 'Others',
  'Trading - Textile Products': 'Others',
  'Dealers—Commercial Vehicles Tractors Construction Vehicles': 'Others',
  'Holding Company': 'Others',
  'Diversified': 'Others',
  'NA': 'Others',
};

/**
 * Maps a granular sector to a broad sector
 * @param granularSector - The granular sector from NSE/BSE
 * @returns The consolidated broad sector
 */
export function mapToBroadSector(granularSector: string | null | undefined): BroadSector {
  if (!granularSector) return 'Others';
  
  // Direct mapping
  if (SECTOR_MAPPING[granularSector]) {
    return SECTOR_MAPPING[granularSector];
  }
  
  // Fuzzy matching for slight variations
  const normalizedSector = granularSector.toLowerCase().trim();
  
  for (const [key, value] of Object.entries(SECTOR_MAPPING)) {
    if (key.toLowerCase() === normalizedSector) {
      return value;
    }
  }
  
  // Keyword-based fallback matching
  if (normalizedSector.includes('bank') || normalizedSector.includes('finance') || normalizedSector.includes('insurance')) {
    return 'Banking & Finance';
  }
  if (normalizedSector.includes('pharma') || normalizedSector.includes('health') || normalizedSector.includes('hospital')) {
    return 'Healthcare & Pharma';
  }
  if (normalizedSector.includes('software') || normalizedSector.includes('it ') || normalizedSector.includes('tech')) {
    return 'Technology';
  }
  if (normalizedSector.includes('power') || normalizedSector.includes('energy') || normalizedSector.includes('oil') || normalizedSector.includes('gas')) {
    return 'Energy & Utilities';
  }
  if (normalizedSector.includes('steel') || normalizedSector.includes('metal') || normalizedSector.includes('mining')) {
    return 'Metals & Mining';
  }
  if (normalizedSector.includes('chemical') || normalizedSector.includes('fertilizer') || normalizedSector.includes('pesticide')) {
    return 'Chemicals';
  }
  if (normalizedSector.includes('cement') || normalizedSector.includes('construct') || normalizedSector.includes('infrastructure')) {
    return 'Infrastructure & Construction';
  }
  if (normalizedSector.includes('real estate') || normalizedSector.includes('residential') || normalizedSector.includes('property')) {
    return 'Real Estate';
  }
  if (normalizedSector.includes('fmcg') || normalizedSector.includes('consumer') || normalizedSector.includes('retail') || normalizedSector.includes('food')) {
    return 'Consumer Goods & Retail';
  }
  if (normalizedSector.includes('auto') || normalizedSector.includes('vehicle') || normalizedSector.includes('industrial')) {
    return 'Manufacturing';
  }
  if (normalizedSector.includes('hotel') || normalizedSector.includes('media') || normalizedSector.includes('telecom') || normalizedSector.includes('logistics')) {
    return 'Services';
  }
  
  return 'Others';
}

/**
 * Get all broad sectors with their count of mapped granular sectors
 */
export function getBroadSectorStats(): Record<BroadSector, string[]> {
  const stats: Record<BroadSector, string[]> = {} as Record<BroadSector, string[]>;
  
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
export function getSectorRiskLevel(broadSector: BroadSector): 'Low' | 'Moderate' | 'High' | 'Very High' {
  const riskMap: Record<BroadSector, 'Low' | 'Moderate' | 'High' | 'Very High'> = {
    'Banking & Finance': 'Moderate',
    'Healthcare & Pharma': 'Moderate',
    'Technology': 'High',
    'Consumer Goods & Retail': 'Moderate',
    'Energy & Utilities': 'Moderate',
    'Infrastructure & Construction': 'High',
    'Manufacturing': 'Moderate',
    'Metals & Mining': 'High',
    'Chemicals': 'High',
    'Real Estate': 'Very High',
    'Services': 'Moderate',
    'Others': 'High',
  };
  
  return riskMap[broadSector];
}

/**
 * Get recommended allocation for a broad sector based on risk profile
 */
export function getSectorAllocationWeight(
  broadSector: BroadSector, 
  riskProfile: 'conservative' | 'moderate' | 'aggressive'
): number {
  const allocations: Record<string, Record<BroadSector, number>> = {
    conservative: {
      'Banking & Finance': 25,
      'Healthcare & Pharma': 15,
      'Technology': 10,
      'Consumer Goods & Retail': 20,
      'Energy & Utilities': 10,
      'Infrastructure & Construction': 5,
      'Manufacturing': 5,
      'Metals & Mining': 2,
      'Chemicals': 3,
      'Real Estate': 2,
      'Services': 3,
      'Others': 0,
    },
    moderate: {
      'Banking & Finance': 20,
      'Healthcare & Pharma': 12,
      'Technology': 18,
      'Consumer Goods & Retail': 12,
      'Energy & Utilities': 8,
      'Infrastructure & Construction': 8,
      'Manufacturing': 8,
      'Metals & Mining': 5,
      'Chemicals': 4,
      'Real Estate': 3,
      'Services': 2,
      'Others': 0,
    },
    aggressive: {
      'Banking & Finance': 15,
      'Healthcare & Pharma': 10,
      'Technology': 25,
      'Consumer Goods & Retail': 8,
      'Energy & Utilities': 5,
      'Infrastructure & Construction': 10,
      'Manufacturing': 10,
      'Metals & Mining': 8,
      'Chemicals': 5,
      'Real Estate': 4,
      'Services': 0,
      'Others': 0,
    },
  };
  
  return allocations[riskProfile][broadSector];
}
