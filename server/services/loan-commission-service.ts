import { db } from "../db";
import { 
  loanCommissionLedger, 
  loanApplicationsMarketplace,
  dsaLoanApplications,
  InsertLoanCommissionLedger,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  OriginationMode,
  RoutingIntent,
  CURRENT_COMMISSION_POLICY_VERSION,
} from "@shared/loan-origination.constants";

export type LoanProductType = 
  | 'personal' 
  | 'business' 
  | 'home' 
  | 'lap' 
  | 'car' 
  | 'education' 
  | 'gold' 
  | 'securities';

export interface CommissionRateConfig {
  productType: LoanProductType;
  minRate: number;
  maxRate: number;
  defaultRate: number;
  tdsRate: number;
  gstRate: number;
  fintekProShare: number;
  partnerShare: number;
  agentShare: number;
}

export const COMMISSION_RATE_CONFIG: Record<LoanProductType, CommissionRateConfig> = {
  personal: {
    productType: 'personal',
    minRate: 0.5,
    maxRate: 2.0,
    defaultRate: 1.0,
    tdsRate: 5.0,
    gstRate: 18.0,
    fintekProShare: 40,
    partnerShare: 40,
    agentShare: 20,
  },
  business: {
    productType: 'business',
    minRate: 1.0,
    maxRate: 3.0,
    defaultRate: 1.5,
    tdsRate: 5.0,
    gstRate: 18.0,
    fintekProShare: 40,
    partnerShare: 40,
    agentShare: 20,
  },
  home: {
    productType: 'home',
    minRate: 0.3,
    maxRate: 0.8,
    defaultRate: 0.5,
    tdsRate: 5.0,
    gstRate: 18.0,
    fintekProShare: 35,
    partnerShare: 45,
    agentShare: 20,
  },
  lap: {
    productType: 'lap',
    minRate: 0.3,
    maxRate: 1.0,
    defaultRate: 0.5,
    tdsRate: 5.0,
    gstRate: 18.0,
    fintekProShare: 40,
    partnerShare: 40,
    agentShare: 20,
  },
  car: {
    productType: 'car',
    minRate: 0.5,
    maxRate: 1.5,
    defaultRate: 0.8,
    tdsRate: 5.0,
    gstRate: 18.0,
    fintekProShare: 40,
    partnerShare: 40,
    agentShare: 20,
  },
  education: {
    productType: 'education',
    minRate: 0.3,
    maxRate: 0.8,
    defaultRate: 0.5,
    tdsRate: 5.0,
    gstRate: 18.0,
    fintekProShare: 35,
    partnerShare: 45,
    agentShare: 20,
  },
  gold: {
    productType: 'gold',
    minRate: 0.5,
    maxRate: 1.5,
    defaultRate: 0.8,
    tdsRate: 5.0,
    gstRate: 18.0,
    fintekProShare: 40,
    partnerShare: 40,
    agentShare: 20,
  },
  securities: {
    productType: 'securities',
    minRate: 0.3,
    maxRate: 0.5,
    defaultRate: 0.35,
    tdsRate: 5.0,
    gstRate: 18.0,
    fintekProShare: 45,
    partnerShare: 35,
    agentShare: 20,
  },
};

export interface CommissionCalculationResult {
  grossCommission: number;
  tdsAmount: number;
  gstAmount: number;
  netCommission: number;
  fintekProAmount: number;
  partnerAmount: number;
  agentAmount: number;
  commissionRate: number;
  breakdown: {
    loanAmount: number;
    commissionableBase: number;
    rateApplied: number;
    tdsRate: number;
    gstRate: number;
  };
}

export interface CommissionLedgerEntry {
  id: string;
  applicationId: string;
  providerId: string;
  productId: string;
  loanAmount: string;
  disbursementDate: Date | null;
  commissionableBase: string;
  commissionRate: string;
  grossCommission: string;
  tdsRate: string;
  tdsAmount: string;
  gstRate: string;
  gstAmount: string;
  netCommission: string;
  fintekProAmount: string;
  partnerAmount: string;
  agentAmount: string;
  partnerId: string | null;
  agentId: string | null;
  status: string;
  invoiceNumber: string | null;
  paymentDueDate: Date | null;
  createdAt: Date;
}

class LoanCommissionService {
  /**
   * SUB-DSA GOVERNANCE: Unified commission calculation with origination mode
   * This is the unified commission calculation method that accepts all required inputs
   * for proper governance and audit trail.
   */
  calculateUnifiedCommission(params: {
    originationMode: OriginationMode;
    routingIntent: RoutingIntent;
    agentRole?: string;
    bankCode: string;
    disbursementAmount: number;
    productType: LoanProductType;
    commissionPolicyVersion?: string;
    customRate?: number;
    customShares?: { fintekPro?: number; partner?: number; agent?: number };
  }): CommissionCalculationResult & {
    originationMode: OriginationMode;
    routingIntent: RoutingIntent;
    bankCode: string;
    commissionPolicyVersion: string;
  } {
    const baseResult = this.calculateCommission(
      params.disbursementAmount,
      params.productType,
      params.customRate,
      params.customShares
    );

    // Agent-assisted applications may have different agent share based on agent role
    let adjustedAgentAmount = baseResult.agentAmount;
    if (params.originationMode === OriginationMode.AGENT_ASSISTED && params.agentRole) {
      // Master agents get higher share
      if (params.agentRole === "master_agent") {
        adjustedAgentAmount = baseResult.agentAmount * 1.2; // 20% bonus
      }
    }

    return {
      ...baseResult,
      agentAmount: Math.round(adjustedAgentAmount * 100) / 100,
      originationMode: params.originationMode,
      routingIntent: params.routingIntent,
      bankCode: params.bankCode,
      commissionPolicyVersion: params.commissionPolicyVersion || CURRENT_COMMISSION_POLICY_VERSION,
    };
  }

  calculateCommission(
    loanAmount: number,
    productType: LoanProductType,
    customRate?: number,
    customShares?: { fintekPro?: number; partner?: number; agent?: number }
  ): CommissionCalculationResult {
    const config = COMMISSION_RATE_CONFIG[productType] || COMMISSION_RATE_CONFIG.personal;
    
    const rate = customRate ?? config.defaultRate;
    const commissionableBase = loanAmount;
    const grossCommission = (commissionableBase * rate) / 100;
    
    const tdsAmount = (grossCommission * config.tdsRate) / 100;
    const gstAmount = (grossCommission * config.gstRate) / 100;
    const netCommission = grossCommission - tdsAmount;
    
    const fintekProShare = customShares?.fintekPro ?? config.fintekProShare;
    const partnerShare = customShares?.partner ?? config.partnerShare;
    const agentShare = customShares?.agent ?? config.agentShare;
    
    const fintekProAmount = (netCommission * fintekProShare) / 100;
    const partnerAmount = (netCommission * partnerShare) / 100;
    const agentAmount = (netCommission * agentShare) / 100;
    
    return {
      grossCommission: Math.round(grossCommission * 100) / 100,
      tdsAmount: Math.round(tdsAmount * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      netCommission: Math.round(netCommission * 100) / 100,
      fintekProAmount: Math.round(fintekProAmount * 100) / 100,
      partnerAmount: Math.round(partnerAmount * 100) / 100,
      agentAmount: Math.round(agentAmount * 100) / 100,
      commissionRate: rate,
      breakdown: {
        loanAmount,
        commissionableBase,
        rateApplied: rate,
        tdsRate: config.tdsRate,
        gstRate: config.gstRate,
      },
    };
  }

  async createCommissionEntry(
    applicationId: string,
    providerId: string,
    productType: LoanProductType,
    loanAmount: number,
    disbursementDate?: Date,
    partnerId?: string,
    agentId?: string,
    customRate?: number
  ): Promise<CommissionLedgerEntry | null> {
    try {
      const calculation = this.calculateCommission(loanAmount, productType, customRate);
      
      const entry: Partial<InsertLoanCommissionLedger> = {
        applicationId,
        providerId,
        productId: productType,
        loanAmount: loanAmount.toString(),
        disbursementDate: disbursementDate || null,
        commissionableBase: calculation.breakdown.commissionableBase.toString(),
        commissionRate: calculation.commissionRate.toString(),
        grossCommission: calculation.grossCommission.toString(),
        tdsRate: calculation.breakdown.tdsRate.toString(),
        tdsAmount: calculation.tdsAmount.toString(),
        gstRate: calculation.breakdown.gstRate.toString(),
        gstAmount: calculation.gstAmount.toString(),
        netCommission: calculation.netCommission.toString(),
        fintekProAmount: calculation.fintekProAmount.toString(),
        partnerAmount: calculation.partnerAmount.toString(),
        agentAmount: calculation.agentAmount.toString(),
        partnerId: partnerId || null,
        agentId: agentId || null,
        status: 'pending',
      };

      const [created] = await db
        .insert(loanCommissionLedger)
        .values(entry as any)
        .returning();

      console.log(`[CommissionService] Created commission entry for application ${applicationId}`, {
        grossCommission: calculation.grossCommission,
        netCommission: calculation.netCommission,
      });

      return created as CommissionLedgerEntry;
    } catch (error) {
      console.error('[CommissionService] Failed to create commission entry:', error);
      return null;
    }
  }

  async onLoanSanctioned(
    applicationId: string,
    sanctionedAmount: number,
    bankCode: string,
    productType: LoanProductType,
    disbursementDate?: Date,
    partnerId?: string,
    agentId?: string
  ): Promise<CommissionLedgerEntry | null> {
    console.log(`[CommissionService] Processing sanction for application ${applicationId}`, {
      sanctionedAmount,
      bankCode,
      productType,
    });

    return this.createCommissionEntry(
      applicationId,
      bankCode,
      productType,
      sanctionedAmount,
      disbursementDate,
      partnerId,
      agentId
    );
  }

  async onLoanDisbursed(
    applicationId: string,
    disbursedAmount: number,
    disbursementDate: Date
  ): Promise<void> {
    try {
      await db
        .update(loanCommissionLedger)
        .set({
          loanAmount: disbursedAmount.toString(),
          disbursementDate,
          status: 'approved',
          updatedAt: new Date(),
        })
        .where(eq(loanCommissionLedger.applicationId, applicationId));

      console.log(`[CommissionService] Updated commission for disbursed loan ${applicationId}`);
    } catch (error) {
      console.error('[CommissionService] Failed to update on disbursement:', error);
    }
  }

  async getCommissionLedger(filters?: {
    status?: string;
    providerId?: string;
    startDate?: Date;
    endDate?: Date;
    partnerId?: string;
    agentId?: string;
  }): Promise<CommissionLedgerEntry[]> {
    let query = db.select().from(loanCommissionLedger);
    
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(loanCommissionLedger.status, filters.status));
    }
    if (filters?.providerId) {
      conditions.push(eq(loanCommissionLedger.providerId, filters.providerId));
    }
    if (filters?.partnerId) {
      conditions.push(eq(loanCommissionLedger.partnerId, filters.partnerId));
    }
    if (filters?.agentId) {
      conditions.push(eq(loanCommissionLedger.agentId, filters.agentId));
    }
    if (filters?.startDate) {
      conditions.push(gte(loanCommissionLedger.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(loanCommissionLedger.createdAt, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(loanCommissionLedger.createdAt));
    return results as CommissionLedgerEntry[];
  }

  async getCommissionSummary(filters?: {
    startDate?: Date;
    endDate?: Date;
    providerId?: string;
  }): Promise<{
    totalGrossCommission: number;
    totalNetCommission: number;
    totalTds: number;
    totalGst: number;
    totalFintekProShare: number;
    totalPartnerShare: number;
    totalAgentShare: number;
    pendingCount: number;
    approvedCount: number;
    paidCount: number;
    byProvider: Record<string, { count: number; amount: number }>;
    byProduct: Record<string, { count: number; amount: number }>;
  }> {
    const entries = await this.getCommissionLedger(filters);

    const summary = {
      totalGrossCommission: 0,
      totalNetCommission: 0,
      totalTds: 0,
      totalGst: 0,
      totalFintekProShare: 0,
      totalPartnerShare: 0,
      totalAgentShare: 0,
      pendingCount: 0,
      approvedCount: 0,
      paidCount: 0,
      byProvider: {} as Record<string, { count: number; amount: number }>,
      byProduct: {} as Record<string, { count: number; amount: number }>,
    };

    for (const entry of entries) {
      const gross = parseFloat(entry.grossCommission) || 0;
      const net = parseFloat(entry.netCommission) || 0;
      const tds = parseFloat(entry.tdsAmount) || 0;
      const gst = parseFloat(entry.gstAmount) || 0;
      const fintekPro = parseFloat(entry.fintekProAmount) || 0;
      const partner = parseFloat(entry.partnerAmount) || 0;
      const agent = parseFloat(entry.agentAmount) || 0;

      summary.totalGrossCommission += gross;
      summary.totalNetCommission += net;
      summary.totalTds += tds;
      summary.totalGst += gst;
      summary.totalFintekProShare += fintekPro;
      summary.totalPartnerShare += partner;
      summary.totalAgentShare += agent;

      if (entry.status === 'pending') summary.pendingCount++;
      if (entry.status === 'approved') summary.approvedCount++;
      if (entry.status === 'paid') summary.paidCount++;

      if (!summary.byProvider[entry.providerId]) {
        summary.byProvider[entry.providerId] = { count: 0, amount: 0 };
      }
      summary.byProvider[entry.providerId].count++;
      summary.byProvider[entry.providerId].amount += net;

      if (!summary.byProduct[entry.productId]) {
        summary.byProduct[entry.productId] = { count: 0, amount: 0 };
      }
      summary.byProduct[entry.productId].count++;
      summary.byProduct[entry.productId].amount += net;
    }

    return summary;
  }

  async updateCommissionStatus(
    id: string,
    status: 'pending' | 'approved' | 'invoiced' | 'paid' | 'clawed_back' | 'disputed',
    invoiceNumber?: string,
    paymentDueDate?: Date
  ): Promise<void> {
    await db
      .update(loanCommissionLedger)
      .set({
        status,
        invoiceNumber: invoiceNumber || undefined,
        paymentDueDate: paymentDueDate || undefined,
        updatedAt: new Date(),
      } as any)
      .where(eq(loanCommissionLedger.id, id));
  }

  getCommissionRateConfig(productType: LoanProductType): CommissionRateConfig {
    return COMMISSION_RATE_CONFIG[productType] || COMMISSION_RATE_CONFIG.personal;
  }

  getAllCommissionRates(): CommissionRateConfig[] {
    return Object.values(COMMISSION_RATE_CONFIG);
  }
}

export const loanCommissionService = new LoanCommissionService();
