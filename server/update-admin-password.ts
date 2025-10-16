import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function updateAdminPassword() {
  try {
    const newPassword = "Admin@123456";
    const hashedPassword = await hashPassword(newPassword);
    
    const result = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        roles: ['superadmin', 'admin', 'user'],
        isEmailVerified: true,
        isMobileVerified: true,
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(users.email, "admin@fintekpro.com"))
      .returning();
    
    if (result.length > 0) {
      console.log("\n✅ ADMIN PASSWORD UPDATED SUCCESSFULLY!\n");
      console.log("╔════════════════════════════════════════════╗");
      console.log("║         ADMIN LOGIN CREDENTIALS            ║");
      console.log("╠════════════════════════════════════════════╣");
      console.log("║ User ID:  " + (result[0].userId || '').padEnd(33) + "║");
      console.log("║ Email:    admin@fintekpro.com              ║");
      console.log("║ Password: Admin@123456                     ║");
      console.log("║ Roles:    superadmin, admin, user          ║");
      console.log("╚════════════════════════════════════════════╝");
      console.log("\n🔐 ADMIN PORTAL ACCESS:");
      console.log("   1. Go to your app URL");
      console.log("   2. Add ?admin=true to the URL");
      console.log("   3. Login with the credentials above\n");
    } else {
      console.log("❌ Admin user not found");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating password:", error);
    process.exit(1);
  }
}

updateAdminPassword();
