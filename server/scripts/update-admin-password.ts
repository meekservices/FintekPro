import { hashPassword } from '../auth';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function updateAdminPassword() {
  const newPassword = 'Kamini@321';
  const userId = 'FTP408711';
  
  try {
    console.log('Hashing new password...');
    const hashedPassword = await hashPassword(newPassword);
    
    console.log('Updating admin password in database...');
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.userId, userId));
    
    console.log('✅ Admin password updated successfully!');
    console.log('New credentials:');
    console.log('  User ID: FTP408711');
    console.log('  Email: skmohanty0@gmail.com');
    console.log('  Mobile: 7795048528');
    console.log('  Password: Kamini@321');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  }
}

updateAdminPassword();
