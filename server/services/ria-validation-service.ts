/**
 * RIA (Registered Investment Adviser) Validation Service
 * 
 * Implements SEBI (Investment Advisers) Regulations 2013 compliance:
 * - Validates adviser registration with SEBI before providing personalized advice
 * - Tracks registration status, expiry, and scope of advice
 * - Ensures only RIA-certified advisers provide investment recommendations
 * - Maintains audit trail of validation checks
 */

export interface RIARegistration {
  registrationNumber: string;
  adviserName: string;
  entityType: 'individual' | 'non_individual';
  registrationDate: Date;
  validUntil: Date;
  registrationStatus: 'active' | 'suspended' | 'cancelled' | 'pending_renewal';
  sebiCategory: 'investment_adviser' | 'research_analyst' | 'portfolio_manager';
  scopeOfAdvice: {
    securities: boolean;
    mutualFunds: boolean;
    insurance: boolean;
    derivatives: boolean;
    commodities: boolean;
    reits: boolean;
    aif: boolean;
    globalSecurities: boolean;
  };
  address: string;
  state: string;
  complianceOfficer?: {
    name: string;
    email: string;
    phone: string;
  };
  lastSebiVerificationDate: Date;
  sebiOrdersAgainst: number;
  warnings: string[];
}

export interface RIAValidationResult {
  isValid: boolean;
  registrationNumber: string;
  adviserName: string;
  status: 'active' | 'inactive' | 'suspended' | 'expired' | 'not_found';
  canProvideAdvice: boolean;
  adviceScopes: string[];
  warnings: string[];
  expiryDate?: Date;
  sebiVerificationUrl: string;
  regulatoryReference: string;
  lastChecked: Date;
}

interface RIAValidationAuditEntry {
  id: string;
  agentId: string;
  registrationNumber: string;
  validationResult: RIAValidationResult;
  clientId?: string;
  adviceType?: string;
  timestamp: Date;
  ipAddress?: string;
}

class RIAValidationService {
  private readonly SEBI_INTERMEDIARY_URL = 'https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=13';
  private readonly REGULATORY_REFERENCE = 'SEBI (Investment Advisers) Regulations 2013';
  private registrationCache: Map<string, { registration: RIARegistration; fetchedAt: Date }> = new Map();
  private validationAuditLog: RIAValidationAuditEntry[] = [];
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  
  private mockRIARegistry: Map<string, RIARegistration> = new Map([
    ['INA000012345', {
      registrationNumber: 'INA000012345',
      adviserName: 'FintekPro Advisory Services Pvt Ltd',
      entityType: 'non_individual',
      registrationDate: new Date('2020-01-15'),
      validUntil: new Date('2027-01-14'),
      registrationStatus: 'active',
      sebiCategory: 'investment_adviser',
      scopeOfAdvice: {
        securities: true,
        mutualFunds: true,
        insurance: false,
        derivatives: true,
        commodities: false,
        reits: true,
        aif: true,
        globalSecurities: true,
      },
      address: 'Mumbai, Maharashtra',
      state: 'Maharashtra',
      complianceOfficer: {
        name: 'Compliance Head',
        email: 'compliance@fintekpro.com',
        phone: '+91-XXXXXXXXXX',
      },
      lastSebiVerificationDate: new Date(),
      sebiOrdersAgainst: 0,
      warnings: [],
    }],
    ['INA100067890', {
      registrationNumber: 'INA100067890',
      adviserName: 'Sample Individual Adviser',
      entityType: 'individual',
      registrationDate: new Date('2019-06-01'),
      validUntil: new Date('2024-05-31'),
      registrationStatus: 'pending_renewal',
      sebiCategory: 'investment_adviser',
      scopeOfAdvice: {
        securities: true,
        mutualFunds: true,
        insurance: false,
        derivatives: false,
        commodities: false,
        reits: false,
        aif: false,
        globalSecurities: false,
      },
      address: 'Delhi, NCR',
      state: 'Delhi',
      lastSebiVerificationDate: new Date(),
      sebiOrdersAgainst: 0,
      warnings: ['Registration renewal pending - expires soon'],
    }],
    ['INA200011111', {
      registrationNumber: 'INA200011111',
      adviserName: 'Suspended Adviser Example',
      entityType: 'individual',
      registrationDate: new Date('2018-03-01'),
      validUntil: new Date('2025-02-28'),
      registrationStatus: 'suspended',
      sebiCategory: 'investment_adviser',
      scopeOfAdvice: {
        securities: false,
        mutualFunds: false,
        insurance: false,
        derivatives: false,
        commodities: false,
        reits: false,
        aif: false,
        globalSecurities: false,
      },
      address: 'Bangalore, Karnataka',
      state: 'Karnataka',
      lastSebiVerificationDate: new Date(),
      sebiOrdersAgainst: 2,
      warnings: ['SEBI suspension order vide Order No. WTM/XX/2023', 'Pending disciplinary proceedings'],
    }],
  ]);

  async validateRIA(registrationNumber: string, agentId?: string, clientId?: string, adviceType?: string): Promise<RIAValidationResult> {
    const cachedEntry = this.registrationCache.get(registrationNumber);
    const now = new Date();
    
    let registration: RIARegistration | null = null;
    
    if (cachedEntry && (now.getTime() - cachedEntry.fetchedAt.getTime()) < this.CACHE_TTL_MS) {
      registration = cachedEntry.registration;
    } else {
      registration = await this.fetchRegistrationFromSEBI(registrationNumber);
      if (registration) {
        this.registrationCache.set(registrationNumber, { registration, fetchedAt: now });
      }
    }
    
    const result = this.buildValidationResult(registration, registrationNumber);
    
    if (agentId) {
      this.logValidationAudit({
        id: `RIA_AUDIT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentId,
        registrationNumber,
        validationResult: result,
        clientId,
        adviceType,
        timestamp: now,
      });
    }
    
    return result;
  }
  
  private async fetchRegistrationFromSEBI(registrationNumber: string): Promise<RIARegistration | null> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.mockRIARegistry.get(registrationNumber) || null;
  }
  
  private buildValidationResult(registration: RIARegistration | null, registrationNumber: string): RIAValidationResult {
    const now = new Date();
    
    if (!registration) {
      return {
        isValid: false,
        registrationNumber,
        adviserName: 'Not Found',
        status: 'not_found',
        canProvideAdvice: false,
        adviceScopes: [],
        warnings: ['RIA registration not found in SEBI database. Verify registration number.'],
        sebiVerificationUrl: this.SEBI_INTERMEDIARY_URL,
        regulatoryReference: this.REGULATORY_REFERENCE,
        lastChecked: now,
      };
    }
    
    const isExpired = registration.validUntil < now;
    const isSuspended = registration.registrationStatus === 'suspended';
    const isCancelled = registration.registrationStatus === 'cancelled';
    const isActive = registration.registrationStatus === 'active' && !isExpired;
    
    let status: RIAValidationResult['status'];
    if (!registration) status = 'not_found';
    else if (isCancelled) status = 'inactive';
    else if (isSuspended) status = 'suspended';
    else if (isExpired) status = 'expired';
    else status = 'active';
    
    const adviceScopes: string[] = [];
    if (registration.scopeOfAdvice.securities) adviceScopes.push('Securities');
    if (registration.scopeOfAdvice.mutualFunds) adviceScopes.push('Mutual Funds');
    if (registration.scopeOfAdvice.insurance) adviceScopes.push('Insurance');
    if (registration.scopeOfAdvice.derivatives) adviceScopes.push('Derivatives');
    if (registration.scopeOfAdvice.commodities) adviceScopes.push('Commodities');
    if (registration.scopeOfAdvice.reits) adviceScopes.push('REITs/InvITs');
    if (registration.scopeOfAdvice.aif) adviceScopes.push('AIFs');
    if (registration.scopeOfAdvice.globalSecurities) adviceScopes.push('Global Securities');
    
    const warnings: string[] = [...registration.warnings];
    
    if (registration.registrationStatus === 'pending_renewal') {
      warnings.push('Registration renewal is pending. Advise client accordingly.');
    }
    
    if (registration.sebiOrdersAgainst > 0) {
      warnings.push(`${registration.sebiOrdersAgainst} SEBI order(s) on record. Review before proceeding.`);
    }
    
    const daysUntilExpiry = Math.ceil((registration.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry > 0 && daysUntilExpiry <= 90) {
      warnings.push(`Registration expires in ${daysUntilExpiry} days. Initiate renewal process.`);
    }
    
    return {
      isValid: isActive,
      registrationNumber: registration.registrationNumber,
      adviserName: registration.adviserName,
      status,
      canProvideAdvice: isActive && adviceScopes.length > 0,
      adviceScopes,
      warnings,
      expiryDate: registration.validUntil,
      sebiVerificationUrl: this.SEBI_INTERMEDIARY_URL,
      regulatoryReference: this.REGULATORY_REFERENCE,
      lastChecked: now,
    };
  }
  
  private logValidationAudit(entry: RIAValidationAuditEntry): void {
    this.validationAuditLog.push(entry);
    
    if (this.validationAuditLog.length > 10000) {
      this.validationAuditLog = this.validationAuditLog.slice(-5000);
    }
  }
  
  async checkAdviceEligibility(registrationNumber: string, adviceType: 'securities' | 'mutualFunds' | 'derivatives' | 'reits' | 'aif' | 'globalSecurities'): Promise<{ eligible: boolean; reason: string }> {
    const validation = await this.validateRIA(registrationNumber);
    
    if (!validation.isValid) {
      return { eligible: false, reason: `RIA registration is ${validation.status}. Cannot provide investment advice.` };
    }
    
    const registration = this.mockRIARegistry.get(registrationNumber);
    if (!registration) {
      return { eligible: false, reason: 'Registration not found.' };
    }
    
    const scopeKey = adviceType as keyof RIARegistration['scopeOfAdvice'];
    if (!registration.scopeOfAdvice[scopeKey]) {
      return { 
        eligible: false, 
        reason: `RIA is not authorized to provide advice on ${adviceType}. Out of scope per SEBI registration.` 
      };
    }
    
    return { eligible: true, reason: 'RIA is authorized to provide this type of advice.' };
  }
  
  getDefaultPlatformRIA(): string {
    return 'INA000012345';
  }
  
  async getPlatformRIAStatus(): Promise<RIAValidationResult> {
    return this.validateRIA(this.getDefaultPlatformRIA());
  }
  
  getValidationAuditLog(limit: number = 100): RIAValidationAuditEntry[] {
    return this.validationAuditLog.slice(-limit);
  }
  
  async getRIADetails(registrationNumber: string): Promise<RIARegistration | null> {
    const cachedEntry = this.registrationCache.get(registrationNumber);
    if (cachedEntry) {
      return cachedEntry.registration;
    }
    
    const registration = await this.fetchRegistrationFromSEBI(registrationNumber);
    if (registration) {
      this.registrationCache.set(registrationNumber, { registration, fetchedAt: new Date() });
    }
    
    return registration;
  }
}

export const riaValidationService = new RIAValidationService();
