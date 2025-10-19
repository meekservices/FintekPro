import { storage } from "./storage";
import type { InsertAgentCommission } from "@shared/schema";
import { format } from "date-fns";

export interface CommissionCalculationInput {
  agentId: string;
  clientId: string;
  orderId: string;
  productType: string;
  transactionType: string;
  transactionAmount: number;
  totalCommissionAmount: number;
  transactionDate?: Date;
}

export interface CommissionCalculationResult {
  agentId: string;
  masterAgentId: string | null;
  agentCommissionRate: number;
  agentCommissionAmount: number;
  agentTdsAmount: number;
  agentNetCommission: number;
  masterCommissionRate: number;
  masterCommissionAmount: number;
  masterTdsAmount: number;
  masterNetCommission: number;
  splitRuleId: string | null;
}

class CommissionEngine {
  private readonly TDS_RATE = 0.10; // 10% TDS on commissions

  /**
   * Calculate commissions for an agent and their master agent (if applicable)
   */
  async calculateCommission(input: CommissionCalculationInput): Promise<CommissionCalculationResult> {
    const agent = await storage.getAgentById(input.agentId);
    
    if (!agent) {
      throw new Error(`Agent ${input.agentId} not found`);
    }

    // Check if agent has a master agent
    const masterAgentId = agent.masterAgentId;
    let splitRule = null;

    if (masterAgentId) {
      // Get active commission split rule for this agent and product type
      splitRule = await storage.getActiveCommissionSplit(input.agentId, input.productType);
    }

    let agentCommissionRate = 100; // Default: agent gets 100%
    let masterCommissionRate = 0;

    if (splitRule && masterAgentId) {
      // Apply commission split
      agentCommissionRate = parseFloat(splitRule.subAgentShare.toString());
      masterCommissionRate = parseFloat(splitRule.masterAgentShare.toString());
    }

    // Calculate amounts
    const agentCommissionAmount = (input.totalCommissionAmount * agentCommissionRate) / 100;
    const masterCommissionAmount = masterAgentId ? (input.totalCommissionAmount * masterCommissionRate) / 100 : 0;

    // Calculate TDS (10% on commissions)
    const agentTdsAmount = agentCommissionAmount * this.TDS_RATE;
    const masterTdsAmount = masterAgentId ? masterCommissionAmount * this.TDS_RATE : 0;

    // Net commission after TDS
    const agentNetCommission = agentCommissionAmount - agentTdsAmount;
    const masterNetCommission = masterAgentId ? masterCommissionAmount - masterTdsAmount : 0;

    return {
      agentId: input.agentId,
      masterAgentId,
      agentCommissionRate,
      agentCommissionAmount,
      agentTdsAmount,
      agentNetCommission,
      masterCommissionRate,
      masterCommissionAmount,
      masterTdsAmount,
      masterNetCommission,
      splitRuleId: splitRule?.id || null,
    };
  }

  /**
   * Create commission entry in database
   */
  async recordCommission(input: CommissionCalculationInput): Promise<void> {
    try {
      const calculation = await this.calculateCommission(input);
      const transactionDate = input.transactionDate || new Date();
      const month = format(transactionDate, "yyyy-MM");
      const financialYear = this.getFinancialYear(transactionDate);

      const commissionData: InsertAgentCommission = {
        agentId: calculation.agentId,
        masterAgentId: calculation.masterAgentId,
        clientId: input.clientId,
        orderId: input.orderId,
        productType: input.productType,
        transactionType: input.transactionType,
        transactionAmount: input.transactionAmount.toFixed(2),
        totalCommissionAmount: input.totalCommissionAmount.toFixed(2),
        
        agentCommissionRate: calculation.agentCommissionRate.toFixed(2),
        agentCommissionAmount: calculation.agentCommissionAmount.toFixed(2),
        agentTdsAmount: calculation.agentTdsAmount.toFixed(2),
        agentNetCommission: calculation.agentNetCommission.toFixed(2),
        
        masterCommissionRate: calculation.masterCommissionRate.toFixed(2),
        masterCommissionAmount: calculation.masterCommissionAmount.toFixed(2),
        masterTdsAmount: calculation.masterTdsAmount.toFixed(2),
        masterNetCommission: calculation.masterNetCommission.toFixed(2),
        
        splitRuleId: calculation.splitRuleId,
        
        agentSettlementStatus: "pending",
        masterSettlementStatus: "pending",
        
        transactionDate,
        month,
        financialYear,
      };

      await storage.createAgentCommission(commissionData);
      
      console.log(`✅ Commission recorded for agent ${calculation.agentId}: ₹${calculation.agentNetCommission.toFixed(2)}`);
      if (calculation.masterAgentId) {
        console.log(`✅ Commission recorded for master agent ${calculation.masterAgentId}: ₹${calculation.masterNetCommission.toFixed(2)}`);
      }
    } catch (error) {
      console.error("Commission recording error:", error);
      throw error;
    }
  }

  /**
   * Bulk record commissions for multiple transactions
   */
  async bulkRecordCommissions(inputs: CommissionCalculationInput[]): Promise<void> {
    const promises = inputs.map(input => this.recordCommission(input));
    await Promise.all(promises);
  }

  /**
   * Get financial year for a given date (Apr-Mar)
   */
  private getFinancialYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    
    if (month >= 4) {
      // April to December: FY is current year to next year
      return `FY${year.toString().slice(2)}-${(year + 1).toString().slice(2)}`;
    } else {
      // January to March: FY is previous year to current year
      return `FY${(year - 1).toString().slice(2)}-${year.toString().slice(2)}`;
    }
  }

  /**
   * Simulate commission calculation without recording (for preview)
   */
  async previewCommission(input: CommissionCalculationInput): Promise<CommissionCalculationResult> {
    return await this.calculateCommission(input);
  }

  /**
   * Calculate total commissions for a period
   */
  async calculatePeriodCommissions(agentId: string, month: string): Promise<{
    totalTransactions: number;
    totalVolume: number;
    grossCommission: number;
    totalTds: number;
    netCommission: number;
    settled: number;
    pending: number;
  }> {
    const commissions = await storage.getAgentCommissions(agentId, { month });
    
    const totalTransactions = commissions.length;
    const totalVolume = commissions.reduce((sum, c) => sum + parseFloat(c.transactionAmount.toString()), 0);
    const grossCommission = commissions.reduce((sum, c) => sum + parseFloat(c.agentCommissionAmount.toString()), 0);
    const totalTds = commissions.reduce((sum, c) => sum + parseFloat(c.agentTdsAmount.toString()), 0);
    const netCommission = commissions.reduce((sum, c) => sum + parseFloat(c.agentNetCommission.toString()), 0);
    
    const settled = commissions
      .filter(c => c.agentSettlementStatus === "settled")
      .reduce((sum, c) => sum + parseFloat(c.agentNetCommission.toString()), 0);
    
    const pending = commissions
      .filter(c => c.agentSettlementStatus === "pending")
      .reduce((sum, c) => sum + parseFloat(c.agentNetCommission.toString()), 0);

    return {
      totalTransactions,
      totalVolume,
      grossCommission,
      totalTds,
      netCommission,
      settled,
      pending,
    };
  }

  /**
   * Calculate commissions for master agent (including all sub-agents)
   */
  async calculateMasterAgentCommissions(masterAgentId: string, month: string): Promise<{
    subAgentCount: number;
    totalTransactions: number;
    totalVolume: number;
    grossCommission: number;
    totalTds: number;
    netCommission: number;
    settled: number;
    pending: number;
  }> {
    const commissions = await storage.getMasterAgentCommissions(masterAgentId, { month });
    const subAgents = await storage.getSubAgents(masterAgentId);
    
    const subAgentCount = subAgents.length;
    const totalTransactions = commissions.length;
    const totalVolume = commissions.reduce((sum, c) => sum + parseFloat(c.transactionAmount.toString()), 0);
    const grossCommission = commissions.reduce((sum, c) => sum + parseFloat(c.masterCommissionAmount.toString()), 0);
    const totalTds = commissions.reduce((sum, c) => sum + parseFloat(c.masterTdsAmount.toString()), 0);
    const netCommission = commissions.reduce((sum, c) => sum + parseFloat(c.masterNetCommission.toString()), 0);
    
    const settled = commissions
      .filter(c => c.masterSettlementStatus === "settled")
      .reduce((sum, c) => sum + parseFloat(c.masterNetCommission.toString()), 0);
    
    const pending = commissions
      .filter(c => c.masterSettlementStatus === "pending")
      .reduce((sum, c) => sum + parseFloat(c.masterNetCommission.toString()), 0);

    return {
      subAgentCount,
      totalTransactions,
      totalVolume,
      grossCommission,
      totalTds,
      netCommission,
      settled,
      pending,
    };
  }

  /**
   * Get commission breakdown by product type
   */
  async getCommissionBreakdownByProduct(agentId: string, month: string): Promise<Array<{
    productType: string;
    transactions: number;
    volume: number;
    commission: number;
  }>> {
    const commissions = await storage.getAgentCommissions(agentId, { month });
    
    const productMap = new Map<string, { transactions: number; volume: number; commission: number }>();
    
    commissions.forEach(c => {
      const existing = productMap.get(c.productType) || { transactions: 0, volume: 0, commission: 0 };
      existing.transactions += 1;
      existing.volume += parseFloat(c.transactionAmount.toString());
      existing.commission += parseFloat(c.agentNetCommission.toString());
      productMap.set(c.productType, existing);
    });
    
    return Array.from(productMap.entries()).map(([productType, data]) => ({
      productType,
      ...data,
    }));
  }
}

export const commissionEngine = new CommissionEngine();
