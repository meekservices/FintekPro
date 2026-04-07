import axios, { AxiosInstance } from 'axios';

const IRIS_BASE_URL = 'https://iris-api.kfintech.com/v2';

interface IrisToken {
  token: string;
  expiresAt: number;
}

class IrisKfintechService {
  private client: AxiosInstance;
  private tokenData: IrisToken | null = null;
  private pendingOtp: { mobile?: string; txnId?: string } | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: IRIS_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('✅ IRIS KFintech service initialized');
  }

  private isTokenValid(): boolean {
    if (!this.tokenData) return false;
    return Date.now() < this.tokenData.expiresAt - 60000;
  }

  async login(): Promise<{ success: boolean; requiresOtp?: boolean; message?: string }> {
    const username = process.env.IRIS_USERNAME;
    const password = process.env.IRIS_PASSWORD;
    if (!username || !password) {
      return { success: false, message: 'IRIS_USERNAME and IRIS_PASSWORD env vars not set' };
    }
    try {
      const resp = await this.client.post('/auth/login', { username, password });
      const data = resp.data;
      if (data?.token) {
        this.tokenData = {
          token: data.token,
          expiresAt: Date.now() + (data.expiresIn ?? 3600) * 1000,
        };
        this.client.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return { success: true };
      }
      if (data?.requiresOtp || data?.otpRequired) {
        this.pendingOtp = { txnId: data.txnId };
        return { success: false, requiresOtp: true, message: data.message || 'OTP required' };
      }
      return { success: false, message: data?.message || 'Login failed' };
    } catch (err: any) {
      console.error('IRIS login error:', err?.response?.data || err.message);
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
        this.tokenData = {
          token: data.token,
          expiresAt: Date.now() + (data.expiresIn ?? 3600) * 1000,
        };
        this.client.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        this.pendingOtp = null;
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
        this.tokenData = {
          token: data.token,
          expiresAt: Date.now() + (data.expiresIn ?? 3600) * 1000,
        };
        this.client.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async ensureAuth(): Promise<boolean> {
    if (this.isTokenValid()) return true;
    if (this.tokenData) {
      const refreshed = await this.refreshToken();
      if (refreshed) return true;
    }
    const result = await this.login();
    return result.success;
  }

  async call<T = any>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<T> {
    const authed = await this.ensureAuth();
    if (!authed) throw new Error('IRIS authentication failed');
    const resp = await this.client.request<T>({
      url: endpoint,
      method,
      ...(body ? { data: body } : {}),
    });
    return resp.data;
  }

  getStatus(): { configured: boolean; authenticated: boolean; tokenExpiresAt?: number } {
    return {
      configured: !!(process.env.IRIS_USERNAME && process.env.IRIS_PASSWORD),
      authenticated: this.isTokenValid(),
      tokenExpiresAt: this.tokenData?.expiresAt,
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
  async validateInvestment(body: any) { return this.call('/sif/transactions/validate', 'POST', body); }
  async placeOrder(body: any) { return this.call('/sif/transactions/purchase', 'POST', body); }
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

  // Fixed Deposit Orders
  async placeFdOrder(body: any) { return this.call('/user/fixed-deposit/order', 'POST', body); }
  async getFdOrders(pan: string) { return this.call(`/user/fixed-deposit/orders?pan=${encodeURIComponent(pan)}`); }
  async getFdOrderDetails(orderId: string) { return this.call(`/user/fixed-deposit/orders/${orderId}`); }

  // NPS (National Pension System)
  async getNpsSubscriberDetails(pran: string) { return this.call(`/nps/subscriber/${pran}`); }
  async initiateNpsOnboarding(body: any) { return this.call('/nps/subscriber/onboarding', 'POST', body); }
  async placeNpsContribution(body: any) { return this.call('/nps/transactions/contribution', 'POST', body); }
  async getNpsPortfolio(pran: string) { return this.call(`/nps/subscriber/${pran}/portfolio`); }
  async getNpsFundValues(pran: string) { return this.call(`/nps/subscriber/${pran}/fund-values`); }

  // Non-Financial Transactions
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

}

export const irisKfintechService = new IrisKfintechService();
