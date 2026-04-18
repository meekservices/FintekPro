/**
 * broker-types.ts
 * Shared type definitions for the Alpaca Broker API integration.
 * Imported by us-trading-1-1.ts and related services.
 */

import type { Request } from "express";
import type { AlpacaAccount } from "../services/alpaca-broker-service";

// ─── Auth & Request ───────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  roles?: string[];
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// ─── Account Opening ──────────────────────────────────────────────────────────

/**
 * One agreement line submitted during account opening.
 * Maps to the `agreements` array in the Alpaca POST /v1/accounts payload.
 */
export interface AgreementInput {
  agreement: string;
  signedAt?: string;
  ipAddress?: string;
  revision?: string;
}

/** Valid Alpaca risk tolerance values (top-level field, not nested under identity) */
export type RiskTolerance = "conservative" | "moderate" | "significant_risk";

/** Valid Alpaca investment objective values */
export type InvestmentObjective =
  | "growth_income"
  | "growth"
  | "capital_preservation"
  | "speculation"
  | "other";

/** Sub-shape of the Alpaca broker account payload – contact section */
export interface AlpacaContactPayload {
  email_address: string;
  phone_number?: string;
  street_address: string[];
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
}

/** Sub-shape of the Alpaca broker account payload – identity section */
export interface AlpacaIdentityPayload {
  given_name: string;
  family_name: string;
  middle_name?: string;
  date_of_birth: string;
  tax_id?: string;
  tax_id_type?: string;
  country_of_citizenship?: string;
  country_of_birth?: string;
  country_of_tax_residence: string;
  funding_source: string[];
  annual_income_min?: string;
  annual_income_max?: string;
  liquid_net_worth_min?: string;
  liquid_net_worth_max?: string;
  total_net_worth_min?: string;
  total_net_worth_max?: string;
}

/** Sub-shape of the Alpaca broker account payload – disclosures section */
export interface AlpacaDisclosuresPayload {
  is_control_person: boolean;
  is_affiliated_exchange_or_finra: boolean;
  is_politically_exposed: boolean;
  immediate_family_exposed: boolean;
}

/** One agreement line in the Alpaca API format */
export interface AlpacaAgreementPayload {
  agreement: string;
  signed_at: string;
  ip_address: string;
  revision: string;
}

/** W-8BEN or other document sent to Alpaca */
export interface AlpacaDocumentPayload {
  document_type: string;
  content: string;
  mime_type: string;
}

/**
 * Full Alpaca account creation payload.
 * Per docs: https://docs.alpaca.markets/reference/createaccount
 * Required: account_type, contact, identity, disclosures, agreements
 */
export interface AlpacaBrokerAccountPayload {
  account_type: "trading";
  account_referrer: string;
  risk_tolerance: RiskTolerance;
  investment_objective: InvestmentObjective;
  contact: AlpacaContactPayload;
  identity: AlpacaIdentityPayload;
  disclosures: AlpacaDisclosuresPayload;
  agreements: AlpacaAgreementPayload[];
  documents: AlpacaDocumentPayload[];
  enabled_assets: string[];
}

/** Extracted fields from AlpacaAccount after creation */
export type AlpacaAccountCreated = Pick<AlpacaAccount, "id" | "account_number" | "status">;

// ─── Error handling ───────────────────────────────────────────────────────────

/** Minimal shape of an Axios error for safe message extraction */
export interface AxiosLikeError {
  response?: {
    data?: { message?: string };
  };
  message?: string;
}

/**
 * Extracts a human-readable error message from an unknown thrown value.
 * Falls back to `fallback` if no message is found.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as AxiosLikeError;
  return e?.response?.data?.message ?? e?.message ?? fallback;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Sorted array of valid Alpaca risk tolerance values for runtime validation */
export const VALID_RISK_TOLERANCES: readonly RiskTolerance[] = [
  "conservative",
  "moderate",
  "significant_risk",
];

/** Sorted array of valid Alpaca investment objective values for runtime validation */
export const VALID_INVESTMENT_OBJECTIVES: readonly InvestmentObjective[] = [
  "growth_income",
  "growth",
  "capital_preservation",
  "speculation",
  "other",
];

/** Narrows a raw string to RiskTolerance, defaulting to "moderate" */
export function resolveRiskTolerance(raw: unknown): RiskTolerance {
  return (VALID_RISK_TOLERANCES as readonly string[]).includes(raw as string)
    ? (raw as RiskTolerance)
    : "moderate";
}

/** Narrows a raw string to InvestmentObjective, defaulting to "growth" */
export function resolveInvestmentObjective(raw: unknown): InvestmentObjective {
  return (VALID_INVESTMENT_OBJECTIVES as readonly string[]).includes(raw as string)
    ? (raw as InvestmentObjective)
    : "growth";
}
