/**
 * Temporary config — used ONLY for initialising a brand-new Neon database.
 * Run with:
 *   PRODUCTION_DATABASE_URL="postgresql://..." npx drizzle-kit push --config=drizzle.newdb.config.ts
 *
 * Delete this file after the one-off setup is complete.
 */
import { defineConfig } from "drizzle-kit";

function toDirectUrl(url: string) {
  return url.replace(/\.c-\d+\./, ".");
}

const raw = process.env.PRODUCTION_DATABASE_URL!;
if (!raw) throw new Error("PRODUCTION_DATABASE_URL must be set");

export default defineConfig({
  out: "./drizzle-migrations-newdb",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: toDirectUrl(raw),
    ssl: { rejectUnauthorized: false },
  },
});
