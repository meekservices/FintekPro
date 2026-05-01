/**
 * FATCA/CRS Compliance Service
 * 
 * Foreign Account Tax Compliance Act (FATCA) and 
 * Common Reporting Standard (CRS) compliance management
 * 
 * Features:
 * - Tax residency status tracking
 * - US Person identification
 * - Self-certification form management
 * - Annual reporting generation
 * - W-8BEN/W-9 form tracking
 * - Multi-jurisdiction tax reporting
 */

import { db } from '../db';
import { users, complianceAuditTrail, complianceDocuments } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ==================== TYPES ====================

export interface FATCAStatus {
  userId: string;
  isUSPerson: boolean;
  usTINProvided: boolean;
  w8benSubmitted: boolean;
  w9Submitted: boolean;
  fatcaStatus: 'compliant' | 'non_compliant' | 'pending' | 'exempt';
  exemptionCode?: string;
  lastCertificationDate: Date | null;
  nextCertificationDue: Date | null;
  complianceIssues: string[];
}

export interface CRSStatus {
  userId: string;
  taxResidencies: TaxResidency[];
  selfCertificationDate: Date | null;
  selfCertificationValid: boolean;
  crsStatus: 'compliant' | 'non_compliant' | 'pending' | 'not_applicable';
  reportingJurisdictions: string[];
  lastReportDate: Date | null;
  nextReportDue: Date | null;
  complianceIssues: string[];
}

export interface TaxResidency {
  countryCode: string;
  countryName: string;
  tinNumber?: string;
  tinNotAvailable?: boolean;
  tinNotAvailableReason?: 'country_no_tin' | 'not_issued' | 'pending';
  isPrimaryResidence: boolean;
  startDate: Date;
  endDate?: Date;
}

export interface SelfCertificationForm {
  formId: string;
  userId: string;
  formType: 'individual' | 'entity' | 'controlling_person';
  taxResidencies: TaxResidency[];
  isUSPerson: boolean;
  usIndicia: string[];
  declarations: {
    accuracyDeclaration: boolean;
    updateCommitment: boolean;
    consentToShare: boolean;
  };
  submittedAt: Date;
  validUntil: Date;
  status: 'active' | 'expired' | 'superseded';
  documentUrl?: string;
}

export interface AnnualCRSReport {
  reportId: string;
  reportYear: number;
  reportingJurisdiction: string;
  generatedAt: Date;
  submittedAt?: Date;
  status: 'draft' | 'generated' | 'submitted' | 'acknowledged';
  accountHolders: ReportableAccount[];
  totalAccounts: number;
  totalValue: number;
  currency: string;
}

export interface ReportableAccount {
  accountHolderId: string;
  accountNumber: string;
  accountType: 'custodial' | 'depository' | 'equity' | 'debt';
  accountBalance: number;
  currency: string;
  taxResidenceCountry: string;
  tinNumber?: string;
  interestPaid?: number;
  dividendsPaid?: number;
  grossProceeds?: number;
}

// ==================== CONSTANTS ====================

const US_INDICIA = [
  'us_citizenship',
  'us_green_card',
  'us_birth_place',
  'us_address',
  'us_phone_number',
  'us_power_of_attorney',
  'us_care_of_address',
  'standing_instructions_us'
];

const CRS_PARTICIPATING_JURISDICTIONS = [
  'IN', 'GB', 'DE', 'FR', 'AU', 'SG', 'HK', 'JP', 'CA', 'AE', 'SA', 'CH', 
  'NL', 'BE', 'IT', 'ES', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'LU', 'NZ'
];

const FORM_VALIDITY_YEARS = 3;

// ==================== FATCA/CRS SERVICE ====================

class FATCACRSService {

  /**
   * Get FATCA compliance status for a user
   */
  async getFATCAStatus(userId: string): Promise<FATCAStatus> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return {
        userId,
        isUSPerson: false,
        usTINProvided: false,
        w8benSubmitted: false,
        w9Submitted: false,
        fatcaStatus: 'pending',
        lastCertificationDate: null,
        nextCertificationDue: null,
        complianceIssues: ['User not found']
      };
    }

    const issues: string[] = [];
    const isUSPerson = user.isUSPerson || false;
    const usTINProvided = !!user.fatcaTinNumber;

    // Check for required documents
    const w8benDocs = await db.select()
      .from(complianceDocuments)
      .where(
        and(
          eq(complianceDocuments.userId, userId),
          eq(complianceDocuments.documentType, 'fatca_w8ben'),
          eq(complianceDocuments.verificationStatus, 'verified')
        )
      );

    const w9Docs = await db.select()
      .from(complianceDocuments)
      .where(
        and(
          eq(complianceDocuments.userId, userId),
          eq(complianceDocuments.documentType, 'fatca_w9'),
          eq(complianceDocuments.verificationStatus, 'verified')
        )
      );

    const w8benSubmitted = w8benDocs.length > 0;
    const w9Submitted = w9Docs.length > 0;

    // Determine compliance status
    if (isUSPerson) {
      if (!w9Submitted) {
        issues.push('W-9 form required for US Person');
      }
      if (!usTINProvided) {
        issues.push('US Tax Identification Number required');
      }
    } else {
      if (!w8benSubmitted) {
        issues.push('W-8BEN form required for non-US Person');
      }
    }

    let fatcaStatus: FATCAStatus['fatcaStatus'] = 'compliant';
    if (issues.length > 0) {
      fatcaStatus = 'non_compliant';
    } else if (!w8benSubmitted && !w9Submitted) {
      fatcaStatus = 'pending';
    }

    // Calculate certification dates
    const lastDoc = [...w8benDocs, ...w9Docs].sort((a, b) => 
      (b.verificationDate?.getTime() || 0) - (a.verificationDate?.getTime() || 0)
    )[0];

    const lastCertificationDate = lastDoc?.verificationDate || null;
    let nextCertificationDue: Date | null = null;
    if (lastCertificationDate) {
      nextCertificationDue = new Date(lastCertificationDate);
      nextCertificationDue.setFullYear(nextCertificationDue.getFullYear() + FORM_VALIDITY_YEARS);
    }

    return {
      userId,
      isUSPerson,
      usTINProvided,
      w8benSubmitted,
      w9Submitted,
      fatcaStatus,
      lastCertificationDate,
      nextCertificationDue,
      complianceIssues: issues
    };
  }

  /**
   * Get CRS compliance status for a user
   */
  async getCRSStatus(userId: string): Promise<CRSStatus> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return {
        userId,
        taxResidencies: [],
        selfCertificationDate: null,
        selfCertificationValid: false,
        crsStatus: 'pending',
        reportingJurisdictions: [],
        lastReportDate: null,
        nextReportDue: null,
        complianceIssues: ['User not found']
      };
    }

    const issues: string[] = [];
    const taxResidencies: TaxResidency[] = [];

    // Add primary tax residence
    if (user.taxResidencyCountry) {
      taxResidencies.push({
        countryCode: user.taxResidencyCountry,
        countryName: user.taxResidencyCountry,
        tinNumber: user.fatcaTinNumber || undefined,
        isPrimaryResidence: true,
        startDate: user.createdAt || new Date()
      });
    } else {
      issues.push('Tax residency country not declared');
    }

    // Check self-certification
    const selfCertDocs = await db.select()
      .from(complianceDocuments)
      .where(
        and(
          eq(complianceDocuments.userId, userId),
          eq(complianceDocuments.documentType, 'crs_self_certification'),
          eq(complianceDocuments.verificationStatus, 'verified')
        )
      );

    const latestCert = selfCertDocs[0];
    const selfCertificationDate = latestCert?.verificationDate || null;
    
    let selfCertificationValid = false;
    if (selfCertificationDate) {
      const validUntil = new Date(selfCertificationDate);
      validUntil.setFullYear(validUntil.getFullYear() + FORM_VALIDITY_YEARS);
      selfCertificationValid = validUntil > new Date();
    }

    if (!selfCertificationValid) {
      issues.push('Self-certification form required or expired');
    }

    // Determine reporting jurisdictions
    const reportingJurisdictions = taxResidencies
      .filter(tr => CRS_PARTICIPATING_JURISDICTIONS.includes(tr.countryCode))
      .map(tr => tr.countryCode);

    // Determine CRS status
    let crsStatus: CRSStatus['crsStatus'] = 'compliant';
    if (user.residentStatus === 'resident' && user.nationality === 'IN') {
      crsStatus = 'not_applicable'; // Indian resident, no CRS reporting needed
    } else if (issues.length > 0) {
      crsStatus = 'non_compliant';
    } else if (!selfCertificationValid) {
      crsStatus = 'pending';
    }

    // Calculate next report due
    const lastReportDate: Date | null = null;
    let nextReportDue: Date | null = null;
    if (reportingJurisdictions.length > 0) {
      nextReportDue = new Date();
      nextReportDue.setMonth(5); // June
      nextReportDue.setDate(30);
      if (nextReportDue < new Date()) {
        nextReportDue.setFullYear(nextReportDue.getFullYear() + 1);
      }
    }

    return {
      userId,
      taxResidencies,
      selfCertificationDate,
      selfCertificationValid,
      crsStatus,
      reportingJurisdictions,
      lastReportDate,
      nextReportDue,
      complianceIssues: issues
    };
  }

  /**
   * Submit self-certification form
   */
  async submitSelfCertification(params: {
    userId: string;
    formType: SelfCertificationForm['formType'];
    taxResidencies: Omit<TaxResidency, 'startDate'>[];
    isUSPerson: boolean;
    usIndicia: string[];
    documentUrl?: string;
  }): Promise<SelfCertificationForm> {
    const formId = `CERT-${Date.now()}-${nanoid(8)}`;
    const submittedAt = new Date();
    const validUntil = new Date(submittedAt);
    validUntil.setFullYear(validUntil.getFullYear() + FORM_VALIDITY_YEARS);

    const form: SelfCertificationForm = {
      formId,
      userId: params.userId,
      formType: params.formType,
      taxResidencies: params.taxResidencies.map(tr => ({
        ...tr,
        startDate: submittedAt
      })),
      isUSPerson: params.isUSPerson,
      usIndicia: params.usIndicia,
      declarations: {
        accuracyDeclaration: true,
        updateCommitment: true,
        consentToShare: true
      },
      submittedAt,
      validUntil,
      status: 'active',
      documentUrl: params.documentUrl
    };

    // Store in compliance documents
    await db.insert(complianceDocuments).values({
      userId: params.userId,
      documentType: 'crs_self_certification',
      documentNumber: formId,
      documentUrl: params.documentUrl,
      verificationStatus: 'verified',
      verificationDate: submittedAt,
      expiryDate: validUntil,
      metadata: form
    });

    // Update user FATCA fields
    if (params.taxResidencies.length > 0) {
      const primaryResidence = params.taxResidencies.find(tr => tr.isPrimaryResidence) || params.taxResidencies[0];
      await db.update(users)
        .set({
          taxResidencyCountry: primaryResidence.countryCode,
          fatcaTinNumber: primaryResidence.tinNumber || null,
          isUSPerson: params.isUSPerson,
          fatcaStatus: params.isUSPerson ? 'us_person' : 'non_us_person',
          fatcaCountryOfTaxResidence: primaryResidence.countryCode,
          updatedAt: new Date()
        })
        .where(eq(users.id, params.userId));
    }

    // Log the submission
    await this.logFATCACRSEvent(params.userId, 'self_certification_submitted', {
      formId,
      formType: params.formType,
      taxResidencies: params.taxResidencies.length,
      isUSPerson: params.isUSPerson
    });

    return form;
  }

  /**
   * Check for US Indicia
   */
  async checkUSIndicia(userId: string): Promise<{
    hasUSIndicia: boolean;
    indiciaFound: string[];
    cureRequired: boolean;
    recommendations: string[];
  }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return {
        hasUSIndicia: false,
        indiciaFound: [],
        cureRequired: false,
        recommendations: ['User not found']
      };
    }

    const indiciaFound: string[] = [];
    const recommendations: string[] = [];

    // Check US citizenship
    if (user.isUSPerson) {
      indiciaFound.push('us_citizenship');
    }

    // Check US address
    if (user.country?.toUpperCase() === 'US' || user.countryOfResidence?.toUpperCase() === 'US') {
      indiciaFound.push('us_address');
    }

    // Check US phone number
    if (user.mobile?.startsWith('+1')) {
      indiciaFound.push('us_phone_number');
    }

    // Check birthplace (if available)
    if (user.nationality?.toUpperCase() === 'US') {
      indiciaFound.push('us_birth_place');
    }

    const hasUSIndicia = indiciaFound.length > 0;
    const cureRequired = hasUSIndicia && !user.fatcaTinNumber;

    if (hasUSIndicia) {
      recommendations.push('Provide W-9 form');
      recommendations.push('Provide US Tax Identification Number (TIN/SSN)');
    } else {
      recommendations.push('Provide W-8BEN form');
    }

    return {
      hasUSIndicia,
      indiciaFound,
      cureRequired,
      recommendations
    };
  }

  /**
   * Generate annual CRS report for a jurisdiction
   */
  async generateCRSReport(
    reportYear: number,
    reportingJurisdiction: string
  ): Promise<AnnualCRSReport> {
    const reportId = `CRS-${reportingJurisdiction}-${reportYear}-${nanoid(6)}`;

    // Get all users with tax residence in the reporting jurisdiction
    const usersInJurisdiction = await db.select()
      .from(users)
      .where(eq(users.taxResidencyCountry, reportingJurisdiction));

    const reportableAccounts: ReportableAccount[] = [];
    let totalValue = 0;

    for (const user of usersInJurisdiction) {
      // Skip Indian residents if reporting to foreign jurisdictions
      if (user.residentStatus === 'resident' && reportingJurisdiction !== 'IN') {
        continue;
      }

      // Create reportable account record
      const account: ReportableAccount = {
        accountHolderId: user.id,
        accountNumber: user.nsdlClientId || user.cdslBoId || user.bankAccountNumber || '',
        accountType: 'custodial',
        accountBalance: 0, // Would be calculated from holdings
        currency: 'INR',
        taxResidenceCountry: user.taxResidencyCountry || 'IN',
        tinNumber: user.fatcaTinNumber || undefined
      };

      reportableAccounts.push(account);
      totalValue += account.accountBalance;
    }

    const report: AnnualCRSReport = {
      reportId,
      reportYear,
      reportingJurisdiction,
      generatedAt: new Date(),
      status: 'generated',
      accountHolders: reportableAccounts,
      totalAccounts: reportableAccounts.length,
      totalValue,
      currency: 'INR'
    };

    // Log report generation
    await this.logFATCACRSEvent('system', 'crs_report_generated', {
      reportId,
      reportYear,
      reportingJurisdiction,
      totalAccounts: reportableAccounts.length
    });

    return report;
  }

  /**
   * Get compliance summary for a user
   */
  async getComplianceSummary(userId: string): Promise<{
    fatca: FATCAStatus;
    crs: CRSStatus;
    overallStatus: 'compliant' | 'non_compliant' | 'pending' | 'action_required';
    pendingActions: string[];
    documentsRequired: string[];
    lastUpdated: Date;
  }> {
    const fatca = await this.getFATCAStatus(userId);
    const crs = await this.getCRSStatus(userId);
    const usIndicia = await this.checkUSIndicia(userId);

    const pendingActions: string[] = [];
    const documentsRequired: string[] = [];

    // Collect all issues
    pendingActions.push(...fatca.complianceIssues);
    pendingActions.push(...crs.complianceIssues);

    // Determine required documents
    if (fatca.isUSPerson && !fatca.w9Submitted) {
      documentsRequired.push('W-9 Form');
    }
    if (!fatca.isUSPerson && !fatca.w8benSubmitted) {
      documentsRequired.push('W-8BEN Form');
    }
    if (!crs.selfCertificationValid) {
      documentsRequired.push('CRS Self-Certification Form');
    }

    // Determine overall status
    let overallStatus: 'compliant' | 'non_compliant' | 'pending' | 'action_required' = 'compliant';
    if (fatca.fatcaStatus === 'non_compliant' || crs.crsStatus === 'non_compliant') {
      overallStatus = 'non_compliant';
    } else if (fatca.fatcaStatus === 'pending' || crs.crsStatus === 'pending') {
      overallStatus = 'pending';
    } else if (pendingActions.length > 0 || documentsRequired.length > 0) {
      overallStatus = 'action_required';
    }

    return {
      fatca,
      crs,
      overallStatus,
      pendingActions,
      documentsRequired,
      lastUpdated: new Date()
    };
  }

  /**
   * Log FATCA/CRS event
   */
  private async logFATCACRSEvent(userId: string, action: string, details: any): Promise<void> {
    try {
      await db.insert(complianceAuditTrail).values({
        userId,
        action: `fatca_crs_${action}`,
        fieldChanged: 'fatca_crs',
        newValue: details,
        performedBy: 'fatca_crs_system',
        performedByRole: 'compliance_system',
        riskImpact: 'low',
        complianceImpact: 'none',
        metadata: details
      });
    } catch (error) {
      console.error('[FATCA/CRS] Failed to log event:', error);
    }
  }

  /**
   * Get participating jurisdictions
   */
  getParticipatingJurisdictions(): string[] {
    return CRS_PARTICIPATING_JURISDICTIONS;
  }

  /**
   * Get US indicia types
   */
  getUSIndiciaTypes(): string[] {
    return US_INDICIA;
  }
}

export const fatcaCrsService = new FATCACRSService();
