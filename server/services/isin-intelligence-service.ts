// @ts-nocheck
import { db } from '../db';
import { instrumentMaster, type InstrumentMaster } from '@shared/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

export interface ISINDetectionResult {
  isin: string;
  prefix: 'INF' | 'INE' | 'INS' | 'INV' | 'INX' | 'UNKNOWN';
  instrumentFamily: string;
  instrumentType: string;
  assetClass: string;
  subAssetClass: string;
  primaryRegulator: 'SEBI' | 'RBI' | 'SEC' | 'FCA' | 'CSRC' | 'SFC' | 'MAS' | 'FSA' | null;
  secondaryRegulator: 'SEBI' | 'RBI' | 'SEC' | 'FCA' | 'CSRC' | 'SFC' | 'MAS' | 'FSA' | null;
  issuerType: string | null;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  isEdgeCase: boolean;
  edgeCaseType?: 'MLD' | 'AT1' | 'SGB' | 'CONVERTIBLE' | 'PERPETUAL';
  validationStatus: 'validated' | 'conflict' | 'unknown';
  validationErrors: string[];
  confidence: number;
  // Region fields
  region: 'APAC' | 'EMEA' | 'Americas' | 'Global' | null;
  country: string | null; // ISO 3166-1 alpha-2
  exchange: string | null;
  marketType: 'domestic' | 'international' | 'gift_city' | null;
}

export interface ISINMetadata {
  coupon?: number;
  maturityDate?: Date;
  faceValue?: number;
  issuerName?: string;
  issuerType?: 'bank' | 'nbfc' | 'corporate' | 'government' | 'amc' | 'trust';
  isPerpetual?: boolean;
  isStructured?: boolean;
  isGoldLinked?: boolean;
  isConvertible?: boolean;
  isSecured?: boolean;
  hasEquityFlag?: boolean;
  trustType?: 'REIT' | 'InvIT';
  amcName?: string;
  schemeName?: string;
  isETF?: boolean;
}

const KNOWN_BANKS = [
  'STATE BANK', 'SBI', 'ICICI', 'HDFC', 'AXIS', 'KOTAK', 'IDBI', 'PUNJAB NATIONAL',
  'BANK OF BARODA', 'CANARA', 'UNION BANK', 'INDIAN BANK', 'CENTRAL BANK',
  'INDIAN OVERSEAS', 'UCO BANK', 'BANK OF INDIA', 'BANK OF MAHARASHTRA',
  'YES BANK', 'FEDERAL BANK', 'BANDHAN', 'INDUSIND', 'RBL', 'AU SMALL FINANCE',
  'EQUITAS', 'UJJIVAN', 'SURYODAY', 'UTKARSH', 'IDFC FIRST', 'SOUTH INDIAN BANK'
];

const KNOWN_NBFCS = [
  'BAJAJ FINANCE', 'BAJAJ FINSERV', 'SHRIRAM', 'MAHINDRA FINANCE', 'CHOLAMANDALAM',
  'SUNDARAM FINANCE', 'MUTHOOT', 'MANAPPURAM', 'L&T FINANCE', 'PIRAMAL',
  'IIFL FINANCE', 'TATA CAPITAL', 'ADITYA BIRLA', 'HDB FINANCIAL', 'CREDITACCESS',
  'AROHAN', 'SATIN CREDITCARE', 'SPANDANA', 'UJJIVAN', 'FUSION'
];

// ISIN Country Prefix to Region/Country mapping
const ISIN_COUNTRY_MAP: Record<string, { country: string; region: 'APAC' | 'EMEA' | 'Americas' | 'Global'; regulator: string; exchanges: string[] }> = {
  'IN': { country: 'IN', region: 'APAC', regulator: 'SEBI/RBI', exchanges: ['NSE', 'BSE'] },
  'US': { country: 'US', region: 'Americas', regulator: 'SEC', exchanges: ['NYSE', 'NASDAQ', 'AMEX'] },
  'GB': { country: 'GB', region: 'EMEA', regulator: 'FCA', exchanges: ['LSE'] },
  'CN': { country: 'CN', region: 'APAC', regulator: 'CSRC', exchanges: ['SSE', 'SZSE'] },
  'HK': { country: 'HK', region: 'APAC', regulator: 'SFC', exchanges: ['HKEX'] },
  'SG': { country: 'SG', region: 'APAC', regulator: 'MAS', exchanges: ['SGX'] },
  'JP': { country: 'JP', region: 'APAC', regulator: 'FSA', exchanges: ['TSE', 'OSE'] },
  'DE': { country: 'DE', region: 'EMEA', regulator: 'BaFin', exchanges: ['XETRA', 'FSE'] },
  'FR': { country: 'FR', region: 'EMEA', regulator: 'AMF', exchanges: ['EPA'] },
  'AU': { country: 'AU', region: 'APAC', regulator: 'ASIC', exchanges: ['ASX'] },
  'CA': { country: 'CA', region: 'Americas', regulator: 'CSA', exchanges: ['TSX', 'TSXV'] },
  'CH': { country: 'CH', region: 'EMEA', regulator: 'FINMA', exchanges: ['SIX'] },
  'KR': { country: 'KR', region: 'APAC', regulator: 'FSC', exchanges: ['KRX'] },
  'TW': { country: 'TW', region: 'APAC', regulator: 'FSC', exchanges: ['TWSE'] },
  'BR': { country: 'BR', region: 'Americas', regulator: 'CVM', exchanges: ['B3'] },
  'ZA': { country: 'ZA', region: 'EMEA', regulator: 'FSCA', exchanges: ['JSE'] },
  'AE': { country: 'AE', region: 'EMEA', regulator: 'SCA', exchanges: ['DFM', 'ADX'] },
  'SA': { country: 'SA', region: 'EMEA', regulator: 'CMA', exchanges: ['TADAWUL'] },
  'ID': { country: 'ID', region: 'APAC', regulator: 'OJK', exchanges: ['IDX'] },
  'MY': { country: 'MY', region: 'APAC', regulator: 'SC', exchanges: ['BURSA'] },
  'TH': { country: 'TH', region: 'APAC', regulator: 'SEC', exchanges: ['SET'] },
  'PH': { country: 'PH', region: 'APAC', regulator: 'SEC', exchanges: ['PSE'] },
  'VN': { country: 'VN', region: 'APAC', regulator: 'SSC', exchanges: ['HOSE', 'HNX'] },
};

const KNOWN_AMCS = [
  'HDFC MUTUAL', 'ICICI PRUDENTIAL', 'SBI MUTUAL', 'AXIS MUTUAL', 'KOTAK',
  'ADITYA BIRLA', 'NIPPON', 'UTI', 'DSP', 'FRANKLIN TEMPLETON',
  'TATA MUTUAL', 'MIRAE', 'EDELWEISS', 'INVESCO', 'MOTILAL OSWAL',
  'PGIM', 'CANARA ROBECO', 'BARODA BNP', 'BANDHAN', 'QUANT',
  'PPFAS', 'SUNDARAM', 'HSBC', 'MAHINDRA MANULIFE', 'TRUST'
];

class ISINIntelligenceService {
  
  /**
   * Verify ISIN checksum using Luhn algorithm (ISO 6166)
   * Reference: https://en.wikipedia.org/wiki/International_Securities_Identification_Number
   * 
   * Algorithm:
   * 1. Convert letters to numbers (A=10, B=11, ..., Z=35)
   * 2. Starting from the rightmost digit (second position), double every second digit
   * 3. Sum all digits (for doubled values >9, sum the individual digits)
   * 4. Check digit = (10 - (sum % 10)) % 10
   */
  verifyISINChecksum(isin: string): { valid: boolean; computedCheckDigit: number; providedCheckDigit: number } {
    if (!isin || isin.length !== 12) {
      return { valid: false, computedCheckDigit: -1, providedCheckDigit: -1 };
    }
    
    const upperISIN = isin.toUpperCase();
    const providedCheckDigit = parseInt(upperISIN.charAt(11), 10);
    
    if (isNaN(providedCheckDigit)) {
      return { valid: false, computedCheckDigit: -1, providedCheckDigit: -1 };
    }
    
    // Convert first 11 characters to numeric string (A=10, B=11, ..., Z=35)
    let numericString = '';
    for (let i = 0; i < 11; i++) {
      const char = upperISIN.charAt(i);
      if (char >= 'A' && char <= 'Z') {
        numericString += (char.charCodeAt(0) - 55).toString(); // A=10, B=11, etc.
      } else if (char >= '0' && char <= '9') {
        numericString += char;
      } else {
        return { valid: false, computedCheckDigit: -1, providedCheckDigit };
      }
    }
    
    // Apply Luhn algorithm
    // Start from the rightmost digit, double every SECOND digit (not the first)
    let sum = 0;
    const digits = numericString.split('').map(d => parseInt(d, 10));
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i];
      // Double every second digit from the right (odd positions when 0-indexed from right)
      // Position from right: 0, 1, 2, 3, ... - double positions 0, 2, 4, ...
      const positionFromRight = digits.length - 1 - i;
      if (positionFromRight % 2 === 0) {
        digit *= 2;
        if (digit > 9) {
          digit = Math.floor(digit / 10) + (digit % 10);
        }
      }
      sum += digit;
    }
    
    const computedCheckDigit = (10 - (sum % 10)) % 10;
    
    return {
      valid: computedCheckDigit === providedCheckDigit,
      computedCheckDigit,
      providedCheckDigit
    };
  }
  
  /**
   * Generate valid ISIN check digit for an 11-character ISIN prefix
   */
  generateISINCheckDigit(isinWithoutCheck: string): number {
    if (!isinWithoutCheck || isinWithoutCheck.length !== 11) {
      return -1;
    }
    
    const upperPrefix = isinWithoutCheck.toUpperCase();
    
    // Convert to numeric string
    let numericString = '';
    for (let i = 0; i < 11; i++) {
      const char = upperPrefix.charAt(i);
      if (char >= 'A' && char <= 'Z') {
        numericString += (char.charCodeAt(0) - 55).toString();
      } else if (char >= '0' && char <= '9') {
        numericString += char;
      } else {
        return -1;
      }
    }
    
    // Calculate check digit using Luhn
    let sum = 0;
    const digits = numericString.split('').map(d => parseInt(d, 10));
    
    // For check digit calculation, double starting from position 1 (second from right in final ISIN)
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i];
      const positionFromRight = digits.length - 1 - i;
      // Since check digit will be at position 0, positions shift by 1
      if ((positionFromRight + 1) % 2 === 0) {
        digit *= 2;
        if (digit > 9) {
          digit = Math.floor(digit / 10) + (digit % 10);
        }
      }
      sum += digit;
    }
    
    return (10 - (sum % 10)) % 10;
  }
  
  // Get region info from ISIN country prefix (first 2 characters)
  private getRegionFromISIN(isin: string): { region: 'APAC' | 'EMEA' | 'Americas' | 'Global' | null; country: string | null; exchange: string | null; marketType: 'domestic' | 'international' | 'gift_city' | null } {
    if (!isin || isin.length < 2) {
      return { region: null, country: null, exchange: null, marketType: null };
    }
    
    const countryCode = isin.substring(0, 2).toUpperCase();
    const countryInfo = ISIN_COUNTRY_MAP[countryCode];
    
    if (countryInfo) {
      const isIndian = countryCode === 'IN';
      return {
        region: countryInfo.region,
        country: countryInfo.country,
        exchange: countryInfo.exchanges[0] || null,
        marketType: isIndian ? 'domestic' : 'international'
      };
    }
    
    // Unknown country code
    return { region: 'Global', country: countryCode, exchange: null, marketType: 'international' };
  }
  
  async detectInstrument(isin: string, metadata?: ISINMetadata): Promise<ISINDetectionResult> {
    const validationErrors: string[] = [];
    
    if (!isin || isin.length !== 12) {
      return this.createUnknownResult(isin, ['Invalid ISIN length']);
    }
    
    const prefix = isin.substring(0, 3).toUpperCase() as 'INF' | 'INE' | 'INS' | 'INV' | 'INX';
    
    let result: ISINDetectionResult;
    
    switch (prefix) {
      case 'INF':
        result = this.detectMutualFundOrETF(isin, metadata, validationErrors);
        break;
      case 'INS':
        result = this.detectGovernmentSecurity(isin, metadata, validationErrors);
        break;
      case 'INV':
        result = this.detectSecuritisedInstrument(isin, metadata, validationErrors);
        break;
      case 'INX':
        result = this.detectEntitlementInstrument(isin, metadata, validationErrors);
        break;
      case 'INE':
        result = this.deepResolveINE(isin, metadata, validationErrors);
        break;
      default:
        result = this.createUnknownResult(isin, ['Unknown ISIN prefix']);
    }
    
    result.validationErrors = validationErrors;
    result.validationStatus = validationErrors.length === 0 ? 'validated' : 
                              validationErrors.some(e => e.includes('REJECT')) ? 'conflict' : 'validated';
    
    return result;
  }
  
  private detectMutualFundOrETF(isin: string, metadata: ISINMetadata | undefined, errors: string[]): ISINDetectionResult {
    if (metadata?.coupon) {
      errors.push('REJECT: INF prefix should not have coupon defined');
    }
    if (metadata?.maturityDate) {
      errors.push('WARNING: INF prefix typically does not have maturity date');
    }
    
    // ETF detection: Check metadata fields for ETF indicators
    // - scheme name containing 'ETF' or 'Exchange Traded'
    // - AMC name for ETF-specific AMCs (Nippon ETF, SBI ETF, etc.)
    // - explicit isETF flag in metadata
    const schemeName = (metadata?.schemeName || '').toUpperCase();
    const amcName = (metadata?.amcName || '').toUpperCase();
    
    const isETF = metadata?.isETF === true ||
      schemeName.includes('ETF') ||
      schemeName.includes('EXCHANGE TRADED') ||
      schemeName.includes('NIFTY BEES') ||
      schemeName.includes('GOLD BEES') ||
      schemeName.includes('JUNIOR BEES') ||
      schemeName.includes('BANK BEES') ||
      amcName.includes('ETF') ||
      (schemeName.includes('NIFTY') && schemeName.includes('INDEX'));
    
    return {
      isin,
      prefix: 'INF',
      instrumentFamily: 'mutual_fund',
      instrumentType: isETF ? 'ETF' : 'Mutual Fund',
      assetClass: 'Mutual Fund',
      subAssetClass: isETF ? 'Exchange Traded Fund' : 'Open-Ended Fund',
      primaryRegulator: 'SEBI',
      secondaryRegulator: null,
      issuerType: 'amc',
      riskLevel: 'moderate',
      isEdgeCase: false,
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 95
    };
  }
  
  private detectGovernmentSecurity(isin: string, metadata: ISINMetadata | undefined, errors: string[]): ISINDetectionResult {
    if (metadata?.issuerType && !['government'].includes(metadata.issuerType)) {
      errors.push('REJECT: INS prefix should have government issuer');
    }
    
    const isGoldLinked = metadata?.isGoldLinked || false;
    const isTBill = !metadata?.coupon && metadata?.maturityDate;
    
    let instrumentType = 'Government Security';
    let subAssetClass = 'G-Sec';
    let isEdgeCase = false;
    let edgeCaseType: 'SGB' | undefined;
    
    if (isGoldLinked) {
      instrumentType = 'Sovereign Gold Bond';
      subAssetClass = 'Gold-Linked Bond';
      isEdgeCase = true;
      edgeCaseType = 'SGB';
    } else if (isTBill) {
      instrumentType = 'Treasury Bill';
      subAssetClass = 'T-Bill';
    }
    
    return {
      isin,
      prefix: 'INS',
      instrumentFamily: 'government_security',
      instrumentType,
      assetClass: isGoldLinked ? 'Commodities' : 'Fixed Income',
      subAssetClass,
      primaryRegulator: 'RBI',
      secondaryRegulator: null,
      issuerType: 'government',
      riskLevel: 'low',
      isEdgeCase,
      edgeCaseType,
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 90,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private detectSecuritisedInstrument(isin: string, metadata: ISINMetadata | undefined, errors: string[]): ISINDetectionResult {
    if (!metadata?.issuerName) {
      errors.push('WARNING: INV prefix should have issuer name for securitised instruments');
    }
    
    return {
      isin,
      prefix: 'INV',
      instrumentFamily: 'securitised',
      instrumentType: 'Securitised Instrument',
      assetClass: 'Fixed Income',
      subAssetClass: 'Securitised Debt',
      primaryRegulator: 'SEBI',
      secondaryRegulator: 'RBI',
      issuerType: metadata?.issuerType || null,
      riskLevel: 'high',
      isEdgeCase: false,
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 85,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private detectEntitlementInstrument(isin: string, metadata: ISINMetadata | undefined, errors: string[]): ISINDetectionResult {
    if (metadata?.maturityDate) {
      errors.push('REJECT: INX prefix (entitlement) should have expiry_date, not maturity_date');
    }
    
    return {
      isin,
      prefix: 'INX',
      instrumentFamily: 'entitlement',
      instrumentType: 'Entitlement/Rights',
      assetClass: 'Equity',
      subAssetClass: 'Rights Entitlement',
      primaryRegulator: 'SEBI',
      secondaryRegulator: null,
      issuerType: 'corporate',
      riskLevel: 'high',
      isEdgeCase: false,
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 80,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private deepResolveINE(isin: string, metadata: ISINMetadata | undefined, errors: string[]): ISINDetectionResult {
    const issuerName = metadata?.issuerName?.toUpperCase() || '';
    const hasCoupon = metadata?.coupon !== undefined && metadata.coupon !== null;
    const hasEquityFlag = metadata?.hasEquityFlag || false;
    const isPerpetual = metadata?.isPerpetual || false;
    const isStructured = metadata?.isStructured || false;
    const hasMaturity = metadata?.maturityDate !== undefined;
    const isConvertible = metadata?.isConvertible || false;
    const trustType = metadata?.trustType;
    
    let detectedIssuerType: string | null = null;
    if (KNOWN_BANKS.some(b => issuerName.includes(b))) {
      detectedIssuerType = 'bank';
    } else if (KNOWN_NBFCS.some(n => issuerName.includes(n))) {
      detectedIssuerType = 'nbfc';
    } else if (metadata?.issuerType) {
      detectedIssuerType = metadata.issuerType;
    } else {
      detectedIssuerType = 'corporate';
    }
    
    if (hasCoupon && hasEquityFlag && !isConvertible) {
      errors.push('FLAG: INE has both coupon and equity_flag - may be convertible instrument');
    }
    
    if (trustType === 'REIT' || trustType === 'InvIT') {
      return this.createREITInvITResult(isin, trustType, errors);
    }
    
    if (isStructured && !hasCoupon) {
      return this.createMLDResult(isin, detectedIssuerType, errors);
    }
    
    if (detectedIssuerType === 'bank' && isPerpetual) {
      return this.createAT1Result(isin, errors);
    }
    
    if (detectedIssuerType === 'bank' && hasCoupon && hasMaturity) {
      return this.createBankBondResult(isin, isPerpetual, errors);
    }
    
    if ((detectedIssuerType === 'nbfc' || detectedIssuerType === 'corporate') && hasCoupon && hasMaturity) {
      return this.createNCDResult(isin, detectedIssuerType, metadata?.isSecured, errors);
    }
    
    if (isConvertible && hasCoupon && hasEquityFlag) {
      return this.createConvertibleResult(isin, errors);
    }
    
    if (hasEquityFlag || (!hasCoupon && !hasMaturity && !isStructured)) {
      return this.createEquityResult(isin, errors);
    }
    
    return {
      isin,
      prefix: 'INE',
      instrumentFamily: 'equity',
      instrumentType: 'Listed Security',
      assetClass: 'Equity',
      subAssetClass: 'Common Stock',
      primaryRegulator: 'SEBI',
      secondaryRegulator: null,
      issuerType: detectedIssuerType,
      riskLevel: 'high',
      isEdgeCase: false,
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 70,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private createMLDResult(isin: string, issuerType: string | null, errors: string[]): ISINDetectionResult {
    return {
      isin,
      prefix: 'INE',
      instrumentFamily: 'debt',
      instrumentType: 'Market Linked Debenture',
      assetClass: 'Fixed Income',
      subAssetClass: 'Structured Debt',
      primaryRegulator: 'SEBI',
      secondaryRegulator: null,
      issuerType,
      riskLevel: 'very_high',
      isEdgeCase: true,
      edgeCaseType: 'MLD',
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 85,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private createAT1Result(isin: string, errors: string[]): ISINDetectionResult {
    return {
      isin,
      prefix: 'INE',
      instrumentFamily: 'debt',
      instrumentType: 'AT1 Bond',
      assetClass: 'Fixed Income',
      subAssetClass: 'Bank Capital Instrument',
      primaryRegulator: 'RBI',
      secondaryRegulator: 'SEBI',
      issuerType: 'bank',
      riskLevel: 'very_high',
      isEdgeCase: true,
      edgeCaseType: 'AT1',
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 90,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private createBankBondResult(isin: string, isPerpetual: boolean, errors: string[]): ISINDetectionResult {
    return {
      isin,
      prefix: 'INE',
      instrumentFamily: 'debt',
      instrumentType: isPerpetual ? 'Tier-2 Perpetual Bond' : 'Bank Bond',
      assetClass: 'Fixed Income',
      subAssetClass: isPerpetual ? 'Perpetual Debt' : 'Bank Debt',
      primaryRegulator: 'RBI',
      secondaryRegulator: 'SEBI',
      issuerType: 'bank',
      riskLevel: isPerpetual ? 'very_high' : 'moderate',
      isEdgeCase: isPerpetual,
      edgeCaseType: isPerpetual ? 'PERPETUAL' : undefined,
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 88,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private createNCDResult(isin: string, issuerType: string, isSecured: boolean | undefined, errors: string[]): ISINDetectionResult {
    return {
      isin,
      prefix: 'INE',
      instrumentFamily: 'debt',
      instrumentType: issuerType === 'nbfc' ? 'NBFC NCD' : 'Corporate NCD',
      assetClass: 'Fixed Income',
      subAssetClass: 'Corporate Debt',
      primaryRegulator: issuerType === 'nbfc' ? 'RBI' : 'SEBI',
      secondaryRegulator: issuerType === 'nbfc' ? 'SEBI' : null,
      issuerType,
      riskLevel: isSecured ? 'moderate' : 'high',
      isEdgeCase: false,
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 85,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private createConvertibleResult(isin: string, errors: string[]): ISINDetectionResult {
    return {
      isin,
      prefix: 'INE',
      instrumentFamily: 'debt',
      instrumentType: 'Convertible Debenture',
      assetClass: 'Fixed Income',
      subAssetClass: 'Equity-Linked Debt',
      primaryRegulator: 'SEBI',
      secondaryRegulator: null,
      issuerType: 'corporate',
      riskLevel: 'high',
      isEdgeCase: true,
      edgeCaseType: 'CONVERTIBLE',
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 80,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private createREITInvITResult(isin: string, trustType: 'REIT' | 'InvIT', errors: string[]): ISINDetectionResult {
    return {
      isin,
      prefix: 'INE',
      instrumentFamily: 'trust_unit',
      instrumentType: trustType === 'REIT' ? 'REIT Unit' : 'InvIT Unit',
      assetClass: trustType === 'REIT' ? 'Real Estate' : 'Infrastructure',
      subAssetClass: 'Trust Unit',
      primaryRegulator: 'SEBI',
      secondaryRegulator: null,
      issuerType: 'trust',
      riskLevel: 'moderate',
      isEdgeCase: false,
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 92,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private createEquityResult(isin: string, errors: string[]): ISINDetectionResult {
    return {
      isin,
      prefix: 'INE',
      instrumentFamily: 'equity',
      instrumentType: 'Equity Share',
      assetClass: 'Equity',
      subAssetClass: 'Common Stock',
      primaryRegulator: 'SEBI',
      secondaryRegulator: null,
      issuerType: 'corporate',
      riskLevel: 'high',
      isEdgeCase: false,
      validationStatus: 'validated',
      validationErrors: errors,
      confidence: 75,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  private createUnknownResult(isin: string, errors: string[]): ISINDetectionResult {
    return {
      isin,
      prefix: 'UNKNOWN',
      instrumentFamily: 'unknown',
      instrumentType: 'Unknown',
      assetClass: 'Unknown',
      subAssetClass: 'Unknown',
      primaryRegulator: null,
      secondaryRegulator: null,
      issuerType: null,
      riskLevel: 'high',
      isEdgeCase: false,
      validationStatus: 'unknown',
      validationErrors: errors,
      confidence: 0,
      ...this.getRegionFromISIN(isin)
    };
  }
  
  async validateISIN(isin: string, metadata: ISINMetadata): Promise<{valid: boolean; errors: string[]; checksumValid?: boolean}> {
    const errors: string[] = [];
    
    // Basic format validation
    if (!isin || isin.length !== 12) {
      errors.push('ISIN must be exactly 12 characters');
      return { valid: false, errors, checksumValid: false };
    }
    
    // Checksum verification (ISO 6166 Luhn algorithm)
    const checksumResult = this.verifyISINChecksum(isin);
    if (!checksumResult.valid) {
      errors.push(`Invalid ISIN checksum: expected ${checksumResult.computedCheckDigit}, got ${checksumResult.providedCheckDigit}`);
    }
    
    // Country code validation
    const countryCode = isin.substring(0, 2).toUpperCase();
    if (!ISIN_COUNTRY_MAP[countryCode] && !countryCode.match(/^[A-Z]{2}$/)) {
      errors.push(`Invalid country code: ${countryCode}`);
    }
    
    const prefix = isin.substring(0, 3).toUpperCase();
    
    // Indian ISIN prefix-specific validation
    if (countryCode === 'IN') {
      switch (prefix) {
        case 'INF':
          if (metadata.coupon) errors.push('INF prefix should not have coupon');
          if (metadata.maturityDate) errors.push('INF prefix should not have maturity date');
          break;
        case 'INS':
          if (!metadata.maturityDate && !metadata.isGoldLinked) errors.push('INS prefix requires maturity date');
          if (metadata.issuerType && metadata.issuerType !== 'government') errors.push('INS must have government issuer');
          break;
        case 'INE':
          if (metadata.coupon && metadata.hasEquityFlag && !metadata.isConvertible) {
            errors.push('INE has both coupon and equity flag without convertible marker');
          }
          break;
        case 'INV':
          if (!metadata.issuerName) errors.push('INV requires issuer identification');
          break;
        case 'INX':
          if (metadata.maturityDate) errors.push('INX should have expiry date, not maturity date');
          break;
        default:
          if (!prefix.startsWith('IN')) {
            errors.push(`Unknown Indian ISIN prefix: ${prefix}`);
          }
      }
    }
    
    return { 
      valid: errors.length === 0, 
      errors,
      checksumValid: checksumResult.valid 
    };
  }
  
  async lookupISIN(isin: string): Promise<InstrumentMaster | null> {
    try {
      const [instrument] = await db
        .select()
        .from(instrumentMaster)
        .where(eq(instrumentMaster.isin, isin))
        .limit(1);
      return instrument || null;
    } catch (error) {
      console.error('[ISINIntelligence] Lookup error:', error);
      return null;
    }
  }
  
  async upsertInstrument(isin: string, detection: ISINDetectionResult, metadata?: ISINMetadata): Promise<InstrumentMaster | null> {
    try {
      const existingInstrument = await this.lookupISIN(isin);
      
      const instrumentData = {
        isin,
        isinPrefix: detection.prefix === 'UNKNOWN' ? null : detection.prefix,
        instrumentFamily: detection.instrumentFamily,
        issuerType: detection.issuerType,
        primaryRegulator: detection.primaryRegulator,
        secondaryRegulator: detection.secondaryRegulator,
        complianceRegime: this.determineComplianceRegime(detection),
        name: metadata?.issuerName || `${detection.instrumentType} - ${isin}`,
        assetClass: detection.assetClass.toLowerCase().replace(/\s+/g, '_'),
        subType: detection.subAssetClass.toLowerCase().replace(/\s+/g, '_'),
        riskLevel: detection.riskLevel,
        coupon: metadata?.coupon ? String(metadata.coupon) : null,
        maturityDate: metadata?.maturityDate || null,
        faceValue: metadata?.faceValue ? String(metadata.faceValue) : null,
        isPerpetual: metadata?.isPerpetual || false,
        isStructured: metadata?.isStructured || false,
        isGoldLinked: metadata?.isGoldLinked || false,
        isConvertible: metadata?.isConvertible || false,
        isSecured: metadata?.isSecured || false,
        hasEquityFlag: metadata?.hasEquityFlag || false,
        isEdgeCaseInstrument: detection.isEdgeCase,
        validationStatus: detection.validationStatus,
        validationNotes: detection.validationErrors.length > 0 ? detection.validationErrors.join('; ') : null,
        lastVerifiedAt: new Date(),
        updatedAt: new Date()
      };
      
      if (existingInstrument) {
        const [updated] = await db
          .update(instrumentMaster)
          .set(instrumentData)
          .where(eq(instrumentMaster.isin, isin))
          .returning();
        return updated;
      } else {
        const [inserted] = await db
          .insert(instrumentMaster)
          .values({
            ...instrumentData,
            issuer: metadata?.issuerName || null,
            firstSeenAt: new Date()
          })
          .returning();
        return inserted;
      }
    } catch (error) {
      console.error('[ISINIntelligence] Upsert error:', error);
      return null;
    }
  }
  
  private determineComplianceRegime(detection: ISINDetectionResult): string {
    if (detection.prefix === 'INF') return 'sebi_mf';
    if (detection.prefix === 'INS') return 'rbi_gsec';
    if (detection.primaryRegulator === 'RBI' && detection.secondaryRegulator === 'SEBI') return 'dual';
    if (detection.primaryRegulator === 'SEBI') return 'sebi_listed';
    if (detection.primaryRegulator === 'RBI') return 'rbi_bank_bond';
    return 'unknown';
  }
  
  getRegulatorInfo(detection: ISINDetectionResult): { primary: string; secondary: string | null; regime: string } {
    return {
      primary: detection.primaryRegulator || 'UNKNOWN',
      secondary: detection.secondaryRegulator,
      regime: this.determineComplianceRegime(detection)
    };
  }
}

export const isinIntelligenceService = new ISINIntelligenceService();
