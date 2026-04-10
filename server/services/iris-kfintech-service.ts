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
  async initiateInvestorOnboarding(body: any) { return this.call('/user/onboarding/initiate', 'POST', body); }
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
  async sendWhatsappNotification(body: any) { return this.call('/notifications/whatsapp/send', 'POST', body); }
  async getNotificationTemplates() { return this.call('/notifications/templates'); }
  async getNotificationHistory(pan: string) { return this.call(`/notifications/history?pan=${encodeURIComponent(pan)}`); }

  // ─── Phase 3: NFO ─────────────────────────────────────────────────────────────
  async getNfoSchemes() { return this.call('/sif/nfo/active'); }
  async getNfoSchemeDetails(schemeCode: string) { return this.call(`/sif/nfo/${schemeCode}`); }
  async applyNfo(body: any) { return this.call('/sif/nfo/apply', 'POST', body); }
  async getNfoApplications(pan: string) { return this.call(`/sif/nfo/applications?pan=${encodeURIComponent(pan)}`); }
  async cancelNfoApplication(applicationId: string) { return this.call(`/sif/nfo/applications/${applicationId}/cancel`, 'POST'); }

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

}

export const irisKfintechService = new IrisKfintechService();
