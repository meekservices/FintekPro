
import { defineConfig } from "drizzle-kit";

const rawUrl = process.env.PRODUCTION_DATABASE_URL!;
if (!rawUrl) {
  throw new Error("PRODUCTION_DATABASE_URL must be defined");
}

export default defineConfig({
  out: "./drizzle-migrations",
  schema: "./shared/schema/ai.ts", // POINT TO THE AI SCHEMA
  dialect: "postgresql",
  dbCredentials: {
    url: rawUrl,
    ssl: { rejectUnauthorized: false },
  },
  // We want to apply this to the public schema but ONLY for daily_picks if possible, 
  // but drizzle-kit push will try to sync the whole file.
});
