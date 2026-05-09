export type PanEntityType = 
  | 'individual' 
  | 'company' 
  | 'huf' 
  | 'firm_llp' 
  | 'trust' 
  | 'aop' 
  | 'boi' 
  | 'local_authority' 
  | 'artificial_juridical_person' 
  | 'government';

export type ClientCategory = 
  | 'individual' 
  | 'huf' 
  | 'corporate' 
  | 'firm_llp' 
  | 'trust' 
  | 'association' 
  | 'institutional';

export interface PanTypeInfo {
  code: string;
  entityType: PanEntityType;
  category: ClientCategory;
  displayName: string;
  description: string;
  canInvest: boolean;
  canTrade: boolean;
  productsAllowed: string[];
  onboardingMode: 'standard' | 'treasury_only' | 'restricted';
  requiresApproval: boolean;
}

const PAN_TYPE_MAP: Record<string, PanTypeInfo> = {
  'P': {
    code: 'P',
    entityType: 'individual',
    category: 'individual',
    displayName: 'Individual',
    description: 'Retail / HNI / sHNI / bHNI investor',
    canInvest: true,
    canTrade: true,
    productsAllowed: ['Mutual Funds', 'Equity', 'Bonds', 'IPO', 'ETF'],
    onboardingMode: 'standard',
    requiresApproval: false
  },
  'C': {
    code: 'C',
    entityType: 'company',
    category: 'corporate',
    displayName: 'Company',
    description: 'Private Limited / Public Limited Company',
    canInvest: true,
    canTrade: false,
    productsAllowed: ['Treasury Products', 'Liquid Funds', 'Debt Funds', 'Bonds'],
    onboardingMode: 'treasury_only',
    requiresApproval: true
  },
  'H': {
    code: 'H',
    entityType: 'huf',
    category: 'huf',
    displayName: 'HUF',
    description: 'Hindu Undivided Family',
    canInvest: true,
    canTrade: true,
    productsAllowed: ['Mutual Funds', 'Equity', 'Bonds'],
    onboardingMode: 'standard',
    requiresApproval: false
  },
  'F': {
    code: 'F',
    entityType: 'firm_llp',
    category: 'firm_llp',
    displayName: 'Firm / LLP',
    description: 'Partnership Firm or Limited Liability Partnership',
    canInvest: true,
    canTrade: false,
    productsAllowed: ['Treasury Products', 'Liquid Funds', 'Debt Funds', 'Bonds'],
    onboardingMode: 'treasury_only',
    requiresApproval: true
  },
  'T': {
    code: 'T',
    entityType: 'trust',
    category: 'trust',
    displayName: 'Trust',
    description: 'Private Trust / Charitable Trust',
    canInvest: true,
    canTrade: false,
    productsAllowed: ['Treasury Products', 'Liquid Funds', 'Debt Funds'],
    onboardingMode: 'treasury_only',
    requiresApproval: true
  },
  'A': {
    code: 'A',
    entityType: 'aop',
    category: 'association',
    displayName: 'AOP',
    description: 'Association of Persons',
    canInvest: true,
    canTrade: false,
    productsAllowed: ['Treasury Products', 'Liquid Funds'],
    onboardingMode: 'treasury_only',
    requiresApproval: true
  },
  'B': {
    code: 'B',
    entityType: 'boi',
    category: 'association',
    displayName: 'BOI',
    description: 'Body of Individuals',
    canInvest: true,
    canTrade: false,
    productsAllowed: ['Treasury Products', 'Liquid Funds'],
    onboardingMode: 'treasury_only',
    requiresApproval: true
  },
  'L': {
    code: 'L',
    entityType: 'local_authority',
    category: 'institutional',
    displayName: 'Local Authority',
    description: 'Municipal Corporation / Panchayat etc.',
    canInvest: true,
    canTrade: false,
    productsAllowed: ['Government Securities', 'Treasury Products'],
    onboardingMode: 'restricted',
    requiresApproval: true
  },
  'J': {
    code: 'J',
    entityType: 'artificial_juridical_person',
    category: 'institutional',
    displayName: 'Artificial Juridical Person',
    description: 'Statutory Body / Autonomous Body',
    canInvest: true,
    canTrade: false,
    productsAllowed: ['Government Securities', 'Treasury Products'],
    onboardingMode: 'restricted',
    requiresApproval: true
  },
  'G': {
    code: 'G',
    entityType: 'government',
    category: 'institutional',
    displayName: 'Government',
    description: 'Central / State Government Entity',
    canInvest: true,
    canTrade: false,
    productsAllowed: ['Government Securities', 'Treasury Products'],
    onboardingMode: 'restricted',
    requiresApproval: true
  }
};

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function validatePanFormat(pan: string): { valid: boolean; error?: string } {
  if (!pan) {
    return { valid: false, error: 'PAN number is required' };
  }
  
  const normalizedPan = pan.toUpperCase().trim();
  
  if (normalizedPan.length !== 10) {
    return { valid: false, error: 'PAN must be exactly 10 characters' };
  }
  
  if (!PAN_REGEX.test(normalizedPan)) {
    return { valid: false, error: 'Invalid PAN format. Expected: AAAAA9999A' };
  }
  
  const typeChar = normalizedPan.charAt(3);
  if (!PAN_TYPE_MAP[typeChar]) {
    return { valid: false, error: `Unknown PAN type code: ${typeChar}` };
  }
  
  return { valid: true };
}

export function extractPanTypeCode(pan: string): string | null {
  const normalizedPan = pan.toUpperCase().trim();
  if (normalizedPan.length < 4) return null;
  return normalizedPan.charAt(3);
}

export function getPanTypeInfo(pan: string): PanTypeInfo | null {
  const typeCode = extractPanTypeCode(pan);
  if (!typeCode) return null;
  return PAN_TYPE_MAP[typeCode] || null;
}

export function getPanTypeInfoByCode(code: string): PanTypeInfo | null {
  return PAN_TYPE_MAP[code.toUpperCase()] || null;
}

export function getAllPanTypes(): PanTypeInfo[] {
  return Object.values(PAN_TYPE_MAP);
}

export function getOnboardableEntityTypes(): PanTypeInfo[] {
  return Object.values(PAN_TYPE_MAP).filter(
    t => t.onboardingMode !== 'restricted'
  );
}

export function isIndividualPan(pan: string): boolean {
  const typeCode = extractPanTypeCode(pan);
  return typeCode === 'P';
}

export function isCorporatePan(pan: string): boolean {
  const typeCode = extractPanTypeCode(pan);
  return typeCode === 'C';
}

export function isHufPan(pan: string): boolean {
  const typeCode = extractPanTypeCode(pan);
  return typeCode === 'H';
}

export function isFirmOrLlpPan(pan: string): boolean {
  const typeCode = extractPanTypeCode(pan);
  return typeCode === 'F';
}

export function isTrustPan(pan: string): boolean {
  const typeCode = extractPanTypeCode(pan);
  return typeCode === 'T';
}

export function isEntityPan(pan: string): boolean {
  const typeCode = extractPanTypeCode(pan);
  return typeCode !== null && typeCode !== 'P';
}

export function requiresTreasuryMode(pan: string): boolean {
  const info = getPanTypeInfo(pan);
  return info?.onboardingMode === 'treasury_only' || info?.onboardingMode === 'restricted';
}

export function getClientCapabilities(pan: string): {
  canInvest: boolean;
  canTrade: boolean;
  productsAllowed: string[];
  requiresApproval: boolean;
} {
  const info = getPanTypeInfo(pan);
  if (!info) {
    return {
      canInvest: false,
      canTrade: false,
      productsAllowed: [],
      requiresApproval: true
    };
  }
  
  return {
    canInvest: info.canInvest,
    canTrade: info.canTrade,
    productsAllowed: info.productsAllowed,
    requiresApproval: info.requiresApproval
  };
}

export function maskPanNumber(pan: string): string {
  if (!pan || pan.length !== 10) return pan;
  return `${pan.substring(0, 4)}****${pan.substring(8)}`;
}
