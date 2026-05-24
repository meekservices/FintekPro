import { db } from './server/db';
import { users } from './shared/schema/users';
import { eq } from 'drizzle-orm';
import { apiResponse } from './server/utils/responses';
import express from 'express';

async function test() {
  const user = await db.select().from(users).where(eq(users.email, 'sangram.m@outlook.com')).limit(1);
  if (user.length > 0) {
    const resPayload = {
      id: user[0].id,
      userId: user[0].userId,
      email: user[0].email,
      mobile: user[0].mobile,
      firstName: user[0].firstName,
      middleName: user[0].middleName,
      lastName: user[0].lastName,
      roles: user[0].roles,
    };
    console.log("resPayload:", JSON.stringify(resPayload, null, 2));
  }
  process.exit(0);
}
test();
