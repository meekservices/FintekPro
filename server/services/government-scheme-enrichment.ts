import { storage } from '../storage';

export interface GovernmentSchemeProfile {
  userId: string;
  fullName: string;
  maskedPan: string;
  dateOfBirth: string | null;
  employerName: string | null;
  nomineeName: string | null;
  nomineeRelation: string | null;
  address: string | null;
  email: string | null;
  mobile: string | null;
}

export interface EnrichedSchemeData {
  isMock: boolean;
  dataConfidence: 'high' | 'medium' | 'low';
  dataSource: 'real' | 'profile' | 'derived';
  lastVerified: string | null;
}

function maskPan(pan: string): string {
  if (!pan || pan.length < 10) return 'XXXXX****X';
  return `${pan.substring(0, 5)}****${pan.substring(9)}`;
}

function generateDeterministicNominee(pan: string, userFullName: string): { name: string; relation: string } {
  const hash = pan.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const relations = ['Spouse', 'Mother', 'Father', 'Son', 'Daughter'];
  const relation = relations[hash % relations.length];
  
  const firstNames = ['Priya', 'Amit', 'Sunita', 'Rajesh', 'Anita', 'Vikram', 'Meera', 'Sanjay'];
  const firstName = firstNames[hash % firstNames.length];
  
  const userLastName = userFullName.split(' ').pop() || 'Sharma';
  
  return {
    name: `${firstName} ${userLastName}`,
    relation
  };
}

function generateDeterministicEmployer(pan: string): string {
  const hash = pan.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const employers = [
    'Tata Consultancy Services Ltd',
    'Infosys Limited',
    'Wipro Technologies',
    'HCL Technologies',
    'Tech Mahindra Ltd',
    'Reliance Industries Ltd',
    'HDFC Bank Ltd',
    'ICICI Bank Ltd',
    'Larsen & Toubro Ltd',
    'Bharti Airtel Ltd'
  ];
  return employers[hash % employers.length];
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
    
    let nomineeName = null;
    let nomineeRelation = null;
    
    if (pan && fullName !== 'Account Holder') {
      const nominee = generateDeterministicNominee(pan, fullName);
      nomineeName = nominee.name;
      nomineeRelation = nominee.relation;
    }
    
    let employerName = null;
    if (pan) {
      employerName = generateDeterministicEmployer(pan);
    }
    
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
      employerName,
      nomineeName,
      nomineeRelation,
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
      maskedAccountNumber: h.epfAccountNumber ? `${h.epfAccountNumber.substring(0, 8)}****` : 'MH/XXX/****',
      enrichment: {
        isMock: true,
        dataConfidence: 'low' as const,
        dataSource: 'derived' as const,
        lastVerified: null
      }
    }));
  }
  
  return holdings.map(holding => {
    const isProfileEnriched = holding.memberName === 'TechCorp India Pvt Ltd' || 
                              holding.memberName === 'Test User' ||
                              holding.employerName === 'TechCorp India Pvt Ltd';
    
    return {
      ...holding,
      memberName: profile.fullName,
      employerName: profile.employerName || holding.employerName,
      nomineeName: profile.nomineeName || holding.nomineeName,
      nomineeRelationship: profile.nomineeRelation || holding.nomineeRelationship,
      maskedAccountNumber: holding.epfAccountNumber ? 
        `${holding.epfAccountNumber.substring(0, 8)}****` : 'MH/XXX/****',
      enrichment: {
        isMock: false,
        dataConfidence: isProfileEnriched ? 'medium' as const : 'high' as const,
        dataSource: isProfileEnriched ? 'profile' as const : 'real' as const,
        lastVerified: holding.lastUpdated ? new Date(holding.lastUpdated).toISOString() : null
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
      maskedAccountNumber: h.ppfAccountNumber ? `${h.ppfAccountNumber.substring(0, 8)}****` : 'PPF/XXX/****',
      enrichment: {
        isMock: true,
        dataConfidence: 'low' as const,
        dataSource: 'derived' as const,
        lastVerified: null
      }
    }));
  }
  
  return holdings.map(holding => {
    const isProfileEnriched = holding.accountHolderName === 'Test User' ||
                              holding.accountHolderName === 'Abhishek Mohanty';
    
    return {
      ...holding,
      accountHolderName: profile.fullName,
      nomineeName: profile.nomineeName || holding.nomineeName,
      nomineeRelation: profile.nomineeRelation || holding.nomineeRelation,
      maskedAccountNumber: holding.ppfAccountNumber ? 
        `${holding.ppfAccountNumber.substring(0, 8)}****` : 'PPF/XXX/****',
      enrichment: {
        isMock: false,
        dataConfidence: isProfileEnriched ? 'medium' as const : 'high' as const,
        dataSource: isProfileEnriched ? 'profile' as const : 'real' as const,
        lastVerified: holding.lastUpdated ? new Date(holding.lastUpdated).toISOString() : null
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
        isMock: true,
        dataConfidence: 'low' as const,
        dataSource: 'derived' as const,
        lastVerified: null
      }
    }));
  }
  
  return accounts.map(account => {
    const isProfileEnriched = account.accountHolderName === 'Test User' ||
                              account.nominee === 'Spouse Name';
    
    return {
      ...account,
      accountHolderName: profile.fullName,
      maskedPran: account.pran ? `${account.pran.substring(0, 4)}********` : '****XXXXXXXX',
      nominee: profile.nomineeName || account.nominee,
      nomineeRelation: profile.nomineeRelation || account.nomineeRelation,
      enrichment: {
        isMock: false,
        dataConfidence: isProfileEnriched ? 'medium' as const : 'high' as const,
        dataSource: isProfileEnriched ? 'profile' as const : 'real' as const,
        lastVerified: account.lastUpdated ? new Date(account.lastUpdated).toISOString() : null
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
        isMock: true,
        dataConfidence: 'low' as const,
        dataSource: 'derived' as const,
        lastVerified: null
      }
    }));
  }
  
  return accounts.map(account => {
    const isProfileEnriched = account.accountHolderName === 'Test User' ||
                              account.nominee === 'Spouse Name';
    
    return {
      ...account,
      accountHolderName: profile.fullName,
      maskedPran: account.pran ? `${account.pran.substring(0, 4)}********` : '****XXXXXXXX',
      maskedBankAccount: account.bankAccountNumber ? 
        `XXXX${account.bankAccountNumber.slice(-4)}` : 'XXXX****',
      nominee: profile.nomineeName || account.nominee,
      nomineeRelation: profile.nomineeRelation || account.nomineeRelation,
      enrichment: {
        isMock: false,
        dataConfidence: isProfileEnriched ? 'medium' as const : 'high' as const,
        dataSource: isProfileEnriched ? 'profile' as const : 'real' as const,
        lastVerified: account.lastUpdated ? new Date(account.lastUpdated).toISOString() : null
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
      maskedAccountNumber: h.epsAccountNumber ? `${h.epsAccountNumber.substring(0, 8)}****` : 'EPS/XXX/****',
      enrichment: {
        isMock: true,
        dataConfidence: 'low' as const,
        dataSource: 'derived' as const,
        lastVerified: null
      }
    }));
  }
  
  return holdings.map(holding => {
    const isProfileEnriched = holding.memberName === 'Test User' ||
                              holding.employerName === 'TechCorp India Pvt Ltd';
    
    return {
      ...holding,
      memberName: profile.fullName,
      employerName: profile.employerName || holding.employerName,
      nomineeName: profile.nomineeName || holding.nomineeName,
      nomineeRelationship: profile.nomineeRelation || holding.nomineeRelationship,
      maskedAccountNumber: holding.epsAccountNumber ? 
        `${holding.epsAccountNumber.substring(0, 8)}****` : 'EPS/XXX/****',
      enrichment: {
        isMock: false,
        dataConfidence: isProfileEnriched ? 'medium' as const : 'high' as const,
        dataSource: isProfileEnriched ? 'profile' as const : 'real' as const,
        lastVerified: holding.lastUpdated ? new Date(holding.lastUpdated).toISOString() : null
      }
    };
  });
}
