import { db } from "./server/db";
import { users } from "./shared/schema";
import { eq, or } from "drizzle-orm";

async function findAdmin() {
  try {
    const admins = await db.select().from(users).where(
      or(
        eq(users.role, 'admin'),
        eq(users.role, 'superadmin')
      )
    ).limit(5);
    
    console.log("Found admins:");
    admins.forEach(a => console.log(`Username: ${a.username}, Role: ${a.role}`));
    process.exit(0);
  } catch (err) {
    console.error("Error finding admin:", err);
    process.exit(1);
  }
}

findAdmin();
