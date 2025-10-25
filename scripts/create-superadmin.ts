import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as readline from "readline";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function generateUniqueUserId(): Promise<string> {
  const prefix = "FTP";
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const randomNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const userId = `${prefix}${randomNumber}`;
    
    const existingUser = await db.select().from(users).where(eq(users.userId, userId));
    if (existingUser.length === 0) {
      return userId;
    }
    
    attempts++;
  }
  
  throw new Error("Failed to generate unique userId after maximum attempts");
}

function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false, // Disable terminal features for better piping support
    });

    rl.question('Enter superadmin password: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createSuperAdmin() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('          FintekPro Superadmin Account Setup');
    console.log('═══════════════════════════════════════════════════════════\n');

    const email = 'support@fintekpro.com';
    const mobile = '9686854321';

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existingUser.length > 0) {
      console.log('❌ Error: A user with email support@fintekpro.com already exists.');
      console.log(`   User ID: ${existingUser[0].userId}`);
      console.log(`   Created: ${existingUser[0].createdAt?.toISOString()}`);
      console.log('\nIf you need to reset this account, please delete it from the database first.');
      process.exit(1);
    }

    // Prompt for password
    const password = await promptPassword();

    if (!password || password.length < 6) {
      console.log('\n❌ Error: Password must be at least 6 characters long.');
      console.log(`   Received password length: ${password.length}`);
      process.exit(1);
    }

    // Generate unique userId
    const userId = await generateUniqueUserId();
    
    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create the superadmin user
    const [newUser] = await db.insert(users).values({
      userId,
      email,
      mobile,
      password: hashedPassword,
      firstName: 'Support',
      lastName: 'Admin',
      roles: ['superadmin', 'admin', 'user'], // All roles for maximum access
      isEmailVerified: true,
      isMobileVerified: true,
      isActive: true,
    }).returning();

    console.log('\n✅ Superadmin account created successfully!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Account Details:');
    console.log(`  User ID:  ${newUser.userId}`);
    console.log(`  Email:    ${newUser.email}`);
    console.log(`  Mobile:   ${newUser.mobile}`);
    console.log(`  Roles:    ${newUser.roles?.join(', ')}`);
    console.log(`  Status:   ✓ Email Verified  ✓ Mobile Verified`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🔒 Security Notice:');
    console.log('   - Password is securely hashed and stored');
    console.log('   - You can now log in using any of: email, mobile, or User ID');
    console.log('   - Consider deleting this script after first use for security\n');
    console.log('📝 Login Options:');
    console.log(`   - Email:   ${email}`);
    console.log(`   - Mobile:  ${mobile}`);
    console.log(`   - User ID: ${userId}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating superadmin account:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

createSuperAdmin();
