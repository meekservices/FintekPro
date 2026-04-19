import { pgEnum } from "drizzle-orm/pg-core";

export const payoutModeEnum = pgEnum("payout_mode", [
  "upfront",
  "trail",
  "revenue_share",
  "performance"
]);

export const passthroughRuleEnum = pgEnum("passthrough_rule", [
  "stop",
  "roll_up"
]);

export const commissionPlanStatusEnum = pgEnum("commission_plan_status", [
  "draft",
  "active",
  "frozen",
  "archived"
]);

export const fundStatusEnum = pgEnum("fund_status", ["active", "soft_close", "hard_close", "existing_only", "suspended"]);

export const navFrequencyEnum = pgEnum("nav_frequency", ["DAILY", "WEEKLY", "MONTHLY"]);

export const portfolioEntryStatusEnum = pgEnum("portfolio_entry_status", ["pending", "approved", "rejected", "needs_review"]);

export const mldStatusEnum = pgEnum("mld_status", ["active", "closed", "matured", "called_back"]);

export const mldPayoffTypeEnum = pgEnum("mld_payoff_type", ["digital", "barrier", "sharkfin", "range", "participation", "autocall", "snowball"]);

export const investmentInquiryTypeEnum = pgEnum("investment_inquiry_type", ["aif", "pms", "mld"]);

export const investmentInquiryStatusEnum = pgEnum("investment_inquiry_status", ["new", "contacted", "qualified", "negotiating", "closed_won", "closed_lost"]);

export const meetingBookingStatusEnum = pgEnum("meeting_booking_status", ["pending", "confirmed", "completed", "cancelled", "no_show"]);

export const staffChangeTypeEnum = pgEnum("staff_change_type", [
  "resignation",
  "termination",
  "transfer",
  "promotion",
  "leave"
]);

export const pickCategoryEnum = pgEnum("pick_category", [
  "listed_stocks",
  "mutual_funds", 
  "bonds",
  "unlisted",
  "global_stocks",
  "etfs",
  "reits_invits",
  "fixed_deposits",
  "sgb",
  "derivatives"
]);

export const pickStatusEnum = pgEnum("pick_status", [
  "live",
  "target_hit",
  "stoploss_hit",
  "expired"
]);

export const leadProcessingModeEnum = pgEnum("lead_processing_mode", [
  "PLATFORM",
  "EXTERNAL_FINANCIER",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "REGISTERED",
  "LOGGED_IN",
  "APPROVED",
  "DISBURSED",
]);

export const payoutClaimStatusEnum = pgEnum("payout_claim_status", [
  "PENDING_VERIFICATION",
  "CONFIRMED_BY_FINANCIER",
  "APPROVED",
  "ON_HOLD_PDD",
  "REJECTED",
  "CLAWED_BACK",
]);

export const pddStatusEnum = pgEnum("pdd_status", [
  "NOT_APPLICABLE",
  "PENDING",
  "CLEARED",
  "EXCEPTION_ALLOWED",
]);

export const masterDsaClaimStatusEnum = pgEnum("master_dsa_claim_status", [
  "DRAFT",
  "SUBMITTED",
  "ACKNOWLEDGED",
  "PAID",
  "PARTIALLY_PAID",
  "DISPUTED",
  "REJECTED",
]);

