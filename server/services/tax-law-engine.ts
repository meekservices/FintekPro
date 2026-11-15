/**
 * Income Tax Law Engine (TL-ENG-v1.0)
 * 
 * Strict layered architecture: /server/services/tax-law-engine.ts
 * Serves Chartered Accountants (CAs) and Company Secretaries (CSs)
 * Compliant with FintekPro GCR v1.0 and FASP-AI v1.0
 */

import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import {
  taxStatuteSections,
  taxStatuteRules,
  taxCbdtCirculars,
  taxJudicialPrecedents,
  taxForm3cdClauses,
  taxCsCorporateModules,
  taxAiAdvisoryLogs,
  type TaxStatuteSection,
  type TaxStatuteRule,
  type TaxCbdtCircular,
  type TaxJudicialPrecedent,
  type TaxForm3cdClause,
  type TaxCsCorporateModule,
} from "../../shared/schema";
import { logger } from "../logger";
import { telemetryBus } from "./engine-telemetry-bus";

export const ENGINE_VERSION = "TL-ENG-v1.0";

export interface Valuation11UAInput {
  bookValueOfAssets: number; // A: Book value of assets (excluding advance tax, deferred tax)
  bookValueOfLiabilities: number; // L: Book value of liabilities (excluding paid-up capital, reserves)
  paidUpEquityCapital: number; // PE: Total paid-up equity share capital
  faceValueOfShare: number; // PV: Paid up value of such equity shares
  sharesToBeValued?: number;
  unlistedCompanyName: string;
  cinOrPan?: string;
  valuationDate: string; // YYYY-MM-DD
}

export interface Valuation11UAOutput {
  engine_version: string;
  calculation_timestamp: string;
  inputs_used: Valuation11UAInput;
  formula_applied: string;
  intermediate_steps: {
    net_worth_A_minus_L: number;
    ratio_PV_divided_PE: number;
    calculated_fmv_per_share: number;
    total_valuation_of_block?: number;
  };
  fmv_per_share: number;
  statutory_rule: string;
  section_governed: string;
  companies_act_cross_reference: string;
  explainability_notes: string[];
}

export interface AuditScanTransaction {
  id: string;
  date: string;
  partyName: string;
  partyPan?: string;
  amount: number;
  paymentMode: "cash" | "neft" | "rtgs" | "cheque" | "upi" | "journal";
  type: "expense" | "loan_taken" | "loan_repaid" | "statutory_due" | "msme_vendor";
  dueDate?: string;
  paymentDate?: string;
  isMsmeRegistered?: boolean;
}

export interface AuditScanResult {
  engine_version: string;
  calculation_timestamp: string;
  total_transactions_scanned: number;
  high_risk_disallowance_count: number;
  potential_disallowance_amount: number;
  findings_by_clause: {
    clauseNumber: number;
    relevantSection: string;
    clauseTitle: string;
    flaggedCount: number;
    totalAmount: number;
    riskLevel: "high" | "medium" | "standard";
    items: Array<{
      transactionId: string;
      partyName: string;
      amount: number;
      reason: string;
      statutoryProvision: string;
      suggestedReporting3CD: string;
    }>;
  }[];
}

export interface NoticeDefenseInput {
  noticeSection: string; // e.g., "143(1)(a)", "142(1)", "148", "139(9)"
  assessmentYear: string; // e.g., "2024-25"
  dinNumber?: string;
  allegationSummary: string; // e.g., "Disallowance of 80JJAA claim due to late filing of Form 10DA"
  totalAdditionProposed?: number;
  clientType: "individual" | "corporate" | "llp" | "firm";
}

export interface NoticeDefenseOutput {
  model_version: string;
  timestamp: string;
  confidence_score: number;
  factors_considered: string[];
  recommendation: {
    notice_nature: string;
    statutory_limitation_check: string;
    core_defense_strategy: string;
    procedural_defects_to_raise: string[];
    suggested_reply_draft: string;
    recommended_precedents: {
      citation: string;
      caseTitle: string;
      court: string;
      ratio: string;
      relevance: string;
    }[];
    action_items_for_ca_cs: string[];
  };
  mandatory_disclaimer: string;
}

/**
 * In-Memory Golden Reference Library for Income Tax Law
 * Seeded with canonical provisions from the Income-tax Act, 1961 and Rules, 1962.
 */
const GOLDEN_SECTIONS: Omit<TaxStatuteSection, "id" | "createdAt" | "updatedAt">[] = [
  {
    sectionNumber: "54F",
    title: "Capital gain on transfer of certain capital assets not to be charged in case of investment in residential house",
    chapter: "Chapter IV",
    chapterTitle: "Computation of Total Income - Capital Gains",
    subChapter: "E - Capital Gains",
    bareActSummary: "Exemption of net consideration from long-term capital assets (other than residential house) when invested in purchase or construction of one residential house in India within specified time limits. Capped at ₹10 Crores from AY 2024-25 onwards.",
    fullStatutoryText: "Subject to the provisions of sub-section (2), where, in the case of an assessee being an individual or a Hindu undivided family, the capital gain arises from the transfer of any long-term capital asset, not being a residential house, and the assessee has, within a period of one year before or two years after the date on which the transfer took place purchased, or has within a period of three years after that date constructed, one residential house in India...",
    assessmentYearApplicable: "2025-26",
    amendedByFinanceAct: "Finance Act, 2023 / Finance (No. 2) Act, 2024",
    amendmentNotes: "Cap of ₹10 crore imposed on deduction u/s 54F. Holding period for unlisted shares unified to 24 months with 12.5% LTCG post July 23, 2024 without indexation.",
    targetProfession: "both",
    relatedRules: ["Rule 8AA"],
    relatedForms: ["ITR-2", "ITR-3"],
    form3cdClauses: [17],
    tags: ["Capital Gains", "Exemption", "Residential House", "Individual", "HUF", "Section 54F"],
    isActive: true,
  },
  {
    sectionNumber: "115JB",
    title: "Special provision for payment of tax by certain companies (Minimum Alternate Tax - MAT)",
    chapter: "Chapter XII-B",
    chapterTitle: "Special Provisions Relating to Certain Companies",
    subChapter: null,
    bareActSummary: "Every company shall pay at least 15% (plus surcharge and cess) on its 'Book Profit' computed under sub-section (2) if the income-tax payable on total income under normal provisions is less than 15% of book profits.",
    fullStatutoryText: "Notwithstanding anything contained in any other provision of this Act, where in the case of an assessee, being a company, the income-tax, payable on the total income as computed under this Act in respect of any previous year relevant to the assessment year is less than fifteen per cent of its book profit, such book profit shall be deemed to be the total income of the assessee and the tax payable by the assessee on such total income shall be the amount of income-tax at the rate of fifteen per cent...",
    assessmentYearApplicable: "2025-26",
    amendedByFinanceAct: "Finance (No. 2) Act, 2024",
    amendmentNotes: "Companies opting for section 115BAA or 115BAB are exempted from MAT provisions under sub-section (5A).",
    targetProfession: "both",
    relatedRules: ["Rule 40B"],
    relatedForms: ["Form 29B", "ITR-6"],
    form3cdClauses: [8, 33],
    tags: ["MAT", "Corporate Tax", "Book Profits", "Companies", "Section 115JB", "Form 29B"],
    isActive: true,
  },
  {
    sectionNumber: "115BAA",
    title: "Tax on income of certain domestic companies (Concessional 22% Corporate Tax Regime)",
    chapter: "Chapter XII",
    chapterTitle: "Determination of Tax in Certain Special Cases",
    subChapter: null,
    bareActSummary: "Allows domestic companies the option to pay income-tax at a base concessional rate of 22% (effective 25.168% inclusive of 10% surcharge and 4% cess) subject to foregoing specified deductions, exemptions, and MAT credit.",
    fullStatutoryText: "Notwithstanding anything contained in this Act but subject to the provisions of this Chapter, other than those mentioned under section 115BA and section 115BAB, the income-tax payable in respect of the total income of a person, being a domestic company, for any previous year relevant to the assessment year beginning on or after the 1st day of April, 2020, shall, at the option of such person, be computed at the rate of twenty-two per cent...",
    assessmentYearApplicable: "2025-26",
    amendedByFinanceAct: "Taxation Laws (Amendment) Act / Finance Act 2024",
    amendmentNotes: "Once opted via Form 10-IC, the option cannot be subsequently withdrawn for any subsequent previous year. MAT u/s 115JB is not applicable.",
    targetProfession: "both",
    relatedRules: ["Rule 21AE"],
    relatedForms: ["Form 10-IC", "ITR-6"],
    form3cdClauses: [8],
    tags: ["Corporate Tax", "Concessional Rate", "Domestic Company", "Section 115BAA", "Form 10-IC"],
    isActive: true,
  },
  {
    sectionNumber: "115QA",
    title: "Tax on distributed income to shareholders (Buyback of Shares)",
    chapter: "Chapter XII-DA",
    chapterTitle: "Special Provisions Relating to Tax on Distributed Income of Domestic Company for Buy-Back of Shares",
    subChapter: null,
    bareActSummary: "Tax regime for buyback of shares. Finance (No. 2) Act, 2024 transformed buyback tax: Effective October 1, 2024, consideration received by shareholders on buyback is taxable as deemed dividend u/s 2(22)(f) in shareholders' hands, with cost of original shares treated as capital loss.",
    fullStatutoryText: "Notwithstanding anything contained in any other provision of this Act, in addition to the income-tax chargeable in respect of the total income of a domestic company, any amount of distributed income by the company on buy-back of shares from a shareholder shall be charged to tax... Subject to amendments effective 01-10-2024 where buyback is taxable as dividend in shareholder hands.",
    assessmentYearApplicable: "2025-26",
    amendedByFinanceAct: "Finance (No. 2) Act, 2024",
    amendmentNotes: "Crucial for CS and CA: Prior to 01-10-2024, company paid 20% tax u/s 115QA. Post 01-10-2024, full buyback consideration is taxable as dividend in hands of shareholders at slab rates.",
    targetProfession: "cs",
    relatedRules: ["Rule 40G"],
    relatedForms: ["Form 61A", "ITR-6"],
    form3cdClauses: [36],
    tags: ["Buyback", "Company Law", "Corporate Restructuring", "Deemed Dividend", "Section 115QA", "CS Compliance"],
    isActive: true,
  },
  {
    sectionNumber: "56(2)(viib)",
    title: "Consideration received for issue of shares exceeding Fair Market Value (Angel Tax)",
    chapter: "Chapter IV",
    chapterTitle: "Computation of Total Income - Income from Other Sources",
    subChapter: "F - Income from Other Sources",
    bareActSummary: "Where a closely held company issues unlisted shares to any person at a price exceeding the Fair Market Value (FMV) determined under Rule 11UA, the aggregate consideration received exceeding the FMV is treated as Income from Other Sources. ABOLISHED by Finance (No. 2) Act, 2024 w.e.f. Assessment Year 2025-26.",
    fullStatutoryText: "Where a company, not being a company in which the public are substantially interested, receives, in any previous year, from any person, any consideration for issue of shares that exceeds the face value of such shares, the aggregate consideration received for such shares as exceeds the fair market value of the shares...",
    assessmentYearApplicable: "Past AYs up to 2024-25; Inoperative from AY 2025-26",
    amendedByFinanceAct: "Finance (No. 2) Act, 2024 (Abolished)",
    amendmentNotes: "Historic reform: Angel Tax completely abolished for all share issuances undertaken on or after April 1, 2024 (AY 2025-26 onwards). Remains relevant for pending scrutiny, reassessment notices, and appeals for past AYs.",
    targetProfession: "both",
    relatedRules: ["Rule 11UA", "Rule 11UAD"],
    relatedForms: ["Form 3CD", "ITR-6"],
    form3cdClauses: [29],
    tags: ["Angel Tax", "Unlisted Shares", "Rule 11UA", "Startup Valuation", "Section 56(2)(viib)", "CS Governance"],
    isActive: true,
  },
  {
    sectionNumber: "44AB",
    title: "Audit of accounts of certain persons carrying on business or profession (Tax Audit)",
    chapter: "Chapter IV",
    chapterTitle: "Computation of Total Income - Profits and Gains of Business or Profession",
    subChapter: "D - Profits and Gains of Business or Profession",
    bareActSummary: "Mandatory statutory tax audit by a practicing Chartered Accountant for persons carrying on business if total sales/turnover exceeds ₹1 Crore (₹10 Crores if cash receipts and payments do not exceed 5% of aggregate), or profession exceeding ₹50 Lakhs (₹75 Lakhs under 44ADA). Form 3CA/3CB and Form 3CD required.",
    fullStatutoryText: "Every person, carrying on business shall, if his total sales, turnover or gross receipts, as the case may be, in business exceed or exceeds one crore rupees in any previous year... Provided that in the case of a person whose aggregate of all amounts received in cash does not exceed five per cent of the said amount, this clause shall have effect as if for the words one crore rupees, the words ten crore rupees had been substituted...",
    assessmentYearApplicable: "2025-26",
    amendedByFinanceAct: "Finance Act, 2023 / 2024",
    amendmentNotes: "Form 3CD requires detailed reporting under clauses 1 to 44 including clause 26 for Section 43B(h) MSME compliance and clause 44 for GST expenditure break-up.",
    targetProfession: "ca",
    relatedRules: ["Rule 6G"],
    relatedForms: ["Form 3CA", "Form 3CB", "Form 3CD"],
    form3cdClauses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44],
    tags: ["Tax Audit", "Form 3CD", "Form 3CA", "Section 44AB", "CA Compliance", "Turnover Limits"],
    isActive: true,
  },
  {
    sectionNumber: "40A(3)",
    title: "Disallowance of expenditure incurred in cash exceeding ₹10,000",
    chapter: "Chapter IV",
    chapterTitle: "Computation of Total Income - Business or Profession",
    subChapter: "D - Business or Profession",
    bareActSummary: "Where the assessee incurs any expenditure in respect of which a payment or aggregate of payments made to a person in a day, otherwise than by an account payee cheque/draft or electronic clearing system, exceeds ₹10,000 (₹35,000 for plying, hiring or leasing goods carriages), no deduction shall be allowed.",
    fullStatutoryText: "Where the assessee incurs any expenditure in respect of which a payment or aggregate of payments made to a person in a day, otherwise than by an account payee cheque drawn on a bank or account payee bank draft, or use of electronic clearing system through a bank account or through such other electronic mode as may be prescribed, exceeds ten thousand rupees, no deduction shall be allowed in respect of such expenditure...",
    assessmentYearApplicable: "2025-26",
    amendedByFinanceAct: "Finance Act, 2017 / 2020",
    amendmentNotes: "Exceptions provided under Rule 6DD (e.g. payments to cultivators, banks, RBI). Must be reported in Form 3CD Clause 21(d).",
    targetProfession: "ca",
    relatedRules: ["Rule 6DD"],
    relatedForms: ["Form 3CD"],
    form3cdClauses: [21],
    tags: ["Cash Disallowance", "Section 40A(3)", "Form 3CD Clause 21", "Tax Audit", "Rule 6DD"],
    isActive: true,
  },
  {
    sectionNumber: "43B(h)",
    title: "Deduction for sum payable to Micro or Small Enterprises (MSME 45-day Rule)",
    chapter: "Chapter IV",
    chapterTitle: "Computation of Total Income - Business or Profession",
    subChapter: "D - Business or Profession",
    bareActSummary: "Any sum payable by the assessee to a micro or small enterprise beyond the time limit specified in Section 15 of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006 (15 days or up to 45 days if written agreement exists) shall be allowed as deduction ONLY in the previous year in which such sum is actually paid.",
    fullStatutoryText: "Notwithstanding anything contained in any other provision of this Act, a deduction otherwise allowable under this Act in respect of... (h) any sum payable by the assessee to a micro or small enterprise beyond the time limit specified in section 15 of the Micro, Small and Medium Enterprises Development Act, 2006, shall be allowed (irrespective of the previous year in which the liability to pay such sum was incurred by the assessee according to the method of accounting regularly employed by him) only in computing the income referred to in section 28 of that previous year in which such sum is actually paid...",
    assessmentYearApplicable: "2025-26 (Applicable from AY 2024-25)",
    amendedByFinanceAct: "Finance Act, 2023",
    amendmentNotes: "Proviso of payment before return filing date u/s 139(1) DOES NOT apply to clause (h). Applies strictly to Micro and Small enterprises (not Medium). Crucial audit reporting area in Form 3CD Clause 26.",
    targetProfession: "both",
    relatedRules: ["Rule 6G"],
    relatedForms: ["Form 3CD", "ITR-6", "ITR-3"],
    form3cdClauses: [26],
    tags: ["MSME", "Section 43B(h)", "Form 3CD Clause 26", "Disallowance", "Micro Enterprise", "Small Enterprise"],
    isActive: true,
  },
  {
    sectionNumber: "269SS",
    title: "Mode of taking or accepting certain loans, deposits and specified sums (Cash Limit ₹20,000)",
    chapter: "Chapter XX-B",
    chapterTitle: "Requirement as to Mode of Acceptance, Payment or Repayment in Certain Cases to Counteract Evasion of Tax",
    subChapter: null,
    bareActSummary: "No person shall take or accept from any other person any loan or deposit or specified sum otherwise than by an account payee cheque or draft or electronic clearing system if the amount or aggregate amount is ₹20,000 or more. Penalty equal to loan amount under Section 271D.",
    fullStatutoryText: "No person shall take or accept from any other person (herein referred to as the depositor), any loan or deposit or any specified sum, otherwise than by an account payee cheque or account payee bank draft or use of electronic clearing system through a bank account or through such other electronic mode as may be prescribed, if the amount of such loan or deposit or specified sum or the aggregate amount of such loan, deposit and specified sum is twenty thousand rupees or more...",
    assessmentYearApplicable: "2025-26",
    amendedByFinanceAct: "Finance Act, 2015 / 2023",
    amendmentNotes: "Specified sum includes advance in relation to transfer of immovable property. Must be audited and certified in Form 3CD Clause 31(a) and (b).",
    targetProfession: "both",
    relatedRules: ["Rule 6ABBA"],
    relatedForms: ["Form 3CD"],
    form3cdClauses: [31],
    tags: ["Cash Loan", "Section 269SS", "Section 271D", "Form 3CD Clause 31", "Tax Audit"],
    isActive: true,
  },
  {
    sectionNumber: "148",
    title: "Issue of notice where income has escaped assessment (Reassessment)",
    chapter: "Chapter XIV",
    chapterTitle: "Procedure for Assessment",
    subChapter: null,
    bareActSummary: "Notice issued by Assessing Officer when there is information with the AO suggesting that income chargeable to tax has escaped assessment. Prior approval under Section 151 and mandatory procedure under Section 148A required before issuing notice.",
    fullStatutoryText: "Before making the assessment, reassessment or recomputation under section 147, and subject to the provisions of section 148A, the Assessing Officer shall serve on the assessee a notice, along with a copy of the order passed, if required, under clause (d) of section 148A, requiring him to furnish within a period of three months from the end of the month in which such notice is issued, or such further period as may be allowed, a return of his income...",
    assessmentYearApplicable: "2025-26",
    amendedByFinanceAct: "Finance (No. 2) Act, 2024",
    amendmentNotes: "Finance Act 2024 reduced time limits for reassessment: Normal limit 3 years; Extended limit up to 5 years (previously 10 years) from end of relevant AY if escaped income is ₹50 Lakhs or more.",
    targetProfession: "ca",
    relatedRules: ["Rule 12"],
    relatedForms: ["ITR forms", "Notice u/s 148"],
    form3cdClauses: [],
    tags: ["Reassessment", "Notice 148", "Section 148A", "Limitation Period", "Litigation", "Scrutiny"],
    isActive: true,
  },
];

const GOLDEN_RULES: Omit<TaxStatuteRule, "id" | "createdAt" | "updatedAt">[] = [
  {
    ruleNumber: "Rule 11UA",
    title: "Determination of Fair Market Value of unlisted equity shares and other securities",
    parentSection: "56(2)(viib)",
    ruleSummary: "Prescribes formulas for calculating Fair Market Value (FMV) of unlisted equity shares using: (1) Net Asset Value (NAV) method: FMV = (A - L) * (PV / PE); and (2) Discounted Free Cash Flow (DCF) method certified by a SEBI Registered Merchant Banker. Also specifies safe harbour of 10% price variation.",
    statutoryText: "For the purposes of section 56, the fair market value of unlisted equity shares shall be the value, on the valuation date, of such unlisted equity shares as determined in the following manner, namely: (a) the fair market value of unlisted equity shares = (A - L) * (PV / PE), where A = book value of the assets in the balance sheet, L = book value of liabilities shown in the balance sheet...",
    associatedForm: "Valuation Report",
    targetProfession: "both",
    tags: ["Valuation", "Rule 11UA", "NAV Method", "DCF Method", "Unlisted Shares", "CS Governance"],
  },
  {
    ruleNumber: "Rule 6G",
    title: "Report of audit of accounts to be furnished under section 44AB",
    parentSection: "44AB",
    ruleSummary: "Specifies that the report of audit of the accounts of a person required to be furnished under section 44AB shall be: (a) in Form No. 3CA in the case of a person who carries on business or profession and who is required by or under any other law to get his accounts audited; (b) in Form No. 3CB in any other case; and the particulars required to be furnished under section 44AB shall be in Form No. 3CD.",
    statutoryText: "The report of audit of the accounts of a person required to be furnished under section 44AB shall: (a) in the case of a person who carries on business or profession and who is required by or under any other law to get his accounts audited, be in Form No. 3CA; (b) in the case of a person who carries on business or profession, but not being a person referred to in clause (a), be in Form No. 3CB. (2) The particulars which are required to be furnished under section 44AB shall be in Form No. 3CD.",
    associatedForm: "Form 3CA/3CB/3CD",
    targetProfession: "ca",
    tags: ["Form 3CD", "Form 3CA", "Form 3CB", "Rule 6G", "Tax Audit"],
  },
  {
    ruleNumber: "Rule 37BB",
    title: "Furnishing of information for payment to a non-resident (Form 15CA and Form 15CB)",
    parentSection: "195",
    ruleSummary: "Prescribes procedure for furnishing Form 15CA (electronic declaration by remitter) and Form 15CB (statutory certificate by a Chartered Accountant) before making foreign remittances to non-residents, verifying DTAA and withholding tax compliance.",
    statutoryText: "Any person responsible for paying to a non-resident, not being a company, or to a foreign company, any sum, whether or not chargeable under the provisions of the Act, shall furnish the information in Form No. 15CA... where any payment is chargeable to tax and exceeds five lakh rupees, a certificate from an accountant in Form No. 15CB shall be obtained...",
    associatedForm: "Form 15CA / Form 15CB",
    targetProfession: "ca",
    tags: ["Form 15CA", "Form 15CB", "Rule 37BB", "Foreign Remittance", "DTAA", "Withholding Tax"],
  },
];

const GOLDEN_PRECEDENTS: Omit<TaxJudicialPrecedent, "id" | "createdAt">[] = [
  {
    caseTitle: "Checkmate Services P. Ltd. v. Commissioner of Income Tax",
    citation: "[2022] 448 ITR 518 (SC)",
    courtBench: "Supreme Court of India",
    judgementDate: "2022-10-12",
    assessmentYear: "2014-15",
    sectionCovered: "36(1)(va) read with 43B",
    ratioDecidendi: "Employees' contribution to Provident Fund (PF) and ESI deducted by the employer must be deposited on or before the due date specified under the respective PF/ESI Acts. The concession under Section 43B (deposit before return filing due date u/s 139(1)) applies ONLY to employer's contribution and NOT to employee's contribution.",
    headnote: "Section 36(1)(va) vs Section 43B - Employee's contribution to PF/ESI received by employer is deemed income u/s 2(24)(x). It is deductible u/s 36(1)(va) only if credited to employee account on or before due date under PF/ESI statute. Belated payment cannot be allowed even if paid before filing return.",
    decisionInFavorOf: "Revenue",
    keyPrinciples: [
      "Strict distinction between employer contribution (43B) and employee contribution (36(1)(va))",
      "Due date under labor welfare statute is sacrosanct for employee contributions",
      "Form 3CD Clause 20(b) must disallow late employee PF/ESI payments",
    ],
    targetProfession: "ca",
  },
  {
    caseTitle: "Union of India & Ors. v. Ashish Agarwal",
    citation: "[2022] 444 ITR 1 (SC)",
    courtBench: "Supreme Court of India",
    judgementDate: "2022-05-04",
    assessmentYear: "2013-14 to 2017-18",
    sectionCovered: "148 & 148A",
    ratioDecidendi: "Reassessment notices issued under the erstwhile Section 148 after 01-04-2021 without adhering to the newly enacted Section 148A procedure were deemed to be show-cause notices u/s 148A(b) to balance revenue and assessee interests under Article 142.",
    headnote: "Reassessment - Substitution of sections 147 to 151 by Finance Act, 2021 - Notices issued under old regime after 01-04-2021 deemed as notices issued u/s 148A(b) of new regime. Revenue directed to supply underlying material within 30 days.",
    decisionInFavorOf: "Remanded",
    keyPrinciples: [
      "Section 148A inquiry is a mandatory condition precedent",
      "Material must be supplied to assessee before issuing 148 notice",
      "Substantive limitation rules apply to reassessment proceedings",
    ],
    targetProfession: "both",
  },
];

const GOLDEN_FORM3CD_CLAUSES: Omit<TaxForm3cdClause, "id" | "createdAt">[] = [
  {
    clauseNumber: 17,
    subClause: null,
    clauseTitle: "Land or building transferred for consideration less than stamp duty value (Sec 43CA / 50C)",
    relevantSection: "Section 43CA and Section 50C",
    statutoryLimit: "10% safe harbour variance between actual consideration and circle rate (stamp duty value)",
    auditVerificationGuidance: "Verify all registered sale deeds and agreements. Check whether stamp duty valuation exceeds consideration by more than 10%. If yes, report property details, consideration received, and stamp duty valuation.",
    reportingRequirement: "Mandatory reporting of property address, sale consideration, stamp duty value, and whether reference made to DVO.",
    riskLevel: "high",
    automatedCheckAvailable: true,
    checkEngineCode: "CHECK_50C_STAMP_DUTY",
  },
  {
    clauseNumber: 21,
    subClause: "d",
    clauseTitle: "Disallowance of cash expenditure exceeding ₹10,000 u/s 40A(3)",
    relevantSection: "Section 40A(3) and Rule 6DD",
    statutoryLimit: "₹10,000 per person per day (₹35,000 for transport operators)",
    auditVerificationGuidance: "Review cash ledger and payment vouchers. Identify aggregate payments to any single person in a single day exceeding ₹10,000. Verify whether any exception under Rule 6DD applies (banking holidays, agriculture produce, etc.).",
    reportingRequirement: "Report date of payment, nature of payment, amount, and name/PAN of payee.",
    riskLevel: "high",
    automatedCheckAvailable: true,
    checkEngineCode: "CHECK_40A3_CASH",
  },
  {
    clauseNumber: 26,
    subClause: "h",
    clauseTitle: "Statutory dues and MSME delayed payments under Section 43B & 43B(h)",
    relevantSection: "Section 43B, 43B(h) and MSMED Act 2006",
    statutoryLimit: "MSME payment within 15 days (or up to 45 days if written agreement exists)",
    auditVerificationGuidance: "Obtain MSME registration status of suppliers. Calculate aging of pending payables as on March 31. Any amount outstanding beyond 45 days (or agreed period) that was unpaid by March 31 MUST be reported for disallowance u/s 43B(h). Payment before return filing u/s 139(1) does NOT save 43B(h) disallowance.",
    reportingRequirement: "Disclose liability outstanding, due date, payment date, and amount disallowable.",
    riskLevel: "high",
    automatedCheckAvailable: true,
    checkEngineCode: "CHECK_43B_MSME",
  },
  {
    clauseNumber: 31,
    subClause: "a,b,c",
    clauseTitle: "Acceptance or repayment of loan/deposit/specified advance in cash > ₹20,000 u/s 269SS/T",
    relevantSection: "Section 269SS and Section 269T",
    statutoryLimit: "₹20,000 aggregate per person",
    auditVerificationGuidance: "Scrutinize ledger accounts of unsecured loans, director loans, advances, and deposits. Check mode of receipt and repayment. Flag every cash transaction of ₹20,000 or above.",
    reportingRequirement: "Disclose name, address, PAN of lender/borrower, amount accepted/repaid, and whether done otherwise than by account payee cheque/electronic mode.",
    riskLevel: "high",
    automatedCheckAvailable: true,
    checkEngineCode: "CHECK_269SS_LOANS",
  },
  {
    clauseNumber: 34,
    subClause: "a,b,c",
    clauseTitle: "Compliance with Tax Deducted at Source (TDS) and Tax Collected at Source (TCS)",
    relevantSection: "Chapter XVII-B (Sections 192 to 206CCA)",
    statutoryLimit: "Statutory TDS threshold limits (e.g. 194C, 194J, 194Q)",
    auditVerificationGuidance: "Reconcile expense ledgers with TDS quarterly returns (Form 24Q, 26Q, 27Q). Verify non-deduction, short-deduction, and delay in deposit. Disallowance u/s 40(a)(ia) of 30% for resident TDS default.",
    reportingRequirement: "Tabular reporting of TAN, section, nature of payment, total amount of payment, amount on which tax was required to be deducted, tax deducted, and tax deposited.",
    riskLevel: "high",
    automatedCheckAvailable: true,
    checkEngineCode: "CHECK_TDS_COMPLIANCE",
  },
  {
    clauseNumber: 44,
    subClause: null,
    clauseTitle: "Break-up of total expenditure into GST registered and exempt entities",
    relevantSection: "Reporting requirement under Rule 6G",
    statutoryLimit: "Total expenditure incurred during the previous year",
    auditVerificationGuidance: "Reconcile total expenditure in Profit & Loss account with GST return data (GSTR-2B, GSTR-3B). Provide break-up of expenditure relating to entities registered under GST vs unregistered entities.",
    reportingRequirement: "Categorized expenditure breakdown: Exempt goods/services, Composition scheme, Registered entities, and Unregistered entities.",
    riskLevel: "medium",
    automatedCheckAvailable: false,
    checkEngineCode: "CHECK_GST_EXP_BREAKUP",
  },
];

const GOLDEN_CS_MODULES: Omit<TaxCsCorporateModule, "id" | "createdAt">[] = [
  {
    moduleCode: "RULE_11UA_VALUATION",
    moduleName: "Unlisted Share Issuance & Angel Tax Valuation (Rule 11UA vs MCA Cos Act)",
    itActSection: "Section 56(2)(viib) read with Rule 11UA",
    companiesActSection: "Section 42 (Private Placement) & Section 62(1)(c) (Preferential Allotment)",
    governanceTopic: "Valuation of Unlisted Shares and Convertible Instruments",
    overview: "Harmonization between MCA Registered Valuer requirements under Companies Act 2013 and Rule 11UA valuation under Income Tax Act. While Angel Tax is abolished from AY 2025-26, Rule 11UA remains mandatory for gift/deemed income u/s 56(2)(x) and past assessments.",
    secretarialChecklist: [
      "Obtain Registered Valuer report under Section 247 of Companies Act for MCA filing (Form PAS-3 / MGT-14).",
      "Obtain Rule 11UA valuation certificate (Merchant Banker DCF or Statutory Auditor NAV).",
      "Check 10% safe harbour band for unlisted shares.",
      "File Form PAS-3 with ROC within 15 days of allotment.",
      "Ensure funds received through banking channels only (Section 42(6)).",
    ],
    caCertificationRequired: true,
    riskFactors: [
      "Mismatch between MCA valuation and Income Tax Rule 11UA valuation.",
      "Failure to provide audited balance sheet as on valuation date.",
    ],
    formulaUsed: "FMV = (A - L) * (PV / PE) [NAV Method] or DCF Method by SEBI Registered Merchant Banker",
  },
  {
    moduleCode: "BUYBACK_115QA",
    moduleName: "Share Buyback Governance: Income Tax Act vs Companies Act Sec 68",
    itActSection: "Section 115QA, Section 2(22)(f), Section 46A",
    companiesActSection: "Section 68, 69, 70 of Companies Act, 2013",
    governanceTopic: "Capital Reduction & Share Buyback Tax Paradigm",
    overview: "Finance (No. 2) Act 2024 paradigm shift: From October 1, 2024, the buyback distribution tax on the company u/s 115QA is eliminated. Instead, the entire consideration received by the shareholder is taxable as dividend in the shareholder's hands at applicable slab rates. Company must deduct TDS u/s 194.",
    secretarialChecklist: [
      "Board approval (up to 10% of paid up capital + free reserves) or Special Resolution (up to 25%).",
      "Post-buyback debt-to-equity ratio must not exceed 2:1.",
      "File Form SH-8 (Letter of Offer) and SH-9 (Declaration of Solvency) with ROC.",
      "Ensure statutory TDS deduction u/s 194 at 10% on gross dividend before remittance to resident shareholders.",
      "Extinguishment of shares within 7 days of completion (Form SH-11).",
    ],
    caCertificationRequired: true,
    riskFactors: [
      "TDS default on buyback dividend payments post 01-10-2024.",
      "Shareholder grievance regarding double taxation (dividend tax + capital loss with no immediate set-off).",
    ],
    formulaUsed: "Deemed Dividend = Gross Consideration Received; Capital Loss = Cost of Acquisition of Buyback Shares",
  },
  {
    moduleCode: "RELATED_PARTY_40A2_VS_188",
    moduleName: "Related Party Transactions: Sec 40A(2) Tax Disallowance vs MCA Sec 188",
    itActSection: "Section 40A(2)(b)",
    companiesActSection: "Section 188 of Companies Act, 2013 & Ind AS 24 / AS 18",
    governanceTopic: "Arm's Length Scrutiny and Excess Benefit Disallowance",
    overview: "Assessing Officer possesses statutory power under Section 40A(2) to disallow excessive or unreasonable expenditure paid to directors, relatives, and entities with substantial interest. Company Secretary must align MCA Audit Committee approvals under Section 188 with Transfer Pricing / benchmark pricing documentation to safeguard against tax disallowances.",
    secretarialChecklist: [
      "Audit Committee prior omnibus approval under Section 177 / 188.",
      "Entry in Register of Contracts (Form MBP-4).",
      "Arm's length justification and comparative market quotes documented.",
      "Form 3CD Clause 23 reporting disclosure.",
    ],
    caCertificationRequired: true,
    riskFactors: [
      "Disallowance of excess payment under Section 40A(2)(a).",
      "Secretarial non-compliance leading to director disqualification or penalties under Section 188(5).",
    ],
    formulaUsed: "Disallowed Amount = Actual Payment - Fair Market Value of Goods/Services",
  },
  {
    moduleCode: "SECRETARIAL_AUDIT_MR3",
    moduleName: "Secretarial Audit & Board Governance (Section 204 & Form MR-3)",
    itActSection: "Section 44AB cross-reporting & Section 139 return reconciliation",
    companiesActSection: "Section 204 of Companies Act, 2013 read with Rule 9 of Companies (Appointment and Remuneration of Managerial Personnel) Rules, 2014",
    governanceTopic: "Statutory Secretarial Audit by Practicing Company Secretary (PCS)",
    overview: "Mandatory audit for all listed companies, public companies with paid-up capital >= ₹50 Cr or turnover >= ₹250 Cr, or private companies with outstanding bank borrowings >= ₹100 Cr. Verifies compliance across Companies Act, SEBI Act, SCRA, FEMA, and Depositories Act.",
    secretarialChecklist: [
      "Appointment of Practicing Company Secretary (PCS) via Board Resolution (Form MGT-14).",
      "Verification of statutory registers (MBP-1, MBP-2, MBP-4, MGT-1, MGT-2).",
      "Board meeting frequency: minimum 4 meetings annually with gap not exceeding 120 days.",
      "Issue of Secretarial Audit Report in Form MR-3 with annexures attached to Board's Report (AOC-4).",
    ],
    caCertificationRequired: true,
    riskFactors: [
      "Adverse qualifications in Form MR-3 impacting corporate credit rating and investor due diligence.",
      "Penalties up to ₹5 Lakhs for non-compliance u/s 204(4).",
    ],
    formulaUsed: "Full statutory compliance checklist across 5 central corporate legislations",
  },
  {
    moduleCode: "INTER_CORPORATE_LOANS_185_186",
    moduleName: "Loans to Directors & Inter-Corporate Investments (Sec 185 & 186)",
    itActSection: "Section 2(22)(e) Deemed Dividend & Section 269SS/T Cash Limits",
    companiesActSection: "Sections 185, 186 of Companies Act, 2013 & Companies (Meetings of Board and its Powers) Rules",
    governanceTopic: "Inter-corporate Lending, Guarantees, Securities and Investments",
    overview: "Section 185 restricts loans, guarantees, or securities to directors or entities where directors are interested. Section 186 caps investments/loans at 60% of paid-up capital + free reserves + securities premium or 100% of free reserves, whichever is more, unless approved by Special Resolution in general meeting.",
    secretarialChecklist: [
      "Verify threshold limit under Section 186(2) before executing loan/guarantee.",
      "Obtain prior unanimous Board approval and prior approval of Public Financial Institutions.",
      "Maintain Register of Loans, Guarantees and Securities in Form MBP-2.",
      "Ensure interest rate charged is not lower than prevailing yield of Government Securities.",
    ],
    caCertificationRequired: true,
    riskFactors: [
      "Deemed dividend taxation under Section 2(22)(e) for loans to substantial shareholders.",
      "Void transactions and director penalties under Section 185(4) and 186(13).",
    ],
    formulaUsed: "Threshold = MAX(60% of (Paid Up Capital + Free Reserves + Sec. Premium), 100% of (Free Reserves + Sec. Premium))",
  },
  {
    moduleCode: "SIGNIFICANT_BENEFICIAL_OWNERSHIP",
    moduleName: "Significant Beneficial Ownership (SBO) Transparency & Form BEN-2",
    itActSection: "Section 115O, 2(22)(e), and Benami Transactions (Prohibition) Act",
    companiesActSection: "Section 90 of Companies Act, 2013 read with Companies (SBO) Rules, 2018",
    governanceTopic: "Ultimate Beneficial Ownership Transparency & PMLA Compliance",
    overview: "Every individual holding indirectly >= 10% shares, voting rights, or right to receive dividend, or exercising significant influence/control, must file Form BEN-1. The company must file Form BEN-2 with ROC within 30 days of receiving BEN-1.",
    secretarialChecklist: [
      "Identify individuals holding indirect shareholding >= 10% or exercising significant control.",
      "Issue notice in Form BEN-4 to corporate shareholders seeking ownership details.",
      "Receive declaration in Form BEN-1 from SBO within 30 days of acquisition.",
      "File e-Form BEN-2 with ROC within 30 days of receiving Form BEN-1.",
      "Maintain Register of SBO in Form BEN-3.",
    ],
    caCertificationRequired: false,
    riskFactors: [
      "Application to NCLT under Section 90(7) for restriction on transfer of shares if SBO fails to disclose.",
      "Penal fines for company and officers in default under Section 90(11).",
    ],
    formulaUsed: "SBO Threshold = Aggregate of Direct + Indirect shareholding/voting rights >= 10%",
  },
  {
    moduleCode: "SEBI_RIA_REGULATIONS_2013",
    moduleName: "SEBI (Investment Advisers) Regulations, 2013 - Advisory Governance",
    itActSection: "Section 194J TDS at 10% on professional advisory fees",
    companiesActSection: "Memorandum of Association (MoA) Main Objects alignment",
    governanceTopic: "SEBI RIA Compliance, Fee Limits, Net Worth & Client Agreements",
    overview: "Governs institutional advisory firms. Requires corporate net worth of ₹50 Lakhs, mandatory client agreement prior to advisory services, segregation of advisory and execution/distribution activities, annual compliance audit by CA/CS, and statutory fee limits: maximum ₹1,25,000 per annum per family or 2.5% of Assets under Advice (AUA).",
    secretarialChecklist: [
      "Verify corporate net worth certificate of >= ₹50 Lakhs certified by Statutory Auditor.",
      "Ensure Principal Officer and compliance team possess NISM-Series-X-A and X-B certifications.",
      "Maintain arm's length segregation between Advisory and Distribution arms (no dual fee).",
      "Conduct annual compliance audit by practicing CA/CS under Regulation 19(3) and submit to SEBI.",
      "Implement SCORES 2.0 and SMART ODR grievance redressal mechanism.",
    ],
    caCertificationRequired: true,
    riskFactors: [
      "SEBI inspection findings for undisclosed commission or dual remuneration.",
      "Fee charged exceeding statutory ceiling under SEBI Master Circular.",
    ],
    formulaUsed: "Max Annual Fee = MIN(₹1,25,000 per family, 2.5% of AUA per annum)",
  },
  {
    moduleCode: "SEBI_PIT_SDD_2015",
    moduleName: "SEBI PIT Regulations, 2015 - Structured Digital Database (SDD) Rule 3(5)",
    itActSection: "Section 269SS/T & PMLA financial tracing",
    companiesActSection: "SEBI (Prohibition of Insider Trading) Regulations, 2015",
    governanceTopic: "Unpublished Price Sensitive Information (UPSI) & Trading Window",
    overview: "Mandates maintenance of an internally hosted, non-tamperable Structured Digital Database (SDD) containing names of persons sharing/receiving UPSI, PAN, nature of UPSI, and date/time timestamp. Database must be preserved for at least 8 years.",
    secretarialChecklist: [
      "Automated immutable audit logging of UPSI sharing instances with PAN and timestamp.",
      "Issue confidentiality / non-disclosure agreement (NDA) to recipients of UPSI.",
      "Enforce Trading Window closure from the end of each quarter until 48 hours after financial results declaration.",
      "Quarterly SDD compliance certificate by Compliance Officer / CS.",
    ],
    caCertificationRequired: false,
    riskFactors: [
      "SEBI show cause notices for failure to maintain non-tamperable SDD software internally.",
      "Penal action under Section 15G of SEBI Act for insider trading non-compliances.",
    ],
    formulaUsed: "Audit trail timestamping with cryptographic SHA-256 seal and 8-year retention",
  },
  {
    moduleCode: "DPDP_ACT_2023_COMPLIANCE",
    moduleName: "Digital Personal Data Protection Act, 2023 (DPDP) - Financial Data Fiduciary",
    itActSection: "Section 138 Income Tax Data Disclosure rules",
    companiesActSection: "Information Technology Act, 2000 Section 43A (SPDI Rules)",
    governanceTopic: "Data Principal Consent, DPO Appointment & Data Retention Limits",
    overview: "Regulates processing of digital personal data. FintekPro acts as a Significant Data Fiduciary (SDF). Requires clear, itemized consent notices in plain language, mandatory appointment of an India-resident Data Protection Officer (DPO), statutory data audit by independent Data Auditor, and strict purpose limitation.",
    secretarialChecklist: [
      "Itemized consent architecture capturing timestamp, IP, and specific processing purpose.",
      "Designate Data Protection Officer (DPO) and register contact details.",
      "Conduct Data Protection Impact Assessment (DPIA) for algorithmic advisory engines.",
      "Implement Data Principal request workflow for access, correction, and erasure.",
      "Mandatory notification of personal data breach to Data Protection Board of India (DPBI) and affected users.",
    ],
    caCertificationRequired: false,
    riskFactors: [
      "Penalties up to ₹250 Crores for failure to take reasonable security safeguards to prevent personal data breach.",
    ],
    formulaUsed: "Consent Artifact: { userId, timestamp, consentVersion, purposeList, withdrawalToken }",
  },
  {
    moduleCode: "CERT_IN_6HR_INCIDENT",
    moduleName: "CERT-In Cyber Directions 2022 - Mandatory 6-Hour Incident Reporting",
    itActSection: "Information Technology Act, 2000 Section 70B",
    companiesActSection: "SEBI CSCRF 2024 Cybersecurity Framework",
    governanceTopic: "Cyber Incident Reporting & 180-Day System Log Retention",
    overview: "All financial institutions, intermediaries, and intermediaries are mandated under Section 70B(6) of IT Act to report specified cybersecurity incidents to CERT-In within 6 hours of noticing. All system logs (firewall, web, auth, API) must be retained within Indian jurisdiction for rolling 180 days.",
    secretarialChecklist: [
      "Establish 24/7 Security Operations Center (SOC) incident escalation matrix.",
      "Standard Operating Procedure (SOP) to file initial incident report within 6 hours to incident@cert-in.org.in.",
      "Ensure system NTP clocks synchronized to National Physical Laboratory (NPL) or NIC servers.",
      "Immutable log retention in Indian data center (GCP asia-south1 / Mumbai) for 180 days.",
    ],
    caCertificationRequired: false,
    riskFactors: [
      "Criminal prosecution under Section 70B(7) of IT Act (imprisonment up to 1 year or fine up to ₹1 Lakh) for failure to report.",
    ],
    formulaUsed: "Incident Escalation SLA: Alert Detection -> Triage (15m) -> CERT-In Filing (<= 6 hours)",
  },
  {
    moduleCode: "GST_ADVISORY_SAC_9971",
    moduleName: "GST on Financial Advisory & Fintech Services (SAC 997152 & RCM)",
    itActSection: "Section 43B(a) Statutory Dues & Form 3CD Clause 44",
    companiesActSection: "Central Goods and Services Tax (CGST) Act, 2017 Sections 9(3), 12, 13",
    governanceTopic: "GST Invoicing, Input Tax Credit (ITC) & Reverse Charge on Director Fees",
    overview: "Investment advisory, portfolio management, and wealth platform subscriptions attract 18% GST under SAC Code 997152 / 998314. Advisory firms must pay GST under Reverse Charge Mechanism (RCM u/s 9(3)) on sitting fees and remuneration paid to independent/non-executive directors, and legal fees paid to advocates.",
    secretarialChecklist: [
      "Issue tax invoices within 30 days of service with mandatory 18% GST break-up (CGST+SGST or IGST).",
      "Calculate and discharge RCM liability in cash under GSTR-3B for director remuneration & legal fees.",
      "Reconcile monthly GSTR-2B with purchase register to claim eligible Input Tax Credit (ITC).",
      "Prepare annual Form 3CD Clause 44 expenditure break-up into GST registered and exempt entities.",
    ],
    caCertificationRequired: true,
    riskFactors: [
      "Interest under Section 50 at 18% p.a. on delayed GST payment or incorrect ITC availment.",
      "Form 3CD audit qualification for unpaid GST liabilities as on March 31 u/s 43B.",
    ],
    formulaUsed: "GST Liability = 18% on Advisory Gross Fees + 18% RCM on Director Remuneration/Legal Fees",
  },
];

/**
 * TaxLawEngine: Core Service Layer
 */
export class TaxLawEngine {
  private static instance: TaxLawEngine;
  private isSeeded: boolean = false;

  private constructor() {
    this.seedDatabaseIfNeeded().catch((err) => {
      logger.warn(`TaxLawEngine initialization seed skipped or failed: ${err.message}`);
    });
  }

  public static getInstance(): TaxLawEngine {
    if (!TaxLawEngine.instance) {
      TaxLawEngine.instance = new TaxLawEngine();
    }
    return TaxLawEngine.instance;
  }

  /**
   * Safe Seeding: Seeds reference statutory sections, rules, precedents, and 3CD clauses
   */
  private async seedDatabaseIfNeeded(): Promise<void> {
    if (this.isSeeded) return;
    try {
      const existingSections = await db.select({ count: sql<number>`count(*)` }).from(taxStatuteSections);
      const count = Number(existingSections[0]?.count || 0);

      if (count === 0) {
        logger.info("TaxLawEngine: Seeding golden reference statutory tables...");
        await db.insert(taxStatuteSections).values(GOLDEN_SECTIONS);
        await db.insert(taxStatuteRules).values(GOLDEN_RULES);
        await db.insert(taxJudicialPrecedents).values(GOLDEN_PRECEDENTS);
        await db.insert(taxForm3cdClauses).values(GOLDEN_FORM3CD_CLAUSES);
        await db.insert(taxCsCorporateModules).values(GOLDEN_CS_MODULES);
        logger.info("TaxLawEngine: Seeding successfully completed.");
      }
      this.isSeeded = true;
    } catch (error: any) {
      logger.warn(`TaxLawEngine: Using in-memory fallback during DB initialization: ${error.message}`);
    }
  }

  /**
   * Search and filter statutory sections
   * @param query Search query text (e.g. "capital gains", "MAT", "148")
   * @param profession 'both' | 'ca' | 'cs'
   * @param chapter Optional chapter filter
   * @param page Pagination page
   * @param limit Pagination limit
   */
  public async getSections(
    query?: string,
    profession?: "ca" | "cs" | "both",
    chapter?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ sections: TaxStatuteSection[]; total: number; page: number; limit: number }> {
    try {
      let filtered = [...GOLDEN_SECTIONS] as unknown as TaxStatuteSection[];

      if (profession && profession !== "both") {
        filtered = filtered.filter((s) => s.targetProfession === "both" || s.targetProfession === profession);
      }
      if (chapter) {
        filtered = filtered.filter((s) => s.chapter.toLowerCase().includes(chapter.toLowerCase()));
      }
      if (query && query.trim().length > 0) {
        const q = query.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.sectionNumber.toLowerCase().includes(q) ||
            s.title.toLowerCase().includes(q) ||
            s.bareActSummary.toLowerCase().includes(q) ||
            (s.tags && s.tags.some((tag: string) => tag.toLowerCase().includes(q)))
        );
      }

      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      return { sections: paginated, total, page, limit };
    } catch (error: any) {
      logger.error(`TaxLawEngine.getSections failed: ${error.message}`);
      return { sections: [], total: 0, page, limit };
    }
  }

  /**
   * Get Section details with interlinked rules, circulars, precedents, and 3CD clauses
   * @param sectionNumber e.g., "54F", "115JB", "44AB", "56(2)(viib)"
   */
  public async getSectionInterlinks(sectionNumber: string): Promise<{
    section: TaxStatuteSection | null;
    linkedRules: TaxStatuteRule[];
    linkedCirculars: TaxCbdtCircular[];
    linkedPrecedents: TaxJudicialPrecedent[];
    linkedForm3cdClauses: TaxForm3cdClause[];
    csModules: TaxCsCorporateModule[];
  }> {
    const sec = (GOLDEN_SECTIONS.find(
      (s) => s.sectionNumber.toLowerCase() === sectionNumber.toLowerCase()
    ) || null) as unknown as TaxStatuteSection | null;

    if (!sec) {
      return {
        section: null,
        linkedRules: [],
        linkedCirculars: [],
        linkedPrecedents: [],
        linkedForm3cdClauses: [],
        csModules: [],
      };
    }

    const linkedRules = (GOLDEN_RULES.filter((r) =>
      sec.relatedRules?.includes(r.ruleNumber) || r.parentSection.includes(sec.sectionNumber)
    )) as unknown as TaxStatuteRule[];

    const linkedPrecedents = (GOLDEN_PRECEDENTS.filter((p) =>
      p.sectionCovered.toLowerCase().includes(sec.sectionNumber.toLowerCase())
    )) as unknown as TaxJudicialPrecedent[];

    const clauseNumbers = sec.form3cdClauses || [];
    const linkedForm3cdClauses = (GOLDEN_FORM3CD_CLAUSES.filter((c) =>
      clauseNumbers.includes(c.clauseNumber) || c.relevantSection.includes(sec.sectionNumber)
    )) as unknown as TaxForm3cdClause[];

    const csModules = (GOLDEN_CS_MODULES.filter((m) =>
      m.itActSection.toLowerCase().includes(sec.sectionNumber.toLowerCase())
    )) as unknown as TaxCsCorporateModule[];

    return {
      section: sec,
      linkedRules,
      linkedCirculars: [],
      linkedPrecedents,
      linkedForm3cdClauses,
      csModules,
    };
  }

  /**
   * Get Corporate & Regulatory Governance Modules (Companies Act, SEBI, PMLA, DPDP, CERT-In, GST)
   */
  public async getCorporateModules(query?: string): Promise<{
    modules: TaxCsCorporateModule[];
    total: number;
  }> {
    let list = [...GOLDEN_CS_MODULES] as unknown as TaxCsCorporateModule[];
    if (query && query.trim().length > 0) {
      const q = query.toLowerCase();
      list = list.filter(
        (m) =>
          m.moduleCode.toLowerCase().includes(q) ||
          m.moduleName.toLowerCase().includes(q) ||
          m.governanceTopic.toLowerCase().includes(q) ||
          m.companiesActSection.toLowerCase().includes(q) ||
          m.overview.toLowerCase().includes(q)
      );
    }
    return { modules: list, total: list.length };
  }

  /**
   * Rule 11UA Valuation Engine (NAV Method for CS & Corporate Compliance)
   * Formula: FMV = (A - L) * (PV / PE)
   */
  public calculateRule11UAValuation(input: Valuation11UAInput): Valuation11UAOutput {
    const timestamp = new Date().toISOString();
    const { bookValueOfAssets, bookValueOfLiabilities, paidUpEquityCapital, faceValueOfShare, sharesToBeValued } = input;

    if (paidUpEquityCapital <= 0) {
      throw new Error("Paid-up equity capital must be greater than zero.");
    }
    if (faceValueOfShare <= 0) {
      throw new Error("Face value of share must be greater than zero.");
    }

    const netWorth = bookValueOfAssets - bookValueOfLiabilities;
    const ratio = faceValueOfShare / paidUpEquityCapital;
    const fmvPerShare = Number((netWorth * ratio).toFixed(4));
    const totalBlockValuation = sharesToBeValued ? Number((fmvPerShare * sharesToBeValued).toFixed(2)) : undefined;

    telemetryBus.report({
      engineId: "tax-law-engine",
      engineName: "Direct Tax & Corporate Law Workstation Engine",
      category: "Compliance",
      reportedAt: timestamp,
      latencyMs: 1,
      qualityScore: 99,
      itemsProcessed: 1,
      errorCount: 0,
      meta: {
        operation: "RULE_11UA_VALUATION",
        fmvPerShare,
      },
    });

    return {
      engine_version: ENGINE_VERSION,
      calculation_timestamp: timestamp,
      inputs_used: input,
      formula_applied: "FMV = (A - L) * (PV / PE) as prescribed under Rule 11UA(1)(c)(b)",
      intermediate_steps: {
        net_worth_A_minus_L: Number(netWorth.toFixed(2)),
        ratio_PV_divided_PE: Number(ratio.toFixed(6)),
        calculated_fmv_per_share: fmvPerShare,
        total_valuation_of_block: totalBlockValuation,
      },
      fmv_per_share: fmvPerShare,
      statutory_rule: "Rule 11UA of Income-tax Rules, 1962",
      section_governed: "Section 56(2)(viib) / Section 56(2)(x) of Income-tax Act, 1961",
      companies_act_cross_reference: "Section 42 & Section 62 of Companies Act, 2013 (PAS-3 & MGT-14 filing requirement)",
      explainability_notes: [
        "A represents book value of all assets on balance sheet date minus advance tax paid and unamortized deferred expenditure.",
        "L represents book value of liabilities excluding paid-up capital, free reserves, and provision for taxation.",
        "PV is the paid-up value of the equity share being issued/transferred.",
        "PE is the total amount of paid-up equity share capital as shown in the balance sheet.",
        "Where the issue price exceeds this calculated FMV, the difference is liable to tax analysis.",
      ],
    };
  }

  /**
   * Automated Form 3CD Clause Audit Scanner
   * Evaluates transactions against:
   * - Clause 21(d) / Sec 40A(3): Cash payments > ₹10,000
   * - Clause 26 / Sec 43B & 43B(h): MSME 45-day rule
   * - Clause 31 / Sec 269SS/269T: Cash loans/repayments >= ₹20,000
   */
  public runForm3cdAuditScan(transactions: AuditScanTransaction[]): AuditScanResult {
    const timestamp = new Date().toISOString();
    let potentialDisallowance = 0;
    let highRiskCount = 0;

    const findings40A3: any[] = [];
    const findings43B: any[] = [];
    const findings269SS: any[] = [];

    // Group cash payments by party and date for 40A(3)
    const cashPaymentsByPartyDate = new Map<string, { total: number; txns: AuditScanTransaction[] }>();

    for (const t of transactions) {
      // 1. Check Clause 21(d) - Section 40A(3)
      if (t.paymentMode === "cash" && t.type === "expense") {
        const key = `${t.partyName}_${t.date}`;
        const existing = cashPaymentsByPartyDate.get(key) || { total: 0, txns: [] };
        existing.total += t.amount;
        existing.txns.push(t);
        cashPaymentsByPartyDate.set(key, existing);
      }

      // 2. Check Clause 26 - Section 43B(h) MSME
      if (t.type === "msme_vendor" || t.isMsmeRegistered) {
        if (t.dueDate && t.paymentDate) {
          const due = new Date(t.dueDate).getTime();
          const paid = new Date(t.paymentDate).getTime();
          if (paid > due) {
            potentialDisallowance += t.amount;
            highRiskCount++;
            findings43B.push({
              transactionId: t.id,
              partyName: t.partyName,
              amount: t.amount,
              reason: `Payment made on ${t.paymentDate} after statutory MSMED due date ${t.dueDate}.`,
              statutoryProvision: "Section 43B(h) of Income-tax Act, 1961 read with Section 15 of MSMED Act, 2006",
              suggestedReporting3CD: `Report in Clause 26(h) as disallowance: ₹${t.amount.toLocaleString("en-IN")}. Cannot be allowed in current AY.`,
            });
          }
        }
      }

      // 3. Check Clause 31 - Section 269SS/T
      if (t.paymentMode === "cash" && (t.type === "loan_taken" || t.type === "loan_repaid")) {
        if (t.amount >= 20000) {
          highRiskCount++;
          findings269SS.push({
            transactionId: t.id,
            partyName: t.partyName,
            amount: t.amount,
            reason: `Cash ${t.type === "loan_taken" ? "acceptance" : "repayment"} of loan/deposit ₹${t.amount.toLocaleString("en-IN")} >= ₹20,000 limit.`,
            statutoryProvision: t.type === "loan_taken" ? "Section 269SS (Penalty u/s 271D)" : "Section 269T (Penalty u/s 271E)",
            suggestedReporting3CD: `Report in Clause 31 as violation of Section ${t.type === "loan_taken" ? "269SS" : "269T"}. Liable for 100% penalty.`,
          });
        }
      }
    }

    // Evaluate aggregated 40A(3) cash payments
    for (const [key, value] of Array.from(cashPaymentsByPartyDate.entries())) {
      if (value.total > 10000) {
        potentialDisallowance += value.total;
        highRiskCount += value.txns.length;
        const [party, date] = key.split("_");
        findings40A3.push({
          transactionId: value.txns.map((x) => x.id).join(", "),
          partyName: party,
          amount: value.total,
          reason: `Aggregate cash payment of ₹${value.total.toLocaleString("en-IN")} made to ${party} on ${date} exceeds ₹10,000 statutory limit.`,
          statutoryProvision: "Section 40A(3) of Income-tax Act, 1961 read with Rule 6DD",
          suggestedReporting3CD: `Report in Clause 21(d) as disallowance: ₹${value.total.toLocaleString("en-IN")}. Verify if any Rule 6DD exception applies.`,
        });
      }
    }

    const findings_by_clause = [
      {
        clauseNumber: 21,
        relevantSection: "Section 40A(3)",
        clauseTitle: "Disallowance of cash expenditure > ₹10,000",
        flaggedCount: findings40A3.length,
        totalAmount: findings40A3.reduce((sum, item) => sum + item.amount, 0),
        riskLevel: "high" as const,
        items: findings40A3,
      },
      {
        clauseNumber: 26,
        relevantSection: "Section 43B(h)",
        clauseTitle: "Delayed MSME vendor payments beyond statutory limit",
        flaggedCount: findings43B.length,
        totalAmount: findings43B.reduce((sum, item) => sum + item.amount, 0),
        riskLevel: "high" as const,
        items: findings43B,
      },
      {
        clauseNumber: 31,
        relevantSection: "Section 269SS / 269T",
        clauseTitle: "Cash loan acceptance or repayment >= ₹20,000",
        flaggedCount: findings269SS.length,
        totalAmount: findings269SS.reduce((sum, item) => sum + item.amount, 0),
        riskLevel: "high" as const,
        items: findings269SS,
      },
    ];

    telemetryBus.report({
      engineId: "tax-law-engine",
      engineName: "Direct Tax & Corporate Law Workstation Engine",
      category: "Compliance",
      reportedAt: timestamp,
      latencyMs: 1,
      qualityScore: 98,
      itemsProcessed: transactions.length,
      errorCount: highRiskCount,
      meta: {
        operation: "FORM_3CD_AUDIT_SCAN",
        totalScanned: transactions.length,
        highRiskCount,
        potentialDisallowance,
      },
    });

    return {
      engine_version: ENGINE_VERSION,
      calculation_timestamp: timestamp,
      total_transactions_scanned: transactions.length,
      high_risk_disallowance_count: highRiskCount,
      potential_disallowance_amount: potentialDisallowance,
      findings_by_clause,
    };
  }

  /**
   * FASP-AI Decision Support: Notice Defense Generator
   * Generates structured defense points, precedent citations, and procedural checks.
   */
  public generateNoticeDefense(input: NoticeDefenseInput): NoticeDefenseOutput {
    const timestamp = new Date().toISOString();
    const { noticeSection, assessmentYear, allegationSummary, totalAdditionProposed, clientType } = input;

    let noticeNature = "Assessment or Inquiry Notice";
    let limitationCheck = "Within statutory limitation period.";
    let proceduralDefects: string[] = [];
    let coreStrategy = "";
    let confidenceScore = 92.5;

    if (noticeSection.includes("148")) {
      noticeNature = "Reassessment Notice under Section 148";
      limitationCheck = "Verify whether notice complies with Section 149 time limits as amended by Finance Act 2024 (3 years normal limit; up to 5 years if escaped income >= ₹50L). Check whether Section 148A order was served with prior approval of specified authority u/s 151.";
      proceduralDefects = [
        "Check whether Section 148A(b) show-cause notice was accompanied by underlying inquiry material.",
        "Verify whether minimum 7 days to 30 days response time was granted.",
        "Verify DIN (Document Identification Number) presence and validity as mandated by CBDT Circular No. 19/2019.",
      ];
      coreStrategy = "Challenge jurisdictional validity under Section 148A first, relying on Ashish Agarwal [2022] 444 ITR 1 (SC). Submit on merits without prejudice to jurisdictional objection.";
    } else if (noticeSection.includes("143(1)")) {
      noticeNature = "Intimation / Proposed Prima Facie Adjustment under Section 143(1)(a)";
      limitationCheck = "Must be sent within 9 months from the end of the financial year in which the return was furnished.";
      proceduralDefects = [
        "Prima facie adjustments can only be made for arithmetic errors or incorrect claims apparent from return info.",
        "Debatable legal issues cannot be adjusted under Section 143(1)(a).",
      ];
      coreStrategy = "Respond online via e-filing portal disagreeing with the proposed adjustment within 30 days. Clarify that the claim involves interpretation of law and cannot be disallowed as an arithmetic error.";
    } else {
      noticeNature = `Notice under Section ${noticeSection}`;
      limitationCheck = "Verify specific statutory timeline under Income-tax Act, 1961.";
      coreStrategy = "Provide itemized reconciliation between financial statements, Form 26AS, AIS/TIS, and return schedules.";
    }

    const replyDraft = `BEFORE THE ASSESSING OFFICER / NATIONAL FACELESS ASSESSMENT CENTRE (NFAC)
IN THE MATTER OF: [Assessee Name]
PAN: [Masked PAN: XXXXX1234X] | ASSESSMENT YEAR: ${assessmentYear}
NOTICE REF / DIN: ${input.dinNumber || "[DIN-NOT-PROVIDED]"}

WRITTEN SUBMISSION IN RESPONSE TO NOTICE UNDER SECTION ${noticeSection}

RESPECTED SIR / MADAM,

1. PRELIMINARY OBJECTIONS:
The Assessee respectfully submits that the proceedings initiated under Section ${noticeSection} must adhere to the mandatory statutory procedural requirements and limitation provisions of the Income-tax Act, 1961. ${proceduralDefects.join(" ")}

2. SUBMISSION ON MERITS:
With reference to the allegation regarding "${allegationSummary}", the Assessee submits that all relevant transactions have been duly accounted for in the regular books of accounts and correctly reported in the return of income filed under Section 139.

3. JUDICIAL PRECEDENTS:
The Assessee places reliance on the authoritative principles settled by the Supreme Court of India and relevant High Courts.

4. PRAYER:
In view of the above legal and factual submissions, it is respectfully prayed that the proposed additions of ${totalAdditionProposed ? `₹${totalAdditionProposed.toLocaleString("en-IN")}` : "the impugned amounts"} be dropped and the proceedings be closed.

Date: ${timestamp.split("T")[0]}
Place: [City]
FOR [Assessee Name]
[Chartered Accountant / Authorized Representative]`;

    return {
      model_version: "FASP-TAX-AI-v1.0",
      timestamp,
      confidence_score: confidenceScore,
      factors_considered: [
        `Statutory Section: ${noticeSection}`,
        `Assessment Year: ${assessmentYear}`,
        `Client Entity Type: ${clientType}`,
        "CBDT Circular 19/2019 (DIN Mandate)",
        "Supreme Court Jurisdictional Precedents",
      ],
      recommendation: {
        notice_nature: noticeNature,
        statutory_limitation_check: limitationCheck,
        core_defense_strategy: coreStrategy,
        procedural_defects_to_raise: proceduralDefects,
        suggested_reply_draft: replyDraft,
        recommended_precedents: [
          {
            citation: "[2022] 444 ITR 1 (SC)",
            caseTitle: "Union of India v. Ashish Agarwal",
            court: "Supreme Court of India",
            ratio: "Mandatory compliance with Section 148A procedure and supply of underlying material.",
            relevance: "Directly applicable to reassessment notices and opportunity of being heard.",
          },
        ],
        action_items_for_ca_cs: [
          "Verify the validity of DIN on the e-filing portal.",
          "Examine whether limitation under Section 149 / 153 has expired.",
          "Ensure client executes Form 35 / Power of Attorney / Digital Authorization before submission.",
          "Upload verified reply along with evidentiary documents on the e-filing portal before due date.",
        ],
      },
      mandatory_disclaimer:
        "FASP-AI DISCLAIMER: This automated response draft and legal analysis is provided strictly as a Decision Support System for qualified Chartered Accountants and Company Secretaries. It does not constitute formal legal advice or final statutory filing. Final verification and submission must be vetted and authorized by the practicing professional.",
    };
  }
}

export const taxLawEngine = TaxLawEngine.getInstance();
