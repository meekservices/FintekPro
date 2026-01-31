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

async function generateUniqueUserId(email?: string): Promise<string> {
  // Generate userId in format: XXX123456
  // First 3 characters: first 3 alphabetic letters from email (uppercase), fallback to "FTP"
  // Next 6 characters: system-generated random digits
  
  let prefix = "FTP";
  
  if (email) {
    const emailLocalPart = email.split('@')[0] || '';
    const alphabeticChars = emailLocalPart.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (alphabeticChars.length >= 3) {
      prefix = alphabeticChars.substring(0, 3);
    }
  }
  
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const randomNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const userId = `${prefix}${randomNumber}`;
    
    // Check if userId already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);
    
    if (existingUser.length === 0) {
      return userId;
    }
    
    attempts++;
  }
  
  throw new Error("Failed to generate unique userId after maximum attempts");
}

async function createAdminUser() {
  try {
    // Admin credentials
    const adminEmail = "admin@fintekpro.com";
    const adminPassword = "Admin@123456";
    const adminMobile = "9999999999";
    
    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);
    
    if (existingAdmin.length > 0) {
      console.log("⚠️  Admin user already exists!");
      console.log("   Email: " + adminEmail);
      console.log("   User ID: " + existingAdmin[0].userId);
      console.log("\n💡 Use this to login with the existing admin account");
      process.exit(0);
    }
    
    // Generate unique userId with email-based prefix
    const userId = await generateUniqueUserId(adminEmail);
    
    // Hash password
    const hashedPassword = await hashPassword(adminPassword);
    
    // Create superadmin user
    const result = await db
      .insert(users)
      .values({
        userId,
        email: adminEmail,
        mobile: adminMobile,
        password: hashedPassword,
        firstName: "Admin",
        lastName: "User",
        isEmailVerified: true,
        isMobileVerified: true,
        roles: ['superadmin', 'admin', 'user'],
        isActive: true,
      })
      .returning();
    
    if (result.length > 0) {
      console.log("\n✅ SUPERADMIN USER CREATED SUCCESSFULLY!\n");
      console.log("╔════════════════════════════════════════════╗");
      console.log("║         ADMIN LOGIN CREDENTIALS            ║");
      console.log("╠════════════════════════════════════════════╣");
      console.log("║ User ID:  " + userId.padEnd(33) + "║");
      console.log("║ Email:    " + adminEmail.padEnd(33) + "║");
      console.log("║ Mobile:   " + adminMobile.padEnd(33) + "║");
      console.log("║ Password: " + adminPassword.padEnd(33) + "║");
      console.log("║ Roles:    superadmin, admin, user          ║");
      console.log("╚════════════════════════════════════════════╝");
      console.log("\n🔐 ADMIN PORTAL ACCESS:");
      console.log("   1. Go to your app URL");
      console.log("   2. Add ?admin=true to the URL");
      console.log("   3. Login with the credentials above\n");
      console.log("⚠️  IMPORTANT: Change the password after first login!\n");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
}

createAdminUser();
