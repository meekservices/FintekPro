import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

declare module "jspdf" {
	interface jsPDF {
		autoTable: (options: any) => jsPDF;
		lastAutoTable: { finalY: number };
	}
}

// Apply autoTable plugin to jsPDF
const applyAutoTable = (doc: jsPDF) => {
	if (typeof (doc as any).autoTable !== "function") {
		autoTable(doc, { body: [] }); // Initialize plugin
	}
};

interface ProposalConfig {
	clientId: string;
	investmentGoals: {
		primaryGoal: string;
		investmentHorizon: string;
		targetAmount: number;
		monthlyContribution: number;
	};
	assetAllocation: {
		equity: number;
		debt: number;
		gold: number;
		realestate: number;
		cash: number;
	};
	riskProfile: {
		score: number;
		category: "conservative" | "moderate" | "aggressive" | "very_aggressive";
		tolerance: string;
	};
	sections: {
		executiveSummary: boolean;
		investmentRecommendations: boolean;
		assetAllocationChart: boolean;
		riskAssessment: boolean;
		projectedReturns: boolean;
		feeDisclosure: boolean;
		termsConditions: boolean;
	};
	coverPage: {
		enabled: boolean;
		title: string;
		clientName: string;
		preparedBy: string;
		date: string;
	};
	settings: {
		orientation: "portrait" | "landscape";
		includeDisclaimer: boolean;
		includeSEBIDisclosure: boolean;
	};
}

interface ClientData {
	fullName: string;
	email?: string;
	phone?: string;
}

const COLORS = {
	primary: [102, 51, 153] as [number, number, number],
	secondary: [75, 85, 99] as [number, number, number],
	success: [16, 185, 129] as [number, number, number],
	danger: [239, 68, 68] as [number, number, number],
	text: [17, 24, 39] as [number, number, number],
	lightGray: [243, 244, 246] as [number, number, number],
	equity: [59, 130, 246] as [number, number, number],
	debt: [34, 197, 94] as [number, number, number],
	gold: [234, 179, 8] as [number, number, number],
	realestate: [168, 85, 247] as [number, number, number],
	cash: [107, 114, 128] as [number, number, number],
};

export class ProposalPDFRenderer {
	private pdf: jsPDF;
	private pageWidth: number;
	private pageHeight: number;
	private margin = 20;
	private currentY = 20;
	private pageNumber = 0;

	constructor(orientation: "portrait" | "landscape" = "portrait") {
		this.pdf = new jsPDF({
			orientation,
			unit: "mm",
			format: "a4",
		});

		// Initialize autoTable plugin by calling it with empty body
		autoTable(this.pdf, { body: [] });

		this.pageWidth = this.pdf.internal.pageSize.getWidth();
		this.pageHeight = this.pdf.internal.pageSize.getHeight();
	}

	async generateProposal(
		config: ProposalConfig,
		clientData: ClientData,
	): Promise<Buffer> {
		if (config.coverPage.enabled) {
			this.renderCoverPage(config, clientData);
		}

		if (config.sections.executiveSummary) {
			this.addNewPage();
			this.renderExecutiveSummary(config, clientData);
		}

		if (config.sections.assetAllocationChart) {
			this.addNewPage();
			this.renderAssetAllocation(config);
		}

		if (config.sections.riskAssessment) {
			this.addNewPage();
			this.renderRiskAssessment(config);
		}

		// Render funding summary if sell proceeds data is available
		if ((config as any).fundingSummary) {
			this.addNewPage();
			this.renderFundingSummary((config as any).fundingSummary);
		}

		if (config.sections.investmentRecommendations) {
			this.addNewPage();
			this.renderInvestmentRecommendations(config);
		}

		if (config.sections.projectedReturns) {
			this.addNewPage();
			this.renderProjectedReturns(config);
		}

		if (config.sections.feeDisclosure) {
			this.addNewPage();
			this.renderFeeDisclosure();
		}

		if (
			config.sections.termsConditions ||
			config.settings.includeSEBIDisclosure
		) {
			this.addNewPage();
			this.renderTermsAndDisclosures(config);
		}

		const pdfOutput = this.pdf.output("arraybuffer");
		return Buffer.from(pdfOutput);
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
		this.pdf.setFontSize(8);
		this.pdf.setTextColor(...COLORS.secondary);
		this.pdf.text(
			"This proposal is for informational purposes only and does not constitute investment advice.",
			this.margin,
			this.pageHeight - 15,
			{ maxWidth: this.pageWidth - 2 * this.margin },
		);
		this.pdf.text(
			`Page ${this.pageNumber}`,
			this.pageWidth - this.margin - 15,
			this.pageHeight - 10,
		);
		this.pdf.text(
			"FintekPro Financial Services",
			this.margin,
			this.pageHeight - 10,
		);
	}

	private renderCoverPage(
		config: ProposalConfig,
		clientData: ClientData,
	): void {
		this.pageNumber++;

		this.pdf.setFillColor(...COLORS.primary);
		this.pdf.rect(0, 0, this.pageWidth, 100, "F");

		this.pdf.setTextColor(255, 255, 255);
		this.pdf.setFontSize(32);
		this.pdf.setFont("helvetica", "bold");
		this.pdf.text(
			config.coverPage.title || "Investment Proposal",
			this.margin,
			50,
		);

		this.pdf.setFontSize(16);
		this.pdf.setFont("helvetica", "normal");
		this.pdf.text(
			`Prepared for: ${config.coverPage.clientName || clientData.fullName}`,
			this.margin,
			70,
		);

		this.currentY = 120;
		this.pdf.setTextColor(...COLORS.text);

		const details = [
			["Client Name:", config.coverPage.clientName || clientData.fullName],
			["Email:", clientData.email || "N/A"],
			[
				"Prepared By:",
				config.coverPage.preparedBy || "FintekPro Financial Advisor",
			],
			[
				"Date:",
				config.coverPage.date || new Date().toLocaleDateString("en-IN"),
			],
			[
				"Investment Goal:",
				this.formatGoalName(config.investmentGoals.primaryGoal),
			],
			[
				"Target Corpus:",
				this.formatCurrency(config.investmentGoals.targetAmount),
			],
			["Investment Horizon:", config.investmentGoals.investmentHorizon],
		];

		this.pdf.setFontSize(11);
		details.forEach(([label, value]) => {
			this.pdf.setFont("helvetica", "bold");
			this.pdf.text(label, this.margin, this.currentY);
			this.pdf.setFont("helvetica", "normal");
			this.pdf.text(value, this.margin + 60, this.currentY);
			this.currentY += 10;
		});

		this.addFooter();
	}

	private renderExecutiveSummary(
		config: ProposalConfig,
		clientData: ClientData,
	): void {
		this.renderSectionHeader("Executive Summary");

		this.pdf.setFontSize(11);
		this.pdf.setTextColor(...COLORS.text);

		const summary = `Dear ${clientData.fullName},

Thank you for considering FintekPro as your investment partner. This proposal outlines a customized investment strategy designed to help you achieve your financial goal of ${this.formatGoalName(config.investmentGoals.primaryGoal).toLowerCase()}.

Based on our analysis of your financial profile and risk tolerance, we recommend a diversified portfolio with the following key characteristics:

• Investment Horizon: ${config.investmentGoals.investmentHorizon}
• Target Corpus: ${this.formatCurrency(config.investmentGoals.targetAmount)}
• Monthly Contribution: ${this.formatCurrency(config.investmentGoals.monthlyContribution)}
• Risk Profile: ${this.formatRiskCategory(config.riskProfile.category)}

Our recommended asset allocation is designed to balance growth potential with risk management, ensuring your investments align with your financial objectives and comfort level.`;

		const lines = this.pdf.splitTextToSize(
			summary,
			this.pageWidth - 2 * this.margin,
		);
		this.pdf.text(lines, this.margin, this.currentY);
		this.currentY += lines.length * 6 + 15;

		this.pdf.setFont("helvetica", "bold");
		this.pdf.text("Key Highlights:", this.margin, this.currentY);
		this.currentY += 8;

		const highlights = [
			`Equity Allocation: ${config.assetAllocation.equity}% for growth`,
			`Debt Allocation: ${config.assetAllocation.debt}% for stability`,
			`Gold: ${config.assetAllocation.gold}% for hedging`,
			`Expected Annual Return: ${this.calculateExpectedReturn(config)}%`,
		];

		highlights.forEach((highlight) => {
			this.pdf.setFont("helvetica", "normal");
			this.pdf.text(`• ${highlight}`, this.margin + 5, this.currentY);
			this.currentY += 7;
		});
	}

	private renderAssetAllocation(config: ProposalConfig): void {
		this.renderSectionHeader("Recommended Asset Allocation");

		const allocations = [
			{
				name: "Equity",
				value: config.assetAllocation.equity,
				color: COLORS.equity,
				description: "Stocks, equity mutual funds",
			},
			{
				name: "Debt",
				value: config.assetAllocation.debt,
				color: COLORS.debt,
				description: "Bonds, FDs, debt funds",
			},
			{
				name: "Gold",
				value: config.assetAllocation.gold,
				color: COLORS.gold,
				description: "Gold ETFs, SGBs",
			},
			{
				name: "Real Estate",
				value: config.assetAllocation.realestate,
				color: COLORS.realestate,
				description: "REITs, property",
			},
			{
				name: "Cash",
				value: config.assetAllocation.cash,
				color: COLORS.cash,
				description: "Liquid funds, savings",
			},
		].filter((a) => a.value > 0);

		const allocationRows = allocations.map((a) => [
			a.name,
			`${a.value}%`,
			a.description,
			this.formatCurrency(
				(config.investmentGoals.targetAmount * a.value) / 100,
			),
		]);

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [["Asset Class", "Allocation", "Description", "Target Value"]],
			body: allocationRows,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 20;

		this.pdf.setFont("helvetica", "bold");
		this.pdf.text("Allocation Rationale:", this.margin, this.currentY);
		this.currentY += 8;

		this.pdf.setFont("helvetica", "normal");
		const rationale = this.getAllocationRationale(config);
		const rationaleLines = this.pdf.splitTextToSize(
			rationale,
			this.pageWidth - 2 * this.margin,
		);
		this.pdf.text(rationaleLines, this.margin, this.currentY);
	}

	private renderRiskAssessment(config: ProposalConfig): void {
		this.renderSectionHeader("Risk Assessment");

		const riskData = [
			["Risk Score:", `${config.riskProfile.score}/100`],
			["Risk Category:", this.formatRiskCategory(config.riskProfile.category)],
			["Risk Tolerance:", config.riskProfile.tolerance],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			body: riskData,
			theme: "plain",
			margin: { left: this.margin, right: this.margin },
			columnStyles: {
				0: { fontStyle: "bold", cellWidth: 50 },
				1: { cellWidth: 100 },
			},
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 15;

		this.pdf.setFont("helvetica", "bold");
		this.pdf.text("Risk Profile Implications:", this.margin, this.currentY);
		this.currentY += 8;

		const implications = this.getRiskImplications(config.riskProfile.category);
		implications.forEach((imp) => {
			this.pdf.setFont("helvetica", "normal");
			this.pdf.text(`• ${imp}`, this.margin + 5, this.currentY);
			this.currentY += 7;
		});

		this.currentY += 10;

		this.pdf.setFont("helvetica", "bold");
		this.pdf.text("Important Risk Warnings:", this.margin, this.currentY);
		this.currentY += 8;

		const warnings = [
			"Investments in securities market are subject to market risks.",
			"Past performance is not indicative of future results.",
			"The value of investments may fluctuate based on market conditions.",
			"You may receive back less than what you originally invested.",
		];

		this.pdf.setTextColor(...COLORS.danger);
		warnings.forEach((warning) => {
			this.pdf.setFont("helvetica", "normal");
			this.pdf.text(`! ${warning}`, this.margin + 5, this.currentY);
			this.currentY += 7;
		});
		this.pdf.setTextColor(...COLORS.text);
	}

	private renderInvestmentRecommendations(config: ProposalConfig): void {
		this.renderSectionHeader("Investment Recommendations");

		this.pdf.setFontSize(11);
		this.pdf.text(
			"Based on your risk profile and investment goals, we recommend:",
			this.margin,
			this.currentY,
		);
		this.currentY += 10;

		// Check if detailed recommendations are provided in config
		const detailedRecs = (config as any).detailedRecommendations || [];

		if (detailedRecs.length > 0) {
			// Render detailed recommendations with fund names, amounts, and metrics
			const recRows = detailedRecs.map((r: any) => {
				const amount =
					r.suggestedAmount || r.changeAmount || r.recommendedAmount || 0;
				const amountStr =
					amount >= 100000
						? `₹${(amount / 100000).toFixed(2)}L`
						: `₹${amount.toLocaleString("en-IN")}`;
				const returns =
					r.fundMetrics?.returns3Y || r.returns3Y || r.expectedReturn || "N/A";
				const risk =
					r.fundMetrics?.risk || r.riskLevel || r.riskRating || "Moderate";
				return [
					r.action || "BUY",
					r.productName || r.schemeName || "N/A",
					amountStr,
					typeof returns === "string" ? returns : `${returns}%`,
					risk,
				];
			});

			autoTable(this.pdf, {
				startY: this.currentY,
				head: [["Action", "Fund/Product Name", "Amount", "3Y Returns", "Risk"]],
				body: recRows,
				theme: "striped",
				headStyles: { fillColor: COLORS.primary },
				margin: { left: this.margin, right: this.margin },
				columnStyles: {
					0: { cellWidth: 18 },
					1: { cellWidth: 70 },
					2: { cellWidth: 28 },
					3: { cellWidth: 25 },
					4: { cellWidth: 25 },
				},
			});

			this.currentY = (this.pdf as any).lastAutoTable.finalY + 10;

			// Add rationales section if available
			const rationalesExist = detailedRecs.some(
				(r: any) => r.rationale || r.selectionReason,
			);
			if (rationalesExist) {
				this.pdf.setFont("helvetica", "bold");
				this.pdf.setFontSize(11);
				this.pdf.text("Why These Recommendations:", this.margin, this.currentY);
				this.currentY += 8;

				detailedRecs.slice(0, 5).forEach((rec: any, idx: number) => {
					if (this.currentY > this.pageHeight - 40) {
						this.addNewPage();
					}

					const reason = rec.selectionReason || rec.rationale || "";
					const cleanReason = reason.replace(/\*\*/g, ""); // Remove markdown bold

					if (cleanReason) {
						this.pdf.setFont("helvetica", "bold");
						this.pdf.setFontSize(9);
						this.pdf.text(
							`${idx + 1}. ${rec.productName || "Recommendation"}:`,
							this.margin,
							this.currentY,
						);
						this.currentY += 5;

						this.pdf.setFont("helvetica", "normal");
						this.pdf.setFontSize(8);
						const lines = this.pdf.splitTextToSize(
							cleanReason,
							this.pageWidth - 2 * this.margin - 5,
						);
						this.pdf.text(lines, this.margin + 5, this.currentY);
						this.currentY += lines.length * 4 + 5;
					}
				});
			}
		} else {
			// Fallback to generic recommendations
			const recommendations = this.getRecommendations(config);

			autoTable(this.pdf, {
				startY: this.currentY,
				head: [
					["Category", "Recommended Instruments", "Allocation", "Risk Level"],
				],
				body: recommendations.map((r) => [
					r.category,
					r.instruments,
					r.allocation,
					r.risk,
				]),
				theme: "striped",
				headStyles: { fillColor: COLORS.primary },
				margin: { left: this.margin, right: this.margin },
			});

			this.currentY = (this.pdf as any).lastAutoTable.finalY + 15;

			this.pdf.setFont("helvetica", "italic");
			this.pdf.setFontSize(9);
			this.pdf.text(
				"Note: Specific fund recommendations will be provided after account opening and KYC completion.",
				this.margin,
				this.currentY,
			);
		}
	}

	private renderProjectedReturns(config: ProposalConfig): void {
		this.renderSectionHeader("Projected Returns");

		const expectedReturn = this.calculateExpectedReturn(config);
		const years = this.getYearsFromHorizon(
			config.investmentGoals.investmentHorizon,
		);

		const projections = [];
		let accumulated = 0;

		for (let year = 1; year <= years; year++) {
			const yearlyContribution =
				config.investmentGoals.monthlyContribution * 12;
			accumulated =
				(accumulated + yearlyContribution) * (1 + expectedReturn / 100);
			projections.push([
				`Year ${year}`,
				this.formatCurrency(yearlyContribution),
				this.formatCurrency(accumulated),
				`${((accumulated / (yearlyContribution * year) - 1) * 100).toFixed(1)}%`,
			]);
		}

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [
				["Period", "Annual Investment", "Projected Value", "Cumulative Return"],
			],
			body: projections,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 15;

		this.pdf.setFont("helvetica", "bold");
		this.pdf.text("Assumptions:", this.margin, this.currentY);
		this.currentY += 8;

		const assumptions = [
			`Expected Annual Return: ${expectedReturn}% (based on historical averages)`,
			`Monthly SIP: ${this.formatCurrency(config.investmentGoals.monthlyContribution)}`,
			`Investment Horizon: ${config.investmentGoals.investmentHorizon}`,
			"Returns are projected and not guaranteed",
		];

		assumptions.forEach((assumption) => {
			this.pdf.setFont("helvetica", "normal");
			this.pdf.text(`• ${assumption}`, this.margin + 5, this.currentY);
			this.currentY += 7;
		});
	}

	private renderFeeDisclosure(): void {
		this.renderSectionHeader("Fee Disclosure");

		const fees = [
			["Service", "Fee Type", "Amount", "Frequency"],
			["Advisory Fee", "Percentage", "0.50% - 1.00%", "Annual"],
			["Transaction Fee", "Fixed", "NIL", "Per Transaction"],
			["Account Maintenance", "Fixed", "NIL", "Annual"],
			[
				"Exit Load (if applicable)",
				"Percentage",
				"As per fund",
				"On redemption",
			],
			[
				"Expense Ratio",
				"Percentage",
				"Varies by fund",
				"Daily (deducted from NAV)",
			],
		];

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [fees[0]],
			body: fees.slice(1),
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 15;

		this.pdf.setFont("helvetica", "normal");
		this.pdf.setFontSize(10);
		const disclosure = `All fees are disclosed upfront and there are no hidden charges. Advisory fees are charged on the Assets Under Management (AUM). Mutual fund investments may have additional charges like expense ratio and exit load as per the respective fund's terms.`;

		const lines = this.pdf.splitTextToSize(
			disclosure,
			this.pageWidth - 2 * this.margin,
		);
		this.pdf.text(lines, this.margin, this.currentY);
	}

	private renderTermsAndDisclosures(config: ProposalConfig): void {
		this.renderSectionHeader("Terms, Conditions & Disclosures");

		const sections = [
			{
				title: "Investment Disclaimer",
				content:
					"This proposal is for informational purposes only and should not be construed as investment advice. Investment decisions should be made based on your individual circumstances, risk tolerance, and financial goals. Past performance is not indicative of future results.",
			},
			{
				title: "SEBI Registration",
				content:
					"FintekPro is a SEBI registered investment advisor. All investment recommendations are made in compliance with SEBI (Investment Advisers) Regulations, 2013.",
			},
			{
				title: "Risk Disclosure",
				content:
					"Investments in securities market are subject to market risks. Read all the related documents carefully before investing. The NAV of mutual fund schemes may go up or down depending upon the factors and forces affecting the securities market.",
			},
			{
				title: "Conflict of Interest",
				content:
					"We may receive commissions from mutual fund houses for investments made through our platform. However, our recommendations are made solely based on what we believe is in the best interest of the client.",
			},
			{
				title: "Privacy Policy",
				content:
					"Your personal and financial information is kept strictly confidential and is used only for the purpose of providing investment services. We do not share your information with third parties without your consent.",
			},
		];

		sections.forEach((section) => {
			if (this.currentY > this.pageHeight - 50) {
				this.addNewPage();
			}

			this.pdf.setFont("helvetica", "bold");
			this.pdf.setFontSize(11);
			this.pdf.text(section.title, this.margin, this.currentY);
			this.currentY += 6;

			this.pdf.setFont("helvetica", "normal");
			this.pdf.setFontSize(9);
			const lines = this.pdf.splitTextToSize(
				section.content,
				this.pageWidth - 2 * this.margin,
			);
			this.pdf.text(lines, this.margin, this.currentY);
			this.currentY += lines.length * 4 + 10;
		});
	}

	private renderFundingSummary(fundingSummary: {
		totalSellAmount: number;
		rebalancingBuyAmount: number;
		freshInvestmentAmount: number;
		remainingSellProceeds: number;
		totalDeployableAmount: number;
	}): void {
		this.renderSectionHeader("Investment Funding Summary");

		this.pdf.setFontSize(11);
		this.pdf.setFont("helvetica", "normal");
		this.pdf.text(
			"Here is how your investments will be funded:",
			this.margin,
			this.currentY,
		);
		this.currentY += 10;

		const formatAmount = (amt: number) => {
			if (amt >= 10000000) return `₹${(amt / 10000000).toFixed(2)} Cr`;
			if (amt >= 100000) return `₹${(amt / 100000).toFixed(2)} L`;
			return `₹${amt.toLocaleString("en-IN")}`;
		};

		const fundingData = [];

		if (fundingSummary.totalSellAmount > 0) {
			fundingData.push([
				"Proceeds from SELL Recommendations",
				formatAmount(fundingSummary.totalSellAmount),
				"Funds freed from underperforming/overweight holdings",
			]);
		}

		if (fundingSummary.rebalancingBuyAmount > 0) {
			fundingData.push([
				"Allocated to Rebalancing BUYs",
				`- ${formatAmount(fundingSummary.rebalancingBuyAmount)}`,
				"Deployed to underweight asset categories",
			]);
		}

		if (fundingSummary.remainingSellProceeds > 0) {
			fundingData.push([
				"Remaining Sell Proceeds",
				formatAmount(fundingSummary.remainingSellProceeds),
				"Available for fresh investments",
			]);
		}

		if (fundingSummary.freshInvestmentAmount > 0) {
			fundingData.push([
				"Fresh Investment Amount",
				formatAmount(fundingSummary.freshInvestmentAmount),
				"New capital to deploy",
			]);
		}

		fundingData.push([
			"Total Deployable Amount",
			formatAmount(fundingSummary.totalDeployableAmount),
			"Total for fresh investment recommendations",
		]);

		autoTable(this.pdf, {
			startY: this.currentY,
			head: [["Source/Use", "Amount", "Description"]],
			body: fundingData,
			theme: "striped",
			headStyles: { fillColor: COLORS.primary },
			margin: { left: this.margin, right: this.margin },
			columnStyles: {
				0: { cellWidth: 60 },
				1: { cellWidth: 35, halign: "right" },
				2: { cellWidth: 70 },
			},
		});

		this.currentY = (this.pdf as any).lastAutoTable.finalY + 15;

		// Add explanation
		this.pdf.setFont("helvetica", "italic");
		this.pdf.setFontSize(9);
		const explanation = `The above shows how your investment funds are sourced. Sell proceeds from rebalancing are first used to optimize your portfolio allocation, and any remaining amount along with fresh investment is deployed into recommended funds.`;
		const lines = this.pdf.splitTextToSize(
			explanation,
			this.pageWidth - 2 * this.margin,
		);
		this.pdf.text(lines, this.margin, this.currentY);
		this.currentY += lines.length * 4 + 10;
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

	private formatCurrency(value: number): string {
		if (value >= 10000000) {
			return `₹${(value / 10000000).toFixed(2)} Cr`;
		}
		if (value >= 100000) {
			return `₹${(value / 100000).toFixed(2)} L`;
		}
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(value);
	}

	private formatGoalName(goal: string): string {
		const names: Record<string, string> = {
			wealth_creation: "Wealth Creation",
			retirement: "Retirement Planning",
			child_education: "Child Education",
			home_purchase: "Home Purchase",
			tax_saving: "Tax Saving",
			regular_income: "Regular Income",
		};
		return (
			names[goal] ||
			goal.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())
		);
	}

	private formatRiskCategory(category: string): string {
		return category.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
	}

	private calculateExpectedReturn(config: ProposalConfig): number {
		const returns = {
			equity: 12,
			debt: 7,
			gold: 8,
			realestate: 9,
			cash: 4,
		};

		let expectedReturn = 0;
		Object.entries(config.assetAllocation).forEach(([key, value]) => {
			expectedReturn += (returns[key as keyof typeof returns] * value) / 100;
		});

		return Math.round(expectedReturn * 10) / 10;
	}

	private getYearsFromHorizon(horizon: string): number {
		if (horizon.includes("1-3")) return 3;
		if (horizon.includes("3-5")) return 5;
		if (horizon.includes("5-10")) return 10;
		return 15;
	}

	private getAllocationRationale(config: ProposalConfig): string {
		const category = config.riskProfile.category;

		if (category === "conservative") {
			return "Given your conservative risk profile, we recommend a higher allocation to debt instruments for capital preservation, with limited equity exposure for modest growth.";
		}
		if (category === "moderate") {
			return "With a moderate risk tolerance, we recommend a balanced portfolio with equal emphasis on growth (equity) and stability (debt), supplemented by gold for hedging.";
		}
		if (category === "aggressive") {
			return "Your aggressive risk profile allows for higher equity allocation to maximize growth potential, with debt providing some downside protection.";
		}
		return "Your very aggressive profile enables maximum equity allocation for highest growth potential. This approach requires comfort with significant market volatility.";
	}

	private getRiskImplications(category: string): string[] {
		const implications: Record<string, string[]> = {
			conservative: [
				"Lower expected returns but more stable portfolio value",
				"Focus on capital preservation over growth",
				"Suitable for shorter time horizons or near-retirement investors",
				"Lower exposure to market volatility",
			],
			moderate: [
				"Balanced approach between growth and stability",
				"Can withstand moderate market fluctuations",
				"Suitable for medium to long-term goals",
				"Diversified across asset classes",
			],
			aggressive: [
				"Higher growth potential with increased volatility",
				"Can withstand significant market downturns",
				"Best suited for long-term investment horizons",
				"Requires patience during market corrections",
			],
			very_aggressive: [
				"Maximum growth potential with highest volatility",
				"Substantial exposure to equity market risks",
				"Requires very long investment horizon",
				"May experience significant short-term losses",
			],
		};
		return implications[category] || implications.moderate;
	}

	private getRecommendations(
		config: ProposalConfig,
	): Array<{
		category: string;
		instruments: string;
		allocation: string;
		risk: string;
	}> {
		const recommendations = [];

		if (config.assetAllocation.equity > 0) {
			recommendations.push({
				category: "Equity",
				instruments: "Large Cap, Mid Cap, Small Cap Funds",
				allocation: `${config.assetAllocation.equity}%`,
				risk: "High",
			});
		}

		if (config.assetAllocation.debt > 0) {
			recommendations.push({
				category: "Debt",
				instruments: "Corporate Bonds, Gilt Funds, FDs",
				allocation: `${config.assetAllocation.debt}%`,
				risk: "Low-Medium",
			});
		}

		if (config.assetAllocation.gold > 0) {
			recommendations.push({
				category: "Gold",
				instruments: "Gold ETFs, Sovereign Gold Bonds",
				allocation: `${config.assetAllocation.gold}%`,
				risk: "Medium",
			});
		}

		if (config.assetAllocation.realestate > 0) {
			recommendations.push({
				category: "Real Estate",
				instruments: "REITs, InvITs",
				allocation: `${config.assetAllocation.realestate}%`,
				risk: "Medium-High",
			});
		}

		if (config.assetAllocation.cash > 0) {
			recommendations.push({
				category: "Cash",
				instruments: "Liquid Funds, Savings Account",
				allocation: `${config.assetAllocation.cash}%`,
				risk: "Low",
			});
		}

		return recommendations;
	}
}

export async function generateProposalPDF(
	config: any,
	clientData: any,
): Promise<Buffer> {
	const renderer = new ProposalPDFRenderer(
		config.settings?.orientation || "portrait",
	);
	return renderer.generateProposal(config, clientData);
}

export default generateProposalPDF;
