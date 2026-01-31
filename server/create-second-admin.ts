import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users, customerCareAgents } from "@shared/schema";
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

async function createSecondAdmin() {
  try {
    // Admin credentials for MS FintekPro Advisors LLP
    const adminEmail = "meekservices@gmail.com";
    const adminPassword = "Kamini@321";
    const adminMobile = "9686854321";
    const adminName = "MS FintekPro Advisors LLP";
    
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
      console.log("\n💡 Use this to login with the existing account");
      process.exit(0);
    }
    
    // Generate unique userId with email-based prefix
    const userId = await generateUniqueUserId(adminEmail);
    
    // Hash password
    const hashedPassword = await hashPassword(adminPassword);
    
    // Create admin user
    const [newUser] = await db
      .insert(users)
      .values({
        userId,
        email: adminEmail,
        mobile: adminMobile,
        password: hashedPassword,
        firstName: "MS",
        lastName: "FintekPro Advisors LLP",
        isEmailVerified: true,
        isMobileVerified: true,
        roles: ['admin', 'user'],
        isActive: true,
      })
      .returning();
    
    // Create agent/partner profile (using only essential fields)
    let agentProfile;
    try {
      [agentProfile] = await db
        .insert(customerCareAgents)
        .values({
          fullName: adminName,
          email: adminEmail,
          phone: adminMobile,
          password: hashedPassword,
        })
        .returning();
    } catch (agentError) {
      console.log("⚠️  Could not create agent profile (optional):", (agentError as Error).message);
      agentProfile = { id: 'N/A' };
    }
    
    console.log("\n✅ ADMIN USER CREATED SUCCESSFULLY!\n");
    console.log("╔════════════════════════════════════════════╗");
    console.log("║    MS FINTEKPRO ADVISORS LLP - LOGIN       ║");
    console.log("╠════════════════════════════════════════════╣");
    console.log("║ User ID:  " + userId.padEnd(33) + "║");
    console.log("║ Email:    " + adminEmail.padEnd(33) + "║");
    console.log("║ Mobile:   " + adminMobile.padEnd(33) + "║");
    console.log("║ Password: " + adminPassword.padEnd(33) + "║");
    console.log("║ Roles:    admin, user, partner, agent      ║");
    console.log("╚════════════════════════════════════════════╝");
    console.log("\n🔐 PORTAL ACCESS:");
    console.log("   📊 Admin Portal:   admin.fintekpro.com");
    console.log("   👤 Client Portal:  fintekpro.com");
    console.log("   🤝 Partner Portal: partner.fintekpro.com");
    console.log("\n📋 Agent Profile ID: " + agentProfile.id);
    console.log("\n✨ This account has full access to all portals!\n");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
}

createSecondAdmin();
