import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });
if (!process.env.DB_PORT) process.env.DB_PORT = "9485";

import fs from "fs";
import { db } from "../server/db";
import { prospectLeads } from "../shared/schema/crm";
import { eq, and, sql } from "drizzle-orm";

/**
 * Script to import Bangalore HNW prospects and assign them directly to Partner Sangram Mohanty.
 * Adheres to FintekPro GCR v1.0: Drizzle ORM, structured audit logs, idempotent batch import.
 */

export interface ProspectRow {
  name: string;
  linkedin_url: string;
  title: string;
  company: string;
  company_domain: string;
  segment: string;
  wealth_signal: string;
  email: string;
  phone: string;
  rule_based_in_bangalore: string;
  rule_owner_or_senior_professional: string;
  rule_hidden_gem: string;
  source_url: string;
}

export function parseCSV(content: string): ProspectRow[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      currentField = "";
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0].trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const parsedRows: ProspectRow[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;
    const item: Record<string, string> = {};
    headers.forEach((h, idx) => {
      item[h] = (row[idx] ?? "").trim();
    });
    parsedRows.push(item as unknown as ProspectRow);
  }

  return parsedRows;
}

const TARGET_PARTNER_USER_ID = "dc41e192-05de-481c-b1cc-947d8ea42cff"; // Sangram Mohanty (SAN852412)
const BATCH_ID = "bangalore-hnw-20261120";
const CSV_PATH = "/Users/sangrammohanty/Downloads/outputs-bangalore-hnw-prospects.csv";

function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/['"\s-]/g, "").trim();
  if (!cleaned) return null;
  return cleaned;
}

function cleanWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

async function runImport() {
  const startTime = Date.now();
  console.log(`[IMPORT] 🚀 Starting prospect import from: ${CSV_PATH}`);
  console.log(`[IMPORT] 👤 Target Partner: Sangram Mohanty (users.id: ${TARGET_PARTNER_USER_ID})`);

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found at ${CSV_PATH}`);
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const rawRows = parseCSV(csvContent);
  console.log(`[IMPORT] 📄 Successfully parsed ${rawRows.length} rows from CSV`);

  // Verify partner user exists
  const partnerUser = await db.execute(
    sql`SELECT id, user_id, first_name, last_name, email FROM users WHERE id = ${TARGET_PARTNER_USER_ID}`
  );
  if (partnerUser.rows.length === 0) {
    throw new Error(`Partner user ID ${TARGET_PARTNER_USER_ID} does not exist in database`);
  }
  console.log(`[IMPORT] ✅ Partner verified:`, partnerUser.rows[0]);

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const companyName = row.company?.trim() || `${row.name?.trim()}'s Practice`;
    const contactName = row.name?.trim() || "Unknown";
    const designation = row.title?.trim() || "Owner / Executive";
    const email = row.email?.trim() || null;
    const mobile = cleanPhone(row.phone);
    const website = cleanWebsite(row.company_domain);
    const wealthSignal = row.wealth_signal?.trim() || "";
    const sourceUrl = row.source_url?.trim() || "";
    const linkedinUrl = row.linkedin_url?.trim() || "";

    const notes = [
      wealthSignal ? `Wealth Signal: ${wealthSignal}` : null,
      linkedinUrl ? `LinkedIn: ${linkedinUrl}` : null,
      sourceUrl ? `Source: ${sourceUrl}` : null,
      `Imported to Partner Sangram Mohanty on ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const enrichmentData = {
      linkedin_url: linkedinUrl,
      title: designation,
      company: companyName,
      company_domain: row.company_domain,
      segment: row.segment,
      wealth_signal: wealthSignal,
      source_url: sourceUrl,
      rule_matches: {
        based_in_bangalore: row.rule_based_in_bangalore,
        owner_or_senior_professional: row.rule_owner_or_senior_professional,
        hidden_gem: row.rule_hidden_gem,
      },
      assigned_partner_name: "Sangram Mohanty",
      assigned_partner_id: TARGET_PARTNER_USER_ID,
      imported_at: new Date().toISOString(),
    };

    // Check if lead already exists by company + contact name
    const existing = await db
      .select({ id: prospectLeads.id, assignedTo: prospectLeads.assignedTo })
      .from(prospectLeads)
      .where(
        and(
          eq(prospectLeads.companyName, companyName),
          eq(prospectLeads.primaryContactName, contactName)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing lead to ensure assignment to Sangram Mohanty
      const existingId = existing[0].id;
      await db
        .update(prospectLeads)
        .set({
          assignedTo: TARGET_PARTNER_USER_ID,
          primaryContactDesignation: designation,
          primaryEmail: email || sql`COALESCE(${prospectLeads.primaryEmail}, ${email})`,
          primaryMobile: mobile || sql`COALESCE(${prospectLeads.primaryMobile}, ${mobile})`,
          website: website || sql`COALESCE(${prospectLeads.website}, ${website})`,
          city: "Bengaluru",
          state: "Karnataka",
          industrySegment: row.segment === "business_owner" ? "Business Owner" : (row.segment || "HNW Professional"),
          leadQuality: "hot",
          leadScore: 85,
          status: "new",
          source: "linkedin_import",
          importBatchId: BATCH_ID,
          notes,
          enrichmentData,
          updatedAt: new Date(),
        })
        .where(eq(prospectLeads.id, existingId));

      updatedCount++;
    } else {
      // Insert new prospect lead
      await db.insert(prospectLeads).values({
        companyName,
        primaryContactName: contactName,
        primaryContactDesignation: designation,
        primaryEmail: email,
        primaryMobile: mobile,
        website,
        city: "Bengaluru",
        state: "Karnataka",
        industrySegment: row.segment === "business_owner" ? "Business Owner" : (row.segment || "HNW Professional"),
        companyCategory: "mid_market",
        leadQuality: "hot",
        leadScore: 85,
        status: "new",
        assignedTo: TARGET_PARTNER_USER_ID,
        source: "linkedin_import",
        importBatchId: BATCH_ID,
        notes,
        enrichmentData,
        enrichmentScore: 90,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      insertedCount++;
    }

    if ((i + 1) % 10 === 0 || i === rawRows.length - 1) {
      console.log(`[IMPORT] Progress: ${i + 1}/${rawRows.length} (Inserted: ${insertedCount}, Updated: ${updatedCount})`);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(
    JSON.stringify({
      event: "PROSPECT_IMPORT_COMPLETED",
      batch_id: BATCH_ID,
      total_rows: rawRows.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
      assigned_to: "Sangram Mohanty (dc41e192-05de-481c-b1cc-947d8ea42cff)",
      latency_ms: durationMs,
      status: "SUCCESS",
    })
  );

  // Final verification query
  const verifyResult = await db.execute(sql`
    SELECT count(*)::int as total_assigned
    FROM prospect_leads
    WHERE assigned_to = ${TARGET_PARTNER_USER_ID}
      AND import_batch_id = ${BATCH_ID}
  `);

  console.log(`[IMPORT] 🎉 Verification query:`, verifyResult.rows[0]);
  process.exit(0);
}

runImport().catch((err: any) => {
  console.error("Underlying cause:", err.cause);
  console.error(
    JSON.stringify({
      event: "PROSPECT_IMPORT_FAILED",
      error_code: "IMPORT_EXCEPTION",
      message: err.message,
      detail: err.cause?.detail,
      routine: err.cause?.routine,
      stack: err.stack,
      retryable: false,
    })
  );
  process.exit(1);
});
