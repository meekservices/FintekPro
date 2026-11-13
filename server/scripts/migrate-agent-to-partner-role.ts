/* eslint-disable no-console */
/**
 * Migration Script: migrate-agent-to-partner-role.ts
 *
 * Replaces legacy 'agent' role with 'partner' in users.roles in PostgreSQL.
 * Human distribution roles are Partners. The "agent" name is reserved exclusively for AI agents.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

async function run() {
	console.log("Starting migration: replacing 'agent' role with 'partner'...");

	try {
		// 1. Replace 'agent' with 'partner' in users.roles array
		const result = await db.execute(sql`
			UPDATE users 
			SET roles = array_replace(roles, 'agent', 'partner') 
			WHERE 'agent' = ANY(roles);
		`);
		console.log("Updated users with 'agent' role:", result);

		// 2. De-duplicate roles array for any user that might now have duplicate 'partner'
		const dedupeResult = await db.execute(sql`
			UPDATE users
			SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles) AS r)
			WHERE 'partner' = ANY(roles);
		`);
		console.log("De-duplicated roles in users table:", dedupeResult);

		// 3. Also check customer_care_agents or any legacy role strings
		console.log("Role migration completed successfully.");
		process.exit(0);
	} catch (error) {
		console.error("Migration failed:", error);
		process.exit(1);
	}
}

run();

