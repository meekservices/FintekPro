/**
 * Regulator-Grade Proposal PDF Renderer
 *
 * SEBI/AMFI/CFP compliant investment proposal PDF generation
 * Features:
 * - 20 sections with conditional rendering
 * - Dynamic Table of Contents with page numbers
 * - PDF metadata and versioning
 * - SHA256 hash for tamper protection
 * - Mandatory compliance disclosures
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createHash } from "crypto";

declare module "jspdf" {
	interface jsPDF {
		autoTable: (options: any) => jsPDF;
		lastAutoTable: { finalY: number };
	}
}

// ==================== Types ====================

export interface ProposalPdfConfig {
	proposalId: string;
	version: string;

	// Client info
	client: {
		name: string;
		pan?: string;
		email?: string;
		phone?: string;
	};

	// Advisor info
	advisor: {
		name: string;
		arnId?: string;
		riaId?: string;
		email?: string;
	};

	// Investment profile
	investmentGoals: {
		primaryGoal: string;
		investmentHorizon: string;
		targetAmount: number;
		monthlyContribution: number;
	};

	riskProfile: {
		score: number;
		category: "conservative" | "moderate" | "aggressive" | "very_aggressive";
		tolerance: string;
		version?: string;
	};

	// Asset allocation (existing and proposed)
	existingAllocation?: {
		equity: number;
		debt: number;
		gold: number;
		realestate: number;
		cash: number;
		totalValue: number;
	};

	proposedAllocation: {
		equity: number;
		debt: number;
		gold: number;
		realestate: number;
		cash: number;
		totalValue: number;
	};

	// Holdings data
	existingHoldings?: Array<{
		instrumentName: string;
		instrumentType: string;
		isin?: string;
		currentValue: number;
		units?: number;
		investedValue?: number;
		gainLoss?: number;
		gainLossPercent?: number;
	}>;

	// Verdicts
	verdicts?: Array<{
		instrumentName: string;
		instrumentType: string;
		isin?: string;
		currentValue: number;
		verdict: "BUY" | "HOLD" | "SELL";
		rationale?: string;
		targetValue?: number;
		changeAmount?: number;
	}>;

	// Capital gains (for SELL verdicts)
	capitalGains?: {
		stcgAmount: number;
		ltcgAmount: number;
		totalGains: number;
		taxSlabAssumption?: string;
	};

	// Exit loads
	exitLoads?: Array<{
		instrumentName: string;
		exitLoadPercent: number;
		exitLoadAmount: number;
	}>;

	// Tax impact
	taxImpact?: {
		totalTax: number;
		totalExitLoad: number;
		taxOffsets: number;
		netRebalancingCost: number;
	};

	// SIP recommendations
	sipRecommendations?: Array<{
		instrumentName: string;
		sipAmount: number;
		frequency: "monthly" | "quarterly";
		source: "rebalancing" | "fresh" | "hybrid";
	}>;

	// Portfolio health
	portfolioHealth?: {
		existing: {
			riskAlignment: number;
			diversification: number;
			costEfficiency: number;
			overallScore: number;
		};
		proposed: {
			riskAlignment: number;
			diversification: number;
			costEfficiency: number;
			overallScore: number;
		};
	};

	// Expense ratios
	expenseAnalysis?: {
		existingWeightedTER: number;
		proposedWeightedTER: number;
		costDragImpact: number;
	};

	// Risk heat map data
	riskHeatMap?: {
		concentrationRisk: Array<{
			sector: string;
			weight: number;
			risk: "low" | "medium" | "high";
		}>;
		volatilityClustering: Array<{ category: string; volatility: number }>;
	};

	// Benchmark comparison
	benchmarkComparison?: {
		benchmarkName: string;
		benchmarkCode: string;
		existingVsBenchmark: number;
		proposedVsBenchmark: number;
		rationale?: string;
	};

	// What-if scenarios
	whatIfScenarios?: Array<{
		scenarioType: "base" | "bull_10" | "bear_10" | "bear_20";
		label: string;
		portfolioValue: number;
		cagr: number;
		gains: number;
	}>;

	// Dividend projection
	dividendProjection?: {
		existingAnnual: number;
		proposedAnnual: number;
		yieldAssumption: number;
	};

	// Priority recommendations
	priorityRecommendations?: Array<{
		rank: number;
		action: string;
		impact: string;
		urgency: "high" | "medium" | "low";
	}>;

	// Growth projection
	growthProjection?: {
		cagr: number;
		goalProbability: number;
		timeToGoal: string;
		projectedValue: number;
	};

	// Section toggles
	sections: {
		coverPage: boolean;
		tableOfContents: boolean;
		executiveSummary: boolean;
		portfolioOverview: boolean;
		productRecommendations: boolean;
		capitalGainsSummary: boolean;
		exitLoadSummary: boolean;
		taxImpactSummary: boolean;
		rebalancingSipRecommendations: boolean;
		portfolioHealthScore: boolean;
		expenseRatioAnalysis: boolean;
		riskHeatMap: boolean;
		benchmarkComparison: boolean;
		whatIfScenarios: boolean;
		dividendProjection: boolean;
		priorityRecommendations: boolean;
		portfolioGrowthProjection: boolean;
		mandatoryDisclaimers: boolean;
		advisorDeclaration: boolean;
	};

	// Section customizations from agent
	sectionCustomizations?: {
		[sectionId: string]: {
			customNotes?: string;
			overrideTitle?: string;
			showInToc?: boolean;
			customData?: Record<string, any>;
		};
	};

	settings: {
		orientation: "portrait" | "landscape";
	};
}

export interface PdfGenerationResult {
	pdfBuffer: Buffer;
	version: string;
	hash: string;
	sectionsIncluded: string[];
	totalPages: number;
	metadata: {
		proposalId: string;
		generatedAt: string;
		engineVersion: string;
		riskProfileVersion?: string;
		benchmarkVersion?: string;
	};
}

const COLORS = {
	primary: [102, 51, 153] as [number, number, number],
	secondary: [75, 85, 99] as [number, number, number],
	success: [16, 185, 129] as [number, number, number],
	warning: [234, 179, 8] as [number, number, number],
	danger: [239, 68, 68] as [number, number, number],
	text: [17, 24, 39] as [number, number, number],
	lightGray: [243, 244, 246] as [number, number, number],
	white: [255, 255, 255] as [number, number, number],
	equity: [59, 130, 246] as [number, number, number],
	debt: [34, 197, 94] as [number, number, number],
	gold: [234, 179, 8] as [number, number, number],
	realestate: [168, 85, 247] as [number, number, number],
	cash: [107, 114, 128] as [number, number, number],
};

const ENGINE_VERSION = "PB_ENGINE_2.5";

// ==================== Renderer Class ====================

export class RegulatorGradePdfRenderer {
	private pdf: jsPDF;
	private pageWidth: number;
	private pageHeight: number;
	private margin = 20;
	private currentY = 20;
	private pageNumber = 0;
	private tocEntries: Array<{ title: string; page: number }> = [];
	private sectionsIncluded: string[] = [];

	constructor(orientation: "portrait" | "landscape" = "portrait") {
		this.pdf = new jsPDF({
			orientation,
			unit: "mm",
			format: "a4",
		});

		autoTable(this.pdf, { body: [] });

		this.pageWidth = this.pdf.internal.pageSize.getWidth();
		this.pageHeight = this.pdf.internal.pageSize.getHeight();
	}

	async generateProposal(
		config: ProposalPdfConfig,
	): Promise<PdfGenerationResult> {
		const generatedAt = new Date().toISOString();

		// Phase 1: Render cover page
		if (config.sections.coverPage) {
			this.renderCoverPage(config);
			this.sectionsIncluded.push("cover_page");
		}

		// Phase 2: Reserve page for TOC (will be filled later)
		let tocPageNumber = 0;
		if (config.sections.tableOfContents) {
			this.addNewPage();
			tocPageNumber = this.pageNumber;
			this.sectionsIncluded.push("table_of_contents");
		}

		// Phase 3: Render all content sections with custom titles
		if (config.sections.executiveSummary) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"executiveSummary",
				"Executive Summary",
				config,
			);
			if (config.sectionCustomizations?.executiveSummary?.showInToc !== false) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderExecutiveSummary(config);
			this.sectionsIncluded.push("executive_summary");
		}

		if (config.sections.portfolioOverview && config.existingHoldings?.length) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"portfolioOverview",
				"Portfolio Overview (Existing)",
				config,
			);
			if (
				config.sectionCustomizations?.portfolioOverview?.showInToc !== false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderPortfolioOverview(config);
			this.sectionsIncluded.push("portfolio_overview");
		}

		if (config.sections.productRecommendations && config.verdicts?.length) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"productRecommendations",
				"Product-Level Recommendations",
				config,
			);
			if (
				config.sectionCustomizations?.productRecommendations?.showInToc !==
				false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderProductRecommendations(config);
			this.sectionsIncluded.push("product_recommendations");
		}

		if (config.sections.capitalGainsSummary && this.hasSellVerdicts(config)) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"capitalGainsSummary",
				"Capital Gains Summary",
				config,
			);
			if (
				config.sectionCustomizations?.capitalGainsSummary?.showInToc !== false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderCapitalGainsSummary(config);
			this.sectionsIncluded.push("capital_gains_summary");
		}

		if (config.sections.exitLoadSummary && config.exitLoads?.length) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"exitLoadSummary",
				"Exit Load Summary",
				config,
			);
			if (config.sectionCustomizations?.exitLoadSummary?.showInToc !== false) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderExitLoadSummary(config);
			this.sectionsIncluded.push("exit_load_summary");
		}

		if (config.sections.taxImpactSummary && config.taxImpact) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"taxImpactSummary",
				"Tax Impact Summary",
				config,
			);
			if (config.sectionCustomizations?.taxImpactSummary?.showInToc !== false) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderTaxImpactSummary(config);
			this.sectionsIncluded.push("tax_impact_summary");
		}

		if (
			config.sections.rebalancingSipRecommendations &&
			config.sipRecommendations?.length
		) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"rebalancingSipRecommendations",
				"Rebalancing & SIP Recommendations",
				config,
			);
			if (
				config.sectionCustomizations?.rebalancingSipRecommendations
					?.showInToc !== false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderRebalancingSipRecommendations(config);
			this.sectionsIncluded.push("rebalancing_sip_recommendations");
		}

		if (config.sections.portfolioHealthScore && config.portfolioHealth) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"portfolioHealthScore",
				"Portfolio Health Score",
				config,
			);
			if (
				config.sectionCustomizations?.portfolioHealthScore?.showInToc !== false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderPortfolioHealthScore(config);
			this.sectionsIncluded.push("portfolio_health_score");
		}

		if (config.sections.expenseRatioAnalysis && config.expenseAnalysis) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"expenseRatioAnalysis",
				"Expense Ratio Analysis",
				config,
			);
			if (
				config.sectionCustomizations?.expenseRatioAnalysis?.showInToc !== false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderExpenseRatioAnalysis(config);
			this.sectionsIncluded.push("expense_ratio_analysis");
		}

		if (config.sections.riskHeatMap && config.riskHeatMap) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"riskHeatMap",
				"Risk Heat Map",
				config,
			);
			if (config.sectionCustomizations?.riskHeatMap?.showInToc !== false) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderRiskHeatMap(config);
			this.sectionsIncluded.push("risk_heat_map");
		}

		if (config.sections.benchmarkComparison && config.benchmarkComparison) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"benchmarkComparison",
				"Benchmark Comparison",
				config,
			);
			if (
				config.sectionCustomizations?.benchmarkComparison?.showInToc !== false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderBenchmarkComparison(config);
			this.sectionsIncluded.push("benchmark_comparison");
		}

		if (config.sections.whatIfScenarios && config.whatIfScenarios?.length) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"whatIfScenarios",
				"What-If Scenario Analysis",
				config,
			);
			if (config.sectionCustomizations?.whatIfScenarios?.showInToc !== false) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderWhatIfScenarios(config);
			this.sectionsIncluded.push("what_if_scenarios");
		}

		if (config.sections.dividendProjection && config.dividendProjection) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"dividendProjection",
				"Dividend Income Projection",
				config,
			);
			if (
				config.sectionCustomizations?.dividendProjection?.showInToc !== false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderDividendProjection(config);
			this.sectionsIncluded.push("dividend_projection");
		}

		if (
			config.sections.priorityRecommendations &&
			config.priorityRecommendations?.length
		) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"priorityRecommendations",
				"Priority Recommendations",
				config,
			);
			if (
				config.sectionCustomizations?.priorityRecommendations?.showInToc !==
				false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderPriorityRecommendations(config);
			this.sectionsIncluded.push("priority_recommendations");
		}

		if (config.sections.portfolioGrowthProjection && config.growthProjection) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"portfolioGrowthProjection",
				"Portfolio Growth Projection",
				config,
			);
			if (
				config.sectionCustomizations?.portfolioGrowthProjection?.showInToc !==
				false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderPortfolioGrowthProjection(config);
			this.sectionsIncluded.push("portfolio_growth_projection");
		}

		if (config.sections.mandatoryDisclaimers) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"mandatoryDisclaimers",
				"Mandatory Disclaimers",
				config,
			);
			if (
				config.sectionCustomizations?.mandatoryDisclaimers?.showInToc !== false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderMandatoryDisclaimers();
			this.sectionsIncluded.push("mandatory_disclaimers");
		}

		if (config.sections.advisorDeclaration) {
			this.addNewPage();
			const title = this.getSectionTitle(
				"advisorDeclaration",
				"Advisor Declaration & Client Acknowledgement",
				config,
			);
			if (
				config.sectionCustomizations?.advisorDeclaration?.showInToc !== false
			) {
				this.tocEntries.push({ title, page: this.pageNumber });
			}
			this.renderAdvisorDeclaration(config);
			this.sectionsIncluded.push("advisor_declaration");
		}

		// Phase 4: Go back and fill TOC if enabled
		if (config.sections.tableOfContents && tocPageNumber > 0) {
			this.pdf.setPage(tocPageNumber);
			this.currentY = this.margin;
			this.renderTableOfContents();
		}

		// Generate PDF buffer
		const pdfOutput = this.pdf.output("arraybuffer");
		const pdfBuffer = Buffer.from(pdfOutput);

		// Compute SHA256 hash
		const hash = createHash("sha256").update(pdfBuffer).digest("hex");

		return {
			pdfBuffer,
			version: config.version,
			hash,
			sectionsIncluded: this.sectionsIncluded,
			totalPages: this.pageNumber,
			metadata: {
				proposalId: config.proposalId,
				generatedAt,
				engineVersion: ENGINE_VERSION,
				riskProfileVersion: config.riskProfile.version,
				benchmarkVersion: config.benchmarkComparison?.benchmarkCode,
			},
		};
	}

	// ==================== Helper Methods ====================

	private addNewPage(): void {
		if (this.pageNumber > 0) {
			this.pdf.addPage();
		}
		this.pageNumber++;
		this.currentY = this.margin;
		this.addFooter();
	}

	private addFooter(): void {
		this.pdf.setFontSize(7);
		this.pdf.setTextColor(...COLORS.secondary);
		this.pdf.text(
			"This proposal is generated based on information provided by the client and is not a guarantee of returns.",
			this.margin,
			this.pageHeight - 12,
			{ maxWidth: this.pageWidth - 2 * this.margin },
		);
		this.pdf.text(
			`Page ${this.pageNumber}`,
			this.pageWidth - this.margin - 15,
			this.pageHeight - 8,
		);
		this.pdf.text(
			"FintekPro Financial Services",
			this.margin,
			this.pageHeight - 8,
		);
	}

	private renderSectionHeader(title: string): void {
		this.pdf.setFillColor(...COLORS.lightGray);
		this.pdf.rect(0, this.currentY - 5, this.pageWidth, 12, "F");

		this.pdf.setFontSize(14);
		this.pdf.setFont("helvetica", "bold");
		this.pdf.setTextColor(...COLORS.primary);
		this.pdf.text(title, this.margin, this.currentY);
		this.pdf.setTextColor(...COLORS.text);
		this.currentY += 15;
	}

	private getSectionTitle(
		sectionId: string,
		defaultTitle: string,
		config: ProposalPdfConfig,
	): string {
		return (
			config.sectionCustomizations?.[sectionId]?.overrideTitle || defaultTitle
		);
	}

	private renderAdvisorNotes(
		sectionId: string,
		config: ProposalPdfConfig,
	): void {
		const notes = config.sectionCustomizations?.[sectionId]?.customNotes;
		if (!notes) return;

		if (this.currentY > this.pageHeight - 60) {
			this.addNewPage();
		}

		this.pdf.setFillColor(255, 251, 235);
		this.pdf.setDrawColor(217, 119, 6);
		const notesHeight = Math.min(60, 20 + notes.length / 3);
		this.pdf.roundedRect(
			this.margin,
			this.currentY - 3,
			this.pageWidth - 2 * this.margin,
			notesHeight,
			3,
			3,
			"FD",
		);

		this.pdf.setFontSize(9);
		this.pdf.setFont("helvetica", "bold");
		this.pdf.setTextColor(217, 119, 6);
		this.pdf.text("Advisor Notes:", this.margin + 5, this.currentY + 5);

		this.pdf.setFont("helvetica", "italic");
		this.pdf.setTextColor(...COLORS.text);
		const splitNotes = this.pdf.splitTextToSize(
			notes,
			this.pageWidth - 2 * this.margin - 10,
		);
		this.pdf.text(splitNotes.slice(0, 3), this.margin + 5, this.currentY + 15);

		this.currentY += notesHeight + 10;
	}

	private formatCurrency(value: number): string {
		if (Math.abs(value) >= 10000000) {
			return `₹${(value / 10000000).toFixed(2)} Cr`;
		}
		if (Math.abs(value) >= 100000) {
			return `₹${(value / 100000).toFixed(2)} L`;
		}
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(value);
	}

	private maskPan(pan?: string): string {
		if (!pan) return "N/A";
		if (pan.length !== 10) return "XXXXX****X";
		return pan.substring(0, 5) + "****" + pan.substring(9);
	}

	private hasSellVerdicts(config: ProposalPdfConfig): boolean {
		return config.verdicts?.some((v) => v.verdict === "SELL") || false;
	}

	private formatGoalName(goal: string): string {
		const names: Record<string, string> = {
			wealth_creation: "Wealth Creation",
			retirement: "Retirement Planning",
			child_education: "Child Education",
			home_purchase: "Home Purchase",
			tax_saving: "Tax Saving",
			regular_income: "Regular Income",
			income_generation: "Income Generation",
		};
		return (
			names[goal] ||
			goal.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
		);
	}

	private formatRiskCategory(category: string): string {
		return category.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
	}

	// ==================== Section Renderers ====================

	private renderCoverPage(config: ProposalPdfConfig): void {
		this.pageNumber++;

		// Header band
		this.pdf.setFillColor(...COLORS.primary);
		this.pdf.rect(0, 0, this.pageWidth, 100, "F");

		this.pdf.setTextColor(...COLORS.white);
		this.pdf.setFontSize(28);
		this.pdf.setFont("helvetica", "bold");
		this.pdf.text("Investment Proposal", this.margin, 45);

		this.pdf.setFontSize(14);
		this.pdf.setFont("helvetica", "normal");
		this.pdf.text(`Prepared for: ${config.client.name}`, this.margin, 65);
		this.pdf.text(`Version: ${config.version}`, this.margin, 80);

		// Client details
		this.currentY = 120;
		this.pdf.setTextColor(...COLORS.text);

		const details = [
			["Client Name:", config.client.name],
			["PAN:", this.maskPan(config.client.pan)],
			["Proposal Date:", new Date().toLocaleDateString("en-IN")],
			[
				"Investment Goal:",
				this.formatGoalName(config.investmentGoals.primaryGoal),
			],
			["Risk Profile:", this.formatRiskCategory(config.riskProfile.category)],
			["Investment Horizon:", config.investmentGoals.investmentHorizon],
			["Advisor:", config.advisor.name],
			["ARN/RIA ID:", config.advisor.arnId || config.advisor.riaId || "N/A"],
		];

		this.pdf.setFontSize(11);
		details.forEach(([label, value]) => {
			this.pdf.setFont("helvetica", "bold");
			this.pdf.text(label, this.margin, this.currentY);
			this.pdf.setFont("helvetica", "normal");
			this.pdf.text(value, this.margin + 55, this.currentY);
			this.currentY += 10;
		});

		this.addFooter();
	}

	private renderTableOfContents(): void {
		this.renderSectionHeader("Table of Contents");

		this.pdf.setFontSize(11);
		this.tocEntries.forEach((entry, index) => {
			this.pdf.setFont("helvetica", "normal");
			this.pdf.setTextColor(...COLORS.text);
			this.pdf.text(`${index + 1}. ${entry.title}`, this.margin, this.currentY);
			this.pdf.text(
				`${entry.page}`,
				this.pageWidth - this.margin - 10,
				this.currentY,
			);
			this.currentY += 8;
		});
	}

	private renderExecutiveSummary(config: ProposalPdfConfig): void {
		const title = this.getSectionTitle(
			"executiveSummary",
			"Executive Summary",
			config,
		);
		this.renderSectionHeader(title);

		this.renderAdvisorNotes("executiveSummary", config);

		this.pdf.setFontSize(10);
		this.pdf.setTextColor(...COLORS.text);

		// Existing vs Proposed snapshot table
		const snapshotData = [
			["Metric", "Existing Portfolio", "Proposed Portfolio"],
			[
				"Equity Allocation",
				`${config.existingAllocation?.equity || 0}%`,
				`${config.proposedAllocation.equity}%`,
			],
			[
				"Debt Allocation",
				`${config.existingAllocation?.debt || 0}%`,
				`${config.proposedAllocation.debt}%`,
			],
			[
				"Gold Allocation",
				`${config.existingAllocation?.gold || 0}%`,
				`${config.proposedAllocation.gold}%`,
			],
			[
				"Total Value",
				this.formatCurrency(config.existingAllocation?.totalValue || 0),
				this.formatCurrency(config.proposedAllocation.totalValue),
			],
			[
				"Risk Profile",
				this.formatRiskCategory(config.riskProfile.category),
				this.formatRiskCategory(config.riskProfile.category),
			],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [snapshotData[0]],
			body: snapshotData.slice(1),
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 15;

		// Net impact summary
		this.pdf.setFont("helvetica", "bold");
		this.pdf.text("Net Impact:", this.margin, this.currentY);
		this.currentY += 8;

		const impacts = [
			`Target Corpus: ${this.formatCurrency(config.investmentGoals.targetAmount)}`,
			`Investment Horizon: ${config.investmentGoals.investmentHorizon}`,
			`Monthly Contribution: ${this.formatCurrency(config.investmentGoals.monthlyContribution)}`,
		];

		impacts.forEach((impact) => {
			this.pdf.setFont("helvetica", "normal");
			this.pdf.text(`• ${impact}`, this.margin + 5, this.currentY);
			this.currentY += 7;
		});
	}

	private renderPortfolioOverview(config: ProposalPdfConfig): void {
		const title = this.getSectionTitle(
			"portfolioOverview",
			"Portfolio Overview (Existing)",
			config,
		);
		this.renderSectionHeader(title);

		this.renderAdvisorNotes("portfolioOverview", config);

		if (!config.existingHoldings?.length) {
			this.pdf.text(
				"No existing holdings data available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const holdingsRows = config.existingHoldings.map((h) => [
			h.instrumentName.substring(0, 35),
			h.instrumentType,
			this.formatCurrency(h.currentValue),
			h.gainLossPercent ? `${h.gainLossPercent.toFixed(1)}%` : "N/A",
		]);

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [["Instrument", "Type", "Current Value", "Gain/Loss %"]],
			body: holdingsRows,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
			columnStyles: {
				0: { cellWidth: 70 },
				1: { cellWidth: 30 },
				2: { cellWidth: 35 },
				3: { cellWidth: 25 },
			},
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 10;

		// Disclosure
		this.pdf.setFont("helvetica", "italic");
		this.pdf.setFontSize(8);
		this.pdf.text(
			`Data Source: CAS Statement / Manual Entry | Last NAV Date: ${new Date().toLocaleDateString("en-IN")}`,
			this.margin,
			this.currentY,
		);
	}

	private renderProductRecommendations(config: ProposalPdfConfig): void {
		const title = this.getSectionTitle(
			"productRecommendations",
			"Product-Level Recommendation Summary",
			config,
		);
		this.renderSectionHeader(title);

		this.renderAdvisorNotes("productRecommendations", config);

		if (!config.verdicts?.length) {
			this.pdf.text("No verdicts available.", this.margin, this.currentY);
			return;
		}

		const verdictRows = config.verdicts.map((v) => {
			const rationale = (v.rationale || "").substring(0, 50);
			return [
				v.instrumentName.substring(0, 30),
				v.instrumentType,
				this.formatCurrency(v.currentValue),
				v.verdict,
				rationale + (rationale.length >= 50 ? "..." : ""),
			];
		});

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [
				["Instrument", "Category", "Current Value", "Verdict", "Rationale"],
			],
			body: verdictRows,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
			columnStyles: {
				0: { cellWidth: 40 },
				1: { cellWidth: 25 },
				2: { cellWidth: 25 },
				3: { cellWidth: 18 },
				4: { cellWidth: 55 },
			},
			didParseCell: (data: any) => {
				if (data.column.index === 3 && data.section === "body") {
					const verdict = data.cell.raw;
					if (verdict === "BUY") data.cell.styles.textColor = COLORS.success;
					else if (verdict === "SELL")
						data.cell.styles.textColor = COLORS.danger;
					else if (verdict === "HOLD")
						data.cell.styles.textColor = COLORS.warning;
				}
			},
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 10;

		// Audit dependency note
		this.pdf.setFont("helvetica", "italic");
		this.pdf.setFontSize(8);
		this.pdf.text(
			"Note: All instruments must have BUY/HOLD/SELL verdict assigned. No blanks allowed.",
			this.margin,
			this.currentY,
		);
	}

	private renderCapitalGainsSummary(config: ProposalPdfConfig): void {
		const title = this.getSectionTitle(
			"capitalGainsSummary",
			"Capital Gains Summary",
			config,
		);
		this.renderSectionHeader(title);

		this.renderAdvisorNotes("capitalGainsSummary", config);

		if (!config.capitalGains) {
			this.pdf.text(
				"No capital gains data available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const gainsData = [
			[
				"Short-Term Capital Gains (STCG)",
				this.formatCurrency(config.capitalGains.stcgAmount),
			],
			[
				"Long-Term Capital Gains (LTCG)",
				this.formatCurrency(config.capitalGains.ltcgAmount),
			],
			[
				"Total Capital Gains",
				this.formatCurrency(config.capitalGains.totalGains),
			],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			body: gainsData,
			theme: "plain",
			margin: { left: this.margin, right: this.margin },
			columnStyles: {
				0: { fontStyle: "bold", cellWidth: 80 },
				1: { cellWidth: 50, halign: "right" },
			},
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 10;

		// Tax disclosure
		this.pdf.setFillColor(...COLORS.lightGray);
		this.pdf.rect(
			this.margin,
			this.currentY - 3,
			this.pageWidth - 2 * this.margin,
			15,
			"F",
		);
		this.pdf.setFont("helvetica", "italic");
		this.pdf.setFontSize(9);
		this.pdf.text(
			"Tax treatment is indicative and subject to prevailing laws. Consult a tax advisor for accurate calculations.",
			this.margin + 5,
			this.currentY + 5,
		);
	}

	private renderExitLoadSummary(config: ProposalPdfConfig): void {
		this.renderSectionHeader("Exit Load Summary");

		if (!config.exitLoads?.length) {
			this.pdf.text("No exit loads applicable.", this.margin, this.currentY);
			return;
		}

		const exitLoadRows = config.exitLoads.map((e) => [
			e.instrumentName.substring(0, 50),
			`${e.exitLoadPercent.toFixed(2)}%`,
			this.formatCurrency(e.exitLoadAmount),
		]);

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [["Instrument", "Exit Load %", "Exit Load Amount"]],
			body: exitLoadRows,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
		});
	}

	private renderTaxImpactSummary(config: ProposalPdfConfig): void {
		const title = this.getSectionTitle(
			"taxImpactSummary",
			"Tax Impact Summary (Net Rebalancing Cost)",
			config,
		);
		this.renderSectionHeader(title);

		this.renderAdvisorNotes("taxImpactSummary", config);

		if (!config.taxImpact) {
			this.pdf.text(
				"No tax impact data available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const taxData = [
			[
				"Total Tax on Capital Gains",
				this.formatCurrency(config.taxImpact.totalTax),
			],
			["Total Exit Load", this.formatCurrency(config.taxImpact.totalExitLoad)],
			[
				"Tax Offsets (Losses)",
				`- ${this.formatCurrency(config.taxImpact.taxOffsets)}`,
			],
			[
				"Net Rebalancing Cost",
				this.formatCurrency(config.taxImpact.netRebalancingCost),
			],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			body: taxData,
			theme: "plain",
			margin: { left: this.margin, right: this.margin },
			columnStyles: {
				0: { fontStyle: "bold", cellWidth: 80 },
				1: { cellWidth: 50, halign: "right" },
			},
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 10;

		this.pdf.setFont("helvetica", "italic");
		this.pdf.setFontSize(8);
		this.pdf.text(
			"Actual tax liability may vary based on individual circumstances.",
			this.margin,
			this.currentY,
		);
	}

	private renderRebalancingSipRecommendations(config: ProposalPdfConfig): void {
		const title = this.getSectionTitle(
			"rebalancingSipRecommendations",
			"Rebalancing & SIP Recommendations",
			config,
		);
		this.renderSectionHeader(title);

		this.renderAdvisorNotes("rebalancingSipRecommendations", config);

		if (!config.sipRecommendations?.length) {
			this.pdf.text(
				"No SIP recommendations available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const sipRows = config.sipRecommendations.map((s) => [
			s.instrumentName.substring(0, 45),
			this.formatCurrency(s.sipAmount),
			s.frequency.charAt(0).toUpperCase() + s.frequency.slice(1),
			s.source.charAt(0).toUpperCase() + s.source.slice(1),
		]);

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [["Instrument", "SIP Amount", "Frequency", "Source"]],
			body: sipRows,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
			columnStyles: {
				0: { cellWidth: 70 },
				1: { cellWidth: 30 },
				2: { cellWidth: 25 },
				3: { cellWidth: 30 },
			},
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 10;

		// Source legend
		this.pdf.setFont("helvetica", "italic");
		this.pdf.setFontSize(8);
		this.pdf.text(
			"Source: Rebalancing = from existing holdings | Fresh = new investment | Hybrid = combination",
			this.margin,
			this.currentY,
		);
	}

	private renderPortfolioHealthScore(config: ProposalPdfConfig): void {
		this.renderSectionHeader("Portfolio Health Score");

		if (!config.portfolioHealth) {
			this.pdf.text(
				"No portfolio health data available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const healthData = [
			["Dimension", "Existing", "Proposed"],
			[
				"Risk Alignment",
				`${config.portfolioHealth.existing.riskAlignment}/100`,
				`${config.portfolioHealth.proposed.riskAlignment}/100`,
			],
			[
				"Diversification",
				`${config.portfolioHealth.existing.diversification}/100`,
				`${config.portfolioHealth.proposed.diversification}/100`,
			],
			[
				"Cost Efficiency",
				`${config.portfolioHealth.existing.costEfficiency}/100`,
				`${config.portfolioHealth.proposed.costEfficiency}/100`,
			],
			[
				"Overall Score",
				`${config.portfolioHealth.existing.overallScore}/100`,
				`${config.portfolioHealth.proposed.overallScore}/100`,
			],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [healthData[0]],
			body: healthData.slice(1),
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
		});
	}

	private renderExpenseRatioAnalysis(config: ProposalPdfConfig): void {
		this.renderSectionHeader("Expense Ratio Analysis");

		if (!config.expenseAnalysis) {
			this.pdf.text(
				"No expense analysis data available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const expenseData = [
			[
				"Weighted TER (Existing)",
				`${config.expenseAnalysis.existingWeightedTER.toFixed(2)}%`,
			],
			[
				"Weighted TER (Proposed)",
				`${config.expenseAnalysis.proposedWeightedTER.toFixed(2)}%`,
			],
			[
				"Cost Drag Impact over Horizon",
				this.formatCurrency(config.expenseAnalysis.costDragImpact),
			],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			body: expenseData,
			theme: "plain",
			margin: { left: this.margin, right: this.margin },
			columnStyles: {
				0: { fontStyle: "bold", cellWidth: 80 },
				1: { cellWidth: 50, halign: "right" },
			},
		});
	}

	private renderRiskHeatMap(config: ProposalPdfConfig): void {
		this.renderSectionHeader("Risk Heat Map");

		if (!config.riskHeatMap) {
			this.pdf.text(
				"No risk heat map data available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		// Concentration risk table
		this.pdf.setFont("helvetica", "bold");
		this.pdf.setFontSize(11);
		this.pdf.text("Concentration Risk by Sector:", this.margin, this.currentY);
		this.currentY += 8;

		const concentrationRows = config.riskHeatMap.concentrationRisk.map((c) => [
			c.sector,
			`${c.weight.toFixed(1)}%`,
			c.risk.toUpperCase(),
		]);

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [["Sector", "Weight", "Risk Level"]],
			body: concentrationRows,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
			didParseCell: (data: any) => {
				if (data.column.index === 2 && data.section === "body") {
					const risk = data.cell.raw;
					if (risk === "HIGH") data.cell.styles.textColor = COLORS.danger;
					else if (risk === "MEDIUM")
						data.cell.styles.textColor = COLORS.warning;
					else data.cell.styles.textColor = COLORS.success;
				}
			},
		});
	}

	private renderBenchmarkComparison(config: ProposalPdfConfig): void {
		this.renderSectionHeader("Benchmark Comparison");

		if (!config.benchmarkComparison) {
			this.pdf.text(
				"No benchmark comparison data available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		this.pdf.setFont("helvetica", "normal");
		this.pdf.setFontSize(10);
		this.pdf.text(
			`Benchmark: ${config.benchmarkComparison.benchmarkName} (${config.benchmarkComparison.benchmarkCode})`,
			this.margin,
			this.currentY,
		);
		this.currentY += 10;

		const comparisonData = [
			["Portfolio", "vs Benchmark"],
			[
				"Existing Portfolio",
				`${config.benchmarkComparison.existingVsBenchmark >= 0 ? "+" : ""}${config.benchmarkComparison.existingVsBenchmark.toFixed(2)}%`,
			],
			[
				"Proposed Portfolio",
				`${config.benchmarkComparison.proposedVsBenchmark >= 0 ? "+" : ""}${config.benchmarkComparison.proposedVsBenchmark.toFixed(2)}%`,
			],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [comparisonData[0]],
			body: comparisonData.slice(1),
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 10;

		if (config.benchmarkComparison.rationale) {
			this.pdf.setFont("helvetica", "italic");
			this.pdf.setFontSize(9);
			const lines = this.pdf.splitTextToSize(
				`Selection Rationale: ${config.benchmarkComparison.rationale}`,
				this.pageWidth - 2 * this.margin,
			);
			this.pdf.text(lines, this.margin, this.currentY);
		}
	}

	private renderWhatIfScenarios(config: ProposalPdfConfig): void {
		this.renderSectionHeader("What-If Scenario Analysis");

		if (!config.whatIfScenarios?.length) {
			this.pdf.text(
				"No what-if scenarios available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const scenarioRows = config.whatIfScenarios.map((s) => [
			s.label,
			this.formatCurrency(s.portfolioValue),
			`${s.cagr.toFixed(1)}%`,
			this.formatCurrency(s.gains),
		]);

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [["Scenario", "Portfolio Value", "CAGR", "Total Gains"]],
			body: scenarioRows,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 10;

		// Disclosure
		this.pdf.setFillColor(...COLORS.lightGray);
		this.pdf.rect(
			this.margin,
			this.currentY - 3,
			this.pageWidth - 2 * this.margin,
			12,
			"F",
		);
		this.pdf.setFont("helvetica", "italic");
		this.pdf.setFontSize(8);
		this.pdf.text(
			"Scenario analysis is hypothetical and for illustration only. Actual results may vary.",
			this.margin + 5,
			this.currentY + 3,
		);
	}

	private renderDividendProjection(config: ProposalPdfConfig): void {
		this.renderSectionHeader("Dividend Income Projection");

		if (!config.dividendProjection) {
			this.pdf.text(
				"No dividend projection data available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const dividendData = [
			["Metric", "Existing", "Proposed"],
			[
				"Annual Dividend Income",
				this.formatCurrency(config.dividendProjection.existingAnnual),
				this.formatCurrency(config.dividendProjection.proposedAnnual),
			],
			[
				"Yield Assumption",
				`${config.dividendProjection.yieldAssumption}%`,
				`${config.dividendProjection.yieldAssumption}%`,
			],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [dividendData[0]],
			body: dividendData.slice(1),
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
		});
	}

	private renderPriorityRecommendations(config: ProposalPdfConfig): void {
		const title = this.getSectionTitle(
			"priorityRecommendations",
			"Priority Recommendations",
			config,
		);
		this.renderSectionHeader(title);

		this.renderAdvisorNotes("priorityRecommendations", config);

		if (!config.priorityRecommendations?.length) {
			this.pdf.text(
				"No priority recommendations available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const priorityRows = config.priorityRecommendations.map((p) => [
			`#${p.rank}`,
			p.action,
			p.impact,
			p.urgency.toUpperCase(),
		]);

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [["Priority", "Action", "Impact", "Urgency"]],
			body: priorityRows,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
			didParseCell: (data: any) => {
				if (data.column.index === 3 && data.section === "body") {
					const urgency = data.cell.raw;
					if (urgency === "HIGH") data.cell.styles.textColor = COLORS.danger;
					else if (urgency === "MEDIUM")
						data.cell.styles.textColor = COLORS.warning;
					else data.cell.styles.textColor = COLORS.success;
				}
			},
		});
	}

	private renderPortfolioGrowthProjection(config: ProposalPdfConfig): void {
		this.renderSectionHeader("Portfolio Growth Projection");

		if (!config.growthProjection) {
			this.pdf.text(
				"No growth projection data available.",
				this.margin,
				this.currentY,
			);
			return;
		}

		const projectionData = [
			["Expected CAGR", `${config.growthProjection.cagr.toFixed(1)}%`],
			[
				"Goal Probability",
				`${config.growthProjection.goalProbability.toFixed(0)}%`,
			],
			["Time to Goal", config.growthProjection.timeToGoal],
			[
				"Projected Value at Goal",
				this.formatCurrency(config.growthProjection.projectedValue),
			],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			body: projectionData,
			theme: "plain",
			margin: { left: this.margin, right: this.margin },
			columnStyles: {
				0: { fontStyle: "bold", cellWidth: 80 },
				1: { cellWidth: 50, halign: "right" },
			},
		});
	}

	private renderMandatoryDisclaimers(): void {
		this.renderSectionHeader("Mandatory Disclaimers");

		const disclaimers = [
			{
				title: "Market Risk Disclaimer",
				content:
					"Investments in securities market are subject to market risks. Read all the related documents carefully before investing. The NAV of mutual fund schemes may go up or down depending upon the factors and forces affecting the securities market.",
			},
			{
				title: "No Assurance of Returns",
				content:
					"Past performance is not indicative of future results. There is no assurance or guarantee that the objectives of the scheme will be achieved. The value of investments may fluctuate based on market conditions.",
			},
			{
				title: "Advisory Responsibility",
				content:
					"This proposal is for informational purposes only and does not constitute investment advice. Investment decisions should be made based on individual circumstances, risk tolerance, and financial goals after consulting with a qualified financial advisor.",
			},
			{
				title: "SEBI/AMFI Compliance",
				content:
					"FintekPro is a SEBI registered investment advisor. All recommendations are made in compliance with SEBI (Investment Advisers) Regulations, 2013 and AMFI guidelines. Mutual fund investments are subject to market risks.",
			},
		];

		disclaimers.forEach((d) => {
			if (this.currentY > this.pageHeight - 50) {
				this.addNewPage();
			}

			this.pdf.setFont("helvetica", "bold");
			this.pdf.setFontSize(10);
			this.pdf.text(d.title, this.margin, this.currentY);
			this.currentY += 5;

			this.pdf.setFont("helvetica", "normal");
			this.pdf.setFontSize(9);
			const lines = this.pdf.splitTextToSize(
				d.content,
				this.pageWidth - 2 * this.margin,
			);
			this.pdf.text(lines, this.margin, this.currentY);
			this.currentY += lines.length * 4 + 8;
		});
	}

	private renderAdvisorDeclaration(config: ProposalPdfConfig): void {
		this.renderSectionHeader("Advisor Declaration & Client Acknowledgement");

		// Advisor declaration
		this.pdf.setFont("helvetica", "bold");
		this.pdf.setFontSize(10);
		this.pdf.text("Advisor Declaration:", this.margin, this.currentY);
		this.currentY += 7;

		this.pdf.setFont("helvetica", "normal");
		this.pdf.setFontSize(9);
		const advisorText =
			"The recommendations contained in this proposal are suitable based on the information provided by the client. I have conducted proper due diligence and this advice is in the best interest of the client.";
		const advisorLines = this.pdf.splitTextToSize(
			advisorText,
			this.pageWidth - 2 * this.margin,
		);
		this.pdf.text(advisorLines, this.margin, this.currentY);
		this.currentY += advisorLines.length * 4 + 15;

		// Signature placeholders
		this.pdf.setDrawColor(...COLORS.secondary);

		// Advisor signature
		this.pdf.text("Advisor Signature:", this.margin, this.currentY);
		this.currentY += 5;
		this.pdf.line(
			this.margin,
			this.currentY + 15,
			this.margin + 60,
			this.currentY + 15,
		);
		this.pdf.text(
			`Name: ${config.advisor.name}`,
			this.margin,
			this.currentY + 22,
		);
		this.pdf.text(
			`ARN/RIA: ${config.advisor.arnId || config.advisor.riaId || "N/A"}`,
			this.margin,
			this.currentY + 28,
		);
		this.pdf.text(`Date: _______________`, this.margin, this.currentY + 34);

		// Client signature
		const clientX = this.pageWidth / 2 + 10;
		this.pdf.text("Client Signature:", clientX, this.currentY - 5);
		this.pdf.line(
			clientX,
			this.currentY + 15,
			clientX + 60,
			this.currentY + 15,
		);
		this.pdf.text(`Name: ${config.client.name}`, clientX, this.currentY + 22);
		this.pdf.text(
			`PAN: ${this.maskPan(config.client.pan)}`,
			clientX,
			this.currentY + 28,
		);
		this.pdf.text(`Date: _______________`, clientX, this.currentY + 34);
	}
}

// ==================== Export Function ====================

export async function generateRegulatorGradePdf(
	config: ProposalPdfConfig,
): Promise<PdfGenerationResult> {
	const renderer = new RegulatorGradePdfRenderer(
		config.settings?.orientation || "portrait",
	);
	return renderer.generateProposal(config);
}

export default generateRegulatorGradePdf;
