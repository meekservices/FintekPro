const { db } = require('./server/db');
const { users } = require('./shared/schema/users');
const { eq } = require('drizzle-orm');

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
