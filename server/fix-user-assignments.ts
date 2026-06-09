import { db } from "./db";
import { users, portfolios, agents } from "@shared/schema";
import { eq, ne, and, isNull } from "drizzle-orm";

async function fixAssignments() {
	console.log("🚀 Fixing User-Agent Assignments...");

	// 1. Find Sangram's record
	const sangram = await db.query.users.findFirst({
		where: eq(users.email, "sangram.m@outlook.com"),
	});

	if (!sangram) {
		console.error("❌ Could not find user: sangram.m@outlook.com");
		return;
	}

	// 2. Find his associated Agent profile
	const sangramAgent = await db.query.agents.findFirst({
		where: eq(agents.userId, sangram.id),
	});

	if (!sangramAgent) {
		console.error("❌ Could not find Agent profile for Sangram");
		return;
	}

	console.log(`✅ Found Agent ID: ${sangramAgent.id} for ${sangram.email}`);

	// 3. Assign all other users to this agent
	const updatedUsers = await db
		.update(users)
		.set({ agentId: sangramAgent.id })
		.where(and(ne(users.id, sangram.id), isNull(users.agentId)));

	console.log(`✅ Linked other users to Agent Sangram.`);

	// 4. Ensure Portfolios are assigned (if any are orphaned)
	// We'll just list them for now to see the status
	const allPortfolios = await db.query.portfolios.findMany();
	console.log(`📊 Found ${allPortfolios.length} total portfolios.`);

	for (const p of allPortfolios) {
		if (!p.userId) {
			console.log(
				`⚠️ Portfolio ${p.name} is orphaned. Assigning to Sangram for visibility.`,
			);
			await db
				.update(portfolios)
				.set({ userId: sangram.id })
				.where(eq(portfolios.id, p.id));
		}
	}

	console.log("✅ Assignment fix complete.");
}

import { fileURLToPath } from "url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	fixAssignments().catch(console.error);
}

export { fixAssignments };
