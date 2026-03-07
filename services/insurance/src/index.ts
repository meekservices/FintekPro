import 'dotenv/config';
import express from 'express';
import { corsMiddleware } from './middleware/cors';
import productsRouter from './routes/products';
import suitabilityRouter from './routes/suitability';
import holdingsRouter from './routes/holdings';

const app = express();
const PORT = parseInt(process.env.PORT || '5001', 10);

app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'insurance', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.use('/api', productsRouter);
app.use('/api', suitabilityRouter);
app.use('/api', holdingsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', service: 'insurance' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Insurance Service Error]', err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ Insurance Service running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

export default app;
