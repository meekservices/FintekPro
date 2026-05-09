import { db } from '../../db';
import { 
  portfolios, 
  portfolioHoldings,
  portfolioSnapshots,
  portfolioReportTemplates,
  portfolioGeneratedReports,
  portfolioReportAuditLogs,
  users,
  type ReportConfig,
  type PortfolioReportTemplate,
  type PortfolioGeneratedReport,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as crypto from 'crypto';

export interface ValidationResult {
  section: string;
  enabled: boolean;
  valid: boolean;
  reason?: string;
  dataAvailable: boolean;
  minimumDataRequired?: string;
  actualDataAvailable?: string;
}

export interface PreFlightValidation {
  success: boolean;
  portfolioValid: boolean;
  portfolioName?: string;
  clientName?: string;
  totalHoldings: number;
  sections: ValidationResult[];
  warnings: string[];
  errors: string[];
}

export interface PortfolioData {
  portfolio: any;
  holdings: any[];
  snapshots: any[];
  client: any;
  historyMonths: number;
}

class ReportOrchestratorService {
  private riskFreeRate = 6.5;

  async getPortfolioData(portfolioId: string): Promise<PortfolioData | null> {
    try {
      const [portfolio] = await db.select()
        .from(portfolios)
        .where(eq(portfolios.id, portfolioId))
        .limit(1);

      if (!portfolio) {
        return null;
      }

      const holdings = await db.select()
        .from(portfolioHoldings)
        .where(eq(portfolioHoldings.portfolioId, portfolioId));

      const snapshots = await db.select()
        .from(portfolioSnapshots)
        .where(eq(portfolioSnapshots.portfolioId, portfolioId))
        .orderBy(desc(portfolioSnapshots.snapshotDate));

      const [client] = await db.select()
        .from(users)
        .where(eq(users.id, portfolio.userId))
        .limit(1);

      const historyMonths = snapshots.length > 0 
        ? this.calculateMonthsBetween(snapshots[snapshots.length - 1].snapshotDate!, new Date())
        : 0;

      return {
        portfolio,
        holdings,
        snapshots,
        client,
        historyMonths,
      };
    } catch (error) {
      console.error('[ReportOrchestrator] Error fetching portfolio data:', error);
      return null;
    }
  }

  private calculateMonthsBetween(startDate: Date | string, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  }

  async runPreFlightValidation(config: ReportConfig): Promise<PreFlightValidation> {
    const result: PreFlightValidation = {
      success: true,
      portfolioValid: false,
      totalHoldings: 0,
      sections: [],
      warnings: [],
      errors: [],
    };

    const portfolioData = await this.getPortfolioData(config.portfolioId);
    
    if (!portfolioData) {
      result.success = false;
      result.errors.push('Portfolio not found');
      return result;
    }

    result.portfolioValid = true;
    result.portfolioName = portfolioData.portfolio.name;
    result.clientName = portfolioData.client?.fullName || portfolioData.client?.email || 'Unknown';
    result.totalHoldings = portfolioData.holdings.length;

    if (portfolioData.holdings.length === 0) {
      result.warnings.push('Portfolio has no holdings. Some sections may be empty.');
    }

    const sections = config.sections;
    const historyMonths = portfolioData.historyMonths;

    if (sections.portfolioXray) {
      result.sections.push({
        section: 'portfolioXray',
        enabled: true,
        valid: portfolioData.holdings.length > 0,
        dataAvailable: portfolioData.holdings.length > 0,
        reason: portfolioData.holdings.length === 0 ? 'No holdings available' : undefined,
      });
    }

    if (sections.portfolioSnapshot) {
      result.sections.push({
        section: 'portfolioSnapshot',
        enabled: true,
        valid: true,
        dataAvailable: true,
      });
    }

    if (sections.riskReward?.enabled) {
      const requiredMonths = sections.riskReward.years * 12;
      const valid = historyMonths >= requiredMonths * 0.5;
      result.sections.push({
        section: 'riskReward',
        enabled: true,
        valid,
        dataAvailable: historyMonths >= 12,
        minimumDataRequired: `${sections.riskReward.years} years`,
        actualDataAvailable: `${Math.floor(historyMonths / 12)} years ${historyMonths % 12} months`,
        reason: !valid ? `Insufficient history for ${sections.riskReward.years}-year analysis` : undefined,
      });
      if (!valid) {
        result.warnings.push(`Risk/Reward section disabled: insufficient history (${Math.floor(historyMonths / 12)} years available, ${sections.riskReward.years} years required)`);
      }
    }

    if (sections.scatterPlot?.enabled) {
      const requiredMonths = sections.scatterPlot.years * 12;
      const valid = historyMonths >= requiredMonths * 0.5;
      result.sections.push({
        section: 'scatterPlot',
        enabled: true,
        valid,
        dataAvailable: historyMonths >= 12,
        minimumDataRequired: `${sections.scatterPlot.years} years`,
        actualDataAvailable: `${Math.floor(historyMonths / 12)} years ${historyMonths % 12} months`,
        reason: !valid ? `Insufficient history for ${sections.scatterPlot.years}-year scatterplot` : undefined,
      });
    }

    if (sections.rollingReturns?.enabled) {
      const valid = historyMonths >= sections.rollingReturns.months;
      result.sections.push({
        section: 'rollingReturns',
        enabled: true,
        valid,
        dataAvailable: historyMonths >= 12,
        minimumDataRequired: `${sections.rollingReturns.months} months`,
        actualDataAvailable: `${historyMonths} months`,
        reason: !valid ? `Insufficient history for ${sections.rollingReturns.months}-month rolling returns` : undefined,
      });
    }

    if (sections.stockIntersection) {
      const equityHoldings = portfolioData.holdings.filter(h => h.assetType === 'equity');
      result.sections.push({
        section: 'stockIntersection',
        enabled: true,
        valid: equityHoldings.length >= 2,
        dataAvailable: equityHoldings.length >= 2,
        reason: equityHoldings.length < 2 ? 'Need at least 2 equity holdings for intersection analysis' : undefined,
      });
    }

    if (sections.correlationMatrix) {
      result.sections.push({
        section: 'correlationMatrix',
        enabled: true,
        valid: portfolioData.holdings.length >= 2 && historyMonths >= 12,
        dataAvailable: historyMonths >= 12,
        reason: portfolioData.holdings.length < 2 ? 'Need at least 2 holdings for correlation' : 
                historyMonths < 12 ? 'Need at least 12 months history' : undefined,
      });
    }

    if (sections.investmentGrowth) {
      result.sections.push({
        section: 'investmentGrowth',
        enabled: true,
        valid: portfolioData.snapshots.length >= 2,
        dataAvailable: portfolioData.snapshots.length >= 2,
        reason: portfolioData.snapshots.length < 2 ? 'Need at least 2 snapshots for growth chart' : undefined,
      });
    }

    if (sections.underlyingHoldings) {
      result.sections.push({
        section: 'underlyingHoldings',
        enabled: true,
        valid: portfolioData.holdings.length > 0,
        dataAvailable: portfolioData.holdings.length > 0,
      });
    }

    if (sections.targetAssetAllocation) {
      const hasModel = config.allocationModel?.enabled;
      result.sections.push({
        section: 'targetAssetAllocation',
        enabled: true,
        valid: !!hasModel,
        dataAvailable: !!hasModel,
        reason: !hasModel ? 'No allocation model selected - section disabled' : undefined,
      });
      if (!hasModel) {
        result.warnings.push('Target Asset Allocation disabled: no allocation model selected');
      }
    }

    if (sections.historicalAssetAllocation) {
      result.sections.push({
        section: 'historicalAssetAllocation',
        enabled: true,
        valid: portfolioData.snapshots.length >= 2,
        dataAvailable: portfolioData.snapshots.length >= 2,
        reason: portfolioData.snapshots.length < 2 ? 'Need historical snapshots' : undefined,
      });
    }

    if (sections.priceDistribution) {
      result.sections.push({
        section: 'priceDistribution',
        enabled: true,
        valid: historyMonths >= 12,
        dataAvailable: historyMonths >= 12,
        reason: historyMonths < 12 ? 'Need at least 12 months history for price distribution' : undefined,
      });
    }

    if (sections.disclosureMaterials) {
      result.sections.push({
        section: 'disclosureMaterials',
        enabled: true,
        valid: true,
        dataAvailable: true,
      });
    }

    const invalidSections = result.sections.filter(s => !s.valid);
    if (invalidSections.length > 0) {
      result.success = result.sections.some(s => s.valid);
    }

    return result;
  }

  async saveTemplate(
    name: string,
    config: ReportConfig,
    userId: string,
    options: { description?: string; isDefault?: boolean; isPublic?: boolean; category?: string } = {}
  ): Promise<PortfolioReportTemplate> {
    const [template] = await db.insert(portfolioReportTemplates).values({
      id: nanoid(),
      name,
      description: options.description,
      createdByUserId: userId,
      configJson: config as any,
      isDefault: options.isDefault || false,
      isPublic: options.isPublic || false,
      category: options.category || 'general',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return template;
  }

  async getTemplates(userId: string): Promise<PortfolioReportTemplate[]> {
    const templates = await db.select()
      .from(portfolioReportTemplates)
      .where(eq(portfolioReportTemplates.createdByUserId, userId))
      .orderBy(desc(portfolioReportTemplates.createdAt));

    return templates;
  }

  async getTemplate(templateId: string): Promise<PortfolioReportTemplate | null> {
    const [template] = await db.select()
      .from(portfolioReportTemplates)
      .where(eq(portfolioReportTemplates.id, templateId))
      .limit(1);

    return template || null;
  }

  async deleteTemplate(templateId: string, userId: string): Promise<boolean> {
    const result = await db.delete(portfolioReportTemplates)
      .where(and(
        eq(portfolioReportTemplates.id, templateId),
        eq(portfolioReportTemplates.createdByUserId, userId)
      ));

    return true;
  }

  async createGeneratedReport(
    config: ReportConfig,
    userId: string,
    clientId: string,
    options: { templateId?: string; reportName?: string } = {}
  ): Promise<PortfolioGeneratedReport> {
    const validation = await this.runPreFlightValidation(config);
    
    const [report] = await db.insert(portfolioGeneratedReports).values({
      id: nanoid(),
      clientId,
      portfolioId: config.portfolioId,
      templateId: options.templateId,
      reportName: options.reportName || `Portfolio Report - ${new Date().toLocaleDateString()}`,
      configSnapshot: config as any,
      validationResults: validation as any,
      status: 'pending',
      generatedByUserId: userId,
      createdAt: new Date(),
    }).returning();

    await this.logAudit(report.id, 'created', userId);

    return report;
  }

  async updateReportStatus(
    reportId: string, 
    status: 'pending' | 'generating' | 'generated' | 'failed',
    options: { fileUrl?: string; fileSize?: number; hashChecksum?: string; errorMessage?: string } = {}
  ): Promise<void> {
    await db.update(portfolioGeneratedReports)
      .set({
        status,
        fileUrl: options.fileUrl,
        fileSize: options.fileSize,
        hashChecksum: options.hashChecksum,
        errorMessage: options.errorMessage,
        completedAt: status === 'generated' || status === 'failed' ? new Date() : undefined,
      })
      .where(eq(portfolioGeneratedReports.id, reportId));
  }

  async getGeneratedReports(userId: string): Promise<PortfolioGeneratedReport[]> {
    const reports = await db.select()
      .from(portfolioGeneratedReports)
      .where(eq(portfolioGeneratedReports.generatedByUserId, userId))
      .orderBy(desc(portfolioGeneratedReports.createdAt));

    return reports;
  }

  async getGeneratedReport(reportId: string): Promise<PortfolioGeneratedReport | null> {
    const [report] = await db.select()
      .from(portfolioGeneratedReports)
      .where(eq(portfolioGeneratedReports.id, reportId))
      .limit(1);

    return report || null;
  }

  async logAudit(
    reportId: string, 
    action: string, 
    userId: string,
    options: { ipAddress?: string; userAgent?: string; metadata?: any } = {}
  ): Promise<void> {
    await db.insert(portfolioReportAuditLogs).values({
      id: nanoid(),
      reportId,
      action,
      userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: options.metadata,
      timestamp: new Date(),
    });
  }

  async getAuditLogs(reportId: string) {
    const logs = await db.select()
      .from(portfolioReportAuditLogs)
      .where(eq(portfolioReportAuditLogs.reportId, reportId))
      .orderBy(desc(portfolioReportAuditLogs.timestamp));

    return logs;
  }

  generateChecksum(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async attachToProposal(reportId: string, proposalId: string, userId: string): Promise<void> {
    await db.update(portfolioGeneratedReports)
      .set({ proposalId })
      .where(eq(portfolioGeneratedReports.id, reportId));

    await this.logAudit(reportId, 'attached', userId, { metadata: { proposalId } });
  }

  getRiskFreeRate(): number {
    return this.riskFreeRate;
  }
}

export const reportOrchestratorService = new ReportOrchestratorService();
export default reportOrchestratorService;
