import axios, { AxiosInstance } from 'axios';
import { db } from '../db';
import { irisSessions } from '@shared/schema';
import { desc } from 'drizzle-orm';
import { logger } from '../logger';

const IRIS_BASE_URL = 'https://iris-api.kfintech.com/v2';

interface IrisToken {
  token: string;
  expiresAt: number;
}

class IrisKfintechService {
  private client: AxiosInstance;
  private tokenData: IrisToken | null = null;
  private pendingOtp: { mobile?: string; txnId?: string } | null = null;
  private dbTokenLoaded = false;

  constructor() {
    this.client = axios.create({
      baseURL: IRIS_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    logger.info('[IRIS] KFintech service initialized', { baseUrl: IRIS_BASE_URL });
  }

  get isConfigured(): boolean {
    return !!(
      (process.env.IRIS_USERNAME || process.env.KFINTECH_USERNAME) &&
      (process.env.IRIS_PASSWORD || process.env.KFINTECH_PASSWORD)
    );
  }

  /**
   * Persist the current token to the iris_sessions table so it survives
   * server restarts (Railway container recycles, development restarts, etc.)
   */
  private async saveTokenToDb(token: string, expiresAt: number): Promise<void> {
    try {
      await db.delete(irisSessions);
      await db.insert(irisSessions).values({
        token,
        expiresAt: new Date(expiresAt),
        refreshedAt: new Date(),
      });
    } catch (err: any) {
      logger.warn('[IRIS] Token DB save failed (non-fatal)', { error: err?.message });
    }
  }

  /**
   * Load a persisted IRIS token from the DB on first ensureAuth() call.
   * If a valid token is found, restores it to memory and sets the HTTP header.
   */
  private async loadTokenFromDb(): Promise<void> {
    if (this.dbTokenLoaded) return;
    this.dbTokenLoaded = true;
    try {
      const [row] = await db
        .select()
        .from(irisSessions)
        .orderBy(desc(irisSessions.refreshedAt))
        .limit(1);
      if (!row) return;
      const expiresAt = row.expiresAt.getTime();
      if (Date.now() < expiresAt - 60_000) {
        this.tokenData = { token: row.token, expiresAt };
        this.client.defaults.headers.common['Authorization'] = `Bearer ${row.token}`;
        logger.debug('[IRIS] Token restored from DB', { expiresAt: new Date(expiresAt).toISOString() });
      } else {
        logger.info('[IRIS] Persisted token expired — re-authentication required');
      }
    } catch (err: any) {
      logger.warn('[IRIS] Token DB load failed (non-fatal)', { error: err?.message });
    }
  }

  private isTokenValid(): boolean {
    if (!this.tokenData) return false;
    return Date.now() < this.tokenData.expiresAt - 60000;
  }

  async login(): Promise<{ success: boolean; requiresOtp?: boolean; message?: string }> {
    const username = process.env.IRIS_USERNAME || process.env.KFINTECH_USERNAME;
    const password = process.env.IRIS_PASSWORD || process.env.KFINTECH_PASSWORD;
    if (!username || !password) {
      return { success: false, message: 'IRIS_USERNAME/IRIS_PASSWORD (or KFINTECH_ counterparts) not set' };
    }
    try {
      const resp = await this.client.post('/auth/login', { username, password });
      const data = resp.data;
      if (data?.token) {
        const expiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000;
        this.tokenData = { token: data.token, expiresAt };
        this.client.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        await this.saveTokenToDb(data.token, expiresAt);
        return { success: true };
      }
      if (data?.requiresOtp || data?.otpRequired) {
        this.pendingOtp = { txnId: data.txnId };
        return { success: false, requiresOtp: true, message: data.message || 'OTP required' };
      }
      return { success: false, message: data?.message || 'Login failed' };
    } catch (err: any) {
      logger.error('[IRIS] Login failed', { 
        error: err?.response?.data || err.message,
        status: err?.response?.status 
      });
      return { success: false, message: err?.response?.data?.message || err.message };
    }
  }

  async sendOtp(mobile?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const resp = await this.client.post('/auth/send-otp', { mobile });
      this.pendingOtp = { txnId: resp.data?.txnId, mobile };
      return { success: true, message: resp.data?.message };
    } catch (err: any) {
      return { success: false, message: err?.response?.data?.message || err.message };
    }
  }

  async submitOtp(otp: string): Promise<{ success: boolean; message?: string }> {
    try {
      const resp = await this.client.post('/auth/verify-otp', {
        otp,
        txnId: this.pendingOtp?.txnId,
      });
      const data = resp.data;
      if (data?.token) {
        const expiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000;
        this.tokenData = { token: data.token, expiresAt };
        this.client.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        this.pendingOtp = null;
        await this.saveTokenToDb(data.token, expiresAt);
        return { success: true };
      }
      return { success: false, message: data?.message || 'OTP verification failed' };
    } catch (err: any) {
      return { success: false, message: err?.response?.data?.message || err.message };
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const resp = await this.client.post('/auth/refresh-token');
      const data = resp.data;
      if (data?.token) {
        const expiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000;
        this.tokenData = { token: data.token, expiresAt };
        this.client.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        await this.saveTokenToDb(data.token, expiresAt);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async ensureAuth(): Promise<boolean> {
    await this.loadTokenFromDb();
    if (this.isTokenValid()) return true;
    if (this.tokenData) {
      const refreshed = await this.refreshToken();
      if (refreshed) return true;
    }
    const result = await this.login();
    return result.success;
  }

  async call<T = any>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', body?: any): Promise<T> {
    const authed = await this.ensureAuth();
    if (!authed) throw new Error('IRIS authentication failed');
    const resp = await this.client.request<T>({
      url: endpoint,
      method,
      ...(body ? { data: body } : {}),
    });
    return resp.data;
  }

  getStatus(): { configured: boolean; authenticated: boolean; tokenExpiresAt?: number; credentialsSource?: string } {
    const hasIris = !!(process.env.IRIS_USERNAME && process.env.IRIS_PASSWORD);
    const hasKfin = !!(process.env.KFINTECH_USERNAME && process.env.KFINTECH_PASSWORD);
    return {
      configured: hasIris || hasKfin,
      authenticated: this.isTokenValid(),
      tokenExpiresAt: this.tokenData?.expiresAt,
      credentialsSource: hasIris ? 'IRIS_ prefix' : (hasKfin ? 'KFINTECH_ prefix' : 'none')
    };
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────────
  async getAumSummary() { return this.call('/user/dashboard/aum-summary'); }
  async getFundEarnings() { return this.call('/user/dashboard/fund-earnings'); }
  async getSipSummary() { return this.call('/user/dashboard/sip-summary'); }
  async getUniqueInvestors() { return this.call('/user/dashboard/unique-investors'); }
  async getInflowOutflow(params?: any) { return this.call(`/user/dashboard/inflow-outflow${params ? '?' + new URLSearchParams(params).toString() : ''}`); }
  async getEuins() { return this.call('/user/dashboard/euins'); }

  // ─── Empanelment ──────────────────────────────────────────────────────────────
  async getEmpanelmentAmcList() { return this.call('/empanelment/amc-list'); }
  async getAmcEmpanelmentStatus(amcCode?: string) { return this.call(`/empanelment/amc-status${amcCode ? '?amcCode=' + amcCode : ''}`); }
  async getFdEmpanelmentStatus() { return this.call('/empanelment/fd-status'); }
  async getNpsEmpanelmentStatus() { return this.call('/empanelment/nps-status'); }
  async resendEsignLink(empanelmentId: string) { return this.call('/empanelment/resend-esign', 'POST', { empanelmentId }); }

  // ─── Investors ───────────────────────────────────────────────────────────────
  async listInvestors(params?: { search?: string; page?: number; limit?: number }) {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
    return this.call(`/user/investors${qs}`);
  }
  async getInvestorDetails(pan: string) { return this.call(`/user/investors/${pan}`); }
  async getInvestorKycDetails(pan: string) { return this.call(`/user/investors/${pan}/kyc`); }
  async getPortfolioSummary(pan: string) { return this.call(`/user/investors/${pan}/portfolio-summary`); }
  async getInvestmentDetails(pan: string) { return this.call(`/user/investors/${pan}/investments`); }
  async getTransactionDetails(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/user/investors/${pan}/transactions${qs}`);
  }
  async getSystematicPlanDetails(pan: string) { return this.call(`/user/investors/${pan}/systematic-plans`); }
  async getFamilyPortfolio(pan: string) { return this.call(`/user/investors/${pan}/family-portfolio`); }
  async getPortfolioInsights(pan: string) { return this.call(`/user/investors/${pan}/portfolio-insights`); }
  async getKraStatus(pan: string) { return this.call(`/user/investors/${pan}/kra-status`); }
  async getSipHealth(pan: string) { return this.call(`/user/investors/${pan}/sip-health`); }
  async sendEkycMail(pan: string) { return this.call(`/user/investors/${pan}/send-ekyc-mail`, 'POST'); }
  async sendReminderMail(pan: string, body?: any) { return this.call(`/user/investors/${pan}/send-reminder`, 'POST', body); }

  // ─── Transactions ─────────────────────────────────────────────────────────────
  async getAllFunds() { return this.call('/sif/funds'); }
  async getSchemesByFund(fundCode: string) { return this.call(`/sif/funds/${fundCode}/schemes`); }
  async getSchemeDetails(schemeCode: string) { return this.call(`/sif/schemes/${schemeCode}`); }
  async searchSchemes(query: string) {
    if (!query || query.length < 2) return { schemes: [] };
    return this.call(`/sif/schemes/search?q=${encodeURIComponent(query)}`);
  }
  async getNfoData() { return this.call('/sif/nfo'); }
  async getAvailablePaymentModes(pan: string, schemeCode: string) {
    return this.call(`/sif/transactions/payment-modes?pan=${pan}&schemeCode=${schemeCode}`);
  }

  /**
   * Check if a specific bank supports Direct Pay (instant settlement) for MF transactions.
   */
  async getDirectPayStatus(pan: string, bankAccountNo: string) {
    return this.call(`/sif/transactions/direct-pay-status?pan=${pan}&accountNo=${bankAccountNo}`);
  }
  async validateInvestment(body: any) { return this.call('/sif/transactions/validate', 'POST', body); }
  async placeOrder(body: any) { 
    return this.call('/sif/transactions/purchase', 'POST', { ...body, partnerCode: "FINTEKPRO" }); 
  }
  async placeRedemption(body: any) { return this.call('/sif/transactions/redemption', 'POST', body); }
  async cancelSip(body: any) { return this.call('/sif/transactions/sip/cancel', 'POST', body); }
  async pauseSip(body: any) { return this.call('/sif/transactions/sip/pause', 'POST', body); }
  async cancelOrder(orderId: string) { return this.call(`/sif/transactions/${orderId}/cancel`, 'POST'); }
  async reinitiateOrder(orderId: string) { return this.call(`/sif/transactions/${orderId}/reinitiate`, 'POST'); }
  async getMandates(pan: string) { return this.call(`/sif/mandates?pan=${pan}`); }

  // ─── Products ─────────────────────────────────────────────────────────────────
  async getAifLinks() { return this.call('/aif/links'); }
  async getPmsLinks() { return this.call('/pms/links'); }
  async getFixedDepositProducts() { return this.call('/user/fixed-deposit/products'); }
  async getFdBrochure(productId: string) { return this.call(`/user/fixed-deposit/products/${productId}/brochure`); }
  async getNpsInvestmentLinks() { return this.call('/user/nps/links'); }

  // ─── Reports ──────────────────────────────────────────────────────────────────
  async getCgStatement(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/capital-gains/${pan}${qs}`);
  }
  async getClientStatement(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/client-statement/${pan}${qs}`);
  }
  async getTransactionStatement(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/transaction-statement/${pan}${qs}`);
  }
  async getPortfolioReport(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/portfolio-summary/${pan}${qs}`);
  }
  // STP (Systematic Transfer Plan)
  async registerStp(body: any) { return this.call('/sif/transactions/stp/register', 'POST', body); }
  async cancelStp(body: any) { return this.call('/sif/transactions/stp/cancel', 'POST', body); }
  async pauseStp(body: any) { return this.call('/sif/transactions/stp/pause', 'POST', body); }

  // SWP (Systematic Withdrawal Plan)
  async registerSwp(body: any) { return this.call('/sif/transactions/swp/register', 'POST', body); }
  async cancelSwp(body: any) { return this.call('/sif/transactions/swp/cancel', 'POST', body); }
  async pauseSwp(body: any) { return this.call('/sif/transactions/swp/pause', 'POST', body); }

  // Additional Purchase (existing folio)
  async placeAdditionalPurchase(body: any) { return this.call('/sif/transactions/additional-purchase', 'POST', body); }

  // eNACH / Mandate Creation
  async createMandate(body: any) { return this.call('/sif/mandates', 'POST', body); }
  async getMandateStatus(mandateId: string) { return this.call(`/sif/mandates/${mandateId}`); }

  /**
   * List all active mandates associated with a specific bank account for an investor.
   */
  async listActiveMandatesByBank(pan: string, bankAccountNo: string) {
    return this.call(`/sif/mandates/active?pan=${pan}&accountNo=${bankAccountNo}`);
  }

  // Fixed Deposit Orders
  async placeFdOrder(body: any) { return this.call('/user/fixed-deposit/order', 'POST', body); }
  async getFdOrders(pan: string) { return this.call(`/user/fixed-deposit/orders?pan=${encodeURIComponent(pan)}`); }
  async getFdOrderDetails(orderId: string) { return this.call(`/user/fixed-deposit/orders/${orderId}`); }
  async prematureCloseFd(orderId: string, body: any) { return this.call(`/user/fixed-deposit/orders/${orderId}/premature-closure`, 'POST', body); }
  async getFdMaturityList(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/user/fixed-deposit/maturity${qs}`);
  }
  async calculateFdInterest(params: any) {
    const qs = '?' + new URLSearchParams(params).toString();
    return this.call(`/user/fixed-deposit/interest-calculator${qs}`);
  }

  // NPS (National Pension System)
  async getNpsSubscriberDetails(pran: string) { return this.call(`/nps/subscriber/${pran}`); }
  async initiateNpsOnboarding(body: any) { 
    return this.call('/nps/subscriber/onboarding', 'POST', { ...body, partnerCode: "FINTEKPRO" }); 
  }
  async placeNpsContribution(body: any) { return this.call('/nps/transactions/contribution', 'POST', body); }
  async getNpsPortfolio(pran: string) { return this.call(`/nps/subscriber/${pran}/portfolio`); }
  async getNpsFundValues(pran: string) { return this.call(`/nps/subscriber/${pran}/fund-values`); }
  async getNpsTransactions(pran: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/nps/subscriber/${pran}/transactions${qs}`);
  }
  async changeNpsScheme(pran: string, body: any) { return this.call(`/nps/subscriber/${pran}/scheme-change`, 'POST', body); }
  async npsPartialWithdrawal(pran: string, body: any) { return this.call(`/nps/subscriber/${pran}/partial-withdrawal`, 'POST', body); }

  // Non-Financial Transactions — GET (read current values)
  async getNomineeDetails(pan: string) { return this.call(`/sif/non-financial/${pan}/nominee`); }
  async getBankDetails(pan: string) { return this.call(`/sif/non-financial/${pan}/bank`); }
  async getFatcaDetails(pan: string) { return this.call(`/sif/non-financial/${pan}/fatca`); }
  async getDividendHistory(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/user/investors/${pan}/dividend-history${qs}`);
  }
  async getEkycStatus(pan: string) { return this.call(`/user/investors/${pan}/ekyc-status`); }
  async getDematAccounts(pan: string) { return this.call(`/user/investors/${pan}/demat-accounts`); }
  async linkDematAccount(pan: string, body: any) { return this.call(`/user/investors/${pan}/demat-accounts`, 'POST', body); }
  async getInvestorDocuments(pan: string) { return this.call(`/user/investors/${pan}/documents`); }
  async uploadInvestorDocument(pan: string, body: any) { return this.call(`/user/investors/${pan}/documents`, 'POST', body); }

  // Financial Goals (per investor)
  async getGoals(pan: string) { return this.call(`/user/investors/${pan}/goals`); }
  async createGoal(pan: string, body: any) { return this.call(`/user/investors/${pan}/goals`, 'POST', body); }
  async updateGoal(pan: string, goalId: string, body: any) { return this.call(`/user/investors/${pan}/goals/${goalId}`, 'PUT', body); }
  async deleteGoal(pan: string, goalId: string) { return this.call(`/user/investors/${pan}/goals/${goalId}`, 'DELETE'); }

  // Non-Financial Transactions — POST (write)
  async updateNominee(pan: string, body: any) { return this.call(`/sif/non-financial/${pan}/nominee`, 'POST', body); }
  async updateEmail(pan: string, body: any) { return this.call(`/sif/non-financial/${pan}/email`, 'POST', body); }
  async updateMobile(pan: string, body: any) { return this.call(`/sif/non-financial/${pan}/mobile`, 'POST', body); }
  async updateFatca(pan: string, body: any) { return this.call(`/sif/non-financial/${pan}/fatca`, 'POST', body); }
  async updateIdcw(pan: string, body: any) { return this.call(`/sif/non-financial/${pan}/idcw`, 'POST', body); }
  async updateBankDetails(pan: string, body: any) { return this.call(`/sif/non-financial/${pan}/bank`, 'POST', body); }
  async manageBankMandate(pan: string, body: any) { return this.call(`/sif/non-financial/${pan}/bank-mandate`, 'POST', body); }

  // Business Hierarchy
  async listSubBrokers(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/user/hierarchy/sub-brokers${qs}`);
  }
  async getSubBrokerDetails(euinCode: string) { return this.call(`/user/hierarchy/sub-brokers/${euinCode}`); }
  async getSubBrokerAum(euinCode: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/user/hierarchy/sub-brokers/${euinCode}/aum${qs}`);
  }
  async addEmployee(body: any) { return this.call('/user/hierarchy/employees', 'POST', body); }
  async updateEmployee(euinCode: string, body: any) { return this.call(`/user/hierarchy/employees/${euinCode}`, 'PUT', body); }

  // Bulk Reports
  async getBulkCapitalGains(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/bulk/capital-gains${qs}`);
  }
  async getSipMaturityCalendar(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/sip-maturity-calendar${qs}`);
  }
  async getDividendTracker(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/dividend-tracker${qs}`);
  }
  async getBulkPortfolioReport(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/bulk/portfolio${qs}`);
  }

  // ─── SIP Lifecycle ────────────────────────────────────────────────────────────
  async registerSip(body: any) { 
    return this.call('/sif/transactions/sip/register', 'POST', { ...body, partnerCode: "FINTEKPRO" }); 
  }
  async modifySip(sipId: string, body: any) { return this.call(`/sif/transactions/sip/${sipId}`, 'PATCH', body); }
  async getSipDetails(sipId: string) { return this.call(`/sif/transactions/sip/${sipId}`); }

  // ─── Order / Transaction Status ───────────────────────────────────────────────
  async listOrdersByPan(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/sif/transactions/orders?pan=${encodeURIComponent(pan)}${qs ? '&' + qs.slice(1) : ''}`);
  }
  async getOrderDetails(orderId: string) { return this.call(`/sif/transactions/orders/${orderId}`); }
  async getSwitchStatus(orderId: string) { return this.call(`/sif/transactions/switch/${orderId}/status`); }

  // ─── STP Status ───────────────────────────────────────────────────────────────
  async listStpsByPan(pan: string) { return this.call(`/sif/transactions/stp?pan=${encodeURIComponent(pan)}`); }
  async getStpDetails(stpId: string) { return this.call(`/sif/transactions/stp/${stpId}`); }

  // ─── SWP Status ───────────────────────────────────────────────────────────────
  async listSwpsByPan(pan: string) { return this.call(`/sif/transactions/swp?pan=${encodeURIComponent(pan)}`); }
  async getSwpDetails(swpId: string) { return this.call(`/sif/transactions/swp/${swpId}`); }

  // ─── Failed Transactions ──────────────────────────────────────────────────────
  async listFailedTransactions(pan: string) {
    return this.call(`/sif/transactions/orders?pan=${encodeURIComponent(pan)}&status=FAILED,REJECTED`);
  }

  // ─── Phase 1: Switch ─────────────────────────────────────────────────────────
  async placeSwitch(body: any) { return this.call('/sif/transactions/switch', 'POST', body); }
  async cancelSwitch(body: any) { return this.call('/sif/transactions/switch/cancel', 'POST', body); }
  async reinitiateSwitch(orderId: string) { return this.call(`/sif/transactions/switch/${orderId}/reinitiate`, 'POST'); }

  // ─── Phase 1: eNACH ──────────────────────────────────────────────────────────
  async createEnach(body: any) { return this.call('/sif/enach/create', 'POST', body); }
  async getEnachStatus(mandateId: string) { return this.call(`/sif/enach/${mandateId}/status`); }
  async cancelEnach(mandateId: string) { return this.call(`/sif/enach/${mandateId}/cancel`, 'POST'); }
  async listEnach(pan: string) { return this.call(`/sif/enach?pan=${encodeURIComponent(pan)}`); }
  async regenerateEnachLink(mandateId: string) { return this.call(`/sif/enach/${mandateId}/regenerate-link`, 'POST'); }

  // ─── Phase 1: UPI Autopay Mandate ────────────────────────────────────────────
  async createUpiMandate(body: any) { return this.call('/sif/mandates/upi', 'POST', body); }
  async getUpiMandateStatus(umrn: string) { return this.call(`/sif/mandates/upi/${umrn}`); }
  async cancelUpiMandate(umrn: string) { return this.call(`/sif/mandates/upi/${umrn}/cancel`, 'POST'); }
  async listUpiMandates(pan: string) { return this.call(`/sif/mandates/upi?pan=${encodeURIComponent(pan)}`); }

  // ─── Physical NACH Mandate ────────────────────────────────────────────────────
  async uploadPhysicalMandate(body: any) { return this.call('/sif/mandates/physical', 'POST', body); }
  async listPhysicalMandates(pan: string) { return this.call(`/sif/mandates/physical?pan=${encodeURIComponent(pan)}`); }

  // ─── Phase 1: Folio Management ───────────────────────────────────────────────
  async listFolios(pan: string) { return this.call(`/user/investors/${pan}/folios`); }
  async getFolioDetails(pan: string, folioNo: string) { return this.call(`/user/investors/${pan}/folios/${folioNo}`); }
  async getFolioTransactions(pan: string, folioNo: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/user/investors/${pan}/folios/${folioNo}/transactions${qs}`);
  }

  // ─── Phase 1: Investor Portal Link ───────────────────────────────────────────
  async getInvestorPortalLink(pan: string) { return this.call(`/user/investors/${pan}/portal-link`); }
  async sendPortalLinkToInvestor(pan: string, body?: any) { return this.call(`/user/investors/${pan}/portal-link/send`, 'POST', body); }

  // ─── Phase 2: Commission Statements ──────────────────────────────────────────
  async getCommissionStatement(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/commission${qs}`);
  }
  async getTrailCommission(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/trail-commission${qs}`);
  }
  async getCommissionSummary(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/commission/summary${qs}`);
  }
  async getAmcWiseCommission(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/commission/amc-wise${qs}`);
  }

  // ─── Phase 2: Digital Investor Onboarding ────────────────────────────────────
  async initiateInvestorOnboarding(body: any) { 
    return this.call('/user/onboarding/initiate', 'POST', { ...body, partnerCode: "FINTEKPRO" }); 
  }
  async getOnboardingStatus(applicationId: string) { return this.call(`/user/onboarding/${applicationId}/status`); }
  async verifyOnboardingKyc(applicationId: string, body: any) { return this.call(`/user/onboarding/${applicationId}/kyc-verify`, 'POST', body); }
  async listOnboardingApplications(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/user/onboarding/applications${qs}`);
  }
  async resendOnboardingLink(applicationId: string) { return this.call(`/user/onboarding/${applicationId}/resend-link`, 'POST'); }

  // ─── Phase 2: CAS Statement ──────────────────────────────────────────────────
  async getCasStatement(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/cas/${pan}${qs}`);
  }
  async generateCasStatement(body: any) { return this.call('/reports/cas/generate', 'POST', body); }

  // ─── Phase 2: XIRR & Returns Analytics ──────────────────────────────────────
  async getInvestorXirr(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/analytics/xirr/${pan}${qs}`);
  }
  async getInvestorReturns(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/analytics/returns/${pan}${qs}`);
  }
  async getSchemeReturns(schemeCode: string) { return this.call(`/sif/schemes/${schemeCode}/returns`); }
  async getPortfolioXirr(pan: string) { return this.call(`/analytics/portfolio-xirr/${pan}`); }

  // ─── Phase 3: Scheme NAV History ─────────────────────────────────────────────
  async getSchemeNavHistory(schemeCode: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/sif/schemes/${schemeCode}/nav-history${qs}`);
  }
  async getSchemeLatestNav(schemeCode: string) { return this.call(`/sif/schemes/${schemeCode}/nav`); }

  // ─── Phase 3: Scheme Performance ─────────────────────────────────────────────
  async getSchemePerformance(schemeCode: string) { return this.call(`/sif/schemes/${schemeCode}/performance`); }
  async getTopPerformingSchemes(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/sif/schemes/top-performers${qs}`);
  }

  // ─── Phase 3: Scheme Holdings ─────────────────────────────────────────────────
  async getSchemeHoldings(schemeCode: string) { return this.call(`/sif/schemes/${schemeCode}/portfolio-holdings`); }
  async getSchemeFactSheet(schemeCode: string) { return this.call(`/sif/schemes/${schemeCode}/factsheet`); }

  // ─── Phase 3: Scheme Comparison ──────────────────────────────────────────────
  async compareSchemes(body: { schemeCodes: string[] }) { return this.call('/sif/schemes/compare', 'POST', body); }

  // ─── Phase 3: Scheme Categories ──────────────────────────────────────────────
  async getSchemeCategories() { return this.call('/sif/categories'); }
  async getSchemeSubcategories(category?: string) {
    return this.call(`/sif/subcategories${category ? '?category=' + encodeURIComponent(category) : ''}`);
  }
  async getSchemesByCategory(category: string, params?: any) {
    const qs = params ? '&' + new URLSearchParams(params).toString() : '';
    return this.call(`/sif/schemes?category=${encodeURIComponent(category)}${qs}`);
  }

  // ─── Phase 3: Investor Risk Profiling ────────────────────────────────────────
  async getRiskQuestionnaire() { return this.call('/user/risk-profile/questionnaire'); }
  async submitRiskProfile(pan: string, body: any) { return this.call(`/user/investors/${pan}/risk-profile`, 'POST', body); }
  async getInvestorRiskProfile(pan: string) { return this.call(`/user/investors/${pan}/risk-profile`); }
  async getSchemesForRiskProfile(riskProfile: string) {
    return this.call(`/sif/schemes/recommended?riskProfile=${encodeURIComponent(riskProfile)}`);
  }

  // ─── Phase 3: Application / Order Tracking ───────────────────────────────────
  async listApplications(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/user/applications${qs}`);
  }
  async getApplicationStatus(applicationId: string) { return this.call(`/user/applications/${applicationId}/status`); }
  async getOrderTracking(orderId: string) { return this.call(`/sif/transactions/${orderId}/tracking`); }

  // ─── Phase 3: Alert Management ───────────────────────────────────────────────
  async createAlert(body: any) { return this.call('/user/alerts', 'POST', body); }
  async listAlerts(pan: string) { return this.call(`/user/alerts?pan=${encodeURIComponent(pan)}`); }
  async deleteAlert(alertId: string) { return this.call(`/user/alerts/${alertId}`, 'DELETE'); }
  async updateAlert(alertId: string, body: any) { return this.call(`/user/alerts/${alertId}`, 'PUT', body); }

  // ─── Phase 3: Compliance / AML Reports ───────────────────────────────────────
  async getComplianceReport(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/compliance${qs}`);
  }
  async getPmlaReport(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/pmla${qs}`);
  }
  async getAmlReport(params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/reports/aml${qs}`);
  }

  // ─── Phase 3: WhatsApp Notifications ─────────────────────────────────────────

  /**
   * Send a raw WhatsApp notification via IRIS KFintech.
   * @param body - IRIS-compatible notification payload
   */
  async sendWhatsappNotification(body: any) { return this.call('/notifications/whatsapp/send', 'POST', body); }

  /**
   * Retrieve all pre-registered WhatsApp message templates from KFintech.
   * Templates may need to be registered in the IRIS portal for DLT compliance.
   */
  async getNotificationTemplates() { return this.call('/notifications/templates'); }

  /**
   * Retrieve WhatsApp notification history for a specific investor PAN.
   * @param pan - Investor PAN linked to a KFintech investor profile
   */
  async getNotificationHistory(pan: string) { return this.call(`/notifications/history?pan=${encodeURIComponent(pan)}`); }

  /**
   * Send a general-purpose WhatsApp message via IRIS KFintech.
   *
   * Purpose  : Universal entry point used by WhatsAppDispatcher. Maps any message
   *            type/category to the IRIS /notifications/whatsapp/send endpoint.
   *            sendFestivalGreeting() is now a thin typed wrapper over this method.
   *
   * Inputs:
   *   - mobile      : Recipient phone (E.164 or 10-digit, required)
   *   - message     : Full message body (required)
   *   - category    : IRIS notification category (default: 'GENERAL')
   *   - pan         : Optional — IRIS uses this to enrich investor lookup
   *   - agentName   : Optional — appended as "— {agentName} via FintekPro" footer
   *   - templateId  : Optional — DLT-registered KFintech template ID
   *   - extra       : Optional — any extra fields passed through to IRIS payload
   *
   * Outputs:
   *   { success, messageId?, errorCode?, retryable }
   *
   * Edge cases:
   *   - Not configured → { success: false, errorCode: 'IRIS_NOT_CONFIGURED', retryable: false }
   *   - 4xx response  → { success: false, retryable: false }
   *   - 5xx / timeout → { success: false, retryable: true }  ← dispatcher will try Twilio
   */
  async sendWhatsAppMessage(opts: {
    mobile: string;
    message: string;
    category?: string;
    pan?: string;
    agentName?: string;
    templateId?: string;
    extra?: Record<string, unknown>;
  }): Promise<{ success: boolean; messageId?: string; errorCode?: string; retryable: boolean }> {
    if (!this.isConfigured) {
      return { success: false, errorCode: 'IRIS_NOT_CONFIGURED', retryable: false };
    }

    const body = opts.agentName
      ? `${opts.message}\n\n— ${opts.agentName} via FintekPro`
      : opts.message;

    const payload: Record<string, unknown> = {
      mobile: opts.mobile,
      message: body,
      partnerCode: 'FINTEKPRO',
      category: opts.category ?? 'GENERAL',
      ...(opts.pan        ? { pan: opts.pan }               : {}),
      ...(opts.templateId ? { templateId: opts.templateId } : {}),
      ...(opts.extra      ?? {}),
    };

    const t0 = Date.now();
    try {
      const resp: any = await this.sendWhatsappNotification(payload);
      const messageId = resp?.messageId ?? resp?.data?.messageId ?? resp?.id ?? undefined;
      logger.info('[IRIS] WhatsApp sent', {
        event: 'IRIS_WHATSAPP_SENT',
        mobile: opts.mobile.slice(0, 6) + '****',
        category: payload.category,
        messageId,
        latency_ms: Date.now() - t0,
        status: 'success',
      });
      return { success: true, messageId, retryable: false };
    } catch (err: any) {
      const status    = err?.response?.status as number | undefined;
      const errBody   = err?.response?.data;
      const retryable = !status || status >= 500;
      logger.error('[IRIS] WhatsApp failed', {
        event: 'IRIS_WHATSAPP_FAILED',
        mobile: opts.mobile.slice(0, 6) + '****',
        category: payload.category,
        status,
        error: errBody ?? err?.message,
        latency_ms: Date.now() - t0,
        retryable,
      });
      return {
        success: false,
        errorCode: errBody?.errorCode ?? (status ? `HTTP_${status}` : 'NETWORK_ERROR'),
        retryable,
      };
    }
  }

  /**
   * Send a festival greeting WhatsApp notification via IRIS KFintech.
   * Thin wrapper over sendWhatsAppMessage() with FESTIVAL_GREETING category.
   *
   * Inputs:
   *   - pan, mobile, festivalName, message, agentName, templateId
   * Outputs:
   *   { success, messageId?, errorCode?, retryable }
   */
  async sendFestivalGreeting(opts: {
    pan?: string;
    mobile: string;
    festivalName: string;
    message: string;
    agentName: string;
    templateId?: string;
  }): Promise<{ success: boolean; messageId?: string; errorCode?: string; retryable: boolean }> {
    return this.sendWhatsAppMessage({
      mobile:     opts.mobile,
      message:    opts.message,
      category:   'FESTIVAL_GREETING',
      pan:        opts.pan,
      agentName:  opts.agentName,
      templateId: opts.templateId,
      extra:      { festivalName: opts.festivalName },
    });
  }

  // ─── Phase 3: NFO ─────────────────────────────────────────────────────────────
  async getNfoSchemes() { return this.call('/sif/nfo/active'); }
  async getNfoSchemeDetails(schemeCode: string) { return this.call(`/sif/nfo/${schemeCode}`); }
  async applyNfo(body: any) { return this.call('/sif/nfo/apply', 'POST', body); }
  async getNfoApplications(pan: string) { return this.call(`/sif/nfo/applications?pan=${encodeURIComponent(pan)}`); }
  async cancelNfoApplication(applicationId: string) { return this.call(`/sif/nfo/applications/${applicationId}/cancel`, 'POST'); }

  // ─── Analytics: Tax Harvesting ────────────────────────────────────────────────
  async getTaxHarvestingOpportunities(pan: string) {
    return this.call(`/portfolio/tax-harvest/${encodeURIComponent(pan)}`);
  }

  // ─── Analytics: SIP XIRR ──────────────────────────────────────────────────────
  async getSipXirr(pan: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/analytics/sip-returns/${encodeURIComponent(pan)}${qs}`);
  }

  // ─── Scheme Intelligence: Ratings ─────────────────────────────────────────────
  async getSchemeRatings(schemeCode: string) {
    return this.call(`/sif/schemes/${encodeURIComponent(schemeCode)}/ratings`);
  }

  // ─── Scheme Intelligence: Fund Manager ────────────────────────────────────────
  async getSchemeFundManager(schemeCode: string) {
    return this.call(`/sif/schemes/${encodeURIComponent(schemeCode)}/fund-manager`);
  }

  // ─── Scheme Intelligence: Benchmark Comparison ───────────────────────────────
  async getSchemeBenchmarkComparison(schemeCode: string, params?: any) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/sif/schemes/${encodeURIComponent(schemeCode)}/benchmark${qs}`);
  }

  // ─── External Portfolio / CAS Import ─────────────────────────────────────────
  // Fetches structured CAS data direct from KFintech registry by PAN — no PDF upload needed.
  async fetchCasFromRegistry(pan: string, params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.call(`/portfolio/cas-fetch/${encodeURIComponent(pan)}${qs}`);
  }
  // Imports fetched CAS holdings into IRIS portfolio tracking system.
  async importExternalPortfolio(body: any) { return this.call('/portfolio/import', 'POST', body); }
  // Returns all externally linked / imported holdings for a PAN.
  async getExternalPortfolio(pan: string) { return this.call(`/portfolio/external/${encodeURIComponent(pan)}`); }
  // Links a single external folio (cross-registrar — CAMS or KFintech) to the investor.
  async linkExternalFolio(body: any) { return this.call('/portfolio/external/link', 'POST', body); }
  // Unlinks / removes an external folio from IRIS tracking.
  async unlinkExternalFolio(folioNo: string) { return this.call(`/portfolio/external/${encodeURIComponent(folioNo)}`, 'DELETE'); }
  // Triggers a live refresh of all external portfolio data for a PAN.
  async refreshExternalPortfolio(pan: string) { return this.call(`/portfolio/external/${encodeURIComponent(pan)}/refresh`, 'POST'); }

  // ─── Loan Against Securities / Mutual Funds (LAS / LAMF) ─────────────────────
  //
  // Powers the full pledge-and-lend lifecycle via IRIS KFintech API.
  // Endpoint prefix: /las  (Loan Against Securities module)
  //
  // Flow:
  //   1. checkMfFolioEligibility / checkSecuritiesEligibility → get eligible collateral
  //   2. initiateMfPledge / initiateSecuritiesPledge          → create pledge
  //   3. getPledgeStatus                                       → confirm activation
  //   4. applyForLoan                                          → submit loan application
  //   5. getLoanStatus / getLoanStatement                      → monitor
  //   6. repayLoan                                             → repay outstanding
  //   7. releasePledge                                         → release on closure

  /**
   * Fetch MF folios eligible for pledge (LTV, locked folios excluded).
   * Returns eligible folios with current NAV, units, pledgeable value, and
   * the maximum loan amount available based on IRIS's LTV policy.
   *
   * @param pan - Investor PAN
   * @param folioNos - Optional: restrict check to specific folio numbers
   */
  async checkMfFolioEligibility(pan: string, folioNos?: string[]): Promise<any> {
    const body = folioNos?.length ? { pan, folioNos } : { pan };
    return this.call('/las/mf/eligibility', 'POST', body);
  }

  /**
   * Fetch demat securities eligible for pledge (SEBI-approved list, haircuts applied).
   * Returns eligible holdings with current market price, pledgeable quantity,
   * LTV ratio, and maximum loan value.
   *
   * @param pan - Investor PAN
   * @param dpId - Optional: specific DP ID if investor has multiple demat accounts
   */
  async checkSecuritiesEligibility(pan: string, dpId?: string): Promise<any> {
    const qs = dpId ? `?dpId=${encodeURIComponent(dpId)}` : '';
    return this.call(`/las/securities/eligibility/${encodeURIComponent(pan)}${qs}`);
  }

  /**
   * Initiate pledge of mutual fund folios for LAS.
   * Sends a pledge request to the depository via IRIS.
   * Investor must confirm the pledge via TPIN / OTP separately.
   *
   * @param body.pan - Investor PAN
   * @param body.folioDetails - Array of { folioNo, schemeCode, units } to pledge
   * @param body.loanAmount - Requested loan amount
   * @param body.lenderCode - IRIS lender code (e.g. "HDFC_LAS", "BAJAJ_LAS")
   */
  async initiateMfPledge(body: {
    pan: string;
    folioDetails: Array<{ folioNo: string; schemeCode: string; units: number }>;
    loanAmount: number;
    lenderCode?: string;
  }): Promise<any> {
    return this.call('/las/mf/pledge/initiate', 'POST', { ...body, partnerCode: 'FINTEKPRO' });
  }

  /**
   * Initiate pledge of listed demat securities (equities, ETFs) for LAS.
   *
   * @param body.pan - Investor PAN
   * @param body.dpId - Demat account DP ID
   * @param body.securities - Array of { isin, quantity } to pledge
   * @param body.loanAmount - Requested loan amount
   * @param body.lenderCode - IRIS lender code
   */
  async initiateSecuritiesPledge(body: {
    pan: string;
    dpId: string;
    securities: Array<{ isin: string; quantity: number }>;
    loanAmount: number;
    lenderCode?: string;
  }): Promise<any> {
    return this.call('/las/securities/pledge/initiate', 'POST', { ...body, partnerCode: 'FINTEKPRO' });
  }

  /**
   * Get real-time status of a pledge (pending / active / failed / released).
   *
   * @param pledgeId - IRIS-assigned pledge reference ID
   */
  async getPledgeStatus(pledgeId: string): Promise<any> {
    return this.call(`/las/pledge/${encodeURIComponent(pledgeId)}/status`);
  }

  /**
   * Apply for a loan against an active pledge.
   * Loan disbursement is subject to lender approval.
   *
   * @param body.pan - Investor PAN
   * @param body.pledgeId - IRIS pledge reference ID (must be in 'active' state)
   * @param body.requestedAmount - Loan amount in INR
   * @param body.tenure - Loan tenure in months
   * @param body.disbursementBankAccount - Bank account for disbursement
   */
  async applyForLoan(body: {
    pan: string;
    pledgeId: string;
    requestedAmount: number;
    tenure: number;
    disbursementBankAccount?: string;
    purposeOfLoan?: string;
  }): Promise<any> {
    return this.call('/las/loan/apply', 'POST', { ...body, partnerCode: 'FINTEKPRO' });
  }

  /**
   * Get current status of a LAS loan application or active loan.
   *
   * @param loanId - IRIS-assigned loan ID (from applyForLoan response)
   */
  async getLoanStatus(loanId: string): Promise<any> {
    return this.call(`/las/loan/${encodeURIComponent(loanId)}/status`);
  }

  /**
   * Get full loan statement including outstanding principal, accrued interest,
   * repayment schedule, and transaction history.
   *
   * @param pan - Investor PAN
   * @param loanId - Optional: specific loan ID; omit to get all active loans for PAN
   */
  async getLoanStatement(pan: string, loanId?: string): Promise<any> {
    const qs = loanId ? `?loanId=${encodeURIComponent(loanId)}` : '';
    return this.call(`/las/loan/statement/${encodeURIComponent(pan)}${qs}`);
  }

  /**
   * Initiate a repayment against an active LAS loan.
   * Can be a partial or full repayment.
   *
   * @param body.loanId - IRIS loan ID
   * @param body.amount - Repayment amount in INR
   * @param body.paymentMode - 'NEFT' | 'IMPS' | 'UPI' | 'NACH'
   * @param body.utrNumber - Optional UTR for tracking
   */
  async repayLoan(body: {
    loanId: string;
    amount: number;
    paymentMode: 'NEFT' | 'IMPS' | 'UPI' | 'NACH';
    utrNumber?: string;
  }): Promise<any> {
    return this.call('/las/loan/repay', 'POST', body);
  }

  /**
   * Release a pledge after loan closure or cancellation.
   * Unpledges the MF folios / securities back to the investor.
   *
   * @param pledgeId - IRIS pledge reference ID
   * @param reason - Release reason: 'LOAN_CLOSED' | 'LOAN_CANCELLED' | 'VOLUNTARY'
   */
  async releasePledge(pledgeId: string, reason: 'LOAN_CLOSED' | 'LOAN_CANCELLED' | 'VOLUNTARY'): Promise<any> {
    return this.call(`/las/pledge/${encodeURIComponent(pledgeId)}/release`, 'POST', { reason });
  }

  /**
   * List all active and historical LAS loans for an investor PAN.
   *
   * @param pan - Investor PAN
   * @param params - Optional filters: status, fromDate, toDate, page, limit
   */
  async listLoans(pan: string, params?: Record<string, string>): Promise<any> {
    const qs = params ? '&' + new URLSearchParams(params).toString() : '';
    return this.call(`/las/loan/list?pan=${encodeURIComponent(pan)}${qs}`);
  }

  /**
   * List all pledges (MF + securities) for an investor PAN.
   *
   * @param pan - Investor PAN
   */
  async listPledges(pan: string): Promise<any> {
    return this.call(`/las/pledge/list?pan=${encodeURIComponent(pan)}`);
  }

}

export const irisKfintechService = new IrisKfintechService();

