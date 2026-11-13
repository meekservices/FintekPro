/* eslint-disable no-console */
/**
 * Migration Script: migrate-human-agent-to-sales-support.ts
 *
 * Enforces the architectural rule:
 * - "Agent" refers EXCLUSIVELY to AI Agents (FASP-AI v1.0).
 * - Human distributor/sales staff previously holding the legacy 'agent' role are renamed to 'sales_support' (or 'partner').
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

async function run() {
	console.log("Starting migration: renaming human 'agent' role to 'sales_support'...");

	try {
		// 1. In users.roles array, replace any legacy 'agent' with 'sales_support'
		const result = await db.execute(sql`
			UPDATE users 
			SET roles = array_replace(roles, 'agent', 'sales_support') 
			WHERE 'agent' = ANY(roles);
		`);
		console.log("Updated users with legacy 'agent' role:", result);

		// 2. De-duplicate roles array for any user that might now have duplicates
		const dedupeResult = await db.execute(sql`
			UPDATE users
			SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles) AS r)
			WHERE 'sales_support' = ANY(roles);
		`);
		console.log("De-duplicated roles in users table:", dedupeResult);

		console.log("Human agent to sales_support migration completed successfully.");
		process.exit(0);
	} catch (error) {
		console.error("Migration failed:", error);
		process.exit(1);
	}
}

run();

