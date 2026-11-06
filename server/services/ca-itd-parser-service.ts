import { db } from "../db";
import { eq } from "drizzle-orm";
import { agentItrCases } from "@shared/schema";

export interface ParsedITDJson {
	pan: string;
	assessmentYear: string;
	formType: string;
	personalInfo: {
		firstName?: string;
		surNameOrOrgName?: string;
		pan: string;
		aadhaarNumber?: string;
		email?: string;
		mobile?: string;
		address?: string;
	};
	bankAccounts: {
		bankName: string;
		ifsc: string;
		accountNumber: string;
		accountType?: string;
		isRefundAccount: boolean;
	}[];
	salaryIncome: {
		grossSalary: number;
		standardDeduction: number;
		professionalTax: number;
		netSalary: number;
		employerDetails?: {
			employerName: string;
			tan: string;
		}[];
	};
	otherIncome: {
		savingsInterest: number;
		fdInterest: number;
		dividendIncome: number;
		otherSources: number;
	};
	capitalGains: {
		stcg111a: number;
		stcgOther: number;
		ltcg112a: number;
		ltcgOther: number;
	};
	deductions: {
		section80c: number;
		section80ccc: number;
		section80ccd1: number;
		section80ccd1b: number;
		section80d: number;
		section80tta: number;
		section80ttb: number;
		section80g: number;
		totalChapterVIA: number;
	};
	taxesPaid: {
		tdsSalary: number;
		tdsOther: number;
		tcs: number;
		advanceTax: number;
		selfAssessmentTax: number;
		totalTaxesPaid: number;
	};
	broughtForwardLosses?: {
		assessmentYear: string;
		lossType: string;
		amount: number;
	}[];
	engineVersion: string;
	parsedAt: string;
}

/**
 * Service to parse pre-filled JSON downloaded from incometax.gov.in (ITR-1, 2, 3, 4 schemas).
 */
export class CAItdParserService {
	private readonly engineVersion = "ITD_PREFILL_PARSER_V1.0";

	/**
	 * Parses raw JSON string or object from incometax.gov.in.
	 *
	 * @param rawJson JSON string or object downloaded from ITD portal
	 */
	parseJson(rawJson: string | Record<string, any>): ParsedITDJson {
		const data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;

		// ITD pre-fill JSON wraps either in root object or under ITR / ITR1 / ITR2 / ITR3 / ITR4
		const root = data.ITR || data.ITR1 || data.ITR2 || data.ITR3 || data.ITR4 || data;
		const personal = root.PersonalInfo || root.PersonalInfoDtls || root.PartA_GEN?.PersonalInfo || {};
		const verification = root.Verification || {};

		// Extract Bank Accounts
		const bankAccountsRaw = root.BankAccountDtls || root.PartA_GEN?.BankAccountDtls || [];
		const bankList = Array.isArray(bankAccountsRaw)
			? bankAccountsRaw
			: bankAccountsRaw.AddnlBankDetails
				? Array.isArray(bankAccountsRaw.AddnlBankDetails)
					? bankAccountsRaw.AddnlBankDetails
					: [bankAccountsRaw.AddnlBankDetails]
				: [];

		const bankAccounts = bankList.map((b: any) => ({
			bankName: b.BankName || b.bankName || "Bank",
			ifsc: b.IFSCCode || b.ifscCode || "",
			accountNumber: b.BankAccountNo || b.bankAccountNo || "",
			accountType: b.AccountType || "Savings",
			isRefundAccount: Boolean(b.UseForRefund === "Y" || b.RefundFlag === "Y" || b.isRefundAccount),
		}));

		// Extract Salary details (Schedule S)
		const scheduleS = root.ScheduleS || root.PartB_TI?.Salary || {};
		const grossSalary = Number(scheduleS.GrossSalary || scheduleS.TotalGrossSalary || 0);
		const stdDeduction = Number(scheduleS.StandardDeduction || scheduleS.DeductionUs16ia || 0);
		const profTax = Number(scheduleS.ProfessionalTax || scheduleS.DeductionUs16iii || 0);
		const netSalary = Math.max(0, grossSalary - stdDeduction - profTax);

		// Extract Other Sources (Schedule OS)
		const scheduleOS = root.ScheduleOS || root.PartB_TI?.OtherSources || {};
		const savingsInterest = Number(scheduleOS.InterestSavingsBank || scheduleOS.InterestFromSavings || 0);
		const fdInterest = Number(scheduleOS.InterestDeposit || scheduleOS.InterestFromDeposit || 0);
		const dividendIncome = Number(scheduleOS.DividendIncome || scheduleOS.DividendGross || 0);
		const otherSources = Number(scheduleOS.OthersGross || 0);

		// Extract Capital Gains (Schedule CG)
		const scheduleCG = root.ScheduleCG || root.PartB_TI?.CapitalGains || {};
		const stcg111a = Number(scheduleCG.STCG?.Sec111A || scheduleCG.STCG111A || 0);
		const stcgOther = Number(scheduleCG.STCG?.OtherThanSec111A || scheduleCG.STCGOther || 0);
		const ltcg112a = Number(scheduleCG.LTCG?.Sec112A || scheduleCG.LTCG112A || 0);
		const ltcgOther = Number(scheduleCG.LTCG?.OtherThanSec112A || scheduleCG.LTCGOther || 0);

		// Deductions (Schedule VIA)
		const via = root.ScheduleVIA || root.PartB_TI?.Deductions || {};
		const s80c = Number(via.Section80C || via.Sec80C || 0);
		const s80ccc = Number(via.Section80CCC || 0);
		const s80ccd1 = Number(via.Section80CCD1 || 0);
		const s80ccd1b = Number(via.Section80CCD1B || 0);
		const s80d = Number(via.Section80D || via.Sec80D || 0);
		const s80tta = Number(via.Section80TTA || via.Sec80TTA || 0);
		const s80ttb = Number(via.Section80TTB || 0);
		const s80g = Number(via.Section80G || 0);
		const totalVIA = Number(via.TotalDeductions || via.TotalVIA || (s80c + s80ccd1b + s80d + s80tta));

		// Taxes Paid & TDS (Schedule TDS1, TDS2, IT)
		const tdsSalary = Number(root.ScheduleTDS1?.TotalTdsSal || root.TDSonSalary || 0);
		const tdsOther = Number(root.ScheduleTDS2?.TotalTdsOther || root.TDSonOthThanSal || 0);
		const advanceTax = Number(root.ScheduleIT?.TotalAdvanceTax || root.AdvanceTax || 0);
		const saTax = Number(root.ScheduleIT?.TotalSelfAssessmentTax || root.SelfAssessmentTax || 0);
		const totalTaxes = tdsSalary + tdsOther + advanceTax + saTax;

		// Brought Forward Losses (Schedule CFL)
		const cfl = root.ScheduleCFL?.LossSummary || [];
		const broughtForwardLosses = Array.isArray(cfl)
			? cfl.map((item: any) => ({
					assessmentYear: item.AssessmentYear || item.ay || "2023-24",
					lossType: item.LossType || item.head || "STCG",
					amount: Number(item.Amount || item.loss || 0),
				}))
			: [];

		return {
			pan: personal.PAN || personal.pan || "",
			assessmentYear: root.AssessmentYear || root.AY || "2025-26",
			formType: root.FormName || root.formName || (scheduleCG.STCG ? "ITR-2" : "ITR-1"),
			personalInfo: {
				firstName: personal.AssesseeName?.FirstName || personal.firstName || "",
				surNameOrOrgName: personal.AssesseeName?.SurNameOrOrgName || personal.lastName || "",
				pan: personal.PAN || personal.pan || "",
				aadhaarNumber: personal.AadhaarCardNo || personal.aadhaarNumber,
				email: personal.Address?.EmailAddress || personal.email,
				mobile: personal.Address?.MobileNo || personal.mobile,
				address: personal.Address ? `${personal.Address.ResidenceNo || ""} ${personal.Address.RoadOrStreet || ""} ${personal.Address.CityOrTownOrDistrict || ""}`.trim() : undefined,
			},
			bankAccounts,
			salaryIncome: {
				grossSalary,
				standardDeduction: stdDeduction,
				professionalTax: profTax,
				netSalary,
			},
			otherIncome: {
				savingsInterest,
				fdInterest,
				dividendIncome,
				otherSources,
			},
			capitalGains: {
				stcg111a,
				stcgOther,
				ltcg112a,
				ltcgOther,
			},
			deductions: {
				section80c: s80c,
				section80ccc: s80ccc,
				section80ccd1: s80ccd1,
				section80ccd1b: s80ccd1b,
				section80d: s80d,
				section80tta: s80tta,
				section80ttb: s80ttb,
				section80g: s80g,
				totalChapterVIA: totalVIA,
			},
			taxesPaid: {
				tdsSalary,
				tdsOther,
				tcs: 0,
				advanceTax,
				selfAssessmentTax: saTax,
				totalTaxesPaid: totalTaxes,
			},
			broughtForwardLosses,
			engineVersion: this.engineVersion,
			parsedAt: new Date().toISOString(),
		};
	}

	/**
	 * Automatically merges parsed ITD JSON data into an existing agentItrCase record.
	 *
	 * @param caseId Case ID to update
	 * @param parsed Parsed ITD data structure
	 */
	async applyToCase(caseId: string, parsed: ParsedITDJson) {
		const totalGross =
			parsed.salaryIncome.netSalary +
			parsed.otherIncome.savingsInterest +
			parsed.otherIncome.fdInterest +
			parsed.otherIncome.dividendIncome +
			parsed.capitalGains.stcg111a +
			parsed.capitalGains.ltcg112a;

		const totalTds = parsed.taxesPaid.tdsSalary + parsed.taxesPaid.tdsOther;

		const [updated] = await db
			.update(agentItrCases)
			.set({
				itrFormType: parsed.formType,
				salaryIncome: parsed.salaryIncome.netSalary.toString(),
				interestIncome: (parsed.otherIncome.savingsInterest + parsed.otherIncome.fdInterest).toString(),
				dividendIncome: parsed.otherIncome.dividendIncome.toString(),
				capitalGainsStcg: parsed.capitalGains.stcg111a.toString(),
				capitalGainsLtcg: parsed.capitalGains.ltcg112a.toString(),
				section80c: parsed.deductions.section80c.toString(),
				section80d: parsed.deductions.section80d.toString(),
				otherDeductions: (parsed.deductions.totalChapterVIA - (parsed.deductions.section80c + parsed.deductions.section80d)).toString(),
				tdsPaid: totalTds.toString(),
				advanceTaxPaid: parsed.taxesPaid.advanceTax.toString(),
				totalGrossIncome: totalGross.toString(),
				updatedAt: new Date(),
			})
			.where(eq(agentItrCases.id, caseId))
			.returning();

		return {
			success: true,
			case: updated,
			meta: {
				engineVersion: this.engineVersion,
				appliedAt: new Date().toISOString(),
			},
		};
	}
}

export const caItdParserService = new CAItdParserService();

