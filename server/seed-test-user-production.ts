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

async function generateUniqueUserId(
	prodDb: any,
	email: string,
): Promise<string> {
	const emailLocalPart = email.split("@")[0] || "";
	const alphabeticChars = emailLocalPart
		.replace(/[^a-zA-Z]/g, "")
		.toUpperCase();
	const prefix =
		alphabeticChars.length >= 3 ? alphabeticChars.substring(0, 3) : "FTP";

	let attempts = 0;
	while (attempts < 10) {
		const randomNumber = Math.floor(Math.random() * 1000000)
			.toString()
			.padStart(6, "0");
		const userId = `${prefix}${randomNumber}`;
		const existing = await prodDb
			.select()
			.from(users)
			.where(eq(users.userId, userId))
			.limit(1);
		if (existing.length === 0) return userId;
		attempts++;
	}
	throw new Error("Failed to generate unique userId");
}

async function seedProductionTestUser(): Promise<void> {
	const prodDbUrl =
		process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

	if (!prodDbUrl) {
		console.error(
			"ERROR: Set PRODUCTION_DATABASE_URL or DATABASE_URL environment variable",
		);
		process.exit(1);
	}

	console.log("\n🔧 Connecting to production database...");

	const pool = new Pool({ connectionString: prodDbUrl });
	const prodDb = drizzle(pool);

	try {
		const testEmail = "test@fintekpro.com";
		const testPassword = "Test@123456";
		const testMobile = "9686579294";
		const allRoles = [
			"superadmin",
			"admin",
			"partner",
			"agent",
			"client",
			"user",
			"tester",
		];

		const existingUser = await prodDb
			.select()
			.from(users)
			.where(eq(users.email, testEmail))
			.limit(1);

		if (existingUser.length > 0) {
			const hashedPassword = await hashPassword(testPassword);
			await prodDb
				.update(users)
				.set({
					mobile: testMobile,
					password: hashedPassword,
					roles: allRoles,
					isActive: true,
					isEmailVerified: true,
					isMobileVerified: true,
				})
				.where(eq(users.email, testEmail));

			console.log(
				"✅ Test user already exists — password reset and roles updated in PRODUCTION",
			);
		} else {
			const userId = await generateUniqueUserId(prodDb, testEmail);
			const hashedPassword = await hashPassword(testPassword);

			await prodDb.insert(users).values({
				userId,
				email: testEmail,
				mobile: testMobile,
				password: hashedPassword,
				firstName: "Test",
				lastName: "SuperUser",
				isEmailVerified: true,
				isMobileVerified: true,
				roles: allRoles,
				isActive: true,
			});

			console.log(`✅ Test user CREATED in PRODUCTION (User ID: ${userId})`);
		}

		console.log("\n╔════════════════════════════════════════════════╗");
		console.log("║  PRODUCTION TEST USER - CENTRAL TEST ACCOUNT   ║");
		console.log("╠════════════════════════════════════════════════╣");
		console.log("║ Email:    test@fintekpro.com                   ║");
		console.log("║ Password: Test@123456                          ║");
		console.log("║ OTP:      123456 (fixed for tester role)       ║");
		console.log("║ Roles:    ALL (superadmin, admin, partner,     ║");
		console.log("║           agent, client, user, tester)         ║");
		console.log("╠════════════════════════════════════════════════╣");
		console.log("║ Use this account to monitor production         ║");
		console.log("║ performance, track issues, and test features.  ║");
		console.log("╚════════════════════════════════════════════════╝\n");
	} catch (error) {
		console.error(
			"❌ Error seeding production test user:",
			error instanceof Error ? error.message : error,
		);
	} finally {
		await pool.end();
	}
}

// Only run standalone (not when bundled into the main server)
if (process.argv[1] && !process.argv[1].endsWith("dist/index.js")) {
	seedProductionTestUser().then(() => process.exit(0));
}
