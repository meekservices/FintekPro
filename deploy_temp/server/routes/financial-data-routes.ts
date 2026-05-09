import { Express, Request, Response } from 'express';
import { pool } from '../db';
import { financialDataRepository } from '../services/financial-data-repository';
import { financialDataScheduler } from '../services/financial-data-scheduler';

export function registerFinancialDataRoutes(app: Express): void {
  app.get('/api/financial-data/statistics', async (req: Request, res: Response) => {
    try {
      const stats = await financialDataRepository.getStatistics();
      res.json(stats);
    } catch (error) {
      console.error('Statistics error:', error);
      res.status(500).json({ message: 'Failed to fetch statistics' });
    }
  });

  app.get('/api/financial-data/instrument/:type/:symbol', async (req: Request, res: Response) => {
    try {
      const { type, symbol } = req.params;
      const data = await financialDataRepository.fetchWithValidation(type, symbol);
      if (data) {
        res.json(data);
      } else {
        res.status(404).json({ message: 'Instrument not found' });
      }
    } catch (error) {
      console.error('Instrument fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch instrument data' });
    }
  });

  app.get('/api/financial-data/search', async (req: Request, res: Response) => {
    try {
      const { type, query, category, exchange } = req.query;
      const client = await pool.connect();
      try {
        let sql = `SELECT * FROM financial_instruments_cache WHERE 1=1`;
        const params: any[] = [];
        
        if (type && type !== 'all') {
          params.push(type);
          sql += ` AND instrument_type = $${params.length}`;
        }
        if (query) {
          params.push(`%${query}%`);
          sql += ` AND (symbol ILIKE $${params.length} OR name ILIKE $${params.length})`;
        }
        if (category) {
          params.push(category);
          sql += ` AND category = $${params.length}`;
        }
        if (exchange) {
          params.push(exchange);
          sql += ` AND exchange = $${params.length}`;
        }
        
        sql += ` ORDER BY updated_at DESC LIMIT 100`;
        const result = await client.query(sql, params);
        res.json(result.rows);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ message: 'Search failed' });
    }
  });

  app.get('/api/financial-data/by-type/:type', async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT * FROM financial_instruments_cache WHERE instrument_type = $1 ORDER BY updated_at DESC LIMIT 200`,
          [type]
        );
        res.json(result.rows);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('By type error:', error);
      res.status(500).json({ message: 'Failed to fetch instruments' });
    }
  });

  app.post('/api/financial-data/refresh', async (req: Request, res: Response) => {
    try {
      const { type } = req.body;
      await financialDataScheduler.forceRefresh(type);
      res.json({ message: 'Refresh initiated', type: type || 'all' });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ message: 'Refresh failed' });
    }
  });

  app.get('/api/financial-data/scheduler-status', async (req: Request, res: Response) => {
    try {
      const status = financialDataScheduler.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Scheduler status error:', error);
      res.status(500).json({ message: 'Failed to fetch scheduler status' });
    }
  });

  app.get('/api/financial-data/for-proposals', async (req: Request, res: Response) => {
    try {
      const data = await financialDataRepository.getInstrumentsForProposals();
      res.json(data);
    } catch (error) {
      console.error('Proposals data error:', error);
      res.status(500).json({ message: 'Failed to fetch proposal data' });
    }
  });

  console.log('✅ [Financial Data Routes] Registered successfully');
}
