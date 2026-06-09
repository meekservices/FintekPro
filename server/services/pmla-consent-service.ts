/**
 * PMLA Consent Text Service (Task 13)
 *
 * Provides PMLA-compliant consent text and declarations
 * Prevention of Money Laundering Act, 2002 compliance
 */

interface ConsentText {
	id: string;
	type:
		| "aadhaar_consent"
		| "pan_consent"
		| "ckyc_consent"
		| "fatca_declaration"
		| "risk_disclosure"
		| "terms_conditions"
		| "privacy_policy"
		| "nominee_declaration"
		| "ubo_declaration";
	version: string;
	effectiveFrom: Date;
	title: string;
	shortText: string;
	fullText: string;
	mandatoryCheckboxes: string[];
	regulatoryReferences: string[];
	lastUpdated: Date;
}

interface ConsentRecord {
	userId: string;
	consentId: string;
	consentType: ConsentText["type"];
	version: string;
	acceptedAt: Date;
	ipAddress: string;
	deviceFingerprint?: string;
	checkboxesAccepted: string[];
	signature?: string;
}

class PMLAConsentService {
	private consents: Map<string, ConsentText> = new Map();
	private userConsents: Map<string, ConsentRecord[]> = new Map();

	constructor() {
		this.initializeConsentTexts();
	}

	private initializeConsentTexts(): void {
		// Aadhaar eKYC Consent (PMLA/UIDAI Compliant)
		this.consents.set("aadhaar_consent_v1", {
			id: "aadhaar_consent_v1",
			type: "aadhaar_consent",
			version: "1.0",
			effectiveFrom: new Date("2024-01-01"),
			title: "Aadhaar Verification Consent",
			shortText:
				"I voluntarily consent to share my Aadhaar details for identity verification.",
			fullText: `AADHAAR VERIFICATION CONSENT

I hereby voluntarily provide my consent to FintekPro Private Limited ("Company") to:

1. COLLECTION & USE OF AADHAAR DATA
   a) Collect my Aadhaar number and/or Virtual ID
   b) Authenticate my identity using Aadhaar-based e-KYC services
   c) Obtain my demographic information (Name, Date of Birth, Gender, Address) from UIDAI
   d) Store the reference ID and demographic data for regulatory compliance

2. PURPOSE OF COLLECTION
   This data is being collected for the following purposes as mandated under:
   - Prevention of Money Laundering Act, 2002 (PMLA)
   - SEBI KYC Requirements
   - RBI Know Your Customer (KYC) Guidelines
   - Income Tax Act, 1961 (PAN-Aadhaar Linking)

3. VOLUNTARY CONSENT
   I understand that:
   a) Providing Aadhaar is voluntary
   b) My Aadhaar number will NOT be stored (only reference ID will be retained)
   c) I can choose offline Aadhaar verification as an alternative
   d) My biometrics will NOT be collected or stored

4. DATA PROTECTION
   The Company will:
   a) Maintain confidentiality of my Aadhaar data
   b) Use the data only for KYC verification purposes
   c) Not share my Aadhaar with third parties except as required by law
   d) Delete/anonymize the data as per retention policies

5. RIGHTS & WITHDRAWAL
   I have the right to:
   a) Access my data held by the Company
   b) Request correction of inaccurate data
   c) Withdraw this consent (subject to legal/regulatory requirements)

I have read and understood the above consent terms.`,
			mandatoryCheckboxes: [
				"I voluntarily consent to share my Aadhaar for identity verification",
				"I understand my Aadhaar number will not be stored",
				"I confirm my demographic details may be fetched from UIDAI",
			],
			regulatoryReferences: [
				"Prevention of Money Laundering Act, 2002",
				"Aadhaar (Targeted Delivery of Financial and Other Subsidies) Act, 2016",
				"UIDAI Authentication Guidelines",
				"SEBI Master Circular on KYC",
			],
			lastUpdated: new Date("2024-06-01"),
		});

		// PAN Verification Consent
		this.consents.set("pan_consent_v1", {
			id: "pan_consent_v1",
			type: "pan_consent",
			version: "1.0",
			effectiveFrom: new Date("2024-01-01"),
			title: "PAN Verification Consent",
			shortText: "I consent to verify my PAN details for KYC compliance.",
			fullText: `PAN VERIFICATION CONSENT

I hereby provide consent to FintekPro Private Limited to:

1. Verify my Permanent Account Number (PAN) with authorized verification agencies
2. Obtain PAN-linked information including:
   - Name as per Income Tax records
   - PAN status (Active/Inoperative)
   - PAN-Aadhaar linkage status
   - Date of Birth/Incorporation

2. PURPOSE
   This verification is required under:
   - Income Tax Act, 1961
   - SEBI KYC Requirements
   - PMLA, 2002

3. DECLARATION
   I declare that:
   - The PAN provided belongs to me/my entity
   - The information provided is true and correct
   - I am not using anyone else's PAN for this registration

4. ACKNOWLEDGMENT
   I understand that:
   - Providing incorrect PAN is a punishable offense
   - Inoperative PAN may restrict access to services
   - PAN-Aadhaar linking is mandatory as per Income Tax rules`,
			mandatoryCheckboxes: [
				"I consent to verify my PAN with authorized agencies",
				"I declare that the PAN provided belongs to me",
				"I understand providing incorrect PAN is a punishable offense",
			],
			regulatoryReferences: [
				"Income Tax Act, 1961 - Section 139A",
				"CBDT Notification for PAN-Aadhaar Linking",
				"SEBI KYC Requirements",
			],
			lastUpdated: new Date("2024-06-01"),
		});

		// CKYC Consent
		this.consents.set("ckyc_consent_v1", {
			id: "ckyc_consent_v1",
			type: "ckyc_consent",
			version: "1.0",
			effectiveFrom: new Date("2024-01-01"),
			title: "Central KYC (CKYC) Consent",
			shortText:
				"I consent to fetch/upload my KYC records from/to the Central KYC Registry.",
			fullText: `CENTRAL KYC REGISTRY CONSENT

I hereby authorize FintekPro Private Limited to:

1. CKYC DOWNLOAD
   - Search and download my existing KYC records from the Central KYC Registry (CERSAI)
   - Use the downloaded CKYC records for account opening and services

2. CKYC UPLOAD
   - Upload my verified KYC records to the Central KYC Registry
   - This creates a CKYC Identifier (KIN) that can be used across financial institutions

3. BENEFITS
   - Unified KYC across all registered financial institutions
   - Reduced documentation for future account openings
   - Faster processing of financial transactions

4. DATA SHARING
   I understand that my KYC data may be accessed by other registered financial institutions using my CKYC KIN, PAN, or other identifiers as per CERSAI guidelines.

5. REGULATORY FRAMEWORK
   This consent is in accordance with:
   - PMLA (Maintenance of Records) Rules, 2005
   - Reserve Bank of India (KYC) Directions
   - SEBI Master Circular on KYC`,
			mandatoryCheckboxes: [
				"I authorize download of my existing CKYC records",
				"I authorize upload of my verified KYC to Central KYC Registry",
				"I understand my KYC may be accessed by other financial institutions",
			],
			regulatoryReferences: [
				"PMLA (Maintenance of Records) Rules, 2005",
				"RBI Master Direction on KYC",
				"SEBI Master Circular on KYC",
			],
			lastUpdated: new Date("2024-06-01"),
		});

		// FATCA/CRS Declaration
		this.consents.set("fatca_declaration_v1", {
			id: "fatca_declaration_v1",
			type: "fatca_declaration",
			version: "1.0",
			effectiveFrom: new Date("2024-01-01"),
			title: "FATCA/CRS Self-Certification",
			shortText:
				"I certify my tax residency status under FATCA/CRS regulations.",
			fullText: `FATCA/CRS SELF-CERTIFICATION DECLARATION

FOREIGN ACCOUNT TAX COMPLIANCE ACT (FATCA) & 
COMMON REPORTING STANDARD (CRS) DECLARATION

Part 1: Tax Residency Information

I hereby certify that:

1. TAX RESIDENCY
   - I am a tax resident of India / [Other Country]
   - My Tax Identification Number (TIN) / PAN is: [PAN/TIN]

2. US PERSON STATUS (FATCA)
   I certify that I am / am NOT a US Person as defined under FATCA:
   - US Citizen or lawful permanent resident (Green Card holder)
   - Born in the United States
   - US Tax resident

3. CRS DECLARATION
   - I am / am NOT tax resident in any country other than India
   - If yes, I have provided details of all countries of tax residence

4. UNDERTAKING
   I undertake to:
   - Inform FintekPro within 30 days if my tax residency status changes
   - Provide updated self-certification if any information changes
   - Provide additional documentation if requested for compliance

5. CONSENT FOR REPORTING
   I consent to:
   - Reporting of my account information to Indian tax authorities
   - Exchange of information with tax authorities of my country of tax residence
   - Withholding as required under applicable tax laws

6. DECLARATION
   I declare that the information provided is true, correct, and complete. I understand that any false statement may result in penalties under applicable laws.`,
			mandatoryCheckboxes: [
				"I certify my tax residency information is true and correct",
				"I consent to reporting of my account information to tax authorities",
				"I undertake to inform of any change in tax residency status within 30 days",
			],
			regulatoryReferences: [
				"Income Tax Rules, 1962 - Rule 114F, 114G, 114H",
				"Foreign Account Tax Compliance Act (FATCA)",
				"Common Reporting Standard (CRS) - OECD",
				"CBDT Notification No. 62/2015",
			],
			lastUpdated: new Date("2024-06-01"),
		});

		// Risk Disclosure
		this.consents.set("risk_disclosure_v1", {
			id: "risk_disclosure_v1",
			type: "risk_disclosure",
			version: "1.0",
			effectiveFrom: new Date("2024-01-01"),
			title: "Investment Risk Disclosure",
			shortText:
				"I acknowledge the risks associated with investments in securities.",
			fullText: `INVESTMENT RISK DISCLOSURE DOCUMENT

I acknowledge and understand that:

1. MARKET RISKS
   - Investments in securities market are subject to market risks
   - Past performance is not indicative of future results
   - The value of investments may go up or down

2. SPECIFIC RISKS
   a) Equity: Price volatility, company-specific risks, liquidity risk
   b) Debt: Interest rate risk, credit risk, liquidity risk
   c) Mutual Funds: NAV fluctuations, scheme-specific risks
   d) Derivatives (F&O): High leverage, potential for significant losses
   e) Unlisted Securities: Illiquidity, valuation uncertainty, higher risk

3. NO GUARANTEE
   - There is no guarantee of returns on any investment
   - The Company does not guarantee any minimum returns
   - I may lose part or all of my invested capital

4. SUITABILITY
   - I have assessed my risk appetite and investment horizon
   - I understand the products I am investing in
   - I am making informed decisions based on my financial situation

5. PROFESSIONAL ADVICE
   - The Company's services do not constitute investment advice
   - I should consult a qualified financial advisor for personalized advice
   - I am responsible for my investment decisions

6. REGULATORY DISCLAIMER
   As per SEBI regulations:
   "Investment in securities market is subject to market risks. Read all related documents carefully before investing."`,
			mandatoryCheckboxes: [
				"I understand investments are subject to market risks",
				"I acknowledge there is no guarantee of returns",
				"I have assessed my risk appetite before investing",
				"I will read all related documents before investing",
			],
			regulatoryReferences: [
				"SEBI (Investment Advisers) Regulations, 2013",
				"SEBI Investor Charter",
				"AMFI Code of Conduct",
			],
			lastUpdated: new Date("2024-06-01"),
		});

		console.log(
			`📋 [PMLA Consent] Initialized ${this.consents.size} consent templates`,
		);
	}

	/**
	 * Get consent text by type
	 */
	getConsentText(type: ConsentText["type"]): ConsentText | null {
		for (const consent of this.consents.values()) {
			if (consent.type === type) {
				return consent;
			}
		}
		return null;
	}

	/**
	 * Get all consent texts
	 */
	getAllConsentTexts(): ConsentText[] {
		return Array.from(this.consents.values());
	}

	/**
	 * Record user consent
	 */
	recordConsent(
		userId: string,
		consentType: ConsentText["type"],
		ipAddress: string,
		checkboxesAccepted: string[],
		deviceFingerprint?: string,
		signature?: string,
	): ConsentRecord | null {
		const consentText = this.getConsentText(consentType);
		if (!consentText) return null;

		// Validate all mandatory checkboxes are accepted
		const missingCheckboxes = consentText.mandatoryCheckboxes.filter(
			(cb) => !checkboxesAccepted.includes(cb),
		);

		if (missingCheckboxes.length > 0) {
			console.log(
				`⚠️ [PMLA Consent] Missing mandatory checkboxes:`,
				missingCheckboxes,
			);
			return null;
		}

		const record: ConsentRecord = {
			userId,
			consentId: `${consentText.id}-${Date.now()}`,
			consentType,
			version: consentText.version,
			acceptedAt: new Date(),
			ipAddress,
			deviceFingerprint,
			checkboxesAccepted,
			signature,
		};

		const userRecords = this.userConsents.get(userId) || [];
		userRecords.push(record);
		this.userConsents.set(userId, userRecords);

		console.log(
			`✅ [PMLA Consent] Recorded ${consentType} consent for user ${userId.substring(0, 8)}...`,
		);

		return record;
	}

	/**
	 * Get user's consent history
	 */
	getUserConsents(userId: string): ConsentRecord[] {
		return this.userConsents.get(userId) || [];
	}

	/**
	 * Check if user has given consent for a type
	 */
	hasConsent(userId: string, consentType: ConsentText["type"]): boolean {
		const records = this.userConsents.get(userId) || [];
		return records.some((r) => r.consentType === consentType);
	}

	/**
	 * Get consent for specific type
	 */
	getConsentRecord(
		userId: string,
		consentType: ConsentText["type"],
	): ConsentRecord | null {
		const records = this.userConsents.get(userId) || [];
		return records.find((r) => r.consentType === consentType) || null;
	}

	/**
	 * Export consent audit trail
	 */
	exportConsentAudit(userId: string): {
		userId: string;
		totalConsents: number;
		consents: Array<{
			type: string;
			version: string;
			acceptedAt: Date;
			ipAddress: string;
		}>;
	} {
		const records = this.userConsents.get(userId) || [];

		return {
			userId,
			totalConsents: records.length,
			consents: records.map((r) => ({
				type: r.consentType,
				version: r.version,
				acceptedAt: r.acceptedAt,
				ipAddress: r.ipAddress,
			})),
		};
	}

	/**
	 * Get mandatory consents for KYC
	 */
	getMandatoryKYCConsents(): ConsentText["type"][] {
		return [
			"pan_consent",
			"aadhaar_consent",
			"ckyc_consent",
			"fatca_declaration",
			"risk_disclosure",
		];
	}

	/**
	 * Check if user has all mandatory consents
	 */
	hasAllMandatoryConsents(userId: string): {
		complete: boolean;
		missing: ConsentText["type"][];
	} {
		const mandatory = this.getMandatoryKYCConsents();
		const missing: ConsentText["type"][] = [];

		for (const type of mandatory) {
			if (!this.hasConsent(userId, type)) {
				missing.push(type);
			}
		}

		return {
			complete: missing.length === 0,
			missing,
		};
	}
}

export const pmlaConsentService = new PMLAConsentService();
export type { ConsentText, ConsentRecord };
