import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    const email = "skmohanty0@gmail.com";
    const newUserId = "SAN852412";

    console.log(`🔍 Finding user with email: ${email}...`);
    const user = await db.query.users.findFirst({
        where: eq(users.email, email)
    });

    if (!user) {
        console.error("❌ User not found!");
        process.exit(1);
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (Current ID: ${user.userId})`);
    
    console.log(`🚀 Updating ID to: ${newUserId}...`);
    await db.update(users)
        .set({ userId: newUserId })
        .where(eq(users.id, user.id));

    console.log("✨ Update successful!");
    process.exit(0);
}

main().catch(err => {
    console.error("💥 Script failed:", err);
    process.exit(1);
});
