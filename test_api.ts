import { db } from './server/db';
import { users } from './shared/schema/users';
import { eq } from 'drizzle-orm';
import { apiResponse } from './server/utils/responses';
import express from 'express';

const app = express();
app.get('/test', (req, res) => {
  apiResponse.success(res, { id: '123', roles: ['agent'] });
});

const server = app.listen(0, async () => {
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/test`);
  const data = await res.json();
  console.log("Response JSON:", data);
  process.exit(0);
});
