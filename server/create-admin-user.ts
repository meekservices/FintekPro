import { seedTestUser } from "./seed-test-user";

async function createAdminUser() {
	console.log("ℹ️  Redirecting to central test user (test@fintekpro.com)...");
	console.log(
		"   All admin/agent/partner/client access is via the single test account.\n",
	);
	await seedTestUser();
	process.exit(0);
}

createAdminUser();
