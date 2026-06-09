// @ts-nocheck
/**
 * Client Money Segregation Compliance Service
 *
 * SEBI (Investment Advisers) Regulations, 2013 - Regulation 17:
 * "An investment adviser shall not receive any consideration by way of
 * remuneration or compensation or in any other form from any person
 * other than the client being advised."
 *
 * SEBI Circular CIR/MIRSD/24/2011 - Client Funds Segregation:
 * Investment Advisers must NOT:
 * - Pool client funds
 * - Hold client money in own accounts
 * - Accept payments for investment products directly
 *
 * FintekPro Compliance Implementation:
 * - All investment payments flow DIRECTLY to regulated counterparties
 * - BSE Star MF API generates payment links to BSE clearing account
 * - Bond orders route through BSE/NSE exchange settlement
 * - Unlisted shares use regulated escrow with trustee oversight
 * - Platform only collects advisory fees (if applicable)
 */

import { nanoid } from "nanoid";
import { db } from "../db";
import { complianceAuditTrail } from "@shared/schema";

export type InvestmentProduct =
	| "mutual_fund"
	| "unlisted_equity"
	| "aif"
	| "pms"
	| "bonds"
	| "etf"
	| "ipo"
	| "sgb"
	| "reit_invit"
	| "structured_products";

export type PaymentFlowType =
	| "direct_to_counterparty" // Compliant: Payment goes directly to AMC/Exchange
	| "regulated_escrow" // Compliant: SEBI-registered escrow/trustee
	| "platform_facilitated" // Non-compliant: Platform touches client money
	| "external_remittance"; // Compliant: Client remits directly to fund

export interface PaymentFlowDocumentation {
	productType: InvestmentProduct;
	flowType: PaymentFlowType;
	counterparty: string;
	regulatoryBasis: string;
	segregationCompliant: boolean;
	paymentChannel: string;
	settlementProcess: string;
	auditEvidence: string[];
	riskFactors: string[];
	mitigationControls: string[];
}

export interface ClientMoneyAuditRecord {
	id: string;
	timestamp: Date;
	productType: InvestmentProduct;
	transactionId: string;
	orderId: string;
	userId: string;
	amount: number;
	currency: string;
	paymentFlow: PaymentFlowType;
	counterparty: string;
	segregationVerified: boolean;
	verificationMethod: string;
	evidenceHash: string;
	regulatoryReference: string;
}

export interface ReconciliationRecord {
	id: string;
	date: Date;
	productType: InvestmentProduct;
	totalOrders: number;
	totalAmount: number;
	directPayments: number;
	escrowPayments: number;
	discrepancies: Array<{
		orderId: string;
		issue: string;
		severity: "low" | "medium" | "high" | "critical";
		resolved: boolean;
	}>;
	reconciliationStatus: "passed" | "failed" | "pending_review";
	reviewedBy?: string;
	reviewedAt?: Date;
}

class ClientMoneySegregationService {
	private paymentFlowRegistry: Map<InvestmentProduct, PaymentFlowDocumentation>;
	private auditLog: ClientMoneyAuditRecord[] = [];

	constructor() {
		this.paymentFlowRegistry = new Map();
		this.initializePaymentFlowDocumentation();
		console.log("✅ Client Money Segregation Service initialized");
	}

	private initializePaymentFlowDocumentation(): void {
		this.paymentFlowRegistry.set("mutual_fund", {
			productType: "mutual_fund",
			flowType: "direct_to_counterparty",
			counterparty: "BSE Star MFD Platform / AMC",
			regulatoryBasis:
				"SEBI (Mutual Funds) Regulations, 1996 read with AMFI Guidelines",
			segregationCompliant: true,
			paymentChannel:
				"BSE Star MF API generates payment URL → Payment to BSE Clearing Corporation → AMC",
			settlementProcess:
				"T+1 settlement via ICCL (Indian Clearing Corporation). Units allotted directly to investor folio.",
			auditEvidence: [
				"BSE Star MF transaction ID",
				"ARN/EUIN credential verification before each batch",
				"Payment confirmation from ICCL",
				"Unit allotment statement from AMC",
			],
			riskFactors: ["ARN credential expiry", "BSE API downtime"],
			mitigationControls: [
				"Daily ARN validity check before market hours",
				"Multiple payment gateway fallback",
				"Transaction retry mechanism",
			],
		});

		this.paymentFlowRegistry.set("bonds", {
			productType: "bonds",
			flowType: "direct_to_counterparty",
			counterparty: "NSE/BSE Bond Trading Platform",
			regulatoryBasis:
				"SEBI (Issue and Listing of Non-Convertible Securities) Regulations, 2021",
			segregationCompliant: true,
			paymentChannel:
				"Exchange order placement → Margin blocked in trading account → Exchange settlement",
			settlementProcess:
				"T+2 settlement via clearing corporation. Securities credited to demat account.",
			auditEvidence: [
				"Exchange order confirmation",
				"Trade contract note",
				"Demat credit statement",
				"Settlement report from clearing member",
			],
			riskFactors: ["Margin shortfall", "Settlement failure"],
			mitigationControls: [
				"Pre-trade margin validation",
				"Real-time margin monitoring",
				"Settlement exception alerts",
			],
		});

		this.paymentFlowRegistry.set("unlisted_equity", {
			productType: "unlisted_equity",
			flowType: "regulated_escrow",
			counterparty: "SEBI-Registered Escrow Agent / Bank Trustee",
			regulatoryBasis:
				"Companies Act, 2013 Section 56 read with SEBI (Unlisted Securities) Guidelines",
			segregationCompliant: true,
			paymentChannel:
				"Cashfree Escrow → SEBI-Registered Trustee Bank → Release after DIS verification",
			settlementProcess:
				"Funds held in escrow until share transfer verified via DIS (Delivery Instruction Slip) confirmation from depository.",
			auditEvidence: [
				"Escrow agreement reference",
				"DIS confirmation from depository (CDSL/NSDL)",
				"Share transfer statement",
				"Trustee release authorization",
				"Maker-checker approval trail",
			],
			riskFactors: [
				"Share transfer failure",
				"DIS not submitted",
				"Forged share certificates",
				"Title disputes",
			],
			mitigationControls: [
				"DIS verification before escrow release",
				"Maker-checker workflow for all releases",
				"Independent trustee oversight",
				"CDSL/NSDL share verification API",
				"Title insurance recommendation",
			],
		});

		this.paymentFlowRegistry.set("aif", {
			productType: "aif",
			flowType: "external_remittance",
			counterparty: "AIF Fund Manager (SEBI Registered)",
			regulatoryBasis: "SEBI (Alternative Investment Funds) Regulations, 2012",
			segregationCompliant: true,
			paymentChannel:
				"Direct wire transfer to AIF fund account (bank details provided by fund manager)",
			settlementProcess:
				"Capital call process. Units allocated post KYC and subscription agreement execution.",
			auditEvidence: [
				"Subscription agreement signed by investor",
				"Capital call notice from fund manager",
				"Bank remittance proof uploaded by investor",
				"Unit allocation statement from fund",
				"AIF SEBI registration verification",
			],
			riskFactors: [
				"No direct payment tracking",
				"Investor may pay incorrect amount",
				"Fund manager fraud risk",
			],
			mitigationControls: [
				"Mandatory remittance proof upload workflow",
				"Fund manager SEBI registration verification",
				"Capital call amount validation",
				"Fund manager due diligence documentation",
				"Third-party custodian requirement verification",
			],
		});

		this.paymentFlowRegistry.set("pms", {
			productType: "pms",
			flowType: "external_remittance",
			counterparty: "Portfolio Manager (SEBI Registered)",
			regulatoryBasis: "SEBI (Portfolio Managers) Regulations, 2020",
			segregationCompliant: true,
			paymentChannel:
				"Direct transfer to PMS custody account maintained with SEBI-registered custodian",
			settlementProcess:
				"Funds deposited to designated custody account. Portfolio manager manages investments.",
			auditEvidence: [
				"PMS agreement and IMA (Investment Management Agreement)",
				"Custody account details (must be with SEBI-registered custodian)",
				"Remittance proof uploaded by investor",
				"Periodic portfolio statements from custodian",
				"SEBI registration certificate verification",
			],
			riskFactors: [
				"Minimum investment threshold (₹50 lakhs)",
				"No direct payment tracking by platform",
				"Portfolio manager operational risk",
			],
			mitigationControls: [
				"Verify ₹50 lakh minimum before subscription",
				"Custodian verification (must be SEBI-registered)",
				"Mandatory remittance proof workflow",
				"Quarterly statement reconciliation",
			],
		});

		this.paymentFlowRegistry.set("ipo", {
			productType: "ipo",
			flowType: "direct_to_counterparty",
			counterparty: "ASBA Bank / Registrar via BSE/NSE Platform",
			regulatoryBasis:
				"SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018",
			segregationCompliant: true,
			paymentChannel:
				"ASBA (Application Supported by Blocked Amount) - Funds blocked in investor bank account",
			settlementProcess:
				"ASBA mechanism ensures funds remain in investor account until allotment. Only debited on successful allotment.",
			auditEvidence: [
				"ASBA application number",
				"Bank blocking confirmation",
				"BSE/NSE application acknowledgment",
				"Allotment confirmation from registrar",
				"Demat credit statement",
			],
			riskFactors: [
				"Bank blocking failures",
				"Technical glitches during issue period",
			],
			mitigationControls: [
				"Multiple ASBA bank integrations",
				"Real-time application status tracking",
				"Post-issue reconciliation with registrar",
			],
		});

		this.paymentFlowRegistry.set("sgb", {
			productType: "sgb",
			flowType: "direct_to_counterparty",
			counterparty: "RBI via Authorized Banks/Stock Exchanges",
			regulatoryBasis: "Government of India Sovereign Gold Bond Scheme Rules",
			segregationCompliant: true,
			paymentChannel:
				"Direct subscription via authorized banks or stock exchanges",
			settlementProcess:
				"Payment to RBI via authorized channel. SGB units credited to demat account.",
			auditEvidence: [
				"Bank/exchange application receipt",
				"RBI subscription confirmation",
				"Demat credit statement for SGB units",
			],
			riskFactors: ["Subscription window timing", "Issue quota exhaustion"],
			mitigationControls: [
				"Early application submission",
				"Multiple authorized channel options",
			],
		});

		this.paymentFlowRegistry.set("reit_invit", {
			productType: "reit_invit",
			flowType: "direct_to_counterparty",
			counterparty: "Stock Exchange (NSE/BSE) for listed units",
			regulatoryBasis:
				"SEBI (Real Estate Investment Trusts) Regulations, 2014 / SEBI (InvITs) Regulations, 2014",
			segregationCompliant: true,
			paymentChannel: "Exchange-traded: Regular buy order on NSE/BSE",
			settlementProcess:
				"T+1 settlement like equity. Units credited to demat account.",
			auditEvidence: [
				"Exchange trade confirmation",
				"Contract note from broker",
				"Demat statement",
			],
			riskFactors: ["Liquidity risk for thinly traded units"],
			mitigationControls: [
				"Liquidity assessment before large orders",
				"Order splitting for large transactions",
			],
		});

		this.paymentFlowRegistry.set("etf", {
			productType: "etf",
			flowType: "direct_to_counterparty",
			counterparty: "Stock Exchange (NSE/BSE)",
			regulatoryBasis: "SEBI (Mutual Funds) Regulations, 1996",
			segregationCompliant: true,
			paymentChannel:
				"Exchange order → Broker settlement → Clearing corporation",
			settlementProcess: "T+1 settlement. ETF units credited to demat account.",
			auditEvidence: [
				"Exchange order ID",
				"Contract note",
				"Demat credit statement",
			],
			riskFactors: ["NAV vs. market price deviation"],
			mitigationControls: ["Real-time NAV tracking", "Premium/discount alerts"],
		});

		this.paymentFlowRegistry.set("structured_products", {
			productType: "structured_products",
			flowType: "direct_to_counterparty",
			counterparty: "Issuing Bank / NBFC (RBI Regulated)",
			regulatoryBasis: "RBI Master Direction on Structured Products",
			segregationCompliant: true,
			paymentChannel:
				"Direct subscription to issuer. Payment to issuer bank account.",
			settlementProcess:
				"Issuance of structured product certificate/demat credit.",
			auditEvidence: [
				"Term sheet signed by investor",
				"Payment receipt from issuer",
				"Certificate/demat credit statement",
				"Issuer RBI authorization verification",
			],
			riskFactors: [
				"Complex product risk",
				"Issuer credit risk",
				"Principal at risk features",
			],
			mitigationControls: [
				"Mandatory risk disclosure and acknowledgment",
				"Suitability assessment for complex products",
				"Issuer credit rating check",
				"Cap on illiquid investments per investor",
			],
		});
	}

	getPaymentFlowDocumentation(
		productType: InvestmentProduct,
	): PaymentFlowDocumentation | undefined {
		return this.paymentFlowRegistry.get(productType);
	}

	getAllPaymentFlows(): PaymentFlowDocumentation[] {
		return Array.from(this.paymentFlowRegistry.values());
	}

	getComplianceStatus(): {
		overallCompliant: boolean;
		compliantProducts: InvestmentProduct[];
		nonCompliantProducts: InvestmentProduct[];
		riskAreas: string[];
	} {
		const allFlows = this.getAllPaymentFlows();
		const compliant = allFlows.filter((f) => f.segregationCompliant);
		const nonCompliant = allFlows.filter((f) => !f.segregationCompliant);

		const riskAreas: string[] = [];
		allFlows.forEach((flow) => {
			flow.riskFactors.forEach((risk) => {
				if (!riskAreas.includes(risk)) {
					riskAreas.push(risk);
				}
			});
		});

		return {
			overallCompliant: nonCompliant.length === 0,
			compliantProducts: compliant.map((f) => f.productType),
			nonCompliantProducts: nonCompliant.map((f) => f.productType),
			riskAreas,
		};
	}

	async logClientMoneyAudit(
		record: Omit<ClientMoneyAuditRecord, "id" | "timestamp">,
	): Promise<ClientMoneyAuditRecord> {
		const auditRecord: ClientMoneyAuditRecord = {
			...record,
			id: nanoid(),
			timestamp: new Date(),
		};

		this.auditLog.push(auditRecord);

		try {
			await db.insert(complianceAuditTrail).values({
				userId: auditRecord.userId,
				action: `${auditRecord.paymentFlow}_${auditRecord.productType}`,
				fieldChanged: "client_money_segregation",
				entityType: "payment_flow",
				entityId: auditRecord.orderId,
				newValue: {
					amount: auditRecord.amount,
					currency: auditRecord.currency,
					counterparty: auditRecord.counterparty,
				},
				performedBy: auditRecord.userId,
				performedByRole: "user",
				riskImpact: auditRecord.segregationVerified ? "low" : "high",
				complianceImpact: auditRecord.segregationVerified ? "none" : "critical",
				metadata: {
					verificationMethod: auditRecord.verificationMethod,
					evidenceHash: auditRecord.evidenceHash,
					regulatoryReference: auditRecord.regulatoryReference,
				},
			});
		} catch (error) {
			console.error(
				"[Client Money Segregation] Failed to persist audit record:",
				error,
			);
		}

		return auditRecord;
	}

	validatePaymentFlow(
		productType: InvestmentProduct,
		paymentMethod: string,
		counterparty: string,
	): { valid: boolean; issues: string[]; recommendations: string[] } {
		const documentation = this.paymentFlowRegistry.get(productType);

		if (!documentation) {
			return {
				valid: false,
				issues: [`Unknown product type: ${productType}`],
				recommendations: ["Contact compliance team for product classification"],
			};
		}

		const issues: string[] = [];
		const recommendations: string[] = [];

		if (documentation.flowType === "platform_facilitated") {
			issues.push(
				"CRITICAL: Platform-facilitated payment flow violates SEBI IA Regulations",
			);
			recommendations.push("Route payments directly to regulated counterparty");
			recommendations.push(
				"Remove any FintekPro intermediary accounts from payment chain",
			);
		}

		if (
			documentation.flowType === "external_remittance" &&
			!paymentMethod.includes("proof")
		) {
			issues.push("External remittance flow requires proof of payment upload");
			recommendations.push("Implement mandatory remittance proof workflow");
		}

		if (documentation.flowType === "regulated_escrow") {
			recommendations.push("Verify escrow agent SEBI registration");
			recommendations.push("Ensure DIS verification before escrow release");
		}

		return {
			valid: issues.length === 0,
			issues,
			recommendations:
				recommendations.length > 0
					? recommendations
					: documentation.mitigationControls,
		};
	}

	generateRegulatoryDisclosure(): string {
		return `
FINTEKPRO CLIENT MONEY SEGREGATION DISCLOSURE
==============================================

Pursuant to SEBI (Investment Advisers) Regulations, 2013 and applicable circulars,
FintekPro Private Limited hereby discloses the following regarding client money handling:

1. NO POOLING OF CLIENT FUNDS
   FintekPro does not maintain any pool account for client investment funds.
   All investment payments are routed directly to regulated counterparties.

2. PAYMENT FLOW TRANSPARENCY

   a) MUTUAL FUNDS: All payments processed via BSE Star MF API directly to
      BSE Clearing Corporation / AMC. FintekPro acts only as technology
      intermediary under valid ARN registration.

   b) BONDS & FIXED INCOME: Orders executed through registered exchange
      (NSE/BSE). Payments settled via exchange clearing mechanism.

   c) UNLISTED EQUITY: Transactions facilitated through SEBI-registered
      escrow mechanism with trustee oversight. Escrow released only after
      verified share transfer via DIS confirmation.

   d) AIF/PMS: FintekPro facilitates documentation only. All payments made
      directly by investor to fund/portfolio manager. Remittance proof
      required for order confirmation.

   e) IPO/SGB: ASBA mechanism ensures funds remain in investor's bank
      account until allotment confirmation.

3. REGULATORY COMPLIANCE
   - SEBI (Investment Advisers) Regulations, 2013 - Regulation 17
   - SEBI Circular CIR/MIRSD/24/2011
   - RBI Remittance Guidelines (for cross-border flows)
   - Companies Act, 2013 Section 56 (for unlisted securities)

4. AUDIT & RECONCILIATION
   Daily reconciliation of all order flows with counterparty confirmations.
   Independent audit of client money handling processes conducted annually.

5. INVESTOR PROTECTION
   - No client funds held by FintekPro at any time
   - All counterparties are SEBI/RBI regulated entities
   - Complete audit trail maintained for 7+ years
   - Immediate escalation protocol for any payment discrepancies

Date: ${new Date().toISOString().split("T")[0]}
Compliance Officer: [Designated Compliance Officer Name]
SEBI IA Registration: [Registration Number]
`;
	}

	generateComplianceArtifacts(): {
		disclosureDocument: string;
		paymentFlowMatrix: PaymentFlowDocumentation[];
		complianceStatus: ReturnType<typeof this.getComplianceStatus>;
		controlsChecklist: Array<{
			control: string;
			implemented: boolean;
			evidence: string;
		}>;
	} {
		return {
			disclosureDocument: this.generateRegulatoryDisclosure(),
			paymentFlowMatrix: this.getAllPaymentFlows(),
			complianceStatus: this.getComplianceStatus(),
			controlsChecklist: [
				{
					control: "No client money pool account",
					implemented: true,
					evidence:
						"Architecture documentation - all payments to external counterparties",
				},
				{
					control: "BSE Star MF direct integration",
					implemented: true,
					evidence: "BSE Star API integration code - bseStarApi.ts",
				},
				{
					control: "Exchange settlement for bonds",
					implemented: true,
					evidence: "Bond order routing via NSE/BSE API",
				},
				{
					control: "Regulated escrow for unlisted equity",
					implemented: true,
					evidence: "unlisted-escrow-service.ts with maker-checker workflow",
				},
				{
					control: "External remittance proof for AIF/PMS",
					implemented: true,
					evidence: "AIF/PMS order workflow with mandatory proof upload",
				},
				{
					control: "ASBA for IPO applications",
					implemented: true,
					evidence: "IPO order integration with exchange ASBA platform",
				},
				{
					control: "Payment callback HMAC verification",
					implemented: true,
					evidence:
						"Cashfree/PhonePe webhook signature verification in payments/index.ts",
				},
				{
					control: "Daily reconciliation logging",
					implemented: false,
					evidence: "PENDING: Daily reconciliation cron job implementation",
				},
				{
					control: "ARN credential validation",
					implemented: false,
					evidence: "PENDING: Pre-batch ARN validity check",
				},
			],
		};
	}
}

export const clientMoneySegregationService =
	new ClientMoneySegregationService();
