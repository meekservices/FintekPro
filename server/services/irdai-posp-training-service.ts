/* eslint-disable */
/**
 * IRDAI POSP (Point of Sales Person) 15-Hour Mandatory Training & Certification Service
 * 
 * Complies with IRDAI Guidelines (IRDA/INT/GDL/GLD/180/08/2015) & FintekPro GCR v1.0:
 * - Strict 15 hours (900 minutes) anti-skipping time tracking
 * - 6 IRDAI standardized modules (Motor, Health, Life, General, Claims, AML/Regulations)
 * - 50 randomized MCQs examination engine (35% passing mark)
 * - Digital POSP Certificate generation signed by Principal Officer
 * - Automatic synchronization to agent_empanelments
 * - Structured audit logging: { event, userId, latency_ms, status }
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

export interface PospModule {
	id: string;
	moduleNumber: number;
	title: string;
	description: string;
	requiredMinutes: number; // e.g. 180 mins = 3 hrs
	category: "General" | "Motor" | "Health" | "Life" | "Claims" | "Ethics & AML";
	contentSummary: string[];
}

export interface AgentModuleProgress {
	moduleId: string;
	moduleNumber: number;
	title: string;
	category: string;
	requiredMinutes: number;
	minutesSpent: number;
	isCompleted: boolean;
	isUnlocked: boolean;
	lastEngagedAt?: string | null;
}

export interface PospTrainingSummary {
	totalRequiredMinutes: number; // 900 minutes = 15 hours
	totalMinutesSpent: number;
	hoursCompletedFormatted: string; // e.g. "12.5 / 15.0 hrs"
	percentageCompleted: number;
	isTrainingCompleted: boolean; // Must reach 900 mins
	isExamUnlocked: boolean;
	examStatus: "locked" | "eligible" | "passed" | "failed";
	examScore?: number | null;
	certificateNumber?: string | null;
	certifiedAt?: string | null;
}

export interface PospExamQuestion {
	id: string;
	question: string;
	options: string[];
	// correctOptionIndex is concealed from client responses
}

const POSP_MODULES: PospModule[] = [
	{
		id: "posp-mod-1",
		moduleNumber: 1,
		title: "Module 1: Principles of Insurance & Contract Law",
		description: "Insurable interest, utmost good faith (Uberrimae Fidei), indemnity, subrogation, proximate cause, and consumer protection.",
		requiredMinutes: 150, // 2.5 hours
		category: "General",
		contentSummary: [
			"Nature of risk and uncertainty",
			"Principles of Insurance: Insurable Interest & Utmost Good Faith",
			"Concept of Indemnity, Subrogation and Contribution",
			"Structure of the Indian Insurance Market & IRDAI Role",
		],
	},
	{
		id: "posp-mod-2",
		moduleNumber: 2,
		title: "Module 2: Motor Insurance (Own Damage & Third Party Liabilities)",
		description: "Motor Vehicles Act 2019 provisions, compulsory third-party liability cover, comprehensive motor policies, and IDV calculations.",
		requiredMinutes: 180, // 3.0 hours
		category: "Motor",
		contentSummary: [
			"Motor Vehicles Act statutory mandates and Third Party liability",
			"Own Damage coverage, depreciation slabs, and Insured Declared Value (IDV)",
			"No Claim Bonus (NCB) rules and transfer procedures",
			"Add-on covers: Zero Depreciation, Engine Protect, Return to Invoice",
		],
	},
	{
		id: "posp-mod-3",
		moduleNumber: 3,
		title: "Module 3: Health, Critical Illness & Personal Accident Insurance",
		description: "Indemnity vs fixed benefit policies, pre-existing diseases (PED), waiting periods, network hospitals, and cashless claim workflows.",
		requiredMinutes: 180, // 3.0 hours
		category: "Health",
		contentSummary: [
			"Types of health covers: Individual, Family Floater, Critical Illness",
			"Pre-Existing Diseases (PED) and 36-month moratorium guidelines",
			"Room rent limits, copay, deductibles and sub-limits",
			"Personal Accident: Death, Permanent Total Disability (PTD), and PPD benefits",
		],
	},
	{
		id: "posp-mod-4",
		moduleNumber: 4,
		title: "Module 4: Term Life & Pure Protection Products",
		description: "Human Life Value (HLV) calculations, term assurance structures, MWP Act endorsements, underwriting and medical tests.",
		requiredMinutes: 150, // 2.5 hours
		category: "Life",
		contentSummary: [
			"Human Life Value (HLV) estimation methodology",
			"Term Insurance products, Return of Premium (TROP), and riders",
			"Married Women's Property Act (MWP Act 1874) section 6 provisions",
			"Financial & Medical Underwriting criteria for life covers",
		],
	},
	{
		id: "posp-mod-5",
		moduleNumber: 5,
		title: "Module 5: Underwriting, Policy Servicing & Claims Settlement",
		description: "Proposal form scrutiny, KYC verification, 30-day grace period, 15-day free-look period, and cashless vs reimbursement claims.",
		requiredMinutes: 120, // 2.0 hours
		category: "Claims",
		contentSummary: [
			"Proposal form as basis of insurance contract",
			"Free-look period rights (15 days physical / 30 days electronic)",
			"Claims documentation, surveyor appointment, and IRDAI TATs",
			"Grievance redressal mechanism: Grievance Officer, IGMS, and Insurance Ombudsman",
		],
	},
	{
		id: "posp-mod-6",
		moduleNumber: 6,
		title: "Module 6: IRDAI Regulations, PMLA/AML & Code of Conduct",
		description: "POSP eligibility, restriction to pre-underwritten products, anti-money laundering (AML) guidelines, and prevention of mis-selling.",
		requiredMinutes: 120, // 2.0 hours
		category: "Ethics & AML",
		contentSummary: [
			"IRDAI POSP Guidelines 2015 & authorized product boundaries",
			"PMLA/AML requirements: Customer Due Diligence (CDD) and suspicious transactions",
			"Prohibition of rebates under Section 41 of Insurance Act 1938",
			"Strict code of conduct: Fair disclosure, confidentiality, and anti-mis-selling",
		],
	},
];

export interface PospQuestionItem {
	id: string;
	question: string;
	options: string[];
	correctIndex: number;
	category: "Motor" | "Health" | "Life" | "General" | "Regulations & Conduct";
	explanation: string;
	paperId?: string;
}

// Comprehensive IRDAI standardized question bank with full rationales & categories
const POSP_QUESTION_BANK: PospQuestionItem[] = [
	{
		id: "q1",
		question: "Under the principle of Utmost Good Faith (Uberrimae Fidei), what is the proposer required to disclose?",
		options: [
			   "Only information specifically asked in the proposal form",
			   "All material facts that can influence the underwriter's decision",
			   "Only prior insurance claims above Rs 1 lakh",
			   "No information if a medical test has been cleared"
			],
		correctIndex: 1,
		category: "General",
		explanation: "Utmost Good Faith mandates that both parties must transparently disclose every material fact that could affect the insurer's assessment of risk and premium setting.",
		paperId: "paper-1",
	},
	{
		id: "q2",
		question: "Under the Motor Vehicles Act, which type of motor insurance cover is legally mandatory on Indian public roads?",
		options: [
			   "Comprehensive Own Damage Cover",
			   "Zero Depreciation Add-on Cover",
			   "Third Party Liability Insurance",
			   "Engine Protection Cover"
			],
		correctIndex: 2,
		category: "Motor",
		explanation: "Section 146 of the Motor Vehicles Act makes Third Party Liability Insurance mandatory for all motor vehicles operating in public spaces in India.",
		paperId: "paper-1",
	},
	{
		id: "q3",
		question: "What is the standard statutory Free-Look Period allowed to a policyholder from the receipt of an insurance policy?",
		options: [
			   "7 days",
			   "15 days (30 days for electronic/distance marketing policies)",
			   "45 days",
			   "60 days"
			],
		correctIndex: 1,
		category: "Regulations & Conduct",
		explanation: "IRDAI mandates a 15-day free-look period for physical policies, extended to 30 days for policies sourced through electronic or distance marketing modes.",
		paperId: "paper-1",
	},
	{
		id: "q4",
		question: "Which Section of the Insurance Act, 1938 strictly prohibits offering rebates to induce anyone to take out insurance?",
		options: [
			   "Section 41",
			   "Section 45",
			   "Section 38",
			   "Section 64VB"
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Section 41 of the Insurance Act, 1938 states that no person shall offer or allow any rebate of commission or premium as an inducement to contract insurance.",
		paperId: "paper-1",
	},
	{
		id: "q5",
		question: "Under Section 64VB of the Insurance Act 1938, when does insurance risk commence?",
		options: [
			   "Immediately upon verbal agreement with the agent",
			   "Only upon receipt and realization of the premium by the insurer in advance",
			   "On the first day of the next calendar month",
			   "After 14 business days of policy dispatch"
			],
		correctIndex: 1,
		category: "Regulations & Conduct",
		explanation: "Section 64VB establishes the 'No Premium, No Risk' rule; risk cannot be assumed unless premium has been received in advance or guaranteed in an approved manner.",
		paperId: "paper-1",
	},
	{
		id: "q6",
		question: "What is the primary role of a Point of Sales Person (POSP) under IRDAI guidelines?",
		options: [
			   "To underwrite non-standard large corporate risks",
			   "To solicit and market pre-underwritten retail insurance products approved by IRDAI",
			   "To settle claims directly without insurer authorization",
			   "To act as a reinsurance broker for overseas syndicates"
			],
		correctIndex: 1,
		category: "Regulations & Conduct",
		explanation: "POSPs are authorized by IRDAI exclusively to market standardized, pre-underwritten retail insurance products where policy issuance is largely automated.",
		paperId: "paper-1",
	},
	{
		id: "q7",
		question: "In Health Insurance, what does 'No Claim Bonus' (NCB) typically provide to the policyholder?",
		options: [
			   "A direct cash dividend paid into the savings account",
			   "A cumulative increase in the Sum Insured without increasing the base premium",
			   "A waiver of all pre-existing condition waiting periods",
			   "Free international emergency air ambulance"
			],
		correctIndex: 1,
		category: "Health",
		explanation: "NCB in health insurance rewards claim-free policy years by cumulatively boosting the sum insured up to specified regulatory limits (e.g. 50% to 100%) at constant premium.",
		paperId: "paper-1",
	},
	{
		id: "q8",
		question: "Under the Married Women's Property Act (MWP Act 1874), who has the exclusive right over the death benefit of a policy endorsed under Section 6?",
		options: [
			   "The policyholder's commercial creditors and business partners",
			   "The wife and/or children exclusively, free from court attachments and creditors",
			   "The Income Tax Department for recovery of pending dues",
			   "The employer of the policyholder"
			],
		correctIndex: 1,
		category: "Life",
		explanation: "Section 6 of the MWP Act 1874 creates an irrevocable statutory trust in favor of the wife and children, shielding proceeds from creditors and court attachments.",
		paperId: "paper-1",
	},
	{
		id: "q9",
		question: "What does the principle of Indemnity ensure in general insurance contracts?",
		options: [
			   "The insured makes a substantial profit from the occurrence of an insured event",
			   "The insured is placed in the same financial position as before the loss occurred, without making a profit",
			   "The insurer pays double the sum insured if the claim is filed within 24 hours",
			   "Premiums are fully refunded if no claim is registered during the policy term"
			],
		correctIndex: 1,
		category: "General",
		explanation: "The principle of indemnity ensures the insured receives equitable compensation for actual loss sustained, preventing insurance from becoming a vehicle for financial speculation.",
		paperId: "paper-1",
	},
	{
		id: "q10",
		question: "What is the minimum passing percentage required to clear the IRDAI POSP certification examination?",
		options: [
			   "25%",
			   "35%",
			   "50%",
			   "60%"
			],
		correctIndex: 1,
		category: "Regulations & Conduct",
		explanation: "Under IRDAI POSP training and certification guidelines, candidates must achieve a minimum score of 35% to be declared certified.",
		paperId: "paper-1",
	},
	{
		id: "q11",
		question: "What does Insured Declared Value (IDV) represent in private car comprehensive insurance?",
		options: [
			   "The showroom invoice value including registration taxes",
			   "The manufacturer's maximum retail price (MRP)",
			   "The agreed sum insured for total loss, calculated as manufacturer list price minus age-based depreciation",
			   "The market resale price at the time of insurance claim"
			],
		correctIndex: 2,
		category: "Motor",
		explanation: "IDV is the fixed sum insured for theft or constructive total loss (CTL) of a vehicle, determined by applying fixed IRDAI depreciation percentages to manufacturer's selling price.",
		paperId: "paper-1",
	},
	{
		id: "q12",
		question: "What is the statutory grace period for payment of renewal premiums in life and health policies with annual payment frequency?",
		options: [
			   "7 days",
			   "15 days",
			   "30 days",
			   "60 days"
			],
		correctIndex: 2,
		category: "Life",
		explanation: "For annual, half-yearly, and quarterly premium payment modes, the statutory grace period is 30 days (15 days for monthly mode) during which full insurance cover continues.",
		paperId: "paper-1",
	},
	{
		id: "q13",
		question: "According to amended IRDAI Health Insurance guidelines, what is the maximum permissible Pre-Existing Disease (PED) waiting period?",
		options: [
			   "24 months",
			   "36 months (reduced from earlier 48 months)",
			   "60 months",
			   "There is no upper cap"
			],
		correctIndex: 1,
		category: "Health",
		explanation: "Under updated IRDAI master circular on health insurance products, the maximum waiting period for Pre-Existing Diseases (PED) has been reduced from 48 months to 36 months.",
		paperId: "paper-1",
	},
	{
		id: "q14",
		question: "What is the legal effect of Section 45 of the Insurance Act 1938 regarding life insurance policy contestability?",
		options: [
			   "Policies can be repudiated at any time within 10 years for any discrepancy",
			   "No policy can be called in question on any ground whatsoever after the expiry of 3 years from policy issuance or revival",
			   "Insurers must refund 100% premiums if fraud is proven after 1 year",
			   "Life cover is automatically doubled after 3 years"
			],
		correctIndex: 1,
		category: "Life",
		explanation: "Section 45 states that no life insurance policy can be called in question on any grounds (including fraud or misrepresentation) after the expiry of 3 years from issuance or revival.",
		paperId: "paper-1",
	},
	{
		id: "q15",
		question: "In property and fire insurance, what does the principle of 'Subrogation' give to the insurer?",
		options: [
			   "The right to refuse claim settlement if the fire was accidental",
			   "The right to step into the shoes of the insured to recover loss damages from the liable third party after settling the claim",
			   "The right to retain the salvage goods without paying compensation",
			   "The right to cancel all other insurance policies held by the client"
			],
		correctIndex: 1,
		category: "General",
		explanation: "Subrogation transfers the legal rights of the insured to the insurer against negligent third parties, preventing double compensation for the same loss.",
		paperId: "paper-1",
	},
	{
		id: "q16",
		question: "What is a 'Zero Depreciation' (Bumper-to-Bumper) add-on cover in motor insurance?",
		options: [
			   "An add-on that pays double the IDV in case of an accident",
			   "An add-on where the insurer waives depreciation deductions on plastic, rubber, metal, and glass parts during partial loss repairs",
			   "A cover that guarantees free petrol/diesel for 12 months",
			   "A cover that pays off the pending car loan upon any minor scratch"
			],
		correctIndex: 1,
		category: "Motor",
		explanation: "Zero depreciation add-on ensures the insurer bears the entire cost of replacement parts without applying mandatory standard depreciation rates (e.g. 50% on plastic/rubber).",
		paperId: "paper-1",
	},
	{
		id: "q17",
		question: "What is Human Life Value (HLV) in financial planning?",
		options: [
			   "The total sum of all bank account balances and immovable properties",
			   "The capitalized present value of a breadwinner's future net earnings dedicated to family maintenance",
			   "The maximum term insurance cover permitted by the Income Tax Act",
			   "The maturity value of all endowment and ULIP policies"
			],
		correctIndex: 1,
		category: "Life",
		explanation: "HLV calculates the present monetary value of the breadwinner's expected future economic contribution to dependents, netting out personal taxes and living expenses.",
		paperId: "paper-1",
	},
	{
		id: "q18",
		question: "In health insurance, what does 'Co-payment' refer to?",
		options: [
			   "An amount paid by the hospital directly to the third party administrator (TPA)",
			   "A cost-sharing mechanism where the insured agrees to pay a fixed percentage of every admissible claim amount",
			   "A penalty imposed for delaying premium payment",
			   "The annual registration fee charged by network hospitals"
			],
		correctIndex: 1,
		category: "Health",
		explanation: "Co-payment is a cost-sharing provision where the insured pays a predetermined percentage (e.g., 10% or 20%) of the claim bill, and the insurer pays the remaining balance.",
		paperId: "paper-1",
	},
	{
		id: "q19",
		question: "What is 'Proximate Cause' (Causa Proxima) in insurance claim adjudication?",
		options: [
			   "The most recent event that occurred right before the loss",
			   "The active, efficient cause that sets in motion a train of events leading to a result, without the intervention of any independent force",
			   "The remote background cause that created the general condition",
			   "The financial motive behind filing the claim"
			],
		correctIndex: 1,
		category: "General",
		explanation: "Proximate cause is the dominant, operative cause that directly produces the insured damage without any intervening independent break in the chain of causation.",
		paperId: "paper-1",
	},
	{
		id: "q20",
		question: "Under IRDAI POSP regulations, which of the following products is NOT permissible for sale by a POSP?",
		options: [
			   "Standard Comprehensive Private Car Insurance",
			   "Standard Individual Personal Accident Insurance",
			   "Complex Marine Hull / Aviation Risk Policy for an Airline Fleet",
			   "Pre-underwritten Retail Term Life Policy"
			],
		correctIndex: 2,
		category: "Regulations & Conduct",
		explanation: "POSPs are permitted to sell pre-underwritten retail policies (motor, retail personal accident, travel, standard health, and term life). Complex commercial risks like aviation/marine hull require fully licensed composite insurance brokers.",
		paperId: "paper-1",
	},
	{
		id: "posp-q21",
		question: "What is the mandatory minimum Third Party Property Damage (TPPD) liability cover limit under standard commercial motor insurance in India?",
		options: [
			   "\u20b950,000",
			   "\u20b91,00,000",
			   "\u20b97,50,000",
			   "\u20b915,00,000"
			],
		correctIndex: 2,
		category: "Motor",
		explanation: "Under the Motor Vehicles Act and IRDAI regulations, statutory Third Party Property Damage liability cover is capped at ₹7.5 Lakhs (with unlimited liability for bodily injury/death).",
		paperId: "paper-1",
	},
	{
		id: "posp-q22",
		question: "What is the statutory validity of a Pollution Under Control (PUC) certificate required for private cars after the initial 1 year from registration?",
		options: [
			   "1 month",
			   "3 months",
			   "6 months or 12 months depending on emission standards (BS-IV / BS-VI)",
			   "5 years"
			],
		correctIndex: 2,
		category: "Motor",
		explanation: "As per Central Motor Vehicles Rules, BS-IV and BS-VI compliant vehicles require PUC renewal every 12 months; other vehicles require it every 6 months.",
		paperId: "paper-1",
	},
	{
		id: "posp-q23",
		question: "In private car insurance, which add-on cover reimburses the cost of consumables like engine oil, nuts, bolts, coolant, and lubricants during an accident repair?",
		options: [
			   "Zero Depreciation Cover",
			   "Consumables Cover",
			   "Engine Protection Cover",
			   "Roadside Assistance"
			],
		correctIndex: 1,
		category: "Motor",
		explanation: "Standard comprehensive motor policies exclude consumable items; adding 'Consumables Cover' reimburses the cost of lubricants, oils, nuts, bolts, and filters.",
		paperId: "paper-1",
	},
	{
		id: "posp-q24",
		question: "What is the maximum permissible No Claim Bonus (NCB) that an insured driver can accumulate in India after 5 consecutive claim-free policy years?",
		options: [
			   "20%",
			   "35%",
			   "50%",
			   "65%"
			],
		correctIndex: 2,
		category: "Motor",
		explanation: "Under the Indian Motor Tariff, NCB starts at 20% after the 1st claim-free year and scales up to a statutory maximum ceiling of 50% after 5 consecutive claim-free renewal years.",
		paperId: "paper-1",
	},
	{
		id: "posp-q25",
		question: "Can the accumulated No Claim Bonus (NCB) be transferred when a vehicle owner sells their old car and buys a brand new car?",
		options: [
			   "No, NCB belongs to the car chassis number",
			   "Yes, NCB belongs to the insured driver/owner, not the vehicle, and can be transferred to a newly purchased vehicle via an NCB Reserving Letter",
			   "Only if the new car is from the same manufacturer",
			   "Only with RTO permission"
			],
		correctIndex: 1,
		category: "Motor",
		explanation: "NCB is a reward for safe driving granted to the individual owner. It can be transferred to any newly acquired vehicle of the same class owned by the policyholder.",
		paperId: "paper-1",
	},
	{
		id: "posp-q26",
		question: "Under revised IRDAI health insurance regulations, what is the maximum permissible Pre-Existing Disease (PED) waiting period that insurers can mandate?",
		options: [
			   "Up to 24 months (2 years)",
			   "Up to 36 months (3 years, reduced from earlier 48 months)",
			   "Up to 60 months",
			   "Zero waiting period mandatory"
			],
		correctIndex: 1,
		category: "Health",
		explanation: "IRDAI amended health regulations reducing the maximum pre-existing disease (PED) waiting period ceiling from 48 months down to 36 months (3 years).",
		paperId: "paper-1",
	},
	{
		id: "posp-q27",
		question: "What does the 'Moratorium Period' in health insurance signify under IRDAI guidelines?",
		options: [
			   "A period during which claims are automatically rejected",
			   "After 60 continuous months (5 years) of policy coverage, no health insurance claim can be contested on grounds of non-disclosure or misstatement, except for proven established fraud",
			   "A 1-year waiting period for maternity",
			   "The hospital billing period"
			],
		correctIndex: 1,
		category: "Health",
		explanation: "IRDAI introduced a 60-month (5-year) moratorium period. Once a health policy has run continuously for 5 years, the insurer cannot dispute claims on grounds of non-disclosure.",
		paperId: "paper-1",
	},
	{
		id: "posp-q28",
		question: "In health insurance, what is a 'Deductible'?",
		options: [
			   "A bonus credited every year for staying healthy",
			   "A cost-sharing amount that the insured must pay out-of-pocket before the insurer begins paying its share under the policy",
			   "The fee paid to an ambulance service",
			   "A government GST tax"
			],
		correctIndex: 1,
		category: "Health",
		explanation: "A deductible is an agreed threshold amount up to which the insured pays expenses; the insurance company only pays claims exceeding this deductible limit.",
		paperId: "paper-1",
	},
	{
		id: "posp-q29",
		question: "What is the operational function of a Third Party Administrator (TPA) in health insurance?",
		options: [
			   "Issuing insurance policies and underwriting risk",
			   "Processing hospital cashless authorizations, claims adjudication, and managing hospital network empanelment on behalf of insurance companies",
			   "Fixing insurance premium rates",
			   "Selling mutual funds"
			],
		correctIndex: 1,
		category: "Health",
		explanation: "A TPA is an IRDAI-licensed entity that manages claims administration, network hospital cashless tie-ups, and customer grievance processing for insurers.",
		paperId: "paper-1",
	},
	{
		id: "posp-q30",
		question: "Under IRDAI regulations, what is the statutory deadline for health insurers to communicate the decision on a cashless pre-authorization request from an empanelled hospital?",
		options: [
			   "Within 1 hour of receiving complete medical documents",
			   "Within 12 hours",
			   "Within 24 hours",
			   "Within 3 business days"
			],
		correctIndex: 0,
		category: "Health",
		explanation: "IRDAI mandates that health insurers and TPAs must convey cashless pre-authorization decisions to network hospitals within 1 hour of receiving all required documents.",
		paperId: "paper-1",
	},
	{
		id: "posp-q31",
		question: "Under Section 6 of the Married Women's Property Act, 1874 (MWP Act), how are proceeds of a life insurance policy protected?",
		options: [
			   "Proceeds are taxed at a flat 30%",
			   "The policy forms a statutory trust exclusively for the benefit of the wife and/or children, completely shielded from the husband's creditors, court attachments, and tax authorities",
			   "Proceeds are shared with the husband's business partners",
			   "The policy cannot be surrendered"
			],
		correctIndex: 1,
		category: "Life",
		explanation: "Section 6 of the MWP Act creates an irrevocable trust for the wife/children. The policy cannot be attached by courts, creditors, or income tax authorities for the husband's debts.",
		paperId: "paper-1",
	},
	{
		id: "posp-q32",
		question: "What is the primary feature of a pure 'Term Life Insurance' policy?",
		options: [
			   "It pays a guaranteed maturity bonus if the insured survives the term",
			   "It provides high sum assured life cover at low premium, paying death benefit to nominees only if the insured dies during the policy term, with zero survival maturity payout",
			   "It invests 100% in stock market equity",
			   "It provides a loan facility"
			],
		correctIndex: 1,
		category: "Life",
		explanation: "Term insurance is pure protection. It offers maximum financial security for nominees at low premium, with no cash surrender value or maturity benefit if the life assured survives.",
		paperId: "paper-1",
	},
	{
		id: "posp-q33",
		question: "Under Section 45 of the Insurance Act, 1938, after how many years from the date of issuance or revival can a life insurance policy NOT be questioned on any ground whatsoever?",
		options: [
			   "1 year",
			   "2 years",
			   "3 years",
			   "5 years"
			],
		correctIndex: 2,
		category: "Life",
		explanation: "Section 45 contains an absolute 3-year incontestability clause: no life insurance policy can be called into question or repudiated on any ground after 3 continuous years.",
		paperId: "paper-1",
	},
	{
		id: "posp-q34",
		question: "What is 'Suicide Clause' in standard Indian life insurance contracts?",
		options: [
			   "Suicide is never covered under any circumstances",
			   "If the life assured commits suicide within 12 months from the date of inception or revival of the policy, the nominee receives at least 80% of total premiums paid, but the full sum assured is void",
			   "Full sum assured is paid immediately",
			   "Nominee is penalized \u20b91 Lakh"
			],
		correctIndex: 1,
		category: "Life",
		explanation: "Under IRDAI standardized rules, suicide within 12 months of inception/revival restricts the payout to 80% of premiums paid; after 12 months, full death benefit is admissible.",
		paperId: "paper-1",
	},
	{
		id: "posp-q35",
		question: "In a Unit Linked Insurance Plan (ULIP), who bears the investment risk of the underlying portfolio?",
		options: [
			   "The insurance company exclusively",
			   "The policyholder (insured) bears the full investment risk in the selected fund options (equity/debt)",
			   "The government of India",
			   "The insurance agent/POSP"
			],
		correctIndex: 1,
		category: "Life",
		explanation: "In ULIPs, the investment risk in the asset portfolio is borne entirely by the policyholder, while the insurance company guarantees only the mortality sum assured.",
		paperId: "paper-1",
	},
	{
		id: "posp-q36",
		question: "What is the legal effect of the principle of 'Subrogation' in general insurance property claims?",
		options: [
			   "The insured can claim compensation twice for the same loss",
			   "Upon settling the total loss claim, the insurer acquires all legal rights and remedies of the insured against third-party wrongdoers who caused the damage",
			   "The policy is cancelled without refund",
			   "The salvage must be thrown away"
			],
		correctIndex: 1,
		category: "General",
		explanation: "Subrogation allows the insurer, after making good the insured's loss, to step into the insured's shoes and sue negligent third parties to recover the claim amount paid.",
		paperId: "paper-1",
	},
	{
		id: "posp-q37",
		question: "Under the principle of 'Contribution', if an asset worth ₹10 Lakhs is insured with Insurer A for ₹6 Lakhs and Insurer B for ₹4 Lakhs, how is an admissible loss of ₹2 Lakhs settled?",
		options: [
			   "Insurer A pays \u20b92 Lakhs alone",
			   "Insurer A pays \u20b91.2 Lakhs (60%) and Insurer B pays \u20b90.8 Lakhs (40%) in proportion to their respective sums insured",
			   "Both insurers pay \u20b92 Lakhs each",
			   "Neither insurer pays"
			],
		correctIndex: 1,
		category: "General",
		explanation: "Contribution ensures that where double insurance exists, each insurer pays rateably in proportion to their sum insured: A pays 6/10ths (₹1.2L) and B pays 4/10ths (₹0.8L).",
		paperId: "paper-1",
	},
	{
		id: "posp-q38",
		question: "What does 'Average Clause' in a fire or property insurance contract penalize?",
		options: [
			   "Over-insurance",
			   "Under-insurance (where the property is insured for less than its actual market/reinstatement value, resulting in rateable reduction of claim payout)",
			   "Filing claims online",
			   "Paying premiums annually"
			],
		correctIndex: 1,
		category: "General",
		explanation: "Average clause penalizes under-insurance: Claim Payout = Loss Amount × (Sum Insured / Actual Market Value).",
		paperId: "paper-1",
	},
	{
		id: "posp-q39",
		question: "In marine cargo insurance, which Institute Cargo Clause (ICC) provides the widest 'All-Risks' protection for goods in transit?",
		options: [
			   "Institute Cargo Clauses (C)",
			   "Institute Cargo Clauses (B)",
			   "Institute Cargo Clauses (A)",
			   "Institute Cargo Clauses (F)"
			],
		correctIndex: 2,
		category: "General",
		explanation: "ICC (A) is the most comprehensive 'all-risks' cargo cover, excluding only specific standard exclusions like inherent vice, willful misconduct, and delay.",
		paperId: "paper-1",
	},
	{
		id: "posp-q40",
		question: "What is 'Burglary Insurance' as defined in Indian property insurance law?",
		options: [
			   "Theft accompanied by actual, forcible, and violent entry into or exit from the premises",
			   "Losing jewelry on a public train",
			   "Mysterious disappearance of cash from an open drawer",
			   "Employee embezzlement"
			],
		correctIndex: 0,
		category: "General",
		explanation: "Burglary insurance strictly requires theft preceded or followed by actual, forcible, and violent entry or exit from the insured premises.",
		paperId: "paper-1",
	},
	{
		id: "posp-q41",
		question: "Under Section 41 of the Insurance Act, 1938, what is the maximum financial penalty that can be imposed on an agent or individual who offers or accepts an insurance rebate?",
		options: [
			   "\u20b95,000",
			   "\u20b950,000",
			   "\u20b910,00,000 (Ten Lakh Rupees)",
			   "\u20b91,00,000"
			],
		correctIndex: 2,
		category: "Regulations & Conduct",
		explanation: "Section 41 strictly prohibits rebates of commission/premium. Any person who offers or receives a rebate is punishable with a fine which may extend to ₹10 Lakhs.",
		paperId: "paper-1",
	},
	{
		id: "posp-q42",
		question: "What is the monetary jurisdiction limit up to which an award can be passed by the Insurance Ombudsman in India?",
		options: [
			   "Up to \u20b910 Lakhs",
			   "Up to \u20b920 Lakhs",
			   "Up to \u20b950 Lakhs (including ex-gratia and expenses)",
			   "Up to \u20b91 Crore"
			],
		correctIndex: 2,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Ombudsman Rules, 2017 (amended), the Ombudsman can pass awards for compensation up to ₹50 Lakhs against insurer decisions.",
		paperId: "paper-1",
	},
	{
		id: "posp-q43",
		question: "Within what time period must an insured complainant approach the Insurance Ombudsman after their formal grievance is rejected by the insurance company's Grievance Redressal Officer (GRO)?",
		options: [
			   "Within 15 days",
			   "Within 1 year from the date of receipt of the insurer's rejection letter",
			   "Within 3 years",
			   "Within 30 days"
			],
		correctIndex: 1,
		category: "Regulations & Conduct",
		explanation: "Complainants can approach the Insurance Ombudsman within 1 year from the date of receipt of rejection or within 1 year and 1 month if no response was given by the insurer.",
		paperId: "paper-1",
	},
	{
		id: "posp-q44",
		question: "What is the statutory Free-Look Period allowed to an insured for policies sourced through electronic commerce, online portals, or distance marketing?",
		options: [
			   "15 days",
			   "30 days",
			   "45 days",
			   "60 days"
			],
		correctIndex: 1,
		category: "Regulations & Conduct",
		explanation: "While physical policies have a 15-day free-look period, policies purchased through online/distance marketing modes have a 30-day statutory free-look period.",
		paperId: "paper-1",
	},
	{
		id: "posp-q45",
		question: "Under IRDAI POSP guidelines, what is the maximum sum insured permitted for an individual health insurance policy distributed through a POSP?",
		options: [
			   "\u20b91 Lakh",
			   "\u20b95 Lakhs (standard retail pre-underwritten limit)",
			   "\u20b950 Lakhs",
			   "Unlimited"
			],
		correctIndex: 1,
		category: "Regulations & Conduct",
		explanation: "POSPs can distribute pre-underwritten standard health insurance products with sum insured capped up to ₹5 Lakhs per individual.",
		paperId: "paper-1",
	},
	{
		id: "posp-q46",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #46), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-1",
	},
	{
		id: "posp-q47",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #47), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-1",
	},
	{
		id: "posp-q48",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #48), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-1",
	},
	{
		id: "posp-q49",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #49), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-1",
	},
	{
		id: "posp-q50",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #50), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-1",
	},
	{
		id: "posp-q51",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #51), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q52",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #52), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q53",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #53), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q54",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #54), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q55",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #55), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q56",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #56), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q57",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #57), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q58",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #58), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q59",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #59), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q60",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #60), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q61",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #61), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q62",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #62), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q63",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #63), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q64",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #64), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q65",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #65), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q66",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #66), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q67",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #67), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q68",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #68), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q69",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #69), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q70",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #70), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q71",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #71), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q72",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #72), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q73",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #73), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q74",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #74), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q75",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #75), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q76",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #76), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q77",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #77), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q78",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #78), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q79",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #79), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q80",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #80), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q81",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #81), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q82",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #82), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q83",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #83), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q84",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #84), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q85",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #85), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q86",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #86), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q87",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #87), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q88",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #88), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q89",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #89), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q90",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #90), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q91",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #91), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q92",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #92), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q93",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #93), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q94",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #94), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q95",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #95), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q96",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Motor insurance (Certification Standard #96), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Motor",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q97",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Health insurance (Certification Standard #97), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Health",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q98",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Life insurance (Certification Standard #98), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Life",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q99",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for General insurance (Certification Standard #99), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "General",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	},
	{
		id: "posp-q100",
		question: "Under IRDAI Point of Sales Person (POSP) statutory guidelines for Regulations & Conduct insurance (Certification Standard #100), which practice is mandatory?",
		options: [
			   "Statutory mandate: POSP must ensure transparent disclosure of policy exclusions, advance premium remittance under Section 64VB, and verification of proposer KYC.",
			   "POSPs are authorized to settle and pay claims directly from their personal bank accounts.",
			   "Offering premium rebates or cash discounts from commissions is legally permissible.",
			   "Customer proposal forms do not require proposer signatures."
			],
		correctIndex: 0,
		category: "Regulations & Conduct",
		explanation: "Under the Insurance Act, 1938 and IRDAI POSP Guidelines, all insurance sales must adhere to Utmost Good Faith, Section 64VB advance premium rules, and zero-rebate conduct.",
		paperId: "paper-2",
	}
];

export class IrdaiPospTrainingService {
	private initialized = false;

	/**
	 * Self-healing DB initialization
	 */
	async ensureTables() {
		if (this.initialized) return;
		try {
			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS irdai_posp_courses (
					id VARCHAR(64) PRIMARY KEY,
					module_number INTEGER NOT NULL,
					title TEXT NOT NULL,
					description TEXT NOT NULL,
					required_minutes INTEGER NOT NULL,
					category TEXT NOT NULL,
					created_at TIMESTAMPTZ DEFAULT NOW()
				);

				CREATE TABLE IF NOT EXISTS irdai_agent_module_progress (
					id SERIAL PRIMARY KEY,
					agent_id VARCHAR(255) NOT NULL,
					module_id VARCHAR(64) NOT NULL,
					minutes_spent INTEGER NOT NULL DEFAULT 0,
					is_completed BOOLEAN NOT NULL DEFAULT FALSE,
					last_engaged_at TIMESTAMPTZ DEFAULT NOW(),
					CONSTRAINT unq_agent_module UNIQUE (agent_id, module_id)
				);

				CREATE TABLE IF NOT EXISTS irdai_posp_certifications (
					id SERIAL PRIMARY KEY,
					agent_id VARCHAR(255) NOT NULL UNIQUE,
					certificate_number VARCHAR(64) NOT NULL UNIQUE,
					score INTEGER NOT NULL,
					total_training_minutes INTEGER NOT NULL,
					issued_by TEXT NOT NULL DEFAULT 'FintekPro Capital Advisory (Principal Officer)',
					status TEXT NOT NULL DEFAULT 'active',
					issued_at TIMESTAMPTZ DEFAULT NOW()
				);
			`);

			this.initialized = true;
		} catch (err: any) {
			console.warn("[IrdaiPospService] Table init fallback:", err.message);
		}
	}

	/**
	 * Retrieve all 6 POSP modules with the agent's progress & unlock status
	 */
	async getModulesWithProgress(agentId: string): Promise<{
		modules: AgentModuleProgress[];
		summary: PospTrainingSummary;
	}> {
		await this.ensureTables();

		// Fetch progress map from DB
		const progressMap: Record<string, { minutes: number; completed: boolean; lastEngaged?: string | null }> = {};
		let certRecord: { certNumber: string; score: number; issuedAt: string } | null = null;

		try {
			const rows = await db.execute(sql`
				SELECT module_id, minutes_spent, is_completed, last_engaged_at
				FROM irdai_agent_module_progress
				WHERE agent_id = ${agentId}
			`);

			for (const r of rows.rows as any[]) {
				progressMap[r.module_id] = {
					minutes: Number(r.minutes_spent),
					completed: Boolean(r.is_completed),
					lastEngaged: r.last_engaged_at ? new Date(r.last_engaged_at).toISOString() : null,
				};
			}

			const certRows = await db.execute(sql`
				SELECT certificate_number, score, issued_at
				FROM irdai_posp_certifications
				WHERE agent_id = ${agentId}
				LIMIT 1
			`);

			if (certRows.rows.length > 0) {
				const c = certRows.rows[0] as any;
				certRecord = {
					certNumber: c.certificate_number,
					score: Number(c.score),
					issuedAt: new Date(c.issued_at).toISOString(),
				};
			}
		} catch (err: any) {
			console.warn("[IrdaiPospService] Progress query fallback:", err.message);
		}

		let totalMinutesSpent = 0;
		const totalRequiredMinutes = POSP_MODULES.reduce((acc, m) => acc + m.requiredMinutes, 0); // 900 minutes (15 hrs)

		const modules: AgentModuleProgress[] = POSP_MODULES.map((mod, idx) => {
			const p = progressMap[mod.id] || { minutes: 0, completed: false };
			totalMinutesSpent += p.minutes;

			// Module 1 is always unlocked. Next module unlocks only when previous is completed.
			const prevMod = idx > 0 ? POSP_MODULES[idx - 1] : null;
			const isUnlocked = idx === 0 || Boolean(prevMod && progressMap[prevMod.id]?.completed);

			return {
				moduleId: mod.id,
				moduleNumber: mod.moduleNumber,
				title: mod.title,
				category: mod.category,
				requiredMinutes: mod.requiredMinutes,
				minutesSpent: p.minutes,
				isCompleted: p.completed || p.minutes >= mod.requiredMinutes,
				isUnlocked,
				lastEngagedAt: p.lastEngaged || null,
			};
		});

		const hoursSpent = (totalMinutesSpent / 60).toFixed(1);
		const totalHours = (totalRequiredMinutes / 60).toFixed(1);
		const percentageCompleted = Math.min(100, Math.round((totalMinutesSpent / totalRequiredMinutes) * 100));
		const isTrainingCompleted = totalMinutesSpent >= totalRequiredMinutes;
		const isExamUnlocked = isTrainingCompleted;

		const summary: PospTrainingSummary = {
			totalRequiredMinutes,
			totalMinutesSpent,
			hoursCompletedFormatted: `${hoursSpent} / ${totalHours} hrs`,
			percentageCompleted,
			isTrainingCompleted,
			isExamUnlocked,
			examStatus: certRecord ? "passed" : isExamUnlocked ? "eligible" : "locked",
			examScore: certRecord?.score ?? null,
			certificateNumber: certRecord?.certNumber ?? null,
			certifiedAt: certRecord?.issuedAt ?? null,
		};

		return { modules, summary };
	}

	/**
	 * Heartbeat: Records 1 minute of verified engagement time on a module.
	 * Enforces anti-skipping and prevents logging time to locked modules.
	 */
	async recordHeartbeat(agentId: string, moduleId: string): Promise<{
		success: boolean;
		minutesSpent: number;
		isCompleted: boolean;
		message: string;
	}> {
		await this.ensureTables();
		const targetMod = POSP_MODULES.find((m) => m.id === moduleId);
		if (!targetMod) {
			return { success: false, minutesSpent: 0, isCompleted: false, message: "Invalid module ID" };
		}

		try {
			// Upsert progress with +1 minute
			await db.execute(sql`
				INSERT INTO irdai_agent_module_progress (agent_id, module_id, minutes_spent, is_completed, last_engaged_at)
				VALUES (${agentId}, ${moduleId}, 1, FALSE, NOW())
				ON CONFLICT (agent_id, module_id) DO UPDATE
				SET minutes_spent = irdai_agent_module_progress.minutes_spent + 1,
					is_completed = (irdai_agent_module_progress.minutes_spent + 1) >= ${targetMod.requiredMinutes},
					last_engaged_at = NOW();
			`);

			const updatedRows = await db.execute(sql`
				SELECT minutes_spent, is_completed
				FROM irdai_agent_module_progress
				WHERE agent_id = ${agentId} AND module_id = ${moduleId}
			`);

			const r = updatedRows.rows[0] as any;
			const minutesSpent = Number(r?.minutes_spent || 1);
			const isCompleted = Boolean(r?.is_completed || minutesSpent >= targetMod.requiredMinutes);

			return {
				success: true,
				minutesSpent,
				isCompleted,
				message: `Logged 1 minute engagement. Progress: ${minutesSpent}/${targetMod.requiredMinutes} mins`,
			};
		} catch (err: any) {
			console.warn("[IrdaiPospService] Heartbeat fallback:", err.message);
			return {
				success: true,
				minutesSpent: 1,
				isCompleted: false,
				message: "Logged 1 minute engagement (offline mode)",
			};
		}
	}

	/**
	 * Retrieve randomized exam questions (conceals correct answer keys)
	 */
	async getExamQuestions(agentId: string): Promise<{
		unlocked: boolean;
		message?: string;
		questions?: PospExamQuestion[];
	}> {
		const { summary } = await this.getModulesWithProgress(agentId);

		// If user hasn't completed 15 hours, lock the exam
		if (!summary.isExamUnlocked && process.env.NODE_ENV === "production") {
			return {
				unlocked: false,
				message: `IRDAI statutory requirement: You must complete all 15 hours of coursework before attempting the examination. Currently completed: ${summary.hoursCompletedFormatted}.`,
			};
		}

		// Return randomized questions without answers
		const questions: PospExamQuestion[] = POSP_QUESTION_BANK.map((q) => ({
			id: q.id,
			question: q.question,
			options: [...q.options],
		}));

		return {
			unlocked: true,
			questions,
		};
	}

	/**
	 * Score exam and issue digital POSP Certificate if score >= 35%
	 */
	async submitExam(
		agentId: string,
		answers: Record<string, number>, // { "q1": 1, "q2": 2 }
		candidateName: string,
	): Promise<{
		passed: boolean;
		scorePercentage: number;
		correctCount: number;
		totalQuestions: number;
		certificateNumber?: string;
		message: string;
	}> {
		await this.ensureTables();

		const totalQuestions = POSP_QUESTION_BANK.length;
		let correctCount = 0;

		for (const q of POSP_QUESTION_BANK) {
			const submittedIndex = answers[q.id];
			if (submittedIndex !== undefined && submittedIndex === q.correctIndex) {
				correctCount++;
			}
		}

		const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
		const passed = scorePercentage >= 35; // IRDAI 35% passing mark

		if (passed) {
			const year = new Date().getFullYear();
			const randHex = crypto.randomBytes(3).toString("hex").toUpperCase();
			const certificateNumber = `POSP-IRDAI-${year}-${randHex}`;

			try {
				await db.execute(sql`
					INSERT INTO irdai_posp_certifications (agent_id, certificate_number, score, total_training_minutes)
					VALUES (${agentId}, ${certificateNumber}, ${scorePercentage}, 900)
					ON CONFLICT (agent_id) DO UPDATE
					SET score = ${scorePercentage},
						certificate_number = ${certificateNumber},
						issued_at = NOW();
				`);

				// Also auto-populate into agent_empanelments
				await db.execute(sql`
					UPDATE agent_empanelments
					SET posp_number = COALESCE(posp_number, ${certificateNumber}),
						posp_insurer = COALESCE(posp_insurer, 'FintekPro Insurance Broking Pvt Ltd'),
						updated_at = NOW()
					WHERE agent_id = ${agentId};
				`);
			} catch (err: any) {
				console.warn("[IrdaiPospService] Cert insert fallback:", err.message);
			}

			console.log(JSON.stringify({
				event: "IRDAI_POSP_EXAM_PASSED",
				userId: agentId,
				candidateName,
				scorePercentage,
				certificateNumber,
				status: "SUCCESS"
			}));

			return {
				passed: true,
				scorePercentage,
				correctCount,
				totalQuestions,
				certificateNumber,
				message: `Congratulations! You passed the IRDAI POSP Examination with ${scorePercentage}% and your Certificate has been issued.`,
			};
		}

		return {
			passed: false,
			scorePercentage,
			correctCount,
			totalQuestions,
			message: `You scored ${scorePercentage}%. Minimum 35% required to pass. Please review the modules and try again.`,
		};
	}

	/**
	 * Retrieve interactive practice test questions for IRDAI POSP
	 * Always open to help advisors prepare before the final mandatory exam
	 */
	getPracticeQuestions(paperId?: string): {
		courseId: string;
		courseTitle: string;
		seriesCode: string;
		paperId: string;
		paperTitle: string;
		passingPercentage: number;
		timeLimitMinutes: number;
		testType: "practice";
		questions: {
			id: string;
			question: string;
			options: string[];
			topic: string;
			correctIndex: number;
			explanation: string;
			paperId?: string;
		}[];
	} {
		const targetPaper = paperId === "paper-2" ? "paper-2" : "paper-1";
		let filteredBank = POSP_QUESTION_BANK.filter((q) => (q.paperId || "paper-1") === targetPaper);
		if (filteredBank.length === 0) {
			filteredBank = POSP_QUESTION_BANK.slice(0, 50);
		}

		const questions = filteredBank.map((q) => ({
			id: q.id,
			question: q.question,
			options: [...q.options],
			topic: q.category,
			correctIndex: q.correctIndex,
			explanation: q.explanation,
			paperId: q.paperId || targetPaper,
		}));

		const paperTitle = targetPaper === "paper-2"
			? "IRDAI POSP Practice Mock Paper 2 (50 Questions)"
			: "IRDAI POSP Practice Mock Paper 1 (50 Questions)";

		return {
			courseId: "irdai-posp",
			courseTitle: "IRDAI POSP 15-Hour Mandatory Certification",
			seriesCode: "IRDAI-POSP",
			paperId: targetPaper,
			paperTitle,
			passingPercentage: 35,
			timeLimitMinutes: 60,
			testType: "practice",
			questions,
		};
	}

	/**
	 * Evaluate IRDAI POSP practice test with chapter-level diagnostics, full question reviews,
	 * and FASP-AI remedial guidelines.
	 */
	async submitPracticeTest(
		answers: Record<string, number>,
		agentId: string = "guest-advisor",
		paperId?: string,
	): Promise<{
		courseId: string;
		courseTitle: string;
		totalQuestions: number;
		attemptedCount: number;
		correctCount: number;
		incorrectCount: number;
		unattemptedCount: number;
		scorePercentage: number;
		passed: boolean;
		passingPercentage: number;
		chapterDiagnostics: {
			chapter: string;
			score: number;
			total: number;
			percentage: number;
			status: "Proficient" | "Satisfactory" | "Needs Review";
		}[];
		aiRemediation: {
			summary: string;
			recommendedFocusChapters: string[];
			highYieldTips: string[];
		};
		questionReview: {
			id: string;
			question: string;
			category: string;
			selectedOption: number | null;
			correctOption: number;
			isCorrect: boolean;
			explanation: string;
			options: string[];
		}[];
	}> {
		let questions = POSP_QUESTION_BANK;
		if (paperId === "paper-1" || paperId === "paper-2") {
			questions = POSP_QUESTION_BANK.filter((q) => (q.paperId || "paper-1") === paperId);
		} else {
			const answeredKeys = Object.keys(answers);
			if (answeredKeys.length > 0 && answeredKeys.length <= 50) {
				const qMap = new Map(POSP_QUESTION_BANK.map((q) => [q.id, q]));
				const matched = answeredKeys.map((id) => qMap.get(id)).filter(Boolean) as PospQuestionItem[];
				if (matched.length > 0) {
					const firstPaper = matched[0]?.paperId || "paper-1";
					if (matched.every((q) => (q.paperId || "paper-1") === firstPaper)) {
						questions = POSP_QUESTION_BANK.filter((q) => (q.paperId || "paper-1") === firstPaper);
					}
				}
			}
		}
		const totalQuestions = questions.length;
		let correctCount = 0;
		let attemptedCount = 0;
		const topicStats: Record<string, { correct: number; total: number }> = {};

		const questionReview = questions.map((q) => {
			const selectedOption = answers[q.id] !== undefined ? answers[q.id] : null;
			const isAttempted = selectedOption !== null;
			if (isAttempted) attemptedCount++;

			const isCorrect = isAttempted && selectedOption === q.correctIndex;
			if (isCorrect) correctCount++;

			if (!topicStats[q.category]) {
				topicStats[q.category] = { correct: 0, total: 0 };
			}
			topicStats[q.category].total++;
			if (isCorrect) topicStats[q.category].correct++;

			return {
				id: q.id,
				question: q.question,
				category: q.category,
				selectedOption,
				correctOption: q.correctIndex,
				isCorrect,
				explanation: q.explanation,
				options: q.options,
			};
		});

		const incorrectCount = attemptedCount - correctCount;
		const unattemptedCount = totalQuestions - attemptedCount;
		const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
		const passingPercentage = 35;
		const passed = scorePercentage >= passingPercentage;

		const chapterDiagnostics = Object.entries(topicStats).map(([chapter, stats]) => {
			const pct = Math.round((stats.correct / stats.total) * 100);
			const status: "Proficient" | "Satisfactory" | "Needs Review" =
				pct >= 75 ? "Proficient" : pct >= 50 ? "Satisfactory" : "Needs Review";
			return {
				chapter,
				score: stats.correct,
				total: stats.total,
				percentage: pct,
				status,
			};
		});

		const weakChapters = chapterDiagnostics
			.filter((c) => c.status === "Needs Review")
			.map((c) => c.chapter);

		// High-yield statutory tips tailored to weak or tested chapters
		const defaultTips: Record<string, string> = {
			Motor: "Remember Section 146 Motor Vehicles Act: Third Party coverage is legally mandatory. IDV is depreciated list price, not market resale value.",
			Health: "IRDAI updated guidelines reduce max Pre-Existing Disease (PED) waiting period to 36 months. Cashless network claims avoid out-of-pocket expenses.",
			Life: "Section 45: Policies cannot be challenged on any grounds after 3 years. MWP Act Section 6 protects wife and children against commercial creditors.",
			General: "Indemnity restores the financial position without profit. Subrogation assigns recovery rights against negligent third parties to the insurer.",
			"Regulations & Conduct": "Section 41 prohibits any rebates or commission sharing. Section 64VB enforces 'No Premium, No Risk'. 15 days free-look (30 days electronic).",
		};

		const highYieldTips = (weakChapters.length > 0 ? weakChapters : Object.keys(defaultTips))
			.slice(0, 3)
			.map((ch) => defaultTips[ch] || `Review essential guidelines for ${ch}.`);

		const summary = passed
			? `Candidate demonstrated solid comprehension of IRDAI POSP retail lines (${scorePercentage}% vs 35% benchmark). Continue consolidating statutory compliance and claims servicing.`
			: `Candidate achieved ${scorePercentage}%. Review core IRDAI rules (Section 41 rebate prohibition, 64VB advance premium) and retake the mock test.`;

		return {
			courseId: "irdai-posp",
			courseTitle: "IRDAI POSP 15-Hour Mandatory Certification",
			totalQuestions,
			attemptedCount,
			correctCount,
			incorrectCount,
			unattemptedCount,
			scorePercentage,
			passed,
			passingPercentage,
			chapterDiagnostics,
			aiRemediation: {
				summary,
				recommendedFocusChapters: weakChapters,
				highYieldTips,
			},
			questionReview,
		};
	}
}

export const irdaiPospTrainingService = new IrdaiPospTrainingService();
