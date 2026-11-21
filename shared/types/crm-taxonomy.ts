/**
 * FintekPro CRM & Marketing Portal Taxonomy
 * Reference Standards: HubSpot, Salesforce Financial Services Cloud, NJ Wealth, Zerodha Partner
 *
 * DEFINITIONS & MATRIX:
 * 1. PROSPECT: Raw, unverified external contact (MCA directors, imported lists, cold inquiries). No prior 1-on-1 engagement.
 * 2. LEAD: Qualified prospect showing verified intent or assigned to Partner/CA, progressing through pipeline stages.
 * 3. ACTIVE CLIENT: KYC-verified user who has funded an account, holds AUM, or has active CA tax filings.
 * 4. NON-CLIENT: Any contact who is NOT an active client (Prospects + Leads). Target segment for acquisition campaigns.
 */

export type ContactCategory = 'prospect' | 'lead' | 'client';
export type AudienceType = 'all' | 'leads' | 'clients';

export interface TaxonomyDefinition {
	term: string;
	shortDefinition: string;
	fullDescription: string;
	peerReference: string;
	badgeLabel: string;
	badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
	colorScheme: {
		bg: string;
		text: string;
		border: string;
	};
	targetActions: string[];
}

export const CRM_PORTAL_TAXONOMY: Record<string, TaxonomyDefinition> = {
	PROSPECT: {
		term: "Prospect",
		shortDefinition: "Cold / Unqualified External Contact",
		fullDescription:
			"A raw, unverified contact sourced from MCA Director databases, imported CSVs, cold registries, or top-of-funnel web visits. No prior 1-on-1 engagement or confirmed investment intent.",
		peerReference: "Salesforce Lead (Unqualified) / HubSpot Subscriber & Cold Contact",
		badgeLabel: "Cold Prospect",
		badgeVariant: "outline",
		colorScheme: {
			bg: "bg-slate-500/10",
			text: "text-slate-400",
			border: "border-slate-500/30",
		},
		targetActions: [
			"Discovery & Enrichment",
			"Cold Outreach & Lead Magnet Broadcast",
			"Corporate Treasury Yield Hook",
			"Pre-qualification Call",
		],
	},
	LEAD: {
		term: "Lead (Qualified)",
		shortDefinition: "Qualified Opportunity with Verified Intent",
		fullDescription:
			"A contact who demonstrated financial interest (e.g. downloaded Portfolio X-Ray, replied to pitch, booked a meeting, or assigned to a Partner/CA). Moving actively through pipeline stages.",
		peerReference: "HubSpot MQL/SQL / Salesforce Opportunity / NJ Wealth Active Lead",
		badgeLabel: "Qualified Lead",
		badgeVariant: "secondary",
		colorScheme: {
			bg: "bg-amber-500/10",
			text: "text-amber-400",
			border: "border-amber-500/30",
		},
		targetActions: [
			"Advisory Discovery Call",
			"Custom Financial Proposal Builder",
			"WhatsApp 1-on-1 Follow-up",
			"KYC Onboarding Link Dispatch",
		],
	},
	ACTIVE_CLIENT: {
		term: "Active Client",
		shortDefinition: "KYC-Verified Customer with AUM or Active Filings",
		fullDescription:
			"An onboarded investor who completed full CKYC/KRA verification, holds an active UCC/folio with AUM, or has an ongoing CA tax/audit advisory engagement.",
		peerReference: "Zerodha Traded Client / NJ Wealth Invested Client / ClearTax Active Client",
		badgeLabel: "Active Client",
		badgeVariant: "default",
		colorScheme: {
			bg: "bg-blue-500/10",
			text: "text-blue-400",
			border: "border-blue-500/30",
		},
		targetActions: [
			"Portfolio Rebalancing & SIP Step-Up",
			"Quarterly Capital Gains Statement",
			"Advance Tax & GST Filing Alerts",
			"Market Volatility Briefs & Retention",
		],
	},
	NON_CLIENT: {
		term: "Non-Client Audience",
		shortDefinition: "Combined Acquisition Target (Prospects + Leads)",
		fullDescription:
			"All registered contacts who have NOT yet completed KYC or funded an account. Slicing campaigns by 'Non-Client' prevents spamming existing clients with basic promotional pitches.",
		peerReference: "Digital Marketing Acquisition Segment / Outbound Audience",
		badgeLabel: "Non-Client Audience",
		badgeVariant: "secondary",
		colorScheme: {
			bg: "bg-purple-500/10",
			text: "text-purple-400",
			border: "border-purple-500/30",
		},
		targetActions: [
			"Marketing Studio Acquisition Campaigns",
			"Portfolio Health Diagnostic Offer",
			"Direct-to-KYC Multi-Touch Nurturing",
		],
	},
};
