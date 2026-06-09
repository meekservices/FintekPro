import { seedTestUser } from "./seed-test-user";

async function updateAdminPassword() {
	console.log("ℹ️  Redirecting to central test user (test@fintekpro.com)...");
	console.log("   Password will be reset to Test@123456.\n");
	await seedTestUser();
	process.exit(0);
}

updateAdminPassword();
