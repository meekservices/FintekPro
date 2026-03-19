import { defineConfig } from "drizzle-kit";

// Replit's deployment diff-check runs in the production environment where
// NODE_ENV=production and DATABASE_URL points to the Replit-managed production
// PostgreSQL database (requires SSL). In the local workspace, NODE_ENV is not
// set to "production" and DATABASE_URL points to Helium (local, no SSL).

const isProd = process.env.NODE_ENV === "production";

const dbUrl =
  process.env.DATABASE_URL || "postgresql://localhost:5432/placeholder";

export default defineConfig({
  out: "./drizzle-migrations",
  schema: "./shared/schema-stub.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: isProd ? { rejectUnauthorized: false } : false,
  },
  schemaFilter: ["drizzle_kit_managed"],
});
