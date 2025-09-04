import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, index, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User profiles table for detailed client information
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Enhanced KYC Information
  panNumber: varchar("pan_number"),
  aadharNumber: varchar("aadhar_number"),
  passportNumber: varchar("passport_number"),
  drivingLicense: varchar("driving_license"),
  voterIdNumber: varchar("voter_id_number"),
  dateOfBirth: varchar("date_of_birth"),
  nationality: varchar("nationality"),
  fatherName: varchar("father_name"),
  motherName: varchar("mother_name"),
  spouseName: varchar("spouse_name"),
  maritalStatus: varchar("marital_status"),
  
  // Address Information
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),
  country: varchar("country"),
  
  // Financial Information
  occupation: varchar("occupation"),
  annualIncome: varchar("annual_income"),
  investmentExperience: varchar("investment_experience"),
  riskTolerance: varchar("risk_tolerance"),
  
  // Banking & Nominee Information
  bankAccountNumber: varchar("bank_account_number"),
  ifscCode: varchar("ifsc_code"),
  nomineeDetails: text("nominee_details"),
  nomineeRelation: varchar("nominee_relation"),
  
  // EUIN and API Integration
  euinNumber: varchar("euin_number"),
  arnCode: varchar("arn_code"), // ARN (AMFI Registration Number) for mutual fund distributors
  amcCode: varchar("amc_code"), // Asset Management Company code
  distributorId: varchar("distributor_id"), // Distributor identification
  isAgent: boolean("is_agent").default(false), // Whether user is an agent/distributor
  agentType: varchar("agent_type"), // 'individual', 'corporate', 'bank'
  enableCamsApi: boolean("enable_cams_api").default(false),
  enableKfintechApi: boolean("enable_kfintech_api").default(false),
  enableNsdlApi: boolean("enable_nsdl_api").default(false),
  enableCdslApi: boolean("enable_cdsl_api").default(false),
  
  // Registry Preferences
  preferredCamsRegistration: boolean("preferred_cams_registration").default(false),
  preferredKfintechRegistration: boolean("preferred_kfintech_registration").default(false),
  preferredNsdlRegistration: boolean("preferred_nsdl_registration").default(false),
  preferredCdslRegistration: boolean("preferred_cdsl_registration").default(false),
  
  // Comprehensive FATCA Information
  fatcaStatus: varchar("fatca_status"), // Y/N
  fatcaDeclarationDate: timestamp("fatca_declaration_date"),
  fatcaTinNumber: varchar("fatca_tin_number"),
  fatcaCountryOfTaxResidence: varchar("fatca_country_of_tax_residence"),
  fatcaReasonCode: varchar("fatca_reason_code"),
  fatcaW8BenStatus: varchar("fatca_w8_ben_status"), // submitted/pending/approved
  fatcaW9Status: varchar("fatca_w9_status"), // for US persons
  fatcaTaxpayerIdType: varchar("fatca_taxpayer_id_type"), // SSN/EIN/GIIN/TIN
  
  // PEP (Politically Exposed Person) Information
  pepStatus: varchar("pep_status").default("N"), // Y/N
  pepRelatedPersonStatus: varchar("pep_related_person_status").default("N"), // Y/N
  pepDetails: text("pep_details"), // Details if PEP or related person
  pepCountry: varchar("pep_country"), // Country where person is politically exposed
  pepPosition: varchar("pep_position"), // Political position held
  pepRelationshipType: varchar("pep_relationship_type"), // family/associate/close_business
  
  // Resident Status and Citizenship
  residentStatus: varchar("resident_status").default("resident"), // resident/nri/pio/oci
  countryOfResidence: varchar("country_of_residence").default("India"),
  countryOfCitizenship: varchar("country_of_citizenship").default("India"),
  nriType: varchar("nri_type"), // ordinary/non_ordinary for NRIs
  nriCountry: varchar("nri_country"), // Country of residence for NRIs
  passportCountry: varchar("passport_country"),
  visaStatus: varchar("visa_status"), // for non-residents
  
  // AML (Anti-Money Laundering) Status
  amlStatus: varchar("aml_status").default("clear"), // clear/flagged/under_review
  amlLastChecked: timestamp("aml_last_checked"),
  amlRiskScore: integer("aml_risk_score").default(0), // 0-100
  sanctionListStatus: varchar("sanction_list_status").default("clear"), // clear/flagged
  sanctionListLastChecked: timestamp("sanction_list_last_checked"),
  
  // CDD/EDD (Customer Due Diligence / Enhanced Due Diligence)
  cddLevel: varchar("cdd_level").default("simplified"), // simplified/basic/enhanced
  eddRequired: boolean("edd_required").default(false), // Enhanced Due Diligence
  eddCompletedDate: timestamp("edd_completed_date"),
  eddNextReviewDate: timestamp("edd_next_review_date"),
  sourceOfFunds: varchar("source_of_funds"), // employment/business/inheritance/gift/investment
  sourceOfWealthDocumentation: text("source_of_wealth_documentation"),
  
  // Risk Assessment
  riskCategory: varchar("risk_category").default("low"), // low/medium/high
  complianceScore: integer("compliance_score").default(100), // 0-100 score
  lastComplianceReview: timestamp("last_compliance_review").defaultNow(),
  nextComplianceReview: timestamp("next_compliance_review"),
  complianceOfficer: varchar("compliance_officer"), // Assigned compliance officer
  
  // Additional Regulatory Information
  isUSPerson: boolean("is_us_person").default(false),
  isEUResident: boolean("is_eu_resident").default(false),
  gdprConsent: boolean("gdpr_consent").default(false), // GDPR compliance
  gdprConsentDate: timestamp("gdpr_consent_date"),
  dataProcessingConsent: boolean("data_processing_consent").default(false),
  marketingConsent: boolean("marketing_consent").default(false),
  
  // Investment Profile
  investorType: varchar("investor_type"), // retail/hni/institutional/corporate
  investorCategory: varchar("investor_category"), // individual/company/trust/partnership
  financialSituation: varchar("financial_situation"), // stable/growing/volatile
  investmentObjective: varchar("investment_objective"), // capital_appreciation/income/balanced
  
  // Audit and Tracking
  profileCompleteness: integer("profile_completeness").default(0), // 0-100%
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table with mobile/email authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  mobile: varchar("mobile").unique(),
  phoneNumber: varchar("phone_number").unique(), // WhatsApp phone number
  password: text("password").notNull(),
  firstName: varchar("first_name"),
  middleName: varchar("middle_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isEmailVerified: boolean("is_email_verified").default(false),
  isMobileVerified: boolean("is_mobile_verified").default(false),
  
  // Enhanced KYC Fields
  panNumber: varchar("pan_number"),
  aadharNumber: varchar("aadhar_number"),
  passportNumber: varchar("passport_number"),
  drivingLicense: varchar("driving_license"),
  voterIdNumber: varchar("voter_id_number"),
  dateOfBirth: varchar("date_of_birth"),
  nationality: varchar("nationality"),
  fatherName: varchar("father_name"),
  motherName: varchar("mother_name"),
  spouseName: varchar("spouse_name"),
  maritalStatus: varchar("marital_status"),
  
  // Address Information
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),
  country: varchar("country"),
  
  // Financial Information
  occupation: varchar("occupation"),
  annualIncome: varchar("annual_income"),
  investmentExperience: varchar("investment_experience"),
  riskTolerance: varchar("risk_tolerance"),
  sourceOfWealth: varchar("source_of_wealth"),
  
  // Residency Status - Critical for NRI Compliance
  residentStatus: varchar("resident_status"),
  countryOfResidence: varchar("country_of_residence"),
  taxResidencyCountry: varchar("tax_residency_country"),
  
  // FATCA Compliance Fields
  fatcaStatus: varchar("fatca_status"),
  fatcaTinNumber: varchar("fatca_tin_number"),
  fatcaCountryOfTaxResidence: varchar("fatca_country_of_tax_residence"),
  
  // PEP Status
  pepStatus: varchar("pep_status"),
  pepDetails: text("pep_details"),
  
  // UBO Information
  isUbo: boolean("is_ubo").default(false),
  uboDetails: text("ubo_details"),
  
  // Banking & Nominee Information
  bankAccountNumber: varchar("bank_account_number"),
  ifscCode: varchar("ifsc_code"),
  nomineeDetails: text("nominee_details"),
  nomineeRelation: varchar("nominee_relation"),
  
  // EUIN and API Integration
  euinNumber: varchar("euin_number"),
  enableCamsApi: boolean("enable_cams_api").default(false),
  enableKfintechApi: boolean("enable_kfintech_api").default(false),
  enableNsdlApi: boolean("enable_nsdl_api").default(false),
  enableCdslApi: boolean("enable_cdsl_api").default(false),

  // PAN Verification Consent - One-time collection
  panVerificationConsent: boolean("pan_verification_consent").default(false),
  panConsentGivenAt: timestamp("pan_consent_given_at"),
  panConsentIpAddress: varchar("pan_consent_ip_address"),
  panConsentUserAgent: text("pan_consent_user_agent"),
  panConsentVersion: varchar("pan_consent_version").default("1.0"), // Track consent version for changes
  
  // Registry Preferences
  preferredCamsRegistration: boolean("preferred_cams_registration").default(false),
  preferredKfintechRegistration: boolean("preferred_kfintech_registration").default(false),
  preferredNsdlRegistration: boolean("preferred_nsdl_registration").default(false),
  preferredCdslRegistration: boolean("preferred_cdsl_registration").default(false),
  
  // Admin and system fields
  role: varchar("role").default("user"), // 'user', 'admin', 'super_admin'
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Compliance Documents table for storing regulatory documents
export const complianceDocuments = pgTable("compliance_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  documentType: varchar("document_type").notNull(), // fatca_w8ben/fatca_w9/pep_declaration/aml_docs/source_of_funds
  documentNumber: varchar("document_number"),
  documentUrl: varchar("document_url"), // stored in object storage
  originalFileName: varchar("original_file_name"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  verificationStatus: varchar("verification_status").default("pending"), // pending/verified/rejected
  verificationDate: timestamp("verification_date"),
  verifiedBy: varchar("verified_by"), // compliance officer ID
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").default(true),
  rejectionReason: text("rejection_reason"),
  metadata: jsonb("metadata"), // additional document-specific data
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Compliance Audit Trail table for tracking all compliance-related changes
export const complianceAuditTrail = pgTable("compliance_audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: varchar("action").notNull(), // status_change/document_upload/review_completed/risk_assessment
  fieldChanged: varchar("field_changed"), // specific field that was modified
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  performedBy: varchar("performed_by").notNull(), // user ID or system
  performedByRole: varchar("performed_by_role"), // compliance_officer/system/user
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  riskImpact: varchar("risk_impact"), // low/medium/high
  complianceImpact: varchar("compliance_impact"), // none/minor/major/critical
  metadata: jsonb("metadata"), // additional context
  createdAt: timestamp("created_at").defaultNow(),
});

// OTP verification table
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: varchar("identifier").notNull(), // email or mobile
  otp: varchar("otp", { length: 6 }).notNull(),
  type: varchar("type").notNull(), // 'email' or 'mobile'
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// CKYC (Central KYC Registry) records table
export const ckycRecords = pgTable("ckyc_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ckycNumber: varchar("ckyc_number").unique(), // CKYC identifier from registry
  applicationNumber: varchar("application_number"),
  
  // Personal Information
  firstName: varchar("first_name").notNull(),
  middleName: varchar("middle_name"),
  lastName: varchar("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  gender: varchar("gender", { length: 1 }), // M/F/T
  maritalStatus: varchar("marital_status"),
  nationality: varchar("nationality").default("Indian"),
  
  // Document Information
  panNumber: varchar("pan_number").notNull(),
  aadharNumber: varchar("aadhar_number"),
  passportNumber: varchar("passport_number"),
  voterIdNumber: varchar("voter_id_number"),
  drivingLicenseNumber: varchar("driving_license_number"),
  
  // Contact Information
  mobileNumber: varchar("mobile_number").notNull(),
  emailAddress: varchar("email_address").notNull(),
  
  // Address Information
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: varchar("city").notNull(),
  district: varchar("district"),
  state: varchar("state").notNull(),
  pincode: varchar("pincode", { length: 6 }).notNull(),
  country: varchar("country").default("India"),
  addressType: varchar("address_type").default("permanent"), // permanent/correspondence
  
  // Financial Information
  occupation: varchar("occupation"),
  annualIncome: varchar("annual_income"),
  netWorth: varchar("net_worth"),
  sourceOfWealth: varchar("source_of_wealth"),
  
  // CKYC Status and Processing
  status: varchar("status").default("pending"), // pending/verified/rejected/expired
  verificationLevel: varchar("verification_level"), // basic/enhanced
  lastVerifiedAt: timestamp("last_verified_at"),
  expiryDate: date("expiry_date"),
  
  // Compliance and Regulatory
  fatcaStatus: varchar("fatca_status"), // Y/N
  fatcaDeclarationDate: timestamp("fatca_declaration_date"),
  fatcaTinNumber: varchar("fatca_tin_number"),
  fatcaCountryOfTaxResidence: varchar("fatca_country_of_tax_residence"),
  fatcaReasonCode: varchar("fatca_reason_code"),
  pepStatus: varchar("pep_status").default("N"), // Y/N (Politically Exposed Person)
  pepRelatedPersonStatus: varchar("pep_related_person_status").default("N"), // Y/N
  pepDetails: text("pep_details"), // Details if PEP or related person
  riskCategory: varchar("risk_category").default("low"), // low/medium/high
  residentStatus: varchar("resident_status").default("resident"), // resident/nri/pio/oci
  countryOfResidence: varchar("country_of_residence").default("India"),
  countryOfCitizenship: varchar("country_of_citizenship").default("India"),
  amlStatus: varchar("aml_status").default("clear"), // clear/flagged/under_review
  amlLastChecked: timestamp("aml_last_checked"),
  sanctionListStatus: varchar("sanction_list_status").default("clear"), // clear/flagged
  sanctionListLastChecked: timestamp("sanction_list_last_checked"),
  cddLevel: varchar("cdd_level").default("simplified"), // simplified/basic/enhanced
  eddRequired: boolean("edd_required").default(false), // Enhanced Due Diligence
  eddCompletedDate: timestamp("edd_completed_date"),
  complianceScore: integer("compliance_score").default(100), // 0-100 score
  lastComplianceReview: timestamp("last_compliance_review").defaultNow(),
  nextComplianceReview: timestamp("next_compliance_review"),
  
  // Audit and Tracking
  profileCompleteness: integer("profile_completeness").default(0), // 0-100%
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// CKYC Documents table for storing document references
export const ckycDocuments = pgTable("ckyc_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  documentType: varchar("document_type").notNull(), // pan/aadhar/passport/photo/signature
  documentNumber: varchar("document_number"),
  documentUrl: varchar("document_url"), // stored in object storage
  verificationStatus: varchar("verification_status").default("pending"), // pending/verified/rejected
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  verifiedAt: timestamp("verified_at"),
});

// CKYC Status History for audit trail
export const ckycStatusHistory = pgTable("ckyc_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status").notNull(),
  changedBy: varchar("changed_by"), // user_id or system
  reason: text("reason"),
  metadata: jsonb("metadata"), // additional context
  changedAt: timestamp("changed_at").defaultNow(),
});

export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }),
  cash: decimal("cash", { precision: 15, scale: 2 }).default("0"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  symbol: text("symbol").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  avgPrice: decimal("avg_price", { precision: 15, scale: 4 }).notNull(),
  assetType: text("asset_type").notNull(), // 'equity', 'bond', 'mf', 'gold', 'silver', 'commodity', 'alternative'
  assetClass: text("asset_class"), // 'large_cap', 'mid_cap', 'small_cap', 'debt', 'hybrid', 'precious_metals', 'energy', 'agricultural'
  sector: text("sector"), // technology, banking, healthcare, energy, consumer_goods, etc.
  marketCap: decimal("market_cap", { precision: 20, scale: 0 }),
  beta: decimal("beta", { precision: 5, scale: 3 }),
  dividendYield: decimal("dividend_yield", { precision: 5, scale: 2 }),
  peRatio: decimal("pe_ratio", { precision: 8, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const watchlists = pgTable("watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  symbols: text("symbols").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  price: decimal("price", { precision: 15, scale: 4 }),
  change: decimal("change", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 0 }),
  data: jsonb("data"), // Additional market data from external sources
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const assetAllocation = pgTable("asset_allocation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  assetType: text("asset_type").notNull(),
  assetClass: text("asset_class"),
  targetPercentage: decimal("target_percentage", { precision: 5, scale: 2 }),
  currentPercentage: decimal("current_percentage", { precision: 5, scale: 2 }),
  targetValue: decimal("target_value", { precision: 15, scale: 2 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  rebalanceAmount: decimal("rebalance_amount", { precision: 15, scale: 2 }),
  riskScore: decimal("risk_score", { precision: 3, scale: 1 }),
  expectedReturn: decimal("expected_return", { precision: 5, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// EPF Holdings table for tracking Employee Provident Fund data
export const epfHoldings = pgTable("epf_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  epfAccountNumber: varchar("epf_account_number").notNull(),
  employerName: text("employer_name").notNull(),
  memberName: text("member_name").notNull(),
  // EPF Balance Information
  employeeContribution: decimal("employee_contribution", { precision: 15, scale: 2 }),
  employerContribution: decimal("employer_contribution", { precision: 15, scale: 2 }),
  pensionContribution: decimal("pension_contribution", { precision: 15, scale: 2 }),
  totalBalance: decimal("total_balance", { precision: 15, scale: 2 }),
  interestEarned: decimal("interest_earned", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }), // Annual interest rate
  // Account Details
  dateOfJoining: date("date_of_joining"),
  dateOfExit: date("date_of_exit"),
  isActive: boolean("is_active").default(true),
  nomineeName: text("nominee_name"),
  nomineeRelationship: varchar("nominee_relationship"),
  // Tracking
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PPF Holdings table for tracking Public Provident Fund data
export const ppfHoldings = pgTable("ppf_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ppfAccountNumber: varchar("ppf_account_number").notNull(),
  bankName: text("bank_name").notNull(),
  branchName: text("branch_name"),
  accountHolderName: text("account_holder_name").notNull(),
  // PPF Balance Information
  totalBalance: decimal("total_balance", { precision: 15, scale: 2 }),
  currentFinancialYearContribution: decimal("current_fy_contribution", { precision: 15, scale: 2 }),
  totalContribution: decimal("total_contribution", { precision: 15, scale: 2 }),
  totalInterestEarned: decimal("total_interest_earned", { precision: 15, scale: 2 }),
  currentInterestRate: decimal("current_interest_rate", { precision: 5, scale: 2 }), // Annual interest rate
  maturityAmount: decimal("maturity_amount", { precision: 15, scale: 2 }),
  // Account Timeline
  accountOpenDate: date("account_open_date").notNull(),
  maturityDate: date("maturity_date").notNull(),
  lastContributionDate: date("last_contribution_date"),
  nextContributionDueDate: date("next_contribution_due_date"),
  // PPF Rules and Status
  yearsCompleted: integer("years_completed").default(0),
  minContributionMet: boolean("min_contribution_met").default(false), // ₹500 minimum
  maxContributionAllowed: decimal("max_contribution_allowed", { precision: 15, scale: 2 }).default("150000"), // ₹1.5L limit
  contributionRemaining: decimal("contribution_remaining", { precision: 15, scale: 2 }),
  // Loan and Withdrawal Information
  loanAvailable: boolean("loan_available").default(false), // Available from 3rd year
  maxLoanAmount: decimal("max_loan_amount", { precision: 15, scale: 2 }),
  partialWithdrawalAvailable: boolean("partial_withdrawal_available").default(false), // From 7th year
  maxWithdrawalAmount: decimal("max_withdrawal_amount", { precision: 15, scale: 2 }),
  // Nominee Information
  nomineeName: text("nominee_name"),
  nomineeRelationship: varchar("nominee_relationship"),
  nomineeAge: integer("nominee_age"),
  // Account Status
  isActive: boolean("is_active").default(true),
  canExtend: boolean("can_extend").default(false), // After 15 years
  hasExtended: boolean("has_extended").default(false),
  extensionPeriod: integer("extension_period"), // 5-year blocks
  // Tracking
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// EPS (Employee Pension Scheme) Holdings Schema
export const epsHoldings = pgTable("eps_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  epfAccountNumber: varchar("epf_account_number").notNull(), // Linked to EPF account
  pensionAccountNumber: varchar("pension_account_number").notNull(),
  employerCode: varchar("employer_code").notNull(),
  currentEmployer: text("current_employer").notNull(),
  serviceStartDate: date("service_start_date").notNull(),
  totalServiceYears: integer("total_service_years").notNull().default(0),
  totalServiceMonths: integer("total_service_months").notNull().default(0),
  currentSalary: decimal("current_salary", { precision: 15, scale: 2 }).notNull().default("0"),
  pensionableWage: decimal("pensionable_wage", { precision: 15, scale: 2 }).notNull().default("0"), // Max 15,000 per month
  contributionRate: decimal("contribution_rate", { precision: 5, scale: 2 }).notNull().default("8.33"), // 8.33% of pensionable wage
  monthlyPensionContribution: decimal("monthly_pension_contribution", { precision: 15, scale: 2 }).notNull().default("0"),
  totalContribution: decimal("total_contribution", { precision: 15, scale: 2 }).notNull().default("0"),
  accumulatedPension: decimal("accumulated_pension", { precision: 15, scale: 2 }).notNull().default("0"),
  estimatedMonthlyPension: decimal("estimated_monthly_pension", { precision: 15, scale: 2 }).notNull().default("0"), // At 58 years
  minVestingPeriod: integer("min_vesting_period").notNull().default(10), // 10 years minimum
  isVested: boolean("is_vested").notNull().default(false),
  eligibleForPension: boolean("eligible_for_pension").notNull().default(false), // Age 58 minimum
  expectedRetirementDate: date("expected_retirement_date"), // Age 58-60
  schemeType: varchar("scheme_type").notNull().default("eps95"), // EPS-95 scheme
  certificateNumber: varchar("certificate_number"), // Pension Payment Order (PPO)
  nomineeName: text("nominee_name"),
  nomineeRelationship: varchar("nominee_relationship"),
  nomineeShare: decimal("nominee_share", { precision: 5, scale: 2 }).notNull().default("100"), // Percentage
  status: varchar("status").notNull().default("active"), // active, suspended, pension_started, withdrawn
  lastPensionCalculationDate: date("last_pension_calculation_date"),
  remarks: text("remarks"),
  // APY (Atal Pension Yojana) Integration
  apyEnrolled: boolean("apy_enrolled").notNull().default(false),
  apyAccountNumber: varchar("apy_account_number"),
  apyPensionAmount: decimal("apy_pension_amount", { precision: 15, scale: 2 }), // 1000, 2000, 3000, 4000, 5000
  apyMonthlyContribution: decimal("apy_monthly_contribution", { precision: 15, scale: 2 }),
  apyStartDate: date("apy_start_date"),
  apyMaturityAge: integer("apy_maturity_age").default(60), // 60 years
  apyCurrentAge: integer("apy_current_age"),
  apyTotalContribution: decimal("apy_total_contribution", { precision: 15, scale: 2 }).default("0"),
  apyGovernmentContribution: decimal("apy_government_contribution", { precision: 15, scale: 2 }).default("0"), // Co-contribution for eligible income groups
  apyStatus: varchar("apy_status").default("active"), // active, matured, discontinued
  apyBankName: text("apy_bank_name"),
  apyBranchCode: varchar("apy_branch_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Pi Chat Asset Summaries
export const piChatSummaries = pgTable("pi_chat_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  assetClass: text("asset_class").notNull(),
  summary: text("summary").notNull(),
  insights: jsonb("insights"), // key metrics, risks, opportunities
  recommendations: text("recommendations").array(),
  lastAnalyzed: timestamp("last_analyzed").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Commodity Tracking
export const commodityPrices = pgTable("commodity_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(), // precious_metals, energy, agricultural, industrial
  price: decimal("price", { precision: 15, scale: 4 }).notNull(),
  priceUnit: text("price_unit").notNull(), // per_ounce, per_barrel, per_ton
  change: decimal("change", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Enhanced Rebalancing Suggestions
export const rebalancingSuggestions = pgTable("rebalancing_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  suggestionType: text("suggestion_type").notNull(), // yield_optimization, risk_reduction, diversification
  priority: text("priority").notNull(), // high, medium, low
  title: text("title").notNull(),
  description: text("description").notNull(),
  actions: jsonb("actions"), // array of specific actions to take
  expectedImpact: jsonb("expected_impact"), // yield, risk, diversification improvements
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 1 }),
  implementationSteps: text("implementation_steps").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Activity Tracking
export const userActivities = pgTable("user_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(), // 'login', 'portfolio_view', 'trade', 'api_call', etc.
  resource: varchar("resource"), // what was accessed/modified
  details: jsonb("details"), // additional activity data
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin Panel Settings
export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: jsonb("value"),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Notifications/Guidance
export const userNotifications = pgTable("user_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  type: varchar("type").notNull(), // 'info', 'warning', 'guidance', 'alert'
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  actionUrl: varchar("action_url"), // where to navigate when clicked
  isRead: boolean("is_read").default(false),
  priority: varchar("priority").default("medium"), // 'low', 'medium', 'high', 'critical'
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").references(() => users.id), // admin who created it
  createdAt: timestamp("created_at").defaultNow(),
});

// Interactive Brokers Integration Tables

// IB Account Configurations
export const ibAccounts = pgTable("ib_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  accountName: varchar("account_name").notNull(),
  accountNumber: varchar("account_number").notNull(),
  isPaperTrading: boolean("is_paper_trading").default(true),
  host: varchar("host").default("127.0.0.1"),
  port: integer("port").default(7497), // 7497 for paper, 7496 for live
  clientId: integer("client_id").default(1),
  isActive: boolean("is_active").default(true),
  connectionStatus: varchar("connection_status").default("disconnected"), // connected, disconnected, error
  lastConnected: timestamp("last_connected"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// IB Orders tracking
export const ibOrders = pgTable("ib_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  orderId: integer("order_id").notNull(), // IB order ID
  clientId: integer("client_id").notNull(),
  symbol: varchar("symbol").notNull(),
  action: varchar("action").notNull(), // 'BUY', 'SELL'
  orderType: varchar("order_type").notNull(), // 'MKT', 'LMT', 'STP'
  totalQuantity: decimal("total_quantity", { precision: 15, scale: 4 }).notNull(),
  limitPrice: decimal("limit_price", { precision: 15, scale: 4 }),
  stopPrice: decimal("stop_price", { precision: 15, scale: 4 }),
  status: varchar("status").notNull(), // 'Submitted', 'Filled', 'Cancelled', etc.
  filled: decimal("filled", { precision: 15, scale: 4 }).default("0"),
  remaining: decimal("remaining", { precision: 15, scale: 4 }),
  avgFillPrice: decimal("avg_fill_price", { precision: 15, scale: 4 }).default("0"),
  commission: decimal("commission", { precision: 15, scale: 4 }),
  whyHeld: varchar("why_held"),
  orderData: jsonb("order_data"), // Additional order details from IB
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// IB Positions tracking
export const ibPositions = pgTable("ib_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  account: varchar("account").notNull(),
  symbol: varchar("symbol").notNull(),
  position: decimal("position", { precision: 15, scale: 4 }).notNull(),
  marketPrice: decimal("market_price", { precision: 15, scale: 4 }),
  marketValue: decimal("market_value", { precision: 15, scale: 2 }),
  averageCost: decimal("average_cost", { precision: 15, scale: 4 }),
  unrealizedPNL: decimal("unrealized_pnl", { precision: 15, scale: 2 }),
  realizedPNL: decimal("realized_pnl", { precision: 15, scale: 2 }),
  positionData: jsonb("position_data"), // Additional position details
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// IB Account Summary data
export const ibAccountSummary = pgTable("ib_account_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  account: varchar("account").notNull(),
  tag: varchar("tag").notNull(), // NetLiquidation, TotalCashValue, etc.
  value: varchar("value").notNull(),
  currency: varchar("currency").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// IB Market Data subscriptions
export const ibMarketDataSubscriptions = pgTable("ib_market_data_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  symbol: varchar("symbol").notNull(),
  tickerId: integer("ticker_id").notNull(),
  isActive: boolean("is_active").default(true),
  lastPrice: decimal("last_price", { precision: 15, scale: 4 }),
  bid: decimal("bid", { precision: 15, scale: 4 }),
  ask: decimal("ask", { precision: 15, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  marketDataSnapshot: jsonb("market_data_snapshot"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// IB Trading Sessions log
export const ibTradingSessions = pgTable("ib_trading_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  sessionStart: timestamp("session_start").notNull(),
  sessionEnd: timestamp("session_end"),
  connectionDuration: integer("connection_duration"), // in minutes
  ordersPlaced: integer("orders_placed").default(0),
  ordersFilled: integer("orders_filled").default(0),
  ordersCancelled: integer("orders_cancelled").default(0),
  totalPNL: decimal("total_pnl", { precision: 15, scale: 2 }),
  status: varchar("status").default("active"), // active, completed, disconnected
  disconnectReason: varchar("disconnect_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Partner Portal Tables

// Customer Care Agents table
export const customerCareAgents = pgTable("customer_care_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Agent details
  fullName: varchar("full_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone"),
  employeeId: varchar("employee_id").unique(),
  // Authentication (if they need to log into system)
  password: text("password"),
  // Agent specialization
  specializations: text("specializations").array().default([]), // ['technical', 'billing', 'product_inquiry']
  languages: text("languages").array().default(["en"]), // Supported languages
  // Status and availability
  status: varchar("status").default("active"), // 'active', 'inactive', 'on_leave'
  maxTicketsPerDay: integer("max_tickets_per_day").default(50),
  currentTicketCount: integer("current_ticket_count").default(0),
  // Performance metrics
  totalTicketsHandled: integer("total_tickets_handled").default(0),
  averageResolutionTime: decimal("average_resolution_time", { precision: 8, scale: 2 }), // in hours
  customerSatisfactionRating: decimal("customer_satisfaction_rating", { precision: 3, scale: 2 }),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent-Partner mapping table (one agent can support multiple partners)
export const agentPartnerMappings = pgTable("agent_partner_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => customerCareAgents.id).notNull(),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  // Mapping details
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(1), // 1 = primary, 2 = secondary, etc.
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").references(() => users.id), // Admin who made the assignment
  createdAt: timestamp("created_at").defaultNow(),
});

// Client-Agent relationship table for EUIN/ARN association
export const clientAgentRelationships = pgTable("client_agent_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id).notNull(), // Agent user ID
  // EUIN/ARN details from agent
  euinNumber: varchar("euin_number").notNull(),
  arnCode: varchar("arn_code"),
  amcCode: varchar("amc_code"),
  distributorId: varchar("distributor_id"),
  // Relationship details
  relationshipType: varchar("relationship_type").default("primary"), // primary, secondary
  isActive: boolean("is_active").default(true),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").references(() => users.id), // Admin who made the assignment
  // Commission and fee structure
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }),
  feeStructure: jsonb("fee_structure"), // Detailed fee breakdown
  // Auto-populate settings for APIs
  autoPopulateEuin: boolean("auto_populate_euin").default(true),
  autoPopulateArn: boolean("auto_populate_arn").default(true),
  // Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Partners table for managing partner accounts
export const partners = pgTable("partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: varchar("company_name").notNull(),
  contactEmail: varchar("contact_email").unique().notNull(),
  contactPhone: varchar("contact_phone"),
  address: text("address"),
  website: varchar("website"),
  // Authentication
  password: text("password").notNull(),
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  // Partner type and permissions
  partnerType: varchar("partner_type").notNull(), // 'product_provider', 'service_provider', 'both'
  permissions: jsonb("permissions").default({}), // Custom permissions object
  // Business details
  businessLicense: varchar("business_license"),
  taxId: varchar("tax_id"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("0.00"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Products table for partner-managed financial products
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  // Product details
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // 'mutual_fund', 'insurance', 'loan', 'credit_card', 'deposit'
  subCategory: varchar("sub_category"), // Specific type within category
  // Pricing and features
  basePrice: decimal("base_price", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 8, scale: 4 }),
  features: jsonb("features").default({}), // Product features and benefits
  eligibilityCriteria: jsonb("eligibility_criteria").default({}),
  documents: jsonb("documents").default([]), // Required documents
  // Product status and visibility
  status: varchar("status").default("draft"), // 'draft', 'active', 'suspended', 'discontinued'
  isPublic: boolean("is_public").default(false), // Visible to end users
  priority: integer("priority").default(0), // Display priority
  // SEO and metadata
  slug: varchar("slug").unique(),
  tags: text("tags").array().default([]),
  imageUrl: varchar("image_url"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support tickets for client support
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number").unique().notNull(),
  // Client information
  userId: varchar("user_id").references(() => users.id),
  clientName: varchar("client_name").notNull(),
  clientEmail: varchar("client_email").notNull(),
  clientPhone: varchar("client_phone"),
  // Ticket details
  subject: varchar("subject").notNull(),
  description: text("description").notNull(),
  category: varchar("category").notNull(), // 'technical', 'billing', 'product_inquiry', 'complaint'
  priority: varchar("priority").default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: varchar("status").default("open"), // 'open', 'in_progress', 'pending', 'resolved', 'closed'
  // Assignment
  assignedTo: varchar("assigned_to").references(() => partners.id),
  assignedBy: varchar("assigned_by").references(() => users.id),
  // Resolution
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  // Metadata
  source: varchar("source").default("web"), // 'web', 'email', 'phone', 'chat'
  attachments: jsonb("attachments").default([]),
  tags: text("tags").array().default([]),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support ticket messages for conversation history
export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTickets.id).notNull(),
  // Message details
  senderId: varchar("sender_id"), // Can be user, partner, or admin
  senderType: varchar("sender_type").notNull(), // 'user', 'partner', 'admin'
  senderName: varchar("sender_name").notNull(),
  message: text("message").notNull(),
  messageType: varchar("message_type").default("text"), // 'text', 'file', 'image', 'system'
  // Attachments
  attachments: jsonb("attachments").default([]),
  // Metadata
  isInternal: boolean("is_internal").default(false), // Internal notes not visible to client
  createdAt: timestamp("created_at").defaultNow(),
});

// Product applications for tracking user applications
export const productApplications = pgTable("product_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  // Application details
  applicationData: jsonb("application_data").notNull(), // Form data submitted by user
  documents: jsonb("documents").default([]), // Uploaded documents
  // Status tracking
  status: varchar("status").default("submitted"), // 'submitted', 'under_review', 'approved', 'rejected', 'completed'
  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by").references(() => partners.id),
  reviewedAt: timestamp("reviewed_at"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Investment proposals table for agent portfolio improvement suggestions
export const investmentProposals = pgTable("investment_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Core relationships
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Proposal details
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  analysisRationale: text("analysis_rationale"), // Agent's detailed reasoning
  currentAllocation: jsonb("current_allocation"), // Current portfolio breakdown
  targetAllocation: jsonb("target_allocation"), // Proposed allocation
  
  // Investment recommendations
  recommendations: jsonb("recommendations").notNull(), // Array of investment products
  totalInvestmentAmount: decimal("total_investment_amount", { precision: 15, scale: 2 }).notNull(),
  riskProfile: varchar("risk_profile"), // conservative, moderate, aggressive
  timeHorizon: varchar("time_horizon"), // short_term, medium_term, long_term
  
  // Expected outcomes
  expectedReturns: decimal("expected_returns", { precision: 5, scale: 2 }), // Annual % return
  expectedRisk: varchar("expected_risk"), // low, medium, high
  projectedValue: decimal("projected_value", { precision: 15, scale: 2 }), // After time horizon
  
  // Status and approval workflow
  status: varchar("status").default("pending"), // pending, approved, rejected, executed, cancelled
  clientResponse: text("client_response"), // Client's approval/rejection reason
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  executedAt: timestamp("executed_at"),
  
  // Payment and execution tracking
  paymentMethod: varchar("payment_method"), // mf_central, cams, kfintech
  paymentStatus: varchar("payment_status"), // pending, processing, completed, failed
  paymentId: varchar("payment_id"), // External payment reference
  executionStatus: varchar("execution_status"), // pending, processing, completed, failed
  executionDetails: jsonb("execution_details"), // Transaction IDs, confirmation numbers
  
  // Metadata
  priority: varchar("priority").default("medium"), // low, medium, high
  validUntil: timestamp("valid_until"), // Proposal expiry date
  remindersSent: integer("reminders_sent").default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Investment proposal items for detailed product recommendations
export const investmentProposalItems = pgTable("investment_proposal_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").references(() => investmentProposals.id).notNull(),
  
  // Product details
  productType: varchar("product_type").notNull(), // mutual_fund, etf, bond, equity, ulip
  productCode: varchar("product_code").notNull(), // Scheme code, ISIN, etc.
  productName: varchar("product_name").notNull(),
  amc: varchar("amc"), // Asset Management Company
  category: varchar("category"), // Large Cap, Mid Cap, Debt, etc.
  subCategory: varchar("sub_category"),
  
  // Investment details
  recommendedAmount: decimal("recommended_amount", { precision: 15, scale: 2 }).notNull(),
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 2 }).notNull(),
  investmentType: varchar("investment_type"), // lumpsum, sip
  sipAmount: decimal("sip_amount", { precision: 10, scale: 2 }),
  sipFrequency: varchar("sip_frequency"), // monthly, quarterly
  sipDuration: integer("sip_duration_months"),
  
  // Performance and rationale
  nav: decimal("nav", { precision: 10, scale: 4 }), // Current NAV
  oneYearReturns: decimal("one_year_returns", { precision: 5, scale: 2 }),
  threeYearReturns: decimal("three_year_returns", { precision: 5, scale: 2 }),
  fiveYearReturns: decimal("five_year_returns", { precision: 5, scale: 2 }),
  expenseRatio: decimal("expense_ratio", { precision: 5, scale: 2 }),
  exitLoad: decimal("exit_load", { precision: 5, scale: 2 }),
  
  // Risk metrics
  riskRating: varchar("risk_rating"), // Very Low, Low, Moderate, High, Very High
  volatility: decimal("volatility", { precision: 5, scale: 2 }),
  beta: decimal("beta", { precision: 5, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 5, scale: 4 }),
  
  // Agent's reasoning
  selectionReason: text("selection_reason").notNull(),
  expectedOutcome: text("expected_outcome"),
  suitabilityScore: integer("suitability_score"), // 1-10 scale
  
  // Execution tracking
  isExecuted: boolean("is_executed").default(false),
  executedAmount: decimal("executed_amount", { precision: 15, scale: 2 }),
  executedAt: timestamp("executed_at"),
  transactionId: varchar("transaction_id"),
  folioNumber: varchar("folio_number"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment integration tracking for investment proposals
// Financial Goals table for goal-based investment planning
export const financialGoals = pgTable("financial_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Goal details
  name: varchar("name").notNull(),
  description: text("description"),
  goalType: varchar("goal_type").notNull(), // short_term, medium_term, long_term
  category: varchar("category").notNull(), // home_purchase, education, retirement, emergency, travel, wedding
  
  // Financial targets
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).default("0"),
  monthlyContribution: decimal("monthly_contribution", { precision: 10, scale: 2 }).default("0"),
  targetDate: timestamp("target_date").notNull(),
  
  // Risk and investment preferences
  riskProfile: varchar("risk_profile").notNull(), // conservative, moderate, aggressive
  priority: varchar("priority").default("medium"), // low, medium, high
  
  // Recommendations and tracking
  recommendedInvestments: text("recommended_investments").array(),
  currentProgress: decimal("current_progress", { precision: 5, scale: 2 }).default("0"), // Percentage
  isActive: boolean("is_active").default(true),
  
  // Metadata
  tags: text("tags").array(),
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const proposalPayments = pgTable("proposal_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").references(() => investmentProposals.id).notNull(),
  proposalItemId: varchar("proposal_item_id").references(() => investmentProposalItems.id),
  
  // Payment gateway details
  gateway: varchar("gateway").notNull(), // mf_central, cams, kfintech
  gatewayTransactionId: varchar("gateway_transaction_id"),
  paymentMethod: varchar("payment_method"), // netbanking, upi, card, wallet
  
  // Amount and currency
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("INR"),
  
  // Status tracking
  status: varchar("status").default("initiated"), // initiated, processing, success, failed, cancelled
  statusMessage: text("status_message"),
  gatewayResponse: jsonb("gateway_response"), // Full gateway response
  
  // Client and agent info
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  
  // Bank and settlement details
  bankAccount: varchar("bank_account"), // Masked account number
  ifscCode: varchar("ifsc_code"),
  settlementStatus: varchar("settlement_status"), // pending, completed, failed
  settlementDate: timestamp("settlement_date"),
  
  // Metadata
  metadata: jsonb("metadata"), // Additional gateway-specific data
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  
  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const mutualFunds = pgTable("mutual_funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schemeCode: text("scheme_code").notNull().unique(),
  schemeName: text("scheme_name").notNull(),
  category: text("category"),
  fundHouse: text("fund_house"),
  nav: decimal("nav", { precision: 10, scale: 4 }),
  change: decimal("change", { precision: 10, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  expenseRatio: decimal("expense_ratio", { precision: 5, scale: 2 }),
  aum: decimal("aum", { precision: 15, scale: 2 }),
  riskLevel: text("risk_level"),
  returns1y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returns5y: decimal("returns_5y", { precision: 8, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// AIF (Alternative Investment Fund) comprehensive schema
export const aifFunds = pgTable("aif_funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Basic fund information
  fundName: text("fund_name").notNull(),
  isinNumber: varchar("isin_number", { length: 12 }).unique(),
  schemeCode: text("scheme_code").unique(),
  // AIF Classification
  category: varchar("category").notNull(), // Category I, II, or III
  subCategory: text("sub_category").notNull(), // Private Equity, Venture Capital, Hedge Fund, etc.
  fundType: varchar("fund_type").notNull(), // Open-ended, Close-ended
  // AMC and Management Information
  amcName: text("amc_name").notNull(),
  fundManager: text("fund_manager").notNull(),
  fundManagerExperience: integer("fund_manager_experience"), // years
  fundManagerQualification: text("fund_manager_qualification"),
  investmentTeam: jsonb("investment_team"), // Array of team member details
  // Financial Details
  nav: decimal("nav", { precision: 15, scale: 4 }),
  faceValue: decimal("face_value", { precision: 10, scale: 2 }),
  aum: decimal("aum", { precision: 20, scale: 2 }),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  additionalInvestment: decimal("additional_investment", { precision: 15, scale: 2 }),
  // Fee Structure
  managementFee: decimal("management_fee", { precision: 5, scale: 2 }),
  performanceFee: decimal("performance_fee", { precision: 5, scale: 2 }),
  entryLoad: decimal("entry_load", { precision: 5, scale: 2 }),
  exitLoad: decimal("exit_load", { precision: 5, scale: 2 }),
  hurdle_rate: decimal("hurdle_rate", { precision: 5, scale: 2 }),
  // Investment Strategy and Process
  investmentObjective: text("investment_objective").notNull(),
  investmentStrategy: text("investment_strategy").notNull(),
  stockSelectionProcess: text("stock_selection_process").notNull(),
  riskManagementProcess: text("risk_management_process"),
  benchmarkIndex: text("benchmark_index"),
  // Performance Metrics
  returns1y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returns5y: decimal("returns_5y", { precision: 8, scale: 4 }),
  returnsSinceInception: decimal("returns_since_inception", { precision: 8, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 6, scale: 4 }),
  alpha: decimal("alpha", { precision: 6, scale: 4 }),
  beta: decimal("beta", { precision: 6, scale: 4 }),
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  // Portfolio Composition
  assetAllocation: jsonb("asset_allocation"), // Equity, Debt, Others breakdown
  sectorAllocation: jsonb("sector_allocation"), // Sector-wise allocation
  marketCapAllocation: jsonb("market_cap_allocation"), // Large, Mid, Small cap
  geographicAllocation: jsonb("geographic_allocation"), // Domestic vs International
  topHoldings: jsonb("top_holdings"), // Top 10 holdings with percentages
  portfolioTurnover: decimal("portfolio_turnover", { precision: 5, scale: 2 }),
  // Risk Assessment
  riskRating: varchar("risk_rating").notNull(), // Very High, High, Medium, Low
  volatilityCategory: varchar("volatility_category"), // High, Medium, Low
  suitabilityProfile: text("suitability_profile"), // Suitable investor profile
  // Regulatory and Compliance
  sebiRegistrationNumber: varchar("sebi_registration_number").notNull(),
  trustee: text("trustee").notNull(),
  custodian: text("custodian").notNull(),
  auditor: text("auditor"),
  registrar: text("registrar"),
  riskDisclosures: text("risk_disclosures"),
  // Dates and Periods
  launchDate: date("launch_date").notNull(),
  maturityDate: date("maturity_date"), // For close-ended funds
  lockInPeriod: varchar("lock_in_period"), // Lock-in period details
  subscriptionPeriod: varchar("subscription_period"),
  redemptionFrequency: varchar("redemption_frequency"),
  // Status and Availability
  status: varchar("status").default("active"), // active, suspended, closed, matured
  isOpenForSubscription: boolean("is_open_for_subscription").default(true),
  isOpenForRedemption: boolean("is_open_for_redemption").default(true),
  // Exchange and Trading
  exchange: varchar("exchange"), // NSE, BSE, MCX, NCDEX, MSEI
  tradingSymbol: varchar("trading_symbol"),
  lotSize: integer("lot_size"),
  // Additional Information
  factsheetUrl: text("factsheet_url"),
  prospectusUrl: text("prospectus_url"),
  websiteUrl: text("website_url"),
  keyPersonnel: jsonb("key_personnel"), // Management team details
  // ESG and Sustainability
  esgRating: varchar("esg_rating"),
  sustainabilityScore: decimal("sustainability_score", { precision: 5, scale: 2 }),
  greenBondAllocation: decimal("green_bond_allocation", { precision: 5, scale: 2 }),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastNavUpdate: timestamp("last_nav_update"),
});

// Risk Profiling Schema
export const riskProfiles = pgTable("risk_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  riskTolerance: varchar("risk_tolerance").notNull(), // 'conservative', 'moderate', 'aggressive', 'very_aggressive'
  investmentHorizon: varchar("investment_horizon").notNull(), // 'short', 'medium', 'long', 'very_long'
  investmentExperience: varchar("investment_experience").notNull(), // 'beginner', 'intermediate', 'advanced', 'expert'
  incomeStability: varchar("income_stability").notNull(), // 'stable', 'variable', 'irregular'
  liquidityNeeds: varchar("liquidity_needs").notNull(), // 'high', 'medium', 'low'
  age: integer("age"),
  dependents: integer("dependents").default(0),
  monthlyIncome: decimal("monthly_income", { precision: 15, scale: 2 }),
  monthlyExpenses: decimal("monthly_expenses", { precision: 15, scale: 2 }),
  existingAssets: decimal("existing_assets", { precision: 15, scale: 2 }),
  existingLiabilities: decimal("existing_liabilities", { precision: 15, scale: 2 }),
  questionnaire: jsonb("questionnaire"), // Store questionnaire responses
  riskScore: integer("risk_score"), // Calculated risk score (1-100)
  assessedBy: varchar("assessed_by").references(() => users.id), // Admin/support user who assessed
  assessmentDate: timestamp("assessment_date").defaultNow().notNull(),
  reviewDate: timestamp("review_date"), // Next review date
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const riskAssessmentQuestions = pgTable("risk_assessment_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: varchar("category").notNull(), // 'risk_tolerance', 'investment_goals', 'financial_situation'
  question: text("question").notNull(),
  questionType: varchar("question_type").notNull(), // 'multiple_choice', 'scale', 'yes_no'
  options: jsonb("options"), // For multiple choice questions
  weightage: integer("weightage").default(1), // Question importance weight
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCkycRecordSchema = createInsertSchema(ckycRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceAuditTrailSchema = createInsertSchema(complianceAuditTrail).omit({
  id: true,
  createdAt: true,
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  createdAt: true,
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).omit({
  id: true,
  updatedAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  createdAt: true,
});

export const insertAssetAllocationSchema = createInsertSchema(assetAllocation).omit({
  id: true,
  updatedAt: true,
});

export const insertMutualFundSchema = createInsertSchema(mutualFunds).omit({
  id: true,
  lastUpdated: true,
});

export const insertAifFundSchema = createInsertSchema(aifFunds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastNavUpdate: true,
});

export const insertOtpVerificationSchema = createInsertSchema(otpVerifications).omit({
  id: true,
  createdAt: true,
});

export const insertRiskProfileSchema = createInsertSchema(riskProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRiskAssessmentQuestionSchema = createInsertSchema(riskAssessmentQuestions).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// User Profile types
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UpsertUserProfile = typeof userProfiles.$inferInsert;

// CKYC types
export type CkycRecord = typeof ckycRecords.$inferSelect;
export type InsertCkycRecord = z.infer<typeof insertCkycRecordSchema>;
export type UpsertCkycRecord = typeof ckycRecords.$inferInsert;

export type CkycDocument = typeof ckycDocuments.$inferSelect;
export type InsertCkycDocument = typeof ckycDocuments.$inferInsert;

export type CkycStatusHistory = typeof ckycStatusHistory.$inferSelect;
export type InsertCkycStatusHistory = typeof ckycStatusHistory.$inferInsert;

// Compliance types
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;

export type ComplianceAuditTrail = typeof complianceAuditTrail.$inferSelect;
export type InsertComplianceAuditTrail = z.infer<typeof insertComplianceAuditTrailSchema>;
export type RiskProfile = typeof riskProfiles.$inferSelect;
export type InsertRiskProfile = z.infer<typeof insertRiskProfileSchema>;
export type RiskAssessmentQuestion = typeof riskAssessmentQuestions.$inferSelect;
export type InsertRiskAssessmentQuestion = z.infer<typeof insertRiskAssessmentQuestionSchema>;

// User Activity schemas
export const insertUserActivitySchema = createInsertSchema(userActivities).omit({
  id: true,
  createdAt: true,
});
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivities.$inferSelect;

// Admin Settings schemas
export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({
  id: true,
  updatedAt: true,
});
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;
export type AdminSetting = typeof adminSettings.$inferSelect;

// User Notifications schemas
export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({
  id: true,
  createdAt: true,
});
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type UserNotification = typeof userNotifications.$inferSelect;

// Partner Portal schemas
export const insertPartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partners.$inferSelect;

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

export const insertTicketMessageSchema = createInsertSchema(ticketMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type TicketMessage = typeof ticketMessages.$inferSelect;

export const insertProductApplicationSchema = createInsertSchema(productApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProductApplication = z.infer<typeof insertProductApplicationSchema>;
export type ProductApplication = typeof productApplications.$inferSelect;

export const insertCustomerCareAgentSchema = createInsertSchema(customerCareAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomerCareAgent = z.infer<typeof insertCustomerCareAgentSchema>;
export type CustomerCareAgent = typeof customerCareAgents.$inferSelect;

// Achievement Categories Table
export const achievementCategories = pgTable("achievement_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Achievements Table
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => achievementCategories.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 50 }),
  badgeImage: varchar("badge_image", { length: 255 }),
  points: integer("points").default(0),
  difficulty: varchar("difficulty", { length: 20 }).default('beginner'), // beginner, intermediate, advanced, expert
  requirements: jsonb("requirements"), // JSON object defining achievement criteria
  shareTemplate: text("share_template"), // Template for social sharing
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Achievements Table (comprehensive)
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  achievementId: varchar("achievement_id").references(() => achievements.id),
  earnedAt: timestamp("earned_at").defaultNow(),
  progress: decimal("progress", { precision: 5, scale: 2 }).default('0'), // 0-100%
  isCompleted: boolean("is_completed").default(false),
  sharedCount: integer("shared_count").default(0),
  lastSharedAt: timestamp("last_shared_at"),
  metadata: jsonb("metadata"), // Additional data like specific values achieved
});

// Learning Progress Table
export const learningProgress = pgTable("learning_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  category: varchar("category", { length: 100 }).notNull(), // portfolio, trading, analysis, etc.
  action: varchar("action", { length: 100 }).notNull(), // specific action taken
  value: decimal("value", { precision: 15, scale: 2 }), // numerical value if applicable
  metadata: jsonb("metadata"), // additional context
  createdAt: timestamp("created_at").defaultNow(),
});

// Social Shares Table
export const socialShares = pgTable("social_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  achievementId: varchar("achievement_id").references(() => achievements.id),
  platform: varchar("platform", { length: 50 }).notNull(), // twitter, linkedin, facebook, whatsapp
  shareUrl: text("share_url"),
  shareContent: text("share_content"),
  engagementData: jsonb("engagement_data"), // likes, shares, comments if available
  createdAt: timestamp("created_at").defaultNow(),
});

// Export types for achievements
export type AchievementCategory = typeof achievementCategories.$inferSelect;
export type InsertAchievementCategory = typeof achievementCategories.$inferInsert;

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

export type LearningProgress = typeof learningProgress.$inferSelect;
export type InsertLearningProgress = typeof learningProgress.$inferInsert;

export type SocialShare = typeof socialShares.$inferSelect;
export type InsertSocialShare = typeof socialShares.$inferInsert;

// Zod schemas for validation
export const insertAchievementCategorySchema = createInsertSchema(achievementCategories).omit({
  id: true,
  createdAt: true,
});
export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});
export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  earnedAt: true,
});
export const insertLearningProgressSchema = createInsertSchema(learningProgress).omit({
  id: true,
  createdAt: true,
});
export const insertSocialShareSchema = createInsertSchema(socialShares).omit({
  id: true,
  createdAt: true,
});

export const insertAgentPartnerMappingSchema = createInsertSchema(agentPartnerMappings).omit({
  id: true,
  createdAt: true,
});
export type InsertAgentPartnerMapping = z.infer<typeof insertAgentPartnerMappingSchema>;
export type AgentPartnerMapping = typeof agentPartnerMappings.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;
export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlists.$inferSelect;
export type MarketData = typeof marketData.$inferSelect;
export type AssetAllocation = typeof assetAllocation.$inferSelect;
export type InsertAssetAllocation = z.infer<typeof insertAssetAllocationSchema>;
export type PiChatSummary = typeof piChatSummaries.$inferSelect;
export type InsertPiChatSummary = typeof piChatSummaries.$inferInsert;
export type CommodityPrice = typeof commodityPrices.$inferSelect;
export type InsertCommodityPrice = typeof commodityPrices.$inferInsert;
export type RebalancingSuggestion = typeof rebalancingSuggestions.$inferSelect;
export type InsertRebalancingSuggestion = typeof rebalancingSuggestions.$inferInsert;
export type MutualFund = typeof mutualFunds.$inferSelect;
export type InsertMutualFund = z.infer<typeof insertMutualFundSchema>;

// Learning Modules and Lessons
export const learningModules = pgTable("learning_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  difficulty: varchar("difficulty").notNull(), // 'beginner', 'intermediate', 'advanced'
  category: varchar("category").notNull(), // 'basics', 'trading', 'risk-management', 'market-analysis'
  orderIndex: integer("order_index").notNull().default(0),
  estimatedMinutes: integer("estimated_minutes").default(30),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const learningLessons = pgTable("learning_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => learningModules.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  contentType: varchar("content_type").notNull(), // 'text', 'video', 'interactive'
  orderIndex: integer("order_index").notNull().default(0),
  estimatedMinutes: integer("estimated_minutes").default(10),
  pointsReward: integer("points_reward").default(50),
  createdAt: timestamp("created_at").defaultNow(),
});

export const learningQuizzes = pgTable("learning_quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").references(() => learningLessons.id).notNull(),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  explanation: text("explanation"),
  pointsReward: integer("points_reward").default(25),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Progress and Achievements
export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  moduleId: varchar("module_id").references(() => learningModules.id),
  lessonId: varchar("lesson_id").references(() => learningLessons.id),
  status: varchar("status").notNull(), // 'not_started', 'in_progress', 'completed'
  score: integer("score").default(0),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Removed duplicate userAchievements table - using the comprehensive version above

export const userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  totalPoints: integer("total_points").default(0),
  currentStreak: integer("current_streak").default(0),
  maxStreak: integer("max_streak").default(0),
  modulesCompleted: integer("modules_completed").default(0),
  lessonsCompleted: integer("lessons_completed").default(0),
  quizzesCompleted: integer("quizzes_completed").default(0),
  averageScore: decimal("average_score", { precision: 5, scale: 2 }).default("0"),
  lastActivityAt: timestamp("last_activity_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Learning system schemas and types
export const insertLearningModuleSchema = createInsertSchema(learningModules).omit({
  id: true,
  createdAt: true,
});

export const insertLearningLessonSchema = createInsertSchema(learningLessons).omit({
  id: true,
  createdAt: true,
});

export const insertLearningQuizSchema = createInsertSchema(learningQuizzes).omit({
  id: true,
  createdAt: true,
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
  updatedAt: true,
});

// Removed duplicate insertUserAchievementSchema - using the comprehensive version above

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  updatedAt: true,
});

// Export types for learning system
export type LearningModule = typeof learningModules.$inferSelect;
export type InsertLearningModule = z.infer<typeof insertLearningModuleSchema>;
export type LearningLesson = typeof learningLessons.$inferSelect;
export type InsertLearningLesson = z.infer<typeof insertLearningLessonSchema>;
export type LearningQuiz = typeof learningQuizzes.$inferSelect;
export type InsertLearningQuiz = z.infer<typeof insertLearningQuizSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
// Removed duplicate UserAchievement type - using the comprehensive version above
export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;


// Market Stories table for AI-generated content
export const marketStories = pgTable("market_stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  summary: text("summary").notNull(),
  sentiment: varchar("sentiment", { length: 20 }).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  keyPoints: text("key_points").array().default([]),
  marketData: jsonb("market_data"),
  generatedAt: timestamp("generated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Capital Gains Reports
export const capitalGainsReports = pgTable("capital_gains_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  financialYear: varchar("financial_year").notNull(), // e.g., "2023-24"
  reportType: varchar("report_type").notNull(), // 'capital_gains', 'transaction_summary'
  source: varchar("source").notNull(), // 'mf_central', 'nsdl', 'cdsl', 'kfintech', 'cams'
  totalShortTermGains: decimal("total_short_term_gains", { precision: 15, scale: 2 }).default("0"),
  totalLongTermGains: decimal("total_long_term_gains", { precision: 15, scale: 2 }).default("0"),
  totalDividend: decimal("total_dividend", { precision: 15, scale: 2 }).default("0"),
  totalTdsDeducted: decimal("total_tds_deducted", { precision: 15, scale: 2 }).default("0"),
  reportData: jsonb("report_data"), // Complete report data from external sources
  generatedAt: timestamp("generated_at").defaultNow(),
  fetchedAt: timestamp("fetched_at"),
  status: varchar("status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transaction Reports from various registrars
export const transactionReports = pgTable("transaction_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  financialYear: varchar("financial_year").notNull(),
  source: varchar("source").notNull(), // 'mf_central', 'nsdl', 'cdsl', 'kfintech', 'cams'
  assetType: varchar("asset_type").notNull(), // 'mutual_fund', 'equity', 'bond', 'etf'
  totalPurchases: decimal("total_purchases", { precision: 15, scale: 2 }).default("0"),
  totalRedemptions: decimal("total_redemptions", { precision: 15, scale: 2 }).default("0"),
  totalSwitches: decimal("total_switches", { precision: 15, scale: 2 }).default("0"),
  totalDividendReceived: decimal("total_dividend_received", { precision: 15, scale: 2 }).default("0"),
  totalBrokerage: decimal("total_brokerage", { precision: 15, scale: 2 }).default("0"),
  totalTaxes: decimal("total_taxes", { precision: 15, scale: 2 }).default("0"),
  transactionCount: integer("transaction_count").default(0),
  reportData: jsonb("report_data"), // Detailed transaction data
  generatedAt: timestamp("generated_at").defaultNow(),
  fetchedAt: timestamp("fetched_at"),
  status: varchar("status").default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual Transaction Records
export const transactionRecords = pgTable("transaction_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => transactionReports.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  transactionDate: date("transaction_date").notNull(),
  transactionType: varchar("transaction_type").notNull(), // 'purchase', 'redemption', 'switch_in', 'switch_out', 'dividend'
  fundName: text("fund_name").notNull(),
  fundCode: varchar("fund_code"),
  folio: varchar("folio"),
  units: decimal("units", { precision: 15, scale: 6 }),
  nav: decimal("nav", { precision: 15, scale: 4 }),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  brokerage: decimal("brokerage", { precision: 15, scale: 2 }).default("0"),
  stt: decimal("stt", { precision: 15, scale: 2 }).default("0"),
  stampDuty: decimal("stamp_duty", { precision: 15, scale: 2 }).default("0"),
  gst: decimal("gst", { precision: 15, scale: 2 }).default("0"),
  tds: decimal("tds", { precision: 15, scale: 2 }).default("0"),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }),
  registrar: varchar("registrar"), // 'CAMS', 'KFINTECH', 'NSDL', 'CDSL'
  createdAt: timestamp("created_at").defaultNow(),
});

// TypeScript types for capital gains and transaction reports
export type CapitalGainsReport = typeof capitalGainsReports.$inferSelect;
export type InsertCapitalGainsReport = typeof capitalGainsReports.$inferInsert;
export type TransactionReport = typeof transactionReports.$inferSelect;
export type InsertTransactionReport = typeof transactionReports.$inferInsert;
export type TransactionRecord = typeof transactionRecords.$inferSelect;
export type InsertTransactionRecord = typeof transactionRecords.$inferInsert;

// Insert schemas for validation
export const insertCapitalGainsReportSchema = createInsertSchema(capitalGainsReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  generatedAt: true,
});

export const insertTransactionReportSchema = createInsertSchema(transactionReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  generatedAt: true,
});

export const insertTransactionRecordSchema = createInsertSchema(transactionRecords).omit({
  id: true,
  createdAt: true,
});

export const insertMarketStorySchema = createInsertSchema(marketStories).omit({
  id: true,
  generatedAt: true,
  createdAt: true,
});

export type MarketStory = typeof marketStories.$inferSelect;
export type InsertMarketStory = z.infer<typeof insertMarketStorySchema>;

// Government Scheme Consent Tracking
export const governmentSchemeConsents = pgTable("government_scheme_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  panNumber: varchar("pan_number").notNull(),
  schemeType: varchar("scheme_type").notNull(), // 'epf', 'ppf', 'eps', 'all'
  consentGranted: boolean("consent_granted").default(false),
  consentDate: timestamp("consent_date"),
  consentExpiryDate: timestamp("consent_expiry_date"),
  purpose: text("purpose"), // Purpose for accessing the data
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type GovernmentSchemeConsent = typeof governmentSchemeConsents.$inferSelect;
export type InsertGovernmentSchemeConsent = typeof governmentSchemeConsents.$inferInsert;

export const insertGovernmentSchemeConsentSchema = createInsertSchema(governmentSchemeConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// EPF Holdings types
export type EpfHolding = typeof epfHoldings.$inferSelect;
export type InsertEpfHolding = typeof epfHoldings.$inferInsert;

export const insertEpfHoldingSchema = createInsertSchema(epfHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
});

// PPF Holdings types
export type PpfHolding = typeof ppfHoldings.$inferSelect;
export type InsertPpfHolding = typeof ppfHoldings.$inferInsert;

export const insertPpfHoldingSchema = createInsertSchema(ppfHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
});

// EPS Holdings types
export type EpsHolding = typeof epsHoldings.$inferSelect;
export type InsertEpsHolding = typeof epsHoldings.$inferInsert;

export const insertEpsHoldingSchema = createInsertSchema(epsHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
});

// AIF Fund types
export type AifFund = typeof aifFunds.$inferSelect;
export type InsertAifFund = z.infer<typeof insertAifFundSchema>;

// Pre-IPO Companies table - stores information about companies preparing for IPO
export const preIpoCompanies = pgTable("pre_ipo_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  sector: varchar("sector").notNull(), // 'technology', 'healthcare', 'fintech', 'retail', etc.
  industry: varchar("industry").notNull(), // more specific industry classification
  foundedYear: integer("founded_year"),
  headquarters: varchar("headquarters"),
  website: varchar("website"),
  description: text("description"),
  businessModel: text("business_model"),
  keyProducts: text("key_products").array().default([]),
  
  // Valuation and Financial Info
  currentValuation: decimal("current_valuation", { precision: 20, scale: 2 }),
  lastRoundValuation: decimal("last_round_valuation", { precision: 20, scale: 2 }),
  lastRoundDate: timestamp("last_round_date"),
  totalFundingRaised: decimal("total_funding_raised", { precision: 20, scale: 2 }),
  revenue: decimal("revenue", { precision: 20, scale: 2 }),
  revenueGrowthRate: decimal("revenue_growth_rate", { precision: 5, scale: 2 }),
  profitability: varchar("profitability"), // 'profitable', 'break_even', 'loss_making'
  burnRate: decimal("burn_rate", { precision: 15, scale: 2 }),
  
  // Pre-IPO Status
  ipoStatus: varchar("ipo_status").notNull().default("preparation"), // 'preparation', 'filed', 'roadshow', 'priced', 'listed', 'withdrawn'
  expectedIpoDate: timestamp("expected_ipo_date"),
  expectedPriceRange: jsonb("expected_price_range"), // {min: number, max: number}
  proposedExchange: varchar("proposed_exchange"), // 'NSE', 'BSE', 'NASDAQ', 'NYSE'
  leadUnderwriters: text("lead_underwriters").array().default([]),
  
  // Company Metrics
  employees: integer("employees"),
  marketPosition: varchar("market_position"), // 'market_leader', 'strong_competitor', 'niche_player'
  competitiveAdvantage: text("competitive_advantage"),
  keyRisks: text("key_risks").array().default([]),
  keyOpportunities: text("key_opportunities").array().default([]),
  
  // Investment Metrics
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  investmentTier: varchar("investment_tier"), // 'tier_1', 'tier_2', 'tier_3' based on company quality
  riskRating: varchar("risk_rating"), // 'low', 'medium', 'high', 'very_high'
  expectedReturns: decimal("expected_returns", { precision: 5, scale: 2 }), // percentage
  lockInPeriod: integer("lock_in_period"), // months
  
  // Tracking and Status
  isAvailableForInvestment: boolean("is_available_for_investment").default(false),
  investmentDeadline: timestamp("investment_deadline"),
  totalInvestmentSlots: integer("total_investment_slots"),
  availableSlots: integer("available_slots"),
  
  // Metadata
  logoUrl: varchar("logo_url"),
  documents: jsonb("documents"), // links to pitch deck, financials, etc.
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pre-IPO Investments table - tracks user investments in pre-IPO companies
export const preIpoInvestments = pgTable("pre_ipo_investments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => preIpoCompanies.id).notNull(),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Investment Details
  investmentAmount: decimal("investment_amount", { precision: 15, scale: 2 }).notNull(),
  sharePrice: decimal("share_price", { precision: 15, scale: 4 }),
  sharesAllocated: decimal("shares_allocated", { precision: 15, scale: 4 }),
  investmentDate: timestamp("investment_date").defaultNow(),
  
  // Status and Tracking
  status: varchar("status").notNull().default("pending"), // 'pending', 'confirmed', 'allotted', 'listed', 'sold'
  allotmentStatus: varchar("allotment_status"), // 'pending', 'full', 'partial', 'rejected'
  allottedShares: decimal("allotted_shares", { precision: 15, scale: 4 }),
  allotmentDate: timestamp("allotment_date"),
  
  // Post-IPO Tracking
  listingDate: timestamp("listing_date"),
  listingPrice: decimal("listing_price", { precision: 15, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  unrealizedGains: decimal("unrealized_gains", { precision: 15, scale: 2 }),
  realizedGains: decimal("realized_gains", { precision: 15, scale: 2 }),
  
  // Performance Metrics
  roi: decimal("roi", { precision: 8, scale: 4 }), // return on investment percentage
  holdingPeriod: integer("holding_period"), // days
  isExited: boolean("is_exited").default(false),
  exitDate: timestamp("exit_date"),
  exitPrice: decimal("exit_price", { precision: 15, scale: 4 }),
  
  // Tracking
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pre-IPO Investment Analytics table - tracks performance and insights
export const preIpoAnalytics = pgTable("pre_ipo_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Portfolio Analytics
  totalInvestment: decimal("total_investment", { precision: 15, scale: 2 }).default("0"),
  totalCurrentValue: decimal("total_current_value", { precision: 15, scale: 2 }).default("0"),
  totalUnrealizedGains: decimal("total_unrealized_gains", { precision: 15, scale: 2 }).default("0"),
  totalRealizedGains: decimal("total_realized_gains", { precision: 15, scale: 2 }).default("0"),
  overallRoi: decimal("overall_roi", { precision: 8, scale: 4 }).default("0"),
  
  // Risk Metrics
  riskScore: decimal("risk_score", { precision: 3, scale: 1 }),
  diversificationScore: decimal("diversification_score", { precision: 3, scale: 1 }),
  sectorConcentration: jsonb("sector_concentration"), // sector-wise breakdown
  
  // Performance Tracking
  bestPerformer: varchar("best_performer"), // company ID
  worstPerformer: varchar("worst_performer"), // company ID
  averageHoldingPeriod: integer("average_holding_period"), // days
  successRate: decimal("success_rate", { precision: 5, scale: 2 }), // percentage of profitable investments
  
  // Insights and Recommendations
  aiInsights: text("ai_insights"),
  recommendations: text("recommendations").array().default([]),
  riskWarnings: text("risk_warnings").array().default([]),
  
  // Metadata
  lastAnalyzed: timestamp("last_analyzed").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pre-IPO Market Insights table - stores market analysis and trends
export const preIpoMarketInsights = pgTable("pre_ipo_market_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sector: varchar("sector").notNull(),
  
  // Market Trends
  averageValuation: decimal("average_valuation", { precision: 20, scale: 2 }),
  valuationTrend: varchar("valuation_trend"), // 'increasing', 'stable', 'decreasing'
  averageTimeToIpo: integer("average_time_to_ipo"), // months
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  averageIpoGains: decimal("average_ipo_gains", { precision: 8, scale: 4 }),
  
  // Market Analysis
  marketSentiment: varchar("market_sentiment"), // 'bullish', 'neutral', 'bearish'
  keyTrends: text("key_trends").array().default([]),
  upcomingIpos: integer("upcoming_ipos"), // count of companies expected to list
  hotSectors: text("hot_sectors").array().default([]),
  
  // AI Analysis
  aiAnalysis: text("ai_analysis"),
  investmentRecommendation: varchar("investment_recommendation"), // 'buy', 'hold', 'avoid'
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 1 }),
  
  // Metadata
  analysisDate: timestamp("analysis_date").defaultNow(),
  dataSource: varchar("data_source"), // 'internal', 'external_api', 'manual'
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Zod schemas for Pre-IPO
export const insertPreIpoCompanySchema = createInsertSchema(preIpoCompanies).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertPreIpoInvestmentSchema = createInsertSchema(preIpoInvestments).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertPreIpoAnalyticsSchema = createInsertSchema(preIpoAnalytics).omit({
  id: true,
  lastAnalyzed: true,
  createdAt: true,
});

export const insertPreIpoMarketInsightsSchema = createInsertSchema(preIpoMarketInsights).omit({
  id: true,
  analysisDate: true,
  lastUpdated: true,
});

// Export types for Pre-IPO
export type PreIpoCompany = typeof preIpoCompanies.$inferSelect;
export type InsertPreIpoCompany = z.infer<typeof insertPreIpoCompanySchema>;
export type PreIpoInvestment = typeof preIpoInvestments.$inferSelect;
export type InsertPreIpoInvestment = z.infer<typeof insertPreIpoInvestmentSchema>;
export type PreIpoAnalytics = typeof preIpoAnalytics.$inferSelect;
export type InsertPreIpoAnalytics = z.infer<typeof insertPreIpoAnalyticsSchema>;
export type PreIpoMarketInsights = typeof preIpoMarketInsights.$inferSelect;
export type InsertPreIpoMarketInsights = z.infer<typeof insertPreIpoMarketInsightsSchema>;

// Mainboard & SME IPO Companies table
export const ipoCompanies = pgTable("ipo_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  sector: varchar("sector").notNull(),
  industry: varchar("industry").notNull(),
  logoUrl: text("logo_url"),
  
  // IPO Details
  ipoType: varchar("ipo_type").notNull(), // 'mainboard', 'sme'
  issueType: varchar("issue_type"), // 'Book Built', 'Fixed Price', 'Offer for Sale'
  priceBandMin: decimal("price_band_min", { precision: 10, scale: 2 }),
  priceBandMax: decimal("price_band_max", { precision: 10, scale: 2 }),
  issueSize: decimal("issue_size", { precision: 15, scale: 2 }), // in crores
  
  // Important Dates
  openDate: date("open_date"),
  closeDate: date("close_date"),
  listingDate: date("listing_date"),
  
  // Status and Performance
  status: varchar("status").notNull().default("upcoming"), // 'upcoming', 'ongoing', 'listed', 'withdrawn'
  subscriptionStatus: decimal("subscription_status", { precision: 8, scale: 2 }), // times subscribed
  
  // Listing Performance (for listed IPOs)
  listingPrice: decimal("listing_price", { precision: 10, scale: 2 }),
  listingGainPercent: decimal("listing_gain_percent", { precision: 8, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
  currentReturnPercent: decimal("current_return_percent", { precision: 8, scale: 4 }),
  
  // Regulatory Documents
  rhpUrl: text("rhp_url"), // Red Herring Prospectus
  drhpUrl: text("drhp_url"), // Draft Red Herring Prospectus
  
  // Additional Information
  description: text("description"),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// IPO Applications table - tracks user applications
export const ipoApplications = pgTable("ipo_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ipoId: varchar("ipo_id").references(() => ipoCompanies.id).notNull(),
  
  // Application Details
  applicationAmount: decimal("application_amount", { precision: 15, scale: 2 }).notNull(),
  bidPrice: decimal("bid_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  category: varchar("category").notNull(), // 'Retail', 'HNI', 'QIB'
  
  // Status Tracking
  applicationStatus: varchar("application_status").notNull().default("applied"), // 'applied', 'confirmed', 'allotted', 'rejected'
  allotmentQuantity: integer("allotment_quantity"),
  allotmentAmount: decimal("allotment_amount", { precision: 15, scale: 2 }),
  
  // Dates
  applicationDate: timestamp("application_date").defaultNow(),
  allotmentDate: timestamp("allotment_date"),
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// IPO News table
export const ipoNews = pgTable("ipo_news", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary"),
  content: text("content"),
  category: varchar("category").notNull(), // 'filing', 'approval', 'listing', 'analysis'
  ipoId: varchar("ipo_id").references(() => ipoCompanies.id),
  sourceUrl: text("source_url"),
  publishedAt: timestamp("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for IPO
export const insertIpoCompanySchema = createInsertSchema(ipoCompanies).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertIpoApplicationSchema = createInsertSchema(ipoApplications).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertIpoNewsSchema = createInsertSchema(ipoNews).omit({
  id: true,
  createdAt: true,
});

// Export types for IPO
export type IpoCompany = typeof ipoCompanies.$inferSelect;
export type InsertIpoCompany = z.infer<typeof insertIpoCompanySchema>;
export type IpoApplication = typeof ipoApplications.$inferSelect;
export type InsertIpoApplication = z.infer<typeof insertIpoApplicationSchema>;
export type IpoNews = typeof ipoNews.$inferSelect;
export type InsertIpoNews = z.infer<typeof insertIpoNewsSchema>;


// Investment proposal types
export type InvestmentProposal = typeof investmentProposals.$inferSelect;
export type InsertInvestmentProposal = typeof investmentProposals.$inferInsert;
export type InvestmentProposalItem = typeof investmentProposalItems.$inferSelect;
export type InsertInvestmentProposalItem = typeof investmentProposalItems.$inferInsert;
export type ProposalPayment = typeof proposalPayments.$inferSelect;
export type InsertProposalPayment = typeof proposalPayments.$inferInsert;

// CKYC Progress Monitoring and Notification System
export const ckycNotificationTriggers = pgTable("ckyc_notification_triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  triggerType: varchar("trigger_type").notNull(), // 'status_change', 'document_required', 'verification_pending', 'manual_trigger'
  notificationMethod: varchar("notification_method").notNull(), // 'email', 'sms', 'both'
  recipientEmail: varchar("recipient_email"),
  recipientMobile: varchar("recipient_mobile"),
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status").default("pending"), // pending, sent, failed, cancelled
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  triggerredBy: varchar("triggerred_by"), // admin_id or agent_id who triggered
  metadata: jsonb("metadata"), // additional context like template variables
  createdAt: timestamp("created_at").defaultNow(),
});

// CKYC Progress Tracking
export const ckycProgressSteps = pgTable("ckyc_progress_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  stepName: varchar("step_name").notNull(), // 'application_received', 'documents_uploaded', 'verification_in_progress', 'approved', 'rejected'
  stepStatus: varchar("step_status").notNull(), // 'pending', 'in_progress', 'completed', 'failed'
  stepDescription: text("step_description"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"), // user_id, agent_id, or 'system'
  estimatedCompletionTime: integer("estimated_completion_time"), // in hours
  actualCompletionTime: integer("actual_completion_time"), // in hours from step start
  stepOrder: integer("step_order").notNull(), // order of steps (1, 2, 3...)
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin/Agent CKYC Actions Log
export const ckycActionLogs = pgTable("ckyc_action_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  actionType: varchar("action_type").notNull(), // 'trigger_notification', 'status_update', 'document_review', 'manual_verification'
  actionBy: varchar("action_by").notNull(), // admin_id or agent_id
  actionByType: varchar("action_by_type").notNull(), // 'admin' or 'agent'
  actionDetails: text("action_details").notNull(),
  previousValue: jsonb("previous_value"), // before state
  newValue: jsonb("new_value"), // after state
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  actionAt: timestamp("action_at").defaultNow(),
});

// Zod schemas for CKYC Progress Monitoring
export const insertCkycNotificationTriggerSchema = createInsertSchema(ckycNotificationTriggers).omit({
  id: true,
  createdAt: true,
});

export const insertCkycProgressStepSchema = createInsertSchema(ckycProgressSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCkycActionLogSchema = createInsertSchema(ckycActionLogs).omit({
  id: true,
  actionAt: true,
});

// Export types for CKYC Progress Monitoring
export type CkycNotificationTrigger = typeof ckycNotificationTriggers.$inferSelect;

// Interactive Brokers Zod schemas
export const insertIBAccountSchema = createInsertSchema(ibAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIBOrderSchema = createInsertSchema(ibOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIBPositionSchema = createInsertSchema(ibPositions).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertIBAccountSummarySchema = createInsertSchema(ibAccountSummary).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertIBMarketDataSubscriptionSchema = createInsertSchema(ibMarketDataSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIBTradingSessionSchema = createInsertSchema(ibTradingSessions).omit({
  id: true,
  createdAt: true,
});

// Export types for Interactive Brokers
export type IBAccount = typeof ibAccounts.$inferSelect;
export type InsertIBAccount = z.infer<typeof insertIBAccountSchema>;
export type IBOrder = typeof ibOrders.$inferSelect;
export type InsertIBOrder = z.infer<typeof insertIBOrderSchema>;
export type IBPosition = typeof ibPositions.$inferSelect;
export type InsertIBPosition = z.infer<typeof insertIBPositionSchema>;
export type IBAccountSummary = typeof ibAccountSummary.$inferSelect;
export type InsertIBAccountSummary = z.infer<typeof insertIBAccountSummarySchema>;
export type IBMarketDataSubscription = typeof ibMarketDataSubscriptions.$inferSelect;
export type InsertIBMarketDataSubscription = z.infer<typeof insertIBMarketDataSubscriptionSchema>;
export type IBTradingSession = typeof ibTradingSessions.$inferSelect;
export type InsertIBTradingSession = z.infer<typeof insertIBTradingSessionSchema>;
export type InsertCkycNotificationTrigger = z.infer<typeof insertCkycNotificationTriggerSchema>;
export type CkycProgressStep = typeof ckycProgressSteps.$inferSelect;
export type InsertCkycProgressStep = z.infer<typeof insertCkycProgressStepSchema>;
export type CkycActionLog = typeof ckycActionLogs.$inferSelect;
export type InsertCkycActionLog = z.infer<typeof insertCkycActionLogSchema>;

// Client-Agent relationship types
export type ClientAgentRelationship = typeof clientAgentRelationships.$inferSelect;
export type InsertClientAgentRelationship = typeof clientAgentRelationships.$inferInsert;

// Product Store Catalog Tables
export const storeCategories: any = pgTable("store_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  slug: varchar("slug").notNull().unique(),
  parentCategoryId: varchar("parent_category_id"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const storeProducts = pgTable("store_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  shortDescription: text("short_description"),
  fullDescription: text("full_description"),
  categoryId: varchar("category_id").references(() => storeCategories.id).notNull(),
  productType: varchar("product_type").notNull(), // 'mutual_fund', 'etf', 'bond', 'insurance', 'loan', 'advisory'
  price: decimal("price", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("INR"),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  lockInPeriod: integer("lock_in_period"), // in months
  riskLevel: varchar("risk_level"), // 'low', 'medium', 'high'
  expectedReturns: decimal("expected_returns", { precision: 5, scale: 2 }), // percentage
  features: jsonb("features"), // array of key features
  eligibility: jsonb("eligibility"), // eligibility criteria
  documents: jsonb("documents"), // required documents
  provider: varchar("provider"), // AMC/Bank/Insurance company name
  providerCode: varchar("provider_code"), // internal provider code
  regulatory: jsonb("regulatory"), // regulatory information like NAV, fund manager, etc.
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  displayOrder: integer("display_order").default(0),
  launchDate: date("launch_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const storeProductImages = pgTable("store_product_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => storeProducts.id).notNull(),
  imageUrl: varchar("image_url").notNull(),
  altText: varchar("alt_text"),
  isPrimary: boolean("is_primary").default(false),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const storeProductTags = pgTable("store_product_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  slug: varchar("slug").notNull().unique(),
  color: varchar("color").default("#3B82F6"), // hex color for display
  createdAt: timestamp("created_at").defaultNow(),
});

export const storeProductTagMappings = pgTable("store_product_tag_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => storeProducts.id).notNull(),
  tagId: varchar("tag_id").references(() => storeProductTags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userWishlist = pgTable("user_wishlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => storeProducts.id).notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

// User Cart Tables
export const userCart = pgTable("user_cart", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userCartItems = pgTable("user_cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cartId: varchar("cart_id").references(() => userCart.id).notNull(),
  productId: varchar("product_id").references(() => storeProducts.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  investmentAmount: decimal("investment_amount", { precision: 15, scale: 2 }),
  addedAt: timestamp("added_at").defaultNow(),
});

// Product Store Zod schemas
export const insertStoreCategorySchema = createInsertSchema(storeCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreProductSchema = createInsertSchema(storeProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreProductImageSchema = createInsertSchema(storeProductImages).omit({
  id: true,
  createdAt: true,
});

export const insertStoreProductTagSchema = createInsertSchema(storeProductTags).omit({
  id: true,
  createdAt: true,
});

export const insertStoreProductTagMappingSchema = createInsertSchema(storeProductTagMappings).omit({
  id: true,
  createdAt: true,
});

export const insertUserWishlistSchema = createInsertSchema(userWishlist).omit({
  id: true,
  addedAt: true,
});

export const insertUserCartSchema = createInsertSchema(userCart).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserCartItemSchema = createInsertSchema(userCartItems).omit({
  id: true,
  addedAt: true,
});

// Export types for Product Store
export type StoreCategory = typeof storeCategories.$inferSelect;
export type InsertStoreCategory = z.infer<typeof insertStoreCategorySchema>;
export type StoreProduct = typeof storeProducts.$inferSelect;
export type InsertStoreProduct = z.infer<typeof insertStoreProductSchema>;
export type StoreProductImage = typeof storeProductImages.$inferSelect;
export type InsertStoreProductImage = z.infer<typeof insertStoreProductImageSchema>;
export type StoreProductTag = typeof storeProductTags.$inferSelect;
export type InsertStoreProductTag = z.infer<typeof insertStoreProductTagSchema>;
export type StoreProductTagMapping = typeof storeProductTagMappings.$inferSelect;
export type InsertStoreProductTagMapping = z.infer<typeof insertStoreProductTagMappingSchema>;
export type UserWishlist = typeof userWishlist.$inferSelect;
export type InsertUserWishlist = z.infer<typeof insertUserWishlistSchema>;
export type UserCart = typeof userCart.$inferSelect;
export type InsertUserCart = z.infer<typeof insertUserCartSchema>;
export type UserCartItem = typeof userCartItems.$inferSelect;
export type InsertUserCartItem = z.infer<typeof insertUserCartItemSchema>;

// Supplier and Product Performance Tables
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  address: text("address"),
  productCategories: text("product_categories").array(),
  performanceRating: decimal("performance_rating", { precision: 3, scale: 2 }).default("0.00"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("0.00"), // Commission percentage
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productPerformance = pgTable("product_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => storeProducts.id).notNull(),
  supplierId: varchar("supplier_id").references(() => suppliers.id).notNull(),
  costPrice: decimal("cost_price", { precision: 15, scale: 2 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 15, scale: 2 }).notNull(),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).notNull(), // Calculated profit percentage
  salesVolume: integer("sales_volume").default(0),
  revenue: decimal("revenue", { precision: 15, scale: 2 }).default("0.00"),
  monthlyPerformance: jsonb("monthly_performance"), // Track monthly sales/profit data
  lastSaleDate: timestamp("last_sale_date"),
  isPromoted: boolean("is_promoted").default(false),
  promotionStartDate: timestamp("promotion_start_date"),
  promotionEndDate: timestamp("promotion_end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create schemas for supplier tables
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductPerformanceSchema = createInsertSchema(productPerformance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Loan Against Securities (LAS) table
export const loanApplications = pgTable("loan_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  
  // Loan Details
  requestedAmount: decimal("requested_amount", { precision: 15, scale: 2 }).notNull(),
  approvedAmount: decimal("approved_amount", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }), // Annual percentage
  tenure: integer("tenure"), // Loan duration in months
  loanToValue: decimal("loan_to_value", { precision: 5, scale: 2 }), // LTV ratio as percentage
  
  // Collateral Information
  collateralValue: decimal("collateral_value", { precision: 15, scale: 2 }).notNull(),
  collateralAssets: jsonb("collateral_assets").notNull(), // Array of pledged securities
  marginRequirement: decimal("margin_requirement", { precision: 5, scale: 2 }), // Margin percentage
  
  // Application Status and Processing
  status: varchar("status").default("pending"), // pending/approved/rejected/disbursed/closed
  applicationNumber: varchar("application_number").unique(),
  applicationDate: timestamp("application_date").defaultNow(),
  approvalDate: timestamp("approval_date"),
  disbursalDate: timestamp("disbursal_date"),
  closureDate: timestamp("closure_date"),
  
  // Risk Assessment
  riskScore: integer("risk_score"), // 0-100 risk assessment
  eligibilityScore: decimal("eligibility_score", { precision: 5, scale: 2 }),
  creditScore: integer("credit_score"), // CIBIL/Experian score
  
  // Loan Terms
  processingFee: decimal("processing_fee", { precision: 15, scale: 2 }),
  legalCharges: decimal("legal_charges", { precision: 15, scale: 2 }),
  isOverdraftFacility: boolean("is_overdraft_facility").default(false),
  preClosurePenalty: decimal("pre_closure_penalty", { precision: 5, scale: 2 }).default("0"),
  
  // Approval Information
  approvedBy: varchar("approved_by"), // User ID of approver
  rejectionReason: text("rejection_reason"),
  
  // Tracking and Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loan Repayments table for tracking payment history
export const loanRepayments = pgTable("loan_repayments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // Payment Details
  paymentAmount: decimal("payment_amount", { precision: 15, scale: 2 }).notNull(),
  principalAmount: decimal("principal_amount", { precision: 15, scale: 2 }),
  interestAmount: decimal("interest_amount", { precision: 15, scale: 2 }),
  penaltyAmount: decimal("penalty_amount", { precision: 15, scale: 2 }).default("0"),
  
  // Payment Information
  paymentDate: timestamp("payment_date").defaultNow(),
  dueDate: timestamp("due_date"),
  paymentMethod: varchar("payment_method"), // bank_transfer/upi/net_banking/auto_debit
  transactionId: varchar("transaction_id"),
  paymentStatus: varchar("payment_status").default("completed"), // pending/completed/failed
  
  // Balance Information
  outstandingPrincipal: decimal("outstanding_principal", { precision: 15, scale: 2 }),
  outstandingInterest: decimal("outstanding_interest", { precision: 15, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Collateral Valuation table for tracking security values
export const collateralValuations = pgTable("collateral_valuations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // Valuation Details
  valuationDate: timestamp("valuation_date").defaultNow(),
  totalCollateralValue: decimal("total_collateral_value", { precision: 15, scale: 2 }).notNull(),
  eligibleCollateralValue: decimal("eligible_collateral_value", { precision: 15, scale: 2 }).notNull(),
  haircut: decimal("haircut", { precision: 5, scale: 2 }), // Discount percentage applied
  
  // Margin and LTV
  currentLtv: decimal("current_ltv", { precision: 5, scale: 2 }),
  maxAllowedLtv: decimal("max_allowed_ltv", { precision: 5, scale: 2 }),
  marginCall: boolean("margin_call").default(false),
  marginCallDate: timestamp("margin_call_date"),
  
  // Valuation Status
  valuationMethod: varchar("valuation_method"), // market_price/model_based/manual
  valuedBy: varchar("valued_by"), // system/manual/third_party
  
  // Asset Breakdown
  assetBreakdown: jsonb("asset_breakdown"), // Detailed asset-wise valuation
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Create insert schemas for loan tables
export const insertLoanApplicationSchema = createInsertSchema(loanApplications).omit({
  id: true,
  applicationNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanRepaymentSchema = createInsertSchema(loanRepayments).omit({
  id: true,
  createdAt: true,
});

export const insertCollateralValuationSchema = createInsertSchema(collateralValuations).omit({
  id: true,
  createdAt: true,
});

// Export types for supplier tables
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type ProductPerformance = typeof productPerformance.$inferSelect;
export type InsertProductPerformance = z.infer<typeof insertProductPerformanceSchema>;

// Export types for loan tables
// Insurance Holdings table for NSDL/CDSL insurance policy data
export const insuranceHoldings = pgTable("insurance_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Policy Information
  policyNumber: varchar("policy_number").notNull(),
  policyName: varchar("policy_name").notNull(),
  insuranceCompany: varchar("insurance_company").notNull(),
  policyType: varchar("policy_type").notNull(), // life, health, motor, general
  category: varchar("category").notNull(), // traditional, ulip, term, health, motor
  
  // Coverage and Premium Details
  sumAssured: decimal("sum_assured", { precision: 15, scale: 2 }).notNull(),
  premiumAmount: decimal("premium_amount", { precision: 15, scale: 2 }).notNull(),
  premiumFrequency: varchar("premium_frequency").default("yearly"), // monthly, quarterly, half_yearly, yearly
  fundValue: decimal("fund_value", { precision: 15, scale: 2 }), // For ULIP policies
  
  // Policy Dates
  policyStartDate: date("policy_start_date").notNull(),
  policyMaturityDate: date("policy_maturity_date"),
  premiumDueDate: date("premium_due_date"),
  lastPremiumPaidDate: date("last_premium_paid_date"),
  
  // Depository Information
  depositoryName: varchar("depository_name").notNull(), // NSDL or CDSL
  depositoryAccountNumber: varchar("depository_account_number"),
  isinNumber: varchar("isin_number"),
  
  // Policy Status
  policyStatus: varchar("policy_status").default("active"), // active, lapsed, matured, surrendered
  paidUpValue: decimal("paid_up_value", { precision: 15, scale: 2 }),
  surrenderValue: decimal("surrender_value", { precision: 15, scale: 2 }),
  
  // Nominee Information
  nomineeDetails: text("nominee_details"),
  nomineeRelation: varchar("nominee_relation"),
  
  // Additional Metadata
  agentCode: varchar("agent_code"),
  branchCode: varchar("branch_code"),
  servicing_branch: varchar("servicing_branch"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create insert schema for insurance holdings
export const insertInsuranceHoldingSchema = createInsertSchema(insuranceHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoanApplication = typeof loanApplications.$inferSelect;
export type InsertLoanApplication = z.infer<typeof insertLoanApplicationSchema>;
export type LoanRepayment = typeof loanRepayments.$inferSelect;
export type InsertLoanRepayment = z.infer<typeof insertLoanRepaymentSchema>;
export type CollateralValuation = typeof collateralValuations.$inferSelect;
export type InsertCollateralValuation = z.infer<typeof insertCollateralValuationSchema>;
export type InsuranceHolding = typeof insuranceHoldings.$inferSelect;
export type InsertInsuranceHolding = z.infer<typeof insertInsuranceHoldingSchema>;

// Financial Goals types and schema
export const insertFinancialGoalSchema = createInsertSchema(financialGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FinancialGoal = typeof financialGoals.$inferSelect;
export type InsertFinancialGoal = z.infer<typeof insertFinancialGoalSchema>;

// Zoho Commerce Integration Tables
export const zohoCommerceConfig = pgTable("zoho_commerce_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").notNull(),
  clientSecret: varchar("client_secret").notNull(),
  redirectUri: varchar("redirect_uri").notNull(),
  baseUrl: varchar("base_url").notNull(), // e.g., 'https://commerce.zoho.com'
  scope: jsonb("scope").notNull(), // array of scopes
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoCategories = pgTable("zoho_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  zohoCategoryId: varchar("zoho_category_id"), // ID from Zoho Commerce
  localCategoryId: varchar("local_category_id").references(() => storeCategories.id),
  name: varchar("name").notNull(),
  description: text("description"),
  parentId: varchar("parent_id").references((): any => zohoCategories.id),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  seoTitle: varchar("seo_title"),
  seoDescription: text("seo_description"),
  imageUrl: varchar("image_url"),
  syncStatus: varchar("sync_status").default('pending'),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoProducts = pgTable("zoho_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  zohoProductId: varchar("zoho_product_id"), // ID from Zoho Commerce
  localProductId: varchar("local_product_id").references(() => storeProducts.id),
  name: varchar("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  comparePrice: decimal("compare_price", { precision: 10, scale: 2 }),
  sku: varchar("sku"),
  weight: decimal("weight", { precision: 8, scale: 2 }),
  weightUnit: varchar("weight_unit").default('kg'),
  trackQuantity: boolean("track_quantity").default(true),
  quantity: integer("quantity").default(0),
  categoryId: varchar("category_id").references(() => zohoCategories.id),
  brand: varchar("brand"),
  tags: jsonb("tags"), // array of tags
  images: jsonb("images"), // array of image objects
  variants: jsonb("variants"), // array of variant objects
  seoTitle: varchar("seo_title"),
  seoDescription: text("seo_description"),
  status: varchar("status").default('active'), // active, inactive, draft
  syncStatus: varchar("sync_status").default('pending'), // pending, synced, error
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoOrders = pgTable("zoho_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  zohoOrderId: varchar("zoho_order_id"), // ID from Zoho Commerce
  orderNumber: varchar("order_number"),
  customerId: varchar("customer_id"),
  customerEmail: varchar("customer_email"),
  billingAddress: jsonb("billing_address"),
  shippingAddress: jsonb("shipping_address"),
  lineItems: jsonb("line_items"), // array of line items
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  totalTax: decimal("total_tax", { precision: 10, scale: 2 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  currency: varchar("currency").default('INR'),
  orderStatus: varchar("order_status").default('pending'), // pending, confirmed, shipped, delivered, cancelled
  paymentStatus: varchar("payment_status").default('pending'), // pending, paid, failed, refunded
  fulfillmentStatus: varchar("fulfillment_status").default('unfulfilled'), // unfulfilled, partial, fulfilled
  notes: text("notes"),
  syncStatus: varchar("sync_status").default('pending'),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoCustomers = pgTable("zoho_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  zohoCustomerId: varchar("zoho_customer_id"), // ID from Zoho Commerce
  localUserId: varchar("local_user_id").references(() => users.id),
  email: varchar("email").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  addresses: jsonb("addresses"), // array of address objects
  orderCount: integer("order_count").default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default('0.00'),
  lastOrderDate: timestamp("last_order_date"),
  acceptsMarketing: boolean("accepts_marketing").default(false),
  syncStatus: varchar("sync_status").default('pending'),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoInventory = pgTable("zoho_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => zohoProducts.id).notNull(),
  variantId: varchar("variant_id"), // Zoho variant ID
  sku: varchar("sku"),
  quantity: integer("quantity").default(0),
  reservedQuantity: integer("reserved_quantity").default(0),
  availableQuantity: integer("available_quantity").default(0),
  reorderLevel: integer("reorder_level").default(0),
  reorderQuantity: integer("reorder_quantity").default(0),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  location: varchar("location"),
  syncStatus: varchar("sync_status").default('pending'),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoWebhooks = pgTable("zoho_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  zohoWebhookId: varchar("zoho_webhook_id"), // ID from Zoho Commerce
  eventType: varchar("event_type").notNull(), // order.created, product.updated, etc.
  targetUrl: varchar("target_url").notNull(),
  isActive: boolean("is_active").default(true),
  secretKey: varchar("secret_key"), // for webhook verification
  lastTriggered: timestamp("last_triggered"),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoSyncLogs = pgTable("zoho_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  syncType: varchar("sync_type").notNull(), // products, orders, customers, inventory
  status: varchar("status").notNull(), // success, error, warning
  recordsProcessed: integer("records_processed").default(0),
  recordsSuccess: integer("records_success").default(0),
  recordsError: integer("records_error").default(0),
  errorDetails: jsonb("error_details"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // in milliseconds
});

// Zoho Commerce insert schemas
export const insertZohoCommerceConfigSchema = createInsertSchema(zohoCommerceConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoCategorySchema = createInsertSchema(zohoCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoProductSchema = createInsertSchema(zohoProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoOrderSchema = createInsertSchema(zohoOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoCustomerSchema = createInsertSchema(zohoCustomers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoInventorySchema = createInsertSchema(zohoInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoWebhookSchema = createInsertSchema(zohoWebhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoSyncLogSchema = createInsertSchema(zohoSyncLogs).omit({
  id: true,
  startedAt: true,
});

// Zoho Commerce types
export type ZohoCommerceConfig = typeof zohoCommerceConfig.$inferSelect;
export type InsertZohoCommerceConfig = z.infer<typeof insertZohoCommerceConfigSchema>;
export type ZohoCategory = typeof zohoCategories.$inferSelect;
export type InsertZohoCategory = z.infer<typeof insertZohoCategorySchema>;
export type ZohoProduct = typeof zohoProducts.$inferSelect;
export type InsertZohoProduct = z.infer<typeof insertZohoProductSchema>;
export type ZohoOrder = typeof zohoOrders.$inferSelect;
export type InsertZohoOrder = z.infer<typeof insertZohoOrderSchema>;
export type ZohoCustomer = typeof zohoCustomers.$inferSelect;
export type InsertZohoCustomer = z.infer<typeof insertZohoCustomerSchema>;
export type ZohoInventory = typeof zohoInventory.$inferSelect;
export type InsertZohoInventory = z.infer<typeof insertZohoInventorySchema>;
export type ZohoWebhook = typeof zohoWebhooks.$inferSelect;
export type InsertZohoWebhook = z.infer<typeof insertZohoWebhookSchema>;
export type ZohoSyncLog = typeof zohoSyncLogs.$inferSelect;
export type InsertZohoSyncLog = z.infer<typeof insertZohoSyncLogSchema>;
