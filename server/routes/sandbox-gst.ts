import { Express, Request, Response } from 'express';
import { sandboxGSTService } from '../services/sandbox-gst-service';

// ─────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────
const ok = (res: Response, data: any) => res.json(data);
const err = (res: Response, e: unknown, label: string) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[GST] ${label}:`, msg);
  res.status(500).json({ success: false, message: msg });
};
const bad = (res: Response, msg: string) => res.status(400).json({ success: false, message: msg });

export function registerSandboxGSTRoutes(app: Express): void {

  // ════════════════════════════════════════════════════════════
  // PUBLIC APIS — no portal session required
  // ════════════════════════════════════════════════════════════

  /**
   * POST /api/gst/public/gstin/search
   * Search a GSTIN — returns registration details, trade name, address, status.
   * Body: { gstin }
   */
  app.post('/api/gst/public/gstin/search', async (req: Request, res: Response) => {
    try {
      const { gstin } = req.body;
      if (!gstin) return bad(res, 'gstin is required');
      ok(res, await sandboxGSTService.searchGstin(gstin));
    } catch (e) { err(res, e, 'searchGstin'); }
  });

  /**
   * POST /api/gst/public/gstrs/track
   * Track GST return filing history for a GSTIN.
   * Body: { gstin }
   */
  app.post('/api/gst/public/gstrs/track', async (req: Request, res: Response) => {
    try {
      const { gstin } = req.body;
      if (!gstin) return bad(res, 'gstin is required');
      ok(res, await sandboxGSTService.trackReturns(gstin));
    } catch (e) { err(res, e, 'trackReturns'); }
  });

  /**
   * POST /api/gst/public/pan/search
   * Find all GSTINs linked to a PAN.
   * Body: { pan }
   */
  app.post('/api/gst/public/pan/search', async (req: Request, res: Response) => {
    try {
      const { pan } = req.body;
      if (!pan) return bad(res, 'pan is required');
      ok(res, await sandboxGSTService.searchByPan(pan));
    } catch (e) { err(res, e, 'searchByPan'); }
  });

  // ════════════════════════════════════════════════════════════
  // TAXPAYER AUTHENTICATION — portal session management
  // ════════════════════════════════════════════════════════════

  /**
   * POST /api/gst/auth/otp
   * Generate OTP to initiate a GST portal session.
   * Body: { username, gstin }
   */
  app.post('/api/gst/auth/otp', async (req: Request, res: Response) => {
    try {
      const { username, gstin } = req.body;
      if (!username || !gstin) return bad(res, 'username and gstin are required');
      ok(res, await sandboxGSTService.generateOtp(username, gstin));
    } catch (e) { err(res, e, 'generateOtp'); }
  });

  /**
   * POST /api/gst/auth/otp/verify
   * Verify OTP and start a portal session.
   * Body: { username, gstin, otp }
   */
  app.post('/api/gst/auth/otp/verify', async (req: Request, res: Response) => {
    try {
      const { username, gstin, otp } = req.body;
      if (!username || !gstin || !otp) return bad(res, 'username, gstin and otp are required');
      ok(res, await sandboxGSTService.verifyOtp(username, gstin, otp));
    } catch (e) { err(res, e, 'verifyOtp'); }
  });

  /**
   * POST /api/gst/auth/session/refresh
   * Refresh an existing GST portal session.
   */
  app.post('/api/gst/auth/session/refresh', async (_req: Request, res: Response) => {
    try {
      ok(res, await sandboxGSTService.refreshSession());
    } catch (e) { err(res, e, 'refreshSession'); }
  });

  /**
   * POST /api/gst/auth/evc/otp
   * Generate EVC (Electronic Verification Code) OTP for return filing.
   * Body: { pan }
   */
  app.post('/api/gst/auth/evc/otp', async (req: Request, res: Response) => {
    try {
      const { pan } = req.body;
      if (!pan) return bad(res, 'pan is required');
      ok(res, await sandboxGSTService.generateEvcOtp(pan));
    } catch (e) { err(res, e, 'generateEvcOtp'); }
  });

  /**
   * POST /api/gst/auth/logout
   * Logout from the GST portal session.
   */
  app.post('/api/gst/auth/logout', async (_req: Request, res: Response) => {
    try {
      ok(res, await sandboxGSTService.logout());
    } catch (e) { err(res, e, 'logout'); }
  });

  // ════════════════════════════════════════════════════════════
  // GSTR-2A — Purchase return data (auto-populated from supplier GSTR-1)
  // Requires an active taxpayer portal session
  // ════════════════════════════════════════════════════════════

  /**
   * GET /api/gst/gstr-2a/document/:year/:month
   * Full GSTR-2A document summary for the period (no sub-section in path).
   */
  app.get('/api/gst/gstr-2a/document/:year/:month', async (req: Request, res: Response) => {
    try {
      const { year, month } = req.params;
      ok(res, await sandboxGSTService.gstr2aDocument(year, month));
    } catch (e) { err(res, e, 'gstr2aDocument'); }
  });

  /**
   * GET /api/gst/gstr-2a/:section/:year/:month
   * Fetch a specific GSTR-2A section.
   * :section = amdhist | b2b | b2ba | cdn | cdna | ecom | ecoma | impg | impgsez | isd | tcs | tds
   * :year = e.g. 2024  :month = 01..12
   */
  app.get('/api/gst/gstr-2a/:section/:year/:month', async (req: Request, res: Response) => {
    try {
      const { section, year, month } = req.params;
      const VALID_SECTIONS = ['amdhist','b2b','b2ba','cdn','cdna','ecom','ecoma','impg','impgsez','isd','tcs','tds'];
      if (!VALID_SECTIONS.includes(section)) {
        return bad(res, `Invalid section "${section}". Must be one of: ${VALID_SECTIONS.join(', ')}`);
      }
      ok(res, await sandboxGSTService.gstr2aSection(section as any, year, month));
    } catch (e) { err(res, e, 'gstr2aSection'); }
  });

  // ════════════════════════════════════════════════════════════
  // GSTR-2B — Auto-drafted ITC statement
  // ════════════════════════════════════════════════════════════

  /**
   * POST /api/gst/gstr-2b/:year/:month/regenerate
   * Trigger GSTR-2B regeneration for a period.
   */
  app.post('/api/gst/gstr-2b/:year/:month/regenerate', async (req: Request, res: Response) => {
    try {
      const { year, month } = req.params;
      ok(res, await sandboxGSTService.gstr2bRegenerate(year, month));
    } catch (e) { err(res, e, 'gstr2bRegenerate'); }
  });

  // ════════════════════════════════════════════════════════════
  // E-INVOICE
  // ════════════════════════════════════════════════════════════

  /**
   * POST /api/gst/e-invoice/authenticate
   * Authenticate with the E-Invoice (IRP) portal.
   * Body: { username, password, gstin }
   */
  app.post('/api/gst/e-invoice/authenticate', async (req: Request, res: Response) => {
    try {
      const { username, password, gstin } = req.body;
      if (!username || !password || !gstin) return bad(res, 'username, password and gstin are required');
      ok(res, await sandboxGSTService.eInvoiceAuthenticate(username, password, gstin));
    } catch (e) { err(res, e, 'eInvoiceAuthenticate'); }
  });

  /**
   * POST /api/gst/e-invoice/invoice
   * Generate an E-Invoice and get an IRN.
   * Body: full e-invoice JSON (Version, TranDtls, DocDtls, SellerDtls, BuyerDtls, ItemList, ValDtls)
   */
  app.post('/api/gst/e-invoice/invoice', async (req: Request, res: Response) => {
    try {
      if (!req.body || Object.keys(req.body).length === 0) return bad(res, 'Invoice data is required');
      ok(res, await sandboxGSTService.eInvoiceGenerate(req.body));
    } catch (e) { err(res, e, 'eInvoiceGenerate'); }
  });

  /**
   * GET /api/gst/e-invoice/invoice/:irn
   * Get E-Invoice details by IRN.
   */
  app.get('/api/gst/e-invoice/invoice/:irn', async (req: Request, res: Response) => {
    try {
      ok(res, await sandboxGSTService.eInvoiceGet(req.params.irn));
    } catch (e) { err(res, e, 'eInvoiceGet'); }
  });

  /**
   * POST /api/gst/e-invoice/invoice/:irn/cancel
   * Cancel an E-Invoice.
   * Body: { cancelReason, cancelRemark }
   */
  app.post('/api/gst/e-invoice/invoice/:irn/cancel', async (req: Request, res: Response) => {
    try {
      const { irn } = req.params;
      const { cancelReason, cancelRemark } = req.body;
      if (!cancelReason) return bad(res, 'cancelReason is required');
      ok(res, await sandboxGSTService.eInvoiceCancel(irn, String(cancelReason), cancelRemark || ''));
    } catch (e) { err(res, e, 'eInvoiceCancel'); }
  });

  /**
   * POST /api/gst/e-invoice/pdf/generate
   * Generate a PDF for an E-Invoice.
   * Body: { irn, signedQrCode }
   */
  app.post('/api/gst/e-invoice/pdf/generate', async (req: Request, res: Response) => {
    try {
      const { irn, signedQrCode } = req.body;
      if (!irn || !signedQrCode) return bad(res, 'irn and signedQrCode are required');
      ok(res, await sandboxGSTService.eInvoiceGeneratePdf(irn, signedQrCode));
    } catch (e) { err(res, e, 'eInvoiceGeneratePdf'); }
  });

  /**
   * GET /api/gst/e-invoice/invoice?docType=&docNo=&docDate=&sellerGstin=
   * Get E-Invoice by document data (search by doc type, number, date, seller GSTIN).
   */
  app.get('/api/gst/e-invoice/invoice', async (req: Request, res: Response) => {
    try {
      const { docType, docNo, docDate, sellerGstin } = req.query as Record<string, string>;
      ok(res, await sandboxGSTService.eInvoiceGetByDocData({ docType, docNo, docDate, sellerGstin }));
    } catch (e) { err(res, e, 'eInvoiceGetByDocData'); }
  });

  /**
   * POST /api/gst/e-invoice/invoice/:irn/e-way-bill
   * Generate an E-Way Bill from an E-Invoice IRN.
   * Body: { Distance, TransId, TransMode, TransName, TrnDocDt, TrnDocNo, VehNo, VehType }
   */
  app.post('/api/gst/e-invoice/invoice/:irn/e-way-bill', async (req: Request, res: Response) => {
    try {
      const { irn } = req.params;
      if (!req.body || Object.keys(req.body).length === 0) return bad(res, 'E-Way Bill data is required');
      ok(res, await sandboxGSTService.eInvoiceGenerateEwb(irn, req.body));
    } catch (e) { err(res, e, 'eInvoiceGenerateEwb'); }
  });

  /**
   * GET /api/gst/e-invoice/invoice/:irn/e-way-bill
   * Get the E-Way Bill linked to an E-Invoice IRN.
   */
  app.get('/api/gst/e-invoice/invoice/:irn/e-way-bill', async (req: Request, res: Response) => {
    try {
      ok(res, await sandboxGSTService.eInvoiceGetEwb(req.params.irn));
    } catch (e) { err(res, e, 'eInvoiceGetEwb'); }
  });

  /**
   * POST /api/gst/e-invoice/gstin/search
   * Check if a GSTIN is e-invoice enabled via the IRP portal.
   * Body: { gstin }
   */
  app.post('/api/gst/e-invoice/gstin/search', async (req: Request, res: Response) => {
    try {
      const { gstin } = req.body;
      if (!gstin) return bad(res, 'gstin is required');
      ok(res, await sandboxGSTService.eInvoiceSearchGstin(gstin));
    } catch (e) { err(res, e, 'eInvoiceSearchGstin'); }
  });

  // ════════════════════════════════════════════════════════════
  // E-WAY BILL — AUTH + COMMON
  // ════════════════════════════════════════════════════════════

  /**
   * POST /api/gst/e-way-bill/authenticate
   * Authenticate with the E-Way Bill portal.
   * Body: { username, password, gstin }
   */
  app.post('/api/gst/e-way-bill/authenticate', async (req: Request, res: Response) => {
    try {
      const { username, password, gstin } = req.body;
      if (!username || !password || !gstin) return bad(res, 'username, password and gstin are required');
      ok(res, await sandboxGSTService.ewbAuthenticate(username, password, gstin));
    } catch (e) { err(res, e, 'ewbAuthenticate'); }
  });

  /**
   * GET /api/gst/e-way-bill/bill/:ewb_no
   * Get E-Way Bill details by EWB number.
   */
  app.get('/api/gst/e-way-bill/bill/:ewb_no', async (req: Request, res: Response) => {
    try {
      ok(res, await sandboxGSTService.ewbGet(req.params.ewb_no));
    } catch (e) { err(res, e, 'ewbGet'); }
  });

  /**
   * GET /api/gst/e-way-bill/error-list
   * Get the complete E-Way Bill error code reference list.
   */
  app.get('/api/gst/e-way-bill/error-list', async (_req: Request, res: Response) => {
    try {
      ok(res, await sandboxGSTService.ewbGetErrorList());
    } catch (e) { err(res, e, 'ewbGetErrorList'); }
  });

  /**
   * POST /api/gst/e-way-bill/gstin/search
   * Search a GSTIN via the E-Way Bill portal.
   * Body: { gstin }
   */
  app.post('/api/gst/e-way-bill/gstin/search', async (req: Request, res: Response) => {
    try {
      const { gstin } = req.body;
      if (!gstin) return bad(res, 'gstin is required');
      ok(res, await sandboxGSTService.ewbSearchGstin(gstin));
    } catch (e) { err(res, e, 'ewbSearchGstin'); }
  });

  // ════════════════════════════════════════════════════════════
  // E-WAY BILL — CONSIGNOR
  // ════════════════════════════════════════════════════════════

  /**
   * POST /api/gst/e-way-bill/consignor/bill
   * Generate a new E-Way Bill (consignor).
   * Body: full EWB request JSON (supplyType, subSupplyType, docType, docNo, docDate,
   *        fromGstin, fromTrdName, fromAddr1, fromPincode, toGstin, toPincode,
   *        transactionType, totalValue, taxValues, itemList, transDetails, ...)
   */
  app.post('/api/gst/e-way-bill/consignor/bill', async (req: Request, res: Response) => {
    try {
      if (!req.body || !req.body.docNo) return bad(res, 'E-Way Bill data with docNo is required');
      ok(res, await sandboxGSTService.ewbConsignorGenerate(req.body));
    } catch (e) { err(res, e, 'ewbConsignorGenerate'); }
  });

  /**
   * GET /api/gst/e-way-bill/consignor/bills
   * List E-Way Bills generated by consignor (filter by date).
   * Query: date?, type?, fromDate?, toDate?
   */
  app.get('/api/gst/e-way-bill/consignor/bills', async (req: Request, res: Response) => {
    try {
      const { date, type, fromDate, toDate } = req.query as Record<string, string>;
      ok(res, await sandboxGSTService.ewbConsignorGetByDate({ date, type, fromDate, toDate }));
    } catch (e) { err(res, e, 'ewbConsignorGetByDate'); }
  });

  /**
   * POST /api/gst/e-way-bill/consignor/bill/:ewb_no/cancel
   * Cancel an E-Way Bill (consignor).
   * Body: { cancelRsnCode, cancelRmrk }
   */
  app.post('/api/gst/e-way-bill/consignor/bill/:ewb_no/cancel', async (req: Request, res: Response) => {
    try {
      const { ewb_no } = req.params;
      const { cancelRsnCode, cancelRmrk } = req.body;
      if (!cancelRsnCode) return bad(res, 'cancelRsnCode is required');
      ok(res, await sandboxGSTService.ewbConsignorCancel(ewb_no, Number(cancelRsnCode), cancelRmrk || ''));
    } catch (e) { err(res, e, 'ewbConsignorCancel'); }
  });

  /**
   * POST /api/gst/e-way-bill/consignor/bill/:ewb_no/extend
   * Extend the validity of a consignor E-Way Bill.
   * Body: { vehicleNo, fromPlace, fromState, reasonCode, reasonRem, transDocNo, transDocDate, transMode, vehicleType }
   */
  app.post('/api/gst/e-way-bill/consignor/bill/:ewb_no/extend', async (req: Request, res: Response) => {
    try {
      const { ewb_no } = req.params;
      if (!req.body.fromPlace) return bad(res, 'fromPlace is required');
      ok(res, await sandboxGSTService.ewbConsignorExtendValidity(ewb_no, req.body));
    } catch (e) { err(res, e, 'ewbConsignorExtendValidity'); }
  });

  /**
   * PUT /api/gst/e-way-bill/consignor/bill/:ewb_no/vehicle
   * Update vehicle details on an E-Way Bill (consignor).
   * Body: { vehicleNo, fromPlace, fromState, reasonCode, reasonRem, transDocNo, transDocDate, transMode, vehicleType }
   */
  app.put('/api/gst/e-way-bill/consignor/bill/:ewb_no/vehicle', async (req: Request, res: Response) => {
    try {
      const { ewb_no } = req.params;
      if (!req.body.vehicleNo) return bad(res, 'vehicleNo is required');
      ok(res, await sandboxGSTService.ewbConsignorUpdateVehicle(ewb_no, req.body));
    } catch (e) { err(res, e, 'ewbConsignorUpdateVehicle'); }
  });

  /**
   * PUT /api/gst/e-way-bill/consignor/bill/:ewb_no/transporter
   * Update the transporter on a consignor E-Way Bill.
   * Body: { transporterId }
   */
  app.put('/api/gst/e-way-bill/consignor/bill/:ewb_no/transporter', async (req: Request, res: Response) => {
    try {
      const { ewb_no } = req.params;
      const { transporterId } = req.body;
      if (!transporterId) return bad(res, 'transporterId is required');
      ok(res, await sandboxGSTService.ewbConsignorUpdateTransporter(ewb_no, transporterId));
    } catch (e) { err(res, e, 'ewbConsignorUpdateTransporter'); }
  });

  /**
   * POST /api/gst/e-way-bill/consignor/consolidated-bill
   * Consolidate multiple E-Way Bills into a single consolidated EWB.
   * Body: { fromPlace, fromState, transDocDate, transDocNo, transMode, tripSheetEwbBills: [{ ewbNo }], vehicleNo }
   */
  app.post('/api/gst/e-way-bill/consignor/consolidated-bill', async (req: Request, res: Response) => {
    try {
      if (!req.body.tripSheetEwbBills?.length) return bad(res, 'tripSheetEwbBills (array) is required');
      ok(res, await sandboxGSTService.ewbConsignorConsolidate(req.body));
    } catch (e) { err(res, e, 'ewbConsignorConsolidate'); }
  });

  // ════════════════════════════════════════════════════════════
  // E-WAY BILL — CONSIGNEE
  // ════════════════════════════════════════════════════════════

  /**
   * GET /api/gst/e-way-bill/consignee/bills
   * Get E-Way Bills received by consignee.
   * Query: fromDate?, toDate?
   */
  app.get('/api/gst/e-way-bill/consignee/bills', async (req: Request, res: Response) => {
    try {
      const { fromDate, toDate } = req.query as Record<string, string>;
      ok(res, await sandboxGSTService.ewbConsigneeGetByDate({ fromDate, toDate }));
    } catch (e) { err(res, e, 'ewbConsigneeGetByDate'); }
  });

  /**
   * POST /api/gst/e-way-bill/consignee/bill/:ewb_no/reject
   * Reject an E-Way Bill (consignee).
   */
  app.post('/api/gst/e-way-bill/consignee/bill/:ewb_no/reject', async (req: Request, res: Response) => {
    try {
      ok(res, await sandboxGSTService.ewbConsigneeReject(req.params.ewb_no));
    } catch (e) { err(res, e, 'ewbConsigneeReject'); }
  });

  // ════════════════════════════════════════════════════════════
  // E-WAY BILL — TRANSPORTER
  // ════════════════════════════════════════════════════════════

  /**
   * GET /api/gst/e-way-bill/transporter/bills
   * Get E-Way Bills assigned to the transporter, filtered by date and state.
   * Query: fromDate?, toDate?, state?
   */
  app.get('/api/gst/e-way-bill/transporter/bills', async (req: Request, res: Response) => {
    try {
      const { fromDate, toDate, state } = req.query as Record<string, string>;
      ok(res, await sandboxGSTService.ewbTransporterGetByDateAndState({ fromDate, toDate, state }));
    } catch (e) { err(res, e, 'ewbTransporterGetByDateAndState'); }
  });

  // ════════════════════════════════════════════════════════════
  // STATUS
  // ════════════════════════════════════════════════════════════

  /**
   * GET /api/gst/status
   * Returns all GST endpoint groups and their route paths.
   */
  app.get('/api/gst/status', (_req: Request, res: Response) => {
    res.json({
      service: 'Sandbox GST API',
      groups: {
        public: [
          'POST /api/gst/public/gstin/search',
          'POST /api/gst/public/gstrs/track',
          'POST /api/gst/public/pan/search',
        ],
        auth: [
          'POST /api/gst/auth/otp',
          'POST /api/gst/auth/otp/verify',
          'POST /api/gst/auth/session/refresh',
          'POST /api/gst/auth/evc/otp',
          'POST /api/gst/auth/logout',
        ],
        gstr2a: [
          'GET  /api/gst/gstr-2a/document/:year/:month',
          'GET  /api/gst/gstr-2a/:section/:year/:month',
          '     sections: amdhist|b2b|b2ba|cdn|cdna|ecom|ecoma|impg|impgsez|isd|tcs|tds',
        ],
        gstr2b: [
          'POST /api/gst/gstr-2b/:year/:month/regenerate',
        ],
        eInvoice: [
          'POST /api/gst/e-invoice/authenticate',
          'POST /api/gst/e-invoice/invoice',
          'GET  /api/gst/e-invoice/invoice/:irn',
          'POST /api/gst/e-invoice/invoice/:irn/cancel',
          'POST /api/gst/e-invoice/pdf/generate',
          'GET  /api/gst/e-invoice/invoice?docType=&docNo=&docDate=&sellerGstin=',
          'POST /api/gst/e-invoice/invoice/:irn/e-way-bill',
          'GET  /api/gst/e-invoice/invoice/:irn/e-way-bill',
          'POST /api/gst/e-invoice/gstin/search',
        ],
        eWayBill: [
          'POST /api/gst/e-way-bill/authenticate',
          'GET  /api/gst/e-way-bill/bill/:ewb_no',
          'GET  /api/gst/e-way-bill/error-list',
          'POST /api/gst/e-way-bill/gstin/search',
          'POST /api/gst/e-way-bill/consignor/bill',
          'GET  /api/gst/e-way-bill/consignor/bills',
          'POST /api/gst/e-way-bill/consignor/bill/:ewb_no/cancel',
          'POST /api/gst/e-way-bill/consignor/bill/:ewb_no/extend',
          'PUT  /api/gst/e-way-bill/consignor/bill/:ewb_no/vehicle',
          'PUT  /api/gst/e-way-bill/consignor/bill/:ewb_no/transporter',
          'POST /api/gst/e-way-bill/consignor/consolidated-bill',
          'GET  /api/gst/e-way-bill/consignee/bills',
          'POST /api/gst/e-way-bill/consignee/bill/:ewb_no/reject',
          'GET  /api/gst/e-way-bill/transporter/bills',
        ],
      },
    });
  });

  console.log('✅ Sandbox GST routes registered (Public / Auth / GSTR-2A / GSTR-2B / E-Invoice / E-Way Bill)');
}
