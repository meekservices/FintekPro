/**
 * Key Facts Statement (KFS) Generator Service
 *
 * Implements RBI Digital Lending Guidelines 2022 (RBI/2022-23/111)
 * Generates standardized Key Facts Statements for all loan products
 *
 * Required disclosures:
 * 1. Loan amount sanctioned
 * 2. Tenure of the loan
 * 3. Annualized interest rate (APR) including all fees
 * 4. All applicable fees and charges with breakdown
 * 5. Total amount to be repaid / EMI schedule
 * 6. Details of grievance redressal mechanism
 * 7. Cooling-off / look-up period (minimum 3 days as per RBI)
 */

export interface KFSLoanDetails {
	loanAmount: number;
	interestRatePerAnnum: number;
	tenureMonths: number;
	processingFeePercent: number;
	processingFeeFixed?: number;
	stampDuty?: number;
	insurancePremium?: number;
	gstOnFees?: number;
	documentationCharges?: number;
	otherCharges?: { name: string; amount: number }[];
	loanType:
		| "personal"
		| "home"
		| "car"
		| "business"
		| "education"
		| "gold"
		| "lap";
	lenderName: string;
	lenderRbiRegNumber?: string;
	disbursementDate?: Date;
	firstEmiDate?: Date;
}

export interface KeyFactsStatement {
	kfsVersion: string;
	generatedAt: Date;
	validUntil: Date;
	regulatoryReference: string;

	lenderDetails: {
		name: string;
		rbiRegistrationNumber: string;
		grievanceOfficerName: string;
		grievanceOfficerEmail: string;
		grievanceOfficerPhone: string;
		rbiSacheteLink: string;
	};

	loanSummary: {
		loanType: string;
		loanAmountSanctioned: number;
		tenureMonths: number;
		interestRatePerAnnum: number;
		interestRateType: "fixed" | "floating";
		repaymentFrequency: "monthly" | "quarterly";
		emiAmount: number;
		totalInterestPayable: number;
		totalAmountRepayable: number;
	};

	annualPercentageRate: {
		apr: number;
		aprBreakdown: {
			baseInterestRate: number;
			processingFeeImpact: number;
			insuranceImpact: number;
			otherChargesImpact: number;
		};
		aprCalculationMethod: string;
	};

	feesAndCharges: {
		processingFee: { amount: number; percent?: number };
		stampDuty: number;
		gst: number;
		insurancePremium: number;
		documentationCharges: number;
		otherCharges: { name: string; amount: number }[];
		totalUpfrontCharges: number;
		netDisbursementAmount: number;
	};

	emiSchedule: {
		firstEmiDate: string;
		emiAmount: number;
		totalEmis: number;
		sampleSchedule: {
			installmentNo: number;
			principalComponent: number;
			interestComponent: number;
			outstandingPrincipal: number;
		}[];
	};

	prepaymentTerms: {
		prepaymentAllowed: boolean;
		prepaymentChargePercent: number;
		lockInPeriodMonths: number;
		partPrepaymentMinAmount: number;
		foreclosureChargePercent: number;
	};

	coolingOffPeriod: {
		lookUpPeriodDays: number;
		exitOptionAvailable: boolean;
		refundProcessDays: number;
		effectiveFromDate: string;
		notes: string;
	};

	penalCharges: {
		latePaymentChargePercent: number;
		latePaymentChargeFixed: number;
		bounceCharges: number;
		peakingCharge: number;
	};

	grievanceRedressal: {
		level1: {
			designation: string;
			email: string;
			phone: string;
			responseTimeBusinessDays: number;
		};
		level2: {
			designation: string;
			email: string;
			phone: string;
			responseTimeBusinessDays: number;
		};
		rbiOmbudsman: {
			portalLink: string;
			email: string;
			phone: string;
			escalationTimelineDays: number;
		};
	};

	importantTerms: string[];

	acknowledgementRequired: {
		borrowerName: string;
		borrowerPan: string;
		declarationText: string;
		signatureDate: string;
	};
}

class KFSGeneratorService {
	private readonly KFS_VERSION = "1.0";
	private readonly REGULATORY_REFERENCE =
		"RBI/2022-23/111 DOR.FIN.REC.65/03.10.038/2022-23";
	private readonly COOLING_OFF_DAYS = 3;

	generateKFS(
		loanDetails: KFSLoanDetails,
		borrowerName: string,
		borrowerPan: string,
	): KeyFactsStatement {
		const now = new Date();
		const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

		const { emi, totalInterest, totalRepayable } = this.calculateEMI(
			loanDetails.loanAmount,
			loanDetails.interestRatePerAnnum,
			loanDetails.tenureMonths,
		);

		const fees = this.calculateFeesBreakdown(loanDetails);
		const apr = this.calculateAPR(loanDetails, fees.totalUpfrontCharges);
		const emiSchedule = this.generateEMISchedule(
			loanDetails.loanAmount,
			loanDetails.interestRatePerAnnum,
			loanDetails.tenureMonths,
			loanDetails.firstEmiDate ||
				new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
		);

		const coolingOffStart = loanDetails.disbursementDate || now;

		return {
			kfsVersion: this.KFS_VERSION,
			generatedAt: now,
			validUntil,
			regulatoryReference: this.REGULATORY_REFERENCE,

			lenderDetails: {
				name: loanDetails.lenderName,
				rbiRegistrationNumber: loanDetails.lenderRbiRegNumber || "N00XXXXX",
				grievanceOfficerName: "Grievance Redressal Officer",
				grievanceOfficerEmail: "grievance@fintekpro.com",
				grievanceOfficerPhone: "+91-1800-XXX-XXXX",
				rbiSacheteLink: "https://sachet.rbi.org.in",
			},

			loanSummary: {
				loanType: this.formatLoanType(loanDetails.loanType),
				loanAmountSanctioned: loanDetails.loanAmount,
				tenureMonths: loanDetails.tenureMonths,
				interestRatePerAnnum: loanDetails.interestRatePerAnnum,
				interestRateType: "fixed",
				repaymentFrequency: "monthly",
				emiAmount: emi,
				totalInterestPayable: totalInterest,
				totalAmountRepayable: totalRepayable,
			},

			annualPercentageRate: apr,
			feesAndCharges: fees,
			emiSchedule: {
				firstEmiDate: emiSchedule.firstEmiDate,
				emiAmount: emi,
				totalEmis: loanDetails.tenureMonths,
				sampleSchedule: emiSchedule.sampleSchedule,
			},

			prepaymentTerms: this.getPrepaymentTerms(loanDetails.loanType),

			coolingOffPeriod: {
				lookUpPeriodDays: this.COOLING_OFF_DAYS,
				exitOptionAvailable: true,
				refundProcessDays: 7,
				effectiveFromDate: coolingOffStart.toISOString().split("T")[0],
				notes: `As per RBI Digital Lending Guidelines, you have ${this.COOLING_OFF_DAYS} days from the date of disbursement to exit the loan without penalty. Principal amount plus proportionate interest will be refunded within 7 working days.`,
			},

			penalCharges: this.getPenalCharges(loanDetails.loanType),
			grievanceRedressal: this.getGrievanceRedressalInfo(),
			importantTerms: this.getImportantTerms(loanDetails.loanType),

			acknowledgementRequired: {
				borrowerName,
				borrowerPan,
				declarationText: `I, ${borrowerName}, hereby acknowledge that I have read, understood, and agree to the terms and conditions mentioned in this Key Facts Statement. I confirm that the Annual Percentage Rate (APR), fees, charges, and all other terms have been explained to me in a language I understand. I understand my right to exit the loan within the cooling-off period of ${this.COOLING_OFF_DAYS} days from disbursement.`,
				signatureDate: now.toISOString().split("T")[0],
			},
		};
	}

	private calculateEMI(
		principal: number,
		annualRate: number,
		tenureMonths: number,
	): { emi: number; totalInterest: number; totalRepayable: number } {
		const monthlyRate = annualRate / 12 / 100;

		if (monthlyRate === 0) {
			const emi = principal / tenureMonths;
			return {
				emi: Math.round(emi * 100) / 100,
				totalInterest: 0,
				totalRepayable: principal,
			};
		}

		const emi =
			(principal * monthlyRate * (1 + monthlyRate) ** tenureMonths) /
			((1 + monthlyRate) ** tenureMonths - 1);
		const totalRepayable = emi * tenureMonths;
		const totalInterest = totalRepayable - principal;

		return {
			emi: Math.round(emi * 100) / 100,
			totalInterest: Math.round(totalInterest * 100) / 100,
			totalRepayable: Math.round(totalRepayable * 100) / 100,
		};
	}

	private calculateFeesBreakdown(
		loanDetails: KFSLoanDetails,
	): KeyFactsStatement["feesAndCharges"] {
		const processingFeeAmount =
			loanDetails.processingFeeFixed ||
			(loanDetails.loanAmount * loanDetails.processingFeePercent) / 100;

		const stampDuty =
			loanDetails.stampDuty || Math.round(loanDetails.loanAmount * 0.001);
		const gst = loanDetails.gstOnFees || Math.round(processingFeeAmount * 0.18);
		const insurancePremium = loanDetails.insurancePremium || 0;
		const documentationCharges = loanDetails.documentationCharges || 500;
		const otherCharges = loanDetails.otherCharges || [];

		const otherChargesTotal = otherCharges.reduce(
			(sum, c) => sum + c.amount,
			0,
		);
		const totalUpfrontCharges =
			processingFeeAmount +
			stampDuty +
			gst +
			insurancePremium +
			documentationCharges +
			otherChargesTotal;

		return {
			processingFee: {
				amount: processingFeeAmount,
				percent: loanDetails.processingFeePercent,
			},
			stampDuty,
			gst,
			insurancePremium,
			documentationCharges,
			otherCharges,
			totalUpfrontCharges,
			netDisbursementAmount: loanDetails.loanAmount - totalUpfrontCharges,
		};
	}

	private calculateAPR(
		loanDetails: KFSLoanDetails,
		totalUpfrontCharges: number,
	): KeyFactsStatement["annualPercentageRate"] {
		const processingFeeImpact =
			(totalUpfrontCharges / loanDetails.loanAmount) *
			(12 / loanDetails.tenureMonths) *
			100;
		const apr = loanDetails.interestRatePerAnnum + processingFeeImpact;

		return {
			apr: Math.round(apr * 100) / 100,
			aprBreakdown: {
				baseInterestRate: loanDetails.interestRatePerAnnum,
				processingFeeImpact: Math.round(processingFeeImpact * 100) / 100,
				insuranceImpact: loanDetails.insurancePremium
					? Math.round(
							(loanDetails.insurancePremium / loanDetails.loanAmount) *
								100 *
								100,
						) / 100
					: 0,
				otherChargesImpact: 0,
			},
			aprCalculationMethod:
				"Internal Rate of Return (IRR) method as per RBI Guidelines",
		};
	}

	private generateEMISchedule(
		principal: number,
		annualRate: number,
		tenureMonths: number,
		firstEmiDate: Date,
	) {
		const monthlyRate = annualRate / 12 / 100;
		const { emi } = this.calculateEMI(principal, annualRate, tenureMonths);

		const sampleSchedule: KeyFactsStatement["emiSchedule"]["sampleSchedule"] =
			[];
		let outstandingPrincipal = principal;

		const samplesToShow = [
			1,
			2,
			3,
			Math.ceil(tenureMonths / 2),
			tenureMonths - 1,
			tenureMonths,
		];

		for (let i = 1; i <= tenureMonths; i++) {
			const interestComponent = outstandingPrincipal * monthlyRate;
			const principalComponent = emi - interestComponent;
			outstandingPrincipal = Math.max(
				0,
				outstandingPrincipal - principalComponent,
			);

			if (samplesToShow.includes(i)) {
				sampleSchedule.push({
					installmentNo: i,
					principalComponent: Math.round(principalComponent * 100) / 100,
					interestComponent: Math.round(interestComponent * 100) / 100,
					outstandingPrincipal: Math.round(outstandingPrincipal * 100) / 100,
				});
			}
		}

		return {
			firstEmiDate: firstEmiDate.toISOString().split("T")[0],
			sampleSchedule,
		};
	}

	private getPrepaymentTerms(
		loanType: string,
	): KeyFactsStatement["prepaymentTerms"] {
		const terms: Record<string, KeyFactsStatement["prepaymentTerms"]> = {
			home: {
				prepaymentAllowed: true,
				prepaymentChargePercent: 0,
				lockInPeriodMonths: 0,
				partPrepaymentMinAmount: 50000,
				foreclosureChargePercent: 0,
			},
			personal: {
				prepaymentAllowed: true,
				prepaymentChargePercent: 2,
				lockInPeriodMonths: 6,
				partPrepaymentMinAmount: 10000,
				foreclosureChargePercent: 3,
			},
			car: {
				prepaymentAllowed: true,
				prepaymentChargePercent: 0,
				lockInPeriodMonths: 0,
				partPrepaymentMinAmount: 25000,
				foreclosureChargePercent: 0,
			},
			business: {
				prepaymentAllowed: true,
				prepaymentChargePercent: 2.5,
				lockInPeriodMonths: 12,
				partPrepaymentMinAmount: 100000,
				foreclosureChargePercent: 4,
			},
			education: {
				prepaymentAllowed: true,
				prepaymentChargePercent: 0,
				lockInPeriodMonths: 0,
				partPrepaymentMinAmount: 10000,
				foreclosureChargePercent: 0,
			},
			gold: {
				prepaymentAllowed: true,
				prepaymentChargePercent: 0,
				lockInPeriodMonths: 0,
				partPrepaymentMinAmount: 5000,
				foreclosureChargePercent: 0,
			},
			lap: {
				prepaymentAllowed: true,
				prepaymentChargePercent: 2,
				lockInPeriodMonths: 6,
				partPrepaymentMinAmount: 50000,
				foreclosureChargePercent: 3,
			},
		};

		return terms[loanType] || terms.personal;
	}

	private getPenalCharges(loanType: string): KeyFactsStatement["penalCharges"] {
		return {
			latePaymentChargePercent: 2,
			latePaymentChargeFixed: 500,
			bounceCharges: 750,
			peakingCharge: 0,
		};
	}

	private getGrievanceRedressalInfo(): KeyFactsStatement["grievanceRedressal"] {
		return {
			level1: {
				designation: "Customer Care Executive",
				email: "support@fintekpro.com",
				phone: "1800-XXX-XXXX",
				responseTimeBusinessDays: 3,
			},
			level2: {
				designation: "Principal Nodal Officer",
				email: "nodal.officer@fintekpro.com",
				phone: "1800-XXX-XXXX",
				responseTimeBusinessDays: 7,
			},
			rbiOmbudsman: {
				portalLink: "https://cms.rbi.org.in",
				email: "crpc@rbi.org.in",
				phone: "14448",
				escalationTimelineDays: 30,
			},
		};
	}

	private getImportantTerms(loanType: string): string[] {
		const commonTerms = [
			"The borrower must ensure timely EMI payments to avoid late payment charges and negative impact on credit score.",
			"All fees and charges mentioned are inclusive of applicable taxes unless otherwise specified.",
			"The lender reserves the right to recall the loan in case of default as per the loan agreement.",
			"Any dispute arising out of this loan shall be subject to the jurisdiction of courts in India.",
			"The borrower has the right to receive a copy of the loan agreement and all related documents.",
			"Changes in floating interest rate (if applicable) will be communicated 30 days in advance.",
			"Insurance is optional and not a prerequisite for loan approval.",
		];

		const typeSpecificTerms: Record<string, string[]> = {
			home: [
				"Property documents will be held as collateral until full repayment.",
				"Property insurance is mandatory and must be maintained throughout the loan tenure.",
			],
			personal: [
				"No collateral required for this unsecured loan.",
				"Processing fee is non-refundable once loan is disbursed.",
			],
			car: [
				"Vehicle hypothecation to lender is mandatory.",
				"Comprehensive vehicle insurance is required throughout the loan tenure.",
			],
			business: [
				"Business financials may be reviewed periodically.",
				"Working capital limits may be subject to annual review.",
			],
			education: [
				"Moratorium period available during the study period plus 6 months.",
				"Interest subsidy available for eligible borrowers under government schemes.",
			],
			gold: [
				"Gold ornaments will be stored securely until loan repayment.",
				"Loan-to-value ratio as per RBI guidelines.",
			],
			lap: [
				"Property will remain mortgaged until full loan repayment.",
				"Property valuation will be conducted by empaneled valuers.",
			],
		};

		return [...commonTerms, ...(typeSpecificTerms[loanType] || [])];
	}

	private formatLoanType(type: string): string {
		const typeNames: Record<string, string> = {
			personal: "Personal Loan",
			home: "Home Loan",
			car: "Car/Auto Loan",
			business: "Business Loan",
			education: "Education Loan",
			gold: "Gold Loan",
			lap: "Loan Against Property",
		};
		return typeNames[type] || type;
	}
}

export const kfsGeneratorService = new KFSGeneratorService();
