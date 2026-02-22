import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

neonConfig.webSocketConstructor = ws;

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function generateUniqueUserId(prodDb: any, prefix: string): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const randomNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    const userId = `${prefix}${randomNumber}`;
    const existing = await prodDb.select().from(users).where(eq(users.userId, userId)).limit(1);
    if (existing.length === 0) return userId;
    attempts++;
  }
  throw new Error("Failed to generate unique userId");
}

const ITR_TEST_USERS = [
  {
    email: "itr1-individual@fintekpro.com",
    firstName: "Rajesh",
    lastName: "Sharma",
    entityType: null,
    panNumber: "ABCPS1234A",
    mobile: "9100000001",
    prefix: "ITR",
    label: "ITR-1 (Sahaj) — Salaried Individual, income ≤ ₹50L",
    itrForm: "ITR-1",
  },
  {
    email: "itr2-individual@fintekpro.com",
    firstName: "Priya",
    lastName: "Kapoor",
    entityType: null,
    panNumber: "DEFPK5678B",
    mobile: "9100000002",
    prefix: "ITR",
    label: "ITR-2 — Individual with capital gains, multiple properties, foreign income",
    itrForm: "ITR-2",
  },
  {
    email: "itr3-business@fintekpro.com",
    firstName: "Amit",
    lastName: "Verma",
    entityType: null,
    panNumber: "GHIPV9012C",
    mobile: "9100000003",
    prefix: "ITR",
    label: "ITR-3 — Individual/HUF with business/profession income",
    itrForm: "ITR-3",
  },
  {
    email: "itr3-huf@fintekpro.com",
    firstName: "Verma",
    lastName: "HUF",
    entityType: "huf",
    panNumber: "JKLHV3456D",
    mobile: "9100000004",
    prefix: "HUF",
    label: "ITR-3 — HUF (Hindu Undivided Family) with business income",
    itrForm: "ITR-3",
  },
  {
    email: "itr4-presumptive@fintekpro.com",
    firstName: "Sunita",
    lastName: "Gupta",
    entityType: null,
    panNumber: "MNOPG7890E",
    mobile: "9100000005",
    prefix: "ITR",
    label: "ITR-4 (Sugam) — Individual with presumptive income (44AD/44ADA/44AE)",
    itrForm: "ITR-4",
  },
  {
    email: "itr4-firm@fintekpro.com",
    firstName: "Gupta",
    lastName: "Enterprises",
    entityType: "partnership",
    panNumber: "ABCFG1234F",
    mobile: "9100000006",
    prefix: "FRM",
    label: "ITR-4 (Sugam) — Firm (not LLP) with presumptive income",
    itrForm: "ITR-4",
  },
  {
    email: "itr5-partnership@fintekpro.com",
    firstName: "Sharma & Associates",
    lastName: "LLP",
    entityType: "llp",
    panNumber: "DEFFL5678G",
    mobile: "9100000007",
    prefix: "LLP",
    label: "ITR-5 — LLP (Limited Liability Partnership)",
    itrForm: "ITR-5",
  },
  {
    email: "itr5-aop@fintekpro.com",
    firstName: "Citizens Welfare",
    lastName: "Association",
    entityType: "aop",
    panNumber: "GHIAA9012H",
    mobile: "9100000008",
    prefix: "AOP",
    label: "ITR-5 — AOP (Association of Persons)",
    itrForm: "ITR-5",
  },
  {
    email: "itr5-boi@fintekpro.com",
    firstName: "Joint Investment",
    lastName: "Body",
    entityType: "boi",
    panNumber: "JKLBB3456J",
    mobile: "9100000009",
    prefix: "BOI",
    label: "ITR-5 — BOI (Body of Individuals)",
    itrForm: "ITR-5",
  },
  {
    email: "itr6-company@fintekpro.com",
    firstName: "TechVenture",
    lastName: "Pvt Ltd",
    entityType: "company",
    panNumber: "ABCCV7890K",
    mobile: "9100000010",
    prefix: "CMP",
    label: "ITR-6 — Company (not claiming Sec 11 exemption)",
    itrForm: "ITR-6",
  },
  {
    email: "itr7-trust@fintekpro.com",
    firstName: "Charitable Education",
    lastName: "Trust",
    entityType: "trust",
    panNumber: "DEFTT1234L",
    mobile: "9100000011",
    prefix: "TRT",
    label: "ITR-7 — Trust/Institution claiming exemption u/s 139(4A-4F)",
    itrForm: "ITR-7",
  },
  {
    email: "itr7-society@fintekpro.com",
    firstName: "Rural Development",
    lastName: "Society",
    entityType: "society",
    panNumber: "GHIAS5678M",
    mobile: "9100000012",
    prefix: "SOC",
    label: "ITR-7 — Society/Charitable Institution",
    itrForm: "ITR-7",
  },
];

async function seedITRTestUsers(): Promise<void> {
  const prodDbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

  if (!prodDbUrl) {
    console.error("ERROR: Set PRODUCTION_DATABASE_URL or DATABASE_URL environment variable");
    process.exit(1);
  }

  console.log("\n🔧 Connecting to database for ITR test user seeding...\n");

  const pool = new Pool({ connectionString: prodDbUrl });
  const prodDb = drizzle(pool);

  const testPassword = "Test@123456";
  const allRoles = ["superadmin", "admin", "partner", "agent", "client", "user", "tester"];

  let created = 0;
  let updated = 0;
  let failed = 0;

  try {
    for (const testUser of ITR_TEST_USERS) {
      try {
        const existing = await prodDb.select().from(users).where(eq(users.email, testUser.email)).limit(1);

        if (existing.length > 0) {
          const hashedPassword = await hashPassword(testPassword);
          await prodDb
            .update(users)
            .set({
              password: hashedPassword,
              firstName: testUser.firstName,
              lastName: testUser.lastName,
              entityType: testUser.entityType,
              panNumber: testUser.panNumber,
              mobile: testUser.mobile,
              roles: allRoles,
              isActive: true,
              isEmailVerified: true,
              isMobileVerified: true,
            })
            .where(eq(users.email, testUser.email));

          console.log(`🔄 UPDATED: ${testUser.email} — ${testUser.label}`);
          updated++;
        } else {
          const userId = await generateUniqueUserId(prodDb, testUser.prefix);
          const hashedPassword = await hashPassword(testPassword);

          await prodDb.insert(users).values({
            userId,
            email: testUser.email,
            mobile: testUser.mobile,
            password: hashedPassword,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            entityType: testUser.entityType,
            panNumber: testUser.panNumber,
            isEmailVerified: true,
            isMobileVerified: true,
            roles: allRoles,
            isActive: true,
          });

          console.log(`✅ CREATED: ${testUser.email} (${userId}) — ${testUser.label}`);
          created++;
        }
      } catch (err) {
        console.error(`❌ FAILED: ${testUser.email} — ${err instanceof Error ? err.message : err}`);
        failed++;
      }
    }

    console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
    console.log("║            ITR TEST USERS — ALL FORMS (ITR-1 to ITR-7)          ║");
    console.log("╠═══════════════════════════════════════════════════════════════════╣");
    console.log("║ Password: Test@123456       OTP: 123456 (tester role)            ║");
    console.log("║ All users have ALL roles (superadmin → tester)                   ║");
    console.log("╠═══════════════════════════════════════════════════════════════════╣");
    console.log("║                                                                  ║");
    console.log("║ ITR-1 │ itr1-individual@fintekpro.com │ Individual (Salaried)    ║");
    console.log("║ ITR-2 │ itr2-individual@fintekpro.com │ Individual (CG/Foreign)  ║");
    console.log("║ ITR-3 │ itr3-business@fintekpro.com   │ Individual (Business)    ║");
    console.log("║ ITR-3 │ itr3-huf@fintekpro.com        │ HUF (Business)           ║");
    console.log("║ ITR-4 │ itr4-presumptive@fintekpro.com│ Individual (Presumptive) ║");
    console.log("║ ITR-4 │ itr4-firm@fintekpro.com       │ Firm (Presumptive)       ║");
    console.log("║ ITR-5 │ itr5-partnership@fintekpro.com│ LLP                      ║");
    console.log("║ ITR-5 │ itr5-aop@fintekpro.com        │ AOP                      ║");
    console.log("║ ITR-5 │ itr5-boi@fintekpro.com        │ BOI                      ║");
    console.log("║ ITR-6 │ itr6-company@fintekpro.com    │ Company (Pvt Ltd)        ║");
    console.log("║ ITR-7 │ itr7-trust@fintekpro.com      │ Trust (Charitable)       ║");
    console.log("║ ITR-7 │ itr7-society@fintekpro.com    │ Society                  ║");
    console.log("║                                                                  ║");
    console.log("╠═══════════════════════════════════════════════════════════════════╣");
    console.log(`║ Results: ${created} created, ${updated} updated, ${failed} failed${" ".repeat(Math.max(0, 26 - String(created).length - String(updated).length - String(failed).length))}║`);
    console.log("╚═══════════════════════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("❌ Fatal error:", error instanceof Error ? error.message : error);
  } finally {
    await pool.end();
  }
}

seedITRTestUsers().then(() => process.exit(0));
