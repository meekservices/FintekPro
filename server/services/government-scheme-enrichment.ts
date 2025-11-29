import { storage } from '../storage';

export interface GovernmentSchemeProfile {
  userId: string;
  fullName: string;
  maskedPan: string;
  dateOfBirth: string | null;
  address: string | null;
  email: string | null;
  mobile: string | null;
}

export interface EnrichedSchemeData {
  isMock: boolean;
  dataConfidence: 'high' | 'medium' | 'low';
  dataSource: 'real' | 'government_api' | 'database';
  lastVerified: string | null;
  lastRefreshed: string | null;
  consentStatus: 'active' | 'expired' | 'none';
}

function maskPan(pan: string): string {
  if (!pan || pan.length < 10) return 'XXXXX****X';
  return `${pan.substring(0, 5)}****${pan.substring(9)}`;
}

function maskAccountNumber(accountNumber: string, visiblePrefix = 8): string {
  if (!accountNumber || accountNumber.length < visiblePrefix) return accountNumber;
  return `${accountNumber.substring(0, visiblePrefix)}****`;
}

export async function getGovernmentSchemeProfile(userId: string): Promise<GovernmentSchemeProfile | null> {
  try {
    const userProfile = await storage.getUserProfile(userId);
    
    if (!userProfile) {
      return null;
    }
    
    const nameParts = [
      userProfile.firstName,
      userProfile.middleName,
      userProfile.lastName
    ].filter(Boolean);
    
    const fullName = nameParts.length > 0 ? nameParts.join(' ') : 'Account Holder';
    
    const pan = userProfile.panNumber || '';
    const maskedPan = maskPan(pan);
    
    const addressParts = [
      userProfile.address,
      userProfile.city,
      userProfile.state,
      userProfile.pincode
    ].filter(Boolean);
    
    return {
      userId,
      fullName,
      maskedPan,
      dateOfBirth: userProfile.dateOfBirth || null,
      address: addressParts.length > 0 ? addressParts.join(', ') : null,
      email: null,
      mobile: null
    };
  } catch (error) {
    console.error('Error fetching government scheme profile:', error);
    return null;
  }
}

export interface EnrichedEpfHolding {
  id: string;
  userId: string;
  epfAccountNumber: string;
  maskedAccountNumber: string;
  employerName: string;
  memberName: string;
  employeeContribution: string;
  employerContribution: string;
  pensionContribution: string;
  totalBalance: string;
  interestEarned: string;
  interestRate: string;
  dateOfJoining: string | null;
  dateOfExit: string | null;
  isActive: boolean;
  nomineeName: string;
  nomineeRelationship: string;
  lastUpdated: Date | null;
  enrichment: EnrichedSchemeData;
}

export async function enrichEpfHoldings(userId: string, holdings: any[]): Promise<EnrichedEpfHolding[]> {
  const profile = await getGovernmentSchemeProfile(userId);
  
  if (!profile) {
    return holdings.map(h => ({
      ...h,
      maskedAccountNumber: h.epfAccountNumber ? maskAccountNumber(h.epfAccountNumber) : 'MH/XXX/****',
      enrichment: {
        isMock: false,
        dataConfidence: 'low' as const,
        dataSource: 'database' as const,
        lastVerified: null,
        lastRefreshed: null,
        consentStatus: 'none' as const
      }
    }));
  }
  
  return holdings.map(holding => {
    const hasRealData = holding.memberName && holding.employerName && holding.memberName !== 'Test User';
    
    return {
      ...holding,
      memberName: holding.memberName || profile.fullName,
      employerName: holding.employerName,
      nomineeName: holding.nomineeName,
      nomineeRelationship: holding.nomineeRelationship,
      maskedAccountNumber: holding.epfAccountNumber ? 
        maskAccountNumber(holding.epfAccountNumber) : 'MH/XXX/****',
      enrichment: {
        isMock: false,
        dataConfidence: hasRealData ? 'high' as const : 'medium' as const,
        dataSource: 'database' as const,
        lastVerified: holding.lastUpdated ? new Date(holding.lastUpdated).toISOString() : null,
        lastRefreshed: holding.lastUpdated ? new Date(holding.lastUpdated).toISOString() : null,
        consentStatus: 'active' as const
      }
    };
  });
}

export interface EnrichedPpfHolding {
  id: string;
  userId: string;
  ppfAccountNumber: string;
  maskedAccountNumber: string;
  accountHolderName: string;
  bankName: string;
  branchName: string;
  openingDate: string;
  maturityDate: string;
  currentBalance: string;
  totalDeposits: string;
  interestEarned: string;
  currentYearDeposit: string;
  interestRate: string;
  nomineeName: string;
  nomineeRelation: string;
  isActive: boolean;
  lastUpdated: Date | null;
  enrichment: EnrichedSchemeData;
}

export async function enrichPpfHoldings(userId: string, holdings: any[]): Promise<EnrichedPpfHolding[]> {
  const profile = await getGovernmentSchemeProfile(userId);
  
  if (!profile) {
    return holdings.map(h => ({
      ...h,
      maskedAccountNumber: h.ppfAccountNumber ? maskAccountNumber(h.ppfAccountNumber) : 'PPF/XXX/****',
      enrichment: {
        isMock: false,
        dataConfidence: 'low' as const,
        dataSource: 'database' as const,
        lastVerified: null,
        lastRefreshed: null,
        consentStatus: 'none' as const
      }
    }));
  }
  
  return holdings.map(holding => {
    const hasRealData = holding.accountHolderName && holding.accountHolderName !== 'Test User';
    
    return {
      ...holding,
      accountHolderName: holding.accountHolderName || profile.fullName,
      nomineeName: holding.nomineeName,
      nomineeRelation: holding.nomineeRelation,
      maskedAccountNumber: holding.ppfAccountNumber ? 
        maskAccountNumber(holding.ppfAccountNumber) : 'PPF/XXX/****',
      enrichment: {
        isMock: false,
        dataConfidence: hasRealData ? 'high' as const : 'medium' as const,
        dataSource: 'database' as const,
        lastVerified: holding.lastUpdated ? new Date(holding.lastUpdated).toISOString() : null,
        lastRefreshed: holding.lastUpdated ? new Date(holding.lastUpdated).toISOString() : null,
        consentStatus: 'active' as const
      }
    };
  });
}

export interface EnrichedNpsAccount {
  id: string;
  userId: string;
  pran: string;
  maskedPran: string;
  accountHolderName: string;
  dateOfBirth: string | null;
  registrationDate: string | null;
  tierIBalance: string;
  tierIContributions: string;
  tierIReturns: string;
  tierIAssetAllocation: any;
  tierIIBalance: string | null;
  tierIIContributions: string | null;
  tierIIReturns: string | null;
  tierIIAssetAllocation: any | null;
  totalBalance: string;
  totalContributions: string;
  totalReturns: string;
  returnsPercentage: string;
  fundManager: string;
  scheme: string;
  tier: string;
  nominee: string;
  nomineeRelation: string;
  status: string;
  lastContributionDate: string | null;
  lastUpdated: Date | null;
  enrichment: EnrichedSchemeData;
}

export async function enrichNpsAccounts(userId: string, accounts: any[]): Promise<EnrichedNpsAccount[]> {
  const profile = await getGovernmentSchemeProfile(userId);
  
  if (!profile) {
    return accounts.map(a => ({
      ...a,
      maskedPran: a.pran ? `${a.pran.substring(0, 4)}********` : '****XXXXXXXX',
      enrichment: {
        isMock: false,
        dataConfidence: 'low' as const,
        dataSource: 'database' as const,
        lastVerified: null,
        lastRefreshed: null,
        consentStatus: 'none' as const
      }
    }));
  }
  
  return accounts.map(account => {
    const hasRealData = account.accountHolderName && account.accountHolderName !== 'Test User';
    
    return {
      ...account,
      accountHolderName: account.accountHolderName || profile.fullName,
      maskedPran: account.pran ? `${account.pran.substring(0, 4)}********` : '****XXXXXXXX',
      nominee: account.nominee,
      nomineeRelation: account.nomineeRelation,
      enrichment: {
        isMock: false,
        dataConfidence: hasRealData ? 'high' as const : 'medium' as const,
        dataSource: 'database' as const,
        lastVerified: account.lastUpdated ? new Date(account.lastUpdated).toISOString() : null,
        lastRefreshed: account.lastUpdated ? new Date(account.lastUpdated).toISOString() : null,
        consentStatus: 'active' as const
      }
    };
  });
}

export interface EnrichedApyAccount {
  id: string;
  userId: string;
  pran: string;
  maskedPran: string;
  accountHolderName: string;
  dateOfBirth: string | null;
  enrollmentDate: string | null;
  pensionAmount: string;
  monthlyContribution: string;
  totalContribution: string;
  governmentContribution: string;
  totalBalance: string;
  enrollmentAge: number;
  maturityAge: number;
  yearsToMaturity: number;
  expectedMaturityDate: string | null;
  bankName: string;
  bankAccountNumber: string;
  maskedBankAccount: string;
  ifscCode: string;
  branchName: string;
  nominee: string;
  nomineeRelation: string;
  nomineeAge: number | null;
  status: string;
  lastContributionDate: string | null;
  lastUpdated: Date | null;
  enrichment: EnrichedSchemeData;
}

export async function enrichApyAccounts(userId: string, accounts: any[]): Promise<EnrichedApyAccount[]> {
  const profile = await getGovernmentSchemeProfile(userId);
  
  if (!profile) {
    return accounts.map(a => ({
      ...a,
      maskedPran: a.pran ? `${a.pran.substring(0, 4)}********` : '****XXXXXXXX',
      maskedBankAccount: a.bankAccountNumber ? `XXXX${a.bankAccountNumber.slice(-4)}` : 'XXXX****',
      enrichment: {
        isMock: false,
        dataConfidence: 'low' as const,
        dataSource: 'database' as const,
        lastVerified: null,
        lastRefreshed: null,
        consentStatus: 'none' as const
      }
    }));
  }
  
  return accounts.map(account => {
    const hasRealData = account.accountHolderName && account.accountHolderName !== 'Test User';
    
    return {
      ...account,
      accountHolderName: account.accountHolderName || profile.fullName,
      maskedPran: account.pran ? `${account.pran.substring(0, 4)}********` : '****XXXXXXXX',
      maskedBankAccount: account.bankAccountNumber ? 
        `XXXX${account.bankAccountNumber.slice(-4)}` : 'XXXX****',
      nominee: account.nominee,
      nomineeRelation: account.nomineeRelation,
      enrichment: {
        isMock: false,
        dataConfidence: hasRealData ? 'high' as const : 'medium' as const,
        dataSource: 'database' as const,
        lastVerified: account.lastUpdated ? new Date(account.lastUpdated).toISOString() : null,
        lastRefreshed: account.lastUpdated ? new Date(account.lastUpdated).toISOString() : null,
        consentStatus: 'active' as const
      }
    };
  });
}

export interface EnrichedEpsHolding {
  id: string;
  userId: string;
  epsAccountNumber: string;
  maskedAccountNumber: string;
  memberName: string;
  employerName: string;
  dateOfJoining: string | null;
  dateOfExit: string | null;
  totalServiceYears: number;
  pensionableService: number;
  expectedPension: string;
  isEligibleForPension: boolean;
  nomineeName: string;
  nomineeRelationship: string;
  status: string;
  lastUpdated: Date | null;
  enrichment: EnrichedSchemeData;
}

export async function enrichEpsHoldings(userId: string, holdings: any[]): Promise<EnrichedEpsHolding[]> {
  const profile = await getGovernmentSchemeProfile(userId);
  
  if (!profile) {
    return holdings.map(h => ({
      ...h,
      epsAccountNumber: h.pensionAccountNumber || h.epfAccountNumber,
      maskedAccountNumber: (h.pensionAccountNumber || h.epfAccountNumber) ? 
        maskAccountNumber(h.pensionAccountNumber || h.epfAccountNumber) : 'EPS/XXX/****',
      enrichment: {
        isMock: false,
        dataConfidence: 'low' as const,
        dataSource: 'database' as const,
        lastVerified: null,
        lastRefreshed: null,
        consentStatus: 'none' as const
      }
    }));
  }
  
  return holdings.map(holding => {
    const hasRealData = holding.currentEmployer && holding.currentEmployer !== 'TechCorp India Pvt Ltd';
    
    return {
      ...holding,
      epsAccountNumber: holding.pensionAccountNumber || holding.epfAccountNumber,
      memberName: profile.fullName,
      employerName: holding.currentEmployer,
      dateOfJoining: holding.serviceStartDate,
      totalServiceYears: holding.totalServiceYears,
      pensionableService: holding.totalServiceYears + (holding.totalServiceMonths || 0) / 12,
      expectedPension: holding.estimatedMonthlyPension,
      isEligibleForPension: holding.eligibleForPension,
      maskedAccountNumber: (holding.pensionAccountNumber || holding.epfAccountNumber) ? 
        maskAccountNumber(holding.pensionAccountNumber || holding.epfAccountNumber) : 'EPS/XXX/****',
      enrichment: {
        isMock: false,
        dataConfidence: hasRealData ? 'high' as const : 'medium' as const,
        dataSource: 'database' as const,
        lastVerified: holding.lastUpdated ? new Date(holding.lastUpdated).toISOString() : null,
        lastRefreshed: holding.lastUpdated ? new Date(holding.lastUpdated).toISOString() : null,
        consentStatus: 'active' as const
      }
    };
  });
}
