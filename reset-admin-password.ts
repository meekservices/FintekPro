// Temporary script to reset admin password
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function resetAdminPassword() {
  const newPassword = "Admin@123";
  const adminEmail = "skmohanty0@gmail.com";
  
  console.log("🔄 Resetting admin password...");
  
  try {
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update admin user's password
    const result = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.email, adminEmail))
      .returning();
    
    if (result.length > 0) {
      console.log("✅ Admin password reset successfully!");
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Temporary Password: ${newPassword}`);
      console.log(`👤 User ID: ${result[0].userId}`);
      console.log("\n⚠️  Please change this password after logging in!");
    } else {
      console.log("❌ Admin user not found!");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    process.exit(1);
  }
}

resetAdminPassword();
