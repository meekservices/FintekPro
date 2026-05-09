/**
 * Government Scheme Data Fetcher
 * 
 * Orchestrates fetching data from government APIs after OTP consent verification:
 * - EPFO (EPF/EPS) - Employee Provident Fund Organization
 * - NPS CRA (NPS) - National Pension System Central Recordkeeping Agency
 * - PFRDA (APY) - Pension Fund Regulatory and Development Authority
 * - PPF - Public Provident Fund (via bank APIs)
 * - Insurance - via Turtlefin/CAMS
 * 
 * Called after successful OTP verification in consent orchestrator
 */

import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { EPFOService, type EPFAccount } from './epfo-service';
import { NPSService, type NPSHolding } from './nps-service';
import { APYService, type APYHolding } from './apy-service';

export type SchemeType = 'epf' | 'eps' | 'nps' | 'ppf' | 'apy' | 'insurance';

interface FetchRequest {
  userId: string;
  schemeType: SchemeType;
  panNumber: string;
  name: string;
  dateOfBirth: string;
  mobile?: string;
  email?: string;
  consentId?: string;
}

interface FetchResult {
  success: boolean;
  schemeType: SchemeType;
  recordsCreated: number;
  recordsUpdated: number;
  message: string;
  data?: any;
}

class GovernmentSchemeDataFetcher {
  private epfoService: EPFOService;
  private npsService: NPSService;
  private apyService: APYService;

  constructor() {
    this.epfoService = new EPFOService();
    this.npsService = new NPSService();
    this.apyService = new APYService();
  }

  /**
   * Main entry point - fetch data based on scheme type
   */
  async fetchSchemeData(request: FetchRequest): Promise<FetchResult> {
    console.log(`🔄 [DATA_FETCHER] Starting ${request.schemeType.toUpperCase()} data fetch for user ${request.userId}`);

    try {
      switch (request.schemeType) {
        case 'epf':
          return await this.fetchAndStoreEPFData(request);
        case 'eps':
          return await this.fetchAndStoreEPSData(request);
        case 'nps':
          return await this.fetchAndStoreNPSData(request);
        case 'ppf':
          return await this.fetchAndStorePPFData(request);
        case 'apy':
          return await this.fetchAndStoreAPYData(request);
        case 'insurance':
          return await this.fetchAndStoreInsuranceData(request);
        default:
          return {
            success: false,
            schemeType: request.schemeType,
            recordsCreated: 0,
            recordsUpdated: 0,
            message: `Unknown scheme type: ${request.schemeType}`
          };
      }
    } catch (error) {
      console.error(`❌ [DATA_FETCHER] Error fetching ${request.schemeType} data:`, error);
      return {
        success: false,
        schemeType: request.schemeType,
        recordsCreated: 0,
        recordsUpdated: 0,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Fetch EPF data from EPFO and store in database
   */
  private async fetchAndStoreEPFData(request: FetchRequest): Promise<FetchResult> {
    const epfResponse = await this.epfoService.fetchEPFAccounts({
      panNumber: request.panNumber,
      name: request.name,
      dob: request.dateOfBirth,
      mobile: request.mobile
    });

    if (!epfResponse.success || epfResponse.accounts.length === 0) {
      return {
        success: false,
        schemeType: 'epf',
        recordsCreated: 0,
        recordsUpdated: 0,
        message: epfResponse.message || 'No EPF accounts found'
      };
    }

    let created = 0;
    let updated = 0;

    for (const account of epfResponse.accounts) {
      const existing = await db.select()
        .from(schema.epfHoldings)
        .where(
          and(
            eq(schema.epfHoldings.userId, request.userId),
            eq(schema.epfHoldings.epfAccountNumber, account.epfAccountNumber)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db.update(schema.epfHoldings)
          .set({
            employerName: account.employerName,
            memberName: account.memberName,
            employeeContribution: account.employeeContribution.toString(),
            employerContribution: account.employerContribution.toString(),
            pensionContribution: account.pensionContribution.toString(),
            totalBalance: account.totalBalance.toString(),
            interestEarned: account.interestEarned.toString(),
            interestRate: account.interestRate.toString(),
            isActive: account.isActive,
            nomineeName: account.nomineeName,
            nomineeRelationship: account.nomineeRelationship,
            lastUpdated: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.epfHoldings.id, existing[0].id));
        updated++;
      } else {
        await db.insert(schema.epfHoldings).values({
          userId: request.userId,
          epfAccountNumber: account.epfAccountNumber,
          employerName: account.employerName,
          memberName: account.memberName,
          employeeContribution: account.employeeContribution.toString(),
          employerContribution: account.employerContribution.toString(),
          pensionContribution: account.pensionContribution.toString(),
          totalBalance: account.totalBalance.toString(),
          interestEarned: account.interestEarned.toString(),
          interestRate: account.interestRate.toString(),
          dateOfJoining: account.dateOfJoining,
          dateOfExit: account.dateOfExit,
          isActive: account.isActive,
          nomineeName: account.nomineeName,
          nomineeRelationship: account.nomineeRelationship
        });
        created++;
      }
    }

    console.log(`✅ [DATA_FETCHER] EPF: ${created} created, ${updated} updated`);

    return {
      success: true,
      schemeType: 'epf',
      recordsCreated: created,
      recordsUpdated: updated,
      message: `Successfully fetched ${epfResponse.accounts.length} EPF account(s)`,
      data: {
        totalBalance: epfResponse.totalBalance,
        totalAccounts: epfResponse.totalAccounts
      }
    };
  }

  /**
   * Fetch EPS data from EPFO (EPS is part of EPF system)
   */
  private async fetchAndStoreEPSData(request: FetchRequest): Promise<FetchResult> {
    const epfResponse = await this.epfoService.fetchEPFAccounts({
      panNumber: request.panNumber,
      name: request.name,
      dob: request.dateOfBirth,
      mobile: request.mobile
    });

    if (!epfResponse.success || epfResponse.accounts.length === 0) {
      return {
        success: false,
        schemeType: 'eps',
        recordsCreated: 0,
        recordsUpdated: 0,
        message: epfResponse.message || 'No EPS records found'
      };
    }

    let created = 0;
    let updated = 0;

    for (const account of epfResponse.accounts) {
      const existing = await db.select()
        .from(schema.epsHoldings)
        .where(
          and(
            eq(schema.epsHoldings.userId, request.userId),
            eq(schema.epsHoldings.epfAccountNumber, account.epfAccountNumber)
          )
        )
        .limit(1);

      const pensionableService = this.calculatePensionableService(account.dateOfJoining, account.dateOfExit);
      const expectedPension = this.calculateExpectedPension(account.pensionContribution, pensionableService);

      if (existing.length > 0) {
        await db.update(schema.epsHoldings)
          .set({
            currentEmployer: account.employerName,
            totalContribution: account.pensionContribution.toString(),
            totalServiceYears: pensionableService,
            estimatedMonthlyPension: expectedPension.toString(),
            status: account.isActive ? 'active' : 'suspended',
            nomineeName: account.nomineeName,
            nomineeRelationship: account.nomineeRelationship,
            lastUpdated: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.epsHoldings.id, existing[0].id));
        updated++;
      } else {
        await db.insert(schema.epsHoldings).values({
          userId: request.userId,
          epfAccountNumber: account.epfAccountNumber,
          pensionAccountNumber: `EPS${account.epfAccountNumber}`,
          employerCode: 'EMPLOYER001',
          currentEmployer: account.employerName,
          serviceStartDate: account.dateOfJoining,
          totalServiceYears: pensionableService,
          totalServiceMonths: 0,
          currentSalary: '50000',
          pensionableWage: '15000',
          totalContribution: account.pensionContribution.toString(),
          estimatedMonthlyPension: expectedPension.toString(),
          status: account.isActive ? 'active' : 'suspended',
          nomineeName: account.nomineeName,
          nomineeRelationship: account.nomineeRelationship
        });
        created++;
      }
    }

    console.log(`✅ [DATA_FETCHER] EPS: ${created} created, ${updated} updated`);

    return {
      success: true,
      schemeType: 'eps',
      recordsCreated: created,
      recordsUpdated: updated,
      message: `Successfully fetched ${epfResponse.accounts.length} EPS record(s)`,
      data: {
        totalPensionContribution: epfResponse.totalPensionContribution,
        totalRecords: epfResponse.accounts.length
      }
    };
  }

  /**
   * Fetch NPS data from NPS CRA and store in database
   */
  private async fetchAndStoreNPSData(request: FetchRequest): Promise<FetchResult> {
    const npsResponse = await this.npsService.fetchNPSAccounts({
      panNumber: request.panNumber,
      name: request.name,
      dateOfBirth: request.dateOfBirth,
      mobile: request.mobile
    });

    if (!npsResponse.success || npsResponse.holdings.length === 0) {
      return {
        success: false,
        schemeType: 'nps',
        recordsCreated: 0,
        recordsUpdated: 0,
        message: npsResponse.message || 'No NPS accounts found'
      };
    }

    let created = 0;
    let updated = 0;

    for (const holding of npsResponse.holdings) {
      const existing = await db.select()
        .from(schema.npsAccounts)
        .where(eq(schema.npsAccounts.pran, holding.pran))
        .limit(1);

      const npsData = {
        accountHolderName: holding.accountHolderName,
        dateOfBirth: holding.dateOfBirth,
        registrationDate: holding.registrationDate,
        tierIBalance: holding.tierIBalance.toString(),
        tierIContributions: holding.tierIContributions.toString(),
        tierIReturns: holding.tierIReturns.toString(),
        tierIAssetAllocation: holding.tierIAssetAllocation,
        tierIIBalance: holding.tierIIBalance.toString(),
        tierIIContributions: holding.tierIIContributions.toString(),
        tierIIReturns: holding.tierIIReturns.toString(),
        tierIIAssetAllocation: holding.tierIIAssetAllocation,
        totalBalance: holding.totalBalance.toString(),
        totalContributions: holding.totalContributions.toString(),
        totalReturns: holding.totalReturns.toString(),
        returnsPercentage: holding.returnsPercentage.toString(),
        fundManager: holding.fundManager,
        scheme: holding.scheme,
        tier: holding.tier,
        nominee: holding.nominee,
        nomineeRelation: holding.nomineeRelation,
        status: holding.status,
        lastContributionDate: holding.lastContributionDate,
        updatedAt: new Date()
      };

      if (existing.length > 0) {
        await db.update(schema.npsAccounts)
          .set(npsData)
          .where(eq(schema.npsAccounts.id, existing[0].id));
        updated++;
      } else {
        await db.insert(schema.npsAccounts).values({
          userId: request.userId,
          pran: holding.pran,
          ...npsData
        });
        created++;
      }
    }

    console.log(`✅ [DATA_FETCHER] NPS: ${created} created, ${updated} updated`);

    return {
      success: true,
      schemeType: 'nps',
      recordsCreated: created,
      recordsUpdated: updated,
      message: `Successfully fetched ${npsResponse.holdings.length} NPS account(s)`,
      data: {
        totalBalance: npsResponse.totalBalance,
        totalReturns: npsResponse.totalReturns
      }
    };
  }

  /**
   * Fetch PPF data (placeholder - would connect to bank APIs)
   */
  private async fetchAndStorePPFData(request: FetchRequest): Promise<FetchResult> {
    throw new Error('PPF data service not configured. Bank API integration required for PPF data.');
  }

  /**
   * Fetch APY data from Account Aggregator and store in database
   */
  private async fetchAndStoreAPYData(request: FetchRequest): Promise<FetchResult> {
    const apyResponse = await this.apyService.fetchAPYAccounts({
      panNumber: request.panNumber,
      name: request.name,
      dateOfBirth: request.dateOfBirth,
      mobile: request.mobile
    });

    if (!apyResponse.success || apyResponse.holdings.length === 0) {
      return {
        success: false,
        schemeType: 'apy',
        recordsCreated: 0,
        recordsUpdated: 0,
        message: apyResponse.message || 'No APY accounts found'
      };
    }

    let created = 0;
    let updated = 0;

    for (const holding of apyResponse.holdings) {
      const existing = await db.select()
        .from(schema.apyAccounts)
        .where(eq(schema.apyAccounts.pran, holding.pran))
        .limit(1);

      const apyData = {
        accountHolderName: holding.accountHolderName,
        dateOfBirth: holding.dateOfBirth,
        enrollmentDate: holding.enrollmentDate,
        enrollmentAge: holding.enrollmentAge,
        pensionAmount: holding.pensionAmount.toString(),
        monthlyContribution: holding.monthlyContribution.toString(),
        totalContribution: holding.totalContribution.toString(),
        governmentContribution: holding.governmentContribution.toString(),
        totalBalance: holding.totalBalance.toString(),
        maturityAge: holding.maturityAge,
        yearsToMaturity: holding.yearsToMaturity,
        expectedMaturityDate: holding.expectedMaturityDate,
        bankName: holding.bankName,
        bankAccountNumber: holding.bankAccountNumber,
        ifscCode: holding.ifscCode,
        branchName: holding.branchName,
        nominee: holding.nominee,
        nomineeRelation: holding.nomineeRelation,
        status: holding.status,
        lastContributionDate: holding.lastContributionDate,
        updatedAt: new Date()
      };

      if (existing.length > 0) {
        await db.update(schema.apyAccounts)
          .set(apyData)
          .where(eq(schema.apyAccounts.id, existing[0].id));
        updated++;
      } else {
        await db.insert(schema.apyAccounts).values({
          userId: request.userId,
          pran: holding.pran,
          ...apyData
        });
        created++;
      }
    }

    console.log(`✅ [DATA_FETCHER] APY: ${created} created, ${updated} updated`);

    return {
      success: true,
      schemeType: 'apy',
      recordsCreated: created,
      recordsUpdated: updated,
      message: `Successfully fetched ${apyResponse.holdings.length} APY account(s)`,
      data: {
        totalBalance: apyResponse.totalBalance,
        totalContribution: apyResponse.totalContribution
      }
    };
  }

  /**
   * Fetch Insurance data (placeholder - would connect to Turtlefin/CAMS)
   */
  private async fetchAndStoreInsuranceData(request: FetchRequest): Promise<FetchResult> {
    throw new Error('Insurance data service not configured. Turtlefin/CAMS API integration required for insurance data.');
  }

  // Helper methods
  private calculatePensionableService(dateOfJoining: string, dateOfExit?: string): number {
    const joinDate = new Date(dateOfJoining);
    const exitDate = dateOfExit ? new Date(dateOfExit) : new Date();
    const years = (exitDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(years);
  }

  private calculateExpectedPension(pensionContribution: number, years: number): number {
    const avgSalary = pensionContribution * 12 / 0.0833;
    const monthlyPension = (avgSalary * years) / 70;
    return Math.min(Math.max(monthlyPension, 1000), 15000);
  }

}

export const governmentSchemeDataFetcher = new GovernmentSchemeDataFetcher();
