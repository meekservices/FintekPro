/**
 * Alert System Routes
 * P3 — Extracted from routes.ts to reduce file size
 */

import type { Express } from 'express';
import { storage } from '../storage';
import { z } from 'zod';

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function transformAlertData(formData: any) {
  const { alertType, operator, targetValue, threshold, timeframe, symbol, category: spendingCategory } = formData;
  let triggerCondition: any = {};
  const alertData: any = {
    ...formData,
    userId: formData.userId,
    alertName: formData.alertName,
    alertType,
    category: formData.category,
    notificationChannels: formData.notificationChannels || ['in_app'],
    isActive: true,
    priority: formData.priority || 'medium',
  };

  switch (alertType) {
    case 'market_price':
      triggerCondition = { type: operator === 'above' ? 'price_above' : 'price_below', value: parseFloat(targetValue) };
      alertData.symbol = symbol;
      break;
    case 'market_change':
      triggerCondition = { type: operator === 'increase' ? 'percent_gain' : 'percent_loss', value: parseFloat(threshold), timeframe: timeframe || '1d' };
      alertData.symbol = symbol;
      break;
    case 'spending_budget':
      triggerCondition = { type: 'category_limit', value: parseFloat(targetValue), threshold: parseFloat(threshold || '80') };
      alertData.spendingCategory = spendingCategory;
      alertData.spendingPeriod = timeframe;
      break;
    case 'portfolio_value':
      triggerCondition = { type: operator === 'gain' ? 'percent_gain' : 'percent_loss', value: parseFloat(threshold) };
      break;
  }

  alertData.triggerCondition = triggerCondition;
  return alertData;
}

export function registerAlertSystemRoutes(app: Express): void {
  app.post('/api/alerts', requireAuth, async (req, res) => {
    try {
      const formData = { ...req.body, userId: req.user!.id };
      const alertData = transformAlertData(formData);
      const alert = await storage.createUserAlert(alertData);
      res.status(201).json(alert);
    } catch (error) {
      console.error('Error creating alert:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      res.status(500).json({ message: 'Failed to create alert' });
    }
  });

  app.get('/api/alerts', requireAuth, async (req, res) => {
    try {
      const { category, type, status } = req.query;
      let alerts = await storage.getUserAlerts(req.user!.id, category as string);
      if (type) alerts = alerts.filter((a: any) => a.alertType === type);
      if (status === 'active') alerts = alerts.filter((a: any) => a.isActive);
      else if (status === 'inactive') alerts = alerts.filter((a: any) => !a.isActive);
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ message: 'Failed to fetch alerts' });
    }
  });

  app.get('/api/alerts/history', requireAuth, async (_req, res) => {
    res.json({ alerts: [], total: 0, message: 'Alert history feature coming soon' });
  });

  app.get('/api/alerts/templates', requireAuth, async (_req, res) => {
    res.json({
      templates: [
        { id: 'price_above', name: 'Price Above', description: 'Alert when price rises above threshold' },
        { id: 'price_below', name: 'Price Below', description: 'Alert when price falls below threshold' },
        { id: 'percent_change', name: 'Percent Change', description: 'Alert on significant price movement' },
      ],
    });
  });

  app.get('/api/alerts/:id', requireAuth, async (req, res) => {
    try {
      const alert = await storage.getUserAlert(req.params.id);
      if (!alert || alert.userId !== req.user!.id) return res.status(404).json({ message: 'Alert not found' });
      res.json(alert);
    } catch (error) {
      console.error('Error fetching alert:', error);
      res.status(500).json({ message: 'Failed to fetch alert' });
    }
  });

  app.patch('/api/alerts/:id', requireAuth, async (req, res) => {
    try {
      const alert = await storage.getUserAlert(req.params.id);
      if (!alert || alert.userId !== req.user!.id) return res.status(404).json({ message: 'Alert not found' });
      const updatedAlert = await storage.updateUserAlert(req.params.id, req.body);
      res.json(updatedAlert);
    } catch (error) {
      console.error('Error updating alert:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      res.status(500).json({ message: 'Failed to update alert' });
    }
  });

  app.delete('/api/alerts/:id', requireAuth, async (req, res) => {
    try {
      const alert = await storage.getUserAlert(req.params.id);
      if (!alert || alert.userId !== req.user!.id) return res.status(404).json({ message: 'Alert not found' });
      await storage.deleteUserAlert(req.params.id);
      res.json({ message: 'Alert deleted successfully' });
    } catch (error) {
      console.error('Error deleting alert:', error);
      res.status(500).json({ message: 'Failed to delete alert' });
    }
  });

  // Stub endpoints
  app.get('/api/loan-offers', async (_req, res) => {
    res.json({ offers: [], total: 0, message: 'Loan offers feature coming soon' });
  });

  app.get('/api/expenses', async (_req, res) => {
    res.json({ expenses: [], total: 0, message: 'Expense tracking feature coming soon' });
  });

  app.get('/api/expenses/by-category', async (_req, res) => {
    res.json({ categories: [], total: 0, message: 'Expense categories feature coming soon' });
  });

  app.get('/api/budgets', async (_req, res) => {
    res.json({ budgets: [], message: 'Budget tracking feature coming soon' });
  });

  app.get('/api/insights', async (_req, res) => {
    res.json({ insights: [], recommendations: [], message: 'Financial insights feature coming soon' });
  });
}
