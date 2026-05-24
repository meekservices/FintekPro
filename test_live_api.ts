import { db } from './server/db';
import { users } from './shared/schema/users';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function test() {
  try {
    const user = await db.select().from(users).where(eq(users.email, 'sangram.m@outlook.com')).limit(1);
    if (user.length === 0) {
      console.log('User not found');
      return;
    }
    
    // We can just call the endpoint logic directly to see what express returns
    // Actually, let's just make a mock Express app that uses the exact same `app.get("/api/user")` code
    // and `sensitiveDataMaskingMiddleware` and see what happens.
    
    const { registerAuthRoutes } = await import('./server/auth');
    const { sensitiveDataMaskingMiddleware } = await import('./server/middleware/sensitive-data-masking');
    const express = (await import('express')).default;
    
    const app = express();
    app.use(express.json());
    app.use(sensitiveDataMaskingMiddleware);
    
    // Mock authentication
    app.use((req, res, next) => {
      (req as any).isAuthenticated = () => true;
      (req as any).user = user[0];
      next();
    });
    
    registerAuthRoutes(app);
    
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      const res = await fetch(`http://localhost:${port}/api/user`);
      const text = await res.text();
      console.log("EXACT RESPONSE BODY:");
      console.log(text);
      process.exit(0);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
