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

export async function seedTestUser(): Promise<void> {
  try {
    const testEmail = "test@fintekpro.com";
    const testPassword = "Test@123456";
    const testMobile = "9876543210";
    
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);
    
    if (existingUser.length > 0) {
      const allRoles = ['superadmin', 'admin', 'partner', 'agent', 'client', 'user', 'tester'];
      const hashedPassword = await hashPassword(testPassword);
      
      await db
        .update(users)
        .set({
          password: hashedPassword,
          roles: allRoles,
          isActive: true,
          isEmailVerified: true,
          isMobileVerified: true,
        })
        .where(eq(users.email, testEmail));
      console.log("✅ Test user password reset and roles updated");
      
      console.log("\n╔════════════════════════════════════════════╗");
      console.log("║       TEST USER LOGIN CREDENTIALS          ║");
      console.log("╠════════════════════════════════════════════╣");
      console.log("║ Email:    test@fintekpro.com               ║");
      console.log("║ Password: Test@123456                      ║");
      console.log("║ Roles:    ALL (superadmin, admin, partner, ║");
      console.log("║           agent, client, user, tester)     ║");
      console.log("║ OTP:      123456 (fixed for test account)  ║");
      console.log("╠════════════════════════════════════════════╣");
      console.log("║ ⚠️  This is the ONLY test account.         ║");
      console.log("║    Do NOT create other test IDs.           ║");
      console.log("╚════════════════════════════════════════════╝");
      return;
    }
    
    const userId = await generateUniqueUserId(testEmail);
    const hashedPassword = await hashPassword(testPassword);
    
    await db
      .insert(users)
      .values({
        userId,
        email: testEmail,
        mobile: testMobile,
        password: hashedPassword,
        firstName: "Test",
        lastName: "SuperUser",
        isEmailVerified: true,
        isMobileVerified: true,
        roles: ['superadmin', 'admin', 'partner', 'agent', 'client', 'user', 'tester'],
        isActive: true,
      });
    
    console.log("\n✅ CENTRAL TEST USER CREATED SUCCESSFULLY!\n");
    console.log("╔════════════════════════════════════════════╗");
    console.log("║    CENTRAL TEST USER - ONLY TEST ACCOUNT   ║");
    console.log("╠════════════════════════════════════════════╣");
    console.log("║ User ID:  " + userId.padEnd(33) + "║");
    console.log("║ Email:    test@fintekpro.com               ║");
    console.log("║ Mobile:   9876543210                       ║");
    console.log("║ Password: Test@123456                      ║");
    console.log("║ OTP:      123456 (fixed for test account)  ║");
    console.log("║ Roles:    ALL (superadmin, admin, partner, ║");
    console.log("║           agent, client, user, tester)     ║");
    console.log("╠════════════════════════════════════════════╣");
    console.log("║ ⚠️  This is the ONLY test account.         ║");
    console.log("║    Do NOT create other test IDs.           ║");
    console.log("╚════════════════════════════════════════════╝");
    console.log("\n🔐 ACCESS ALL PORTALS:");
    console.log("   - Admin Portal: Add ?admin=true to URL");
    console.log("   - Agent Portal: /agent-dashboard");
    console.log("   - Partner Portal: /partner-portal");
    console.log("   - Client Portal: /dashboard\n");
    
  } catch (error) {
    console.error("⚠️ Error seeding test user:", error instanceof Error ? error.message : "Unknown error");
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedTestUser().then(() => process.exit(0));
}
