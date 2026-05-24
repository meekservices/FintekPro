import { db } from './server/db';
import { users } from './shared/schema/users';
import { eq } from 'drizzle-orm';

async function test() {
  const allUsers = await db.select().from(users).where(eq(users.email, 'sangram.m@outlook.com'));
  console.log(`Found ${allUsers.length} users with email sangram.m@outlook.com`);
  for (const u of allUsers) {
    console.log(`ID: ${u.id}, Roles: ${JSON.stringify(u.roles)}`);
  }
  process.exit(0);
}
test();
