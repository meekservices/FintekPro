/**
 * MCA Financial Data Backfill Service
 * 
 * Fetches and populates actual financial data into mca_financial_snapshot table.
 * Since Sandbox API doesn't provide financial statement values (only filing dates),
 * and CredHive's /kyc endpoint requires higher tier subscription, this service:
 * 
 * 1. Cross-references with company_financials table (for companies that have data)
 * 2. Allows manual data import via CSV/JSON
 * 3. Tracks data coverage and completeness per company
 * 4. Provides admin endpoints for backfill operations
 */

import { db } from '../db';
import { eq, desc, and, sql, isNull, gte, lte, inArray } from 'drizzle-orm';
import {
  mcaFinancialSnapshot,
  mcaCompanyMaster,
  companyFinancials,
  unlistedCompanies,
  type McaFinancialSnapshot,
} from '@shared/schema';
import { nanoid } from 'nanoid';

export interface FinancialDataInput {
  cin: string;
  financialYear: string;
  revenue?: number;
  profitBeforeTax?: number;
  profitAfterTax?: number;
  netWorth?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  shareCapital?: number;
  reserves?: number;
  longTermBorrowing?: number;
  shortTermBorrowing?: number;
  ebitda?: number;
  operatingCashFlow?: number;
}

export interface BackfillResult {
  cin: string;
  companyName?: string;
  yearsProcessed: number;
  yearsUpdated: number;
  yearsSkipped: number;
  errors: string[];
  coverage: number;
}

export interface CoverageStats {
  totalCompanies: number;
  companiesWithData: number;
  companiesWithoutData: number;
  totalSnapshots: number;
  snapshotsWithRevenue: number;
  snapshotsWithPAT: number;
  snapshotsWithFullData: number;
  averageCompleteness: number;
}

const FINANCIAL_FIELDS = [
  'revenue', 'profitBeforeTax', 'profitAfterTax', 'netWorth', 
  'totalAssets', 'totalLiabilities', 'shareCapital', 'reserves',
  'longTermBorrowing', 'shortTermBorrowing', 'ebitda', 'operatingCashFlow'
];

class McaFinancialBackfillService {
  constructor() {
    console.log('✅ MCA Financial Backfill Service initialized');
  }

  private calculateCompleteness(snapshot: Partial<McaFinancialSnapshot>): number {
    let filled = 0;
    for (const field of FINANCIAL_FIELDS) {
      const value = (snapshot as any)[field];
      if (value !== null && value !== undefined && parseFloat(value) !== 0) {
        filled++;
      }
    }
    return Math.round((filled / FINANCIAL_FIELDS.length) * 100);
  }

  async updateFinancialSnapshot(data: FinancialDataInput, userId?: string): Promise<{
    success: boolean;
    isNew: boolean;
    completeness: number;
    error?: string;
  }> {
    try {
      const existing = await db
        .select()
        .from(mcaFinancialSnapshot)
        .where(and(
          eq(mcaFinancialSnapshot.cin, data.cin),
          eq(mcaFinancialSnapshot.financialYear, data.financialYear)
        ))
        .limit(1);

      const updateData: any = {
        revenue: data.revenue?.toString(),
        profitBeforeTax: data.profitBeforeTax?.toString(),
        profitAfterTax: data.profitAfterTax?.toString(),
        netWorth: data.netWorth?.toString(),
        totalAssets: data.totalAssets?.toString(),
        totalLiabilities: data.totalLiabilities?.toString(),
        shareCapital: data.shareCapital?.toString(),
        reserves: data.reserves?.toString(),
        longTermBorrowing: data.longTermBorrowing?.toString(),
        shortTermBorrowing: data.shortTermBorrowing?.toString(),
        ebitda: data.ebitda?.toString(),
        operatingCashFlow: data.operatingCashFlow?.toString(),
      };

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });

      const completeness = this.calculateCompleteness(updateData);

      if (existing.length > 0) {
        await db.update(mcaFinancialSnapshot)
          .set({
            ...updateData,
            derivedBy: userId,
            source: 'manual_backfill',
          })
          .where(eq(mcaFinancialSnapshot.id, existing[0].id));

        await db.execute(sql`
          UPDATE mca_financial_snapshot 
          SET data_completeness = ${completeness}, 
              last_refreshed_at = NOW(),
              refresh_source = 'manual_backfill'
          WHERE id = ${existing[0].id}
        `);

        return { success: true, isNew: false, completeness };
      } else {
        await db.insert(mcaFinancialSnapshot).values({
          cin: data.cin,
          financialYear: data.financialYear,
          ...updateData,
          source: 'manual_backfill',
          derivedBy: userId,
        });

        const [newRecord] = await db
          .select()
          .from(mcaFinancialSnapshot)
          .where(and(
            eq(mcaFinancialSnapshot.cin, data.cin),
            eq(mcaFinancialSnapshot.financialYear, data.financialYear)
          ))
          .limit(1);

        if (newRecord) {
          await db.execute(sql`
            UPDATE mca_financial_snapshot 
            SET data_completeness = ${completeness}, 
                last_refreshed_at = NOW(),
                refresh_source = 'manual_backfill'
            WHERE id = ${newRecord.id}
          `);
        }

        return { success: true, isNew: true, completeness };
      }
    } catch (error: any) {
      console.error('[MCA Backfill] Error updating snapshot:', error.message);
      return { success: false, isNew: false, completeness: 0, error: error.message };
    }
  }

  async backfillFromCompanyFinancials(cin: string, userId?: string): Promise<BackfillResult> {
    const result: BackfillResult = {
      cin,
      yearsProcessed: 0,
      yearsUpdated: 0,
      yearsSkipped: 0,
      errors: [],
      coverage: 0,
    };

    try {
      const [company] = await db
        .select()
        .from(mcaCompanyMaster)
        .where(eq(mcaCompanyMaster.cin, cin))
        .limit(1);

      result.companyName = company?.companyName;

      const [unlistedCompany] = await db
        .select()
        .from(unlistedCompanies)
        .where(eq(unlistedCompanies.cin, cin))
        .limit(1);

      if (!unlistedCompany) {
        result.errors.push('No matching unlisted company found in database');
        return result;
      }

      const financials = await db
        .select()
        .from(companyFinancials)
        .where(eq(companyFinancials.companyId, unlistedCompany.id))
        .orderBy(desc(companyFinancials.financialYear));

      if (financials.length === 0) {
        result.errors.push('No financial data found for this company');
        return result;
      }

      for (const fin of financials) {
        result.yearsProcessed++;
        
        try {
          const updateResult = await this.updateFinancialSnapshot({
            cin,
            financialYear: fin.financialYear,
            revenue: fin.revenue ? parseFloat(fin.revenue) : undefined,
            profitBeforeTax: fin.pbt ? parseFloat(fin.pbt) : undefined,
            profitAfterTax: fin.pat ? parseFloat(fin.pat) : undefined,
            netWorth: fin.networth ? parseFloat(fin.networth) : undefined,
            totalAssets: fin.totalAssets ? parseFloat(fin.totalAssets) : undefined,
            totalLiabilities: fin.totalLiabilities ? parseFloat(fin.totalLiabilities) : undefined,
            shareCapital: fin.shareCapital ? parseFloat(fin.shareCapital) : undefined,
            reserves: fin.reserves ? parseFloat(fin.reserves) : undefined,
            longTermBorrowing: fin.longTermDebt ? parseFloat(fin.longTermDebt) : undefined,
            shortTermBorrowing: fin.shortTermDebt ? parseFloat(fin.shortTermDebt) : undefined,
            ebitda: fin.ebitda ? parseFloat(fin.ebitda) : undefined,
            operatingCashFlow: fin.operatingCashFlow ? parseFloat(fin.operatingCashFlow) : undefined,
          }, userId);

          if (updateResult.success) {
            result.yearsUpdated++;
          } else {
            result.yearsSkipped++;
            result.errors.push(`${fin.financialYear}: ${updateResult.error}`);
          }
        } catch (err: any) {
          result.yearsSkipped++;
          result.errors.push(`${fin.financialYear}: ${err.message}`);
        }
      }

      result.coverage = await this.getCompanyCoverage(cin);

    } catch (error: any) {
      result.errors.push(error.message);
    }

    return result;
  }

  async backfillBulk(cins: string[], userId?: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: BackfillResult[];
  }> {
    const results: BackfillResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const cin of cins) {
      const result = await this.backfillFromCompanyFinancials(cin, userId);
      results.push(result);
      
      if (result.yearsUpdated > 0) {
        successful++;
      } else {
        failed++;
      }
    }

    return { total: cins.length, successful, failed, results };
  }

  async getCompanyCoverage(cin: string): Promise<number> {
    const snapshots = await db
      .select()
      .from(mcaFinancialSnapshot)
      .where(eq(mcaFinancialSnapshot.cin, cin));

    if (snapshots.length === 0) return 0;

    const totalFields = snapshots.length * FINANCIAL_FIELDS.length;
    let filledFields = 0;

    for (const snapshot of snapshots) {
      for (const field of FINANCIAL_FIELDS) {
        const value = (snapshot as any)[field];
        if (value !== null && value !== undefined && parseFloat(value) !== 0) {
          filledFields++;
        }
      }
    }

    return Math.round((filledFields / totalFields) * 100);
  }

  async getFieldCoverageStats(): Promise<{
    totalSnapshots: number;
    fields: Array<{
      fieldName: string;
      displayName: string;
      filledCount: number;
      missingCount: number;
      coverage: number;
    }>;
  }> {
    const snapshots = await db.select().from(mcaFinancialSnapshot);
    const totalSnapshots = snapshots.length;

    const fieldNames: Record<string, string> = {
      revenue: 'Revenue',
      profitBeforeTax: 'Profit Before Tax',
      profitAfterTax: 'Profit After Tax (PAT)',
      netWorth: 'Net Worth',
      totalAssets: 'Total Assets',
      totalLiabilities: 'Total Liabilities',
      shareCapital: 'Share Capital',
      reserves: 'Reserves',
      longTermBorrowing: 'Long Term Borrowing',
      shortTermBorrowing: 'Short Term Borrowing',
      ebitda: 'EBITDA',
      operatingCashFlow: 'Operating Cash Flow',
    };

    const fields = FINANCIAL_FIELDS.map(field => {
      let filledCount = 0;
      for (const snapshot of snapshots) {
        const value = (snapshot as any)[field];
        if (value !== null && value !== undefined && parseFloat(value) !== 0) {
          filledCount++;
        }
      }
      return {
        fieldName: field,
        displayName: fieldNames[field] || field,
        filledCount,
        missingCount: totalSnapshots - filledCount,
        coverage: totalSnapshots > 0 ? Math.round((filledCount / totalSnapshots) * 100) : 0,
      };
    });

    return { totalSnapshots, fields };
  }

  async getCoverageStats(): Promise<CoverageStats> {
    const companies = await db.select().from(mcaCompanyMaster);
    const snapshots = await db.select().from(mcaFinancialSnapshot);

    const companiesWithSnapshots = new Set(snapshots.map(s => s.cin));
    
    let snapshotsWithRevenue = 0;
    let snapshotsWithPAT = 0;
    let snapshotsWithFullData = 0;
    let totalCompleteness = 0;

    for (const snapshot of snapshots) {
      const completeness = this.calculateCompleteness(snapshot);
      totalCompleteness += completeness;

      if (snapshot.revenue && parseFloat(snapshot.revenue) > 0) snapshotsWithRevenue++;
      if (snapshot.profitAfterTax) snapshotsWithPAT++;
      if (completeness >= 80) snapshotsWithFullData++;
    }

    return {
      totalCompanies: companies.length,
      companiesWithData: companiesWithSnapshots.size,
      companiesWithoutData: companies.length - companiesWithSnapshots.size,
      totalSnapshots: snapshots.length,
      snapshotsWithRevenue,
      snapshotsWithPAT,
      snapshotsWithFullData,
      averageCompleteness: snapshots.length > 0 ? Math.round(totalCompleteness / snapshots.length) : 0,
    };
  }

  async getCompaniesNeedingBackfill(): Promise<Array<{
    cin: string;
    companyName: string;
    snapshotCount: number;
    hasFinancialData: boolean;
    avgCompleteness: number;
  }>> {
    const companies = await db
      .select({
        cin: mcaCompanyMaster.cin,
        companyName: mcaCompanyMaster.companyName,
      })
      .from(mcaCompanyMaster)
      .limit(100);

    const results = [];

    for (const company of companies) {
      const snapshots = await db
        .select()
        .from(mcaFinancialSnapshot)
        .where(eq(mcaFinancialSnapshot.cin, company.cin));

      let hasData = false;
      let totalCompleteness = 0;

      for (const s of snapshots) {
        const comp = this.calculateCompleteness(s);
        if (comp > 0) hasData = true;
        totalCompleteness += comp;
      }

      results.push({
        cin: company.cin,
        companyName: company.companyName,
        snapshotCount: snapshots.length,
        hasFinancialData: hasData,
        avgCompleteness: snapshots.length > 0 ? Math.round(totalCompleteness / snapshots.length) : 0,
      });
    }

    return results.sort((a, b) => a.avgCompleteness - b.avgCompleteness);
  }

  async importBulkFinancials(data: FinancialDataInput[], userId?: string): Promise<{
    total: number;
    imported: number;
    updated: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    let imported = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const result = await this.updateFinancialSnapshot(data[i], userId);
        if (result.success) {
          if (result.isNew) imported++;
          else updated++;
        } else {
          failed++;
          errors.push({ row: i + 1, error: result.error || 'Unknown error' });
        }
      } catch (err: any) {
        failed++;
        errors.push({ row: i + 1, error: err.message });
      }
    }

    return { total: data.length, imported, updated, failed, errors };
  }

  async getFinancialSummaryByCIN(cin: string): Promise<{
    cin: string;
    companyName?: string;
    years: Array<{
      financialYear: string;
      revenue: number | null;
      pat: number | null;
      netWorth: number | null;
      totalAssets: number | null;
      completeness: number;
      source: string;
    }>;
    coverage: number;
  }> {
    const [company] = await db
      .select()
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, cin))
      .limit(1);

    const snapshots = await db
      .select()
      .from(mcaFinancialSnapshot)
      .where(eq(mcaFinancialSnapshot.cin, cin))
      .orderBy(desc(mcaFinancialSnapshot.financialYear));

    const years = snapshots.map(s => ({
      financialYear: s.financialYear,
      revenue: s.revenue ? parseFloat(s.revenue) : null,
      pat: s.profitAfterTax ? parseFloat(s.profitAfterTax) : null,
      netWorth: s.netWorth ? parseFloat(s.netWorth) : null,
      totalAssets: s.totalAssets ? parseFloat(s.totalAssets) : null,
      completeness: this.calculateCompleteness(s),
      source: s.source,
    }));

    return {
      cin,
      companyName: company?.companyName,
      years,
      coverage: await this.getCompanyCoverage(cin),
    };
  }
}

export const mcaFinancialBackfillService = new McaFinancialBackfillService();
