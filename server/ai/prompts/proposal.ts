import type { Prompt } from "./index";

export const proposalPrompts: Record<string, Prompt> = {
	"proposal.aif_pms": {
		name: "proposal.aif_pms",
		version: "1.0.0",
		lastReviewedAt: "2025-01-15",
		reviewedBy: "compliance-team",
		regulatoryCategory: "investment_advice",
		systemPrompt: `You are a SEBI-registered investment advisor analyzing Alternative Investment Funds (AIFs) and Portfolio Management Services (PMS) for investor recommendations.`,
	},

	"proposal.bond": {
		name: "proposal.bond",
		version: "1.0.0",
		lastReviewedAt: "2025-01-15",
		reviewedBy: "compliance-team",
		regulatoryCategory: "investment_advice",
		systemPrompt: `You are an expert fixed income investment advisor. Analyze these bond recommendations and provide brief, professional rationale for each.`,
	},

	"proposal.unlisted": {
		name: "proposal.unlisted",
		version: "1.0.0",
		lastReviewedAt: "2025-01-15",
		reviewedBy: "compliance-team",
		regulatoryCategory: "investment_advice",
		systemPrompt: `You are a SEBI-compliant investment advisor specializing in pre-IPO and unlisted stocks in India.`,
	},

	"proposal.reit_invit": {
		name: "proposal.reit_invit",
		version: "1.0.0",
		lastReviewedAt: "2025-01-15",
		reviewedBy: "compliance-team",
		regulatoryCategory: "investment_advice",
		systemPrompt: `You are a SEBI-compliant investment advisor specializing in REITs and InvITs in India.`,
	},

	"proposal.commodity": {
		name: "proposal.commodity",
		version: "1.0.0",
		lastReviewedAt: "2025-01-15",
		reviewedBy: "compliance-team",
		regulatoryCategory: "investment_advice",
		systemPrompt: `You are an expert commodity investment advisor. Analyze these commodity recommendations for a client with the following profile:`,
	},

	"proposal.unified_advisory": {
		name: "proposal.unified_advisory",
		version: "1.0.0",
		lastReviewedAt: "2025-01-15",
		reviewedBy: "compliance-team",
		regulatoryCategory: "investment_advice",
		systemPrompt: `You are a SEBI-compliant investment advisor. Generate exactly the requested number of recommendations for the specified product type.`,
	},
};
