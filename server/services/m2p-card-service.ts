/**
 * M2P Fintech — Credit Card Issuance & Distribution Service
 *
 * M2P is an Indian API infrastructure company that enables card programs
 * (prepaid, debit, credit, co-branded) via bank partnerships.
 *
 * Auth modes:
 *   Sandbox  — simple header-based auth (M2P_API_KEY + M2P_SECRET_KEY)
 *   Pre-Prod / Production — PKI mutual auth:
 *     • Payload encrypted using M2P's public key (AES-256-CBC + PKCS7)
 *     • Encrypted payload signed using our private key (RSA-SHA256)
 *     • TLS v1.2+ mandatory
 *     • Source IPs must be whitelisted in M2P's firewall
 *
 * Required env vars:
 *   M2P_BASE_URL       — e.g. https://sandbox.m2pfintech.com/api/v1
 *   M2P_API_KEY        — API key provisioned by M2P on onboarding
 *   M2P_SECRET_KEY     — Secret key provisioned by M2P on onboarding
 *   M2P_PROGRAM_ID     — Credit card program ID assigned by M2P
 *   M2P_PUBLIC_KEY     — M2P's RSA public key (production PKI mode)
 *   M2P_PRIVATE_KEY    — Our RSA private key (production PKI mode)
 *   M2P_WEBHOOK_SECRET — HMAC secret for verifying incoming webhook events
 *
 * Contact M2P to get credentials: business@m2pfintech.com
 * Docs: https://docs.m2pfintech.com
 */

import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface M2PCustomer {
  customerId: string;
  name: string;
  mobile: string;
  email: string;
  pan: string;
  dob: string;           // YYYY-MM-DD
  gender: 'M' | 'F' | 'O';
  address: M2PAddress;
  kycStatus?: 'pending' | 'verified' | 'rejected';
}

export interface M2PAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface M2PCard {
  cardId: string;
  customerId: string;
  cardNumber: string;     // masked e.g. XXXX-XXXX-XXXX-1234
  cardType: 'credit' | 'debit' | 'prepaid';
  network: 'visa' | 'mastercard' | 'rupay';
  status: 'issued' | 'active' | 'blocked' | 'expired' | 'closed';
  programId: string;
  creditLimit?: number;
  availableLimit?: number;
  expiryMonth: number;
  expiryYear: number;
  isVirtual: boolean;
  issuedAt: string;
}

export interface M2PEligibilityRequest {
  pan: string;
  mobile: string;
  annualIncome: number;   // in INR
  employmentType: 'salaried' | 'self_employed' | 'business';
  creditScore?: number;   // CIBIL score if already fetched
}

export interface M2PEligibilityResult {
  eligible: boolean;
  preApprovedLimit?: number;
  recommendedCards: M2PCardProduct[];
  reasons?: string[];
  referenceId: string;
}

export interface M2PCardProduct {
  productId: string;
  name: string;
  issuerBank: string;
  network: 'visa' | 'mastercard' | 'rupay';
  cardType: string;
  annualFee: number;
  joiningFee: number;
  feeWaiverSpend?: number;
  rewardRate: string;
  features: string[];
  benefits: string[];
  eligibility: {
    minIncome: number;
    minCreditScore: number;
  };
  programId: string;
}

export interface M2PCardApplicationRequest {
  programId: string;
  customer: {
    name: string;
    mobile: string;
    email: string;
    pan: string;
    dob: string;
    gender: 'M' | 'F' | 'O';
    annualIncome: number;
    employmentType: 'salaried' | 'self_employed' | 'business';
    address: M2PAddress;
  };
  referenceId?: string;   // from eligibility check
}

export interface M2PCardApplication {
  applicationId: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'dispatched';
  customerId?: string;
  cardId?: string;
  approvedLimit?: number;
  rejectionReason?: string;
  estimatedDispatch?: string;   // ISO date
  createdAt: string;
}

export interface M2PTransaction {
  transactionId: string;
  cardId: string;
  amount: number;
  currency: string;
  type: 'debit' | 'credit' | 'reversal';
  status: 'approved' | 'declined' | 'pending' | 'reversed';
  merchantName?: string;
  merchantCategory?: string;
  location?: string;
  timestamp: string;
  availableBalance?: number;
}

export interface M2PStatement {
  statementId: string;
  cardId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalDue: number;
  minimumDue: number;
  dueDate: string;
  openingBalance: number;
  closingBalance: number;
  transactions: M2PTransaction[];
  downloadUrl?: string;
}

export interface M2PWebhookEvent {
  eventId: string;
  eventType:
    | 'card.issued'
    | 'card.activated'
    | 'card.blocked'
    | 'card.replaced'
    | 'transaction.approved'
    | 'transaction.declined'
    | 'statement.generated'
    | 'limit.updated'
    | 'application.approved'
    | 'application.rejected';
  timestamp: string;
  programId: string;
  data: Record<string, unknown>;
}

// ─── Known credit card products catalog (seeded; updated from M2P when live) ──

export const CREDIT_CARD_CATALOG: M2PCardProduct[] = [
  {
    productId: 'hdfc-infinia-credit',
    name: 'HDFC Infinia Credit Card',
    issuerBank: 'HDFC Bank',
    network: 'visa',
    cardType: 'Super Premium',
    annualFee: 12500,
    joiningFee: 12500,
    feeWaiverSpend: 800000,
    rewardRate: '3.3% on dining & travel, 5% on SmartBuy',
    features: ['Unlimited airport lounge access', 'Annual fee waiver on ₹8L spend', 'Complimentary golf rounds', 'Priority Pass membership'],
    benefits: ['10X rewards on SmartBuy', 'Club Marriott membership', 'Concierge service', 'Milestone rewards'],
    eligibility: { minIncome: 2500000, minCreditScore: 750 },
    programId: 'M2P-HDFC-INFINIA-001',
  },
  {
    productId: 'sbi-elite-credit',
    name: 'SBI Card ELITE',
    issuerBank: 'SBI Card',
    network: 'mastercard',
    cardType: 'Premium',
    annualFee: 4999,
    joiningFee: 4999,
    feeWaiverSpend: 1000000,
    rewardRate: '2% on all spends, 10X on premium brands',
    features: ['8 complimentary lounge visits', 'Milestone benefits', 'Fuel surcharge waiver', 'Movie ticket offers'],
    benefits: ['Annual vouchers worth ₹5,000', 'Dining privileges', 'Golf privileges'],
    eligibility: { minIncome: 2000000, minCreditScore: 700 },
    programId: 'M2P-SBI-ELITE-001',
  },
  {
    productId: 'amazon-pay-icici',
    name: 'Amazon Pay ICICI Card',
    issuerBank: 'ICICI Bank',
    network: 'visa',
    cardType: 'Cashback',
    annualFee: 0,
    joiningFee: 0,
    rewardRate: '5% on Amazon for Prime, 3% on Amazon for non-Prime, 2% on partner merchants',
    features: ['Lifetime free', 'Instant cashback', 'No reward point redemption needed'],
    benefits: ['5% on Amazon.in (Prime)', 'Amazon Pay balance credited directly'],
    eligibility: { minIncome: 300000, minCreditScore: 650 },
    programId: 'M2P-ICICI-AMAZON-001',
  },
  {
    productId: 'axis-ace-credit',
    name: 'Axis Bank ACE Credit Card',
    issuerBank: 'Axis Bank',
    network: 'visa',
    cardType: 'Cashback',
    annualFee: 499,
    joiningFee: 499,
    feeWaiverSpend: 200000,
    rewardRate: '5% cashback on Google Pay, 4% on utilities/bills, 2% on all spends',
    features: ['Fuel surcharge waiver', 'Complimentary lounge access', 'Dining offers'],
    benefits: ['5% cashback on GPay', 'Annual fee waiver on ₹2L spend'],
    eligibility: { minIncome: 600000, minCreditScore: 680 },
    programId: 'M2P-AXIS-ACE-001',
  },
  {
    productId: 'hdfc-regalia-gold',
    name: 'HDFC Regalia Gold Credit Card',
    issuerBank: 'HDFC Bank',
    network: 'mastercard',
    cardType: 'Lifestyle',
    annualFee: 2500,
    joiningFee: 2500,
    feeWaiverSpend: 400000,
    rewardRate: '4 reward points per ₹150 spent, 20X on SmartBuy',
    features: ['12 complimentary lounge visits', 'Welcome benefits ₹2,500', 'Golf privileges', 'Dining rewards'],
    benefits: ['SmartBuy 20X accelerated rewards', 'Golf round per quarter', 'Travel insurance cover'],
    eligibility: { minIncome: 1200000, minCreditScore: 700 },
    programId: 'M2P-HDFC-REGALIA-GOLD-001',
  },
  {
    productId: 'idfc-wealth-credit',
    name: 'IDFC FIRST Wealth Credit Card',
    issuerBank: 'IDFC FIRST Bank',
    network: 'visa',
    cardType: 'Wealth',
    annualFee: 0,
    joiningFee: 0,
    rewardRate: '6X on online, 3X on offline, 10X on birthdays',
    features: ['Lifetime free', 'Unlimited lounge access', 'Movie tickets', '1% fuel surcharge waiver'],
    benefits: ['Road-side assistance', 'Air accident cover ₹1Cr', 'Lost card liability'],
    eligibility: { minIncome: 600000, minCreditScore: 680 },
    programId: 'M2P-IDFC-WEALTH-001',
  },
  {
    productId: 'rbl-shoprite-credit',
    name: 'RBL Bank ShopRite Credit Card',
    issuerBank: 'RBL Bank',
    network: 'mastercard',
    cardType: 'Shopping',
    annualFee: 0,
    joiningFee: 0,
    rewardRate: '5% cashback on groceries, 2% on dining, 1% everywhere',
    features: ['Lifetime free', 'Grocery cashback', 'Dining rewards'],
    benefits: ['5% on grocery at partner stores', 'Fuel surcharge waiver'],
    eligibility: { minIncome: 300000, minCreditScore: 640 },
    programId: 'M2P-RBL-SHOPRITE-001',
  },
  {
    productId: 'yes-marquee-credit',
    name: 'YES FIRST Marquee Credit Card',
    issuerBank: 'YES Bank',
    network: 'mastercard',
    cardType: 'Super Premium',
    annualFee: 9999,
    joiningFee: 9999,
    rewardRate: '24 reward points per ₹200 on travel & dining, 12 elsewhere',
    features: ['Unlimited airport lounge', '4 international lounge visits', 'Concierge', 'Golf benefits'],
    benefits: ['Travel insurance ₹3Cr', 'Yes PayNow', 'Milestone rewards ₹15,000/year'],
    eligibility: { minIncome: 2000000, minCreditScore: 750 },
    programId: 'M2P-YES-MARQUEE-001',
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

export class M2PCardService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly programId: string;
  private readonly m2pPublicKey: string;
  private readonly ourPrivateKey: string;
  private readonly webhookSecret: string;
  private readonly isSandbox: boolean;

  constructor() {
    this.baseUrl   = (process.env.M2P_BASE_URL || '').replace(/\/$/, '');
    this.apiKey    = process.env.M2P_API_KEY || '';
    this.secretKey = process.env.M2P_SECRET_KEY || '';
    this.programId = process.env.M2P_PROGRAM_ID || 'DEFAULT';
    this.m2pPublicKey  = process.env.M2P_PUBLIC_KEY || '';
    this.ourPrivateKey = process.env.M2P_PRIVATE_KEY || '';
    this.webhookSecret = process.env.M2P_WEBHOOK_SECRET || '';

    // Sandbox mode: no PKI, simple header auth
    // Production: PKI mutual auth (AES encrypt + RSA sign)
    this.isSandbox = !this.m2pPublicKey || !this.ourPrivateKey;
  }

  /** Returns true when M2P credentials are set */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey && this.secretKey);
  }

  /** Returns the complete in-memory card catalog (used when M2P is unconfigured) */
  getCatalog(): M2PCardProduct[] {
    return CREDIT_CARD_CATALOG;
  }

  // ── Payload signing (Production PKI mode) ───────────────────────────────────

  /**
   * Encrypt a JSON payload using M2P's RSA public key + AES-256-CBC.
   * In production, M2P provides their public key in PEM format after onboarding.
   */
  private encryptPayload(payload: Record<string, unknown>): string {
    if (this.isSandbox) return JSON.stringify(payload);

    // Generate a random AES key + IV
    const aesKey = crypto.randomBytes(32);
    const iv     = crypto.randomBytes(16);

    // Encrypt the JSON payload with AES-256-CBC
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);

    // Encrypt the AES key with M2P's RSA public key
    const encryptedKey = crypto.publicEncrypt(
      { key: this.m2pPublicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      aesKey,
    );

    return JSON.stringify({
      encryptedKey: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      data: encrypted.toString('base64'),
    });
  }

  /**
   * Sign a string payload with our RSA private key.
   * M2P verifies this signature on their end using our public key they hold on file.
   */
  private signPayload(payload: string): string {
    if (this.isSandbox) return '';
    const sign = crypto.createSign('SHA256');
    sign.update(payload);
    return sign.sign(this.ourPrivateKey, 'base64');
  }

  // ── HTTP client ─────────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('M2P credentials not configured. Set M2P_BASE_URL, M2P_API_KEY, M2P_SECRET_KEY.');
    }

    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key':    this.apiKey,
      'x-program-id': this.programId,
      'x-request-id': crypto.randomUUID(),
    };

    let requestBody: string | undefined;

    if (body) {
      if (this.isSandbox) {
        requestBody = JSON.stringify(body);
      } else {
        const encryptedPayload = this.encryptPayload(body);
        const signature = this.signPayload(encryptedPayload);
        headers['x-signature'] = signature;
        requestBody = encryptedPayload;
      }
    }

    const resp = await fetch(url, {
      method,
      headers,
      ...(requestBody ? { body: requestBody } : {}),
    });

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      const msg = data?.message || data?.error || data?.errorMessage || resp.statusText;
      throw new Error(`M2P API ${resp.status}: ${msg}`);
    }

    return data as T;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create or update a customer record in M2P.
   * Must be called before issuing a card.
   */
  async createCustomer(params: {
    name: string;
    mobile: string;
    email: string;
    pan: string;
    dob: string;              // YYYY-MM-DD
    gender: 'M' | 'F' | 'O';
    address: M2PAddress;
  }): Promise<{ customerId: string; status: string }> {
    return this.request('POST', '/customer/create', {
      name:   params.name,
      mobile: params.mobile,
      email:  params.email,
      pan:    params.pan,
      dob:    params.dob,
      gender: params.gender,
      address: params.address,
    });
  }

  /** Fetch a customer by mobile or PAN */
  async getCustomer(customerId: string): Promise<M2PCustomer> {
    return this.request('GET', `/customer/${customerId}`);
  }

  /**
   * Submit KYC details for the customer.
   * M2P performs e-KYC via Aadhaar OTP or DigiLocker.
   */
  async submitKYC(customerId: string, kycData: {
    aadhaarNumber?: string;   // masked — last 4 only, per UIDAI guidelines
    panNumber: string;
    kycType: 'ekyc' | 'offline_kyc' | 'video_kyc';
    consentTimestamp: string;
  }): Promise<{ kycId: string; status: 'pending' | 'verified' | 'rejected' }> {
    return this.request('POST', '/customer/kyc', { customerId, ...kycData });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ELIGIBILITY CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pre-qualify a customer for a credit card.
   * Returns eligible card programs + pre-approved limit (soft pull, no CIBIL impact).
   *
   * When M2P is not configured: uses local catalog + income/credit score filter.
   */
  async checkEligibility(req: M2PEligibilityRequest): Promise<M2PEligibilityResult> {
    if (!this.isConfigured()) {
      // Offline eligibility: filter local catalog by income + credit score
      const score = req.creditScore ?? 650;
      const recommended = CREDIT_CARD_CATALOG.filter(
        c => req.annualIncome >= c.eligibility.minIncome && score >= c.eligibility.minCreditScore,
      );
      return {
        eligible: recommended.length > 0,
        preApprovedLimit: recommended.length > 0 ? Math.min(req.annualIncome / 6, 500000) : 0,
        recommendedCards: recommended,
        referenceId: `offline-${Date.now()}`,
        ...(recommended.length === 0 && {
          reasons: [
            `Minimum CIBIL score required: ${Math.min(...CREDIT_CARD_CATALOG.map(c => c.eligibility.minCreditScore))}`,
            `Minimum annual income required: ₹${Math.min(...CREDIT_CARD_CATALOG.map(c => c.eligibility.minIncome)).toLocaleString('en-IN')}`,
          ],
        }),
      };
    }

    return this.request('POST', '/card/eligibility', {
      pan:            req.pan,
      mobile:         req.mobile,
      annual_income:  req.annualIncome,
      employment_type: req.employmentType,
      ...(req.creditScore && { credit_score: req.creditScore }),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD APPLICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Submit a credit card application via M2P.
   * Customer must exist in M2P (via createCustomer) before applying.
   */
  async applyForCard(req: M2PCardApplicationRequest): Promise<M2PCardApplication> {
    return this.request('POST', '/card/apply', {
      program_id:   req.programId,
      reference_id: req.referenceId,
      customer: {
        name:            req.customer.name,
        mobile:          req.customer.mobile,
        email:           req.customer.email,
        pan:             req.customer.pan,
        dob:             req.customer.dob,
        gender:          req.customer.gender,
        annual_income:   req.customer.annualIncome,
        employment_type: req.customer.employmentType,
        address:         req.customer.address,
      },
    });
  }

  /** Get the status of a card application */
  async getApplicationStatus(applicationId: string): Promise<M2PCardApplication> {
    return this.request('GET', `/card/application/${applicationId}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD LIFECYCLE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /** Issue a card (called by M2P after application approval) */
  async issueCard(customerId: string, programId: string, isVirtual = false): Promise<M2PCard> {
    return this.request('POST', '/card/issue', { customer_id: customerId, program_id: programId, is_virtual: isVirtual });
  }

  /** Activate a physical card */
  async activateCard(cardId: string): Promise<{ success: boolean; status: string }> {
    return this.request('POST', `/card/${cardId}/activate`);
  }

  /** Block / freeze a card */
  async blockCard(cardId: string, reason: string): Promise<{ success: boolean; status: string }> {
    return this.request('POST', `/card/${cardId}/block`, { reason });
  }

  /** Unblock / unfreeze a card */
  async unblockCard(cardId: string): Promise<{ success: boolean; status: string }> {
    return this.request('POST', `/card/${cardId}/unblock`);
  }

  /** Replace a card (lost, damaged, expired) */
  async replaceCard(cardId: string, reason: 'lost' | 'damaged' | 'expired'): Promise<{ newCardId: string; estimatedDelivery: string }> {
    return this.request('POST', `/card/${cardId}/replace`, { reason });
  }

  /** Get card details */
  async getCard(cardId: string): Promise<M2PCard> {
    return this.request('GET', `/card/${cardId}`);
  }

  /** Get all cards for a customer */
  async listCards(customerId: string): Promise<M2PCard[]> {
    return this.request<{ cards: M2PCard[] }>('GET', `/customer/${customerId}/cards`).then(r => r.cards);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDIT LIMIT
  // ═══════════════════════════════════════════════════════════════════════════

  /** Set or update the credit limit for a card */
  async updateCreditLimit(cardId: string, newLimit: number, reason?: string): Promise<{ success: boolean; limit: number }> {
    return this.request('PUT', `/card/${cardId}/limit`, { limit: newLimit, reason });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /** List transactions for a card with optional date filters */
  async listTransactions(cardId: string, params?: {
    from?: string;   // YYYY-MM-DD
    to?: string;     // YYYY-MM-DD
    type?: 'debit' | 'credit' | 'reversal';
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: M2PTransaction[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.from)   q.set('from', params.from);
    if (params?.to)     q.set('to', params.to);
    if (params?.type)   q.set('type', params.type);
    if (params?.limit)  q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return this.request('GET', `/card/${cardId}/transactions${qs ? '?' + qs : ''}`);
  }

  /** Dispute a transaction */
  async disputeTransaction(cardId: string, transactionId: string, reason: string): Promise<{ disputeId: string; status: string }> {
    return this.request('POST', '/transaction/dispute', { card_id: cardId, transaction_id: transactionId, reason });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATEMENTS & BILLING
  // ═══════════════════════════════════════════════════════════════════════════

  /** Generate a billing statement for a card */
  async generateStatement(cardId: string, billingMonth: string): Promise<{ statementId: string; status: string }> {
    return this.request('POST', `/card/${cardId}/statement/generate`, { billing_month: billingMonth });
  }

  /** Fetch a specific statement */
  async getStatement(cardId: string, statementId: string): Promise<M2PStatement> {
    return this.request('GET', `/card/${cardId}/statement/${statementId}`);
  }

  /** List all statements for a card */
  async listStatements(cardId: string): Promise<M2PStatement[]> {
    return this.request<{ statements: M2PStatement[] }>('GET', `/card/${cardId}/statements`).then(r => r.statements);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBHOOK VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Verify an inbound M2P webhook event.
   * M2P signs payloads with HMAC-SHA256 using the shared webhook secret.
   * Header: x-m2p-signature
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      return false;
    }
  }

  /** Parse and return a verified webhook event */
  parseWebhookEvent(rawBody: string, signature: string): M2PWebhookEvent {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new Error('Invalid M2P webhook signature');
    }
    return JSON.parse(rawBody) as M2PWebhookEvent;
  }
}

export const m2pCardService = new M2PCardService();
