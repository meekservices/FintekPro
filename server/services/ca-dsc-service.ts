export interface DscRecord {
	id: string;
	partnerId: string;
	holderName: string;
	holderPanOrDin: string;
	holderType: "CA_PARTNER" | "CORPORATE_DIRECTOR" | "INDIVIDUAL_CLIENT";
	certifyingAuthority: "eMudhra" | "Capricorn" | "Vsign" | "Pantasign" | "IDSign";
	serialNumber: string;
	certificateClass: "Class 3 - Individual" | "Class 3 - Organization";
	validFrom: string;
	validTo: string;
	daysRemaining: number;
	status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";
	contactEmail?: string;
	contactMobile?: string;
	renewalOrdered?: boolean;
}

/**
 * Service to manage Class 3 Digital Signature Certificate (DSC) tokens,
 * validity periods, and expiration alerts for CAs and corporate clients.
 */
export class CADscService {
	// In-memory persistent demo registry seeded with default records
	private dscStore: Map<string, DscRecord[]> = new Map();

	constructor() {
		// Seed sample tokens for development
		const defaultTokens: DscRecord[] = [
			{
				id: "dsc-001",
				partnerId: "default",
				holderName: "Sangram Mohanty (Principal Partner)",
				holderPanOrDin: "ABCDE1234F",
				holderType: "CA_PARTNER",
				certifyingAuthority: "eMudhra",
				serialNumber: "EM-2024-9847291038",
				certificateClass: "Class 3 - Individual",
				validFrom: "2024-04-01",
				validTo: "2026-03-31",
				daysRemaining: 145,
				status: "ACTIVE",
			},
			{
				id: "dsc-002",
				partnerId: "default",
				holderName: "Rajesh Kumar (Director - Acme Fintek)",
				holderPanOrDin: "DIN-08472910",
				holderType: "CORPORATE_DIRECTOR",
				certifyingAuthority: "Capricorn",
				serialNumber: "CP-2023-1192847291",
				certificateClass: "Class 3 - Organization",
				validFrom: "2023-11-15",
				validTo: "2025-11-14",
				daysRemaining: 8,
				status: "EXPIRING_SOON",
				contactEmail: "rajesh@acmefintek.com",
				contactMobile: "+919876543210",
			},
			{
				id: "dsc-003",
				partnerId: "default",
				holderName: "Priya Sharma (Director - Innovate Labs)",
				holderPanOrDin: "DIN-09182736",
				holderType: "CORPORATE_DIRECTOR",
				certifyingAuthority: "Vsign",
				serialNumber: "VS-2023-5566778899",
				certificateClass: "Class 3 - Organization",
				validFrom: "2023-01-10",
				validTo: "2025-01-09",
				daysRemaining: -300,
				status: "EXPIRED",
				contactEmail: "priya@innovatelabs.in",
			},
		];
		this.dscStore.set("default", defaultTokens);
	}

	/**
	 * Lists all registered DSC tokens for a partner with recalculated days remaining.
	 *
	 * @param partnerId CA Partner ID
	 */
	listTokens(partnerId: string): DscRecord[] {
		const list = this.dscStore.get(partnerId) || this.dscStore.get("default") || [];
		const today = new Date();

		return list.map((token) => {
			const expiry = new Date(token.validTo);
			const diffMs = expiry.getTime() - today.getTime();
			const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

			let status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" = "ACTIVE";
			if (daysRemaining <= 0) {
				status = "EXPIRED";
			} else if (daysRemaining <= 30) {
				status = "EXPIRING_SOON";
			}

			return {
				...token,
				daysRemaining,
				status,
			};
		});
	}

	/**
	 * Registers a new or renewed DSC token.
	 *
	 * @param partnerId CA Partner ID
	 * @param token Token details
	 */
	registerToken(partnerId: string, token: Omit<DscRecord, "id" | "daysRemaining" | "status">): DscRecord {
		const today = new Date();
		const expiry = new Date(token.validTo);
		const diffMs = expiry.getTime() - today.getTime();
		const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

		let status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" = "ACTIVE";
		if (daysRemaining <= 0) {
			status = "EXPIRED";
		} else if (daysRemaining <= 30) {
			status = "EXPIRING_SOON";
		}

		const newRecord: DscRecord = {
			...token,
			id: `dsc-${Date.now()}`,
			partnerId,
			daysRemaining,
			status,
		};

		const existing = this.dscStore.get(partnerId) || [];
		existing.push(newRecord);
		this.dscStore.set(partnerId, existing);

		return newRecord;
	}

	/**
	 * Generates a WhatsApp renewal reminder template string for an expiring DSC.
	 *
	 * @param token Target DSC record
	 * @param caFirmName CA firm or advisor name
	 */
	generateWhatsAppAlertText(token: DscRecord, caFirmName: string): string {
		return `Dear ${token.holderName},\n\nThis is an urgent compliance reminder from ${caFirmName}. Your Class 3 Digital Signature Certificate (DSC Serial: ${token.serialNumber}) is due to expire on ${token.validTo} (${token.daysRemaining > 0 ? `${token.daysRemaining} days left` : "EXPIRED"}).\n\nPlease initiate renewal immediately to prevent disruptions in statutory ROC filings and Income Tax return signing.\n\nReply to this message or contact us to renew with token USB delivery in 24 hours.`;
	}
}

export const caDscService = new CADscService();

