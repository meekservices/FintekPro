/**
 * set-test-account-pin.ts
 *
 * Purpose  : One-shot admin utility that sets a fixed 4-digit login PIN for
 *            the test@fintekpro.com QA/sandbox account.
 * Inputs   : TEST_PIN env-var (default: "1234")
 * Outputs  : Updates users.login_pin + users.is_pin_set in the DB.
 * Edge cases: Exits with code 1 if the user is not found.
 *
 * Usage:
 *   TEST_PIN=1234 npx tsx server/set-test-account-pin.ts
 *
 * FASP-AI: This script only mutates sandbox test account records.
 *          It MUST NOT be run against production real-user rows.
 */

import { db } from "./db";
import { users } from "../shared/schema/users";
import { hashPin } from "./auth";
import { eq } from "drizzle-orm";

const TEST_EMAIL = "test@fintekpro.com";
const PIN = process.env.TEST_PIN ?? "1234";

async function run() {
	console.log(`\n🔧 Setting fixed PIN for test account: ${TEST_EMAIL}`);
	console.log(`   PIN: ${PIN.replace(/./g, "*")}\n`);

	if (!/^\d{4}$/.test(PIN)) {
		console.error("❌ TEST_PIN must be exactly 4 digits.");
		process.exit(1);
	}

	// Resolve test user
	const [testUser] = await db
		.select({ id: users.id, email: users.email })
		.from(users)
		.where(eq(users.email, TEST_EMAIL))
		.limit(1);

	if (!testUser) {
		console.error(`❌ User not found: ${TEST_EMAIL}`);
		process.exit(1);
	}

	const hashedPin = await hashPin(PIN);

	await db
		.update(users)
		.set({
			loginPin: hashedPin,
			isPinSet: true,
			updatedAt: new Date(),
		})
		.where(eq(users.id, testUser.id));

	console.log(`✅ PIN policy applied for ${TEST_EMAIL}`);
	console.log(`   isPinSet = true`);
	console.log(
		`   Use PIN "${PIN}" at the login screen (OTP + device checks are bypassed for this account via ALLOW_TESTER_BYPASS=true).\n`,
	);
	process.exit(0);
}

run().catch((err) => {
	console.error("❌ Fatal error:", err);
	process.exit(1);
});
