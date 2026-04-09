import {
  getSandboxBaseUrl,
  getSandboxAccessToken,
  getSandboxApiKey,
  clearSandboxToken,
} from '../utils/sandbox-config';

const SANDBOX_BASE_URL = getSandboxBaseUrl();

// ─────────────────────────────────────────────────────────────
// Internal helper: build auth headers for every GST API call
// x-source is passed for endpoints that require a GST portal session
// ─────────────────────────────────────────────────────────────
async function gstHeaders(opts: { source?: string; contentType?: boolean } = {}): Promise<Record<string, string>> {
  let token: string;
  try {
    token = await getSandboxAccessToken();
  } catch {
    throw new Error('Sandbox credentials not configured (SANDBOX_API_KEY / SANDBOX_API_SECRET)');
  }

  const h: Record<string, string> = {
    Authorization: token,
    'x-api-key': getSandboxApiKey(),
    'x-api-version': '1.0.0',
    Accept: 'application/json',
  };
  if (opts.contentType !== false) h['Content-Type'] = 'application/json';
  if (opts.source) h['x-source'] = opts.source;
  return h;
}

// Generic fetch with 401-retry
async function sandboxFetch(
  path: string,
  init: RequestInit,
  retried = false
): Promise<any> {
  const res = await fetch(`${SANDBOX_BASE_URL}${path}`, init);

  if (res.status === 401 && !retried) {
    clearSandboxToken();
    const newToken = await getSandboxAccessToken();
    const newHeaders = { ...(init.headers as Record<string, string>), Authorization: newToken };
    return sandboxFetch(path, { ...init, headers: newHeaders }, true);
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { code: res.status, raw: text };
  }
}

async function get(path: string, extraHeaders: Record<string, string> = {}): Promise<any> {
  const headers = { ...(await gstHeaders({ contentType: false })), ...extraHeaders };
  return sandboxFetch(path, { method: 'GET', headers });
}

async function post(path: string, body: any, extraHeaders: Record<string, string> = {}): Promise<any> {
  const headers = { ...(await gstHeaders()), ...extraHeaders };
  return sandboxFetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function put(path: string, body: any, extraHeaders: Record<string, string> = {}): Promise<any> {
  const headers = { ...(await gstHeaders()), ...extraHeaders };
  return sandboxFetch(path, { method: 'PUT', headers, body: JSON.stringify(body) });
}

// ═══════════════════════════════════════════════════════════════
// ██  PUBLIC APIs  ██
// No GST portal session required — only Sandbox auth headers
// ═══════════════════════════════════════════════════════════════

/**
 * Search GSTIN.
 * POST /gst/compliance/public/gstin/search
 * Body: { gstin }
 */
export async function gstSearchGstin(gstin: string) {
  return post('/gst/compliance/public/gstin/search', { gstin });
}

/**
 * Track GST Returns for a GSTIN (return filing history).
 * POST /gst/compliance/public/gstrs/track
 * Body: { gstin }
 */
export async function gstTrackReturns(gstin: string) {
  return post('/gst/compliance/public/gstrs/track', { gstin });
}

/**
 * Search GSTINs by PAN + optional state code.
 * POST /gst/compliance/public/pan/search
 * Body: { pan }
 */
export async function gstSearchByPan(pan: string) {
  return post('/gst/compliance/public/pan/search', { pan });
}

// ═══════════════════════════════════════════════════════════════
// ██  TAXPAYER AUTH  ██
// Establishes a portal session for GSTR data access
// ═══════════════════════════════════════════════════════════════

/**
 * Generate OTP for GST portal login.
 * POST /gst/compliance/tax-payer/otp
 * Body: { username, gstin }
 */
export async function gstGenerateOtp(username: string, gstin: string) {
  return post('/gst/compliance/tax-payer/otp', { username, gstin }, { 'x-source': 'primary' });
}

/**
 * Verify OTP and establish a portal session.
 * POST /gst/compliance/tax-payer/otp/verify
 * Body: { username, gstin, otp }
 */
export async function gstVerifyOtp(username: string, gstin: string, otp: string) {
  return post('/gst/compliance/tax-payer/otp/verify', { username, gstin, otp }, { 'x-source': 'primary' });
}

/**
 * Refresh an existing taxpayer portal session.
 * POST /gst/compliance/tax-payer/session/refresh
 */
export async function gstRefreshSession() {
  const headers = { ...(await gstHeaders({ contentType: false })), 'x-source': 'primary' };
  return sandboxFetch('/gst/compliance/tax-payer/session/refresh', { method: 'POST', headers });
}

/**
 * Generate EVC OTP (Electronic Verification Code) for return filing.
 * POST /gst/compliance/tax-payer/evc/otp
 * Body: { pan }
 */
export async function gstGenerateEvcOtp(pan: string) {
  return post('/gst/compliance/tax-payer/evc/otp', { pan });
}

/**
 * Logout from the GST portal session.
 * POST /gst/compliance/tax-payer/logout
 */
export async function gstLogout() {
  const headers = { ...(await gstHeaders({ contentType: false })) };
  return sandboxFetch('/gst/compliance/tax-payer/logout', { method: 'POST', headers });
}

// ═══════════════════════════════════════════════════════════════
// ██  GSTR-2A  ██
// All require an active taxpayer portal session
// ═══════════════════════════════════════════════════════════════

type Gstr2aSection =
  | 'amdhist' | 'b2b' | 'b2ba' | 'cdn' | 'cdna'
  | 'ecom' | 'ecoma' | 'impg' | 'impgsez' | 'isd' | 'tcs' | 'tds';

/**
 * Fetch a specific GSTR-2A section for a year/month.
 * GET /gst/compliance/tax-payer/gstrs/gstr-2a/{section}/{year}/{month}
 * Sections: amdhist, b2b, b2ba, cdn, cdna, ecom, ecoma, impg, impgsez, isd, tcs, tds
 */
export async function gstr2aSection(section: Gstr2aSection, year: string, month: string) {
  return get(`/gst/compliance/tax-payer/gstrs/gstr-2a/${section}/${year}/${month}`);
}

/**
 * Fetch the GSTR-2A document summary for a period.
 * GET /gst/compliance/tax-payer/gstrs/gstr-2a/{year}/{month}  (no section in path)
 */
export async function gstr2aDocument(year: string, month: string) {
  return get(`/gst/compliance/tax-payer/gstrs/gstr-2a/${year}/${month}`);
}

// ═══════════════════════════════════════════════════════════════
// ██  GSTR-2B  ██
// ═══════════════════════════════════════════════════════════════

/**
 * Regenerate GSTR-2B for a period.
 * POST /gst/compliance/tax-payer/gstrs/gstr-2b/{year}/{month}/regenerate
 */
export async function gstr2bRegenerate(year: string, month: string) {
  const headers = { ...(await gstHeaders({ contentType: false })) };
  return sandboxFetch(`/gst/compliance/tax-payer/gstrs/gstr-2b/${year}/${month}/regenerate`, {
    method: 'POST', headers,
  });
}

// ═══════════════════════════════════════════════════════════════
// ██  E-INVOICE  ██
// ═══════════════════════════════════════════════════════════════

/**
 * Authenticate with the E-Invoice portal.
 * POST /gst/compliance/e-invoice/tax-payer/authenticate
 * Body: { username, password, gstin }
 */
export async function eInvoiceAuthenticate(username: string, password: string, gstin: string) {
  return post(
    '/gst/compliance/e-invoice/tax-payer/authenticate',
    { username, password, gstin },
    { 'x-source': 'primary' }
  );
}

/**
 * Generate an E-Invoice (IRN).
 * POST /gst/compliance/e-invoice/tax-payer/invoice
 * Body: (full e-invoice JSON per GST schema — Version, TranDtls, DocDtls, SellerDtls, BuyerDtls, ItemList, ValDtls)
 */
export async function eInvoiceGenerate(invoiceData: Record<string, any>) {
  return post('/gst/compliance/e-invoice/tax-payer/invoice', invoiceData);
}

/**
 * Get an E-Invoice by IRN.
 * GET /gst/compliance/e-invoice/tax-payer/invoice/{irn}
 */
export async function eInvoiceGet(irn: string) {
  return get(`/gst/compliance/e-invoice/tax-payer/invoice/${encodeURIComponent(irn)}`, { 'x-source': 'primary' });
}

/**
 * Cancel an E-Invoice.
 * POST /gst/compliance/e-invoice/tax-payer/invoice/{irn}/cancel
 * Body: { Irn, CnlRsn, CnlRem }
 */
export async function eInvoiceCancel(irn: string, cancelReason: string, cancelRemark: string) {
  return post(
    `/gst/compliance/e-invoice/tax-payer/invoice/${encodeURIComponent(irn)}/cancel`,
    { Irn: irn, CnlRsn: cancelReason, CnlRem: cancelRemark },
    { 'x-source': 'primary' }
  );
}

/**
 * Generate E-Invoice PDF.
 * POST /gst/compliance/e-invoice/pdf/generate
 * Body: { @entity, irn, signed_qr_code }
 */
export async function eInvoiceGeneratePdf(irn: string, signedQrCode: string) {
  return post('/gst/compliance/e-invoice/pdf/generate', {
    '@entity': 'in.co.sandbox.gst.compliance.e-invoice.pdf.request',
    irn,
    signed_qr_code: signedQrCode,
  });
}

/**
 * Get E-Invoice by document data (type, no, date, gstin).
 * GET /gst/compliance/e-invoice/tax-payer/invoice?docType=...&docNo=...&docDate=...&sellerGstin=...
 */
export async function eInvoiceGetByDocData(params: {
  docType?: string;
  docNo?: string;
  docDate?: string;
  sellerGstin?: string;
}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return get(`/gst/compliance/e-invoice/tax-payer/invoice${qs ? '?' + qs : ''}`, { 'x-source': 'primary' });
}

/**
 * Generate E-Way Bill from an E-Invoice IRN.
 * POST /gst/compliance/e-invoice/tax-payer/invoice/{irn}/e-way-bill
 * Body: { Irn, Distance, TransId, TransMode, TransName, TrnDocDt, TrnDocNo, VehNo, VehType }
 */
export async function eInvoiceGenerateEwb(irn: string, ewbData: Record<string, any>) {
  return post(
    `/gst/compliance/e-invoice/tax-payer/invoice/${encodeURIComponent(irn)}/e-way-bill`,
    { Irn: irn, ...ewbData },
    { 'x-source': 'primary' }
  );
}

/**
 * Get E-Way Bill linked to an E-Invoice IRN.
 * GET /gst/compliance/e-invoice/tax-payer/invoice/{irn}/e-way-bill
 */
export async function eInvoiceGetEwb(irn: string) {
  return get(`/gst/compliance/e-invoice/tax-payer/invoice/${encodeURIComponent(irn)}/e-way-bill`, {
    'x-source': 'primary',
  });
}

/**
 * Search GSTIN via the E-Invoice portal (returns e-invoice enabled status).
 * POST /gst/compliance/e-invoice/tax-payer/gstin/search
 * Body: { gstin }
 */
export async function eInvoiceSearchGstin(gstin: string) {
  return post('/gst/compliance/e-invoice/tax-payer/gstin/search', { gstin });
}

// ═══════════════════════════════════════════════════════════════
// ██  E-WAY BILL — AUTH + COMMON  ██
// ═══════════════════════════════════════════════════════════════

/**
 * Authenticate with the E-Way Bill portal.
 * POST /gst/compliance/e-way-bill/tax-payer/authenticate
 * Body: { username, password, gstin }
 */
export async function ewbAuthenticate(username: string, password: string, gstin: string) {
  return post(
    '/gst/compliance/e-way-bill/tax-payer/authenticate',
    { username, password, gstin },
    { 'x-source': 'primary' }
  );
}

/**
 * Get an E-Way Bill by EWB number.
 * GET /gst/compliance/e-way-bill/tax-payer/bill/{ewb_no}
 */
export async function ewbGet(ewbNo: string) {
  return get(`/gst/compliance/e-way-bill/tax-payer/bill/${encodeURIComponent(ewbNo)}`);
}

/**
 * Get the E-Way Bill error code list.
 * GET /gst/compliance/e-way-bill/tax-payer/error-list
 */
export async function ewbGetErrorList() {
  return get('/gst/compliance/e-way-bill/tax-payer/error-list');
}

/**
 * Search GSTIN via the E-Way Bill portal.
 * POST /gst/compliance/e-way-bill/tax-payer/gstin/search
 * Body: { gstin }
 */
export async function ewbSearchGstin(gstin: string) {
  return post('/gst/compliance/e-way-bill/tax-payer/gstin/search', { gstin });
}

// ═══════════════════════════════════════════════════════════════
// ██  E-WAY BILL — CONSIGNOR  ██
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a new E-Way Bill (consignor perspective).
 * POST /gst/compliance/e-way-bill/consignor/bill
 * Body: full EWB request (supplyType, subSupplyType, docType, docNo, docDate, from*, to*, items, transDetails, ...)
 */
export async function ewbConsignorGenerate(ewbData: Record<string, any>) {
  return post('/gst/compliance/e-way-bill/consignor/bill', ewbData);
}

/**
 * Get E-Way Bills generated by consignor, filtered by date.
 * GET /gst/compliance/e-way-bill/consignor/bills
 */
export async function ewbConsignorGetByDate(params: {
  date?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
} = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return get(`/gst/compliance/e-way-bill/consignor/bills${qs ? '?' + qs : ''}`);
}

/**
 * Cancel a consignor E-Way Bill.
 * POST /gst/compliance/e-way-bill/consignor/bill/{ewb_no}/cancel
 * Body: { ewbNo, cancelRsnCode, cancelRmrk }
 */
export async function ewbConsignorCancel(ewbNo: number | string, cancelRsnCode: number, cancelRmrk: string) {
  return post(`/gst/compliance/e-way-bill/consignor/bill/${encodeURIComponent(ewbNo)}/cancel`, {
    ewbNo, cancelRsnCode, cancelRmrk,
  });
}

/**
 * Extend the validity of a consignor E-Way Bill.
 * POST /gst/compliance/e-way-bill/consignor/bill/{ewb_no}/extend
 * Body: { ewbNo, vehicleNo, fromPlace, fromState, reasonCode, reasonRem, transDocNo, transDocDate, transMode, vehicleType }
 */
export async function ewbConsignorExtendValidity(ewbNo: number | string, extendData: Record<string, any>) {
  return post(`/gst/compliance/e-way-bill/consignor/bill/${encodeURIComponent(ewbNo)}/extend`, {
    ewbNo, ...extendData,
  });
}

/**
 * Update vehicle details on an E-Way Bill (consignor).
 * PUT /gst/compliance/e-way-bill/consignor/bill/{ewb_no}/vehicle
 */
export async function ewbConsignorUpdateVehicle(ewbNo: number | string, vehicleData: Record<string, any>) {
  return put(`/gst/compliance/e-way-bill/consignor/bill/${encodeURIComponent(ewbNo)}/vehicle`, {
    ewbNo, ...vehicleData,
  });
}

/**
 * Update transporter on an E-Way Bill (consignor).
 * PUT /gst/compliance/e-way-bill/consignor/bill/{ewb_no}/transporter
 * Body: { ewbNo, transporterId }
 */
export async function ewbConsignorUpdateTransporter(ewbNo: number | string, transporterId: string) {
  return put(`/gst/compliance/e-way-bill/consignor/bill/${encodeURIComponent(ewbNo)}/transporter`, {
    ewbNo, transporterId,
  });
}

/**
 * Consolidate multiple E-Way Bills into a consolidated EWB.
 * POST /gst/compliance/e-way-bill/consignor/consolidated-bill
 * Body: { fromPlace, fromState, transDocDate, transDocNo, transMode, tripSheetEwbBills, vehicleNo }
 */
export async function ewbConsignorConsolidate(consolidateData: Record<string, any>) {
  return post('/gst/compliance/e-way-bill/consignor/consolidated-bill', consolidateData);
}

// ═══════════════════════════════════════════════════════════════
// ██  E-WAY BILL — CONSIGNEE  ██
// ═══════════════════════════════════════════════════════════════

/**
 * Get E-Way Bills received by consignee, filtered by date.
 * GET /gst/compliance/e-way-bill/consignee/bills
 */
export async function ewbConsigneeGetByDate(params: { fromDate?: string; toDate?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return get(`/gst/compliance/e-way-bill/consignee/bills${qs ? '?' + qs : ''}`);
}

/**
 * Reject an E-Way Bill (consignee perspective).
 * POST /gst/compliance/e-way-bill/consignee/bill/{ewb_no}/reject
 * Body: { ewbNo }
 */
export async function ewbConsigneeReject(ewbNo: number | string) {
  return post(`/gst/compliance/e-way-bill/consignee/bill/${encodeURIComponent(ewbNo)}/reject`, {
    ewbNo: String(ewbNo),
  });
}

// ═══════════════════════════════════════════════════════════════
// ██  E-WAY BILL — TRANSPORTER  ██
// ═══════════════════════════════════════════════════════════════

/**
 * Get E-Way Bills assigned to transporter, filtered by date + state.
 * GET /gst/compliance/e-way-bill/transporter/bills
 */
export async function ewbTransporterGetByDateAndState(params: {
  fromDate?: string;
  toDate?: string;
  state?: string;
} = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return get(`/gst/compliance/e-way-bill/transporter/bills${qs ? '?' + qs : ''}`);
}

// ─────────────────────────────────────────────────────────────
// Export as a namespace for easy import in routes
// ─────────────────────────────────────────────────────────────
export const sandboxGSTService = {
  // Public
  searchGstin: gstSearchGstin,
  trackReturns: gstTrackReturns,
  searchByPan: gstSearchByPan,
  // Auth
  generateOtp: gstGenerateOtp,
  verifyOtp: gstVerifyOtp,
  refreshSession: gstRefreshSession,
  generateEvcOtp: gstGenerateEvcOtp,
  logout: gstLogout,
  // GSTR-2A
  gstr2aSection,
  gstr2aDocument,
  // GSTR-2B
  gstr2bRegenerate,
  // E-Invoice
  eInvoiceAuthenticate,
  eInvoiceGenerate,
  eInvoiceGet,
  eInvoiceCancel,
  eInvoiceGeneratePdf,
  eInvoiceGetByDocData,
  eInvoiceGenerateEwb,
  eInvoiceGetEwb,
  eInvoiceSearchGstin,
  // E-Way Bill (Common/Auth)
  ewbAuthenticate,
  ewbGet,
  ewbGetErrorList,
  ewbSearchGstin,
  // E-Way Bill (Consignor)
  ewbConsignorGenerate,
  ewbConsignorGetByDate,
  ewbConsignorCancel,
  ewbConsignorExtendValidity,
  ewbConsignorUpdateVehicle,
  ewbConsignorUpdateTransporter,
  ewbConsignorConsolidate,
  // E-Way Bill (Consignee)
  ewbConsigneeGetByDate,
  ewbConsigneeReject,
  // E-Way Bill (Transporter)
  ewbTransporterGetByDateAndState,
};
