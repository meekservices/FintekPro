import { db } from "../db";
import { eq, and, desc, sql, inArray, gte, lte, or } from "drizzle-orm";
import {
  dsaLoanApplications,
  bankConnectors,
  loanEligibilityRules,
  loanRoutingHistory,
  dsaLoanDocuments,
  dsaLoanAuditLogs,
  dsaCommissionTracking,
  loanWebhookEvents,
  InsertDsaLoanApplication,
  InsertBankConnector,
  InsertLoanEligibilityRule,
  InsertDsaLoanDocument,
  InsertDsaLoanAuditLog,
  DsaLoanApplication,
  BankConnector,
} from "@shared/schema";
import { nanoid } from "nanoid";

type DsaLoanStatus = 'draft' | 'submitted' | 'eligibility_check' | 'routed' | 
  'pending_with_banks' | 'in_review' | 'approved' | 'rejected' | 
  'disbursed' | 'withdrawn' | 'expired';

type RoutingStrategy = 'parallel' | 'waterfall' | 'priority_first';

interface EligibilityResult {
  bankCode: string;
  bankName: string;
  eligible: boolean;
  reasons: string[];
  matchScore: number;
  estimatedRate?: number;
  processingDays?: number;
}

interface RoutingResult {
  success: boolean;
  applicationId: string;
  routedBanks: string[];
  strategy: RoutingStrategy;
  routingHistoryIds: string[];
}

class DsaLoanService {
  private generateApplicationNumber(): string {
    const prefix = 'DSA';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = nanoid(6).toUpperCase();
    return `${prefix}${year}${month}${random}`;
  }

  async createApplication(
    data: Partial<InsertDsaLoanApplication>,
    actorId?: string
  ): Promise<DsaLoanApplication> {
    const applicationNumber = this.generateApplicationNumber();

    const [application] = await db
      .insert(dsaLoanApplications)
      .values({
        ...data,
        applicationNumber,
        status: 'draft',
        applicantType: data.applicantType || 'individual',
        applicantName: data.applicantName || '',
        applicantPhone: data.applicantPhone || '',
        employmentType: data.employmentType || 'salaried',
        monthlyIncome: data.monthlyIncome || '0',
        loanType: data.loanType || 'personal',
        requestedAmount: data.requestedAmount || '0',
        requestedTenure: data.requestedTenure || 12,
      } as any)
      .returning();

    await this.createAuditLog({
      applicationId: application.id,
      action: 'application_created',
      actionCategory: 'workflow',
      actorId,
      newState: { status: 'draft', loanType: data.loanType, amount: data.requestedAmount },
    });

    return application;
  }

  async getApplication(id: string): Promise<DsaLoanApplication | null> {
    const [application] = await db
      .select()
      .from(dsaLoanApplications)
      .where(eq(dsaLoanApplications.id, id))
      .limit(1);
    return application || null;
  }

  async getApplicationByNumber(applicationNumber: string): Promise<DsaLoanApplication | null> {
    const [application] = await db
      .select()
      .from(dsaLoanApplications)
      .where(eq(dsaLoanApplications.applicationNumber, applicationNumber))
      .limit(1);
    return application || null;
  }

  async deleteApplication(id: string): Promise<void> {
    await db
      .delete(dsaLoanApplications)
      .where(eq(dsaLoanApplications.id, id));
  }

  async listApplications(filters: {
    agentId?: string;
    status?: DsaLoanStatus;
    loanType?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ applications: DsaLoanApplication[]; total: number }> {
    const conditions = [];
    
    if (filters.agentId) {
      conditions.push(eq(dsaLoanApplications.agentId, filters.agentId));
    }
    if (filters.status) {
      conditions.push(eq(dsaLoanApplications.status, filters.status));
    }
    if (filters.loanType) {
      conditions.push(eq(dsaLoanApplications.loanType, filters.loanType));
    }
    if (filters.fromDate) {
      conditions.push(gte(dsaLoanApplications.createdAt, filters.fromDate));
    }
    if (filters.toDate) {
      conditions.push(lte(dsaLoanApplications.createdAt, filters.toDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dsaLoanApplications)
      .where(whereClause);

    const applications = await db
      .select()
      .from(dsaLoanApplications)
      .where(whereClause)
      .orderBy(desc(dsaLoanApplications.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    return {
      applications,
      total: Number(countResult?.count || 0),
    };
  }

  async updateApplication(
    id: string,
    data: Partial<InsertDsaLoanApplication>,
    actorId?: string
  ): Promise<DsaLoanApplication> {
    const existing = await this.getApplication(id);
    if (!existing) {
      throw new Error('Application not found');
    }

    const [updated] = await db
      .update(dsaLoanApplications)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(dsaLoanApplications.id, id))
      .returning();

    await this.createAuditLog({
      applicationId: id,
      action: 'application_updated',
      actionCategory: 'workflow',
      actorId,
      previousState: { status: existing.status },
      newState: data,
      changedFields: Object.keys(data),
    });

    return updated;
  }

  async submitApplication(id: string, actorId?: string): Promise<DsaLoanApplication> {
    const application = await this.getApplication(id);
    if (!application) {
      throw new Error('Application not found');
    }
    if (application.status !== 'draft') {
      throw new Error('Only draft applications can be submitted');
    }

    const [updated] = await db
      .update(dsaLoanApplications)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
        currentStage: 'submission',
      })
      .where(eq(dsaLoanApplications.id, id))
      .returning();

    await this.createAuditLog({
      applicationId: id,
      action: 'application_submitted',
      actionCategory: 'workflow',
      actorId,
      previousState: { status: 'draft' },
      newState: { status: 'submitted' },
    });

    return updated;
  }

  async checkEligibility(applicationId: string): Promise<EligibilityResult[]> {
    const application = await this.getApplication(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const activeBanks = await db
      .select()
      .from(bankConnectors)
      .where(eq(bankConnectors.isActive, true));

    const rules = await db
      .select()
      .from(loanEligibilityRules)
      .where(eq(loanEligibilityRules.isActive, true));

    const results: EligibilityResult[] = [];

    for (const bank of activeBanks) {
      if (!bank.supportedLoanTypes?.includes(application.loanType)) {
        results.push({
          bankCode: bank.bankCode,
          bankName: bank.bankName,
          eligible: false,
          reasons: [`Bank does not support ${application.loanType} loans`],
          matchScore: 0,
        });
        continue;
      }

      if (bank.minAmount && Number(application.requestedAmount) < Number(bank.minAmount)) {
        results.push({
          bankCode: bank.bankCode,
          bankName: bank.bankName,
          eligible: false,
          reasons: [`Minimum loan amount is ₹${bank.minAmount}`],
          matchScore: 0,
        });
        continue;
      }

      if (bank.maxAmount && Number(application.requestedAmount) > Number(bank.maxAmount)) {
        results.push({
          bankCode: bank.bankCode,
          bankName: bank.bankName,
          eligible: false,
          reasons: [`Maximum loan amount is ₹${bank.maxAmount}`],
          matchScore: 0,
        });
        continue;
      }

      const bankRules = rules.filter(r => r.bankCode === bank.bankCode && r.loanType === application.loanType);
      let eligible = true;
      const reasons: string[] = [];
      let matchScore = 100;

      for (const rule of bankRules) {
        if (rule.minCreditScore && application.creditScore && application.creditScore < rule.minCreditScore) {
          eligible = false;
          reasons.push(`Credit score below minimum (${rule.minCreditScore})`);
          matchScore -= 30;
        }

        if (rule.minMonthlyIncome && application.monthlyIncome && 
            Number(application.monthlyIncome) < Number(rule.minMonthlyIncome)) {
          eligible = false;
          reasons.push(`Monthly income below minimum (₹${rule.minMonthlyIncome})`);
          matchScore -= 25;
        }

        if (rule.allowedEmploymentTypes && rule.allowedEmploymentTypes.length > 0) {
          if (!rule.allowedEmploymentTypes.includes(application.employmentType)) {
            eligible = false;
            reasons.push(`Employment type not accepted`);
            matchScore -= 20;
          }
        }

        if (rule.minAge && application.dateOfBirth) {
          const age = this.calculateAge(new Date(application.dateOfBirth));
          if (age < rule.minAge) {
            eligible = false;
            reasons.push(`Applicant age below minimum (${rule.minAge})`);
            matchScore -= 15;
          }
        }

        if (rule.maxAge && application.dateOfBirth) {
          const age = this.calculateAge(new Date(application.dateOfBirth));
          if (age > rule.maxAge) {
            eligible = false;
            reasons.push(`Applicant age above maximum (${rule.maxAge})`);
            matchScore -= 15;
          }
        }
      }

      results.push({
        bankCode: bank.bankCode,
        bankName: bank.bankName,
        eligible,
        reasons: eligible ? ['All eligibility criteria met'] : reasons,
        matchScore: Math.max(0, matchScore),
        estimatedRate: Number(bank.interestRateMin) || undefined,
        processingDays: bank.expectedResponseTime || undefined,
      });
    }

    await db
      .update(dsaLoanApplications)
      .set({
        status: 'eligibility_check',
        updatedAt: new Date(),
        currentStage: 'eligibility',
        eligibleBanks: results.filter(r => r.eligible).map(r => r.bankCode),
      })
      .where(eq(dsaLoanApplications.id, applicationId));

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  async routeToBank(
    applicationId: string,
    bankCodes: string[],
    strategy: RoutingStrategy = 'parallel',
    actorId?: string
  ): Promise<RoutingResult> {
    const application = await this.getApplication(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const banks = await db
      .select()
      .from(bankConnectors)
      .where(
        and(
          inArray(bankConnectors.bankCode, bankCodes),
          eq(bankConnectors.isActive, true)
        )
      );

    if (banks.length === 0) {
      throw new Error('No active banks found for routing');
    }

    const routingHistoryIds: string[] = [];

    for (let i = 0; i < banks.length; i++) {
      const bank = banks[i];
      const [history] = await db
        .insert(loanRoutingHistory)
        .values({
          applicationId,
          bankCode: bank.bankCode,
          routingPriority: i + 1,
          routingStrategy: strategy,
          bankStatus: 'pending',
          submittedAt: new Date(),
        })
        .returning();

      routingHistoryIds.push(history.id);
    }

    await db
      .update(dsaLoanApplications)
      .set({
        status: 'routed',
        routingStrategy: strategy,
        routedBanks: bankCodes,
        routedAt: new Date(),
        updatedAt: new Date(),
        currentStage: 'routing',
      })
      .where(eq(dsaLoanApplications.id, applicationId));

    await this.createAuditLog({
      applicationId,
      action: 'application_routed',
      actionCategory: 'routing',
      actorId,
      newState: { banks: bankCodes, strategy },
    });

    return {
      success: true,
      applicationId,
      routedBanks: bankCodes,
      strategy,
      routingHistoryIds,
    };
  }

  async updateBankResponse(
    routingHistoryId: string,
    response: {
      bankStatus: string;
      bankReference?: string;
      offeredInterestRate?: number;
      approvedAmount?: number;
      approvedTenure?: number;
      processingFee?: number;
      rejectionReason?: string;
    },
    actorId?: string
  ): Promise<void> {
    const [history] = await db
      .select()
      .from(loanRoutingHistory)
      .where(eq(loanRoutingHistory.id, routingHistoryId))
      .limit(1);

    if (!history) {
      throw new Error('Routing history not found');
    }

    await db
      .update(loanRoutingHistory)
      .set({
        ...response,
        responseReceivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loanRoutingHistory.id, routingHistoryId));

    await this.createAuditLog({
      applicationId: history.applicationId,
      action: 'bank_response_received',
      actionCategory: 'routing',
      actorId,
      bankCode: history.bankCode,
      newState: response,
    });

    await this.updateApplicationStatusFromResponses(history.applicationId);
  }

  private async updateApplicationStatusFromResponses(applicationId: string): Promise<void> {
    const histories = await db
      .select()
      .from(loanRoutingHistory)
      .where(eq(loanRoutingHistory.applicationId, applicationId));

    const approved = histories.filter(h => h.bankStatus === 'approved');
    const rejected = histories.filter(h => h.bankStatus === 'rejected');
    const pending = histories.filter(h => h.bankStatus === 'pending' || h.bankStatus === 'in_review');

    let newStatus: DsaLoanStatus = 'pending_with_banks';

    if (approved.length > 0) {
      newStatus = 'approved';
    } else if (rejected.length === histories.length) {
      newStatus = 'rejected';
    } else if (pending.length > 0) {
      newStatus = 'in_review';
    }

    await db
      .update(dsaLoanApplications)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(dsaLoanApplications.id, applicationId));
  }

  async uploadDocument(
    data: Partial<InsertDsaLoanDocument> & { applicationId: string; documentType: string; documentName: string; fileName: string; storageUrl: string }
  ): Promise<{ id: string }> {
    const [doc] = await db
      .insert(dsaLoanDocuments)
      .values(data as any)
      .returning({ id: dsaLoanDocuments.id });

    return doc;
  }

  async getDocuments(applicationId: string): Promise<any[]> {
    return db
      .select()
      .from(dsaLoanDocuments)
      .where(eq(dsaLoanDocuments.applicationId, applicationId))
      .orderBy(desc(dsaLoanDocuments.createdAt));
  }

  async createAuditLog(
    data: Partial<InsertDsaLoanAuditLog> & { action: string; actionCategory: string }
  ): Promise<void> {
    await db.insert(dsaLoanAuditLogs).values(data as any);
  }

  async getAuditLogs(applicationId: string): Promise<any[]> {
    return db
      .select()
      .from(dsaLoanAuditLogs)
      .where(eq(dsaLoanAuditLogs.applicationId, applicationId))
      .orderBy(desc(dsaLoanAuditLogs.createdAt));
  }

  async getActiveBanks(): Promise<BankConnector[]> {
    return db
      .select()
      .from(bankConnectors)
      .where(eq(bankConnectors.isActive, true))
      .orderBy(desc(bankConnectors.priority));
  }

  async createBankConnector(data: InsertBankConnector): Promise<BankConnector> {
    const [connector] = await db
      .insert(bankConnectors)
      .values(data)
      .returning();
    return connector;
  }

  async updateBankConnector(
    bankCode: string,
    data: Partial<InsertBankConnector>
  ): Promise<BankConnector> {
    const [connector] = await db
      .update(bankConnectors)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(bankConnectors.bankCode, bankCode))
      .returning();
    return connector;
  }

  async createEligibilityRule(data: InsertLoanEligibilityRule): Promise<void> {
    await db.insert(loanEligibilityRules).values(data);
  }

  async getRoutingHistory(applicationId: string): Promise<any[]> {
    return db
      .select()
      .from(loanRoutingHistory)
      .where(eq(loanRoutingHistory.applicationId, applicationId))
      .orderBy(loanRoutingHistory.routingPriority);
  }

  async processWebhook(
    bankCode: string,
    eventType: string,
    payload: any,
    signature?: string
  ): Promise<{ processed: boolean; error?: string }> {
    const [event] = await db
      .insert(loanWebhookEvents)
      .values({
        bankCode,
        eventType,
        rawPayload: payload,
        signature,
        isSignatureValid: signature ? true : null,
        processingStatus: 'pending',
      })
      .returning();

    try {
      const applicationId = payload.applicationId || payload.application_id;
      if (applicationId) {
        await db
          .update(loanWebhookEvents)
          .set({
            applicationId,
            processedAt: new Date(),
            processingStatus: 'processed',
          })
          .where(eq(loanWebhookEvents.id, event.id));
      }

      return { processed: true };
    } catch (error: any) {
      await db
        .update(loanWebhookEvents)
        .set({
          processingStatus: 'failed',
          processingError: error.message,
        })
        .where(eq(loanWebhookEvents.id, event.id));

      return { processed: false, error: error.message };
    }
  }

  async getDashboardStats(agentId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byLoanType: Record<string, number>;
    totalDisbursed: number;
    approvalRate: number;
  }> {
    const conditions = agentId ? [eq(dsaLoanApplications.agentId, agentId)] : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const applications = await db
      .select()
      .from(dsaLoanApplications)
      .where(whereClause);

    const byStatus: Record<string, number> = {};
    const byLoanType: Record<string, number> = {};
    let totalDisbursed = 0;
    let approved = 0;
    let completed = 0;

    for (const app of applications) {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;
      byLoanType[app.loanType] = (byLoanType[app.loanType] || 0) + 1;

      if (app.status === 'approved' || app.status === 'disbursed') {
        approved++;
      }

      if (app.status === 'approved' || app.status === 'rejected' || app.status === 'disbursed') {
        completed++;
      }
    }

    return {
      total: applications.length,
      byStatus,
      byLoanType,
      totalDisbursed,
      approvalRate: completed > 0 ? (approved / completed) * 100 : 0,
    };
  }

  async getApplicationsByUser(
    userId?: string,
    userPhone?: string,
    userEmail?: string
  ): Promise<any[]> {
    const conditions = [];

    if (userId) {
      conditions.push(eq(dsaLoanApplications.agentId, userId));
    }
    if (userPhone) {
      conditions.push(eq(dsaLoanApplications.applicantPhone, userPhone));
    }
    if (userEmail) {
      conditions.push(eq(dsaLoanApplications.applicantEmail, userEmail));
    }

    if (conditions.length === 0) {
      return [];
    }

    return db
      .select()
      .from(dsaLoanApplications)
      .where(or(...conditions))
      .orderBy(desc(dsaLoanApplications.createdAt));
  }

  async checkEligibilityByCriteria(criteria: {
    loanType: string;
    monthlyIncome: string;
    creditScore?: number;
  }): Promise<{ eligible: boolean; banks: string[] }> {
    const rules = await db
      .select()
      .from(loanEligibilityRules)
      .where(
        and(
          eq(loanEligibilityRules.isActive, true),
          eq(loanEligibilityRules.loanType, criteria.loanType)
        )
      );

    const income = parseInt(criteria.monthlyIncome) || 0;
    const score = criteria.creditScore || 700;
    const eligibleBanks: string[] = [];

    for (const rule of rules) {
      const minIncome = parseInt(rule.minIncome || "0");
      const minScore = rule.minCreditScore || 600;

      if (income >= minIncome && score >= minScore) {
        const connector = await db
          .select()
          .from(bankConnectors)
          .where(eq(bankConnectors.id, rule.bankConnectorId!))
          .limit(1);

        if (connector[0] && !eligibleBanks.includes(connector[0].bankName)) {
          eligibleBanks.push(connector[0].bankName);
        }
      }
    }

    return {
      eligible: eligibleBanks.length > 0,
      banks: eligibleBanks,
    };
  }

  async generateKFS(offerId: string): Promise<any | null> {
    const routing = await db
      .select()
      .from(loanRoutingHistory)
      .where(eq(loanRoutingHistory.id, offerId))
      .limit(1);

    if (!routing[0]) {
      return null;
    }

    const application = await this.getApplication(routing[0].applicationId!);
    if (!application) {
      return null;
    }

    const connector = await db
      .select()
      .from(bankConnectors)
      .where(eq(bankConnectors.id, routing[0].bankConnectorId!))
      .limit(1);

    const bank = connector[0];
    const amount = parseInt(application.requestedAmount || '0');
    const tenure = application.requestedTenure || 12;
    const baseRate = parseFloat(bank?.config?.minRate as string || '10');
    const processingFee = parseFloat(bank?.config?.processingFee as string || '1');
    
    const monthlyRate = baseRate / 12 / 100;
    const emi = amount * monthlyRate * Math.pow(1 + monthlyRate, tenure) / 
                (Math.pow(1 + monthlyRate, tenure) - 1);
    const totalPayment = emi * tenure;
    const totalInterest = totalPayment - amount;
    const apr = baseRate + (processingFee * 12 / tenure);

    return {
      kfsId: `KFS-${offerId}`,
      generatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      
      lenderDetails: {
        name: bank?.bankName || 'Unknown Lender',
        licenseNumber: bank?.config?.licenseNumber || 'RBI-NBFC-XXXX',
        regulator: 'Reserve Bank of India',
        registeredAddress: bank?.config?.address || 'Mumbai, Maharashtra',
        grievanceOfficer: bank?.config?.grievanceEmail || 'grievance@bank.com',
      },

      loanTerms: {
        principalAmount: amount,
        tenure: tenure,
        tenureUnit: 'months',
        interestRate: baseRate,
        interestType: 'Fixed/Floating (as applicable)',
        apr: parseFloat(apr.toFixed(2)),
        emi: Math.round(emi),
        totalInterest: Math.round(totalInterest),
        totalRepayment: Math.round(totalPayment),
      },

      fees: {
        processingFee: `${processingFee}% of loan amount`,
        processingFeeAmount: Math.round(amount * processingFee / 100),
        stampDuty: 'As per state regulations',
        documentationCharges: bank?.config?.docCharges || '₹500',
        insuranceCharges: 'Optional - ₹0 if declined',
        prepaymentCharges: bank?.config?.prepaymentCharges || 'Nil for floating rate, 2% for fixed rate',
        latePaymentFee: bank?.config?.latePaymentFee || '2% per month on overdue amount',
        bounceCharges: bank?.config?.bounceCharges || '₹500 per instance',
      },

      cooling_off: {
        period: '3 days',
        description: 'Borrower can exit the loan within 3 days of disbursement by repaying principal plus pro-rata interest. No prepayment charges apply during this period.',
      },

      grievanceRedressal: {
        lenderOfficer: {
          name: bank?.config?.grievanceOfficerName || 'Grievance Officer',
          email: bank?.config?.grievanceEmail || 'grievance@bank.com',
          phone: bank?.config?.grievancePhone || '1800-XXX-XXXX',
        },
        escalation: {
          ombudsman: 'RBI Ombudsman',
          website: 'https://cms.rbi.org.in',
          email: 'rbiombudsman@rbi.org.in',
        },
      },

      rbiDisclosure: {
        statement: 'This Key Facts Statement (KFS) is provided as per RBI Digital Lending Directions 2025.',
        annualPercentageRate: `The Annual Percentage Rate (APR) of ${apr.toFixed(2)}% includes all costs - interest rate, processing fee, and other charges.`,
        coolingOff: 'You have a 3-day cooling-off period after disbursement to exit the loan.',
      },
    };
  }

  async triggerBackgroundRouting(
    applicationId: string,
    reason: 'borderline_credit' | 'income_edge' | 'manual_review',
    agentId?: string
  ): Promise<any> {
    const application = await this.getApplication(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    await this.createAuditLog({
      applicationId,
      action: 'background_routing_triggered',
      actionCategory: 'system',
      actorId: agentId,
      newState: { reason, triggeredAt: new Date().toISOString() },
    });

    const eligibilityResults = await this.runEligibilityCheck(applicationId);
    
    const borderlineResults = eligibilityResults.filter(
      r => r.matchScore >= 40 && r.matchScore < 70
    );

    if (borderlineResults.length === 0) {
      return {
        status: 'no_additional_options',
        message: 'No additional banks available for borderline routing',
        existingOffers: eligibilityResults.filter(r => r.eligible).length,
      };
    }

    const routingPromises = borderlineResults.map(async (result) => {
      const connector = await db
        .select()
        .from(bankConnectors)
        .where(eq(bankConnectors.bankCode, result.bankCode))
        .limit(1);

      if (connector[0]) {
        const [routing] = await db
          .insert(loanRoutingHistory)
          .values({
            applicationId,
            bankConnectorId: connector[0].id,
            status: 'pending_review',
            routingStrategy: 'waterfall',
            priority: 99,
            metadata: {
              reason,
              borderlineScore: result.matchScore,
              triggeredAt: new Date().toISOString(),
            },
          } as any)
          .returning();
        return routing;
      }
      return null;
    });

    const routingResults = await Promise.all(routingPromises);
    const successfulRoutings = routingResults.filter(Boolean);

    return {
      status: 'background_routing_initiated',
      reason,
      additionalBanksRouted: successfulRoutings.length,
      bankNames: borderlineResults.map(r => r.bankName),
      message: `${successfulRoutings.length} additional bank(s) added for extended review`,
    };
  }
}

export const dsaLoanService = new DsaLoanService();
