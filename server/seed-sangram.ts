// @ts-nocheck
import "dotenv/config";
import { db } from "./db";
import { users, customerCareAgents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";

async function seedSangram() {
	const email = "sangram.m@outlook.com";
	console.log(`Checking for user: ${email}...`);

	const existing = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (existing.length > 0) {
		console.log("✅ User already exists in 'users' table.");
	} else {
		console.log("Creating user in 'users' table...");
		const hashedPassword = await hashPassword("Sangram@123"); // Default temporary password

		await db.insert(users).values({
			userId: "USR-SANGRAM-001",
			email: email,
			password: hashedPassword,
			firstName: "Sangram",
			lastName: "Mohanty",
			roles: ["admin", "agent"],
			isEmailVerified: true,
			isActive: true,
			planTier: "premium",
		});
		console.log("✅ Created user in 'users' table.");
	}

	// Also ensure agent profile exists
	const existingAgent = await db
		.select()
		.from(customerCareAgents)
		.where(eq(customerCareAgents.email, email))
		.limit(1);

	if (existingAgent.length > 0) {
		console.log(
			"✅ Agent profile already exists in 'customerCareAgents' table.",
		);
	} else {
		console.log("Creating agent profile in 'customerCareAgents' table...");
		await db.insert(customerCareAgents).values({
			agentId: "ARN-0002",
			name: "Sangram Mohanty",
			email: email,
			role: "Super Admin",
			phone: "+91-9999999999",
			isPrimary: true,
			status: "active",
		});
		console.log("✅ Created agent profile in 'customerCareAgents' table.");
	}

	console.log(
		"\n🚀 Seeding complete! You can now log in at agent.fintekpro.com",
	);
	process.exit(0);
}

seedSangram().catch((err) => {
	console.error("❌ Seeding failed:", err);
	process.exit(1);
});
