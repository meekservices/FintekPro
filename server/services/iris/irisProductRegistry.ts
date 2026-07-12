/**
 * irisProductRegistry.ts
 *
 * Single source of truth: maps every FintekPro product category
 * to its canonical IRIS (KFintech) API endpoint, HTTP method,
 * required payload fields, and advisor-flow route.
 *
 * Architecture Rules (FASP-AI v3.0):
 *  - AI is a Decision Support System ONLY — never executes autonomously.
 *  - Every entry in this registry is advisory metadata only.
 *  - Actual execution requires explicit advisor / user confirmation first.
 *  - All orders must be idempotent (idempotency key required at call site).
 */

export type IrisProductCategory =
  | "MUTUAL_FUND"
  | "FIXED_DEPOSIT"
  | "NPS"
  | "PMS"
  | "AIF"
  | "BOND"
  | "ETF"
  | "KYC"
  | "ENACH"
  | "SIP"
  | "STP"
  | "SWP"
  | "SWITCH"
  | "REDEMPTION"
  | "NFO";

export interface IrisEndpointDef {
  /** Canonical IRIS REST path (relative to IRIS_BASE_URL) */
  irisPath: string;
  /** HTTP verb for the primary transaction action */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** FintekPro proxy path (/api/iris/…) */
  fintekproRoute: string;
  /** IRIS product type identifier sent in the order body */
  irisProductType: string;
  /** Minimum required fields in the order payload */
  requiredFields: string[];
  /** Whether advisor approval gate is mandatory before execution */
  requiresAdvisorApproval: boolean;
  /** Whether SEBI disclaimer must be shown to investor */
  requiresDisclaimer: boolean;
  /** Human-readable label for audit logs */
  label: string;
}

/**
 * Primary purchase / initiation endpoint per product category.
 */
export const IRIS_PRODUCT_REGISTRY: Record<IrisProductCategory, IrisEndpointDef> = {

  MUTUAL_FUND: {
    irisPath: "/transactions/order",
    method: "POST",
    fintekproRoute: "/api/iris/transactions/place-order",
    irisProductType: "MF_PURCHASE",
    requiredFields: ["pan", "schemeCode", "amount", "paymentMode", "folioNo"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "Mutual Fund Purchase",
  },

  FIXED_DEPOSIT: {
    irisPath: "/user/fixed-deposit/order",
    method: "POST",
    fintekproRoute: "/api/iris/products/fixed-deposits/orders",
    irisProductType: "FD_PURCHASE",
    requiredFields: ["pan", "productId", "amount", "tenureMonths", "paymentMode"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "Fixed Deposit Booking",
  },

  NPS: {
    irisPath: "/nps/contribution",
    method: "POST",
    fintekproRoute: "/api/iris/nps/subscriber/:pran/contribution",
    irisProductType: "NPS_CONTRIBUTION",
    requiredFields: ["pran", "amount", "tier", "paymentMode"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "NPS Contribution",
  },

  PMS: {
    irisPath: "/products/pms/onboard",
    method: "POST",
    fintekproRoute: "/api/iris/products/pms-links",
    irisProductType: "PMS_ONBOARDING",
    requiredFields: ["pan", "pmsFundHouse", "strategyCode", "amount"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "PMS Onboarding",
  },

  AIF: {
    irisPath: "/products/aif/onboard",
    method: "POST",
    fintekproRoute: "/api/iris/products/aif-links",
    irisProductType: "AIF_SUBSCRIPTION",
    requiredFields: ["pan", "aifFundHouse", "schemeCode", "commitmentAmount"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "AIF Subscription",
  },

  BOND: {
    irisPath: "/transactions/bond-order",
    method: "POST",
    fintekproRoute: "/api/iris/transactions/place-order",
    irisProductType: "BOND_PURCHASE",
    requiredFields: ["pan", "isin", "exchange", "quantity", "orderType", "paymentMode"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "Bond Purchase",
  },

  ETF: {
    irisPath: "/transactions/etf-order",
    method: "POST",
    fintekproRoute: "/api/iris/transactions/place-order",
    irisProductType: "ETF_PURCHASE",
    requiredFields: ["pan", "isin", "exchange", "nseSymbol", "quantity", "orderType"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "ETF Purchase",
  },

  KYC: {
    irisPath: "/investors/kyc/initiate",
    method: "POST",
    fintekproRoute: "/api/iris/investors/:pan/kyc",
    irisProductType: "EKYC_INITIATION",
    requiredFields: ["pan", "kycMode"],
    requiresAdvisorApproval: false,
    requiresDisclaimer: false,
    label: "eKYC / KRA Verification",
  },

  ENACH: {
    irisPath: "/mandates/enach/create",
    method: "POST",
    fintekproRoute: "/api/iris/enach/create",
    irisProductType: "ENACH_REGISTRATION",
    requiredFields: ["pan", "bankAccountNumber", "bankIfsc", "maxAmount", "frequency"],
    requiresAdvisorApproval: false,
    requiresDisclaimer: false,
    label: "eNACH Mandate Registration",
  },

  SIP: {
    irisPath: "/transactions/sip/register",
    method: "POST",
    fintekproRoute: "/api/iris/transactions/sip/register",
    irisProductType: "SIP_REGISTRATION",
    requiredFields: ["pan", "schemeCode", "amount", "frequency", "startDate", "mandateId"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "SIP Registration",
  },

  STP: {
    irisPath: "/transactions/stp/register",
    method: "POST",
    fintekproRoute: "/api/iris/transactions/stp/register",
    irisProductType: "STP_REGISTRATION",
    requiredFields: ["pan", "sourceSchemeCode", "targetSchemeCode", "amount", "frequency", "startDate"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "STP Registration",
  },

  SWP: {
    irisPath: "/transactions/swp/register",
    method: "POST",
    fintekproRoute: "/api/iris/transactions/swp/register",
    irisProductType: "SWP_REGISTRATION",
    requiredFields: ["pan", "schemeCode", "folioNo", "amount", "frequency", "startDate"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "SWP Registration",
  },

  SWITCH: {
    irisPath: "/transactions/switch",
    method: "POST",
    fintekproRoute: "/api/iris/transactions/switch",
    irisProductType: "SWITCH",
    requiredFields: ["pan", "sourceSchemeCode", "targetSchemeCode", "folioNo", "units"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "Fund Switch",
  },

  REDEMPTION: {
    irisPath: "/transactions/redemption",
    method: "POST",
    fintekproRoute: "/api/iris/transactions/place-redemption",
    irisProductType: "REDEMPTION",
    requiredFields: ["pan", "schemeCode", "folioNo", "units"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "Fund Redemption",
  },

  NFO: {
    irisPath: "/nfo/apply",
    method: "POST",
    fintekproRoute: "/api/iris/nfo/apply",
    irisProductType: "NFO_APPLICATION",
    requiredFields: ["pan", "schemeCode", "amount", "paymentMode"],
    requiresAdvisorApproval: true,
    requiresDisclaimer: true,
    label: "NFO Application",
  },
};

/**
 * Lifecycle endpoint map — cancel / modify / status operations.
 * Key format: `${category}:${action}`
 */
export const IRIS_LIFECYCLE_ENDPOINTS: Record<
  string,
  Pick<IrisEndpointDef, "irisPath" | "method" | "fintekproRoute" | "label">
> = {
  "MUTUAL_FUND:status":     { irisPath: "/transactions/:orderId/tracking",           method: "GET",  fintekproRoute: "/api/iris/transactions/:orderId/tracking",           label: "MF Order Status" },
  "MUTUAL_FUND:cancel":     { irisPath: "/transactions/:orderId/cancel",             method: "POST", fintekproRoute: "/api/iris/transactions/:orderId/cancel",             label: "MF Order Cancel" },
  "FIXED_DEPOSIT:status":   { irisPath: "/user/fixed-deposit/orders/:orderId",       method: "GET",  fintekproRoute: "/api/iris/products/fixed-deposits/orders/:orderId", label: "FD Order Status" },
  "FIXED_DEPOSIT:close":    { irisPath: "/user/fixed-deposit/orders/:orderId/close", method: "POST", fintekproRoute: "/api/iris/products/fixed-deposits/orders/:orderId/premature-closure", label: "FD Premature Closure" },
  "NPS:portfolio":          { irisPath: "/nps/subscriber/:pran/portfolio",           method: "GET",  fintekproRoute: "/api/iris/nps/subscriber/:pran/portfolio",           label: "NPS Portfolio" },
  "NPS:withdrawal":         { irisPath: "/nps/subscriber/:pran/partial-withdrawal",  method: "POST", fintekproRoute: "/api/iris/nps/subscriber/:pran/partial-withdrawal",  label: "NPS Partial Withdrawal" },
  "SIP:modify":             { irisPath: "/transactions/sip/:sipId/modify",           method: "PUT",  fintekproRoute: "/api/iris/transactions/sip/:sipId/modify",           label: "SIP Modification" },
  "SIP:pause":              { irisPath: "/transactions/sip/pause",                   method: "POST", fintekproRoute: "/api/iris/transactions/sip/pause",                   label: "SIP Pause" },
  "SIP:cancel":             { irisPath: "/transactions/sip/cancel",                  method: "POST", fintekproRoute: "/api/iris/transactions/sip/cancel",                  label: "SIP Cancel" },
  "STP:pause":              { irisPath: "/transactions/stp/pause",                   method: "POST", fintekproRoute: "/api/iris/transactions/stp/pause",                   label: "STP Pause" },
  "STP:cancel":             { irisPath: "/transactions/stp/cancel",                  method: "POST", fintekproRoute: "/api/iris/transactions/stp/cancel",                  label: "STP Cancel" },
  "SWP:pause":              { irisPath: "/transactions/swp/pause",                   method: "POST", fintekproRoute: "/api/iris/transactions/swp/pause",                   label: "SWP Pause" },
  "SWP:cancel":             { irisPath: "/transactions/swp/cancel",                  method: "POST", fintekproRoute: "/api/iris/transactions/swp/cancel",                  label: "SWP Cancel" },
  "SWITCH:status":          { irisPath: "/transactions/switch/:orderId/status",      method: "GET",  fintekproRoute: "/api/iris/transactions/switch/:orderId/status",      label: "Switch Status" },
  "SWITCH:cancel":          { irisPath: "/transactions/switch/cancel",               method: "POST", fintekproRoute: "/api/iris/transactions/switch/cancel",               label: "Switch Cancel" },
  "ENACH:status":           { irisPath: "/mandates/enach/:mandateId/status",         method: "GET",  fintekproRoute: "/api/iris/enach/:mandateId/status",                  label: "Mandate Status" },
  "ENACH:cancel":           { irisPath: "/mandates/enach/:mandateId/cancel",         method: "POST", fintekproRoute: "/api/iris/enach/:mandateId/cancel",                  label: "Mandate Cancel" },
  "KYC:status":             { irisPath: "/investors/:pan/ekyc-status",               method: "GET",  fintekproRoute: "/api/iris/investors/:pan/ekyc-status",               label: "eKYC Status" },
  "KYC:kra":                { irisPath: "/investors/:pan/kra-status",                method: "GET",  fintekproRoute: "/api/iris/investors/:pan/kra-status",                label: "KRA Status" },
  "NFO:cancel":             { irisPath: "/nfo/applications/:applicationId/cancel",   method: "POST", fintekproRoute: "/api/iris/nfo/applications/:applicationId/cancel",   label: "NFO Cancel" },
};

/**
 * Resolve the primary IRIS endpoint for a product category.
 * Throws if category is unrecognised.
 */
export function resolveIrisEndpoint(category: IrisProductCategory): IrisEndpointDef {
  const def = IRIS_PRODUCT_REGISTRY[category];
  if (!def) {
    throw new Error(`[IrisProductRegistry] Unknown product category: ${category}`);
  }
  return def;
}

/**
 * Resolve a lifecycle endpoint (e.g. "SIP:cancel").
 * Throws if the action is not registered.
 */
export function resolveIrisLifecycleEndpoint(
  category: IrisProductCategory,
  action: string,
): Pick<IrisEndpointDef, "irisPath" | "method" | "fintekproRoute" | "label"> {
  const key = `${category}:${action}`;
  const def = IRIS_LIFECYCLE_ENDPOINTS[key];
  if (!def) {
    throw new Error(`[IrisProductRegistry] No lifecycle endpoint for: ${key}`);
  }
  return def;
}

/**
 * Validate that all required payload fields are present and non-empty.
 */
export function validateOrderPayload(
  category: IrisProductCategory,
  payload: Record<string, unknown>,
): { valid: true } | { valid: false; missing: string[] } {
  const { requiredFields } = resolveIrisEndpoint(category);
  const missing = requiredFields.filter(
    (f) => payload[f] === undefined || payload[f] === null || payload[f] === "",
  );
  return missing.length > 0 ? { valid: false, missing } : { valid: true };
}
