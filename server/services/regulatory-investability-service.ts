/**
 * Regulatory Investability Service
 * 
 * Shared utility for detecting overseas/international funds and checking
 * investability status based on SEBI/RBI regulatory limits.
 * 
 * Regulatory Context:
 * - SEBI overseas MF investment limit: USD 7B (frozen since Feb 2022)
 * - SEBI overseas ETF limit: USD 1B (frozen since April 2024)
 * - These limits are industry-wide caps set by SEBI circulars
 */

export interface InvestabilityResult {
  investable: boolean;
  reason: string | null;
  restrictionType?: 'overseas_mf' | 'overseas_etf' | 'fund_house' | 'discontinued';
}

export interface RegulatoryStatus {
  overseasInvestmentFrozen: boolean;
  overseasETFFrozen: boolean;
  lastUpdated: Date;
}

const OVERSEAS_KEYWORDS = [
  'international', 'global', 'overseas', 'foreign',
  'us equity', 'us stock', 'us fund', 'united states',
  'nasdaq', 's&p 500', 's&p500', 'dow jones',
  'europe', 'european', 'asia pacific', 'emerging markets',
  'world', 'greater china', 'japan', 'china',
  'feeder', 'fof - overseas', 'fund of funds - overseas',
  'world equity', 'global equity', 'international equity',
  'us focused', 'us growth', 'us value', 'us bluechip',
  'latin america', 'brazil', 'germany', 'uk equity'
];

const OVERSEAS_FUND_HOUSE_PATTERNS = [
  { fundHouse: 'franklin', pattern: 'us opportunities' },
  { fundHouse: 'motilal', pattern: 'nasdaq' },
  { fundHouse: 'kotak', pattern: 'nasdaq' },
  { fundHouse: 'nippon', pattern: 'japan' },
  { fundHouse: 'edelweiss', pattern: 'china' },
  { fundHouse: 'pgim', pattern: 'global' },
  { fundHouse: 'dsp', pattern: 'us flexible' },
  { fundHouse: 'axis', pattern: 'global' },
  { fundHouse: 'icici', pattern: 'global' },
  { fundHouse: 'sbi', pattern: 'international' }
];

class RegulatoryInvestabilityService {
  private static instance: RegulatoryInvestabilityService;
  
  private overseasInvestmentFrozen = true;
  private overseasETFFrozen = true;
  private lastUpdated = new Date();

  private constructor() {
    console.log("✅ Regulatory Investability Service initialized");
  }

  static getInstance(): RegulatoryInvestabilityService {
    if (!RegulatoryInvestabilityService.instance) {
      RegulatoryInvestabilityService.instance = new RegulatoryInvestabilityService();
    }
    return RegulatoryInvestabilityService.instance;
  }

  isOverseasFund(fund: { schemeName?: string; name?: string; category?: string }): boolean {
    const category = (fund.category || '').toLowerCase();
    const schemeName = (fund.schemeName || fund.name || '').toLowerCase();
    const combined = `${category} ${schemeName}`;
    
    for (const keyword of OVERSEAS_KEYWORDS) {
      if (combined.includes(keyword)) {
        return true;
      }
    }
    
    for (const pattern of OVERSEAS_FUND_HOUSE_PATTERNS) {
      if (schemeName.includes(pattern.fundHouse) && schemeName.includes(pattern.pattern)) {
        return true;
      }
    }
    
    return false;
  }

  isOverseasETF(instrument: { name?: string; schemeName?: string; category?: string }): boolean {
    const name = (instrument.name || instrument.schemeName || '').toLowerCase();
    const category = (instrument.category || '').toLowerCase();
    
    const isETF = name.includes('etf') || category.includes('etf');
    if (!isETF) return false;
    
    for (const keyword of OVERSEAS_KEYWORDS) {
      if (name.includes(keyword) || category.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  isFundInvestable(fund: {
    schemeName?: string;
    name?: string;
    category?: string;
    extendedData?: any;
    purchaseAllowed?: boolean;
  }): InvestabilityResult {
    const extendedData = fund.extendedData || {};
    const schemeName = (fund.schemeName || fund.name || '').toLowerCase();
    
    if (extendedData.purchaseAllowed === false || fund.purchaseAllowed === false) {
      const isOverseas = this.isOverseasFund(fund);
      return {
        investable: false,
        reason: isOverseas 
          ? 'Investment restricted: SEBI overseas investment limit reached (USD 7B cap)'
          : 'Fresh investment not allowed by fund house',
        restrictionType: isOverseas ? 'overseas_mf' : 'fund_house'
      };
    }
    
    if (this.isOverseasFund(fund)) {
      const isETF = schemeName.includes('etf');
      
      if (isETF && this.overseasETFFrozen) {
        return {
          investable: false,
          reason: 'SEBI overseas ETF limit (USD 1B) reached - new investments frozen since April 2024',
          restrictionType: 'overseas_etf'
        };
      }
      
      if (this.overseasInvestmentFrozen) {
        return {
          investable: false,
          reason: 'SEBI overseas investment limit (USD 7B) reached - new investments frozen since Feb 2022',
          restrictionType: 'overseas_mf'
        };
      }
    }
    
    return { investable: true, reason: null };
  }

  isETFInvestable(etf: {
    name?: string;
    symbol?: string;
    category?: string;
    isin?: string;
  }): InvestabilityResult {
    if (this.isOverseasETF(etf)) {
      if (this.overseasETFFrozen) {
        return {
          investable: false,
          reason: 'SEBI overseas ETF limit (USD 1B) reached - new investments frozen since April 2024',
          restrictionType: 'overseas_etf'
        };
      }
    }
    
    return { investable: true, reason: null };
  }

  updateOverseasInvestmentStatus(frozen: boolean): void {
    this.overseasInvestmentFrozen = frozen;
    this.lastUpdated = new Date();
    console.log(`[Regulatory] Overseas investment status updated: ${frozen ? 'FROZEN' : 'OPEN'}`);
  }

  updateOverseasETFStatus(frozen: boolean): void {
    this.overseasETFFrozen = frozen;
    this.lastUpdated = new Date();
    console.log(`[Regulatory] Overseas ETF status updated: ${frozen ? 'FROZEN' : 'OPEN'}`);
  }

  getStatus(): RegulatoryStatus {
    return {
      overseasInvestmentFrozen: this.overseasInvestmentFrozen,
      overseasETFFrozen: this.overseasETFFrozen,
      lastUpdated: this.lastUpdated
    };
  }

  logFilteredInstrument(
    instrumentType: 'mutual_fund' | 'etf',
    instrumentName: string,
    reason: string
  ): void {
    console.log(`[Regulatory Audit] Filtered ${instrumentType}: "${instrumentName}" - Reason: ${reason}`);
  }
}

export const regulatoryInvestabilityService = RegulatoryInvestabilityService.getInstance();

export function isOverseasFund(fund: { schemeName?: string; name?: string; category?: string }): boolean {
  return regulatoryInvestabilityService.isOverseasFund(fund);
}

export function isOverseasETF(etf: { name?: string; schemeName?: string; category?: string }): boolean {
  return regulatoryInvestabilityService.isOverseasETF(etf);
}

export function isFundInvestable(fund: {
  schemeName?: string;
  name?: string;
  category?: string;
  extendedData?: any;
  purchaseAllowed?: boolean;
}): InvestabilityResult {
  return regulatoryInvestabilityService.isFundInvestable(fund);
}

export function isETFInvestable(etf: {
  name?: string;
  symbol?: string;
  category?: string;
  isin?: string;
}): InvestabilityResult {
  return regulatoryInvestabilityService.isETFInvestable(etf);
}

export function getRegulatoryStatus(): RegulatoryStatus {
  return regulatoryInvestabilityService.getStatus();
}

export function updateRegulatoryStatus(
  overseasInvestmentFrozen?: boolean,
  overseasETFFrozen?: boolean
): void {
  if (typeof overseasInvestmentFrozen === 'boolean') {
    regulatoryInvestabilityService.updateOverseasInvestmentStatus(overseasInvestmentFrozen);
  }
  if (typeof overseasETFFrozen === 'boolean') {
    regulatoryInvestabilityService.updateOverseasETFStatus(overseasETFFrozen);
  }
}

export function logFilteredInstrument(
  instrumentType: 'mutual_fund' | 'etf',
  instrumentName: string,
  reason: string
): void {
  regulatoryInvestabilityService.logFilteredInstrument(instrumentType, instrumentName, reason);
}
