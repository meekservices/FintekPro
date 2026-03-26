import { defineConfig } from "drizzle-kit";

// Replit's deployment diff-check runs with DATABASE_URL pointing to the
// Replit-managed production PostgreSQL. We detect SSL need from the URL
// itself rather than NODE_ENV so both local Helium (no SSL, localhost) and
// the remote Replit production database (SSL, network host) work correctly.

const dbUrl =
  process.env.DATABASE_URL || "postgresql://localhost:5432/placeholder";

// Use SSL for any non-local connection; skip SSL for localhost / 127.0.0.1 / socket
const isLocal =
  dbUrl.includes("localhost") ||
  dbUrl.includes("127.0.0.1") ||
  dbUrl.startsWith("postgresql:///");

// Allow self-signed certs (Replit-managed DBs) but still encrypt
const sslConfig = isLocal ? false : { rejectUnauthorized: false };

export default defineConfig({
  out: "./drizzle-migrations",
  schema: "./shared/schema-stub.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: sslConfig,
  },
  schemaFilter: ["drizzle_kit_managed"],
});
