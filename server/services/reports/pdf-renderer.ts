import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import type { ReportConfig } from '@shared/schema';
import type { PortfolioData } from './report-orchestrator';
import { computePortfolioXray } from './sections/portfolio-xray';
import { computeRiskReward } from './sections/risk-reward';
import { computeRollingReturns } from './sections/rolling-returns';
import { computeCorrelationMatrix } from './sections/correlation-matrix';
import { generateDisclosures, getDisclosureFooter } from './sections/disclosures';
import { callPython } from '../../clients/python-client';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface RenderOptions {
  orientation: 'portrait' | 'landscape';
  fontSize: 'standard' | 'large';
  includeCoverPage: boolean;
  includeDisclosures: boolean;
}

const COLORS = {
  primary: [26, 86, 219] as [number, number, number],
  secondary: [75, 85, 99] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  text: [17, 24, 39] as [number, number, number],
  lightGray: [243, 244, 246] as [number, number, number],
};

export class PortfolioReportPDFRenderer {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin = 20;
  private currentY = 20;
  private fontSize: number;
  private pageNumber = 0;

  constructor(options: RenderOptions) {
    this.pdf = new jsPDF({
      orientation: options.orientation,
      unit: 'mm',
      format: 'a4',
    });
    
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
    this.fontSize = options.fontSize === 'large' ? 12 : 10;
  }

  async generateReport(
    config: ReportConfig,
    portfolioData: PortfolioData
  ): Promise<Buffer> {
    const reportDate = new Date();
    
    if (config.coverPage?.enabled) {
      this.renderCoverPage(config, portfolioData, reportDate);
    }

    if (config.sections.portfolioXray) {
      this.addNewPage();
      const xrayData = computePortfolioXray(portfolioData);
      this.renderPortfolioXray(xrayData);
    }

    if (config.sections.portfolioSnapshot) {
      this.addNewPage();
      this.renderPortfolioSnapshot(portfolioData);
    }

    if (config.sections.riskReward?.enabled) {
      this.addNewPage();
      const riskData = computeRiskReward(portfolioData, { 
        years: config.sections.riskReward.years,
        riskFreeRate: 6.5,
      });
      this.renderRiskReward(riskData);
    }

    if (config.sections.rollingReturns?.enabled) {
      this.addNewPage();
      const rollingData = computeRollingReturns(portfolioData, {
        months: config.sections.rollingReturns.months,
      });
      this.renderRollingReturns(rollingData);
    }

    if (config.sections.correlationMatrix) {
      this.addNewPage();
      const correlationData = computeCorrelationMatrix(portfolioData);
      this.renderCorrelationMatrix(correlationData);
    }

    // Fama-French 4-Factor Risk Attribution (Python sidecar)
    await this.tryRenderFactorAttribution(portfolioData);

    if (config.sections.underlyingHoldings) {
      this.addNewPage();
      this.renderUnderlyingHoldings(portfolioData);
    }

    if (config.sections.disclosureMaterials) {
      this.addNewPage();
      const disclosures = generateDisclosures(reportDate);
      this.renderDisclosures(disclosures);
    }

    const pdfOutput = this.pdf.output('arraybuffer');
    return Buffer.from(pdfOutput);
  }

  private async tryRenderFactorAttribution(portfolioData: PortfolioData): Promise<void> {
    try {
      const mfHoldings = portfolioData.holdings
        .filter(h => h.assetType === 'mutual_fund' && (h.isin || h.symbol))
        .sort((a, b) => Number(b.quantity ?? 0) * Number(b.avgPrice ?? 0) - Number(a.quantity ?? 0) * Number(a.avgPrice ?? 0))
        .slice(0, 5);

      if (mfHoldings.length === 0) return;

      const factorResult = await callPython<any>('/api/factor/batch-fund-factors', 'POST', {
        funds: mfHoldings.map(h => ({ isin: h.isin ?? h.symbol, name: h.symbol })),
        lookback_months: 36,
      });

      if (!factorResult || factorResult.error || !factorResult.results?.length) return;

      this.addNewPage();
      this.renderFactorAttribution(factorResult.results);
    } catch {
      // sidecar unavailable — skip section silently
    }
  }

  private renderFactorAttribution(results: any[]): void {
    this.renderSectionHeader('Risk Factor Attribution (Fama-French 4-Factor)');

    const rows = results.map((r: any) => [
      r.fund?.name ?? r.fund?.isin ?? 'N/A',
      r.alpha != null ? `${Number(r.alpha).toFixed(2)}%` : '-',
      r.beta_market != null ? Number(r.beta_market).toFixed(3) : '-',
      r.beta_smb != null ? Number(r.beta_smb).toFixed(3) : '-',
      r.beta_hml != null ? Number(r.beta_hml).toFixed(3) : '-',
      r.beta_mom != null ? Number(r.beta_mom).toFixed(3) : '-',
    ]);

    this.pdf.autoTable({
      startY: this.currentY,
      head: [['Fund', 'Alpha (%)', 'Market β', 'Size (SMB) β', 'Value (HML) β', 'Momentum β']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary },
      margin: { left: this.margin, right: this.margin },
      styles: { fontSize: 8 },
    });

    this.currentY = (this.pdf as any).lastAutoTable?.finalY + 8 ?? this.currentY + 10;
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(...COLORS.secondary);
    this.pdf.text(
      'Source: Fama-French 4-Factor OLS regression, 36-month lookback. Alpha annualised.',
      this.margin,
      this.currentY
    );
    this.pdf.setTextColor(...COLORS.text);
    this.currentY += 8;
  }

  private addNewPage(): void {
    if (this.pageNumber > 0) {
      this.pdf.addPage();
    }
    this.pageNumber++;
    this.currentY = this.margin;
    this.addFooter();
  }

  private addFooter(): void {
    const footer = getDisclosureFooter();
    this.pdf.setFontSize(7);
    this.pdf.setTextColor(...COLORS.secondary);
    this.pdf.text(footer, this.margin, this.pageHeight - 10, { maxWidth: this.pageWidth - 2 * this.margin });
    this.pdf.text(`Page ${this.pageNumber}`, this.pageWidth - this.margin - 10, this.pageHeight - 10);
  }

  private renderCoverPage(config: ReportConfig, portfolioData: PortfolioData, reportDate: Date): void {
    this.pageNumber++;
    
    this.pdf.setFillColor(...COLORS.primary);
    this.pdf.rect(0, 0, this.pageWidth, 80, 'F');

    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(28);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(config.coverPage?.title || 'Portfolio Report', this.margin, 40);

    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(portfolioData.portfolio.name, this.margin, 55);

    this.currentY = 100;
    this.pdf.setTextColor(...COLORS.text);
    
    const details = [
      ['Client Name:', config.coverPage?.clientName || portfolioData.client?.fullName || 'N/A'],
      ['Prepared By:', config.coverPage?.preparedBy || 'FintekPro Advisor'],
      ['Report Date:', config.coverPage?.date || reportDate.toLocaleDateString('en-IN')],
      ['Portfolio ID:', portfolioData.portfolio.id],
      ['Currency:', portfolioData.portfolio.baseCurrency || 'INR'],
    ];

    this.pdf.setFontSize(this.fontSize);
    details.forEach(([label, value]) => {
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(label, this.margin, this.currentY);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(value, this.margin + 50, this.currentY);
      this.currentY += 10;
    });

    this.addFooter();
  }

  private renderPortfolioXray(data: any): void {
    this.renderSectionHeader('Portfolio X-Ray');

    this.pdf.setFontSize(this.fontSize);
    this.pdf.setTextColor(...COLORS.text);
    this.pdf.text(`Total Portfolio Value: ${this.formatCurrency(data.totalValue)}`, this.margin, this.currentY);
    this.currentY += 8;
    this.pdf.text(`Total Holdings: ${data.totalHoldings}`, this.margin, this.currentY);
    this.currentY += 15;

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Asset Allocation', this.margin, this.currentY);
    this.currentY += 8;

    const allocationRows = data.assetAllocation.map((a: any) => [
      a.assetType.charAt(0).toUpperCase() + a.assetType.slice(1),
      this.formatCurrency(a.value),
      `${a.percentage.toFixed(1)}%`,
      a.holdings.toString(),
    ]);

    this.pdf.autoTable({
      startY: this.currentY,
      head: [['Asset Type', 'Value', 'Weight', 'Holdings']],
      body: allocationRows,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary },
      margin: { left: this.margin, right: this.margin },
    });

    this.currentY = this.pdf.lastAutoTable.finalY + 15;

    if (data.topHoldings.length > 0) {
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text('Top Holdings', this.margin, this.currentY);
      this.currentY += 8;

      const holdingsRows = data.topHoldings.slice(0, 10).map((h: any) => [
        h.symbol,
        h.assetType,
        this.formatCurrency(h.value),
        `${h.percentage.toFixed(1)}%`,
      ]);

      this.pdf.autoTable({
        startY: this.currentY,
        head: [['Symbol', 'Type', 'Value', 'Weight']],
        body: holdingsRows,
        theme: 'striped',
        headStyles: { fillColor: COLORS.primary },
        margin: { left: this.margin, right: this.margin },
      });
    }
  }

  private renderPortfolioSnapshot(portfolioData: PortfolioData): void {
    this.renderSectionHeader('Portfolio Snapshot');

    const snapshot = portfolioData.snapshots[0];
    const portfolio = portfolioData.portfolio;

    const data = [
      ['Total Value', this.formatCurrency(Number(snapshot?.totalValue || portfolio.totalValue || 0))],
      ['Equity Value', this.formatCurrency(Number(snapshot?.totalEquityValue || 0))],
      ['Debt Value', this.formatCurrency(Number(snapshot?.totalDebtValue || 0))],
      ['Mutual Fund Value', this.formatCurrency(Number(snapshot?.totalMutualFundValue || 0))],
      ['Cash & Equivalents', this.formatCurrency(Number(portfolio.cash || 0))],
    ];

    this.pdf.autoTable({
      startY: this.currentY,
      head: [['Category', 'Value']],
      body: data,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary },
      margin: { left: this.margin, right: this.margin },
    });
  }

  private renderRiskReward(data: any): void {
    this.renderSectionHeader(`Risk/Reward Analysis (${data.period.years} Years)`);

    const returnsData = [
      ['Annualized Return', `${data.returns.annualized.toFixed(2)}%`],
      ['Cumulative Return', `${data.returns.cumulative.toFixed(2)}%`],
      ['Best Year', `${data.returns.bestYear.toFixed(2)}%`],
      ['Worst Year', `${data.returns.worstYear.toFixed(2)}%`],
      ['Average Annual', `${data.returns.averageAnnual.toFixed(2)}%`],
    ];

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Returns', this.margin, this.currentY);
    this.currentY += 8;

    this.pdf.autoTable({
      startY: this.currentY,
      head: [['Metric', 'Value']],
      body: returnsData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.success },
      margin: { left: this.margin, right: this.margin },
      tableWidth: 'wrap',
    });

    this.currentY = this.pdf.lastAutoTable.finalY + 15;

    const riskData = [
      ['Standard Deviation', `${data.risk.standardDeviation.toFixed(2)}%`],
      ['Sharpe Ratio', data.risk.sharpeRatio.toFixed(2)],
      ['Max Drawdown', `${data.risk.maxDrawdown.toFixed(2)}%`],
      ['Volatility', `${data.risk.volatility.toFixed(2)}%`],
    ];

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Risk Metrics', this.margin, this.currentY);
    this.currentY += 8;

    this.pdf.autoTable({
      startY: this.currentY,
      head: [['Metric', 'Value']],
      body: riskData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.danger },
      margin: { left: this.margin, right: this.margin },
      tableWidth: 'wrap',
    });
  }

  private renderRollingReturns(data: any): void {
    this.renderSectionHeader(`Rolling Returns (${data.period.months} Months)`);

    const statsData = [
      ['Average Rolling Return', `${data.statistics.averageRolling.toFixed(2)}%`],
      ['Maximum', `${data.statistics.maxRolling.toFixed(2)}%`],
      ['Minimum', `${data.statistics.minRolling.toFixed(2)}%`],
      ['Median', `${data.statistics.medianRolling.toFixed(2)}%`],
      ['Positive Periods', `${data.statistics.positivePercentage.toFixed(1)}%`],
    ];

    this.pdf.autoTable({
      startY: this.currentY,
      head: [['Statistic', 'Value']],
      body: statsData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary },
      margin: { left: this.margin, right: this.margin },
    });
  }

  private renderCorrelationMatrix(data: any): void {
    this.renderSectionHeader('Correlation Matrix');

    if (data.symbols.length < 2) {
      this.pdf.setFontSize(this.fontSize);
      this.pdf.text('Insufficient holdings for correlation analysis (minimum 2 required)', this.margin, this.currentY);
      return;
    }

    const matrixRows = data.symbols.map((symbol: string, i: number) => {
      return [symbol, ...data.matrix[i].map((v: number) => v.toFixed(2))];
    });

    this.pdf.autoTable({
      startY: this.currentY,
      head: [['', ...data.symbols]],
      body: matrixRows,
      theme: 'grid',
      headStyles: { fillColor: COLORS.primary, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: this.margin, right: this.margin },
    });

    this.currentY = this.pdf.lastAutoTable.finalY + 15;

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(`Diversification Score: ${data.insights.diversificationScore}/100`, this.margin, this.currentY);
  }

  private renderUnderlyingHoldings(portfolioData: PortfolioData): void {
    this.renderSectionHeader('Underlying Holdings');

    const holdingsRows = portfolioData.holdings.map(h => [
      h.symbol,
      h.assetType,
      Number(h.quantity).toFixed(2),
      this.formatCurrency(Number(h.avgPrice)),
      this.formatCurrency(Number(h.quantity) * Number(h.avgPrice)),
    ]);

    this.pdf.autoTable({
      startY: this.currentY,
      head: [['Symbol', 'Type', 'Quantity', 'Avg Price', 'Value']],
      body: holdingsRows,
      theme: 'striped',
      headStyles: { fillColor: COLORS.primary },
      margin: { left: this.margin, right: this.margin },
    });
  }

  private renderDisclosures(data: any): void {
    this.renderSectionHeader('Important Disclosures');

    this.pdf.setFontSize(this.fontSize - 1);
    
    data.sections.forEach((section: any) => {
      if (this.currentY > this.pageHeight - 50) {
        this.addNewPage();
      }
      
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(section.title, this.margin, this.currentY);
      this.currentY += 6;
      
      this.pdf.setFont('helvetica', 'normal');
      const lines = this.pdf.splitTextToSize(section.content, this.pageWidth - 2 * this.margin);
      this.pdf.text(lines, this.margin, this.currentY);
      this.currentY += lines.length * 5 + 8;
    });

    this.currentY += 10;
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Risk Warnings', this.margin, this.currentY);
    this.currentY += 6;

    data.riskWarnings.forEach((warning: string) => {
      if (this.currentY > this.pageHeight - 30) {
        this.addNewPage();
      }
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(`• ${warning}`, this.margin, this.currentY);
      this.currentY += 6;
    });
  }

  private renderSectionHeader(title: string): void {
    this.pdf.setFillColor(...COLORS.lightGray);
    this.pdf.rect(0, this.currentY - 5, this.pageWidth, 12, 'F');
    
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(...COLORS.primary);
    this.pdf.text(title, this.margin, this.currentY);
    this.pdf.setTextColor(...COLORS.text);
    this.currentY += 15;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }
}

export async function generatePortfolioReportPDF(
  config: ReportConfig,
  portfolioData: PortfolioData,
  options?: Partial<RenderOptions>
): Promise<Buffer> {
  const renderOptions: RenderOptions = {
    orientation: config.settings?.orientation || 'portrait',
    fontSize: config.settings?.fontSize || 'standard',
    includeCoverPage: config.coverPage?.enabled || false,
    includeDisclosures: config.sections.disclosureMaterials || false,
    ...options,
  };

  const renderer = new PortfolioReportPDFRenderer(renderOptions);
  return renderer.generateReport(config, portfolioData);
}

export default generatePortfolioReportPDF;
