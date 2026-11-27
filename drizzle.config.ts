import { defineConfig } from "drizzle-kit";

/**
 * Unified Canonical Drizzle Configuration
 *
 * Supports both development and production environments cleanly:
 * - Production: When PRODUCTION_DATABASE_URL is set, strips Neon pooler segments
 *   and applies SSL with schemaFilter guarding public schema.
 * - Development: Resolves DATABASE_URL or local Postgres credentials without crashing.
 */

function toDirectUrl(url: string): string {
	// Remove Neon pooler cluster segment (e.g. ".c-2.") to get direct endpoint
	return url.replace(/\.c-\d+\./, ".");
}

const user = process.env.DB_USER || "postgres";
const password = process.env.DB_PASSWORD || "postgres";
const host = process.env.DB_HOST || "localhost";
const port = process.env.DB_PORT || "5432";
const database = process.env.DB_NAME || "fintekpro";

const localUrl =
	process.env.DATABASE_URL ||
	`postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;

const rawProdUrl = process.env.PRODUCTION_DATABASE_URL;
const isProd = Boolean(rawProdUrl) || process.env.NODE_ENV === "production";

const dbUrl = rawProdUrl ? toDirectUrl(rawProdUrl) : localUrl;

export default defineConfig({
	out: "./drizzle-migrations",
	schema: isProd ? "./shared/schema-stub.ts" : "./shared/schema/index.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: dbUrl,
		...(isProd && rawProdUrl ? { ssl: { rejectUnauthorized: false } } : {}),
	},
	...(isProd && rawProdUrl ? { schemaFilter: ["drizzle_kit_managed"] } : {}),
});
