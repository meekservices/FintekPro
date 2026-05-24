import { db } from './server/db';
import { users } from './shared/schema/users';
import { eq } from 'drizzle-orm';

async function test() {
  const user = await db.select().from(users).where(eq(users.email, 'sangram.m@outlook.com')).limit(1);
  if (user.length > 0) {
    console.log("Roles:", user[0].roles);
    console.log("Type:", typeof user[0].roles, Array.isArray(user[0].roles) ? "Array" : "Not Array");
  } else {
    console.log("User not found");
  }
  process.exit(0);
}
test();
