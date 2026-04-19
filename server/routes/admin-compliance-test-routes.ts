import { Express, Request, Response } from 'express';
import { requireAdmin } from '../middleware/roleMiddleware';
import { storage } from '../storage';
import { complianceMonitor } from '../compliance-monitor';
import { seedProducts } from '../seed-products';
import { AuthRequest } from '../types/broker-types';

interface ComplianceFilters {
  userId?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  riskLevel?: string;
}

export function registerAdminComplianceTestRoutes(app: Express): void {
  app.post("/api/admin/seed-products", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const count = await seedProducts(storage);
      res.json({ 
        success: true, 
        message: `Successfully seeded ${count} products`,
        count
      });
    } catch (error: unknown) {
      console.error("Error seeding products:", error);
      res.status(500).json({ error: "Failed to seed products" });
    }
  });

  // Compliance monitoring endpoints
  app.get("/api/admin/compliance/events", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, eventType, startDate, endDate, riskLevel, limit = "100" } = req.query;
      
      const filters: ComplianceFilters = {};
      if (userId) filters.userId = userId as string;
      if (eventType) filters.eventType = eventType as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (riskLevel) filters.riskLevel = riskLevel as string;
      
      const events = complianceMonitor.getEvents(filters as any);
      const limitedEvents = events.slice(0, parseInt(limit as string));
      
      res.json({
        events: limitedEvents,
        total: events.length,
        filters
      });
    } catch (error: unknown) {
      console.error("Error fetching compliance events:", error);
      res.status(500).json({ error: "Failed to fetch compliance events" });
    }
  });

  app.get("/api/admin/compliance/alerts", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { resolved } = req.query;
      const resolvedFilter = resolved === 'true' ? true : resolved === 'false' ? false : undefined;
      
      const alerts = complianceMonitor.getAlerts(resolvedFilter);
      
      res.json({
        alerts,
        total: alerts.length,
        unresolved: alerts.filter(a => !a.resolved).length
      });
    } catch (error: unknown) {
      console.error("Error fetching security alerts:", error);
      res.status(500).json({ error: "Failed to fetch security alerts" });
    }
  });

  app.post("/api/admin/compliance/alerts/:alertId/resolve", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { alertId } = req.params;
      const resolved = complianceMonitor.resolveAlert(alertId);
      
      if (resolved) {
        // Log the admin action
        complianceMonitor.logEvent({
          userId: (req as AuthRequest).user?.id,
          eventType: 'admin_action',
          action: `Resolved security alert: ${alertId}`,
          ipAddress: req.ip || '',
          userAgent: req.get('User-Agent') || '',
          outcome: 'success',
          riskLevel: 'medium',
          details: { alertId }
        });
        
        res.json({ success: true, message: "Alert resolved successfully" });
      } else {
        res.status(404).json({ error: "Alert not found" });
      }
    } catch (error: unknown) {
      console.error("Error resolving alert:", error);
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });

  app.get("/api/admin/compliance/report", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { timeframe = 'day' } = req.query;
      const report = complianceMonitor.getComplianceReport(timeframe as 'day' | 'week' | 'month');
      
      res.json(report);
    } catch (error: unknown) {
      console.error("Error generating compliance report:", error);
      res.status(500).json({ error: "Failed to generate compliance report" });
    }
  });

  // Cashfree Webhook Testing endpoint
  app.post("/api/admin/test-cashfree-webhook", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { webhookTester } = await import('../webhook-test-utility');
      const { orderId, amount, status } = req.body;

      if (!orderId) {
        res.status(400).json({ error: "Order ID is required" });
        return;
      }

      const result = await webhookTester.sendTestWebhook({
        orderId,
        amount: amount || 1000,
        status: status || 'PAID',
        userId: (req as AuthRequest).user?.id
      });

      res.json(result);
    } catch (error: unknown) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ error: "Failed to test webhook" });
    }
  });

  // Run full webhook test suite
  app.post("/api/admin/test-cashfree-suite", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { webhookTester } = await import('../webhook-test-utility');
      const { orderId } = req.body;

      if (!orderId) {
        res.status(400).json({ error: "Order ID is required for test suite" });
        return;
      }

      // Run test suite asynchronously
      webhookTester.runTestSuite(orderId).catch(err => 
        console.error('Test suite error:', err)
      );

      res.json({ 
        success: true, 
        message: 'Test suite started. Check server logs for results.' 
      });
    } catch (error: unknown) {
      console.error("Error running test suite:", error);
      res.status(500).json({ error: "Failed to run test suite" });
    }
  });

  // Test email server connectivity endpoint
  app.post("/api/admin/test-email", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { emailService } = await import('../email-service');
      const { email } = req.body;
      
      if (!email) {
        res.status(400).json({ error: "Email address is required" });
        return;
      }

      // Check if email service is configured
      const hasEmailConfig = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
      
      if (!hasEmailConfig) {
        res.json({
          success: false,
          configured: false,
          message: "Email service not configured. Missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS environment variables."
        });
        return;
      }

      // Send a test email
      const testOtp = "123456";
      const sent = await emailService.sendLoginOTP(email, testOtp);

      if (sent) {
        res.json({
          success: true,
          configured: true,
          message: `Test email sent successfully to ${email}. Check your inbox for the test OTP (123456).`
        });
      } else {
        res.json({
          success: false,
          configured: true,
          message: "Email service is configured but failed to send. Check server logs for details."
        });
      }
    } catch (error: unknown) {
      console.error("Error testing email:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ 
        success: false,
        error: "Failed to test email", 
        details: msg
      });
    }
  });
}
