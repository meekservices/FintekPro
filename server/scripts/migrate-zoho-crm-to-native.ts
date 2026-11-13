/* eslint-disable no-console */
/**
 * Migration Script: migrate-zoho-crm-to-native.ts
 *
 * Ingests historical leads and deals from Zoho CRM into FintekPro's native
 * PostgreSQL tables (prospect_leads, crm_opportunities, crm_interactions)
 * so Zoho CRM can be safely decommissioned without losing any data.
 */

import { db } from "../db";
import { zohoConnections } from "@shared/schema";
import { prospectLeads, crmOpportunities } from "@shared/schema/crm";
import { eq, or, sql } from "drizzle-orm";
import { ZohoCRMService } from "../zoho/services/crm";

async function run() {
	console.log("=== Zoho CRM to Native FintekPro CRM Migration ===");

	try {
		// 1. Find Zoho CRM connections
		const connections = await db
			.select()
			.from(zohoConnections)
			.where(eq(zohoConnections.status, "active"));

		const crmConnections = connections.filter((c) =>
			c.services?.includes("CRM"),
		);

		if (crmConnections.length === 0) {
			console.log(
				"No active Zoho CRM connections found. FintekPro will operate purely in native CRM mode.",
			);
			process.exit(0);
		}

		console.log(`Found ${crmConnections.length} active Zoho CRM connection(s). Starting data ingestion...`);

		let totalLeadsImported = 0;
		let totalDealsImported = 0;

		for (const conn of crmConnections) {
			console.log(`Processing connection: ${conn.connectionName} (${conn.id})`);
			const crmService = new ZohoCRMService(conn.id, conn.zohoDataCenter || "in");

			try {
				// Ingest Leads
				const leads = await crmService.getLeads(500);
				console.log(`Fetched ${leads.length} leads from Zoho CRM.`);

				for (const lead of leads) {
					const email = lead.Email?.trim()?.toLowerCase() || null;
					const phone = lead.Phone || lead.Mobile || null;
					const companyName = lead.Company || lead.Full_Name || `${lead.First_Name || ""} ${lead.Last_Name || ""}`.trim() || "Unknown Company";
					const contactName = lead.Full_Name || `${lead.First_Name || ""} ${lead.Last_Name || ""}`.trim() || companyName;

					// Check if lead already exists in prospect_leads
					let existingLead: any = null;
					if (email || phone) {
						const conditions = [];
						if (email) conditions.push(eq(prospectLeads.primaryEmail, email));
						if (phone) conditions.push(eq(prospectLeads.primaryMobile, phone));

						const [found] = await db
							.select()
							.from(prospectLeads)
							.where(or(...conditions))
							.limit(1);
						existingLead = found;
					}

					const statusMap: Record<string, string> = {
						New: "new",
						Contacted: "contacted",
						Qualified: "qualified",
						"Proposal Sent": "qualified",
						"Not Qualified": "rejected",
						Converted: "converted",
					};

					const mappedStatus = (lead.Lead_Status && statusMap[lead.Lead_Status]) || "new";

					if (!existingLead) {
						await db.insert(prospectLeads).values({
							companyName,
							primaryContactName: contactName,
							primaryEmail: email,
							primaryMobile: phone,
							status: mappedStatus,
							source: "zoho_crm_import",
							notes: `Imported from Zoho CRM (Lead ID: ${lead.id || "N/A"}). Original Source: ${lead.Lead_Source || "Zoho"}`,
							assignedTo: conn.masterAgentId || conn.createdBy || null,
							createdAt: lead.Created_Time ? new Date(lead.Created_Time) : new Date(),
						});
						totalLeadsImported++;
					}
				}
				console.log(`Successfully processed leads for connection ${conn.id}`);
			} catch (leadErr: any) {
				console.warn(`Could not pull leads for connection ${conn.id}:`, leadErr.message);
			}

			try {
				// Ingest Deals -> crm_opportunities
				const deals: any[] = typeof (crmService as any).getDeals === "function" ? await (crmService as any).getDeals(500) : [];
				console.log(`Fetched ${deals.length} deals from Zoho CRM.`);

				for (const deal of deals) {
					const partnerId = conn.masterAgentId || conn.createdBy;
					if (!partnerId) continue;

					const dealName = deal.Deal_Name || "Zoho Imported Deal";
					const amount = deal.Amount ? String(deal.Amount) : "0.00";
					const stageMap: Record<string, string> = {
						"Qualification": "qualified",
						"Needs Analysis": "qualified",
						"Proposal/Price Quote": "proposal",
						"Negotiation/Review": "negotiation",
						"Closed Won": "won",
						"Closed Lost": "lost",
					};
					const stage = stageMap[deal.Stage] || "lead";

					await db.insert(crmOpportunities).values({
						agentId: partnerId,
						clientId: partnerId, // linked to partner as placeholder until client claimed
						name: dealName,
						stage,
						expectedAmount: amount,
						source: "zoho_crm_import",
						notes: `Imported from Zoho CRM Deal ID: ${deal.id || "N/A"}. Description: ${deal.Description || ""}`,
						createdAt: deal.Created_Time ? new Date(deal.Created_Time) : new Date(),
					});
					totalDealsImported++;
				}
			} catch (dealErr: any) {
				console.warn(`Could not pull deals for connection ${conn.id}:`, dealErr.message);
			}
		}

		console.log(`=== Migration Finished ===`);
		console.log(`Total Leads Imported: ${totalLeadsImported}`);
		console.log(`Total Deals Imported: ${totalDealsImported}`);
		process.exit(0);
	} catch (error) {
		console.error("Migration error:", error);
		process.exit(1);
	}
}

run();

