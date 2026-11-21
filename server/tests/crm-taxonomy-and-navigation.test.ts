import { describe, it, expect } from "vitest";
import { CRM_PORTAL_TAXONOMY } from "../../shared/types/crm-taxonomy";

describe("FintekPro CRM & Marketing Portal Taxonomy", () => {
	it("defines standardized taxonomy terms for PROSPECT, LEAD, ACTIVE_CLIENT, and NON_CLIENT", () => {
		expect(CRM_PORTAL_TAXONOMY.PROSPECT).toBeDefined();
		expect(CRM_PORTAL_TAXONOMY.LEAD).toBeDefined();
		expect(CRM_PORTAL_TAXONOMY.ACTIVE_CLIENT).toBeDefined();
		expect(CRM_PORTAL_TAXONOMY.NON_CLIENT).toBeDefined();
	});

	it("PROSPECT represents cold unverified contacts", () => {
		const prospect = CRM_PORTAL_TAXONOMY.PROSPECT;
		expect(prospect.badgeLabel).toBe("Cold Prospect");
		expect(prospect.shortDefinition).toContain("Cold / Unqualified");
		expect(prospect.peerReference).toContain("Salesforce Lead");
	});

	it("LEAD represents qualified opportunities with verified intent", () => {
		const lead = CRM_PORTAL_TAXONOMY.LEAD;
		expect(lead.badgeLabel).toBe("Qualified Lead");
		expect(lead.shortDefinition).toContain("Qualified Opportunity");
		expect(lead.peerReference).toContain("HubSpot");
	});

	it("ACTIVE_CLIENT represents KYC-verified investors or clients", () => {
		const client = CRM_PORTAL_TAXONOMY.ACTIVE_CLIENT;
		expect(client.badgeLabel).toBe("Active Client");
		expect(client.shortDefinition).toContain("KYC-Verified Customer");
		expect(client.peerReference).toContain("Zerodha");
	});

	it("NON_CLIENT represents the unified acquisition audience (Prospects + Leads)", () => {
		const nonClient = CRM_PORTAL_TAXONOMY.NON_CLIENT;
		expect(nonClient.badgeLabel).toBe("Non-Client Audience");
		expect(nonClient.shortDefinition).toContain("Combined Acquisition Target");
	});
});
