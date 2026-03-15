import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema-stub.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL || "postgresql://localhost:5432/placeholder",
  },
  // Limit introspection to only the tables defined in schema-stub.ts.
  // Without this, drizzle-kit pulls ALL tables from the production DB (hundreds),
  // which takes so long the process is killed → "SERVER unexpectedly disconnected".
  tablesFilter: [
    "agent_notifications",
    "corporate_actions",
    "price_adjustments",
    "symbol_mapping",
    "credit_ratings",
    "instrument_returns",
  ],
});
