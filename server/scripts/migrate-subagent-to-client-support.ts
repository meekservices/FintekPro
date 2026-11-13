/* eslint-disable no-console */
/**
 * Migration Script: migrate-subagent-to-client-support.ts
 *
 * Renames legacy 'sub_agent' role to 'client_support' in PostgreSQL.
 * Human distribution hierarchy:
 *   - Partner
 *   - Sales Support (formerly agent)
 *   - Client Support (formerly sub-agent)
 *   - Partner Associate
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

async function run() {
	console.log("Starting migration: renaming 'sub_agent' role to 'client_support'...");

	try {
		// 1. In users.roles array, replace any legacy 'sub_agent' with 'client_support'
		const result = await db.execute(sql`
			UPDATE users 
			SET roles = array_replace(roles, 'sub_agent', 'client_support') 
			WHERE 'sub_agent' = ANY(roles);
		`);
		console.log("Updated users with legacy 'sub_agent' role:", result);

		// 2. De-duplicate roles array for any user that might now have duplicates
		const dedupeResult = await db.execute(sql`
			UPDATE users
			SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles) AS r)
			WHERE 'client_support' = ANY(roles);
		`);
		console.log("De-duplicated roles in users table:", dedupeResult);

		console.log("Sub-agent to client_support migration completed successfully.");
		process.exit(0);
	} catch (error) {
		console.error("Migration failed:", error);
		process.exit(1);
	}
}

run();

