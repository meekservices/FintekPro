/* eslint-disable no-console */
/**
 * Migration Script: assign-superadmin-mandatory-roles.ts
 *
 * Assigns all mandatory statutory regulatory roles to Super Admin accounts:
 * - designated_director (PMLA / FIU-IND)
 * - master_agent (AMFI / IRDAI Anchor)
 * - principal_officer (SEBI RIA / RA / PMS)
 * - compliance_officer (SEBI Intermediary)
 * - grievance_officer (SEBI SCORES 2.0 / SMART ODR)
 * - ciso (SEBI CSCRF / CERT-In)
 * - dpo (DPDP Act 2023)
 * - regulatory_auditor (SEBI Audit Oversight)
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { STATUTORY_ROLES } from "@shared/roles";

async function run() {
	console.log("Starting assignment of all mandatory statutory roles to superadmin users...");

	try {
		// 1. Fetch superadmin users
		const targetRolesArraySql = sql`ARRAY[${sql.join(
			STATUTORY_ROLES.map((r) => sql`${r}`),
			sql`, `,
		)}]::varchar[]`;

		const updateResult = await db.execute(sql`
			UPDATE users
			SET roles = (
				SELECT array_agg(DISTINCT r)
				FROM unnest(array_cat(roles, ${targetRolesArraySql})) AS r
			)
			WHERE 'superadmin' = ANY(roles) OR 'super_admin' = ANY(roles);
		`);

		console.log("Updated superadmin users with statutory roles:", updateResult);

		// Also check user table by username / email if specific superadmin account exists
		const adminEmailResult = await db.execute(sql`
			UPDATE users
			SET roles = (
				SELECT array_agg(DISTINCT r)
				FROM unnest(array_cat(roles, ${targetRolesArraySql})) AS r
			)
			WHERE email ILIKE '%admin%@fintekpro.com' AND ('admin' = ANY(roles) OR 'superadmin' = ANY(roles));
		`);
		console.log("Ensured admin@fintekpro.com has statutory roles:", adminEmailResult);

		console.log("Assignment completed successfully.");
		process.exit(0);
	} catch (error) {
		console.error("Assignment script failed:", error);
		process.exit(1);
	}
}

run();

