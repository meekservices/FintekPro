import { db } from "../db";
import { 
  investorClassificationRules, 
  userInvestorClassifications,
  investorBrokerageStructures,
  productEligibilityRules,
  investmentLimitOverrideProposals,
  activeInvestmentLimitOverrides,
  riskDisclosureTemplates,
  regulatoryViolationLogs,
  userProfiles,
  users,
  type InvestorClassificationRule,
  type UserInvestorClassification,
  type InvestorBrokerageStructure,
  type ProductEligibilityRule,
  type InvestmentLimitOverrideProposal,
  type RiskDisclosureTemplate
} from "@shared/schema";
import { eq, and, gte, lte, or, isNull, desc, sql } from "drizzle-orm";

// SEBI 2024 Investment Thresholds (in INR)
const SEBI_THRESHOLDS = {
  RETAIL_MAX: 200000, // ₹2 lakhs
  SHNI_MIN: 200001,
  SHNI_MAX: 1000000, // ₹10 lakhs
  BHNI_MIN: 1000001, // >₹10 lakhs
  QIB_MIN_NETWORTH: 10000000000, // ₹100 crore for institutions
  QIB_MIN_NETWORTH_CERTAIN: 2500000000, // ₹25 crore for certain entities
  ANCHOR_MIN_MAINBOARD: 100000000, // ₹10 crore for mainboard
  ANCHOR_MIN_SME: 10000000, // ₹1 crore for SME
  ACCREDITED_MIN_INCOME: 20000000, // ₹2 crore annual income
  ACCREDITED_MIN_NETWORTH: 75000000, // ₹7.5 crore net worth
  ACCREDITED_MIN_PORTFOLIO: 50000000, // ₹5 crore securities portfolio
};

// Default brokerage structures by investor type
const DEFAULT_BROKERAGE_STRUCTURES: Record<string, Partial<InvestorBrokerageStructure>> = {
  retail: {
    brokerageFeePercent: "0.50",
    platformFeePercent: "0.10",
    exchangeChargePercent: "0.0001",
    clearingChargePercent: "0.00005",
    sebiFeePercent: "0.00001",
    stampDutyPercent: "0.0001",
    gstPercent: "18.00",
    typicalYieldImpactBps: 60,
  },
  sHNI: {
    brokerageFeePercent: "0.35",
    platformFeePercent: "0.08",
    exchangeChargePercent: "0.0001",
    clearingChargePercent: "0.00005",
    sebiFeePercent: "0.00001",
    stampDutyPercent: "0.0001",
    gstPercent: "18.00",
    typicalYieldImpactBps: 45,
  },
  bHNI: {
    brokerageFeePercent: "0.25",
    platformFeePercent: "0.05",
    exchangeChargePercent: "0.0001",
    clearingChargePercent: "0.00005",
    sebiFeePercent: "0.00001",
    stampDutyPercent: "0.0001",
    gstPercent: "18.00",
    typicalYieldImpactBps: 32,
  },
  qib: {
    brokerageFeePercent: "0.10",
    platformFeePercent: "0.02",
    exchangeChargePercent: "0.00005",
    clearingChargePercent: "0.00002",
    sebiFeePercent: "0.00001",
    stampDutyPercent: "0.0001",
    gstPercent: "18.00",
    typicalYieldImpactBps: 15,
  },
  anchor: {
    brokerageFeePercent: "0.05",
    platformFeePercent: "0.01",
    exchangeChargePercent: "0.00005",
    clearingChargePercent: "0.00002",
    sebiFeePercent: "0.00001",
    stampDutyPercent: "0.0001",
    gstPercent: "18.00",
    typicalYieldImpactBps: 8,
  },
};

export class RegulatoryFrameworkService {
  
  /**
   * Auto-classify investor based on investment amount, net worth, and KYC tier
   */
  async classifyInvestor(
    userId: string,
    investmentAmount?: number,
    netWorth?: number,
    kycTier?: string,
    entityType?: string
  ): Promise<{
    classificationType: string;
    classificationBasis: string;
    rule: InvestorClassificationRule | null;
    brokerageStructure: Partial<InvestorBrokerageStructure>;
  }> {
    // Get user profile for additional context
    const [userProfile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
    const effectiveNetWorth = netWorth || (userProfile?.netWorthAmount ? parseFloat(String(userProfile.netWorthAmount)) : 0);
    const effectiveKycTier = kycTier || userProfile?.kycTier || 'basic';
    const effectiveEntityType = entityType || userProfile?.clientType || 'individual';
    
    // Check for QIB eligibility first (institutional investors)
    if (this.isQibEligible(effectiveEntityType, effectiveNetWorth)) {
      return {
        classificationType: 'qib',
        classificationBasis: 'sebi_registration',
        rule: await this.getClassificationRule('qib'),
        brokerageStructure: DEFAULT_BROKERAGE_STRUCTURES.qib,
      };
    }
    
    // Classification based on investment amount (SEBI 2024)
    if (investmentAmount) {
      if (investmentAmount <= SEBI_THRESHOLDS.RETAIL_MAX) {
        return {
          classificationType: 'retail',
          classificationBasis: 'investment_amount',
          rule: await this.getClassificationRule('retail'),
          brokerageStructure: DEFAULT_BROKERAGE_STRUCTURES.retail,
        };
      } else if (investmentAmount <= SEBI_THRESHOLDS.SHNI_MAX) {
        return {
          classificationType: 'sHNI',
          classificationBasis: 'investment_amount',
          rule: await this.getClassificationRule('sHNI'),
          brokerageStructure: DEFAULT_BROKERAGE_STRUCTURES.sHNI,
        };
      } else {
        return {
          classificationType: 'bHNI',
          classificationBasis: 'investment_amount',
          rule: await this.getClassificationRule('bHNI'),
          brokerageStructure: DEFAULT_BROKERAGE_STRUCTURES.bHNI,
        };
      }
    }
    
    // Classification based on net worth if no investment amount specified
    if (effectiveNetWorth >= SEBI_THRESHOLDS.BHNI_MIN) {
      return {
        classificationType: 'bHNI',
        classificationBasis: 'net_worth',
        rule: await this.getClassificationRule('bHNI'),
        brokerageStructure: DEFAULT_BROKERAGE_STRUCTURES.bHNI,
      };
    } else if (effectiveNetWorth >= SEBI_THRESHOLDS.SHNI_MIN) {
      return {
        classificationType: 'sHNI',
        classificationBasis: 'net_worth',
        rule: await this.getClassificationRule('sHNI'),
        brokerageStructure: DEFAULT_BROKERAGE_STRUCTURES.sHNI,
      };
    }
    
    // Default to retail
    return {
      classificationType: 'retail',
      classificationBasis: 'investment_amount',
      rule: await this.getClassificationRule('retail'),
      brokerageStructure: DEFAULT_BROKERAGE_STRUCTURES.retail,
    };
  }
  
  /**
   * Check if entity is eligible for QIB classification
   */
  private isQibEligible(entityType: string, netWorth: number): boolean {
    const qibEntityTypes = ['mutual_fund', 'insurance', 'pension_fund', 'fpi', 'bank', 'nbfc', 'aif', 'vc'];
    
    if (qibEntityTypes.includes(entityType.toLowerCase())) {
      // Institutions need minimum ₹100 crore or ₹25 crore for certain entities
      return netWorth >= SEBI_THRESHOLDS.QIB_MIN_NETWORTH_CERTAIN;
    }
    
    return false;
  }
  
  /**
   * Get classification rule from database
   */
  async getClassificationRule(classificationType: string): Promise<InvestorClassificationRule | null> {
    const [rule] = await db.select()
      .from(investorClassificationRules)
      .where(and(
        eq(investorClassificationRules.classificationType, classificationType),
        eq(investorClassificationRules.isActive, true)
      ))
      .limit(1);
    
    return rule || null;
  }
  
  /**
   * Save user's investor classification to profile
   */
  async saveUserClassification(
    userId: string,
    classification: {
      classificationType: string;
      classificationBasis: string;
      investmentAmount?: number;
      netWorth?: number;
      verifiedBy?: string;
    }
  ): Promise<UserInvestorClassification> {
    // Check for existing active classification
    const [existing] = await db.select()
      .from(userInvestorClassifications)
      .where(and(
        eq(userInvestorClassifications.userId, userId),
        eq(userInvestorClassifications.classificationStatus, 'active')
      ))
      .limit(1);
    
    // Expire the existing classification
    if (existing) {
      await db.update(userInvestorClassifications)
        .set({ 
          classificationStatus: existing.classificationType === classification.classificationType ? 'active' : 'upgraded',
          updatedAt: new Date()
        })
        .where(eq(userInvestorClassifications.id, existing.id));
    }
    
    // Get the classification rule
    const rule = await this.getClassificationRule(classification.classificationType);
    
    // Calculate expiry (1 year for QIB/accredited, null for retail/HNI)
    const expiresAt = ['qib', 'anchor'].includes(classification.classificationType) 
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) 
      : null;
    
    // Insert new classification
    const [newClassification] = await db.insert(userInvestorClassifications)
      .values({
        userId,
        classificationType: classification.classificationType,
        classificationRuleId: rule?.id,
        classificationBasis: classification.classificationBasis,
        investmentAmountAtClassification: classification.investmentAmount?.toString(),
        netWorthAtClassification: classification.netWorth?.toString(),
        classificationStatus: 'active',
        expiresAt,
        verifiedBy: classification.verifiedBy,
        verificationMethod: classification.verifiedBy ? 'manual' : 'auto',
        previousClassification: existing?.classificationType,
      })
      .returning();
    
    // Update user profile with investor type
    await db.update(userProfiles)
      .set({
        investorType: classification.classificationType,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, userId));
    
    return newClassification;
  }
  
  /**
   * Get user's current investor classification
   */
  async getUserClassification(userId: string): Promise<UserInvestorClassification | null> {
    const [classification] = await db.select()
      .from(userInvestorClassifications)
      .where(and(
        eq(userInvestorClassifications.userId, userId),
        eq(userInvestorClassifications.classificationStatus, 'active')
      ))
      .orderBy(desc(userInvestorClassifications.classifiedAt))
      .limit(1);
    
    return classification || null;
  }
  
  /**
   * Get brokerage structure for investor type and product category
   */
  async getBrokerageStructure(
    investorType: string,
    productCategory: string
  ): Promise<InvestorBrokerageStructure | Partial<InvestorBrokerageStructure>> {
    // Try to find in database first
    const [structure] = await db.select()
      .from(investorBrokerageStructures)
      .where(and(
        eq(investorBrokerageStructures.investorType, investorType),
        eq(investorBrokerageStructures.productCategory, productCategory),
        eq(investorBrokerageStructures.isActive, true)
      ))
      .limit(1);
    
    if (structure) return structure;
    
    // Return default structure
    return DEFAULT_BROKERAGE_STRUCTURES[investorType] || DEFAULT_BROKERAGE_STRUCTURES.retail;
  }
  
  /**
   * Calculate total transaction costs
   */
  calculateTransactionCosts(
    investmentAmount: number,
    brokerageStructure: Partial<InvestorBrokerageStructure>
  ): {
    brokerage: number;
    platformFee: number;
    exchangeCharges: number;
    clearingCharges: number;
    sebiFee: number;
    stampDuty: number;
    gst: number;
    totalCharges: number;
    netInvestmentAmount: number;
    yieldImpactBps: number;
  } {
    const brokerage = investmentAmount * (parseFloat(String(brokerageStructure.brokerageFeePercent || 0)) / 100);
    const platformFee = investmentAmount * (parseFloat(String(brokerageStructure.platformFeePercent || 0)) / 100) +
                        parseFloat(String(brokerageStructure.flatPlatformFee || 0));
    const exchangeCharges = investmentAmount * (parseFloat(String(brokerageStructure.exchangeChargePercent || 0)) / 100);
    const clearingCharges = investmentAmount * (parseFloat(String(brokerageStructure.clearingChargePercent || 0)) / 100);
    const sebiFee = investmentAmount * (parseFloat(String(brokerageStructure.sebiFeePercent || 0)) / 100);
    const stampDuty = investmentAmount * (parseFloat(String(brokerageStructure.stampDutyPercent || 0)) / 100);
    
    const chargesBeforeGst = brokerage + platformFee;
    const gst = chargesBeforeGst * (parseFloat(String(brokerageStructure.gstPercent || 0)) / 100);
    
    const totalCharges = brokerage + platformFee + exchangeCharges + clearingCharges + sebiFee + stampDuty + gst;
    
    return {
      brokerage: Math.round(brokerage * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      exchangeCharges: Math.round(exchangeCharges * 100) / 100,
      clearingCharges: Math.round(clearingCharges * 100) / 100,
      sebiFee: Math.round(sebiFee * 100) / 100,
      stampDuty: Math.round(stampDuty * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      totalCharges: Math.round(totalCharges * 100) / 100,
      netInvestmentAmount: Math.round((investmentAmount - totalCharges) * 100) / 100,
      yieldImpactBps: brokerageStructure.typicalYieldImpactBps || 0,
    };
  }
  
  /**
   * Check product eligibility for user
   */
  async checkProductEligibility(
    userId: string,
    productCategory: string,
    investmentAmount: number,
    isin?: string
  ): Promise<{
    isEligible: boolean;
    violations: Array<{ code: string; message: string }>;
    investorType: string;
    brokerageStructure: Partial<InvestorBrokerageStructure>;
    transactionCosts: {
      brokerage: number;
      platformFee: number;
      exchangeCharges: number;
      clearingCharges: number;
      sebiFee: number;
      stampDuty: number;
      gst: number;
      totalCharges: number;
      netInvestmentAmount: number;
      yieldImpactBps: number;
    };
  }> {
    const violations: Array<{ code: string; message: string }> = [];
    
    // Get user's current classification
    let classification = await this.getUserClassification(userId);
    
    // Auto-classify if no classification exists
    if (!classification) {
      const autoClassification = await this.classifyInvestor(userId, investmentAmount);
      await this.saveUserClassification(userId, {
        classificationType: autoClassification.classificationType,
        classificationBasis: autoClassification.classificationBasis,
        investmentAmount,
      });
      classification = await this.getUserClassification(userId);
    }
    
    const investorType = classification?.classificationType || 'retail';
    
    // Get eligibility rules for the product
    const rules = await db.select()
      .from(productEligibilityRules)
      .where(and(
        eq(productEligibilityRules.productCategory, productCategory),
        eq(productEligibilityRules.isActive, true),
        or(
          isNull(productEligibilityRules.isin),
          isin ? eq(productEligibilityRules.isin, isin) : sql`1=1`
        )
      ));
    
    // Get user profile for KYC tier
    const [userProfile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
    // Check active overrides for user
    const activeOverrides = await db.select()
      .from(activeInvestmentLimitOverrides)
      .where(and(
        eq(activeInvestmentLimitOverrides.userId, userId),
        eq(activeInvestmentLimitOverrides.productCategory, productCategory),
        eq(activeInvestmentLimitOverrides.isActive, true),
        lte(activeInvestmentLimitOverrides.validFrom, new Date()),
        gte(activeInvestmentLimitOverrides.validUntil, new Date())
      ));
    
    // Apply rules
    for (const rule of rules) {
      // Check investor type eligibility
      const allowedTypes = (rule.allowedInvestorTypes || []) as string[];
      if (allowedTypes.length > 0 && !allowedTypes.includes(investorType)) {
        violations.push({
          code: 'INVESTOR_TYPE_INELIGIBLE',
          message: `Your investor type (${investorType}) is not eligible for this product. Allowed: ${allowedTypes.join(', ')}`
        });
      }
      
      // Check KYC tier
      const kycTierOrder = ['basic', 'enhanced', 'accredited_investor'];
      const userKycTierIndex = kycTierOrder.indexOf(userProfile?.kycTier || 'basic');
      const requiredKycTierIndex = kycTierOrder.indexOf(rule.minKycTier);
      
      if (userKycTierIndex < requiredKycTierIndex) {
        violations.push({
          code: 'KYC_INSUFFICIENT',
          message: `This product requires ${rule.minKycTier} KYC. Your current tier: ${userProfile?.kycTier || 'basic'}`
        });
      }
      
      // Check investment limits (unless overridden)
      const hasOverride = activeOverrides.some(o => o.overrideType === 'investment_limit');
      
      if (!hasOverride) {
        if (rule.minInvestment && investmentAmount < parseFloat(String(rule.minInvestment))) {
          violations.push({
            code: 'MIN_INVESTMENT_NOT_MET',
            message: `Minimum investment amount is ₹${parseFloat(String(rule.minInvestment)).toLocaleString('en-IN')}`
          });
        }
        
        if (rule.maxInvestment && investmentAmount > parseFloat(String(rule.maxInvestment))) {
          violations.push({
            code: 'MAX_INVESTMENT_EXCEEDED',
            message: `Maximum investment amount is ₹${parseFloat(String(rule.maxInvestment)).toLocaleString('en-IN')}`
          });
        }
      }
      
      // Check accredited investor requirement
      if (rule.requiresAccreditedInvestor && userProfile?.accreditedInvestorStatus !== 'verified') {
        violations.push({
          code: 'ACCREDITED_INVESTOR_REQUIRED',
          message: 'This product requires accredited investor status'
        });
      }
    }
    
    // Get brokerage structure
    const brokerageStructure = await this.getBrokerageStructure(investorType, productCategory);
    const transactionCosts = this.calculateTransactionCosts(investmentAmount, brokerageStructure);
    
    // Log violations if any
    if (violations.length > 0) {
      for (const violation of violations) {
        await db.insert(regulatoryViolationLogs).values({
          userId,
          violationType: violation.code.includes('KYC') ? 'kyc_insufficient' : 
                         violation.code.includes('INVESTMENT') ? 'investment_limit_exceeded' : 
                         'product_ineligible',
          violationCode: violation.code,
          violationDescription: violation.message,
          productCategory,
          isin,
          attemptedAmount: investmentAmount.toString(),
          resolutionStatus: 'blocked',
        });
      }
    }
    
    return {
      isEligible: violations.length === 0,
      violations,
      investorType,
      brokerageStructure,
      transactionCosts,
    };
  }
  
  /**
   * Create override proposal (Admin/Partner/Agent)
   */
  async createOverrideProposal(
    proposal: {
      userId: string;
      productCategory: string;
      productSubCategory?: string;
      isin?: string;
      overrideType: string;
      currentInvestorType?: string;
      proposedInvestorType?: string;
      currentMinInvestment?: number;
      proposedMinInvestment?: number;
      currentMaxInvestment?: number;
      proposedMaxInvestment?: number;
      currentBrokeragePercent?: number;
      proposedBrokeragePercent?: number;
      justification: string;
      validFrom: Date;
      validUntil: Date;
      proposedBy: string;
      proposerRole: string;
    }
  ): Promise<InvestmentLimitOverrideProposal> {
    const [created] = await db.insert(investmentLimitOverrideProposals)
      .values({
        userId: proposal.userId,
        productCategory: proposal.productCategory,
        productSubCategory: proposal.productSubCategory,
        isin: proposal.isin,
        overrideType: proposal.overrideType,
        currentInvestorType: proposal.currentInvestorType,
        proposedInvestorType: proposal.proposedInvestorType,
        currentMinInvestment: proposal.currentMinInvestment?.toString(),
        proposedMinInvestment: proposal.proposedMinInvestment?.toString(),
        currentMaxInvestment: proposal.currentMaxInvestment?.toString(),
        proposedMaxInvestment: proposal.proposedMaxInvestment?.toString(),
        currentBrokeragePercent: proposal.currentBrokeragePercent?.toString(),
        proposedBrokeragePercent: proposal.proposedBrokeragePercent?.toString(),
        justification: proposal.justification,
        validFrom: proposal.validFrom,
        validUntil: proposal.validUntil,
        proposedBy: proposal.proposedBy,
        proposerRole: proposal.proposerRole,
        status: 'pending',
      })
      .returning();
    
    return created;
  }
  
  /**
   * Review and approve/reject override proposal
   */
  async reviewOverrideProposal(
    proposalId: string,
    reviewLevel: 'level1' | 'level2' | 'final',
    reviewedBy: string,
    decision: 'approved' | 'rejected' | 'escalated',
    notes: string
  ): Promise<InvestmentLimitOverrideProposal> {
    const [proposal] = await db.select()
      .from(investmentLimitOverrideProposals)
      .where(eq(investmentLimitOverrideProposals.id, proposalId))
      .limit(1);
    
    if (!proposal) {
      throw new Error('Proposal not found');
    }
    
    const updateData: Partial<InvestmentLimitOverrideProposal> = {
      updatedAt: new Date(),
    };
    
    if (reviewLevel === 'level1') {
      updateData.level1ReviewedBy = reviewedBy;
      updateData.level1ReviewedAt = new Date();
      updateData.level1Status = decision;
      updateData.level1Notes = notes;
      updateData.status = decision === 'rejected' ? 'rejected' : 'under_review';
    } else if (reviewLevel === 'level2') {
      updateData.level2ReviewedBy = reviewedBy;
      updateData.level2ReviewedAt = new Date();
      updateData.level2Status = decision;
      updateData.level2Notes = notes;
      updateData.status = decision === 'rejected' ? 'rejected' : 'under_review';
    } else if (reviewLevel === 'final') {
      if (decision === 'approved') {
        updateData.finalApprovedBy = reviewedBy;
        updateData.finalApprovedAt = new Date();
        updateData.finalApprovalNotes = notes;
        updateData.status = 'approved';
        
        // Create active override
        await this.activateOverride(proposal);
      } else {
        updateData.rejectedBy = reviewedBy;
        updateData.rejectedAt = new Date();
        updateData.rejectionReason = notes;
        updateData.status = 'rejected';
      }
    }
    
    const [updated] = await db.update(investmentLimitOverrideProposals)
      .set(updateData)
      .where(eq(investmentLimitOverrideProposals.id, proposalId))
      .returning();
    
    return updated;
  }
  
  /**
   * Activate an approved override
   */
  private async activateOverride(proposal: InvestmentLimitOverrideProposal): Promise<void> {
    await db.insert(activeInvestmentLimitOverrides).values({
      proposalId: proposal.id,
      userId: proposal.userId,
      productCategory: proposal.productCategory,
      productSubCategory: proposal.productSubCategory,
      isin: proposal.isin,
      overrideType: proposal.overrideType,
      overrideValue: {
        proposedInvestorType: proposal.proposedInvestorType,
        proposedMinInvestment: proposal.proposedMinInvestment,
        proposedMaxInvestment: proposal.proposedMaxInvestment,
        proposedBrokeragePercent: proposal.proposedBrokeragePercent,
      },
      validFrom: proposal.validFrom,
      validUntil: proposal.validUntil,
      isActive: true,
    });
  }
  
  /**
   * Get pending override proposals
   */
  async getPendingProposals(filters?: {
    status?: string;
    proposerRole?: string;
  }): Promise<InvestmentLimitOverrideProposal[]> {
    let query = db.select()
      .from(investmentLimitOverrideProposals)
      .orderBy(desc(investmentLimitOverrideProposals.proposedAt));
    
    if (filters?.status) {
      query = query.where(eq(investmentLimitOverrideProposals.status, filters.status)) as typeof query;
    }
    
    if (filters?.proposerRole) {
      query = query.where(eq(investmentLimitOverrideProposals.proposerRole, filters.proposerRole)) as typeof query;
    }
    
    return query;
  }
  
  /**
   * Get risk disclosure templates for product category
   */
  async getRiskDisclosureTemplates(
    productCategory: string,
    disclosureType?: string
  ): Promise<RiskDisclosureTemplate[]> {
    const conditions = [
      eq(riskDisclosureTemplates.productCategory, productCategory),
      eq(riskDisclosureTemplates.isActive, true)
    ];
    
    if (disclosureType) {
      conditions.push(eq(riskDisclosureTemplates.disclosureType, disclosureType));
    }
    
    return db.select()
      .from(riskDisclosureTemplates)
      .where(and(...conditions));
  }
  
  /**
   * Seed default classification rules
   */
  async seedDefaultClassificationRules(): Promise<void> {
    const existingRules = await db.select().from(investorClassificationRules).limit(1);
    
    if (existingRules.length > 0) {
      console.log('Classification rules already exist, skipping seed');
      return;
    }
    
    const defaultRules = [
      {
        classificationType: 'retail',
        displayName: 'Retail Individual Investor (RII)',
        description: 'Individual investors with investment up to ₹2 lakhs per PAN',
        minInvestmentAmount: '10000',
        maxInvestmentAmount: '200000',
        requiredKycTier: 'basic',
        eligibleEntityTypes: ['individual', 'nri', 'huf'],
        allotmentMethod: 'lottery',
        ipoQuotaPercentage: '35.00',
        canBidAtCutoff: true,
        canWithdrawBid: true,
        lockInPeriodDays: 0,
        isActive: true,
      },
      {
        classificationType: 'sHNI',
        displayName: 'Small HNI (sHNI/Small NII)',
        description: 'Non-institutional investors with investment between ₹2 lakhs to ₹10 lakhs',
        minInvestmentAmount: '200001',
        maxInvestmentAmount: '1000000',
        requiredKycTier: 'enhanced',
        eligibleEntityTypes: ['individual', 'nri', 'huf', 'company', 'trust', 'llp'],
        allotmentMethod: 'lottery',
        ipoQuotaPercentage: '5.00',
        canBidAtCutoff: false,
        canWithdrawBid: false,
        lockInPeriodDays: 0,
        isActive: true,
      },
      {
        classificationType: 'bHNI',
        displayName: 'Big HNI (bHNI/Large NII)',
        description: 'Non-institutional investors with investment above ₹10 lakhs',
        minInvestmentAmount: '1000001',
        maxInvestmentAmount: null,
        requiredKycTier: 'enhanced',
        eligibleEntityTypes: ['individual', 'nri', 'huf', 'company', 'trust', 'llp'],
        allotmentMethod: 'lottery',
        ipoQuotaPercentage: '10.00',
        canBidAtCutoff: false,
        canWithdrawBid: false,
        lockInPeriodDays: 0,
        isActive: true,
      },
      {
        classificationType: 'qib',
        displayName: 'Qualified Institutional Buyer (QIB)',
        description: 'SEBI-registered institutional investors with assets exceeding ₹100 crore',
        minInvestmentAmount: '0',
        maxInvestmentAmount: null,
        minNetWorth: '10000000000',
        requiredKycTier: 'accredited_investor',
        requiresSEBIRegistration: true,
        eligibleEntityTypes: ['mutual_fund', 'insurance', 'pension_fund', 'fpi', 'bank', 'nbfc', 'aif', 'vc'],
        allotmentMethod: 'proportionate',
        ipoQuotaPercentage: '50.00',
        canBidAtCutoff: false,
        canWithdrawBid: false,
        lockInPeriodDays: 0,
        isActive: true,
      },
      {
        classificationType: 'anchor',
        displayName: 'Anchor Investor',
        description: 'QIBs applying before public opening with minimum ₹10 crore investment',
        minInvestmentAmount: '100000000',
        maxInvestmentAmount: null,
        minNetWorth: '10000000000',
        requiredKycTier: 'accredited_investor',
        requiresSEBIRegistration: true,
        eligibleEntityTypes: ['mutual_fund', 'insurance', 'pension_fund', 'fpi', 'bank', 'nbfc', 'aif'],
        allotmentMethod: 'direct',
        ipoQuotaPercentage: '30.00',
        canBidAtCutoff: false,
        canWithdrawBid: false,
        lockInPeriodDays: 30,
        isActive: true,
      },
    ];
    
    for (const rule of defaultRules) {
      await db.insert(investorClassificationRules).values(rule as any);
    }
    
    console.log('Seeded default investor classification rules');
  }
  
  /**
   * Seed default brokerage structures
   */
  async seedDefaultBrokerageStructures(): Promise<void> {
    const existingStructures = await db.select().from(investorBrokerageStructures).limit(1);
    
    if (existingStructures.length > 0) {
      console.log('Brokerage structures already exist, skipping seed');
      return;
    }
    
    const productCategories = ['bonds', 'ncds', 'gsec', 'sgb', 'cp', 'mld'];
    const investorTypes = ['retail', 'sHNI', 'bHNI', 'qib', 'anchor'];
    
    for (const productCategory of productCategories) {
      for (const investorType of investorTypes) {
        const defaultStructure = DEFAULT_BROKERAGE_STRUCTURES[investorType];
        
        await db.insert(investorBrokerageStructures).values({
          investorType,
          productCategory,
          ...defaultStructure,
          isActive: true,
        } as any);
      }
    }
    
    console.log('Seeded default brokerage structures');
  }
  
  /**
   * Seed default product eligibility rules
   */
  async seedDefaultEligibilityRules(): Promise<void> {
    const existingRules = await db.select().from(productEligibilityRules).limit(1);
    
    if (existingRules.length > 0) {
      console.log('Eligibility rules already exist, skipping seed');
      return;
    }
    
    const defaultEligibilityRules = [
      {
        productCategory: 'bonds',
        allowedInvestorTypes: ['retail', 'sHNI', 'bHNI', 'qib', 'anchor'],
        minKycTier: 'basic',
        allowedRiskProfiles: ['conservative', 'moderate', 'aggressive'],
        minInvestment: '10000',
        maxInvestment: null,
        requiresRiskDisclosure: true,
        riskDisclosureType: 'standard',
        regulatoryBody: 'SEBI',
        isActive: true,
      },
      {
        productCategory: 'ncds',
        allowedInvestorTypes: ['retail', 'sHNI', 'bHNI', 'qib', 'anchor'],
        minKycTier: 'basic',
        allowedRiskProfiles: ['moderate', 'aggressive'],
        minInvestment: '10000',
        maxInvestment: null,
        requiresRiskDisclosure: true,
        riskDisclosureType: 'enhanced',
        minCreditRating: 'A3',
        regulatoryBody: 'SEBI',
        isActive: true,
      },
      {
        productCategory: 'gsec',
        allowedInvestorTypes: ['retail', 'sHNI', 'bHNI', 'qib', 'anchor'],
        minKycTier: 'basic',
        allowedRiskProfiles: ['conservative', 'moderate', 'aggressive'],
        minInvestment: '10000',
        maxInvestment: null,
        requiresRiskDisclosure: false,
        regulatoryBody: 'RBI',
        isActive: true,
      },
      {
        productCategory: 'sgb',
        allowedInvestorTypes: ['retail', 'sHNI', 'bHNI'],
        minKycTier: 'basic',
        allowedRiskProfiles: ['conservative', 'moderate', 'aggressive'],
        minInvestment: '5000',
        maxInvestment: '40000000', // 4kg limit per fiscal year at ~₹1 lakh per gram
        requiresRiskDisclosure: true,
        riskDisclosureType: 'standard',
        regulatoryBody: 'RBI',
        isActive: true,
      },
      {
        productCategory: 'mld',
        productSubCategory: 'market_linked_debentures',
        allowedInvestorTypes: ['sHNI', 'bHNI', 'qib'],
        minKycTier: 'enhanced',
        allowedRiskProfiles: ['moderate', 'aggressive'],
        minInvestment: '1000000', // ₹10 lakhs minimum for MLDs
        maxInvestment: null,
        requiresAccreditedInvestor: false,
        requiresRiskDisclosure: true,
        riskDisclosureType: 'complex_product',
        requiresSuitabilityAssessment: true,
        coolingOffPeriodDays: 3,
        regulatoryBody: 'SEBI',
        isActive: true,
      },
      {
        productCategory: 'aif',
        productSubCategory: 'alternative_investment_fund',
        allowedInvestorTypes: ['bHNI', 'qib', 'anchor'],
        minKycTier: 'accredited_investor',
        allowedRiskProfiles: ['aggressive'],
        minInvestment: '10000000', // ₹1 crore minimum for AIFs
        maxInvestment: null,
        requiresAccreditedInvestor: true,
        minNetWorth: '75000000',
        requiresRiskDisclosure: true,
        riskDisclosureType: 'complex_product',
        requiresSuitabilityAssessment: true,
        coolingOffPeriodDays: 7,
        regulatoryBody: 'SEBI',
        isActive: true,
      },
      {
        productCategory: 'pms',
        productSubCategory: 'portfolio_management_service',
        allowedInvestorTypes: ['bHNI', 'qib'],
        minKycTier: 'enhanced',
        allowedRiskProfiles: ['moderate', 'aggressive'],
        minInvestment: '5000000', // ₹50 lakhs minimum for PMS
        maxInvestment: null,
        requiresRiskDisclosure: true,
        riskDisclosureType: 'enhanced',
        requiresSuitabilityAssessment: true,
        regulatoryBody: 'SEBI',
        isActive: true,
      },
    ];
    
    for (const rule of defaultEligibilityRules) {
      await db.insert(productEligibilityRules).values(rule as any);
    }
    
    console.log('Seeded default product eligibility rules');
  }
}

export const regulatoryFrameworkService = new RegulatoryFrameworkService();
