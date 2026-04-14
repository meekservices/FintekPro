import { db } from '../../server/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

async function checkUser() {
  const pan = 'AMAPM7904P';
  console.log(`Checking user with PAN: ${pan}`);
  const [user] = await db.select().from(users).where(eq(users.panNumber, pan));
  if (user) {
    console.log('User found:', {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      pan: user.panNumber
    });
  } else {
    console.log('User NOT found in database.');
  }
  process.exit(0);
}

checkUser().catch(err => {
  console.error(err);
  process.exit(1);
});
