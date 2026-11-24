/**
 * CA Practice Cockpit — B2B SaaS Subscription & Invoicing Engine
 *
 * Implements recurring SaaS subscription tier management and billing for
 * Chartered Accountants (CAs), Tax Practitioners, and Audit Firms:
 *
 * Compliance Invariants:
 * - 18% GST (SAC 9983 IT Software / SaaS Services)
 * - CCPA Anti-Dark Patterns 2023: Zero drip pricing (GST breakdown shown upfront)
 * - RBI 24-hr pre-debit notifications on recurring e-mandates
 * - Itemized tax invoicing with Place of Supply (CGST+SGST vs IGST)
 *
 * @engineVersion FINTEK-CA-SAAS-v1.0
 */

import { logger } from "../logger";
import { nanoid } from "nanoid";

export type CaTierKey = "CA_STARTER" | "CA_PROFESSIONAL" | "CA_ENTERPRISE";
export type BillingCycle = "MONTHLY" | "ANNUAL";

export interface CaSubscriptionTier {
  key: CaTierKey;
  name: string;
  monthlyBasePriceInr: number;
  annualBasePriceInr: number; // 20% discount on annual
  maxClients: number;
  features: string[];
  recommended: boolean;
}

export interface CaTaxInvoiceCalculation {
  tierKey: CaTierKey;
  billingCycle: BillingCycle;
  baseAmountInr: number;
  discountInr: number;
  taxableAmountInr: number;
  gstRatePercent: number;
  cgstAmountInr: number;
  sgstAmountInr: number;
  igstAmountInr: number;
  totalPayableInr: number;
  isInterstate: boolean;
  sacCode: string;
}

export interface CaSubscriptionRecord {
  subscriptionId: string;
  caUserId: string;
  tierKey: CaTierKey;
  billingCycle: BillingCycle;
  status: "ACTIVE" | "PAUSED" | "EXPIRED" | "CANCELLED";
  startDate: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  preDebitNoticeDate: string; // 24 hours prior to next billing date
  autoRenew: boolean;
}

export class CaSaasSubscriptionService {
  private static instance: CaSaasSubscriptionService;
  static readonly SAC_CODE = "998315"; // Hosting and IT infrastructure provisioning
  static readonly GST_RATE = 0.18;

  private static readonly TIERS: Record<CaTierKey, CaSubscriptionTier> = {
    CA_STARTER: {
      key: "CA_STARTER",
      name: "CA Practice Starter",
      monthlyBasePriceInr: 1499,
      annualBasePriceInr: 14390, // ~20% discount
      maxClients: 25,
      features: [
        "Up to 25 Active Tax Clients",
        "Section 111A/112A Capital Gains Engine",
        "Grandfathering u/s 55(2)(ac) Automation",
        "Direct ITR-2 & ITR-3 JSON Generation",
        "Email Support",
      ],
      recommended: false,
    },
    CA_PROFESSIONAL: {
      key: "CA_PROFESSIONAL",
      name: "CA Practice Professional",
      monthlyBasePriceInr: 3499,
      annualBasePriceInr: 33590,
      maxClients: 100,
      features: [
        "Up to 100 Active Tax Clients",
        "Multi-Broker CAS & PDF Auto-Parser",
        "Advance Tax Quarterly Projection Simulator",
        "AIS / Form 26AS Discrepancy Sentinel",
        "Tax Loss Harvesting Advisory Simulator",
        "Dedicated Relationship Manager",
      ],
      recommended: true,
    },
    CA_ENTERPRISE: {
      key: "CA_ENTERPRISE",
      name: "CA Firm Enterprise Cockpit",
      monthlyBasePriceInr: 7999,
      annualBasePriceInr: 76790,
      maxClients: 999999, // Unlimited
      features: [
        "Unlimited Tax & Audit Clients",
        "Multi-Seat CA Partner & Article Clerk Roles",
        "Finvu Account Aggregator 1-Click Pull",
        "Firm White-Label Branding on Reports",
        "REST API Access & Webhook Integrations",
        "Priority 24/7 SLA Support",
      ],
      recommended: false,
    },
  };

  private activeSubscriptions: Map<string, CaSubscriptionRecord> = new Map();

  static getInstance(): CaSaasSubscriptionService {
    if (!CaSaasSubscriptionService.instance) {
      CaSaasSubscriptionService.instance = new CaSaasSubscriptionService();
    }
    return CaSaasSubscriptionService.instance;
  }

  /**
   * Returns list of all available B2B subscription tiers.
   */
  getAvailableTiers(): CaSubscriptionTier[] {
    return Object.values(CaSaasSubscriptionService.TIERS);
  }

  /**
   * Calculates upfront transparent tax invoice breakdown (anti-drip pricing compliant).
   */
  calculateInvoice(params: {
    tierKey: CaTierKey;
    billingCycle: BillingCycle;
    supplierStateCode?: string; // Default Maharashtra (27)
    clientStateCode?: string;
  }): CaTaxInvoiceCalculation {
    const tier = CaSaasSubscriptionService.TIERS[params.tierKey];
    if (!tier) {
      throw new Error(`Invalid subscription tier: ${params.tierKey}`);
    }

    const baseAmount =
      params.billingCycle === "ANNUAL"
        ? tier.annualBasePriceInr
        : tier.monthlyBasePriceInr;

    const discount = 0; // Transparent base rate
    const taxableAmount = baseAmount - discount;

    const supplierState = params.supplierStateCode || "27"; // Maharashtra
    const clientState = params.clientStateCode || "27";
    const isInterstate = supplierState !== clientState;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterstate) {
      igst = Number((taxableAmount * CaSaasSubscriptionService.GST_RATE).toFixed(2));
    } else {
      cgst = Number(((taxableAmount * CaSaasSubscriptionService.GST_RATE) / 2).toFixed(2));
      sgst = Number(((taxableAmount * CaSaasSubscriptionService.GST_RATE) / 2).toFixed(2));
    }

    const totalPayable = Number((taxableAmount + cgst + sgst + igst).toFixed(2));

    return {
      tierKey: params.tierKey,
      billingCycle: params.billingCycle,
      baseAmountInr: baseAmount,
      discountInr: discount,
      taxableAmountInr: taxableAmount,
      gstRatePercent: 18,
      cgstAmountInr: cgst,
      sgstAmountInr: sgst,
      igstAmountInr: igst,
      totalPayableInr: totalPayable,
      isInterstate,
      sacCode: CaSaasSubscriptionService.SAC_CODE,
    };
  }

  /**
   * Activates or upgrades a CA subscription with 24-hr pre-debit schedule.
   */
  createSubscription(params: {
    caUserId: string;
    tierKey: CaTierKey;
    billingCycle: BillingCycle;
  }): CaSubscriptionRecord {
    const subId = `SUB_CA_${nanoid(10).toUpperCase()}`;
    const now = new Date();

    const periodDays = params.billingCycle === "ANNUAL" ? 365 : 30;
    const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const preDebitNotice = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

    const record: CaSubscriptionRecord = {
      subscriptionId: subId,
      caUserId: params.caUserId,
      tierKey: params.tierKey,
      billingCycle: params.billingCycle,
      status: "ACTIVE",
      startDate: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      nextBillingDate: periodEnd.toISOString(),
      preDebitNoticeDate: preDebitNotice.toISOString(),
      autoRenew: true,
    };

    this.activeSubscriptions.set(params.caUserId, record);

    logger.info("CA_SAAS_SUBSCRIPTION_ACTIVATED", {
      subscriptionId: subId,
      caUserId: params.caUserId,
      tierKey: params.tierKey,
      billingCycle: params.billingCycle,
      currentPeriodEnd: record.currentPeriodEnd,
    });

    return record;
  }

  /**
   * Retrieves active subscription status for a CA user.
   */
  getSubscriptionStatus(caUserId: string): CaSubscriptionRecord | null {
    return this.activeSubscriptions.get(caUserId) || null;
  }
}

export const caSaasSubscriptionService = CaSaasSubscriptionService.getInstance();
