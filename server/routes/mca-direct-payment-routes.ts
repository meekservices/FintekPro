import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { mcaDirectPaymentService, McaFeeType } from '../services/mca-direct-payment-service';

const router = Router();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const user = (req as any).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

router.use(requireAdmin);

const initiatePaymentSchema = z.object({
  cin: z.string().length(21, 'CIN must be exactly 21 characters'),
  companyName: z.string().optional(),
  feeType: z.enum([
    'AOC-4', 'AOC-4-XBRL', 'MGT-7', 'MGT-7A', 'DIR-3-KYC', 
    'ADT-1', 'CHG-1', 'CHG-4', 'SH-7', 'INC-20A', 
    'DPT-3', 'MSME-1', 'LLP-8', 'LLP-11', 'OTHER'
  ] as const),
  filingYear: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  notes: z.string().optional(),
});

const confirmPaymentSchema = z.object({
  mcaChallanNumber: z.string().min(1, 'Challan number is required'),
  mcaTransactionId: z.string().optional(),
  mcaPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  paymentMode: z.string().optional(),
  bankName: z.string().optional(),
  mcaReceiptUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

router.get('/fee-types', async (req: Request, res: Response) => {
  try {
    const feeTypes = mcaDirectPaymentService.getFeeTypes();
    res.json({
      success: true,
      feeTypes,
      mcaPortalUrl: mcaDirectPaymentService.getMcaPortalUrl(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/initiate', async (req: Request, res: Response) => {
  try {
    const parsed = initiatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const user = (req as any).user;
    const result = await mcaDirectPaymentService.initiatePayment({
      ...parsed.data,
      initiatedBy: user?.email || req.body.initiatedBy || 'unknown',
      initiatedByUserId: user?.id || req.body.initiatedByUserId,
    });

    if (result.success) {
      res.json({
        success: true,
        payment: result.payment,
        mcaPortalUrl: result.mcaPortalUrl,
        message: 'Payment initiated. Please complete payment on MCA portal and return to confirm.',
        instructions: [
          '1. Click the MCA Portal link to open the payment page',
          '2. Complete your payment using Net Banking, UPI, or Card',
          '3. Save the Challan/SRN number from MCA',
          '4. Return here and confirm the payment with the Challan details',
        ],
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:paymentId/confirm', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const parsed = confirmPaymentSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const user = (req as any).user;
    const result = await mcaDirectPaymentService.confirmPayment({
      paymentId,
      ...parsed.data,
      confirmedBy: user?.email || req.body.confirmedBy || 'unknown',
    });

    if (result.success) {
      res.json({
        success: true,
        payment: result.payment,
        zohoSynced: result.zohoSynced,
        message: result.zohoSynced 
          ? 'Payment confirmed and synced to Zoho Books'
          : 'Payment confirmed. Zoho Books sync pending.',
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:paymentId/retry-zoho-sync', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const result = await mcaDirectPaymentService.retryZohoSync(paymentId);
    
    if (result.success) {
      res.json({
        success: true,
        expenseId: result.expenseId,
        message: 'Successfully synced to Zoho Books',
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:paymentId/cancel', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Cancellation reason is required' });
    }

    const user = (req as any).user;
    const result = await mcaDirectPaymentService.cancelPayment(
      paymentId,
      reason,
      user?.email || 'unknown'
    );

    if (result.success) {
      res.json({ success: true, message: 'Payment cancelled' });
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const payment = await mcaDirectPaymentService.getPayment(paymentId);
    
    if (payment) {
      res.json({ success: true, payment });
    } else {
      res.status(404).json({ success: false, error: 'Payment not found' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/company/:cin', async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const payments = await mcaDirectPaymentService.getPaymentsByCin(cin);
    res.json({ success: true, payments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status/pending', async (req: Request, res: Response) => {
  try {
    const payments = await mcaDirectPaymentService.getPendingConfirmations();
    res.json({ success: true, payments, count: payments.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit, offset, status, feeType, fromDate, toDate } = req.query;
    
    const result = await mcaDirectPaymentService.getPaymentHistory({
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      status: status as string,
      feeType: feeType as string,
      fromDate: fromDate as string,
      toDate: toDate as string,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary/stats', async (req: Request, res: Response) => {
  try {
    const summary = await mcaDirectPaymentService.getPaymentSummary();
    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/reconciliation', async (req: Request, res: Response) => {
  try {
    const { fromDate, toDate } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        error: 'fromDate and toDate query parameters are required (YYYY-MM-DD format)',
      });
    }

    const report = await mcaDirectPaymentService.getReconciliationReport(
      fromDate as string,
      toDate as string
    );

    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
