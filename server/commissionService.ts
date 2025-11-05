import { parse } from 'csv-parse/sync';

/**
 * Commission Service
 * Handles parsing of RTA/CAMS commission reports and commission calculations
 */

// RTA Report Row Interface (CAMS/KFintech standard format)
interface RTAReportRow {
  arnNo: string;
  clientCode: string;
  clientName: string;
  pan: string;
  schemeCode: string;
  schemeName: string;
  amcName: string;
  transactionType: string; // Purchase, SIP, Redemption
  units: string;
  nav: string;
  transactionAmount: string;
  transactionDate: string;
  commissionRate: string; // In percentage
  commissionAmount: string;
  tdsRate: string;
  tdsAmount: string;
  gstAmount: string;
  netCommission: string;
  trailMonth?: string; // For trail commissions (YYYY-MM)
  rtaReferenceNumber: string;
}

// Parsed Commission Record
export interface ParsedCommission {
  arnNo: string;
  clientPan: string;
  clientName: string;
  schemeCode: string;
  schemeName: string;
  amcName: string;
  transactionType: string;
  units: number;
  nav: number;
  transactionAmount: number;
  commissionType: 'upfront' | 'trail';
  commissionRate: number;
  commissionAmount: number;
  tdsRate: number;
  tdsAmount: number;
  gstAmount: number;
  netCommission: number;
  trailMonth?: string;
  transactionDate: Date;
  rtaReferenceNumber: string;
}

/**
 * Parse RTA/CAMS commission report CSV
 */
export function parseCommissionReport(csvContent: string): ParsedCommission[] {
  try {
    // Parse CSV with headers
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as RTAReportRow[];

    const parsedCommissions: ParsedCommission[] = [];

    for (const row of records) {
      // Skip invalid rows
      if (!row.arnNo || !row.schemeCode || !row.commissionAmount) {
        continue;
      }

      const commission: ParsedCommission = {
        arnNo: row.arnNo.trim(),
        clientPan: row.pan?.trim() || '',
        clientName: row.clientName?.trim() || '',
        schemeCode: row.schemeCode.trim(),
        schemeName: row.schemeName?.trim() || '',
        amcName: row.amcName?.trim() || '',
        transactionType: row.transactionType?.trim() || '',
        units: parseFloat(row.units || '0'),
        nav: parseFloat(row.nav || '0'),
        transactionAmount: parseFloat(row.transactionAmount || '0'),
        commissionType: row.trailMonth ? 'trail' : 'upfront',
        commissionRate: parseFloat(row.commissionRate || '0'),
        commissionAmount: parseFloat(row.commissionAmount || '0'),
        tdsRate: parseFloat(row.tdsRate || '0'),
        tdsAmount: parseFloat(row.tdsAmount || '0'),
        gstAmount: parseFloat(row.gstAmount || '0'),
        netCommission: parseFloat(row.netCommission || '0'),
        trailMonth: row.trailMonth?.trim(),
        transactionDate: row.transactionDate ? new Date(row.transactionDate) : new Date(),
        rtaReferenceNumber: row.rtaReferenceNumber?.trim() || '',
      };

      parsedCommissions.push(commission);
    }

    return parsedCommissions;
  } catch (error) {
    console.error('Error parsing commission report:', error);
    throw new Error(`Failed to parse commission report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate trail commission
 * Formula: Units × NAV × Trail Rate (%)
 */
export function calculateTrailCommission(
  units: number,
  nav: number,
  trailRate: number
): number {
  return (units * nav * trailRate) / 100;
}

/**
 * Calculate upfront commission
 * Formula: Transaction Amount × Commission Rate (%)
 */
export function calculateUpfrontCommission(
  transactionAmount: number,
  commissionRate: number
): number {
  return (transactionAmount * commissionRate) / 100;
}

/**
 * Calculate net commission after TDS and GST
 */
export function calculateNetCommission(
  grossCommission: number,
  tdsRate: number,
  gstRate: number
): { netCommission: number; tdsAmount: number; gstAmount: number } {
  const tdsAmount = (grossCommission * tdsRate) / 100;
  const gstAmount = (grossCommission * gstRate) / 100;
  const netCommission = grossCommission - tdsAmount + gstAmount;

  return {
    netCommission: parseFloat(netCommission.toFixed(2)),
    tdsAmount: parseFloat(tdsAmount.toFixed(2)),
    gstAmount: parseFloat(gstAmount.toFixed(2)),
  };
}

/**
 * Group commissions by agent
 */
export function groupCommissionsByAgent(
  commissions: ParsedCommission[]
): Map<string, ParsedCommission[]> {
  const grouped = new Map<string, ParsedCommission[]>();

  for (const commission of commissions) {
    const existing = grouped.get(commission.arnNo) || [];
    existing.push(commission);
    grouped.set(commission.arnNo, existing);
  }

  return grouped;
}

/**
 * Calculate summary statistics for agent commissions
 */
export function calculateCommissionSummary(commissions: ParsedCommission[]): {
  totalGross: number;
  totalTds: number;
  totalGst: number;
  totalNet: number;
  upfrontCount: number;
  trailCount: number;
  upfrontAmount: number;
  trailAmount: number;
} {
  let totalGross = 0;
  let totalTds = 0;
  let totalGst = 0;
  let totalNet = 0;
  let upfrontCount = 0;
  let trailCount = 0;
  let upfrontAmount = 0;
  let trailAmount = 0;

  for (const comm of commissions) {
    totalGross += comm.commissionAmount;
    totalTds += comm.tdsAmount;
    totalGst += comm.gstAmount;
    totalNet += comm.netCommission;

    if (comm.commissionType === 'upfront') {
      upfrontCount++;
      upfrontAmount += comm.commissionAmount;
    } else {
      trailCount++;
      trailAmount += comm.commissionAmount;
    }
  }

  return {
    totalGross: parseFloat(totalGross.toFixed(2)),
    totalTds: parseFloat(totalTds.toFixed(2)),
    totalGst: parseFloat(totalGst.toFixed(2)),
    totalNet: parseFloat(totalNet.toFixed(2)),
    upfrontCount,
    trailCount,
    upfrontAmount: parseFloat(upfrontAmount.toFixed(2)),
    trailAmount: parseFloat(trailAmount.toFixed(2)),
  };
}
