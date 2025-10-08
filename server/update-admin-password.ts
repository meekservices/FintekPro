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
    const newPassword = "Kamini@321";
    const hashedPassword = await hashPassword(newPassword);
    
    const result = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.email, "sangram@fintekpro.com"))
      .returning();
    
    if (result.length > 0) {
      console.log("✅ Password updated successfully for sangram@fintekpro.com");
      console.log("   Email: sangram@fintekpro.com");
      console.log("   Password: Kamini@321");
    } else {
      console.log("❌ User not found");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating password:", error);
    process.exit(1);
  }
}

updateAdminPassword();
