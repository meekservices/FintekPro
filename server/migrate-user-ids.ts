import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function generateNewUserId(email: string | null, existingUserIds: Set<string>): Promise<string> {
  let prefix = "FTP";
  
  if (email) {
    const emailLocalPart = email.split('@')[0] || '';
    const alphabeticChars = emailLocalPart.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (alphabeticChars.length >= 3) {
      prefix = alphabeticChars.substring(0, 3);
    }
  }
  
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const randomNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const userId = `${prefix}${randomNumber}`;
    
    if (!existingUserIds.has(userId)) {
      existingUserIds.add(userId);
      return userId;
    }
    
    attempts++;
  }
  
  const timestamp = Date.now().toString().slice(-6);
  const fallbackId = `${prefix}${timestamp}`;
  existingUserIds.add(fallbackId);
  return fallbackId;
}

async function migrateUserIds() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           USER ID MIGRATION TO EMAIL-BASED FORMAT          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    const allUsers = await db.select({
      id: users.id,
      userId: users.userId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users);

    console.log(`Found ${allUsers.length} users to process\n`);

    if (allUsers.length === 0) {
      console.log("No users found. Migration complete.");
      return;
    }

    const existingUserIds = new Set<string>();
    const updates: Array<{ id: string; oldUserId: string; newUserId: string; email: string | null }> = [];

    for (const user of allUsers) {
      const newUserId = await generateNewUserId(user.email, existingUserIds);
      const currentUserId = user.userId || '';
      
      if (newUserId !== currentUserId) {
        updates.push({
          id: user.id,
          oldUserId: currentUserId || '(null)',
          newUserId,
          email: user.email,
        });
      } else {
        if (currentUserId) {
          existingUserIds.add(currentUserId);
        }
      }
    }

    console.log(`Users requiring update: ${updates.length}\n`);
    console.log("─".repeat(80));
    console.log("| Old User ID    | New User ID    | Email");
    console.log("─".repeat(80));

    for (const update of updates) {
      console.log(`| ${(update.oldUserId || '(null)').padEnd(14)} | ${update.newUserId.padEnd(14)} | ${update.email || 'N/A'}`);
    }
    console.log("─".repeat(80));

    console.log("\nApplying updates...\n");

    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        await db.update(users)
          .set({ userId: update.newUserId })
          .where(eq(users.id, update.id));
        
        successCount++;
        console.log(`✅ ${update.oldUserId} → ${update.newUserId}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to update ${update.oldUserId}: ${error}`);
      }
    }

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                    MIGRATION SUMMARY                        ║");
    console.log("╠════════════════════════════════════════════════════════════╣");
    console.log(`║ Total users processed: ${allUsers.length.toString().padEnd(36)}║`);
    console.log(`║ Users updated:         ${successCount.toString().padEnd(36)}║`);
    console.log(`║ Errors:                ${errorCount.toString().padEnd(36)}║`);
    console.log("╚════════════════════════════════════════════════════════════╝");

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateUserIds()
  .then(() => {
    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration error:", error);
    process.exit(1);
  });
