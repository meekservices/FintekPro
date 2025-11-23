import express from 'express';
import http from 'http';

import ApiRouter from './api-routes';
import unlisted from './routes/unlisted';
import complianceRoutes from './routes/compliance';

export async function registerRoutes(app: express.Express): Promise<http.Server> {
  app.use('/api', ApiRouter);
  app.use('/api/unlisted', unlisted);
  app.use('/api/compliance', complianceRoutes);

  const server = http.createServer(app);
  return server;
}
