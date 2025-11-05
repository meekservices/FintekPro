import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, index, integer, date, bigint, numeric } from "drizzle-orm/pg-core";
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
  
  // Client Type and Status
  clientType: varchar("client_type").default("individual"), // individual/non_individual
  entityType: varchar("entity_type"), // For non-individual: company/partnership/trust/society/huf/llp
  
  // Individual Personal Details
  firstName: varchar("first_name"),
  middleName: varchar("middle_name"),
  lastName: varchar("last_name"),
  gender: varchar("gender"),
  
  // Non-Individual Entity Details  
  companyName: varchar("company_name"),
  entityRegistrationNumber: varchar("entity_registration_number"),
  incorporationDate: date("incorporation_date"),
  businessNature: varchar("business_nature"),
  companyPanNumber: varchar("company_pan_number"),
  
  // Authorized Persons for Non-Individual (JSON array)
  authorizedPersons: jsonb("authorized_persons").default([]),
  boardOfDirectors: jsonb("board_of_directors").default([]),
  beneficialOwners: jsonb("beneficial_owners").default([]),
  
  // Comprehensive Residency Status
  residentStatus: varchar("resident_status").default("resident_indian"), // resident_indian/nri_ordinary/nri_non_ordinary/oci/pio/foreign_national
  nriSubType: varchar("nri_sub_type"), // us/canada/australia/uk/singapore/uae/other
  countryOfResidence: varchar("country_of_residence").default("India"),
  countryOfCitizenship: varchar("country_of_citizenship").default("India"),
  passportCountry: varchar("passport_country"),
  visaType: varchar("visa_type"), // for foreign nationals
  permanentResidenceStatus: varchar("permanent_residence_status"), // green_card/pr_card/other
  
  // NRI Specific Information
  nriExchangeRate: varchar("nri_exchange_rate"), // currency conversion preferences
  nriRepatriationType: varchar("nri_repatriation_type"), // repatriable/non_repatriable
  overseasBankDetails: jsonb("overseas_bank_details"), // foreign bank account details
  localGuardianDetails: text("local_guardian_details"), // for minors/specific cases
  
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
  
  // Legacy fields (kept for compatibility)
  visaStatus: varchar("visa_status"), // for non-residents - legacy field
  
  // AML (Anti-Money Laundering) Status
  amlStatus: varchar("aml_status").default("clear"), // clear/flagged/under_review
  amlLastChecked: timestamp("aml_last_checked"),
  amlRiskScore: integer("aml_risk_score").default(0), // 0-100
  sanctionListStatus: varchar("sanction_list_status").default("clear"), // clear/flagged
  sanctionListLastChecked: timestamp("sanction_list_last_checked"),
  
  // CDD/EDD (Customer Due Diligence / Enhanced Due Diligence) - 2025 Enhanced
  cddLevel: varchar("cdd_level").default("simplified"), // simplified/basic/enhanced
  eddRequired: boolean("edd_required").default(false), // Enhanced Due Diligence
  eddReason: text("edd_reason"), // Reason why EDD was triggered
  eddCompletedDate: timestamp("edd_completed_date"),
  eddNextReviewDate: timestamp("edd_next_review_date"),
  eddCompletedBy: varchar("edd_completed_by"), // Compliance officer who completed EDD
  sourceOfFunds: varchar("source_of_funds"), // employment/business/inheritance/gift/investment
  sourceOfWealthDocumentation: text("source_of_wealth_documentation"),
  sourceOfWealthVerified: boolean("source_of_wealth_verified").default(false),
  sourceOfWealthVerificationDate: timestamp("source_of_wealth_verification_date"),
  
  // Enhanced Risk Assessment (2025 Compliance Requirements)
  riskCategory: varchar("risk_category").default("low"), // low/medium/high
  riskCategoryReason: text("risk_category_reason"), // Detailed reason for risk categorization
  riskLastAssessed: timestamp("risk_last_assessed").defaultNow(),
  riskNextReview: timestamp("risk_next_review"), // Auto-calculated based on risk (Low: 10 years, Medium: 8 years, High: 2 years)
  riskReviewFrequency: varchar("risk_review_frequency").default("10_years"), // 2_years/8_years/10_years
  isHighRiskCustomer: boolean("is_high_risk_customer").default(false),
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
  
  // Video KYC (V-CIP) - 2025 Regulatory Requirement
  videoKycCompleted: boolean("video_kyc_completed").default(false),
  videoKycCompletedDate: timestamp("video_kyc_completed_date"),
  videoKycProvider: varchar("video_kyc_provider"), // digilocker/videosign/other
  videoKycSessionId: varchar("video_kyc_session_id"), // Unique session identifier
  videoKycStatus: varchar("video_kyc_status").default("pending"), // pending/completed/failed/expired
  videoKycExpiryDate: timestamp("video_kyc_expiry_date"),
  videoKycTechnicianId: varchar("video_kyc_technician_id"), // ID of person who conducted V-KYC
  isVideoKycEquivalentToFaceToFace: boolean("is_video_kyc_equivalent_to_face_to_face").default(true), // As per 2025 RBI guidelines
  
  // KYC Onboarding Method Tracking - 2025 Compliance
  kycOnboardingMethod: varchar("kyc_onboarding_method").default("non_face_to_face"), // face_to_face/video_kyc/non_face_to_face
  requiresEnhancedDueDiligence: boolean("requires_enhanced_due_diligence").default(true), // Default true for non-face-to-face
  faceToFaceVerificationRequired: boolean("face_to_face_verification_required").default(false),
  faceToFaceVerificationCompleted: boolean("face_to_face_verification_completed").default(false),
  faceToFaceVerificationDate: timestamp("face_to_face_verification_date"),
  
  // Enhanced UBO (Ultimate Beneficial Owner) - 2025 Requirements
  uboDeclarationCompleted: boolean("ubo_declaration_completed").default(false),
  uboDetails: jsonb("ubo_details").default([]), // Array of UBO information for entities
  uboVerificationStatus: varchar("ubo_verification_status").default("pending"), // pending/verified/under_review
  uboLastUpdated: timestamp("ubo_last_updated"),
  uboNextReviewDate: timestamp("ubo_next_review_date"),
  
  // Periodic Update Tracking - 2025 Risk-Based Approach
  kycUpdateDueDate: timestamp("kyc_update_due_date"),
  kycUpdateRemindersSent: integer("kyc_update_reminders_sent").default(0),
  kycLastUpdatedDate: timestamp("kyc_last_updated_date").defaultNow(),
  kycUpdateMethod: varchar("kyc_update_method"), // self_service/agent_assisted/branch
  kycUpdateNotificationPreference: varchar("kyc_update_notification_preference").default("email"), // email/sms/whatsapp/all
  
  // Business Correspondent (BC) Assistance - 2025 RBI Amendment
  bcAssistedKyc: boolean("bc_assisted_kyc").default(false),
  bcId: varchar("bc_id"), // Business Correspondent ID who assisted
  bcName: varchar("bc_name"), // Business Correspondent name
  bcAssistedDate: timestamp("bc_assisted_date"),
  
  // Tiered KYC System - Progressive Product Access
  kycTier: varchar("kyc_tier").default("basic"), // basic/enhanced/accredited_investor
  kycTierUpgradedAt: timestamp("kyc_tier_upgraded_at"),
  kycTierUpgradeRequestedAt: timestamp("kyc_tier_upgrade_requested_at"),
  
  // Accredited Investor Verification (Tier 3)
  accreditedInvestorStatus: varchar("accredited_investor_status").default("not_applicable"), // not_applicable/pending/verified/rejected
  accreditedInvestorType: varchar("accredited_investor_type"), // income_based/networth_based/portfolio_based/professional
  accreditedInvestorVerifiedAt: timestamp("accredited_investor_verified_at"),
  accreditedInvestorVerifiedBy: varchar("accredited_investor_verified_by"), // compliance officer
  accreditedInvestorExpiryDate: timestamp("accredited_investor_expiry_date"), // Annual renewal required
  
  // Financial Metrics for Accredited Investor Qualification
  annualIncomeAmount: decimal("annual_income_amount", { precision: 15, scale: 2 }), // Actual income amount for ₹2Cr threshold
  annualIncomeCurrency: varchar("annual_income_currency").default("INR"),
  netWorthAmount: decimal("net_worth_amount", { precision: 15, scale: 2 }), // Actual net worth for ₹7.5Cr threshold
  netWorthExcludingResidence: decimal("net_worth_excluding_residence", { precision: 15, scale: 2 }),
  netWorthCurrency: varchar("net_worth_currency").default("INR"),
  portfolioValueAmount: decimal("portfolio_value_amount", { precision: 15, scale: 2 }), // Securities portfolio for ₹5Cr threshold
  portfolioValueCurrency: varchar("portfolio_value_currency").default("INR"),
  
  // Professional Qualification for Accredited Status
  professionalQualification: varchar("professional_qualification"), // CA/CFA/MBA_Finance/CPA/FRM
  professionalQualificationNumber: varchar("professional_qualification_number"), // Certificate/License number
  professionalQualificationVerified: boolean("professional_qualification_verified").default(false),
  professionalExperienceYears: integer("professional_experience_years"),
  
  // Accredited Investor Documentation
  caCertificateUrl: varchar("ca_certificate_url"), // CA certificate for net worth verification
  caCertificateVerifiedAt: timestamp("ca_certificate_verified_at"),
  caCertificateName: varchar("ca_certificate_name"), // Name of CA who certified
  incomeProofDocuments: jsonb("income_proof_documents").default([]), // Array of income proof URLs
  netWorthStatementUrl: varchar("net_worth_statement_url"),
  portfolioStatementUrl: varchar("portfolio_statement_url"),
  accreditedInvestorRejectionReason: text("accredited_investor_rejection_reason"),
  
  // Product Access Permissions (auto-calculated based on KYC tier)
  productsUnlocked: jsonb("products_unlocked").default([]), // Array of unlocked product codes
  productsAccessMatrix: jsonb("products_access_matrix").default({}), // Detailed access permissions
  lastProductAccessUpdate: timestamp("last_product_access_update").defaultNow(),
  
  // Audit and Tracking
  profileCompleteness: integer("profile_completeness").default(0), // 0-100%
  isProfileCompleted: boolean("is_profile_completed").default(false), // Mandatory KYC profile completion
  profileCompletedAt: timestamp("profile_completed_at"), // When mandatory profile was completed
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Bank Accounts table - Multiple bank accounts per user (max 5)
export const userBankAccounts = pgTable("user_bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Bank Details
  bankName: varchar("bank_name").notNull(),
  accountNumber: varchar("account_number").notNull(),
  ifscCode: varchar("ifsc_code").notNull(),
  branchName: varchar("branch_name"),
  accountType: varchar("account_type").default("savings"), // savings/current/nro/nre/fcnr
  accountHolderName: varchar("account_holder_name"),
  
  // Default Usage Flags
  isDefaultForMutualFunds: boolean("is_default_for_mutual_funds").default(false),
  
  // Status and Verification
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  verificationStatus: varchar("verification_status").default("pending"), // pending/verified/failed
  verificationDate: timestamp("verification_date"),
  
  // Penny Drop Verification
  pennyDropTransactionId: varchar("penny_drop_transaction_id"), // Sandbox API transaction ID
  pennyDropAmount: decimal("penny_drop_amount", { precision: 10, scale: 2 }), // Amount deposited (typically 1.00)
  nameMatchScore: integer("name_match_score"), // Fuzzy match percentage (0-100)
  bankAccountStatus: varchar("bank_account_status"), // active/inactive/dormant from bank
  verificationMethod: varchar("verification_method").default("pending"), // penny_drop/manual/reverse_penny_drop/pending
  verificationAttempts: integer("verification_attempts").default(0), // Number of verification attempts
  lastVerificationAttempt: timestamp("last_verification_attempt"), // Last attempt timestamp
  providerResponse: jsonb("provider_response"), // Full API response for audit trail
  verifiedAccountHolderName: varchar("verified_account_holder_name"), // Name returned by bank
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Demat Accounts table - Separate demat accounts per user (max 3)
export const userDematAccounts = pgTable("user_demat_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Demat Account Details
  dematAccountNumber: varchar("demat_account_number").notNull(),
  dematDpId: varchar("demat_dp_id").notNull(), // 8-digit DP ID
  dematDpName: varchar("demat_dp_name").notNull(), // Depository Participant name
  depositoryType: varchar("depository_type").notNull(), // NSDL/CDSL
  accountHolderName: varchar("account_holder_name").notNull(),
  
  // For NSDL
  nsdlClientId: varchar("nsdl_client_id"), // 16-digit client ID
  
  // For CDSL
  cdslBoId: varchar("cdsl_bo_id"), // 16-digit Beneficial Owner ID
  
  // Additional Trading Information
  tradingAccountNumber: varchar("trading_account_number"),
  brokerName: varchar("broker_name"),
  panNumber: varchar("pan_number"), // Linked PAN for verification
  
  // Default Usage Flags
  isDefaultForEquityTransactions: boolean("is_default_for_equity_transactions").default(false),
  isDefaultForMutualFundTransactions: boolean("is_default_for_mutual_fund_transactions").default(false),
  
  // Status and Verification
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  verificationStatus: varchar("verification_status").default("pending"), // pending/verified/failed
  verificationDate: timestamp("verification_date"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product-specific account preferences - which bank/demat account to use for each product type
export const productAccountPreferences = pgTable("product_account_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Product type this preference applies to
  productType: varchar("product_type").notNull(), // 'mutual_fund', 'ipo', 'bond', 'equity', 'aif', 'pms', 'unlisted_share', 'fd', 'loan'
  
  // Linked accounts
  bankAccountId: varchar("bank_account_id").references(() => userBankAccounts.id), // For payment
  dematAccountId: varchar("demat_account_id").references(() => userDematAccounts.id), // For holdings
  
  // Preference details
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false), // If true, this is the default for this product type
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table with mobile/email authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").unique().notNull(), // System-generated unique user ID for login (e.g., FTP001234)
  email: varchar("email"), // Family members can share email per regulatory requirements
  mobile: varchar("mobile"), // Family members can share mobile per regulatory requirements
  password: text("password").notNull(),
  firstName: varchar("first_name"),
  middleName: varchar("middle_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isEmailVerified: boolean("is_email_verified").default(false),
  isMobileVerified: boolean("is_mobile_verified").default(false),
  
  // Enhanced KYC Fields
  panNumber: varchar("pan_number").unique(),
  aadharNumber: varchar("aadhar_number").unique(),
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
  
  // Demat Account Information
  nsdlDpId: varchar("nsdl_dp_id"), // NSDL Depository Participant ID (8-digit)
  nsdlClientId: varchar("nsdl_client_id"), // NSDL Client ID (8-digit)
  cdslBoId: varchar("cdsl_bo_id"), // CDSL Beneficial Owner ID (16-digit)
  cdslDpId: varchar("cdsl_dp_id"), // CDSL Depository Participant ID (8-digit)

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
  
  // Agent and Distributor Information
  agentId: varchar("agent_id"),
  arnCode: varchar("arn_code"), // ARN (AMFI Registration Number) for mutual fund distributors
  distributorId: varchar("distributor_id"), // Distributor ID for various platforms
  complianceOfficer: varchar("compliance_officer"), // Assigned compliance officer ID
  
  // Business/Entity Information (for corporate clients)
  clientType: varchar("client_type"), // individual/corporate/institutional
  companyName: varchar("company_name"),
  entityType: varchar("entity_type"), // individual/company/partnership/trust/huf etc
  entityRegistrationNumber: varchar("entity_registration_number"), // CIN/registration number
  incorporationDate: varchar("incorporation_date"),
  businessNature: varchar("business_nature"), // Type/nature of business
  countryOfCitizenship: varchar("country_of_citizenship"),
  
  // Regulatory Compliance Flags
  isUSPerson: boolean("is_us_person").default(false), // US Person status for tax compliance
  isEUResident: boolean("is_eu_resident").default(false), // EU Resident status for GDPR
  gdprConsent: boolean("gdpr_consent").default(false),
  gdprConsentDate: timestamp("gdpr_consent_date"),
  dataProcessingConsent: boolean("data_processing_consent").default(false),
  marketingConsent: boolean("marketing_consent").default(false),
  
  // Investor Classification
  investorType: varchar("investor_type"), // retail/hni/institutional
  investorCategory: varchar("investor_category"), // aggressive/moderate/conservative
  financialSituation: varchar("financial_situation"),
  investmentObjective: varchar("investment_objective"),
  
  // Profile Completion Status
  profileCompleteness: integer("profile_completeness").default(0), // percentage 0-100
  isProfileCompleted: boolean("is_profile_completed").default(false),
  profileCompletedAt: timestamp("profile_completed_at"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  
  // Smart KYC System - DigiLocker Integration Fields
  digilockerAddress: text("digilocker_address"), // Address from DigiLocker Aadhaar
  digilockerDOB: varchar("digilocker_dob"), // DOB from DigiLocker
  digilockerGender: varchar("digilocker_gender"), // Gender from DigiLocker  
  digilockerFullName: varchar("digilocker_full_name"), // Full name from DigiLocker
  aadhaarLastFour: varchar("aadhaar_last_four"), // Last 4 digits for display
  
  // Name Reconciliation (PAN vs Aadhaar)
  nameMatchScore: integer("name_match_score"), // Levenshtein distance score 0-100
  nameReconciliationStatus: varchar("name_reconciliation_status"), // matched/mismatch/pending
  nameReconciliationNote: text("name_reconciliation_note"), // Details about name match
  
  // Smart KYC Verification Status
  panVerifiedViaSmartKyc: boolean("pan_verified_via_smart_kyc").default(false),
  panVerificationDate: timestamp("pan_verification_date"),
  aadhaarVerifiedViaSmartKyc: boolean("aadhaar_verified_via_smart_kyc").default(false),
  aadhaarVerificationDate: timestamp("aadhaar_verification_date"),
  smartKycCompletedAt: timestamp("smart_kyc_completed_at"),
  
  // OTP Delivery Preferences
  otpPreferenceEmail: boolean("otp_preference_email").default(true), // Email OTP enabled by default
  otpPreferenceSms: boolean("otp_preference_sms").default(false), // SMS OTP disabled by default
  otpPreferenceWhatsapp: boolean("otp_preference_whatsapp").default(true), // WhatsApp OTP enabled by default
  
  // Admin and system fields - supports multiple roles
  roles: varchar("roles").array().default(sql`ARRAY['user']`), // Array of roles: 'user', 'admin', 'superadmin', 'business_client', etc.
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  previousLoginAt: timestamp("previous_login_at"),
  loginCount: integer("login_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_email").on(table.email),
  index("idx_users_mobile").on(table.mobile),
  index("idx_users_pan_number").on(table.panNumber),
]);

// KYC Verification Sessions table for tracking step-by-step Smart KYC wizard flow
export const kycVerificationSessions = pgTable("kyc_verification_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Session Type and Flow
  sessionType: varchar("session_type").default("smart_kyc_wizard"), // smart_kyc_wizard
  currentStep: varchar("current_step").notNull().default("pan_verification"), // pan_verification/aadhaar_otp/aadhaar_verification/data_collection/completed
  stepStatus: jsonb("step_status").default({}), // Status for each step: {pan_verified: true, aadhaar_otp_sent: true, etc.}
  
  // PAN Verification Data
  panNumber: varchar("pan_number"), // Encrypted PAN number
  panDob: date("pan_dob"), // Date of birth from PAN
  panVerified: boolean("pan_verified").default(false),
  panVerificationData: jsonb("pan_verification_data"), // Store name, father name from API response
  panVerifiedAt: timestamp("pan_verified_at"),
  
  // Aadhaar Verification Data
  aadhaarNumber: varchar("aadhaar_number"), // Encrypted last 4 digits only
  aadhaarOtpSent: boolean("aadhaar_otp_sent").default(false),
  aadhaarOtpSentAt: timestamp("aadhaar_otp_sent_at"),
  aadhaarOtpVerified: boolean("aadhaar_otp_verified").default(false),
  aadhaarVerifiedAt: timestamp("aadhaar_verified_at"),
  aadhaarVerificationData: jsonb("aadhaar_verification_data"), // Store address, photo URL from API
  
  // Session Metadata
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"), // Session expires in 30 minutes
  
  // Audit fields
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
  metadata: jsonb("metadata"), // Store additional data like pending registration info
  createdAt: timestamp("created_at").defaultNow(),
});

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  identifier: varchar("identifier").notNull(), // email or mobile used for reset
  token: varchar("token", { length: 6 }).notNull(), // 6-digit OTP
  expiresAt: timestamp("expires_at").notNull(), // 10 minute expiry
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Smart KYC Progress Tracking - Track step-by-step completion
export const smartKycProgress = pgTable("smart_kyc_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(), // One progress record per user
  
  // Step 1: PAN Verification
  step1PanVerified: boolean("step1_pan_verified").default(false),
  step1PanNumber: varchar("step1_pan_number"),
  step1PanName: varchar("step1_pan_name"), // Name from Income Tax
  step1CompletedAt: timestamp("step1_completed_at"),
  step1Data: jsonb("step1_data"), // Store full PAN API response
  
  // Step 2: Aadhaar/DigiLocker Verification  
  step2AadhaarVerified: boolean("step2_aadhaar_verified").default(false),
  step2DigilockerSessionId: varchar("step2_digilocker_session_id"),
  step2CompletedAt: timestamp("step2_completed_at"),
  step2Data: jsonb("step2_data"), // Store DigiLocker response
  
  // Step 3: Account Discovery
  step3AccountsDiscovered: boolean("step3_accounts_discovered").default(false),
  step3BankAccountsFound: integer("step3_bank_accounts_found").default(0),
  step3DematAccountsFound: integer("step3_demat_accounts_found").default(0),
  step3CompletedAt: timestamp("step3_completed_at"),
  step3Data: jsonb("step3_data"), // Store discovered accounts
  
  // Step 4: Review & Confirmation
  step4ReviewCompleted: boolean("step4_review_completed").default(false),
  step4CompletedAt: timestamp("step4_completed_at"),
  step4ConfirmedData: jsonb("step4_confirmed_data"), // Final confirmed data
  
  // Overall Progress
  currentStep: integer("current_step").default(1), // 1-4
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  
  // Name Reconciliation
  nameMatchScore: integer("name_match_score"), // PAN name vs Aadhaar name match score
  nameReconciliationStatus: varchar("name_reconciliation_status"), // matched/mismatch/manual_review
  
  // Metadata
  startedAt: timestamp("started_at").defaultNow(),
  lastUpdatedStep: integer("last_updated_step"), // Which step was last updated
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Corporate KYC Progress Tracking - For Company/Non-Individual entities
export const corporateKycProgress = pgTable("corporate_kyc_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(), // Company representative
  
  // Step 1: Corporate PAN Verification
  step1CorporatePanVerified: boolean("step1_corporate_pan_verified").default(false),
  step1CorporatePan: varchar("step1_corporate_pan"),
  step1CompanyName: varchar("step1_company_name"), // From Corporate PAN API
  step1CompanyType: varchar("step1_company_type"), // Private Ltd/Public Ltd/LLP/Partnership
  step1CompletedAt: timestamp("step1_completed_at"),
  step1Data: jsonb("step1_data"), // Store full Corporate PAN API response
  
  // Step 2: Company Documents Upload
  step2DocumentsUploaded: boolean("step2_documents_uploaded").default(false),
  step2CertificateOfIncorporation: varchar("step2_coi_url"), // Object storage URL
  step2MemorandumOfAssociation: varchar("step2_moa_url"),
  step2ArticlesOfAssociation: varchar("step2_aoa_url"),
  step2BoardResolution: varchar("step2_board_resolution_url"),
  step2CompletedAt: timestamp("step2_completed_at"),
  step2Data: jsonb("step2_data"), // Document metadata
  
  // Step 3: Authorized Signatory Verification (DigiLocker)
  step3SignatoryVerified: boolean("step3_signatory_verified").default(false),
  step3SignatoryName: varchar("step3_signatory_name"),
  step3SignatoryAadhaar: varchar("step3_signatory_aadhaar_last_four"), // Last 4 digits
  step3SignatoryDesignation: varchar("step3_signatory_designation"), // Director/Partner/Authorized Signatory
  step3DigilockerSessionId: varchar("step3_digilocker_session_id"),
  step3CompletedAt: timestamp("step3_completed_at"),
  step3Data: jsonb("step3_data"), // Signatory details from DigiLocker
  
  // Step 4: Corporate Account Discovery
  step4AccountsDiscovered: boolean("step4_accounts_discovered").default(false),
  step4BankAccountsFound: integer("step4_bank_accounts_found").default(0),
  step4DematAccountsFound: integer("step4_demat_accounts_found").default(0),
  step4CompletedAt: timestamp("step4_completed_at"),
  step4Data: jsonb("step4_data"), // Discovered corporate accounts
  
  // Step 5: Review & Confirmation
  step5ReviewCompleted: boolean("step5_review_completed").default(false),
  step5CompletedAt: timestamp("step5_completed_at"),
  step5ConfirmedData: jsonb("step5_confirmed_data"), // Final confirmed data
  
  // Overall Progress
  currentStep: integer("current_step").default(1), // 1-5
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  
  // Company Identifiers
  cin: varchar("cin"), // Corporate Identification Number
  gstin: varchar("gstin"), // GST Identification Number
  
  // Metadata
  startedAt: timestamp("started_at").defaultNow(),
  lastUpdatedStep: integer("last_updated_step"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NRI KYC Progress Tracking - For Non-Resident Indians
export const nriKycProgress = pgTable("nri_kyc_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Step 1: PAN/Passport Verification
  step1Verified: boolean("step1_verified").default(false),
  step1PanNumber: varchar("step1_pan_number"), // Optional for NRIs
  step1PassportNumber: varchar("step1_passport_number").notNull(),
  step1PassportName: varchar("step1_passport_name"),
  step1PassportExpiry: date("step1_passport_expiry"),
  step1CountryOfResidence: varchar("step1_country_of_residence"),
  step1CompletedAt: timestamp("step1_completed_at"),
  step1Data: jsonb("step1_data"), // Passport verification data
  
  // Step 2: Overseas Address Proof
  step2AddressVerified: boolean("step2_address_verified").default(false),
  step2OverseasAddressLine1: text("step2_overseas_address_line1"),
  step2OverseasAddressLine2: text("step2_overseas_address_line2"),
  step2OverseasCity: varchar("step2_overseas_city"),
  step2OverseasState: varchar("step2_overseas_state"),
  step2OverseasCountry: varchar("step2_overseas_country"),
  step2OverseasPostalCode: varchar("step2_overseas_postal_code"),
  step2AddressProofDocUrl: varchar("step2_address_proof_doc_url"), // Utility bill/Lease agreement
  step2CompletedAt: timestamp("step2_completed_at"),
  step2Data: jsonb("step2_data"),
  
  // Step 3: PIS Permission & Foreign Bank Account
  step3PisVerified: boolean("step3_pis_verified").default(false),
  step3PisPermissionLetterUrl: varchar("step3_pis_permission_letter_url"), // RBI PIS permission
  step3PisBankName: varchar("step3_pis_bank_name"),
  step3PisBranchName: varchar("step3_pis_branch_name"),
  step3ForeignBankAccountNumber: varchar("step3_foreign_bank_account_number"),
  step3ForeignBankName: varchar("step3_foreign_bank_name"),
  step3ForeignBankCountry: varchar("step3_foreign_bank_country"),
  step3SwiftCode: varchar("step3_swift_code"),
  step3CompletedAt: timestamp("step3_completed_at"),
  step3Data: jsonb("step3_data"),
  
  // Step 4: FATCA/CRS Declaration
  step4FatcaCompleted: boolean("step4_fatca_completed").default(false),
  step4TaxResidencyCountry: varchar("step4_tax_residency_country"),
  step4TaxIdentificationNumber: varchar("step4_tax_identification_number"), // TIN
  step4UsCitizen: boolean("step4_us_citizen").default(false),
  step4GreenCardHolder: boolean("step4_green_card_holder").default(false),
  step4FatcaDeclarationUrl: varchar("step4_fatca_declaration_url"), // W8-BEN form
  step4CrsDeclarationUrl: varchar("step4_crs_declaration_url"),
  step4CompletedAt: timestamp("step4_completed_at"),
  step4Data: jsonb("step4_data"),
  
  // Step 5: Review & Confirmation
  step5ReviewCompleted: boolean("step5_review_completed").default(false),
  step5CompletedAt: timestamp("step5_completed_at"),
  step5ConfirmedData: jsonb("step5_confirmed_data"),
  
  // Overall Progress
  currentStep: integer("current_step").default(1), // 1-5
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  
  // NRI Status
  nriStatus: varchar("nri_status"), // NRI/NRE/NRO/PIO/OCI
  investmentType: varchar("investment_type"), // repatriable/non_repatriable
  
  // Metadata
  startedAt: timestamp("started_at").defaultNow(),
  lastUpdatedStep: integer("last_updated_step"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  verificationMethod: varchar("verification_method"), // digilocker/manual_upload/video_kyc/agent_assisted
  digilockerVerified: boolean("digilocker_verified").default(false), // Indicates if verified via DigiLocker
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

// ===== FAMILY COLLABORATION TABLES =====

// Family Groups - Core table for family/couple financial planning
export const familyGroups = pgTable("family_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  groupType: varchar("group_type").default("family"), // family, couple, household
  description: text("description"),
  settings: jsonb("settings"), // privacy preferences, notification settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Family Members - Join table with roles and permissions
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role").default("member"), // owner, admin, member, view_only
  displayName: varchar("display_name"), // How they want to be called in family
  invitationStatus: varchar("invitation_status").default("pending"), // pending, accepted, declined
  invitedBy: varchar("invited_by").references(() => users.id),
  invitedAt: timestamp("invited_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
  leftAt: timestamp("left_at"),
}, (table) => [
  index("idx_family_members_family_id").on(table.familyId),
  index("idx_family_members_user_id").on(table.userId),
]);

export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }),
  cash: decimal("cash", { precision: 15, scale: 2 }).default("0"),
  baseCurrency: varchar("base_currency").default("INR"), // Multi-currency support
  isDefault: boolean("is_default").default(false),
  familyId: varchar("family_id").references(() => familyGroups.id), // Null for individual portfolios
  isShared: boolean("is_shared").default(false), // Whether this is a shared family portfolio
  createdAt: timestamp("created_at").defaultNow(),
});

export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  symbol: text("symbol").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  avgPrice: decimal("avg_price", { precision: 15, scale: 4 }).notNull(),
  currency: varchar("currency").default("INR"), // Multi-currency support
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
  currency: varchar("currency").default("INR"), // Multi-currency support
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

// Rebalance execution history
export const rebalanceExecutions = pgTable("rebalance_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  executionDate: timestamp("execution_date").defaultNow(),
  status: varchar("status").notNull().default("pending"), // 'pending', 'executing', 'completed', 'failed', 'partially_completed'
  portfolioValueBefore: decimal("portfolio_value_before", { precision: 15, scale: 2 }),
  portfolioValueAfter: decimal("portfolio_value_after", { precision: 15, scale: 2 }),
  transactionCount: integer("transaction_count").default(0),
  successfulTransactions: integer("successful_transactions").default(0),
  failedTransactions: integer("failed_transactions").default(0),
  totalTransactionCost: decimal("total_transaction_cost", { precision: 15, scale: 2 }).default("0"),
  rebalanceDetails: jsonb("rebalance_details"), // Store the full rebalance calculation
  executionNotes: text("execution_notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rebalance transaction details (individual buy/sell transactions from rebalance)
export const rebalanceTransactions = pgTable("rebalance_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rebalanceExecutionId: varchar("rebalance_execution_id").references(() => rebalanceExecutions.id).notNull(),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  assetType: varchar("asset_type").notNull(),
  symbol: varchar("symbol"),
  action: varchar("action").notNull(), // 'BUY' or 'SELL'
  quantity: decimal("quantity", { precision: 15, scale: 4 }),
  price: decimal("price", { precision: 15, scale: 4 }),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  transactionCost: decimal("transaction_cost", { precision: 15, scale: 2 }),
  status: varchar("status").notNull().default("pending"), // 'pending', 'executed', 'failed'
  orderId: varchar("order_id"), // External order reference if applicable
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User rebalancing preferences
export const rebalancingPreferences = pgTable("rebalancing_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  toleranceThreshold: decimal("tolerance_threshold", { precision: 5, scale: 2 }).default("5.00"), // Percentage deviation before rebalancing (default 5%)
  minimumTransactionAmount: decimal("minimum_transaction_amount", { precision: 15, scale: 2 }).default("1000.00"), // Skip transactions below this amount (default ₹1000)
  transactionCostPercentage: decimal("transaction_cost_percentage", { precision: 5, scale: 2 }).default("0.10"), // Transaction cost as percentage (default 0.10%)
  autoRebalanceEnabled: boolean("auto_rebalance_enabled").default(false),
  rebalanceFrequency: varchar("rebalance_frequency").default("quarterly"), // 'monthly', 'quarterly', 'semi_annually', 'annually', 'manual'
  notifyOnDrift: boolean("notify_on_drift").default(true), // Send alert when portfolio drifts beyond threshold
  lastRebalanceDate: timestamp("last_rebalance_date"),
  nextScheduledRebalance: timestamp("next_scheduled_rebalance"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portfolio snapshots for date-specific portfolio views
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }),
  totalEquityValue: decimal("total_equity_value", { precision: 15, scale: 2 }),
  totalDebtValue: decimal("total_debt_value", { precision: 15, scale: 2 }),
  totalMutualFundValue: decimal("total_mutual_fund_value", { precision: 15, scale: 2 }),
  totalGovernmentSchemeValue: decimal("total_government_scheme_value", { precision: 15, scale: 2 }),
  totalAlternativeValue: decimal("total_alternative_value", { precision: 15, scale: 2 }),
  totalCashValue: decimal("total_cash_value", { precision: 15, scale: 2 }),
  epfValue: decimal("epf_value", { precision: 15, scale: 2 }),
  ppfValue: decimal("ppf_value", { precision: 15, scale: 2 }),
  epsValue: decimal("eps_value", { precision: 15, scale: 2 }),
  apyValue: decimal("apy_value", { precision: 15, scale: 2 }),
  npsValue: decimal("nps_value", { precision: 15, scale: 2 }),
  insuranceValue: decimal("insurance_value", { precision: 15, scale: 2 }),
  realEstateValue: decimal("real_estate_value", { precision: 15, scale: 2 }),
  commodityValue: decimal("commodity_value", { precision: 15, scale: 2 }),
  cryptoValue: decimal("crypto_value", { precision: 15, scale: 2 }),
  metadata: jsonb("metadata"), // Additional snapshot data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced portfolio holdings to support date-specific and cross-platform data
export const comprehensiveHoldings = pgTable("comprehensive_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => portfolioSnapshots.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  holdingDate: date("holding_date").notNull(),
  
  // Asset Identification
  symbol: text("symbol").notNull(),
  isin: varchar("isin"),
  assetName: text("asset_name").notNull(),
  assetType: text("asset_type").notNull(), // 'equity', 'debt', 'mutual_fund', 'government_scheme', 'alternative', 'commodity', 'real_estate', 'crypto', 'insurance', 'cash'
  assetClass: text("asset_class"), // 'large_cap', 'mid_cap', 'small_cap', 'debt', 'hybrid', 'epf', 'ppf', 'eps', 'apy', 'nps', 'ulip', 'term_plan'
  subAssetClass: text("sub_asset_class"), // More granular classification
  
  // Holding Details
  quantity: decimal("quantity", { precision: 15, scale: 4 }),
  units: decimal("units", { precision: 15, scale: 4 }), // For mutual funds
  avgPrice: decimal("avg_price", { precision: 15, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  marketValue: decimal("market_value", { precision: 15, scale: 2 }),
  investedValue: decimal("invested_value", { precision: 15, scale: 2 }),
  gainLoss: decimal("gain_loss", { precision: 15, scale: 2 }),
  gainLossPercent: decimal("gain_loss_percent", { precision: 8, scale: 4 }),
  
  // Source Integration
  dataSource: varchar("data_source").notNull(), // 'cams', 'kfintech', 'nsdl', 'cdsl', 'epf', 'ppf', 'manual', 'government_portal'
  sourceAccountNumber: varchar("source_account_number"), // Original account number from source
  folio: varchar("folio"), // For mutual funds
  dematAccountNumber: varchar("demat_account_number"), // For equity/bonds
  
  // Additional Details
  sector: text("sector"),
  industry: text("industry"),
  marketCap: decimal("market_cap", { precision: 20, scale: 0 }),
  beta: decimal("beta", { precision: 5, scale: 3 }),
  dividendYield: decimal("dividend_yield", { precision: 5, scale: 2 }),
  peRatio: decimal("pe_ratio", { precision: 8, scale: 2 }),
  maturityDate: date("maturity_date"), // For bonds, FDs, government schemes
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  
  // Government Scheme Specific
  contributionFrequency: varchar("contribution_frequency"), // monthly, quarterly, yearly
  nomineeName: text("nominee_name"),
  nomineeRelation: varchar("nominee_relation"),
  
  // Metadata and Tracking
  metadata: jsonb("metadata"), // Additional holding-specific data
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
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

// NPS (National Pension System) Holdings table
export const npsAccounts = pgTable("nps_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  pran: varchar("pran").notNull().unique(), // Permanent Retirement Account Number (12 digits)
  accountHolderName: text("account_holder_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  registrationDate: date("registration_date").notNull(),
  
  // Tier I Details (Mandatory retirement account - Cannot withdraw before 60)
  tierIBalance: decimal("tier_i_balance", { precision: 15, scale: 2 }).default("0"),
  tierIContributions: decimal("tier_i_contributions", { precision: 15, scale: 2 }).default("0"),
  tierIReturns: decimal("tier_i_returns", { precision: 15, scale: 2 }).default("0"),
  tierIAssetAllocation: jsonb("tier_i_asset_allocation"), // {equityPercent, corporateBondPercent, governmentBondPercent, alternativePercent}
  
  // Tier II Details (Voluntary savings - Can withdraw anytime)
  tierIIBalance: decimal("tier_ii_balance", { precision: 15, scale: 2 }).default("0"),
  tierIIContributions: decimal("tier_ii_contributions", { precision: 15, scale: 2 }).default("0"),
  tierIIReturns: decimal("tier_ii_returns", { precision: 15, scale: 2 }).default("0"),
  tierIIAssetAllocation: jsonb("tier_ii_asset_allocation"), // Same structure, null if Tier II not active
  
  // Total across both tiers
  totalBalance: decimal("total_balance", { precision: 15, scale: 2 }).default("0"),
  totalContributions: decimal("total_contributions", { precision: 15, scale: 2 }).default("0"),
  totalReturns: decimal("total_returns", { precision: 15, scale: 2 }).default("0"),
  returnsPercentage: decimal("returns_percentage", { precision: 8, scale: 2 }).default("0"),
  
  // Account Details
  fundManager: text("fund_manager"), // HDFC, SBI, ICICI, LIC, UTI, Kotak, Birla, etc.
  scheme: text("scheme"), // Active Choice (E%, C%, G%) or Auto Choice (LC, LC-50, LC-75)
  tier: varchar("tier").notNull(), // 'Tier I', 'Tier II', 'Both'
  
  // Nominee Information
  nominee: text("nominee"),
  nomineeRelation: varchar("nominee_relation"),
  
  // Status
  status: varchar("status").notNull().default("active"), // active, frozen, closed
  lastContributionDate: date("last_contribution_date"),
  
  // Tracking
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// APY (Atal Pension Yojana) Accounts table
export const apyAccounts = pgTable("apy_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  pran: varchar("pran").notNull().unique(), // PRAN number (12 digits) - same format as NPS
  accountHolderName: text("account_holder_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  enrollmentDate: date("enrollment_date").notNull(),
  
  // Pension Details
  pensionAmount: decimal("pension_amount", { precision: 15, scale: 2 }).notNull(), // Guaranteed monthly pension: ₹1000, ₹2000, ₹3000, ₹4000, or ₹5000
  monthlyContribution: decimal("monthly_contribution", { precision: 15, scale: 2 }).notNull(), // Calculated based on age and pension choice
  
  // Contribution Tracking
  totalContribution: decimal("total_contribution", { precision: 15, scale: 2 }).default("0"), // User's total contributions
  governmentContribution: decimal("government_contribution", { precision: 15, scale: 2 }).default("0"), // Govt co-contribution for eligible users (50% of contribution or ₹1000/year, whichever is lower)
  totalBalance: decimal("total_balance", { precision: 15, scale: 2 }).default("0"), // Current accumulated balance
  
  // Account Details
  enrollmentAge: integer("enrollment_age").notNull(), // Age at enrollment (18-40 years)
  maturityAge: integer("maturity_age").notNull().default(60), // Fixed at 60 years
  yearsToMaturity: integer("years_to_maturity"), // Calculated: 60 - current age
  expectedMaturityDate: date("expected_maturity_date"),
  
  // Bank Account Details (APY is bank-account linked)
  bankName: text("bank_name").notNull(),
  bankAccountNumber: varchar("bank_account_number").notNull(),
  ifscCode: varchar("ifsc_code").notNull(),
  branchName: text("branch_name"),
  
  // Nominee Information
  nominee: text("nominee"),
  nomineeRelation: varchar("nominee_relation"),
  nomineeAge: integer("nominee_age"),
  
  // Status & Tracking
  status: varchar("status").notNull().default("active"), // active, matured, discontinued, exited
  lastContributionDate: date("last_contribution_date"),
  exitDate: date("exit_date"), // If user exits before maturity
  exitReason: text("exit_reason"), // Reason for discontinuation
  
  // Metadata
  remarks: text("remarks"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Agents table
export const customerCareAgents = pgTable("customer_care_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Agent details
  fullName: varchar("full_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone"),
  employeeId: varchar("employee_id").unique(),
  // EUIN/ARN details for master agents
  euinNumber: varchar("euin_number").unique(),
  arnCode: varchar("arn_code"),
  distributorId: varchar("distributor_id"),
  distributorName: varchar("distributor_name"), // From AMFI registry
  // Authentication (if they need to log into system)
  password: text("password"),
  // Agent specialization
  specializations: text("specializations").array().default([]), // ['technical', 'billing', 'product_inquiry']
  languages: text("languages").array().default(["en"]), // Supported languages
  
  // Product Distribution Authorization
  productTypes: text("product_types").array().default([]), // ['loans', 'mutual_funds', 'aif', 'pms', 'insurance', 'equity']
  regulatoryCategory: varchar("regulatory_category").default("loan_dsa"), // loan_dsa, securities_distributor, hybrid
  
  // Agent Hierarchy for Multi-Level Distribution
  masterAgentId: varchar("master_agent_id"), // References parent agent
  agentLevel: varchar("agent_level").default("master"), // master, sub_agent, associate
  hierarchyPath: varchar("hierarchy_path"), // Materialized path: "master_id/sub_id" for efficient queries
  
  // AMFI Verification Status
  arnVerificationStatus: varchar("arn_verification_status").default("pending"), // pending, verified, failed, expired
  euinVerificationStatus: varchar("euin_verification_status").default("pending"),
  amfiVerifiedAt: timestamp("amfi_verified_at"),
  amfiVerificationResponse: jsonb("amfi_verification_response"), // Store AMFI API response
  arnExpiryDate: timestamp("arn_expiry_date"),
  
  // Commission Split Configuration
  commissionSplitModel: varchar("commission_split_model").default("standard"), // standard, custom
  defaultCommissionShare: decimal("default_commission_share", { precision: 5, scale: 2 }).default("100.00"), // % share this agent receives
  masterAgentShare: decimal("master_agent_share", { precision: 5, scale: 2 }).default("0.00"), // % that goes to master
  
  // Onboarding & Verification
  onboardingStatus: varchar("onboarding_status").default("pending"), // pending, documents_submitted, under_review, approved, rejected
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  
  // Basic KYC Information (Required for all agent levels)
  panNumber: varchar("pan_number", { length: 10 }),
  panName: varchar("pan_name"), // Name as per PAN
  aadharNumber: varchar("aadhar_number", { length: 12 }), // Store masked: XXXX-XXXX-1234
  aadharName: varchar("aadhar_name"), // Name as per Aadhaar
  
  // Bank Account Details (Required for commission payouts)
  bankAccountNumber: varchar("bank_account_number"),
  bankIfscCode: varchar("bank_ifsc_code"),
  bankName: varchar("bank_name"),
  bankBranch: varchar("bank_branch"),
  accountHolderName: varchar("account_holder_name"),
  
  // KYC Documents Verification Status
  panVerified: boolean("pan_verified").default(false),
  aadharVerified: boolean("aadhar_verified").default(false),
  bankAccountVerified: boolean("bank_account_verified").default(false),
  amfiCertificateVerified: boolean("amfi_certificate_verified").default(false),
  euinCardVerified: boolean("euin_card_verified").default(false),
  
  // Status and availability
  status: varchar("status").default("active"), // 'active', 'inactive', 'on_leave', 'suspended'
  maxTicketsPerDay: integer("max_tickets_per_day").default(50),
  currentTicketCount: integer("current_ticket_count").default(0),
  // Performance metrics
  totalTicketsHandled: integer("total_tickets_handled").default(0),
  averageResolutionTime: decimal("average_resolution_time", { precision: 8, scale: 2 }), // in hours
  customerSatisfactionRating: decimal("customer_satisfaction_rating", { precision: 3, scale: 2 }),
  
  // Client & Commission Metrics
  totalClientsAssigned: integer("total_clients_assigned").default(0),
  activeClientsCount: integer("active_clients_count").default(0),
  totalCommissionsEarned: decimal("total_commissions_earned", { precision: 15, scale: 2 }).default("0.00"),
  totalCommissionsPaid: decimal("total_commissions_paid", { precision: 15, scale: 2 }).default("0.00"),
  pendingCommissions: decimal("pending_commissions", { precision: 15, scale: 2 }).default("0.00"),
  
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

// Agent Commission Split Rules - Defines how commissions are split in hierarchy
export const agentCommissionSplits = pgTable("agent_commission_splits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subAgentId: varchar("sub_agent_id").references(() => customerCareAgents.id).notNull(),
  masterAgentId: varchar("master_agent_id").references(() => customerCareAgents.id).notNull(),
  
  // Split Configuration
  splitModel: varchar("split_model").default("percentage"), // percentage, fixed_amount, tiered
  productType: varchar("product_type"), // mutual_funds, insurance, loans, equity - null means all products
  
  // Percentage Split (most common)
  subAgentShare: decimal("sub_agent_share", { precision: 5, scale: 2 }).notNull(), // % for sub-agent
  masterAgentShare: decimal("master_agent_share", { precision: 5, scale: 2 }).notNull(), // % for master
  
  // Fixed Amount Split (optional)
  fixedSubAgentAmount: decimal("fixed_sub_agent_amount", { precision: 10, scale: 2 }),
  fixedMasterAmount: decimal("fixed_master_amount", { precision: 10, scale: 2 }),
  
  // Tiered Split (based on volume)
  tieredRules: jsonb("tiered_rules"), // [{minVolume: 0, maxVolume: 100000, subShare: 60, masterShare: 40}, ...]
  
  // Validity
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"),
  isActive: boolean("is_active").default(true),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent Documents - Store onboarding and KYC documents
export const agentDocuments = pgTable("agent_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => customerCareAgents.id).notNull(),
  
  // Document Details
  documentType: varchar("document_type").notNull(), // pan_card, aadhar_card, amfi_certificate, euin_card, bank_proof, cancelled_cheque
  documentName: varchar("document_name").notNull(),
  documentUrl: text("document_url").notNull(), // Object storage URL
  documentNumber: varchar("document_number"), // PAN number, Aadhar number, etc.
  
  // Verification Status
  verificationStatus: varchar("verification_status").default("pending"), // pending, verified, rejected
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  
  // Metadata
  fileSize: integer("file_size"), // in bytes
  mimeType: varchar("mime_type"),
  uploadedFrom: varchar("uploaded_from"), // web, mobile, admin
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent Commissions - Track commission transactions in agent hierarchy
export const agentCommissions = pgTable("agent_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => customerCareAgents.id).notNull(),
  masterAgentId: varchar("master_agent_id").references(() => customerCareAgents.id), // Null if this is master agent
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Transaction Reference
  orderId: varchar("order_id").notNull(), // Link to unified_orders or product-specific order
  productType: varchar("product_type").notNull(), // mutual_funds, insurance, loans, equity
  transactionType: varchar("transaction_type").notNull(), // purchase, sip, renewal, redemption
  
  // Amount Breakdown
  transactionAmount: decimal("transaction_amount", { precision: 15, scale: 2 }).notNull(),
  totalCommissionAmount: decimal("total_commission_amount", { precision: 15, scale: 2 }).notNull(), // Total commission on transaction
  
  // Agent's Share
  agentCommissionRate: decimal("agent_commission_rate", { precision: 5, scale: 2 }).notNull(),
  agentCommissionAmount: decimal("agent_commission_amount", { precision: 15, scale: 2 }).notNull(),
  agentTdsAmount: decimal("agent_tds_amount", { precision: 15, scale: 2 }).default("0.00"),
  agentNetCommission: decimal("agent_net_commission", { precision: 15, scale: 2 }).notNull(),
  
  // Master Agent's Share (if applicable)
  masterCommissionRate: decimal("master_commission_rate", { precision: 5, scale: 2 }).default("0.00"),
  masterCommissionAmount: decimal("master_commission_amount", { precision: 15, scale: 2 }).default("0.00"),
  masterTdsAmount: decimal("master_tds_amount", { precision: 15, scale: 2 }).default("0.00"),
  masterNetCommission: decimal("master_net_commission", { precision: 15, scale: 2 }).default("0.00"),
  
  // Split Rule Applied
  splitRuleId: varchar("split_rule_id").references(() => agentCommissionSplits.id),
  
  // Settlement Status
  agentSettlementStatus: varchar("agent_settlement_status").default("pending"), // pending, settled, cancelled
  masterSettlementStatus: varchar("master_settlement_status").default("pending"),
  agentSettledAt: timestamp("agent_settled_at"),
  masterSettledAt: timestamp("master_settled_at"),
  
  // Metadata
  transactionDate: timestamp("transaction_date").notNull().defaultNow(),
  month: varchar("month").notNull(), // YYYY-MM
  financialYear: varchar("financial_year"), // FY2024-25
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AMFI Verification Log - Track all AMFI API calls for audit
export const amfiVerificationLog = pgTable("amfi_verification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => customerCareAgents.id),
  
  // Verification Details
  verificationType: varchar("verification_type").notNull(), // arn_verification, euin_verification, distributor_details
  arnCode: varchar("arn_code"),
  euinNumber: varchar("euin_number"),
  
  // API Response
  apiRequest: jsonb("api_request"), // Request payload
  apiResponse: jsonb("api_response"), // Response from AMFI
  verificationStatus: varchar("verification_status").notNull(), // success, failed, error
  errorMessage: text("error_message"),
  
  // Extracted Data
  distributorName: varchar("distributor_name"),
  distributorStatus: varchar("distributor_status"), // active, inactive, suspended
  arnExpiryDate: timestamp("arn_expiry_date"),
  registrationDate: timestamp("registration_date"),
  
  // Audit
  verifiedBy: varchar("verified_by").references(() => users.id),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Partners table for managing partner accounts with revenue sharing
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
  partnerType: varchar("partner_type").notNull(), // 'product_provider', 'service_provider', 'both', 'distributor', 'agent'
  permissions: jsonb("permissions").default({}), // Custom permissions object
  // Business details
  businessLicense: varchar("business_license"),
  taxId: varchar("tax_id"),
  gstin: varchar("gstin"), // GST number for corporates
  cin: varchar("cin"), // Corporate Identity Number
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("0.00"),
  
  // Product-Specific Certifications
  productTypes: text("product_types").array().default(sql`ARRAY[]::text[]`), // ['mutual_funds', 'insurance', 'loans', 'equity', 'bonds']
  arnCode: varchar("arn_code"), // AMFI Registration Number for MF distributors
  euinNumber: varchar("euin_number"), // Employee Unique Identification Number
  pospNumber: varchar("posp_number"), // Point of Sales Person for insurance
  riaNumber: varchar("ria_number"), // Registered Investment Advisor
  dsaCode: varchar("dsa_code"), // Direct Selling Agent code for loans
  
  // KYC & Bank Details for Payouts
  panNumber: varchar("pan_number"),
  aadharNumber: varchar("aadhar_number"),
  bankAccountNumber: varchar("bank_account_number"),
  ifscCode: varchar("ifsc_code"),
  bankAccountHolderName: varchar("bank_account_holder_name"),
  upiId: varchar("upi_id"),
  
  // Cashfree Vendor Integration
  cashfreeVendorId: varchar("cashfree_vendor_id"), // Cashfree vendor ID for payouts
  cashfreeVendorStatus: varchar("cashfree_vendor_status").default("not_registered"), // not_registered, pending, active, suspended
  cashfreeBankVerified: boolean("cashfree_bank_verified").default(false),
  cashfreeRegisteredAt: timestamp("cashfree_registered_at"),
  
  // Commission Structure
  commissionTier: varchar("commission_tier").default("standard"), // standard, silver, gold, platinum
  volumeBonusEnabled: boolean("volume_bonus_enabled").default(false),
  volumeBonusRate: decimal("volume_bonus_rate", { precision: 5, scale: 2 }), // Additional % for high volume
  volumeThreshold: decimal("volume_threshold", { precision: 15, scale: 2 }), // Monthly volume needed for bonus
  
  // Settlement Configuration
  settlementFrequency: varchar("settlement_frequency").default("monthly"), // instant, daily, weekly, monthly
  settlementDay: integer("settlement_day").default(1), // Day of month for monthly settlements (1-31)
  minSettlementAmount: decimal("min_settlement_amount", { precision: 10, scale: 2 }).default("1000.00"),
  
  // Performance Tracking
  totalClientsReferred: integer("total_clients_referred").default(0),
  activeClientsCount: integer("active_clients_count").default(0),
  totalCommissionsEarned: decimal("total_commissions_earned", { precision: 15, scale: 2 }).default("0.00"),
  totalCommissionsPaid: decimal("total_commissions_paid", { precision: 15, scale: 2 }).default("0.00"),
  pendingCommissions: decimal("pending_commissions", { precision: 15, scale: 2 }).default("0.00"),
  lastSettlementDate: timestamp("last_settlement_date"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Partner Referrals - Track which partner referred which client
export const partnerReferrals = pgTable("partner_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Referral Details
  referralCode: varchar("referral_code"), // Partner's unique referral code
  referralSource: varchar("referral_source"), // website, app, email, whatsapp
  referralDate: timestamp("referral_date").defaultNow(),
  
  // Client Status
  clientStatus: varchar("client_status").default("registered"), // registered, kyc_completed, first_transaction, active, inactive
  firstTransactionDate: timestamp("first_transaction_date"),
  lastTransactionDate: timestamp("last_transaction_date"),
  
  // Tracking
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Partner Commissions - Track every commission transaction
export const partnerCommissions = pgTable("partner_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Transaction Reference
  orderId: varchar("order_id"), // Reference to unified_orders or specific product order
  productType: varchar("product_type").notNull(), // mutual_funds, insurance, loans, equity, bonds
  transactionType: varchar("transaction_type").notNull(), // purchase, sip, renewal, interest, payout
  
  // Amount Details
  transactionAmount: decimal("transaction_amount", { precision: 15, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // % rate applied
  commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }).notNull(),
  volumeBonus: decimal("volume_bonus", { precision: 15, scale: 2 }).default("0.00"), // Additional bonus if applicable
  totalCommission: decimal("total_commission", { precision: 15, scale: 2 }).notNull(), // commission + bonus
  
  // Tax Deduction (TDS)
  tdsRate: decimal("tds_rate", { precision: 5, scale: 2 }).default("0.00"),
  tdsAmount: decimal("tds_amount", { precision: 15, scale: 2 }).default("0.00"),
  netCommission: decimal("net_commission", { precision: 15, scale: 2 }).notNull(), // After TDS
  
  // Settlement Status
  status: varchar("status").default("pending"), // pending, settled, cancelled, reversed
  settlementId: varchar("settlement_id"), // Foreign key will be added after partnerSettlements table is defined
  settledAt: timestamp("settled_at"),
  
  // Cashfree Split Details
  cashfreeOrderId: varchar("cashfree_order_id"), // Cashfree payment order ID
  cashfreeSplitId: varchar("cashfree_split_id"), // Cashfree split transaction ID
  cashfreeSplitStatus: varchar("cashfree_split_status"), // pending, success, failed
  
  // Metadata
  transactionDate: timestamp("transaction_date").defaultNow(),
  month: varchar("month").notNull(), // YYYY-MM for grouping
  financialYear: varchar("financial_year"), // FY2024-25
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Partner Settlements - Monthly payout records
export const partnerSettlements = pgTable("partner_settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  
  // Settlement Period
  settlementPeriod: varchar("settlement_period").notNull(), // YYYY-MM
  settlementMonth: varchar("settlement_month").notNull(), // January 2025
  settlementDate: timestamp("settlement_date").notNull(),
  
  // Commission Summary
  totalTransactions: integer("total_transactions").default(0),
  totalCommissionEarned: decimal("total_commission_earned", { precision: 15, scale: 2 }).notNull(),
  totalVolumeBonus: decimal("total_volume_bonus", { precision: 15, scale: 2 }).default("0.00"),
  totalTds: decimal("total_tds", { precision: 15, scale: 2 }).default("0.00"),
  netPayable: decimal("net_payable", { precision: 15, scale: 2 }).notNull(),
  
  // Adjustment & Deductions
  adjustments: decimal("adjustments", { precision: 15, scale: 2 }).default("0.00"), // Manual adjustments
  adjustmentReason: text("adjustment_reason"),
  previousBalance: decimal("previous_balance", { precision: 15, scale: 2 }).default("0.00"), // Carried forward
  finalPayoutAmount: decimal("final_payout_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Payment Status
  status: varchar("status").default("pending"), // pending, processing, completed, failed, cancelled
  paymentMethod: varchar("payment_method").default("bank_transfer"), // bank_transfer, upi
  
  // Cashfree Payout Details
  cashfreePayoutId: varchar("cashfree_payout_id"), // Cashfree payout/transfer ID
  cashfreePayoutStatus: varchar("cashfree_payout_status"), // pending, success, failed, reversed
  cashfreeUtr: varchar("cashfree_utr"), // Unique Transaction Reference from bank
  cashfreePayoutInitiatedAt: timestamp("cashfree_payout_initiated_at"),
  cashfreePayoutCompletedAt: timestamp("cashfree_payout_completed_at"),
  cashfreeFailureReason: text("cashfree_failure_reason"),
  
  // Bank Details (snapshot at time of settlement)
  bankAccountNumber: varchar("bank_account_number"),
  ifscCode: varchar("ifsc_code"),
  accountHolderName: varchar("account_holder_name"),
  
  // Reconciliation
  reconciledAt: timestamp("reconciled_at"),
  reconciledBy: varchar("reconciled_by").references(() => users.id),
  reconciliationNotes: text("reconciliation_notes"),
  
  // Documents
  invoiceNumber: varchar("invoice_number"),
  invoiceUrl: text("invoice_url"), // PDF invoice stored in object storage
  statementUrl: text("statement_url"), // Detailed statement
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agents table for managing agent/distributor accounts
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Optional link to user account
  
  // Personal Information
  fullName: varchar("full_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone"),
  address: text("address"),
  
  // Agent Identification
  employeeId: varchar("employee_id").unique(), // Internal employee/agent ID
  arnCode: varchar("arn_code"), // AMFI Registration Number for MF distributors
  euinNumber: varchar("euin_number"), // Employee Unique Identification Number
  pospNumber: varchar("posp_number"), // Point of Sales Person for insurance
  dsaCode: varchar("dsa_code"), // Direct Selling Agent code for loans
  
  // KYC & Bank Details
  panNumber: varchar("pan_number"),
  aadharNumber: varchar("aadhar_number"),
  bankAccountNumber: varchar("bank_account_number"),
  ifscCode: varchar("ifsc_code"),
  upiId: varchar("upi_id"),
  
  // Agent Type and Status
  agentType: varchar("agent_type").default("individual"), // individual, corporate, sub_broker
  status: varchar("status").default("active"), // active, inactive, suspended, terminated
  isActive: boolean("is_active").default(true),
  
  // Performance Metrics
  activeClients: integer("active_clients").default(0),
  totalClients: integer("total_clients").default(0),
  totalRevenue: decimal("total_revenue", { precision: 15, scale: 2 }).default("0.00"),
  monthlyRevenue: decimal("monthly_revenue", { precision: 15, scale: 2 }).default("0.00"),
  totalCommissionsEarned: decimal("total_commissions_earned", { precision: 15, scale: 2 }).default("0.00"),
  
  // Hierarchy and Reporting
  reportingTo: varchar("reporting_to").references(() => agents.id), // Manager/supervisor agent ID
  teamSize: integer("team_size").default(0), // Number of agents reporting to this agent
  hierarchyLevel: integer("hierarchy_level").default(1), // 1 = frontline, 2 = team lead, 3 = manager, etc.
  
  // Joining and Contract Details
  joiningDate: timestamp("joining_date"),
  terminationDate: timestamp("termination_date"),
  contractType: varchar("contract_type").default("full_time"), // full_time, part_time, freelance, commission_only
  
  // Commission Structure
  commissionTier: varchar("commission_tier").default("standard"), // standard, silver, gold, platinum
  baseCommissionRate: decimal("base_commission_rate", { precision: 5, scale: 2 }).default("0.00"), // Base % commission
  
  // NISM-V-A Certification (Required for Mutual Fund Distribution)
  nismCertificateNumber: varchar("nism_certificate_number"), // NISM Series V-A certificate number
  nismValidTill: timestamp("nism_valid_till"), // Certificate expiry date
  nismCertificateUrl: text("nism_certificate_url"), // Document URL in object storage
  nismStatus: varchar("nism_status").default("pending"), // pending, verified, expired, rejected
  
  // KYD Verification (Know Your Distributor - Biometric & Identity)
  kydVerificationStatus: varchar("kyd_verification_status").default("pending"), // pending, verified, failed, expired
  kydVerifiedAt: timestamp("kyd_verified_at"),
  kydReferenceNumber: varchar("kyd_reference_number"), // KYD verification reference ID
  kydDocumentUrl: text("kyd_document_url"), // KYD proof document URL
  
  // ARN & EUIN Validity Tracking
  arnValidTill: timestamp("arn_valid_till"), // ARN (AMFI Registration Number) validity
  euinValidTill: timestamp("euin_valid_till"), // EUIN validity
  arnStatus: varchar("arn_status").default("pending"), // pending, active, expired, suspended, cancelled
  euinStatus: varchar("euin_status").default("pending"), // pending, active, expired, suspended
  
  // Compliance Status and Documents
  complianceStatus: varchar("compliance_status").default("incomplete"), // incomplete, compliant, non_compliant, under_review
  certificationDocuments: jsonb("certification_documents"), // Store all certification docs metadata
  lastComplianceCheckAt: timestamp("last_compliance_check_at"),
  complianceRemarks: text("compliance_remarks"), // Admin remarks on compliance status
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zoho OAuth Connections - Store OAuth tokens for Zoho integrations
export const zohoConnections = pgTable("zoho_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Connection Info
  connectionName: varchar("connection_name").notNull(), // 'Production CRM', 'Development Books'
  zohoDataCenter: varchar("zoho_data_center").default("com"), // com, eu, in, com.au, jp
  zohoOrgId: varchar("zoho_org_id"), // Zoho organization ID
  
  // OAuth Tokens
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenType: varchar("token_type").default("Bearer"),
  expiresAt: timestamp("expires_at").notNull(), // Access token expiry (1 hour)
  scope: text("scope"), // API scopes granted
  
  // App Services Enabled
  services: text("services").array().default(sql`ARRAY[]::text[]`), // ['CRM', 'Books', 'Desk', 'WorkDrive', 'People', 'Campaigns']
  
  // Connection Status
  status: varchar("status").default("active"), // active, expired, revoked, error
  lastSyncAt: timestamp("last_sync_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastError: text("last_error"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  isProduction: boolean("is_production").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zoho Entity Mappings - Map FintekPro entities to Zoho entities
export const zohoEntityMappings = pgTable("zoho_entity_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  connectionId: varchar("connection_id").references(() => zohoConnections.id).notNull(),
  
  // FintekPro Side
  fintekproEntityType: varchar("fintekpro_entity_type").notNull(), // 'partner', 'user', 'order', 'commission'
  fintekproEntityId: varchar("fintekpro_entity_id").notNull(),
  
  // Zoho Side
  zohoService: varchar("zoho_service").notNull(), // 'CRM', 'Books', 'Desk'
  zohoModule: varchar("zoho_module").notNull(), // 'Contacts', 'Vendors', 'Tickets'
  zohoRecordId: varchar("zoho_record_id").notNull(),
  zohoRecordData: jsonb("zoho_record_data"), // Cached Zoho record snapshot
  
  // Sync Status
  syncDirection: varchar("sync_direction").default("bidirectional"), // bidirectional, zoho_to_fintekpro, fintekpro_to_zoho
  lastSyncedAt: timestamp("last_synced_at"),
  syncStatus: varchar("sync_status").default("synced"), // synced, pending, conflict, error
  conflictData: jsonb("conflict_data"), // Store conflict details for resolution
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zoho Sync Logs - Track all sync operations
export const zohoSyncLogs = pgTable("zoho_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  connectionId: varchar("connection_id").references(() => zohoConnections.id),
  
  // Operation Details
  operation: varchar("operation").notNull(), // 'create', 'update', 'delete', 'bulk_sync'
  entityType: varchar("entity_type").notNull(),
  direction: varchar("direction").notNull(), // 'to_zoho', 'from_zoho'
  
  // Zoho API Details
  zohoService: varchar("zoho_service").notNull(),
  zohoModule: varchar("zoho_module"),
  zohoApiEndpoint: text("zoho_api_endpoint"),
  zohoRequestPayload: jsonb("zoho_request_payload"),
  zohoResponseData: jsonb("zoho_response_data"),
  
  // Result
  status: varchar("status").notNull(), // success, failure, partial
  recordsProcessed: integer("records_processed").default(0),
  recordsSucceeded: integer("records_succeeded").default(0),
  recordsFailed: integer("records_failed").default(0),
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  
  // Performance
  durationMs: integer("duration_ms"),
  apiCreditsUsed: integer("api_credits_used"),
  
  // Context
  triggeredBy: varchar("triggered_by"), // 'webhook', 'cron', 'manual', 'user_action'
  userId: varchar("user_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Zoho Webhook Events - Store incoming webhook events
export const zohoWebhookEvents = pgTable("zoho_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  connectionId: varchar("connection_id").references(() => zohoConnections.id),
  
  // Webhook Details
  zohoService: varchar("zoho_service").notNull(),
  zohoModule: varchar("zoho_module").notNull(),
  eventType: varchar("event_type").notNull(), // 'create', 'update', 'delete', 'custom'
  zohoRecordId: varchar("zoho_record_id"),
  
  // Payload
  webhookPayload: jsonb("webhook_payload").notNull(),
  headers: jsonb("headers"),
  
  // Processing Status
  status: varchar("status").default("pending"), // pending, processing, completed, failed
  processedAt: timestamp("processed_at"),
  processingError: text("processing_error"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Mapping Result
  mappingId: varchar("mapping_id").references(() => zohoEntityMappings.id),
  
  // Deduplication
  zohoEventId: varchar("zoho_event_id").unique(), // Zoho's unique event ID if available
  
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
  category: varchar("category").notNull(), // 'mutual_fund', 'insurance', 'loan', 'credit_card', 'deposit', 'bond', 'ncd', 'mld', 'ipo', 'pre_ipo', 'unlisted', 'global_stock', 'global_fund'
  subCategory: varchar("sub_category"), // Specific type within category
  provider: varchar("provider"), // Provider/AMC/Bank name
  // Pricing and features
  basePrice: decimal("base_price", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 8, scale: 4 }),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  features: jsonb("features").default({}), // Product features and benefits
  eligibilityCriteria: jsonb("eligibility_criteria").default({}),
  documents: jsonb("documents").default([]), // Required documents
  // Performance tracking - Short term
  returns1m: decimal("returns_1m", { precision: 8, scale: 4 }),
  returns3m: decimal("returns_3m", { precision: 8, scale: 4 }),
  returns6m: decimal("returns_6m", { precision: 8, scale: 4 }),
  // Performance tracking - Long term
  returns1y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returns5y: decimal("returns_5y", { precision: 8, scale: 4 }),
  returnsSinceInception: decimal("returns_since_inception", { precision: 8, scale: 4 }),
  // Risk and ratings
  riskLevel: varchar("risk_level"), // 'low', 'medium', 'high', 'very_high'
  creditRating: varchar("credit_rating"), // For bonds/NCDs: AAA, AA+, etc.
  performanceTag: varchar("performance_tag"), // Auto-calculated: 'top_performer', 'rising_star', 'stable', 'high_growth'
  // Fund fact sheet details - Exit loads and fees
  exitLoad: jsonb("exit_load"), // [{ period: "0-1 year", load: "1%" }]
  entryLoad: decimal("entry_load", { precision: 5, scale: 2 }),
  expenseRatio: decimal("expense_ratio", { precision: 5, scale: 2 }),
  totalExpenseRatio: decimal("total_expense_ratio", { precision: 5, scale: 2 }), // TER
  // Investment style and factors
  investmentStyle: varchar("investment_style"), // 'value', 'growth', 'blend', 'income'
  marketCapFocus: varchar("market_cap_focus"), // 'large', 'mid', 'small', 'multi'
  strategyFactors: text("strategy_factors").array(), // ['momentum', 'quality', 'low_volatility']
  sectorFocus: varchar("sector_focus"), // 'technology', 'healthcare', 'banking', 'diversified'
  investmentTheme: varchar("investment_theme"), // 'esg', 'infrastructure', 'consumption', 'export'
  // Fund fact sheet and holdings
  fundFactSheetUrl: varchar("fund_fact_sheet_url"),
  factSheetLastUpdated: timestamp("fact_sheet_last_updated"),
  portfolioHoldings: jsonb("portfolio_holdings"), // Top holdings: [{ name, weight, sector }]
  sectorAllocation: jsonb("sector_allocation"), // {technology: 25, healthcare: 15, ...}
  assetAllocationEquity: decimal("asset_allocation_equity", { precision: 5, scale: 2 }),
  assetAllocationDebt: decimal("asset_allocation_debt", { precision: 5, scale: 2 }),
  assetAllocationCash: decimal("asset_allocation_cash", { precision: 5, scale: 2 }),
  // Fund manager details
  fundManagerName: varchar("fund_manager_name"),
  fundManagerTenure: integer("fund_manager_tenure"), // months
  // Performance metrics
  benchmarkIndex: varchar("benchmark_index"), // 'NIFTY 50', 'SENSEX', 'NIFTY Midcap 100'
  sharpeRatio: decimal("sharpe_ratio", { precision: 8, scale: 4 }),
  alphaRatio: decimal("alpha_ratio", { precision: 8, scale: 4 }),
  betaRatio: decimal("beta_ratio", { precision: 8, scale: 4 }),
  standardDeviation: decimal("standard_deviation", { precision: 8, scale: 4 }),
  // Product characteristics
  isFeatured: boolean("is_featured").default(false),
  isNew: boolean("is_new").default(false),
  badge: varchar("badge"), // 'HOT', 'NEW', 'PREMIUM', 'TRENDING'
  // Product status and visibility
  status: varchar("status").default("draft"), // 'draft', 'active', 'suspended', 'discontinued'
  isPublic: boolean("is_public").default(false), // Visible to end users
  priority: integer("priority").default(0), // Display priority
  // SEO and metadata
  slug: varchar("slug").unique(),
  tags: text("tags").array().default([]),
  imageUrl: varchar("image_url"),
  // Data freshness
  lastPerformanceUpdate: timestamp("last_performance_update"),
  dataSource: varchar("data_source"), // 'api', 'manual', 'calculated'
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

// Investment proposals table for AI and RM portfolio improvement suggestions
export const investmentProposals = pgTable("investment_proposals", {
  id: varchar("id").primaryKey(), // Custom ID with prefix: AI-xxx, AGENT-xxx, CLIENT-xxx
  // Core relationships
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id), // Nullable for AI and client proposals
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Proposal source identification
  proposalSource: varchar("proposal_source").notNull().default("agent"), // 'ai', 'agent', 'client', or 'hybrid'
  aiModelVersion: varchar("ai_model_version"), // AI model version used for generation
  aiConfidenceScore: decimal("ai_confidence_score", { precision: 5, scale: 2 }), // AI confidence 0-100
  
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
  status: varchar("status").default("pending"), // pending, approved, rejected, executed, cancelled, in_cart
  clientResponse: text("client_response"), // Client's approval/rejection reason
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  executedAt: timestamp("executed_at"),
  addedToCartAt: timestamp("added_to_cart_at"), // When proposal was added to cart
  cartItemId: varchar("cart_item_id"), // Reference to cart item
  
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
  
  // Cart integration
  isAddedToCart: boolean("is_added_to_cart").default(false),
  cartItemId: varchar("cart_item_id"), // Reference to cart item when added
  
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
  
  // FintekPro Smart Rating (stored in legacy crisil_* columns for backwards compatibility)
  crisilRating: integer("crisil_rating"), // 1-5 scale (1 = very good performance) - Now stores FintekPro Smart Rating
  crisilCategory: varchar("crisil_category"), // equity/debt/hybrid
  crisilPercentile: decimal("crisil_percentile", { precision: 5, scale: 2 }), // 0-100 percentile ranking
  crisilEvaluationDate: timestamp("crisil_evaluation_date"), // Last evaluation date
  crisilRiskAdjustedScore: decimal("crisil_risk_adjusted_score", { precision: 8, scale: 4 }), // Risk-adjusted returns score
  crisilAssetQualityScore: decimal("crisil_asset_quality_score", { precision: 8, scale: 4 }), // Asset quality score
  crisilLiquidityScore: decimal("crisil_liquidity_score", { precision: 8, scale: 4 }), // Liquidity score
  crisilConcentrationScore: decimal("crisil_concentration_score", { precision: 8, scale: 4 }), // Asset concentration score
  crisilOverallScore: decimal("crisil_overall_score", { precision: 8, scale: 4 }), // Overall composite score
  crisilDataSource: varchar("crisil_data_source").default("calculated"), // calculated/api/manual
  crisilLastUpdated: timestamp("crisil_last_updated").defaultNow(),
  
  // Extended fund data (stores currentNav, navDate, returns, returnStrings, rating, minInvestment, exitLoad, etc.)
  extendedData: jsonb("extended_data"),
  
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

export const insertCkycDocumentSchema = createInsertSchema(ckycDocuments).omit({
  id: true,
  uploadedAt: true,
  verifiedAt: true,
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

export const insertRebalanceExecutionSchema = createInsertSchema(rebalanceExecutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRebalanceTransactionSchema = createInsertSchema(rebalanceTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertRebalancingPreferencesSchema = createInsertSchema(rebalancingPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComprehensiveHoldingSchema = createInsertSchema(comprehensiveHoldings).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
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

export const insertSmartKycProgressSchema = createInsertSchema(smartKycProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCorporateKycProgressSchema = createInsertSchema(corporateKycProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNriKycProgressSchema = createInsertSchema(nriKycProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// KYC Verification Sessions schemas and types
export const insertKycVerificationSessionSchema = createInsertSchema(kycVerificationSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertKycVerificationSession = z.infer<typeof insertKycVerificationSessionSchema>;
export type KycVerificationSession = typeof kycVerificationSessions.$inferSelect;

// User Bank Accounts schemas and types  
export const insertUserBankAccountSchema = createInsertSchema(userBankAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserBankAccount = z.infer<typeof insertUserBankAccountSchema>;
export type UserBankAccount = typeof userBankAccounts.$inferSelect;

// User Demat Accounts schemas and types  
export const insertUserDematAccountSchema = createInsertSchema(userDematAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserDematAccount = z.infer<typeof insertUserDematAccountSchema>;
export type UserDematAccount = typeof userDematAccounts.$inferSelect;

// Product Account Preferences schemas and types
export const insertProductAccountPreferenceSchema = createInsertSchema(productAccountPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProductAccountPreference = z.infer<typeof insertProductAccountPreferenceSchema>;
export type ProductAccountPreference = typeof productAccountPreferences.$inferSelect;

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
export type InsertCkycDocument = z.infer<typeof insertCkycDocumentSchema>;
export type InsertCkycRecord = z.infer<typeof insertCkycRecordSchema>;
export type UpsertCkycRecord = typeof ckycRecords.$inferInsert;

export type CkycDocument = typeof ckycDocuments.$inferSelect;

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

// Partner Referral schemas
export const insertPartnerReferralSchema = createInsertSchema(partnerReferrals).omit({
  id: true,
  createdAt: true,
});
export type InsertPartnerReferral = z.infer<typeof insertPartnerReferralSchema>;
export type PartnerReferral = typeof partnerReferrals.$inferSelect;

// Partner Commission schemas
export const insertPartnerCommissionSchema = createInsertSchema(partnerCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerCommission = z.infer<typeof insertPartnerCommissionSchema>;
export type PartnerCommission = typeof partnerCommissions.$inferSelect;

// Partner Settlement schemas
export const insertPartnerSettlementSchema = createInsertSchema(partnerSettlements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerSettlement = z.infer<typeof insertPartnerSettlementSchema>;
export type PartnerSettlement = typeof partnerSettlements.$inferSelect;

// Agent schemas
export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Zoho Connections schemas
export const insertZohoConnectionSchema = createInsertSchema(zohoConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertZohoConnection = z.infer<typeof insertZohoConnectionSchema>;
export type ZohoConnection = typeof zohoConnections.$inferSelect;

// Zoho Entity Mappings schemas
export const insertZohoEntityMappingSchema = createInsertSchema(zohoEntityMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertZohoEntityMapping = z.infer<typeof insertZohoEntityMappingSchema>;
export type ZohoEntityMapping = typeof zohoEntityMappings.$inferSelect;

// Zoho Sync Logs schemas
export const insertZohoSyncLogSchema = createInsertSchema(zohoSyncLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertZohoSyncLog = z.infer<typeof insertZohoSyncLogSchema>;
export type ZohoSyncLog = typeof zohoSyncLogs.$inferSelect;

// Zoho Webhook Events schemas
export const insertZohoWebhookEventSchema = createInsertSchema(zohoWebhookEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertZohoWebhookEvent = z.infer<typeof insertZohoWebhookEventSchema>;
export type ZohoWebhookEvent = typeof zohoWebhookEvents.$inferSelect;

// Agent Portal API response types
export const agentProfileApiSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  employeeId: z.string().nullable(),
  euinNumber: z.string().nullable(),
  arnCode: z.string().nullable(),
  distributorId: z.string().nullable(),
  specializations: z.array(z.string()),
  languages: z.array(z.string()),
  status: z.string()
});

export const agentStatsApiSchema = z.object({
  totalPartners: z.number(),
  activePartners: z.number(), 
  totalClients: z.number(),
  activeClients: z.number(),
  monthlyCommissions: z.string(),
  commissionGrowth: z.number(),
  pendingTasks: z.number(),
  urgentTasks: z.number(),
  recentActivity: z.array(z.object({
    description: z.string(),
    timestamp: z.string()
  }))
});

export const partnerApiSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  address: z.string().optional(),
  website: z.string().optional(),
  partnerType: z.enum(["product_provider", "service_provider", "both"]),
  businessLicense: z.string().optional(),
  taxId: z.string().optional(),
  euinNumber: z.string().nullable(),
  arnCode: z.string().nullable(),
  masterAgentEuin: z.string().nullable(),
  hasEuinArn: z.boolean()
});

// API response types for agent portal
export type AgentProfile = z.infer<typeof agentProfileApiSchema>;
export type AgentStats = z.infer<typeof agentStatsApiSchema>;
export type AgentPartner = z.infer<typeof partnerApiSchema>;

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

// Agent Commission Split schemas
export const insertAgentCommissionSplitSchema = createInsertSchema(agentCommissionSplits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentCommissionSplit = z.infer<typeof insertAgentCommissionSplitSchema>;
export type AgentCommissionSplit = typeof agentCommissionSplits.$inferSelect;

// Agent Documents schemas
export const insertAgentDocumentSchema = createInsertSchema(agentDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentDocument = z.infer<typeof insertAgentDocumentSchema>;
export type AgentDocument = typeof agentDocuments.$inferSelect;

// Agent Commissions schemas
export const insertAgentCommissionSchema = createInsertSchema(agentCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentCommission = z.infer<typeof insertAgentCommissionSchema>;
export type AgentCommission = typeof agentCommissions.$inferSelect;

// AMFI Verification Log schemas
export const insertAmfiVerificationLogSchema = createInsertSchema(amfiVerificationLog).omit({
  id: true,
  createdAt: true,
});
export type InsertAmfiVerificationLog = z.infer<typeof insertAmfiVerificationLogSchema>;
export type AmfiVerificationLog = typeof amfiVerificationLog.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;
export type SmartKycProgress = typeof smartKycProgress.$inferSelect;
export type InsertSmartKycProgress = z.infer<typeof insertSmartKycProgressSchema>;
export type CorporateKycProgress = typeof corporateKycProgress.$inferSelect;
export type InsertCorporateKycProgress = z.infer<typeof insertCorporateKycProgressSchema>;
export type NriKycProgress = typeof nriKycProgress.$inferSelect;
export type InsertNriKycProgress = z.infer<typeof insertNriKycProgressSchema>;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;
export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlists.$inferSelect;
export type MarketData = typeof marketData.$inferSelect;
export type AssetAllocation = typeof assetAllocation.$inferSelect;
export type InsertAssetAllocation = z.infer<typeof insertAssetAllocationSchema>;
export type RebalanceExecution = typeof rebalanceExecutions.$inferSelect;
export type InsertRebalanceExecution = z.infer<typeof insertRebalanceExecutionSchema>;
export type RebalanceTransaction = typeof rebalanceTransactions.$inferSelect;
export type InsertRebalanceTransaction = z.infer<typeof insertRebalanceTransactionSchema>;
export type RebalancingPreferences = typeof rebalancingPreferences.$inferSelect;
export type InsertRebalancingPreferences = z.infer<typeof insertRebalancingPreferencesSchema>;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = z.infer<typeof insertPortfolioSnapshotSchema>;
export type ComprehensiveHolding = typeof comprehensiveHoldings.$inferSelect;
export type InsertComprehensiveHolding = z.infer<typeof insertComprehensiveHoldingSchema>;
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

// Client Data Enrichment Tables for AI-powered analytics and external data integration

// External Data Sources table for tracking API integrations used for client enrichment
export const externalDataSources = pgTable("external_data_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceName: varchar("source_name").notNull(), // gstin, pan_verification, credit_score, bank_statement, social_media
  sourceType: varchar("source_type").notNull(), // financial, regulatory, social, business, verification
  provider: varchar("provider").notNull(), // karza, signzy, bureau, bank_api, fintech_api
  apiEndpoint: varchar("api_endpoint"),
  isActive: boolean("is_active").default(true),
  rateLimit: integer("rate_limit_per_hour"),
  costPerCall: decimal("cost_per_call", { precision: 10, scale: 4 }),
  dataRetentionDays: integer("data_retention_days").default(365),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client Data Enrichment records - stores enriched data from various external sources
export const clientEnrichmentData = pgTable("client_enrichment_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sourceId: varchar("source_id").references(() => externalDataSources.id).notNull(),
  
  // Enrichment metadata
  enrichmentType: varchar("enrichment_type").notNull(), // financial_profile, business_details, social_insights, credit_analysis
  dataCategory: varchar("data_category").notNull(), // income_verification, business_turnover, social_connections, credit_behavior
  
  // Raw and processed data
  rawData: jsonb("raw_data"), // Original API response
  processedData: jsonb("processed_data"), // AI-processed insights
  enrichmentScore: integer("enrichment_score"), // 0-100 quality score
  confidenceLevel: varchar("confidence_level"), // high, medium, low
  
  // Financial insights (if applicable)
  estimatedIncome: decimal("estimated_income", { precision: 15, scale: 2 }),
  incomeStability: varchar("income_stability"), // stable, volatile, seasonal
  spendingPattern: jsonb("spending_pattern"), // Category-wise spending analysis
  creditworthiness: varchar("creditworthiness"), // excellent, good, fair, poor
  riskIndicators: jsonb("risk_indicators"), // Array of identified risk factors
  
  // Business insights (if applicable)
  businessTurnover: decimal("business_turnover", { precision: 15, scale: 2 }),
  businessType: varchar("business_type"), 
  industryRisk: varchar("industry_risk"), // low, medium, high
  businessVintage: integer("business_vintage_months"),
  gstCompliance: varchar("gst_compliance"), // compliant, irregular, non_compliant
  
  // Social and behavioral insights
  digitalFootprint: jsonb("digital_footprint"), // Online presence analysis
  socialConnections: jsonb("social_connections"), // Professional network insights
  lifestyleIndicators: jsonb("lifestyle_indicators"), // Spending on lifestyle categories
  
  // Verification status and metadata
  isVerified: boolean("is_verified").default(false),
  verificationMethod: varchar("verification_method"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  expiryDate: timestamp("expiry_date"), // When this data becomes stale
  
  // AI processing metadata
  aiModelUsed: varchar("ai_model_used"), // Which AI model processed this data
  processingTime: integer("processing_time_ms"),
  apiCallCount: integer("api_call_count").default(1), // Number of API calls made for this enrichment
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Transaction Tracking - comprehensive transaction monitoring both on-site and external
export const aiTransactionTracking = pgTable("ai_transaction_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Transaction identification
  transactionId: varchar("transaction_id").notNull(), // Unique transaction identifier
  externalTransactionId: varchar("external_transaction_id"), // Bank/payment gateway transaction ID
  transactionHash: varchar("transaction_hash"), // Hash for duplicate detection
  
  // Transaction details
  transactionType: varchar("transaction_type").notNull(), // deposit, withdrawal, transfer, investment, loan_payment, bill_payment
  transactionCategory: varchar("transaction_category"), // salary, business_income, investment_redemption, loan_disbursement
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("INR"),
  
  // Source and destination
  sourceType: varchar("source_type").notNull(), // internal_platform, bank_account, payment_gateway, investment_account
  sourceAccount: varchar("source_account"), // Account identifier
  destinationType: varchar("destination_type"), 
  destinationAccount: varchar("destination_account"),
  
  // Transaction source tracking
  isOnSiteTransaction: boolean("is_on_site_transaction").default(false), // Happened on our platform
  platformSource: varchar("platform_source"), // wealth_management, loan_portal, payment_gateway
  
  // External transaction tracking (bank/payment APIs)
  bankTransactionId: varchar("bank_transaction_id"),
  bankName: varchar("bank_name"),
  paymentMethod: varchar("payment_method"), // upi, netbanking, card, wallet, cash
  merchantCategory: varchar("merchant_category"), // MCC code or category
  merchantName: varchar("merchant_name"),
  
  // AI-generated insights
  transactionPattern: varchar("transaction_pattern"), // regular, irregular, suspicious, unusual
  riskScore: integer("risk_score"), // 0-100 AI-calculated risk score
  anomalyScore: integer("anomaly_score"), // 0-100 anomaly detection score
  behaviorAnalysis: jsonb("behavior_analysis"), // AI insights on transaction behavior
  
  // Income/expense classification
  incomeCategory: varchar("income_category"), // salary, business, investment, loan, other
  expenseCategory: varchar("expense_category"), // necessity, lifestyle, investment, loan_payment, bills
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency"), // monthly, weekly, quarterly
  
  // Compliance and monitoring
  amlFlag: boolean("aml_flag").default(false), // Anti-Money Laundering flag
  complianceStatus: varchar("compliance_status").default("cleared"), // cleared, flagged, under_review
  complianceNotes: text("compliance_notes"),
  requiresManualReview: boolean("requires_manual_review").default(false),
  
  // Geographic and timing insights
  transactionLocation: varchar("transaction_location"), // City/region if available
  timeOfDay: varchar("time_of_day"), // morning, afternoon, evening, night
  dayOfWeek: varchar("day_of_week"),
  isWeekend: boolean("is_weekend").default(false),
  
  // API source metadata (for external transactions)
  apiSource: varchar("api_source"), // icici_api, hdfc_api, upi_api, card_api
  apiCallId: varchar("api_call_id"), // Reference to API call that fetched this
  dataFreshness: varchar("data_freshness"), // real_time, near_real_time, batch_update
  
  // Transaction date and processing
  transactionDate: timestamp("transaction_date").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
  lastAnalyzedAt: timestamp("last_analyzed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transaction Enrichment Analysis - stores AI-generated insights and patterns
export const transactionEnrichmentAnalysis = pgTable("transaction_enrichment_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  analysisType: varchar("analysis_type").notNull(), // monthly_pattern, spending_behavior, income_analysis, risk_assessment
  
  // Analysis period
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  transactionCount: integer("transaction_count").default(0),
  
  // Financial insights
  totalInflow: decimal("total_inflow", { precision: 15, scale: 2 }),
  totalOutflow: decimal("total_outflow", { precision: 15, scale: 2 }),
  netCashFlow: decimal("net_cash_flow", { precision: 15, scale: 2 }),
  averageMonthlyIncome: decimal("average_monthly_income", { precision: 15, scale: 2 }),
  averageMonthlyExpense: decimal("average_monthly_expense", { precision: 15, scale: 2 }),
  
  // Behavioral patterns
  spendingPatterns: jsonb("spending_patterns"), // Category-wise spending analysis
  incomePatterns: jsonb("income_patterns"), // Income source analysis
  timingPatterns: jsonb("timing_patterns"), // When user typically transacts
  frequencyPatterns: jsonb("frequency_patterns"), // Transaction frequency analysis
  
  // Risk assessment
  riskFactors: jsonb("risk_factors"), // Identified risk factors
  riskScore: integer("risk_score"), // Overall risk score 0-100
  riskCategory: varchar("risk_category"), // low, medium, high, very_high
  creditworthinessScore: integer("creditworthiness_score"), // 0-100
  
  // Investment capacity analysis
  disposableIncome: decimal("disposable_income", { precision: 15, scale: 2 }),
  investmentCapacity: decimal("investment_capacity", { precision: 15, scale: 2 }),
  emergencyFundStatus: varchar("emergency_fund_status"), // adequate, partial, insufficient
  debtToIncomeRatio: decimal("debt_to_income_ratio", { precision: 5, scale: 2 }),
  
  // AI model metadata
  aiModelVersion: varchar("ai_model_version"),
  analysisConfidence: integer("analysis_confidence"), // 0-100 confidence in analysis
  lastUpdated: timestamp("last_updated").defaultNow(),
  nextAnalysisDate: timestamp("next_analysis_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Real-time Transaction Alerts for monitoring and compliance
export const transactionAlerts = pgTable("transaction_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  transactionId: varchar("transaction_id").references(() => aiTransactionTracking.id),
  
  // Alert classification
  alertType: varchar("alert_type").notNull(), // suspicious_activity, large_transaction, unusual_pattern, compliance_violation
  severity: varchar("severity").notNull(), // low, medium, high, critical
  alertCategory: varchar("alert_category").notNull(), // aml, fraud, risk, compliance, investment_opportunity
  
  // Alert details
  alertTitle: varchar("alert_title").notNull(),
  alertDescription: text("alert_description").notNull(),
  riskScore: integer("risk_score"), // 0-100
  confidenceLevel: integer("confidence_level"), // 0-100 AI confidence in alert
  
  // Triggering conditions
  triggerConditions: jsonb("trigger_conditions"), // What triggered this alert
  thresholdExceeded: jsonb("threshold_exceeded"), // Which thresholds were exceeded
  historicalComparison: jsonb("historical_comparison"), // How this compares to user's history
  
  // Status and resolution
  status: varchar("status").default("open"), // open, investigating, resolved, false_positive
  assignedTo: varchar("assigned_to").references(() => users.id), // Compliance officer assigned
  resolutionNotes: text("resolution_notes"),
  resolutionAction: varchar("resolution_action"), // no_action, client_contacted, account_flagged, case_escalated
  
  // Notification and communication
  notificationSent: boolean("notification_sent").default(false),
  notificationMethod: varchar("notification_method"), // email, sms, whatsapp, dashboard
  clientNotified: boolean("client_notified").default(false),
  requiresClientResponse: boolean("requires_client_response").default(false),
  
  // Follow-up and tracking
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  escalationLevel: integer("escalation_level").default(0), // 0=normal, 1=supervisor, 2=compliance_head
  regulatoryReportingRequired: boolean("regulatory_reporting_required").default(false),
  
  // Metadata
  alertSource: varchar("alert_source"), // ai_model, rule_engine, manual_review, external_system
  detectedAt: timestamp("detected_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// External API Integration Logs for tracking data source usage and costs
export const apiIntegrationLogs = pgTable("api_integration_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sourceId: varchar("source_id").references(() => externalDataSources.id).notNull(),
  
  // API call details
  apiEndpoint: varchar("api_endpoint").notNull(),
  httpMethod: varchar("http_method").default("GET"),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  
  // Response metadata
  statusCode: integer("status_code"),
  responseTime: integer("response_time_ms"),
  success: boolean("success").default(false),
  errorMessage: text("error_message"),
  
  // Usage tracking
  dataPoints: integer("data_points"), // Number of data points retrieved
  costIncurred: decimal("cost_incurred", { precision: 10, scale: 4 }),
  rateLimit: jsonb("rate_limit"), // Rate limit information from response
  
  // Data quality
  dataQuality: varchar("data_quality"), // high, medium, low
  dataCompleteness: integer("data_completeness"), // 0-100 percentage
  confidenceScore: integer("confidence_score"), // 0-100
  
  // Processing details
  enrichmentTriggered: boolean("enrichment_triggered").default(false),
  aiProcessingTime: integer("ai_processing_time_ms"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema exports for the new enrichment and tracking tables
export const insertExternalDataSourceSchema = createInsertSchema(externalDataSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientEnrichmentDataSchema = createInsertSchema(clientEnrichmentData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiTransactionTrackingSchema = createInsertSchema(aiTransactionTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionEnrichmentAnalysisSchema = createInsertSchema(transactionEnrichmentAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionAlertSchema = createInsertSchema(transactionAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiIntegrationLogSchema = createInsertSchema(apiIntegrationLogs).omit({
  id: true,
  createdAt: true,
});

// TypeScript types for the new tables
export type ExternalDataSource = typeof externalDataSources.$inferSelect;
export type InsertExternalDataSource = typeof externalDataSources.$inferInsert;
export type ClientEnrichmentData = typeof clientEnrichmentData.$inferSelect;
export type InsertClientEnrichmentData = typeof clientEnrichmentData.$inferInsert;
export type AiTransactionTracking = typeof aiTransactionTracking.$inferSelect;
export type InsertAiTransactionTracking = typeof aiTransactionTracking.$inferInsert;
export type TransactionEnrichmentAnalysis = typeof transactionEnrichmentAnalysis.$inferSelect;
export type InsertTransactionEnrichmentAnalysis = typeof transactionEnrichmentAnalysis.$inferInsert;
export type TransactionAlert = typeof transactionAlerts.$inferSelect;
export type InsertTransactionAlert = typeof transactionAlerts.$inferInsert;
export type ApiIntegrationLog = typeof apiIntegrationLogs.$inferSelect;
export type InsertApiIntegrationLog = typeof apiIntegrationLogs.$inferInsert;

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

// NPS Accounts types
export type NpsAccount = typeof npsAccounts.$inferSelect;
export type InsertNpsAccount = typeof npsAccounts.$inferInsert;

export const insertNpsAccountSchema = createInsertSchema(npsAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
});

// APY Accounts types
export type ApyAccount = typeof apyAccounts.$inferSelect;
export type InsertApyAccount = typeof apyAccounts.$inferInsert;

export const insertApyAccountSchema = createInsertSchema(apyAccounts).omit({
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

// KYC Form Progress - Multi-step wizard progress tracking with auto-save
export const kycFormProgress = pgTable("kyc_form_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id),
  
  // Progress Tracking
  currentStep: integer("current_step").default(1), // 1=Personal, 2=Address, 3=Bank, 4=Documents, 5=Review
  completedSteps: jsonb("completed_steps").default([]), // Array of completed step numbers [1,2,3]
  completionPercentage: integer("completion_percentage").default(0), // 0-100
  
  // Form Data for Each Step (stored as JSON)
  personalDetailsData: jsonb("personal_details_data"), // Step 1 data
  addressDetailsData: jsonb("address_details_data"), // Step 2 data
  bankDetailsData: jsonb("bank_details_data"), // Step 3 data
  documentDetailsData: jsonb("document_details_data"), // Step 4 data
  
  // API Auto-population Tracking
  panDataSource: varchar("pan_data_source"), // 'bse_star', 'manual', 'digilocker'
  aadharDataSource: varchar("aadhar_data_source"), // 'digilocker', 'bse_star', 'manual'
  addressDataSource: varchar("address_data_source"), // 'digilocker', 'bse_star', 'manual'
  autoPopulatedFields: jsonb("auto_populated_fields"), // List of fields auto-filled
  
  // Resume Capability
  canResume: boolean("can_resume").default(true),
  lastSavedAt: timestamp("last_saved_at").defaultNow(),
  resumeUrl: varchar("resume_url"), // Deep link to resume at specific step
  
  // Status
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const insertKycFormProgressSchema = createInsertSchema(kycFormProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Manual KYC Submissions - Comprehensive offline/manual KYC submission system
export const manualKycSubmissions = pgTable("manual_kyc_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Application Type
  applicantType: varchar("applicant_type").notNull(), // 'individual', 'corporate', 'nri'
  
  // Common Fields
  pan: varchar("pan").notNull(),
  email: varchar("email").notNull(),
  mobile: varchar("mobile").notNull(),
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  pincode: varchar("pincode").notNull(),
  
  // Individual Fields
  firstName: varchar("first_name"),
  middleName: varchar("middle_name"),
  lastName: varchar("last_name"),
  dateOfBirth: varchar("date_of_birth"),
  fatherName: varchar("father_name"),
  motherName: varchar("mother_name"),
  
  // Corporate Fields
  companyName: varchar("company_name"),
  registrationNumber: varchar("registration_number"),
  incorporationDate: varchar("incorporation_date"),
  authorizedSignatoryName: varchar("authorized_signatory_name"),
  
  // NRI Fields
  countryOfResidence: varchar("country_of_residence"),
  passportNumber: varchar("passport_number"),
  visaType: varchar("visa_type"),
  
  // Document Storage (JSON object with document URLs)
  documents: jsonb("documents").notNull(), // { pan_card: "url", aadhar_front: "url", ... }
  
  // Status and Review
  status: varchar("status").default("pending_review"), // pending_review, under_review, approved, rejected, requires_clarification
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  
  // Compliance and Verification
  amlStatus: varchar("aml_status").default("pending"), // pending, clear, flagged
  amlCheckedAt: timestamp("aml_checked_at"),
  verificationScore: integer("verification_score"), // 0-100 automated verification score
  
  // Metadata
  submittedFrom: varchar("submitted_from"), // ip_address or device info
  userAgent: text("user_agent"),
  submissionChannel: varchar("submission_channel").default("web"), // web, mobile, agent_assisted
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Manual KYC Document Upload History
export const manualKycDocuments = pgTable("manual_kyc_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").references(() => manualKycSubmissions.id).notNull(),
  documentType: varchar("document_type").notNull(), // pan_card, aadhar_front, passport, etc.
  documentUrl: text("document_url").notNull(),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size"), // in bytes
  mimeType: varchar("mime_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  verificationStatus: varchar("verification_status").default("pending"), // pending, verified, rejected
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
});

// Zod schemas for Manual KYC
export const insertManualKycSubmissionSchema = createInsertSchema(manualKycSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertManualKycDocumentSchema = createInsertSchema(manualKycDocuments).omit({
  id: true,
  uploadedAt: true,
});

// Export types for Manual KYC
export type ManualKycSubmission = typeof manualKycSubmissions.$inferSelect;
export type InsertManualKycSubmission = z.infer<typeof insertManualKycSubmissionSchema>;
export type ManualKycDocument = typeof manualKycDocuments.$inferSelect;
export type InsertManualKycDocument = z.infer<typeof insertManualKycDocumentSchema>;

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
export type KycFormProgress = typeof kycFormProgress.$inferSelect;
export type InsertKycFormProgress = z.infer<typeof insertKycFormProgressSchema>;

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
  productId: varchar("product_id").references(() => storeProducts.id), // Nullable for proposals/investments
  proposalId: varchar("proposal_id").references(() => investmentProposals.id), // For proposal-based items
  investmentId: varchar("investment_id"), // For investment items (mutual fund scheme code, etc.)
  itemType: varchar("item_type").notNull().default("product"), // 'product', 'proposal', or 'investment'
  quantity: integer("quantity").notNull().default(1),
  investmentAmount: decimal("investment_amount", { precision: 15, scale: 2 }),
  proposalItemIds: text("proposal_item_ids").array(), // Array of proposal item IDs when from proposal
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}), // Flexible metadata for any item type
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
}).refine((data) => {
  // Exactly one of productId, proposalId, or investmentId must be provided
  const hasProduct = !!data.productId;
  const hasProposal = !!data.proposalId;
  const hasInvestment = !!data.investmentId;
  const count = [hasProduct, hasProposal, hasInvestment].filter(Boolean).length;
  return count === 1;
}, {
  message: "Exactly one of productId, proposalId, or investmentId must be provided",
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

// Loan Marketplace Tables
// Loan Products table - Define different loan product types
export const loanProducts = pgTable("loan_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productKey: varchar("product_key").notNull().unique(), // personal, home, lap, las, business, education, vehicle
  productName: varchar("product_name").notNull(),
  category: varchar("category").notNull(), // secured, unsecured
  collateralType: varchar("collateral_type"), // property, securities, vehicle, none
  description: text("description"),
  
  // Product Limits
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }).notNull(),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }).notNull(),
  minTenure: integer("min_tenure").notNull(), // months
  maxTenure: integer("max_tenure").notNull(), // months
  
  // Eligibility Criteria
  minAge: integer("min_age").default(18),
  maxAge: integer("max_age").default(65),
  minIncome: decimal("min_income", { precision: 15, scale: 2 }),
  minCibilScore: integer("min_cibil_score").default(600),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loan Providers table - Banks and NBFCs
export const loanProviders = pgTable("loan_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerKey: varchar("provider_key").notNull().unique(), // icici, hdfc, bajaj_finance, tata_capital, axis, piramal
  providerName: varchar("provider_name").notNull(),
  providerType: varchar("provider_type").notNull(), // bank, nbfc
  logoUrl: varchar("logo_url"),
  description: text("description"),
  
  // Provider Capabilities
  hasApi: boolean("has_api").default(false),
  supportsPrequalification: boolean("supports_prequalification").default(false),
  supportsInstantOffers: boolean("supports_instant_offers").default(false),
  supportsWebhooks: boolean("supports_webhooks").default(false),
  
  // Contact Information
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  website: varchar("website"),
  
  // Processing Information
  avgProcessingTime: varchar("avg_processing_time"), // "2-3 days", "instant", etc.
  processingCutoffTime: varchar("processing_cutoff_time"), // "5 PM"
  
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(100), // Lower number = higher priority
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Provider Products table - Product offerings by each provider
export const providerProducts = pgTable("provider_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  productId: varchar("product_id").references(() => loanProducts.id).notNull(),
  
  // Provider-specific product details
  providerProductName: varchar("provider_product_name"),
  
  // Interest Rate Information
  baseInterestRate: decimal("base_interest_rate", { precision: 5, scale: 2 }).notNull(),
  minInterestRate: decimal("min_interest_rate", { precision: 5, scale: 2 }).notNull(),
  maxInterestRate: decimal("max_interest_rate", { precision: 5, scale: 2 }).notNull(),
  rateType: varchar("rate_type").default("floating"), // fixed, floating, hybrid
  
  // Fee Structure
  processingFeeType: varchar("processing_fee_type").default("percentage"), // percentage, fixed
  processingFeeValue: decimal("processing_fee_value", { precision: 8, scale: 2 }).notNull(),
  maxProcessingFee: decimal("max_processing_fee", { precision: 15, scale: 2 }),
  prepaymentCharges: decimal("prepayment_charges", { precision: 5, scale: 2 }).default("0"),
  latePaymentFee: decimal("late_payment_fee", { precision: 15, scale: 2 }),
  
  // Provider-specific limits
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }),
  minTenure: integer("min_tenure"),
  maxTenure: integer("max_tenure"),
  
  // Eligibility Rules (JSON for flexible conditions)
  eligibilityRules: jsonb("eligibility_rules").default({}),
  
  // Pricing Model (JSON for complex rate structures)
  pricingModel: jsonb("pricing_model").default({}),
  
  // Required Documents
  documentsRequired: jsonb("documents_required").default([]),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credit Profiles table - Enhanced client credit information
export const creditProfiles = pgTable("credit_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Credit Bureau Information
  cibilScore: integer("cibil_score"),
  experianScore: integer("experian_score"),
  equifaxScore: integer("equifax_score"),
  highMarkScore: integer("high_mark_score"),
  lastCreditPullDate: timestamp("last_credit_pull_date"),
  
  // Financial Information
  monthlyIncome: decimal("monthly_income", { precision: 15, scale: 2 }),
  annualIncome: decimal("annual_income", { precision: 15, scale: 2 }),
  employmentType: varchar("employment_type"), // salaried, self_employed, business, professional
  workExperience: integer("work_experience"), // years
  companyType: varchar("company_type"), // government, private, psu, mnc, sme
  
  // Existing Obligations
  existingEMIs: decimal("existing_emis", { precision: 15, scale: 2 }).default("0"),
  existingCreditCards: integer("existing_credit_cards").default(0),
  totalCreditLimit: decimal("total_credit_limit", { precision: 15, scale: 2 }).default("0"),
  creditUtilization: decimal("credit_utilization", { precision: 5, scale: 2 }).default("0"),
  
  // Assets and Liabilities
  netWorth: decimal("net_worth", { precision: 15, scale: 2 }),
  currentAssets: decimal("current_assets", { precision: 15, scale: 2 }),
  totalLiabilities: decimal("total_liabilities", { precision: 15, scale: 2 }),
  propertyOwnership: boolean("property_ownership").default(false),
  propertyValue: decimal("property_value", { precision: 15, scale: 2 }),
  securitiesPortfolio: decimal("securities_portfolio", { precision: 15, scale: 2 }),
  
  // Banking Relationship
  bankingHistory: integer("banking_history").default(0), // years with current bank
  primaryBankName: varchar("primary_bank_name"),
  averageMonthlyBalance: decimal("average_monthly_balance", { precision: 15, scale: 2 }),
  
  // Loan History
  totalLoansAvailed: integer("total_loans_availed").default(0),
  loansClosedSuccessfully: integer("loans_closed_successfully").default(0),
  anyDefaultHistory: boolean("any_default_history").default(false),
  lastLoanDate: timestamp("last_loan_date"),
  
  // Risk Assessment
  riskProfile: varchar("risk_profile").default("medium"), // low, medium, high
  debtToIncomeRatio: decimal("debt_to_income_ratio", { precision: 5, scale: 2 }),
  
  // Raw Bureau Data (for detailed analysis)
  bureauRawData: jsonb("bureau_raw_data"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loan Requests table - Client loan requirements
export const loanRequests = pgTable("loan_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => loanProducts.id).notNull(),
  
  // Loan Requirements
  requestedAmount: decimal("requested_amount", { precision: 15, scale: 2 }).notNull(),
  preferredTenure: integer("preferred_tenure").notNull(), // months
  purpose: text("purpose"),
  
  // Collateral Information (for secured loans)
  collateralDetails: jsonb("collateral_details"),
  estimatedCollateralValue: decimal("estimated_collateral_value", { precision: 15, scale: 2 }),
  
  // Request Status
  status: varchar("status").default("active"), // active, expired, converted
  validityExpiry: timestamp("validity_expiry").default(sql`NOW() + INTERVAL '7 days'`),
  
  // Metadata
  sourceChannel: varchar("source_channel").default("web"), // web, mobile, agent
  referralCode: varchar("referral_code"),
  utmSource: varchar("utm_source"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loan Offers table - Generated offers from providers
export const loanOffers = pgTable("loan_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").references(() => loanRequests.id).notNull(),
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  productId: varchar("product_id").references(() => loanProducts.id).notNull(),
  
  // Offer Details
  approvedAmount: decimal("approved_amount", { precision: 15, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  tenure: integer("tenure").notNull(), // months
  emi: decimal("emi", { precision: 15, scale: 2 }).notNull(),
  
  // Fee Structure
  processingFee: decimal("processing_fee", { precision: 15, scale: 2 }).notNull(),
  legalCharges: decimal("legal_charges", { precision: 15, scale: 2 }).default("0"),
  otherCharges: decimal("other_charges", { precision: 15, scale: 2 }).default("0"),
  totalCost: decimal("total_cost", { precision: 15, scale: 2 }).notNull(),
  
  // Risk Assessment
  eligibilityScore: decimal("eligibility_score", { precision: 5, scale: 2 }).notNull(),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }).notNull(), // Overall offer quality
  approvalProbability: decimal("approval_probability", { precision: 5, scale: 2 }).default("95"),
  
  // Offer Metadata
  offerSource: varchar("offer_source").notNull(), // api, rules_engine
  rateType: varchar("rate_type").default("floating"),
  ltvRatio: decimal("ltv_ratio", { precision: 5, scale: 2 }),
  
  // Terms and Conditions
  terms: jsonb("terms").default([]),
  specialOffers: jsonb("special_offers").default([]),
  
  // Offer Validity
  validUntil: timestamp("valid_until").notNull(),
  isActive: boolean("is_active").default(true),
  
  // Tracking
  viewedAt: timestamp("viewed_at"),
  selectedAt: timestamp("selected_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Loan Applications Marketplace - Application workflow management
export const loanApplicationsMarketplace = pgTable("loan_applications_marketplace", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  offerId: varchar("offer_id").references(() => loanOffers.id).notNull(),
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  productId: varchar("product_id").references(() => loanProducts.id).notNull(),
  
  // Application Reference
  applicationNumber: varchar("application_number").unique(),
  providerApplicationRef: varchar("provider_application_ref"), // Provider's internal reference
  
  // Application Status
  status: varchar("status").default("draft"), // draft, submitted, under_review, approved, rejected, disbursed, cancelled
  stage: varchar("stage").default("initiated"), // initiated, documents_pending, documents_submitted, processing, approved, disbursed
  
  // KYC and Document Status
  kycStatus: varchar("kyc_status").default("pending"), // pending, in_progress, completed, rejected
  documentStatus: varchar("document_status").default("pending"), // pending, uploaded, verified, rejected
  
  // Application Details
  finalAmount: decimal("final_amount", { precision: 15, scale: 2 }).notNull(),
  finalInterestRate: decimal("final_interest_rate", { precision: 5, scale: 2 }).notNull(),
  finalTenure: integer("final_tenure").notNull(),
  finalEMI: decimal("final_emi", { precision: 15, scale: 2 }).notNull(),
  
  // Processing Information
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  disbursedAt: timestamp("disbursed_at"),
  rejectionReason: text("rejection_reason"),
  
  // Disbursement Details
  disbursalAmount: decimal("disbursal_amount", { precision: 15, scale: 2 }),
  disbursalMethod: varchar("disbursal_method"), // bank_transfer, rtgs, neft
  disbursalAccountNumber: varchar("disbursal_account_number"),
  disbursalIfsc: varchar("disbursal_ifsc"),
  
  // Application Checklist
  checklist: jsonb("checklist").default([]),
  nextSteps: jsonb("next_steps").default([]),
  
  // Timeline
  timeline: jsonb("timeline").default([]),
  
  // Communication
  lastCommunicationDate: timestamp("last_communication_date"),
  communicationPreference: varchar("communication_preference").default("email"), // email, sms, whatsapp
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Provider Integrations table - API integration configurations
export const providerIntegrations = pgTable("provider_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  
  // Integration Details
  adapterKey: varchar("adapter_key").notNull(), // icici_api, hdfc_api, bajaj_rules, etc.
  integrationName: varchar("integration_name").notNull(),
  integrationType: varchar("integration_type").notNull(), // api, rules_engine, webhook
  
  // API Configuration
  baseUrl: varchar("base_url"),
  authenticationMethod: varchar("authentication_method"), // api_key, oauth2, certificate
  authConfig: jsonb("auth_config"), // Store auth credentials securely
  
  // Webhook Configuration
  webhookUrl: varchar("webhook_url"),
  webhookSecret: varchar("webhook_secret"),
  webhookEvents: jsonb("webhook_events").default([]),
  
  // Integration Status
  isEnabled: boolean("is_enabled").default(true),
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: varchar("health_status").default("unknown"), // healthy, warning, error, unknown
  
  // Rate Limiting
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60),
  rateLimitPerDay: integer("rate_limit_per_day").default(1000),
  
  // Configuration Metadata
  configVersion: varchar("config_version").default("1.0"),
  supportedFeatures: jsonb("supported_features").default([]),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Application Documents table - Document management for loan applications
export const applicationDocuments = pgTable("application_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplicationsMarketplace.id).notNull(),
  
  // Document Information
  documentType: varchar("document_type").notNull(), // pan_card, aadhar, salary_slip, bank_statement, etc.
  documentName: varchar("document_name").notNull(),
  documentCategory: varchar("document_category").notNull(), // identity, income, address, collateral
  
  // File Details
  fileName: varchar("file_name").notNull(),
  fileFormat: varchar("file_format").notNull(), // pdf, jpg, png
  fileSize: integer("file_size"), // in bytes
  objectStorageKey: varchar("object_storage_key"), // Reference to object storage
  
  // Document Status
  status: varchar("status").default("uploaded"), // uploaded, processing, verified, rejected
  verificationStatus: varchar("verification_status").default("pending"), // pending, verified, rejected
  verificationNotes: text("verification_notes"),
  verifiedBy: varchar("verified_by"),
  verifiedAt: timestamp("verified_at"),
  
  // Provider Integration
  providerDocumentId: varchar("provider_document_id"), // Provider's document reference
  sentToProvider: boolean("sent_to_provider").default(false),
  sentToProviderAt: timestamp("sent_to_provider_at"),
  
  // Metadata
  isRequired: boolean("is_required").default(true),
  uploadedVia: varchar("uploaded_via").default("web"), // web, mobile, email, whatsapp
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create insert schemas for loan marketplace tables
export const insertLoanProductSchema = createInsertSchema(loanProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanProviderSchema = createInsertSchema(loanProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProviderProductSchema = createInsertSchema(providerProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditProfileSchema = createInsertSchema(creditProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanRequestSchema = createInsertSchema(loanRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanOfferSchema = createInsertSchema(loanOffers).omit({
  id: true,
  createdAt: true,
});

export const insertLoanApplicationMarketplaceSchema = createInsertSchema(loanApplicationsMarketplace).omit({
  id: true,
  applicationNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProviderIntegrationSchema = createInsertSchema(providerIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApplicationDocumentSchema = createInsertSchema(applicationDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Loan Comparison Sessions table - Store comparison sessions
export const loanComparisons = pgTable("loan_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Comparison Details
  comparisonName: varchar("comparison_name").notNull(),
  description: text("description"),
  
  // Loan Parameters for Comparison
  comparisonAmount: decimal("comparison_amount", { precision: 15, scale: 2 }).notNull(),
  comparisonTenure: integer("comparison_tenure").notNull(), // months
  loanType: varchar("loan_type").notNull(), // personal, home, business, etc.
  
  // Selected Offers for Comparison
  selectedOffers: jsonb("selected_offers").notNull(), // Array of offer IDs
  
  // Comparison Criteria & Weights
  comparisonCriteria: jsonb("comparison_criteria").default({
    "interest_rate": 30,
    "processing_fee": 20, 
    "total_cost": 25,
    "approval_probability": 15,
    "provider_rating": 10
  }),
  
  // Comparison Results
  winnerOfferId: varchar("winner_offer_id"),
  comparisonScore: jsonb("comparison_score"), // Scores for each offer
  
  // Metadata
  isPublic: boolean("is_public").default(false),
  sharedWith: jsonb("shared_with").default([]), // Array of user IDs
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Loan Comparison Analytics table - Track comparison behavior
export const loanComparisonAnalytics = pgTable("loan_comparison_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  comparisonId: varchar("comparison_id").references(() => loanComparisons.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // User Interaction
  action: varchar("action").notNull(), // view, filter, sort, share, export
  actionDetails: jsonb("action_details"),
  
  // Session Info
  sessionId: varchar("session_id"),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Create insert schemas for comparison tables
export const insertLoanComparisonSchema = createInsertSchema(loanComparisons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanComparisonAnalyticsSchema = createInsertSchema(loanComparisonAnalytics).omit({
  id: true,
  createdAt: true,
});

// Export types for loan marketplace tables
export type LoanProduct = typeof loanProducts.$inferSelect;
export type InsertLoanProduct = z.infer<typeof insertLoanProductSchema>;
export type LoanProvider = typeof loanProviders.$inferSelect;
export type InsertLoanProvider = z.infer<typeof insertLoanProviderSchema>;
export type ProviderProduct = typeof providerProducts.$inferSelect;
export type InsertProviderProduct = z.infer<typeof insertProviderProductSchema>;
export type CreditProfile = typeof creditProfiles.$inferSelect;
export type InsertCreditProfile = z.infer<typeof insertCreditProfileSchema>;
export type LoanRequest = typeof loanRequests.$inferSelect;
export type InsertLoanRequest = z.infer<typeof insertLoanRequestSchema>;
export type LoanOffer = typeof loanOffers.$inferSelect;
export type InsertLoanOffer = z.infer<typeof insertLoanOfferSchema>;
export type LoanApplicationMarketplace = typeof loanApplicationsMarketplace.$inferSelect;
export type InsertLoanApplicationMarketplace = z.infer<typeof insertLoanApplicationMarketplaceSchema>;
export type ProviderIntegration = typeof providerIntegrations.$inferSelect;
export type InsertProviderIntegration = z.infer<typeof insertProviderIntegrationSchema>;
export type ApplicationDocument = typeof applicationDocuments.$inferSelect;
export type InsertApplicationDocument = z.infer<typeof insertApplicationDocumentSchema>;
export type LoanComparison = typeof loanComparisons.$inferSelect;
export type InsertLoanComparison = z.infer<typeof insertLoanComparisonSchema>;
export type LoanComparisonAnalytics = typeof loanComparisonAnalytics.$inferSelect;
export type InsertLoanComparisonAnalytics = z.infer<typeof insertLoanComparisonAnalyticsSchema>;

// Loan Comparison Request/Response Schemas
export const loanComparisonParamsSchema = z.object({
  amount: z.number().min(50000).max(100000000),
  tenure: z.number().min(12).max(360), // months
  loanType: z.enum(['personal', 'home', 'business', 'vehicle', 'education']),
  monthlyIncome: z.number().min(10000),
  creditScore: z.number().min(300).max(850).optional()
});

export const loanOfferSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  providerRating: z.number().min(0).max(5),
  productName: z.string(),
  productType: z.string(),
  
  // Financial Details
  approvedAmount: z.number(),
  interestRate: z.number(),
  tenure: z.number(),
  emi: z.number(),
  
  // Fees
  processingFee: z.number(),
  legalCharges: z.number(),
  otherCharges: z.number(),
  totalCost: z.number(),
  
  // Risk & Eligibility
  eligibilityScore: z.number(),
  approvalProbability: z.number(),
  qualityScore: z.number(),
  
  // Additional Info
  features: z.array(z.string()),
  terms: z.array(z.string()),
  responseTime: z.string(),
  rateType: z.enum(['fixed', 'floating']),
  
  // Calculated Fields
  totalInterest: z.number(),
  totalRepayment: z.number(),
  apr: z.number(), // True Annual Percentage Rate
  comparisonScore: z.number().optional()
});

export const comparisonCriteriaSchema = z.object({
  interestRate: z.number().min(0).max(100),
  processingFee: z.number().min(0).max(100),
  totalCost: z.number().min(0).max(100),
  approvalProbability: z.number().min(0).max(100),
  providerRating: z.number().min(0).max(100)
});

export type LoanComparisonParams = z.infer<typeof loanComparisonParamsSchema>;
export type LoanOfferData = z.infer<typeof loanOfferSchema>;
export type ComparisonCriteria = z.infer<typeof comparisonCriteriaSchema>;

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

export const zohoCommerceWebhooks = pgTable("zoho_commerce_webhooks", {
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

export const zohoCommerceSyncLogs = pgTable("zoho_commerce_sync_logs", {
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

export const insertZohoCommerceWebhookSchema = createInsertSchema(zohoCommerceWebhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoCommerceSyncLogSchema = createInsertSchema(zohoCommerceSyncLogs).omit({
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
export type ZohoCommerceWebhook = typeof zohoCommerceWebhooks.$inferSelect;
export type InsertZohoCommerceWebhook = z.infer<typeof insertZohoCommerceWebhookSchema>;
export type ZohoCommerceSyncLog = typeof zohoCommerceSyncLogs.$inferSelect;
export type InsertZohoCommerceSyncLog = z.infer<typeof insertZohoCommerceSyncLogSchema>;

// BBPS (Bharat Bill Pay System) tables
export const bbpsCategories = pgTable("bbps_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryName: varchar("category_name").notNull(), // Electricity, Gas, Telecom, etc.
  categoryCode: varchar("category_code").notNull().unique(), // ELECTRICITY_BILL, GAS_BILL, etc.
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bbpsBillers = pgTable("bbps_billers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billerName: varchar("biller_name").notNull(), // BSES, Airtel, etc.
  billerCode: varchar("biller_code").notNull().unique(), // BSES001, AIRTEL001, etc.
  categoryId: varchar("category_id").references(() => bbpsCategories.id).notNull(),
  billerAliasName: varchar("biller_alias_name"),
  billerCoverage: varchar("biller_coverage"), // ALL_INDIA, STATE_WISE, etc.
  paymentAmountExactness: varchar("payment_amount_exactness").default("EXACT_BILL_AMOUNT"), // EXACT_BILL_AMOUNT, EXACT_OR_LOWER, ANY
  customerParamName: varchar("customer_param_name").notNull(), // ConsumerNumber, AccountNumber, etc.
  billerEffctvFrom: timestamp("biller_effctv_from"),
  billerEffctvTo: timestamp("biller_effctv_to"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bbpsCustomerBills = pgTable("bbps_customer_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  billerId: varchar("biller_id").references(() => bbpsBillers.id).notNull(),
  customerParam: varchar("customer_param").notNull(), // Consumer number, account number, etc.
  billAmount: varchar("bill_amount"), // Bill amount in paise
  dueDate: varchar("due_date"), // Bill due date
  billDate: varchar("bill_date"), // Bill generation date
  billPeriod: varchar("bill_period"), // Billing period
  billFetchStatus: varchar("bill_fetch_status").default("PENDING"), // PENDING, SUCCESS, FAILED
  billData: text("bill_data"), // JSON string of bill details
  fetchedAt: timestamp("fetched_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bbpsTransactions = pgTable("bbps_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  billId: varchar("bill_id").references(() => bbpsCustomerBills.id),
  billerCode: varchar("biller_code").notNull(),
  customerParam: varchar("customer_param").notNull(),
  amount: varchar("amount").notNull(), // Amount in rupees (for Cashfree integration)
  paymentAmount: varchar("payment_amount").notNull(), // Amount in paise (for BBPS API)
  transactionId: varchar("transaction_id").unique(), // Our internal transaction ID
  bbpsTransactionId: varchar("bbps_transaction_id"), // BBPS network transaction ID
  cashfreeOrderId: varchar("cashfree_order_id"), // Cashfree payment order ID
  paymentStatus: varchar("payment_status").default("PENDING"), // PENDING, SUCCESS, FAILED, INITIATED
  paymentMode: varchar("payment_mode"), // UPI, NETBANKING, DEBITCARD, etc.
  transactionReference: varchar("transaction_reference"), // Bank reference number
  failureReason: text("failure_reason"),
  commissionAmount: varchar("commission_amount"), // Commission earned
  settlementDate: timestamp("settlement_date"),
  receiptData: text("receipt_data"), // JSON string of receipt details
  initiatedAt: timestamp("initiated_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// BBPS Zod schemas
export const insertBbpsCategorySchema = createInsertSchema(bbpsCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBbpsBillerSchema = createInsertSchema(bbpsBillers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBbpsCustomerBillSchema = createInsertSchema(bbpsCustomerBills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBbpsTransactionSchema = createInsertSchema(bbpsTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// BBPS types
export type BbpsCategory = typeof bbpsCategories.$inferSelect;
export type InsertBbpsCategory = z.infer<typeof insertBbpsCategorySchema>;
export type BbpsBiller = typeof bbpsBillers.$inferSelect;
export type InsertBbpsBiller = z.infer<typeof insertBbpsBillerSchema>;
export type BbpsCustomerBill = typeof bbpsCustomerBills.$inferSelect;
export type InsertBbpsCustomerBill = z.infer<typeof insertBbpsCustomerBillSchema>;
export type BbpsTransaction = typeof bbpsTransactions.$inferSelect;
export type InsertBbpsTransaction = z.infer<typeof insertBbpsTransactionSchema>;

// DigiLocker Integration tables
export const digilockerApps = pgTable("digilocker_apps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appName: varchar("app_name").notNull(),
  appId: varchar("app_id").notNull().unique(),
  apiKey: varchar("api_key").notNull(),
  orgId: varchar("org_id").notNull(),
  domain: varchar("domain").notNull(),
  environment: varchar("environment").default("development"),
  documentTypesAllowed: text("document_types_allowed").array().default(sql`ARRAY['issued', 'uploaded']`),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

export const digilockerSharedDocuments = pgTable("digilocker_shared_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  appId: varchar("app_id").references(() => digilockerApps.id).notNull(),
  documentUri: varchar("document_uri").notNull(),
  documentType: varchar("document_type").notNull(),
  source: varchar("source"),
  transactionId: varchar("transaction_id").notNull(),
  filename: varchar("filename"),
  contentType: varchar("content_type"),
  sharedTill: date("shared_till"),
  documentContent: text("document_content"),
  sharingStatus: varchar("sharing_status").default("shared"),
  sharedAt: timestamp("shared_at").default(sql`NOW()`),
  fetchedAt: timestamp("fetched_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

export const digilockerUserSessions = pgTable("digilocker_user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  appId: varchar("app_id").references(() => digilockerApps.id).notNull(),
  sessionToken: varchar("session_token").notNull(),
  loginTimestamp: timestamp("login_timestamp").notNull(),
  callbackUrl: varchar("callback_url"),
  widgetId: varchar("widget_id"),
  sessionStatus: varchar("session_status").default("active"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

export const digilockerKycMappings = pgTable("digilocker_kyc_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  documentType: varchar("document_type").notNull(),
  digilockerDocId: varchar("digilocker_doc_id").references(() => digilockerSharedDocuments.id),
  kycFieldName: varchar("kyc_field_name").notNull(),
  verificationStatus: varchar("verification_status").default("pending"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"),
  autoPopulated: boolean("auto_populated").default(false),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

// DigiLocker Zod schemas
export const insertDigilockerAppSchema = createInsertSchema(digilockerApps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDigilockerSharedDocumentSchema = createInsertSchema(digilockerSharedDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDigilockerUserSessionSchema = createInsertSchema(digilockerUserSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDigilockerKycMappingSchema = createInsertSchema(digilockerKycMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// DigiLocker types
export type DigilockerApp = typeof digilockerApps.$inferSelect;
export type InsertDigilockerApp = z.infer<typeof insertDigilockerAppSchema>;
export type DigilockerSharedDocument = typeof digilockerSharedDocuments.$inferSelect;
export type InsertDigilockerSharedDocument = z.infer<typeof insertDigilockerSharedDocumentSchema>;
export type DigilockerUserSession = typeof digilockerUserSessions.$inferSelect;
export type InsertDigilockerUserSession = z.infer<typeof insertDigilockerUserSessionSchema>;
export type DigilockerKycMapping = typeof digilockerKycMappings.$inferSelect;
export type InsertDigilockerKycMapping = z.infer<typeof insertDigilockerKycMappingSchema>;

// ===== MUTUAL FUND API INTEGRATION TYPES =====
// Multi-source API integration types for AMFI, MFAPI.in, CaptNemo, etc.

// Core fund information - normalized across all sources
export interface FundCore {
  schemeCode: string;
  schemeName: string;
  fundHouse?: string;
  category?: string;
  subCategory?: string;
  isin?: string;
  riskLevel?: string;
  expenseRatio?: string;
  aum?: string;
  manager?: string;
  benchmark?: string;
}

// Historical NAV data point
export interface NAVRecord {
  date: string; // ISO date string
  nav: string; // decimal as string for precision
}

// Performance metrics with standardized CAGR calculations
export interface FundPerformance {
  currentNav: string;
  navDate: string; // ISO date string
  change?: string;
  changePercent?: string;
  returns: {
    "1M"?: number; // simple return %
    "6M"?: number; // simple return %
    "1Y"?: number; // CAGR %
    "3Y"?: number; // CAGR %
    "5Y"?: number; // CAGR %
  };
  returnStrings: {
    "1M"?: string; // formatted display string
    "6M"?: string;
    "1Y"?: string;
    "3Y"?: string;
    "5Y"?: string;
  };
  volatility?: number;
  sharpeRatio?: number;
  alpha?: number;
  beta?: number;
}

// Data provenance and source tracking
export interface Provenance {
  primarySource: 'AMFI' | 'MFAPI';
  sourceChain?: string[]; // ordered list of attempted sources
  dataFlow?: Array<{
    source: string;
    timestamp: Date;
    action: string;
    metadata?: any;
  }>;
  lastRefreshed?: string; // ISO timestamp
  timestamp: Date;
  isAuthentic: boolean;
  dataVersion?: string;
  conflicts?: Array<{
    field: string;
    primary: any;
    fallback: any;
  }>;
}

// Complete fund data with provenance
export interface FundExtended extends FundCore, FundPerformance {
  id?: string;
  historicalData?: NAVRecord[];
  lastUpdated?: Date;
  provenance?: Provenance;
  
  // Additional convenience fields for database compatibility
  nav?: number;
  returns1y?: number;
  returns3y?: number;
  returns5y?: number;
  rating?: string;
  minInvestment?: string;
  exitLoad?: string;
  
  // FintekPro Smart Rating (stored with legacy 'crisil' prefix for backwards compatibility)
  crisilRating?: number; // 1-5 scale (1 = very good performance) - FintekPro Smart Rating
  crisilCategory?: 'equity' | 'debt' | 'hybrid';
  crisilPercentile?: number; // 0-100 percentile ranking
  crisilEvaluationDate?: Date; // Last evaluation date
  crisilRiskAdjustedScore?: number; // Risk-adjusted returns score
  crisilAssetQualityScore?: number; // Asset quality score
  crisilLiquidityScore?: number; // Liquidity score
  crisilConcentrationScore?: number; // Asset concentration score
  crisilOverallScore?: number; // Overall composite score
  crisilDataSource?: 'calculated' | 'api' | 'manual';
  crisilLastUpdated?: Date;
  
  // FintekPro Smart Rating Analysis Data
  crisilRationale?: string; // Analysis rationale
  crisilStrengths?: string[]; // Fund strengths
  crisilConcerns?: string[]; // Fund concerns
  crisilRecommendation?: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
}

// Zod schemas for validation
export const fundCoreSchema = z.object({
  schemeCode: z.string().min(1),
  schemeName: z.string().min(1),
  fundHouse: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  isin: z.string().optional(),
  riskLevel: z.string().optional(),
  expenseRatio: z.string().optional(),
  aum: z.string().optional(),
  manager: z.string().optional(),
  benchmark: z.string().optional(),
});

export const navRecordSchema = z.object({
  date: z.string(),
  nav: z.string(),
});

export const fundPerformanceSchema = z.object({
  currentNav: z.string(),
  navDate: z.string(),
  change: z.string().optional(),
  changePercent: z.string().optional(),
  returns: z.object({
    "1M": z.number().optional(),
    "6M": z.number().optional(),
    "1Y": z.number().optional(),
    "3Y": z.number().optional(),
    "5Y": z.number().optional(),
  }),
  returnStrings: z.object({
    "1M": z.string().optional(),
    "6M": z.string().optional(),
    "1Y": z.string().optional(),
    "3Y": z.string().optional(),
    "5Y": z.string().optional(),
  }),
  volatility: z.number().optional(),
  sharpeRatio: z.number().optional(),
  alpha: z.number().optional(),
  beta: z.number().optional(),
});

export const provenanceSchema = z.object({
  primarySource: z.enum(['AMFI', 'MFAPI']),
  sourceChain: z.array(z.string()),
  lastRefreshed: z.string(),
  dataVersion: z.string().optional(),
  conflicts: z.array(z.object({
    field: z.string(),
    primary: z.any(),
    fallback: z.any(),
  })).optional(),
});

export const fundExtendedSchema = fundCoreSchema.merge(fundPerformanceSchema).extend({
  id: z.string().optional(),
  historicalData: z.array(navRecordSchema).optional(),
  lastUpdated: z.date().optional(),
  provenance: provenanceSchema,
});

// Types for API responses
export type FundApiResponse = z.infer<typeof fundExtendedSchema>;
export type NavApiRecord = z.infer<typeof navRecordSchema>;

// Search and filtering types
export interface FundSearchParams {
  query?: string;
  category?: string;
  fundHouse?: string;
  riskLevel?: string;
  sortBy?: 'name' | 'nav' | 'returns1Y' | 'returns3Y' | 'returns5Y' | 'aum';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface FundListResponse {
  funds: FundExtended[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Source status for monitoring
export interface SourceStatus {
  source: string;
  isHealthy: boolean;
  lastSuccess?: string;
  lastError?: string;
  latencyMs?: number;
  errorRate?: number;
}

export interface MultiSourceStatus {
  sources: SourceStatus[];
  lastUpdated: string;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
}

// ICICI Loan Applications table
export const iciciBankLoanApplications = pgTable("icici_bank_loan_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Application Details
  applicationId: varchar("application_id").unique(), // ICICI application ID
  loanType: varchar("loan_type").notNull(), // personal/home/business/education/vehicle
  status: varchar("status").default("submitted"), // submitted/under_review/approved/rejected/pending_documents
  
  // Loan Details
  requestedAmount: decimal("requested_amount", { precision: 15, scale: 2 }).notNull(),
  sanctionedAmount: decimal("sanctioned_amount", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  tenure: integer("tenure"), // in months
  emi: decimal("emi", { precision: 15, scale: 2 }),
  processingFee: decimal("processing_fee", { precision: 15, scale: 2 }),
  
  // Application Data (JSON)
  applicantDetails: jsonb("applicant_details").notNull(),
  addressDetails: jsonb("address_details").notNull(),
  employmentDetails: jsonb("employment_details").notNull(),
  bankingDetails: jsonb("banking_details").notNull(),
  loanDetails: jsonb("loan_details").notNull(),
  documents: jsonb("documents").default([]),
  
  // Consent and Terms
  cibilConsent: boolean("cibil_consent").default(false),
  termsAccepted: boolean("terms_accepted").default(false),
  
  // Status History
  statusHistory: jsonb("status_history").default([]),
  
  // Important Dates
  applicationDate: timestamp("application_date").defaultNow(),
  expectedDecisionDate: timestamp("expected_decision_date"),
  decisionDate: timestamp("decision_date"),
  disbursementDate: timestamp("disbursement_date"),
  
  // Additional Information
  nextSteps: jsonb("next_steps").default([]),
  documentsRequired: jsonb("documents_required").default([]),
  remarks: text("remarks"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ICICI Credit Score Requests table
export const iciciBankCreditScores = pgTable("icici_bank_credit_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Credit Score Details
  cibilScore: integer("cibil_score"),
  scoreDate: timestamp("score_date"),
  
  // Score Analysis
  factors: jsonb("factors").default([]),
  recommendations: jsonb("recommendations").default([]),
  
  // Request Details
  requestedAt: timestamp("requested_at").defaultNow(),
  panNumber: varchar("pan_number"),
  mobileNumber: varchar("mobile_number"),
  
  // Status
  status: varchar("status").default("pending"), // pending/completed/failed
  errorMessage: text("error_message"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fund Comparison table for storing fund comparison results
export const fundComparisons = pgTable("fund_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Comparison Request Details
  fundCodes: jsonb("fund_codes").notNull(), // Array of scheme codes to compare
  comparisonType: varchar("comparison_type").default("detailed"), // basic/detailed/advanced
  timePeriod: varchar("time_period").default("1Y"), // 1M/3M/6M/1Y/3Y/5Y/all
  
  // Comparison Results
  results: jsonb("results"), // Detailed comparison data including metrics
  
  // Calculated Metrics for each fund
  returns: jsonb("returns"), // Returns data for different periods
  riskMetrics: jsonb("risk_metrics"), // Volatility, Sharpe ratio, alpha, beta
  expenseAnalysis: jsonb("expense_analysis"), // Expense ratios, fees comparison
  performanceRanking: jsonb("performance_ranking"), // Relative ranking among compared funds
  
  // Summary Insights
  bestPerformer: varchar("best_performer"), // Fund code of best performer
  recommendation: text("recommendation"), // AI-generated recommendation text
  riskLevel: varchar("risk_level"), // overall/low/medium/high based on comparison
  
  // Request Metadata
  requestedAt: timestamp("requested_at").defaultNow(),
  status: varchar("status").default("completed"), // pending/completed/failed
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portfolio Comparison table for storing portfolio comparison results
export const portfolioComparisons = pgTable("portfolio_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Comparison Request Details
  portfolioIds: jsonb("portfolio_ids").notNull(), // Array of portfolio IDs to compare
  comparisonType: varchar("comparison_type").default("comprehensive"), // basic/comprehensive/risk_analysis
  benchmarkIndex: varchar("benchmark_index").default("NIFTY_50"), // Benchmark for comparison
  timePeriod: varchar("time_period").default("1Y"), // Analysis period
  
  // Portfolio Analysis Results
  performanceMetrics: jsonb("performance_metrics"), // Returns, volatility, Sharpe ratio for each portfolio
  riskAnalysis: jsonb("risk_analysis"), // VaR, max drawdown, risk-adjusted returns
  assetAllocationComparison: jsonb("asset_allocation_comparison"), // Asset allocation breakdown
  correlationMatrix: jsonb("correlation_matrix"), // Correlation between portfolios
  
  // Advanced Analytics
  diversificationAnalysis: jsonb("diversification_analysis"), // Diversification scores and metrics
  sectorExposure: jsonb("sector_exposure"), // Sector-wise breakdown comparison
  topHoldingsComparison: jsonb("top_holdings_comparison"), // Overlap analysis of top holdings
  efficiencyMetrics: jsonb("efficiency_metrics"), // Efficient frontier analysis
  
  // Recommendations and Insights
  bestPortfolio: varchar("best_portfolio"), // Portfolio ID of best performer
  worstPortfolio: varchar("worst_portfolio"), // Portfolio ID of worst performer
  rebalancingSuggestions: jsonb("rebalancing_suggestions"), // AI recommendations for each portfolio
  riskScore: decimal("risk_score", { precision: 3, scale: 1 }), // Overall risk score (1-10)
  
  // Summary
  executiveSummary: text("executive_summary"), // High-level insights
  keyFindings: jsonb("key_findings"), // Array of key findings and insights
  actionableRecommendations: jsonb("actionable_recommendations"), // Specific action items
  
  // Request Metadata
  requestedAt: timestamp("requested_at").defaultNow(),
  status: varchar("status").default("completed"), // pending/completed/failed
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"), // Time taken for analysis
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comparison History table for tracking user's comparison activities
export const comparisonHistory = pgTable("comparison_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Comparison Details
  comparisonType: varchar("comparison_type").notNull(), // fund/portfolio
  comparisonId: varchar("comparison_id"), // References to fundComparisons or portfolioComparisons
  itemsCompared: jsonb("items_compared"), // Array of fund codes or portfolio IDs
  
  // User Interaction
  viewDuration: integer("view_duration"), // Time spent viewing results in seconds
  actionsPerformed: jsonb("actions_performed"), // Array of user actions (saved, shared, etc.)
  savedComparison: boolean("saved_comparison").default(false),
  sharedComparison: boolean("shared_comparison").default(false),
  
  // Metadata
  accessedAt: timestamp("accessed_at").defaultNow(),
  lastViewedAt: timestamp("last_viewed_at"),
  userAgent: varchar("user_agent"), // For analytics
  ipAddress: varchar("ip_address"), // For analytics
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for loan applications
export const insertICICILoanApplicationSchema = createInsertSchema(iciciBankLoanApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertICICICreditScoreSchema = createInsertSchema(iciciBankCreditScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schemas for comparison tables
export const insertFundComparisonSchema = createInsertSchema(fundComparisons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioComparisonSchema = createInsertSchema(portfolioComparisons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComparisonHistorySchema = createInsertSchema(comparisonHistory).omit({
  id: true,
  createdAt: true,
});

// Export ICICI loan types
export type ICICILoanApplication = typeof iciciBankLoanApplications.$inferSelect;
export type ICICICreditScore = typeof iciciBankCreditScores.$inferSelect;
export type InsertICICILoanApplication = z.infer<typeof insertICICILoanApplicationSchema>;
export type InsertICICICreditScore = z.infer<typeof insertICICICreditScoreSchema>;

// Export comparison types
export type FundComparison = typeof fundComparisons.$inferSelect;
export type PortfolioComparison = typeof portfolioComparisons.$inferSelect;
export type ComparisonHistory = typeof comparisonHistory.$inferSelect;
export type InsertFundComparison = z.infer<typeof insertFundComparisonSchema>;
export type InsertPortfolioComparison = z.infer<typeof insertPortfolioComparisonSchema>;
export type InsertComparisonHistory = z.infer<typeof insertComparisonHistorySchema>;

// ===== TAX DOCUMENT PROCESSING TABLES =====

// Tax Documents table for storing uploaded Form 26AS and AIS files
export const taxDocuments = pgTable("tax_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Document Information
  documentType: varchar("document_type").notNull(), // '26AS' | 'AIS'
  financialYear: varchar("financial_year").notNull(), // e.g., "2023-24"
  originalFileName: varchar("original_file_name").notNull(),
  fileFormat: varchar("file_format").notNull(), // 'PDF' | 'JSON' | 'CSV'
  fileSize: integer("file_size"), // in bytes
  
  // File Storage
  fileUrl: text("file_url"), // Secure file storage URL in object storage
  encryptionKey: varchar("encryption_key"), // For end-to-end encryption
  
  // Processing Status
  processingStatus: varchar("processing_status").default("pending"), // pending/processing/completed/failed
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  processingError: text("processing_error"),
  
  // Document Metadata
  documentPassword: varchar("document_password"), // For password-protected PDFs (encrypted)
  documentDate: date("document_date"), // Date when the document was generated
  panNumber: varchar("pan_number"), // PAN from the document
  assessmentYear: varchar("assessment_year"), // Assessment year from document
  
  // Validation and Compliance
  isValidated: boolean("is_validated").default(false),
  validationErrors: jsonb("validation_errors").default([]),
  checksumHash: varchar("checksum_hash"), // File integrity verification
  
  // User Consent and Privacy
  userConsent: boolean("user_consent").default(false),
  consentGivenAt: timestamp("consent_given_at"),
  dataRetentionPeriod: integer("data_retention_period").default(7), // years
  autoDeleteAt: timestamp("auto_delete_at"), // Automatic deletion date
  
  // Audit and Tracking
  uploadedFromIp: varchar("uploaded_from_ip"),
  uploadedUserAgent: text("uploaded_user_agent"),
  accessedCount: integer("accessed_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Structured Tax Data table for parsed and categorized tax information
export const structuredTaxData = pgTable("structured_tax_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => taxDocuments.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Data Classification
  dataType: varchar("data_type").notNull(), // 'TDS' | 'TCS' | 'advance_tax' | 'salary' | 'interest' | 'dividend' | 'capital_gains' | 'other_income'
  dataCategory: varchar("data_category"), // 'deduction' | 'income' | 'payment' | 'refund'
  sourceType: varchar("source_type"), // 'employer' | 'bank' | 'broker' | 'mutual_fund' | 'government' | 'other'
  
  // Financial Data
  taxableAmount: decimal("taxable_amount", { precision: 15, scale: 2 }),
  taxDeducted: decimal("tax_deducted", { precision: 15, scale: 2 }),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }), // percentage
  
  // Transaction Details
  transactionDate: date("transaction_date"),
  deductorPan: varchar("deductor_pan"),
  deductorName: varchar("deductor_name"),
  deductorTan: varchar("deductor_tan"), // Tax Account Number
  certificateNumber: varchar("certificate_number"),
  
  // Income Source Details
  incomeNature: varchar("income_nature"), // 'salary' | 'professional_fees' | 'commission' | 'rent' | etc.
  employerName: varchar("employer_name"),
  employerAddress: text("employer_address"),
  
  // Bank/Investment Details
  bankName: varchar("bank_name"),
  accountNumber: varchar("account_number"), // Last 4 digits only for security
  instrumentType: varchar("instrument_type"), // 'FD' | 'savings' | 'equity' | 'mutual_fund'
  
  // Additional Metadata
  remarks: text("remarks"),
  originalSection: varchar("original_section"), // Section of tax document where this was found
  metadata: jsonb("metadata"), // Additional fields specific to data type
  
  // Verification Status
  isVerified: boolean("is_verified").default(false),
  verificationSource: varchar("verification_source"), // 'manual' | 'external_api' | 'bank_statement'
  discrepancyFlags: jsonb("discrepancy_flags").default([]),
  
  // ITR Integration
  includeInItr: boolean("include_in_itr").default(true),
  itrSection: varchar("itr_section"), // ITR section where this should be reported
  itrLineItem: varchar("itr_line_item"), // Specific line item in ITR
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tax Calculations table for computed tax liabilities and savings
export const taxCalculations = pgTable("tax_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  financialYear: varchar("financial_year").notNull(),
  
  // Calculation Type and Status
  calculationType: varchar("calculation_type").default("comprehensive"), // 'quick' | 'comprehensive' | 'comparison'
  taxRegime: varchar("tax_regime").default("new"), // 'old' | 'new'
  calculationStatus: varchar("calculation_status").default("draft"), // 'draft' | 'final' | 'filed'
  
  // Income Summary
  totalIncome: decimal("total_income", { precision: 15, scale: 2 }),
  exemptIncome: decimal("exempt_income", { precision: 15, scale: 2 }),
  taxableIncome: decimal("taxable_income", { precision: 15, scale: 2 }),
  
  // Deductions
  standardDeduction: decimal("standard_deduction", { precision: 15, scale: 2 }),
  section80cDeductions: decimal("section_80c_deductions", { precision: 15, scale: 2 }),
  otherDeductions: decimal("other_deductions", { precision: 15, scale: 2 }),
  totalDeductions: decimal("total_deductions", { precision: 15, scale: 2 }),
  
  // Tax Computation
  grossTaxLiability: decimal("gross_tax_liability", { precision: 15, scale: 2 }),
  rebateUnder87a: decimal("rebate_under_87a", { precision: 15, scale: 2 }),
  netTaxLiability: decimal("net_tax_liability", { precision: 15, scale: 2 }),
  educationCess: decimal("education_cess", { precision: 15, scale: 2 }),
  totalTaxPayable: decimal("total_tax_payable", { precision: 15, scale: 2 }),
  
  // Tax Payments
  tdsDeducted: decimal("tds_deducted", { precision: 15, scale: 2 }),
  advanceTaxPaid: decimal("advance_tax_paid", { precision: 15, scale: 2 }),
  selfAssessmentTax: decimal("self_assessment_tax", { precision: 15, scale: 2 }),
  totalTaxPaid: decimal("total_tax_paid", { precision: 15, scale: 2 }),
  
  // Refund/Payable
  refundDue: decimal("refund_due", { precision: 15, scale: 2 }),
  taxPayable: decimal("tax_payable", { precision: 15, scale: 2 }),
  
  // Detailed Breakdown (JSON)
  incomeBreakdown: jsonb("income_breakdown"), // Source-wise income details
  deductionBreakdown: jsonb("deduction_breakdown"), // Section-wise deductions
  taxBreakdown: jsonb("tax_breakdown"), // Slab-wise tax calculation
  comparisonOldVsNew: jsonb("comparison_old_vs_new"), // Regime comparison
  
  // ITR Preparation
  itrForm: varchar("itr_form"), // 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4'
  itrJsonGenerated: boolean("itr_json_generated").default(false),
  itrJsonUrl: text("itr_json_url"), // URL to downloadable ITR JSON
  
  // Advisory and Recommendations
  taxSavingSuggestions: jsonb("tax_saving_suggestions"),
  optimizationOpportunities: jsonb("optimization_opportunities"),
  nextYearProjections: jsonb("next_year_projections"),
  
  // Validation and Compliance
  validationWarnings: jsonb("validation_warnings").default([]),
  complianceChecks: jsonb("compliance_checks"),
  lastValidatedAt: timestamp("last_validated_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tax Document Access Log for audit purposes
export const taxDocumentAccessLog = pgTable("tax_document_access_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => taxDocuments.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Access Details
  actionType: varchar("action_type").notNull(), // 'view' | 'download' | 'process' | 'delete' | 'share'
  accessMethod: varchar("access_method"), // 'web' | 'mobile' | 'api'
  accessSource: varchar("access_source"), // 'dashboard' | 'itr_wizard' | 'reports'
  
  // Technical Details
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  
  // Additional Context
  purpose: varchar("purpose"), // 'itr_filing' | 'tax_planning' | 'verification' | 'analysis'
  dataShared: boolean("data_shared").default(false),
  exportFormat: varchar("export_format"), // if downloaded
  
  // Timestamps
  accessedAt: timestamp("accessed_at").defaultNow(),
});

// Insert schemas for tax document tables
export const insertTaxDocumentSchema = createInsertSchema(taxDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStructuredTaxDataSchema = createInsertSchema(structuredTaxData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaxCalculationSchema = createInsertSchema(taxCalculations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaxDocumentAccessLogSchema = createInsertSchema(taxDocumentAccessLog).omit({
  id: true,
  accessedAt: true,
});

// Export tax document types
export type TaxDocument = typeof taxDocuments.$inferSelect;
export type StructuredTaxData = typeof structuredTaxData.$inferSelect;
export type TaxCalculation = typeof taxCalculations.$inferSelect;
export type TaxDocumentAccessLog = typeof taxDocumentAccessLog.$inferSelect;

// ITR Pre-filled Forms table for intelligent tax return preparation
export const itrPrefilledForms = pgTable("itr_prefilled_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  assessmentYear: varchar("assessment_year").notNull(), // '2025-26'
  financialYear: varchar("financial_year").notNull(), // '2024-25'
  
  // ITR Form Information
  itrForm: varchar("itr_form").notNull(), // 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4'
  autoSelectedForm: boolean("auto_selected_form").default(true),
  formSelectionReason: text("form_selection_reason"),
  taxRegime: varchar("tax_regime").default("new"), // 'old' | 'new'
  
  // Data Sources Integration Status
  form26AsIntegrated: boolean("form_26as_integrated").default(false),
  aisIntegrated: boolean("ais_integrated").default(false),
  camsIntegrated: boolean("cams_integrated").default(false),
  kfintechIntegrated: boolean("kfintech_integrated").default(false),
  nsdlIntegrated: boolean("nsdl_integrated").default(false),
  cdslIntegrated: boolean("cdsl_integrated").default(false),
  form16Integrated: boolean("form_16_integrated").default(false),
  
  // Pre-filled Data Sections
  personalInfo: jsonb("personal_info"), // Name, PAN, address, etc.
  incomeFromSalary: jsonb("income_from_salary"), // Salary income details
  incomeFromHouseProperty: jsonb("income_from_house_property"),
  incomeFromCapitalGains: jsonb("income_from_capital_gains"), // STCG, LTCG breakdown
  incomeFromOtherSources: jsonb("income_from_other_sources"), // Interest, dividend, etc.
  incomeFromBusinessProfession: jsonb("income_from_business_profession"),
  
  // Deductions (80C, 80D, etc.)
  deductionsChapter6A: jsonb("deductions_chapter_6a"),
  
  // Tax Computation
  taxComputation: jsonb("tax_computation"), // Detailed tax calculation
  tdsDetails: jsonb("tds_details"), // TDS from Form 26AS
  advanceTaxDetails: jsonb("advance_tax_details"),
  
  // Schedule-wise Data
  scheduleCG: jsonb("schedule_cg"), // Capital Gains schedule
  scheduleOS: jsonb("schedule_os"), // Other Sources schedule
  scheduleVDA: jsonb("schedule_vda"), // Virtual Digital Assets
  scheduleFSI: jsonb("schedule_fsi"), // Foreign Source Income
  
  // Validation and Completion Status
  completionPercentage: integer("completion_percentage").default(0),
  validationStatus: varchar("validation_status").default("pending"), // 'pending' | 'validated' | 'errors'
  validationErrors: jsonb("validation_errors").default([]),
  dataConflicts: jsonb("data_conflicts").default([]), // Conflicts between sources
  
  // Smart Suggestions
  taxOptimizationSuggestions: jsonb("tax_optimization_suggestions"),
  misssingDataAlerts: jsonb("missing_data_alerts"),
  complianceWarnings: jsonb("compliance_warnings"),
  
  // Filing Status
  readyForFiling: boolean("ready_for_filing").default(false),
  filingStatus: varchar("filing_status").default("draft"), // 'draft' | 'reviewed' | 'filed'
  filedAt: timestamp("filed_at"),
  acknowledgmentNumber: varchar("acknowledgment_number"),
  
  // Export and Integration
  itrJsonGenerated: boolean("itr_json_generated").default(false),
  itrJsonData: jsonb("itr_json_data"), // Complete ITR JSON for filing
  itrPdfUrl: text("itr_pdf_url"),
  xmlUploadReady: boolean("xml_upload_ready").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastDataSync: timestamp("last_data_sync"),
});

// ITR Data Sources Sync Log for tracking data integration
export const itrDataSourcesSync = pgTable("itr_data_sources_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itrFormId: varchar("itr_form_id").references(() => itrPrefilledForms.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Source Information
  dataSource: varchar("data_source").notNull(), // 'cams' | 'kfintech' | 'nsdl' | 'cdsl' | 'form26as' | 'ais' | 'form16'
  syncStatus: varchar("sync_status").default("pending"), // 'pending' | 'syncing' | 'completed' | 'failed' | 'partial'
  
  // Sync Statistics
  recordsProcessed: integer("records_processed").default(0),
  recordsSuccessful: integer("records_successful").default(0),
  recordsFailed: integer("records_failed").default(0),
  
  // Data Details
  dataCategories: jsonb("data_categories"), // Array of data types synced
  syncedData: jsonb("synced_data"), // Summary of synced data
  errorDetails: jsonb("error_details"), // Sync errors if any
  
  // Timing
  syncStartedAt: timestamp("sync_started_at"),
  syncCompletedAt: timestamp("sync_completed_at"),
  nextSyncScheduled: timestamp("next_sync_scheduled"),
  
  // Metadata
  apiResponse: jsonb("api_response"), // Raw API response for debugging
  syncTrigger: varchar("sync_trigger").default("manual"), // 'manual' | 'auto' | 'scheduled'
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for ITR tables
export const insertItrPrefilledFormSchema = createInsertSchema(itrPrefilledForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastDataSync: true,
});

export const insertItrDataSourcesSyncSchema = createInsertSchema(itrDataSourcesSync).omit({
  id: true,
  createdAt: true,
});

// Export ITR types
export type ItrPrefilledForm = typeof itrPrefilledForms.$inferSelect;
export type ItrDataSourcesSync = typeof itrDataSourcesSync.$inferSelect;
export type InsertItrPrefilledForm = z.infer<typeof insertItrPrefilledFormSchema>;
export type InsertItrDataSourcesSync = z.infer<typeof insertItrDataSourcesSyncSchema>;

export type InsertTaxDocument = z.infer<typeof insertTaxDocumentSchema>;
export type InsertStructuredTaxData = z.infer<typeof insertStructuredTaxDataSchema>;
export type InsertTaxCalculation = z.infer<typeof insertTaxCalculationSchema>;
export type InsertTaxDocumentAccessLog = z.infer<typeof insertTaxDocumentAccessLogSchema>;

// Unified Tax Smart Filing Workflow Tables
// Tax Session for workflow orchestration and state management
export const taxSessions = pgTable("tax_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  panNumber: varchar("pan_number").notNull(),
  assessmentYear: varchar("assessment_year").notNull(), // 2024-25, 2025-26
  financialYear: varchar("financial_year").notNull(), // 2023-24, 2024-25
  
  // Workflow State
  status: varchar("status").default("created").notNull(), // created | aggregating | prefilled | validated | optimized | generated | filed
  currentStep: integer("current_step").default(1), // 1-6 for wizard steps
  
  // AI Suggestions
  suggestedItrForm: varchar("suggested_itr_form"), // ITR-1, ITR-2, etc.
  suggestedTaxRegime: varchar("suggested_tax_regime").default("new"), // old | new
  autoSelectionReason: text("auto_selection_reason"), // AI explanation for suggestions
  
  // Progress Metrics
  completionPercentage: integer("completion_percentage").default(0),
  dataSourcesConnected: integer("data_sources_connected").default(0),
  validationIssuesCount: integer("validation_issues_count").default(0),
  
  // Timing
  aggregationStartedAt: timestamp("aggregation_started_at"),
  aggregationCompletedAt: timestamp("aggregation_completed_at"),
  validationCompletedAt: timestamp("validation_completed_at"),
  filingCompletedAt: timestamp("filing_completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tax Data Sources for tracking connection and sync status
export const taxDataSources = pgTable("tax_data_sources", {
  id: varchar("id").primaryKey(),
  sessionId: varchar("session_id").references(() => taxSessions.id).notNull(),
  name: varchar("name").notNull(), // Form 26AS, AIS, CAMS, NSDL, etc.
  status: varchar("status").default("disconnected").notNull(), // connected | disconnected | syncing | error
  
  // Data Metrics
  lastSync: timestamp("last_sync"),
  recordsCount: integer("records_count").default(0),
  dataTypes: jsonb("data_types").default([]), // ['TDS', 'salary', 'capital_gains']
  
  // Sync Information
  syncDuration: integer("sync_duration"), // milliseconds
  errorMessage: text("error_message"),
  apiEndpoint: varchar("api_endpoint"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Validation Issues for structured error reporting
export const validationIssues = pgTable("validation_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => taxSessions.id).notNull(),
  
  // Issue Classification
  section: varchar("section").notNull(), // income, deductions, personal_info, etc.
  field: varchar("field"), // specific field name
  severity: varchar("severity").notNull(), // error | warning | suggestion
  
  // Issue Details
  message: text("message").notNull(),
  fixHint: text("fix_hint"), // AI-generated suggestion to fix
  autoFixable: boolean("auto_fixable").default(false),
  
  // Resolution
  status: varchar("status").default("open").notNull(), // open | resolved | ignored
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"), // user | auto | ai
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Filing Records for tracking ITR submission status
export const filingRecords = pgTable("filing_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => taxSessions.id).notNull(),
  
  // Filing Information
  acknowledgmentNumber: varchar("acknowledgment_number").unique(),
  receiptNumber: varchar("receipt_number"),
  filingDate: timestamp("filing_date").notNull(),
  
  // Tax Details
  itrForm: varchar("itr_form").notNull(),
  taxRegime: varchar("tax_regime").notNull(),
  totalIncome: decimal("total_income", { precision: 15, scale: 2 }),
  taxLiability: decimal("tax_liability", { precision: 15, scale: 2 }),
  refundAmount: decimal("refund_amount", { precision: 15, scale: 2 }),
  taxPayable: decimal("tax_payable", { precision: 15, scale: 2 }),
  
  // Filing Status
  status: varchar("status").default("filed").notNull(), // filed | processing | verified | failed | defective
  verificationDate: timestamp("verification_date"),
  
  // Documents
  itrJsonUrl: text("itr_json_url"),
  itrPdfUrl: text("itr_pdf_url"),
  itrVUrl: text("itr_v_url"), // ITR-V acknowledgment
  
  // Processing
  processingErrors: jsonb("processing_errors").default([]),
  apiResponse: jsonb("api_response"), // Raw response from filing API
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Optimization Suggestions for intelligent recommendations
export const aiOptimizationSuggestions = pgTable("ai_optimization_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => taxSessions.id).notNull(),
  
  // Suggestion Type
  category: varchar("category").notNull(), // tax_regime | deductions | investments | structure
  suggestionType: varchar("suggestion_type").notNull(), // regime_switch | add_deduction | investment_reallocation
  
  // Suggestion Details
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  potentialSaving: decimal("potential_saving", { precision: 10, scale: 2 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00 to 1.00
  
  // Implementation
  actionRequired: text("action_required"), // What user needs to do
  automatable: boolean("automatable").default(false),
  implementationSteps: jsonb("implementation_steps").default([]),
  
  // User Response
  status: varchar("status").default("pending").notNull(), // pending | accepted | rejected | implemented
  userResponse: text("user_response"),
  respondedAt: timestamp("responded_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for unified tax workflow tables
export const insertTaxSessionSchema = createInsertSchema(taxSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaxDataSourceSchema = createInsertSchema(taxDataSources).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertValidationIssueSchema = createInsertSchema(validationIssues).omit({
  id: true,
  createdAt: true,
});

export const insertFilingRecordSchema = createInsertSchema(filingRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiOptimizationSuggestionSchema = createInsertSchema(aiOptimizationSuggestions).omit({
  id: true,
  createdAt: true,
});

// Export unified tax workflow types
export type TaxSession = typeof taxSessions.$inferSelect;
export type TaxDataSource = typeof taxDataSources.$inferSelect;
export type ValidationIssue = typeof validationIssues.$inferSelect;
export type FilingRecord = typeof filingRecords.$inferSelect;
export type AiOptimizationSuggestion = typeof aiOptimizationSuggestions.$inferSelect;

export type InsertTaxSession = z.infer<typeof insertTaxSessionSchema>;
export type InsertTaxDataSource = z.infer<typeof insertTaxDataSourceSchema>;
export type InsertValidationIssue = z.infer<typeof insertValidationIssueSchema>;
export type InsertFilingRecord = z.infer<typeof insertFilingRecordSchema>;
export type InsertAiOptimizationSuggestion = z.infer<typeof insertAiOptimizationSuggestionSchema>;

// PAN Consent Management Table
export const panConsents = pgTable("pan_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Encrypted PAN Storage
  encryptedPan: text("encrypted_pan").notNull(), // AES-256 encrypted PAN
  panHash: varchar("pan_hash").notNull(), // SHA-256 hash for verification
  
  // Consent Details
  consentGiven: boolean("consent_given").notNull().default(true),
  consentTimestamp: timestamp("consent_timestamp").notNull().defaultNow(),
  consentVersion: varchar("consent_version").notNull().default("1.0"), // Privacy policy version
  consentIPAddress: varchar("consent_ip_address"),
  consentUserAgent: text("consent_user_agent"),
  
  // Purpose and Scope
  consentPurpose: text("consent_purpose").notNull().default("Tax data aggregation and ITR filing services"),
  dataRetentionPeriod: varchar("data_retention_period").default("7_years"), // As per IT Act
  
  // Audit Information
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").default(0),
  isActive: boolean("is_active").notNull().default(true),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  
  // Compliance Tracking
  kycVerified: boolean("kyc_verified").default(false),
  panVerified: boolean("pan_verified").default(false),
  verificationDate: timestamp("verification_date"),
  verificationSource: varchar("verification_source"), // manual/api/document
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pan_consents_user_id").on(table.userId),
  index("idx_pan_consents_active").on(table.isActive),
]);

// PAN Consent Audit Log
export const panConsentAuditLog = pgTable("pan_consent_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consentId: varchar("consent_id").references(() => panConsents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Audit Details
  action: varchar("action").notNull(), // created/accessed/updated/revoked/verified
  actionDetails: jsonb("action_details"), // Additional context
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  
  // API Usage Tracking
  apiEndpoint: varchar("api_endpoint"), // Which API used the PAN
  requestId: varchar("request_id"), // For tracing specific requests
  
  // Compliance and Security
  accessReason: text("access_reason"), // Why PAN was accessed
  dataMinimized: boolean("data_minimized").default(true), // Was data access minimized
  
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => [
  index("idx_pan_audit_consent_id").on(table.consentId),
  index("idx_pan_audit_user_id").on(table.userId),
  index("idx_pan_audit_timestamp").on(table.timestamp),
]);

// PAN Consent Zod schemas
export const insertPanConsentSchema = createInsertSchema(panConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPanConsentAuditLogSchema = createInsertSchema(panConsentAuditLog).omit({
  id: true,
  timestamp: true,
});

export type PanConsent = typeof panConsents.$inferSelect;
export type NewPanConsent = typeof panConsents.$inferInsert;
export type PanConsentAuditLog = typeof panConsentAuditLog.$inferSelect;
export type NewPanConsentAuditLog = typeof panConsentAuditLog.$inferInsert;
export type InsertPanConsent = z.infer<typeof insertPanConsentSchema>;
export type InsertPanConsentAuditLog = z.infer<typeof insertPanConsentAuditLogSchema>;

// Smart Market Research & Investment Idea Tracking Tables
export const investmentIdeas = pgTable("investment_ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  symbol: varchar("symbol").notNull(),
  companyName: varchar("company_name").notNull(),
  ideaTitle: varchar("idea_title").notNull(),
  ideaDescription: text("idea_description").notNull(),
  
  // Investment Parameters
  entryPrice: decimal("entry_price", { precision: 10, scale: 2 }).notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
  targetPrice: decimal("target_price", { precision: 10, scale: 2 }).notNull(),
  stopLoss: decimal("stop_loss", { precision: 10, scale: 2 }).notNull(),
  
  // Position Details
  recommendedQuantity: integer("recommended_quantity"),
  actualQuantity: integer("actual_quantity").default(0),
  recommendedInvestment: decimal("recommended_investment", { precision: 12, scale: 2 }),
  actualInvestment: decimal("actual_investment", { precision: 12, scale: 2 }).default("0"),
  
  // Risk & Analysis
  riskLevel: varchar("risk_level").notNull(), // low, medium, high
  timeHorizon: varchar("time_horizon").notNull(), // short, medium, long
  sector: varchar("sector"),
  marketCap: varchar("market_cap"), // small, mid, large
  
  // Technical Analysis
  technicalIndicators: jsonb("technical_indicators"), // RSI, MACD, etc.
  supportLevel: decimal("support_level", { precision: 10, scale: 2 }),
  resistanceLevel: decimal("resistance_level", { precision: 10, scale: 2 }),
  
  // AI Analysis
  aiConfidenceScore: decimal("ai_confidence_score", { precision: 3, scale: 2 }),
  aiReasoning: text("ai_reasoning"),
  catalysts: jsonb("catalysts"), // array of expected catalysts
  risks: jsonb("risks"), // array of potential risks
  
  // Status & Tracking
  status: varchar("status").default("suggested"), // suggested, tracking, closed, stopped_out
  isActive: boolean("is_active").default(true),
  suggestedAt: timestamp("suggested_at").default(sql`CURRENT_TIMESTAMP`),
  enteredAt: timestamp("entered_at"),
  exitedAt: timestamp("exited_at"),
  
  // Performance Tracking
  currentReturn: decimal("current_return", { precision: 8, scale: 4 }), // percentage
  realizedReturn: decimal("realized_return", { precision: 8, scale: 4 }), // percentage
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }), // percentage
  daysHeld: integer("days_held").default(0),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const investmentIdeaTracking = pgTable("investment_idea_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").references(() => investmentIdeas.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Daily Tracking Data
  trackingDate: timestamp("tracking_date").notNull(),
  openPrice: decimal("open_price", { precision: 10, scale: 2 }),
  closePrice: decimal("close_price", { precision: 10, scale: 2 }).notNull(),
  highPrice: decimal("high_price", { precision: 10, scale: 2 }),
  lowPrice: decimal("low_price", { precision: 10, scale: 2 }),
  volume: bigint("volume", { mode: "number" }),
  
  // Performance Metrics
  dailyReturn: decimal("daily_return", { precision: 8, scale: 4 }), // percentage
  cumulativeReturn: decimal("cumulative_return", { precision: 8, scale: 4 }), // percentage
  unrealizedPnL: decimal("unrealized_pnl", { precision: 12, scale: 2 }),
  
  // Technical Indicators (updated daily)
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 8, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 8, scale: 4 }),
  sma20: decimal("sma_20", { precision: 10, scale: 2 }),
  sma50: decimal("sma_50", { precision: 10, scale: 2 }),
  ema12: decimal("ema_12", { precision: 10, scale: 2 }),
  ema26: decimal("ema_26", { precision: 10, scale: 2 }),
  
  // Risk Metrics
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  beta: decimal("beta", { precision: 6, scale: 4 }),
  
  // Events & Notes
  events: jsonb("events"), // corporate actions, news, etc.
  notes: text("notes"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const investmentIdeaAlerts = pgTable("investment_idea_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").references(() => investmentIdeas.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  alertType: varchar("alert_type").notNull(), // target_reached, stop_loss_triggered, technical_signal, news_alert
  alertMessage: text("alert_message").notNull(),
  triggerPrice: decimal("trigger_price", { precision: 10, scale: 2 }),
  actualPrice: decimal("actual_price", { precision: 10, scale: 2 }),
  
  severity: varchar("severity").default("medium"), // low, medium, high, critical
  isRead: boolean("is_read").default(false),
  isActionable: boolean("is_actionable").default(false),
  
  triggeredAt: timestamp("triggered_at").default(sql`CURRENT_TIMESTAMP`),
  readAt: timestamp("read_at"),
});

export const yieldTracker = pgTable("yield_tracker", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  ideaId: varchar("idea_id").references(() => investmentIdeas.id),
  
  // Portfolio/Strategy Details
  strategyName: varchar("strategy_name").notNull(),
  strategyType: varchar("strategy_type").notNull(), // single_stock, portfolio, sector_rotation, thematic
  
  // Performance Metrics
  totalInvestment: decimal("total_investment", { precision: 15, scale: 2 }).notNull(),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  totalReturn: decimal("total_return", { precision: 15, scale: 2 }),
  totalReturnPercent: decimal("total_return_percent", { precision: 8, scale: 4 }),
  
  // Yield Calculations
  dividendYield: decimal("dividend_yield", { precision: 6, scale: 4 }),
  capitalGainsYield: decimal("capital_gains_yield", { precision: 8, scale: 4 }),
  totalYield: decimal("total_yield", { precision: 8, scale: 4 }),
  annualizedReturn: decimal("annualized_return", { precision: 8, scale: 4 }),
  
  // Risk-Adjusted Returns
  sharpeRatio: decimal("sharpe_ratio", { precision: 6, scale: 4 }),
  sortinoRatio: decimal("sortino_ratio", { precision: 6, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  
  // Benchmarking
  benchmarkReturn: decimal("benchmark_return", { precision: 8, scale: 4 }),
  alpha: decimal("alpha", { precision: 8, scale: 4 }),
  beta: decimal("beta", { precision: 6, scale: 4 }),
  
  // Time Tracking
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  daysActive: integer("days_active"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  lastUpdated: timestamp("last_updated").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Partner Application table for loan applications across lenders
export const partnerApplications = pgTable("partner_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Lender and Loan Details
  lender: varchar("lender").notNull(), // bajaj_finance, tata_capital, hdfc_bank, icici_bank
  loanType: varchar("loan_type").notNull().default("personal"), // personal, home, business, car, etc.
  recommendationId: varchar("recommendation_id"), // Reference to original recommendation
  
  // Application Details
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  tenure: integer("tenure").notNull(), // in months
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  emi: decimal("emi", { precision: 10, scale: 2 }),
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }),
  
  // User Financial Information (snapshot at time of application)
  monthlyIncome: decimal("monthly_income", { precision: 10, scale: 2 }).notNull(),
  existingEMIs: decimal("existing_emis", { precision: 10, scale: 2 }),
  employmentType: varchar("employment_type").notNull(), // salaried, self_employed, business, professional
  workExperience: integer("work_experience"), // in years
  cibilScore: integer("cibil_score"),
  
  // Personal Information (pre-filled from profile)
  panNumber: varchar("pan_number"),
  aadharNumber: varchar("aadhar_number"),
  currentAddress: text("current_address"),
  employerName: varchar("employer_name"),
  companyCategory: varchar("company_category"), // for HDFC specific
  residenceType: varchar("residence_type"), // owned, rented, company_provided
  
  // Banking Information
  bankName: varchar("bank_name"),
  accountNumber: varchar("account_number"),
  ifscCode: varchar("ifsc_code"),
  netSalaryCreditBank: varchar("net_salary_credit_bank"), // for HDFC specific
  
  // Document References (JSON array of object storage URLs)
  documentRefs: jsonb("document_refs").default([]),
  requiredDocuments: jsonb("required_documents").default([]), // list of required docs per lender
  
  // Lender-Specific Metadata
  providerMeta: jsonb("provider_meta").default({}), // store lender-specific fields
  
  // Consent and Compliance
  bureauConsent: boolean("bureau_consent").default(false),
  ckycConsent: boolean("ckyc_consent").default(false),
  termsAccepted: boolean("terms_accepted").default(false),
  
  // Application Status and Tracking
  status: varchar("status").default("draft"), // draft, submitted, pending, approved, rejected, cancelled
  providerApplicationId: varchar("provider_application_id"), // lender's internal ID
  submittedAt: timestamp("submitted_at"),
  
  // Status Updates from Provider
  statusUpdates: jsonb("status_updates").default([]), // array of status change events
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Partner Application Documents table for document metadata
export const partnerApplicationDocuments = pgTable("partner_application_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => partnerApplications.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Document Details
  documentType: varchar("document_type").notNull(), // panCard, aadharCard, salarySlips, bankStatements, employmentLetter
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), // in bytes
  mimeType: varchar("mime_type"),
  
  // Object Storage Details
  filePath: text("file_path").notNull(), // normalized object storage path like /objects/uuid
  originalUrl: text("original_url"), // original upload URL for reference
  
  // Metadata
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  // Timestamps
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Investment Ideas Zod schemas
export const insertInvestmentIdeaSchema = createInsertSchema(investmentIdeas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvestmentIdeaTrackingSchema = createInsertSchema(investmentIdeaTracking).omit({
  id: true,
  createdAt: true,
});

export const insertInvestmentIdeaAlertSchema = createInsertSchema(investmentIdeaAlerts).omit({
  id: true,
  triggeredAt: true,
});

export const insertYieldTrackerSchema = createInsertSchema(yieldTracker).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertPartnerApplicationSchema = createInsertSchema(partnerApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Investment Ideas types
export type InvestmentIdea = typeof investmentIdeas.$inferSelect;
export type InsertInvestmentIdea = z.infer<typeof insertInvestmentIdeaSchema>;
export type InvestmentIdeaTracking = typeof investmentIdeaTracking.$inferSelect;
export type InsertInvestmentIdeaTracking = z.infer<typeof insertInvestmentIdeaTrackingSchema>;
export type InvestmentIdeaAlert = typeof investmentIdeaAlerts.$inferSelect;
export type InsertInvestmentIdeaAlert = z.infer<typeof insertInvestmentIdeaAlertSchema>;
export type YieldTracker = typeof yieldTracker.$inferSelect;
export type InsertYieldTracker = z.infer<typeof insertYieldTrackerSchema>;
export type PartnerApplication = typeof partnerApplications.$inferSelect;
export type InsertPartnerApplication = z.infer<typeof insertPartnerApplicationSchema>;

export const insertPartnerApplicationDocumentSchema = createInsertSchema(partnerApplicationDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  uploadedAt: true,
});

export type PartnerApplicationDocument = typeof partnerApplicationDocuments.$inferSelect;
export type InsertPartnerApplicationDocument = z.infer<typeof insertPartnerApplicationDocumentSchema>;

// Cashfree Payment Transactions table
export const cashfreeTransactions = pgTable("cashfree_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Transaction Identification
  orderId: varchar("order_id").notNull().unique(), // Our generated order ID
  cashfreeOrderId: varchar("cashfree_order_id"), // Cashfree's transaction ID
  paymentSessionId: varchar("payment_session_id"), // Cashfree payment session ID
  
  // Amount Details
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // Amount in rupees
  currency: varchar("currency").default("INR"),
  
  // Payment Details
  paymentMethod: varchar("payment_method"), // UPI, CARD, NET_BANKING, WALLET
  paymentInstrumentType: varchar("payment_instrument_type"), // Specific instrument type
  
  // User Information
  customerId: varchar("customer_id"), // Cashfree customer ID
  mobileNumber: varchar("mobile_number"),
  customerName: varchar("customer_name"),
  customerEmail: varchar("customer_email"),
  
  // Transaction Status
  status: varchar("status").default("PENDING").notNull(), // PENDING, SUCCESS, FAILED, ACTIVE
  orderStatus: varchar("order_status"), // Cashfree order status
  responseMessage: text("response_message"), // Cashfree response message
  
  // URLs and Redirects
  returnUrl: text("return_url"),
  paymentUrl: text("payment_url"), // Cashfree payment page URL
  
  // Related Entities
  cartId: varchar("cart_id").references(() => userCart.id), // If payment for cart checkout
  itemType: varchar("item_type"), // mutual_fund, product, proposal, loan
  itemId: varchar("item_id"), // ID of the item being purchased
  
  // Cashfree Gateway Response
  gatewayResponse: jsonb("gateway_response"), // Full response from Cashfree
  
  // Metadata
  metadata: jsonb("metadata"), // Additional transaction data
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  callbackReceivedAt: timestamp("callback_received_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cashfree Transaction Insert Schema
export const insertCashfreeTransactionSchema = createInsertSchema(cashfreeTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  initiatedAt: true,
});

// Cashfree Transaction Types
export type CashfreeTransaction = typeof cashfreeTransactions.$inferSelect;
export type InsertCashfreeTransaction = z.infer<typeof insertCashfreeTransactionSchema>;

// PhonePe Payment Transactions table
export const phonePeTransactions = pgTable("phonepe_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Transaction Identification
  orderId: varchar("order_id").notNull().unique(), // Our generated order ID
  merchantTransactionId: varchar("merchant_transaction_id").notNull().unique(), // PhonePe merchant transaction ID
  transactionId: varchar("transaction_id"), // PhonePe's internal transaction ID
  
  // Amount Details
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // Amount in rupees
  currency: varchar("currency").default("INR"),
  
  // Payment Details
  paymentMethod: varchar("payment_method"), // UPI, CARD, NET_BANKING, WALLET
  paymentInstrumentType: varchar("payment_instrument_type"), // Specific instrument type
  
  // Status Tracking
  status: varchar("status").default("initiated").notNull(), 
  // possible values: 'initiated', 'pending', 'success', 'failed', 'cancelled'
  state: varchar("state"), // PhonePe state: COMPLETED, FAILED, PENDING
  responseCode: varchar("response_code"), // PhonePe response code
  
  // Customer Details
  customerName: varchar("customer_name"),
  customerEmail: varchar("customer_email"),
  customerPhone: varchar("customer_phone"),
  
  // URLs
  redirectUrl: text("redirect_url"),
  callbackUrl: text("callback_url"),
  paymentUrl: text("payment_url"), // PhonePe payment page URL
  
  // Related Entities
  cartId: varchar("cart_id").references(() => userCart.id), // If payment for cart checkout
  itemType: varchar("item_type"), // mutual_fund, product, proposal, loan
  itemId: varchar("item_id"), // ID of the item being purchased
  
  // PhonePe Gateway Response
  gatewayResponse: jsonb("gateway_response"), // Full response from PhonePe
  
  // Metadata
  metadata: jsonb("metadata"), // Additional transaction data
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  callbackReceivedAt: timestamp("callback_received_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PhonePe Transaction Insert Schema
export const insertPhonePeTransactionSchema = createInsertSchema(phonePeTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  initiatedAt: true,
});

// PhonePe Transaction Types
export type PhonePeTransaction = typeof phonePeTransactions.$inferSelect;
export type InsertPhonePeTransaction = z.infer<typeof insertPhonePeTransactionSchema>;

// Tax Rules table - Dynamic tax rates and rules management
export const taxRules = pgTable(
  "tax_rules",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ruleType: varchar("rule_type").notNull(), // 'capital_gains', 'income_slab', 'deduction_limit', 'exemption'
    category: varchar("category").notNull(), // 'stcg', 'ltcg', 'old_regime', 'new_regime', etc.
    value: decimal("value", { precision: 10, scale: 2 }).notNull(), // the rate or amount
    minAmount: decimal("min_amount", { precision: 15, scale: 2 }), // minimum threshold (nullable)
    maxAmount: decimal("max_amount", { precision: 15, scale: 2 }), // maximum threshold (nullable)
    effectiveFrom: date("effective_from").notNull(), // when this rate becomes active
    effectiveTo: date("effective_to"), // when this rate expires (nullable)
    isActive: boolean("is_active").default(true).notNull(), // current active status
    metadata: jsonb("metadata").default({}), // additional rule parameters
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_tax_rules_type_category").on(table.ruleType, table.category),
    index("idx_tax_rules_effective_from").on(table.effectiveFrom),
    index("idx_tax_rules_is_active").on(table.isActive),
  ]
);

// Tax Reminder Subscriptions table
export const taxReminderSubscriptions = pgTable(
  "tax_reminder_subscriptions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    itrFormType: varchar("itr_form_type").notNull(), // 'ITR-1', 'ITR-2', 'ITR-3', etc.
    subscriptionStatus: varchar("subscription_status").default("active").notNull(), // 'active', 'inactive', 'free_expert_tier'
    pricingTier: varchar("pricing_tier").notNull(), // 'basic', 'standard', 'premium'
    annualPrice: decimal("annual_price", { precision: 10, scale: 2 }).notNull(),
    isFree: boolean("is_free").default(false).notNull(), // true if user has expert ITR filing service
    stripeSubscriptionId: varchar("stripe_subscription_id"), // nullable
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until").notNull(),
    reminderChannels: jsonb("reminder_channels").default(sql`'["email"]'`).notNull(), // ['email', 'sms', 'whatsapp']
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_tax_reminder_subscriptions_user_id").on(table.userId),
    index("idx_tax_reminder_subscriptions_status").on(table.subscriptionStatus),
  ]
);

// Capital Gains Tax Reminders table
export const capitalGainsTaxReminders = pgTable(
  "capital_gains_tax_reminders",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    subscriptionId: varchar("subscription_id").references(() => taxReminderSubscriptions.id),
    quarter: varchar("quarter").notNull(), // 'Q1', 'Q2', 'Q3', 'Q4'
    financialYear: varchar("financial_year").notNull(), // '2024-25'
    dueDate: date("due_date").notNull(), // advance tax due date
    estimatedSTCG: decimal("estimated_stcg", { precision: 15, scale: 2 }).default("0"),
    estimatedLTCG: decimal("estimated_ltcg", { precision: 15, scale: 2 }).default("0"),
    totalTaxLiability: decimal("total_tax_liability", { precision: 15, scale: 2 }).default("0"),
    reminderSentAt: timestamp("reminder_sent_at"), // nullable
    status: varchar("status").default("pending").notNull(), // 'pending', 'sent', 'paid', 'skipped'
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_capital_gains_tax_reminders_user_id").on(table.userId),
    index("idx_capital_gains_tax_reminders_due_date").on(table.dueDate),
    index("idx_capital_gains_tax_reminders_status").on(table.status),
  ]
);

// Tax Rules Insert Schema
export const insertTaxRuleSchema = createInsertSchema(taxRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tax Reminder Subscriptions Insert Schema
export const insertTaxReminderSubscriptionSchema = createInsertSchema(taxReminderSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Capital Gains Tax Reminders Insert Schema
export const insertCapitalGainsTaxReminderSchema = createInsertSchema(capitalGainsTaxReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tax-related Types
export type TaxRule = typeof taxRules.$inferSelect;
export type InsertTaxRule = z.infer<typeof insertTaxRuleSchema>;
export type TaxReminderSubscription = typeof taxReminderSubscriptions.$inferSelect;
export type InsertTaxReminderSubscription = z.infer<typeof insertTaxReminderSubscriptionSchema>;
export type CapitalGainsTaxReminder = typeof capitalGainsTaxReminders.$inferSelect;
export type InsertCapitalGainsTaxReminder = z.infer<typeof insertCapitalGainsTaxReminderSchema>;

// Generated Reports table - for client-facing report metadata
export const generatedReports = pgTable(
  "generated_reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    reportType: varchar("report_type").notNull(), // 'transaction_history', 'account_statement', 'tax_report', 'capital_gains', 'dividend_income'
    reportFormat: varchar("report_format").notNull(), // 'pdf', 'excel', 'csv'
    reportStatus: varchar("report_status").default("pending").notNull(), // 'pending', 'generating', 'completed', 'failed'
    
    // Report parameters
    dateFrom: date("date_from"),
    dateTo: date("date_to"),
    transactionTypes: jsonb("transaction_types"), // array of transaction types to include
    filters: jsonb("filters"), // additional filters applied
    
    // Report metadata
    reportTitle: varchar("report_title"),
    totalTransactions: integer("total_transactions").default(0),
    totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
    
    // File storage
    fileUrl: text("file_url"), // cloud storage URL or local path
    fileSize: integer("file_size"), // in bytes
    fileName: varchar("file_name"),
    
    // Generation tracking
    generatedAt: timestamp("generated_at"),
    expiresAt: timestamp("expires_at"), // for temporary reports
    errorMessage: text("error_message"), // if generation failed
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_generated_reports_user_id").on(table.userId),
    index("idx_generated_reports_status").on(table.reportStatus),
    index("idx_generated_reports_type").on(table.reportType),
  ]
);

// Report Access Logs table - audit trail for report access
export const reportAccessLogs = pgTable(
  "report_access_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    reportId: varchar("report_id").references(() => generatedReports.id),
    userId: varchar("user_id").references(() => users.id).notNull(),
    accessType: varchar("access_type").notNull(), // 'view', 'download', 'generate', 'share'
    
    // Access details
    ipAddress: varchar("ip_address"),
    userAgent: text("user_agent"),
    accessLocation: varchar("access_location"), // city/country if available
    
    // Compliance tracking
    purpose: text("purpose"), // reason for access (optional for audit)
    complianceNote: text("compliance_note"), // for regulatory audit
    isAuthorized: boolean("is_authorized").default(true),
    
    accessedAt: timestamp("accessed_at").defaultNow(),
  },
  (table) => [
    index("idx_report_access_logs_report_id").on(table.reportId),
    index("idx_report_access_logs_user_id").on(table.userId),
    index("idx_report_access_logs_accessed_at").on(table.accessedAt),
  ]
);

// Client Statements table - account statements for specific periods
export const clientStatements = pgTable(
  "client_statements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    statementType: varchar("statement_type").notNull(), // 'monthly', 'quarterly', 'annual', 'custom'
    statementPeriod: varchar("statement_period").notNull(), // 'Jan 2025', 'Q4 2024', '2024-25'
    
    // Period details
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    financialYear: varchar("financial_year"), // '2024-25'
    
    // Statement summary
    openingBalance: decimal("opening_balance", { precision: 15, scale: 2 }).default("0"),
    closingBalance: decimal("closing_balance", { precision: 15, scale: 2 }).default("0"),
    totalInflows: decimal("total_inflows", { precision: 15, scale: 2 }).default("0"),
    totalOutflows: decimal("total_outflows", { precision: 15, scale: 2 }).default("0"),
    totalGains: decimal("total_gains", { precision: 15, scale: 2 }).default("0"),
    totalLosses: decimal("total_losses", { precision: 15, scale: 2 }).default("0"),
    
    // Holdings snapshot
    equityHoldings: jsonb("equity_holdings").default([]),
    mfHoldings: jsonb("mf_holdings").default([]),
    bondHoldings: jsonb("bond_holdings").default([]),
    otherHoldings: jsonb("other_holdings").default([]),
    
    // Transactions included
    transactionIds: jsonb("transaction_ids").default([]), // array of transaction IDs
    transactionCount: integer("transaction_count").default(0),
    
    // File storage
    pdfUrl: text("pdf_url"),
    excelUrl: text("excel_url"),
    
    // Statement metadata
    statementNumber: varchar("statement_number").unique(), // e.g., "STMT-2025-001"
    isConsolidated: boolean("is_consolidated").default(false), // includes all portfolios
    portfolioId: varchar("portfolio_id"), // specific portfolio or null for consolidated
    
    // Generation tracking
    generatedAt: timestamp("generated_at"),
    sentToClient: boolean("sent_to_client").default(false),
    sentAt: timestamp("sent_at"),
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_client_statements_user_id").on(table.userId),
    index("idx_client_statements_period").on(table.statementPeriod),
    index("idx_client_statements_type").on(table.statementType),
  ]
);

// Insert schemas for transaction reporting
export const insertGeneratedReportSchema = createInsertSchema(generatedReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportAccessLogSchema = createInsertSchema(reportAccessLogs).omit({
  id: true,
  accessedAt: true,
});

export const insertClientStatementSchema = createInsertSchema(clientStatements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for transaction reporting
export type GeneratedReport = typeof generatedReports.$inferSelect;
export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;
export type ReportAccessLog = typeof reportAccessLogs.$inferSelect;
export type InsertReportAccessLog = z.infer<typeof insertReportAccessLogSchema>;
export type ClientStatement = typeof clientStatements.$inferSelect;
export type InsertClientStatement = z.infer<typeof insertClientStatementSchema>;

// Government Securities table - G-Secs, T-Bills, SDLs from NSE NCB
export const governmentSecurities = pgTable("government_securities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Security identification
  isin: varchar("isin").notNull().unique(),
  securityName: text("security_name").notNull(),
  securityType: varchar("security_type").notNull(), // 'g_sec', 't_bill', 'sdl', 'sgb', 'tax_free_bond', 'infrastructure_bond'
  issuer: varchar("issuer").notNull(), // 'Government of India', State name for SDL
  
  // Auction details
  auctionDate: date("auction_date"),
  auctionNumber: varchar("auction_number"),
  notifiedAmount: decimal("notified_amount", { precision: 15, scale: 2 }),
  ncbReservedAmount: decimal("ncb_reserved_amount", { precision: 15, scale: 2 }), // 5% for NCB
  
  // Bond specifications
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).default("100"),
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }), // Annual coupon rate
  issueDate: date("issue_date"),
  maturityDate: date("maturity_date").notNull(),
  tenorYears: decimal("tenor_years", { precision: 5, scale: 2 }),
  
  // Pricing
  issuePrice: decimal("issue_price", { precision: 15, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  yieldToMaturity: decimal("yield_to_maturity", { precision: 8, scale: 4 }),
  
  // Trading information
  tradingStatus: varchar("trading_status").default("active"), // 'active', 'matured', 'suspended'
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }).default("10000"),
  
  // Risk metrics
  duration: decimal("duration", { precision: 8, scale: 4 }), // Macaulay duration
  modifiedDuration: decimal("modified_duration", { precision: 8, scale: 4 }),
  creditRating: varchar("credit_rating").default("AAA"), // Sovereign rating
  
  // Sovereign Gold Bond (SGB) specific fields
  goldReferencePrice: decimal("gold_reference_price", { precision: 15, scale: 2 }), // Price of gold per gram at issue
  goldWeight: decimal("gold_weight", { precision: 10, scale: 4 }), // Grams of gold per unit
  maxInvestmentLimit: decimal("max_investment_limit", { precision: 15, scale: 2 }), // Individual investment limit
  earlyRedemptionAllowed: boolean("early_redemption_allowed").default(false),
  earlyRedemptionPeriod: varchar("early_redemption_period"), // e.g., "after 5 years"
  
  // Tax benefits
  taxStatus: varchar("tax_status").default("taxable"), // 'taxable', 'tax_free', 'tax_saving_eligible', 'tax_exempt_on_redemption'
  taxBenefitSection: varchar("tax_benefit_section"), // e.g., '54EC', '80CCF'
  taxBenefitDetails: text("tax_benefit_details"),
  indexationBenefit: boolean("indexation_benefit").default(false),
  
  // Infrastructure/Sector specific
  infrastructureSector: varchar("infrastructure_sector"), // 'power', 'roads', 'railways', 'ports', 'urban_infrastructure'
  projectName: text("project_name"),
  utilizationPurpose: text("utilization_purpose"), // How funds will be used
  
  // Additional features
  specialFeatures: jsonb("special_features").default([]), // Array of special features
  eligibilityCriteria: text("eligibility_criteria"),
  lockinPeriod: varchar("lockin_period"), // Lock-in period if any
  
  // Metadata
  dataSource: varchar("data_source").default("nse_ncb"), // 'nse_ncb', 'rbi', 'manual'
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Corporate Bonds table - BSE Bond market
export const corporateBonds = pgTable("corporate_bonds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Bond identification
  isin: varchar("isin").notNull().unique(),
  securityCode: varchar("security_code").unique(), // BSE scrip code
  bondName: text("bond_name").notNull(),
  issuer: varchar("issuer").notNull(), // Company name
  
  // Bond specifications
  bondType: varchar("bond_type").notNull(), // 'corporate_bond', 'ncd', 'debenture', 'commercial_paper', 'tax_free_bond', 'infrastructure_bond'
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).default("1000"),
  couponType: varchar("coupon_type").notNull(), // 'fixed', 'floating', 'zero_coupon'
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }),
  couponFrequency: varchar("coupon_frequency"), // 'annual', 'semi_annual', 'quarterly', 'monthly'
  
  // Dates
  issueDate: date("issue_date"),
  maturityDate: date("maturity_date").notNull(),
  tenorYears: decimal("tenor_years", { precision: 5, scale: 2 }),
  
  // Pricing and yield
  issuePrice: decimal("issue_price", { precision: 15, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  yieldToMaturity: decimal("yield_to_maturity", { precision: 8, scale: 4 }),
  yieldToCall: decimal("yield_to_call", { precision: 8, scale: 4 }),
  
  // Trading information
  listingDate: date("listing_date"),
  tradingStatus: varchar("trading_status").default("active"), // 'active', 'suspended', 'matured', 'defaulted'
  minimumLotSize: integer("minimum_lot_size").default(1),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  
  // Call/Put features
  isCallable: boolean("is_callable").default(false),
  callDate: date("call_date"),
  callPrice: decimal("call_price", { precision: 15, scale: 4 }),
  isPuttable: boolean("is_puttable").default(false),
  putDate: date("put_date"),
  putPrice: decimal("put_price", { precision: 15, scale: 4 }),
  
  // Security features
  secured: boolean("secured").default(false),
  securityType: varchar("security_type"), // 'senior_secured', 'subordinated', 'unsecured'
  collateralType: text("collateral_type"),
  
  // Credit ratings
  creditRating: varchar("credit_rating"), // 'AAA', 'AA+', 'AA', etc.
  ratingAgency: varchar("rating_agency"), // 'CRISIL', 'ICRA', 'CARE', 'India Ratings'
  ratingDate: date("rating_date"),
  outlookStatus: varchar("outlook_status"), // 'stable', 'positive', 'negative'
  
  // Risk metrics
  duration: decimal("duration", { precision: 8, scale: 4 }),
  modifiedDuration: decimal("modified_duration", { precision: 8, scale: 4 }),
  convexity: decimal("convexity", { precision: 10, scale: 4 }),
  
  // Market data
  lastTradedPrice: decimal("last_traded_price", { precision: 15, scale: 4 }),
  lastTradedDate: date("last_traded_date"),
  volume: integer("volume"),
  turnover: decimal("turnover", { precision: 15, scale: 2 }),
  
  // Issuer information
  issuerSector: varchar("issuer_sector"),
  issuerIndustry: varchar("issuer_industry"),
  issuerCreditRating: varchar("issuer_credit_rating"),
  
  // Tax benefits (for tax-free bonds and infrastructure bonds)
  taxStatus: varchar("tax_status").default("taxable"), // 'taxable', 'tax_free', 'tax_saving_eligible'
  taxBenefitSection: varchar("tax_benefit_section"), // e.g., '54EC', '80CCF'
  taxBenefitDetails: text("tax_benefit_details"),
  indexationBenefit: boolean("indexation_benefit").default(false),
  
  // Infrastructure bond specific
  infrastructureSector: varchar("infrastructure_sector"), // 'power', 'roads', 'railways', 'ports', 'urban_infrastructure', 'renewable_energy'
  projectName: text("project_name"),
  utilizationPurpose: text("utilization_purpose"),
  sebiApproved: boolean("sebi_approved").default(false), // For infrastructure bonds
  
  // Additional features
  specialFeatures: jsonb("special_features").default([]),
  lockinPeriod: varchar("lockin_period"),
  
  // Metadata
  dataSource: varchar("data_source").default("bse_bond"), // 'bse_bond', 'manual'
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bond Orders table - Purchase and sale orders
export const bondOrders = pgTable("bond_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Order identification
  orderNumber: varchar("order_number").notNull().unique(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  clientCode: varchar("client_code"),
  
  // Bond details
  bondId: varchar("bond_id"), // References governmentSecurities or corporateBonds
  bondType: varchar("bond_type").notNull(), // 'government', 'corporate'
  isin: varchar("isin").notNull(),
  bondName: text("bond_name").notNull(),
  
  // Order details
  orderType: varchar("order_type").notNull(), // 'buy', 'sell'
  orderCategory: varchar("order_category").notNull(), // 'market', 'limit'
  quantity: integer("quantity").notNull(), // Number of bonds
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).notNull(),
  totalFaceValue: decimal("total_face_value", { precision: 15, scale: 2 }).notNull(), // quantity * faceValue
  
  // Pricing
  orderPrice: decimal("order_price", { precision: 15, scale: 4 }), // Price per bond
  limitPrice: decimal("limit_price", { precision: 15, scale: 4 }), // For limit orders
  grossAmount: decimal("gross_amount", { precision: 15, scale: 2 }).notNull(),
  accruedInterest: decimal("accrued_interest", { precision: 15, scale: 4 }).default("0"),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }).notNull(), // Includes accrued interest
  
  // Execution details
  orderStatus: varchar("order_status").default("pending"), // 'pending', 'confirmed', 'executed', 'rejected', 'cancelled'
  executionPrice: decimal("execution_price", { precision: 15, scale: 4 }),
  executionDate: timestamp("execution_date"),
  settlementDate: date("settlement_date"),
  
  // Exchange details
  exchangeOrderId: varchar("exchange_order_id"),
  exchangeTransactionId: varchar("exchange_transaction_id"),
  exchange: varchar("exchange").default("bse"), // 'bse', 'nse', 'otc'
  
  // Payment details
  paymentStatus: varchar("payment_status").default("pending"), // 'pending', 'paid', 'failed'
  paymentMethod: varchar("payment_method"),
  paymentReference: varchar("payment_reference"),
  paymentUrl: text("payment_url"),
  
  // Demat account
  dematAccountId: varchar("demat_account_id"),
  dematAccountNumber: varchar("demat_account_number"),
  
  // KYC compliance
  kycLevel: varchar("kyc_level"), // 'basic', 'full', 'enhanced'
  kycValidated: boolean("kyc_validated").default(false),
  
  // Audit trail
  orderPlacedBy: varchar("order_placed_by"), // 'client', 'advisor', 'system'
  remarks: text("remarks"),
  
  // Timestamps
  orderDate: timestamp("order_date").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bond_orders_user_id").on(table.userId),
  index("idx_bond_orders_status").on(table.orderStatus),
  index("idx_bond_orders_date").on(table.orderDate),
]);

// Bond Holdings table - User's bond portfolio
export const bondHoldings = pgTable("bond_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User and portfolio
  userId: varchar("user_id").references(() => users.id).notNull(),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Bond details
  bondId: varchar("bond_id"),
  bondType: varchar("bond_type").notNull(), // 'government', 'corporate'
  isin: varchar("isin").notNull(),
  bondName: text("bond_name").notNull(),
  issuer: varchar("issuer").notNull(),
  
  // Holding details
  quantity: integer("quantity").notNull(),
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).notNull(),
  totalFaceValue: decimal("total_face_value", { precision: 15, scale: 2 }).notNull(),
  
  // Purchase details
  purchaseDate: date("purchase_date").notNull(),
  purchasePrice: decimal("purchase_price", { precision: 15, scale: 4 }).notNull(), // Price per bond
  purchaseYield: decimal("purchase_yield", { precision: 8, scale: 4 }),
  totalInvestedAmount: decimal("total_invested_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Current valuation
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  currentYield: decimal("current_yield", { precision: 8, scale: 4 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  unrealizedGainLoss: decimal("unrealized_gain_loss", { precision: 15, scale: 2 }),
  
  // Bond characteristics
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }),
  maturityDate: date("maturity_date").notNull(),
  creditRating: varchar("credit_rating"),
  
  // Income tracking
  totalCouponsReceived: decimal("total_coupons_received", { precision: 15, scale: 2 }).default("0"),
  nextCouponDate: date("next_coupon_date"),
  nextCouponAmount: decimal("next_coupon_amount", { precision: 15, scale: 4 }),
  
  // Demat account
  dematAccountId: varchar("demat_account_id"),
  dematAccountNumber: varchar("demat_account_number"),
  
  // Status
  holdingStatus: varchar("holding_status").default("active"), // 'active', 'matured', 'sold'
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bond_holdings_user_id").on(table.userId),
  index("idx_bond_holdings_portfolio_id").on(table.portfolioId),
  index("idx_bond_holdings_status").on(table.holdingStatus),
]);

// Family Portfolio Permissions - Granular access control
export const familyPortfolioPermissions = pgTable("family_portfolio_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  permissionLevel: varchar("permission_level").default("view"), // view, contribute, manage, owner
  canViewTransactions: boolean("can_view_transactions").default(true),
  canAddFunds: boolean("can_add_funds").default(false),
  canTrade: boolean("can_trade").default(false),
  canWithdraw: boolean("can_withdraw").default(false),
  grantedAt: timestamp("granted_at").defaultNow(),
  grantedBy: varchar("granted_by").references(() => users.id),
}, (table) => [
  index("idx_family_portfolio_permissions_portfolio").on(table.portfolioId),
  index("idx_family_portfolio_permissions_user").on(table.userId),
]);

// Family Goals - Shared financial goals
export const familyGoals = pgTable("family_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  goalName: text("goal_name").notNull(),
  goalType: varchar("goal_type").notNull(), // retirement, education, home_purchase, vacation, emergency_fund, debt_payoff
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).default("0"),
  targetDate: date("target_date"),
  priority: varchar("priority").default("medium"), // high, medium, low
  status: varchar("status").default("active"), // active, completed, paused, cancelled
  isShared: boolean("is_shared").default(true), // True for family goals, false for individual within family
  ownerId: varchar("owner_id").references(() => users.id), // Primary owner/creator
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_family_goals_family").on(table.familyId),
  index("idx_family_goals_status").on(table.status),
]);

// Family Goal Contributions - Track who contributed what
export const familyGoalContributions = pgTable("family_goal_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => familyGoals.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  contributionDate: timestamp("contribution_date").defaultNow(),
  note: text("note"),
  contributionType: varchar("contribution_type").default("manual"), // manual, auto, transfer
}, (table) => [
  index("idx_family_goal_contributions_goal").on(table.goalId),
  index("idx_family_goal_contributions_user").on(table.userId),
]);

// Family Activity Log - Audit trail of all family financial activities
export const familyActivityLogs = pgTable("family_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  activityType: varchar("activity_type").notNull(), // portfolio_created, goal_added, contribution_made, member_invited, permission_changed, discussion_posted
  entityType: varchar("entity_type"), // portfolio, goal, member, permission, discussion
  entityId: varchar("entity_id"),
  action: text("action").notNull(),
  metadata: jsonb("metadata"), // Additional context like amounts, old/new values
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_family_activity_logs_family").on(table.familyId),
  index("idx_family_activity_logs_type").on(table.activityType),
  index("idx_family_activity_logs_created").on(table.createdAt),
]);

// Family Discussions - Communication for financial decisions
export const familyDiscussions = pgTable("family_discussions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  topicType: varchar("topic_type").notNull(), // general, goal, portfolio, budget, investment
  topicId: varchar("topic_id"), // Related entity ID (goal, portfolio, etc.)
  subject: text("subject").notNull(),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  parentMessageId: varchar("parent_message_id").references((): any => familyDiscussions.id), // For threaded replies
  attachments: jsonb("attachments"), // File URLs or references
  isResolved: boolean("is_resolved").default(false),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_family_discussions_family").on(table.familyId),
  index("idx_family_discussions_topic").on(table.topicId),
  index("idx_family_discussions_author").on(table.authorId),
]);

// Family Budgets - Shared household budgets
export const familyBudgets = pgTable("family_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  budgetName: text("budget_name").notNull(),
  category: varchar("category").notNull(), // housing, food, transportation, utilities, entertainment, healthcare, education
  monthlyLimit: decimal("monthly_limit", { precision: 15, scale: 2 }).notNull(),
  currentSpend: decimal("current_spend", { precision: 15, scale: 2 }).default("0"),
  period: varchar("period").default("monthly"), // weekly, monthly, quarterly, yearly
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  alertThreshold: decimal("alert_threshold", { precision: 5, scale: 2 }).default("80"), // Percentage
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_family_budgets_family").on(table.familyId),
  index("idx_family_budgets_category").on(table.category),
]);

// Insert schemas for bonds
export const insertGovernmentSecuritySchema = createInsertSchema(governmentSecurities).omit({
  id: true,
  createdAt: true,
});

export const insertCorporateBondSchema = createInsertSchema(corporateBonds).omit({
  id: true,
  createdAt: true,
});

export const insertBondOrderSchema = createInsertSchema(bondOrders).omit({
  id: true,
  createdAt: true,
  orderDate: true,
});

export const insertBondHoldingSchema = createInsertSchema(bondHoldings).omit({
  id: true,
  createdAt: true,
});

// Types for bonds
export type GovernmentSecurity = typeof governmentSecurities.$inferSelect;
export type InsertGovernmentSecurity = z.infer<typeof insertGovernmentSecuritySchema>;
export type CorporateBond = typeof corporateBonds.$inferSelect;
export type InsertCorporateBond = z.infer<typeof insertCorporateBondSchema>;
export type BondOrder = typeof bondOrders.$inferSelect;
export type InsertBondOrder = z.infer<typeof insertBondOrderSchema>;
export type BondHolding = typeof bondHoldings.$inferSelect;
export type InsertBondHolding = z.infer<typeof insertBondHoldingSchema>;

// ===== FAMILY COLLABORATION INSERT SCHEMAS AND TYPES =====

// Family Groups
export const insertFamilyGroupSchema = createInsertSchema(familyGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FamilyGroup = typeof familyGroups.$inferSelect;
export type InsertFamilyGroup = z.infer<typeof insertFamilyGroupSchema>;

// Family Members
export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  invitedAt: true,
});
export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;

// Family Portfolio Permissions
export const insertFamilyPortfolioPermissionSchema = createInsertSchema(familyPortfolioPermissions).omit({
  id: true,
  grantedAt: true,
});
export type FamilyPortfolioPermission = typeof familyPortfolioPermissions.$inferSelect;
export type InsertFamilyPortfolioPermission = z.infer<typeof insertFamilyPortfolioPermissionSchema>;

// Family Goals
export const insertFamilyGoalSchema = createInsertSchema(familyGoals).omit({
  id: true,
  createdAt: true,
});
export type FamilyGoal = typeof familyGoals.$inferSelect;
export type InsertFamilyGoal = z.infer<typeof insertFamilyGoalSchema>;

// Family Goal Contributions
export const insertFamilyGoalContributionSchema = createInsertSchema(familyGoalContributions).omit({
  id: true,
  contributionDate: true,
});
export type FamilyGoalContribution = typeof familyGoalContributions.$inferSelect;
export type InsertFamilyGoalContribution = z.infer<typeof insertFamilyGoalContributionSchema>;

// Family Activity Logs
export const insertFamilyActivityLogSchema = createInsertSchema(familyActivityLogs).omit({
  id: true,
  createdAt: true,
});
export type FamilyActivityLog = typeof familyActivityLogs.$inferSelect;
export type InsertFamilyActivityLog = z.infer<typeof insertFamilyActivityLogSchema>;

// Family Discussions
export const insertFamilyDiscussionSchema = createInsertSchema(familyDiscussions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FamilyDiscussion = typeof familyDiscussions.$inferSelect;
export type InsertFamilyDiscussion = z.infer<typeof insertFamilyDiscussionSchema>;

// Family Budgets
export const insertFamilyBudgetSchema = createInsertSchema(familyBudgets).omit({
  id: true,
  createdAt: true,
});
export type FamilyBudget = typeof familyBudgets.$inferSelect;
export type InsertFamilyBudget = z.infer<typeof insertFamilyBudgetSchema>;

// ============================================================================
// CUSTOMIZABLE ALERT SYSTEM
// ============================================================================

// User Alerts - Customizable alerts for market changes and spending habits
export const userAlerts = pgTable("user_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Alert configuration
  alertName: text("alert_name").notNull(),
  alertType: varchar("alert_type").notNull(), // 'market_price', 'market_change', 'market_volume', 'spending_category', 'spending_limit', 'spending_pattern', 'portfolio_value', 'portfolio_change'
  
  // Alert category
  category: varchar("category").notNull(), // 'market', 'spending', 'portfolio'
  
  // Market alert specific fields
  symbol: varchar("symbol"), // Stock/fund symbol for market alerts
  assetType: varchar("asset_type"), // 'stock', 'mutual_fund', 'bond', 'commodity', 'index'
  
  // Trigger conditions (JSON with flexible structure)
  triggerCondition: jsonb("trigger_condition").notNull(), 
  // Examples:
  // Market Price: { type: 'price_above', value: 1500 } or { type: 'price_below', value: 1200 }
  // Market Change: { type: 'percent_gain', value: 5 } or { type: 'percent_loss', value: 3 }
  // Spending: { type: 'category_limit', category: 'food', period: 'monthly', value: 10000 }
  // Portfolio: { type: 'value_below', value: 500000 }
  
  // Spending alert specific fields
  spendingCategory: varchar("spending_category"), // 'food', 'transport', 'entertainment', 'utilities', 'shopping', 'healthcare', etc.
  spendingPeriod: varchar("spending_period"), // 'daily', 'weekly', 'monthly', 'yearly'
  
  // Notification preferences
  notificationChannels: jsonb("notification_channels").default(['email']), // ['email', 'whatsapp', 'sms', 'push', 'in_app']
  
  // Alert status and controls
  isActive: boolean("is_active").default(true),
  priority: varchar("priority").default("medium"), // 'high', 'medium', 'low'
  
  // Frequency controls (prevent spam)
  cooldownPeriod: integer("cooldown_period").default(3600), // Seconds between repeated alerts (default 1 hour)
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: integer("trigger_count").default(0),
  
  // Metadata
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_alerts_user_id").on(table.userId),
  index("idx_user_alerts_type").on(table.alertType),
  index("idx_user_alerts_category").on(table.category),
  index("idx_user_alerts_active").on(table.isActive),
  index("idx_user_alerts_symbol").on(table.symbol),
]);

// Alert History - Log of triggered alerts
export const alertHistory = pgTable("alert_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertId: varchar("alert_id").references(() => userAlerts.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Trigger details
  triggeredAt: timestamp("triggered_at").defaultNow(),
  triggerValue: jsonb("trigger_value"), // Actual value that triggered the alert
  // Example: { currentPrice: 1550, threshold: 1500 } or { spending: 12000, limit: 10000 }
  
  // Alert snapshot at trigger time
  alertSnapshot: jsonb("alert_snapshot"), // Copy of alert config when triggered
  
  // Notification details
  notificationStatus: varchar("notification_status").default("pending"), // 'pending', 'sent', 'failed'
  notificationChannels: jsonb("notification_channels"),
  notificationSentAt: timestamp("notification_sent_at"),
  notificationError: text("notification_error"),
  
  // User interaction
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isDismissed: boolean("is_dismissed").default(false),
  dismissedAt: timestamp("dismissed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_alert_history_alert_id").on(table.alertId),
  index("idx_alert_history_user_id").on(table.userId),
  index("idx_alert_history_triggered").on(table.triggeredAt),
  index("idx_alert_history_read").on(table.isRead),
]);

// Alert Templates - Pre-defined alert templates for quick setup
export const alertTemplates = pgTable("alert_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  templateName: text("template_name").notNull(),
  templateType: varchar("template_type").notNull(), // 'market', 'spending', 'portfolio'
  category: varchar("category").notNull(),
  
  // Template configuration
  defaultConfig: jsonb("default_config").notNull(),
  description: text("description"),
  
  // Popularity and usage
  isPopular: boolean("is_popular").default(false),
  usageCount: integer("usage_count").default(0),
  
  // Admin controls
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_alert_templates_type").on(table.templateType),
  index("idx_alert_templates_popular").on(table.isPopular),
  index("idx_alert_templates_active").on(table.isActive),
]);

// Insert schemas and types for alerts
export const insertUserAlertSchema = createInsertSchema(userAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  triggerCount: true,
  lastTriggeredAt: true,
});
export type UserAlert = typeof userAlerts.$inferSelect;
export type InsertUserAlert = z.infer<typeof insertUserAlertSchema>;

export const insertAlertHistorySchema = createInsertSchema(alertHistory).omit({
  id: true,
  createdAt: true,
  triggeredAt: true,
});
export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertAlertHistory = z.infer<typeof insertAlertHistorySchema>;

export const insertAlertTemplateSchema = createInsertSchema(alertTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});
export type AlertTemplate = typeof alertTemplates.$inferSelect;
export type InsertAlertTemplate = z.infer<typeof insertAlertTemplateSchema>;

// ============================================================================
// FINANCIAL CHATBOT SYSTEM
// ============================================================================

// Chat Sessions - Conversation threads with AI financial advisor
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Session metadata
  title: text("title"), // Auto-generated or user-set title
  sessionType: varchar("session_type").default("general"), // 'general', 'transaction', 'portfolio_analysis', 'tax_advice'
  
  // Context for AI
  contextData: jsonb("context_data"), // Portfolio snapshot, user preferences, etc.
  
  // Linked entities (for better context tracking)
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  portfolioSnapshotId: varchar("portfolio_snapshot_id"), // Reference to specific snapshot
  
  // Session status
  isActive: boolean("is_active").default(true),
  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_chat_sessions_user_id").on(table.userId),
  index("idx_chat_sessions_active").on(table.isActive),
  index("idx_chat_sessions_last_message").on(table.lastMessageAt),
  index("idx_chat_sessions_portfolio").on(table.portfolioId),
]);

// Chat Messages - Individual messages in conversations
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => chatSessions.id).notNull(),
  
  // Message details
  role: varchar("role").notNull(), // 'user', 'assistant', 'system', 'function'
  content: text("content").notNull(),
  
  // Function calling support
  functionCall: jsonb("function_call"), // { name: 'buy_stock', arguments: {...} }
  functionResponse: jsonb("function_response"), // Result of function execution
  
  // AI metadata
  model: varchar("model").default("gemini-1.5-flash"), // Which AI model was used
  tokens: integer("tokens"), // Token count for this message
  
  // Message context
  attachments: jsonb("attachments"), // URLs, images, documents
  metadata: jsonb("metadata"), // Additional context like market data at time of message
  
  // User interaction
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  
  // Feedback
  userRating: integer("user_rating"), // 1-5 stars for AI responses
  feedbackText: text("feedback_text"),
  
  // Compliance & Moderation
  isFlagged: boolean("is_flagged").default(false),
  flaggedReason: text("flagged_reason"),
  flaggedAt: timestamp("flagged_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_chat_messages_session_id").on(table.sessionId),
  index("idx_chat_messages_role").on(table.role),
  index("idx_chat_messages_created").on(table.createdAt),
  index("idx_chat_messages_flagged").on(table.isFlagged),
]);

// Chat Functions - Available functions the AI can call
export const chatFunctions = pgTable("chat_functions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Function details
  functionName: varchar("function_name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  category: varchar("category").notNull(), // 'transaction', 'portfolio', 'market_data', 'analysis', 'admin'
  
  // Function schema for AI
  parameters: jsonb("parameters").notNull(), // JSON Schema for function parameters
  
  // Access control
  requiredRoles: jsonb("required_roles").default([]), // Roles that can use this function
  requiresConfirmation: boolean("requires_confirmation").default(true), // User must confirm before execution
  
  // Usage tracking
  isEnabled: boolean("is_enabled").default(true),
  usageCount: integer("usage_count").default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_chat_functions_category").on(table.category),
  index("idx_chat_functions_enabled").on(table.isEnabled),
]);

// Insert schemas and types for chatbot
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  messageCount: true,
  lastMessageAt: true,
});
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export const insertChatFunctionSchema = createInsertSchema(chatFunctions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  successRate: true,
});
export type ChatFunction = typeof chatFunctions.$inferSelect;
export type InsertChatFunction = z.infer<typeof insertChatFunctionSchema>;

// Chat Actions - Track transaction confirmations and executed actions
export const chatActions = pgTable("chat_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => chatSessions.id).notNull(),
  messageId: varchar("message_id").references(() => chatMessages.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Action details
  actionType: varchar("action_type").notNull(), // 'transaction', 'rebalance', 'schedule_call', 'update_profile'
  functionName: varchar("function_name").notNull(),
  
  // Confirmation workflow
  status: varchar("status").default("pending_confirmation"), // 'pending_confirmation', 'confirmed', 'rejected', 'executed', 'failed'
  userConfirmedAt: timestamp("user_confirmed_at"),
  executedAt: timestamp("executed_at"),
  
  // Action parameters and results
  actionParams: jsonb("action_params").notNull(), // Function parameters
  actionResult: jsonb("action_result"), // Execution result
  errorMessage: text("error_message"),
  
  // Linked entities
  transactionId: varchar("transaction_id"), // If action created a transaction
  orderId: varchar("order_id"), // If action created an order
  
  // Audit trail
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_chat_actions_session_id").on(table.sessionId),
  index("idx_chat_actions_user_id").on(table.userId),
  index("idx_chat_actions_status").on(table.status),
  index("idx_chat_actions_action_type").on(table.actionType),
]);

export const insertChatActionSchema = createInsertSchema(chatActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ChatAction = typeof chatActions.$inferSelect;
export type InsertChatAction = z.infer<typeof insertChatActionSchema>;

// Unified Order Management System - Tracks all orders across product types
export const unifiedOrders = pgTable("unified_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").notNull().unique(), // User-friendly order number: ORD-20250112-XXXX
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Product and order type
  productType: varchar("product_type").notNull(), // 'mutual_fund', 'aif', 'pms', 'bond', 'equity', 'ipo', 'fd', 'loan'
  productId: varchar("product_id"), // Reference to specific product
  productName: text("product_name").notNull(),
  
  // Order details
  orderType: varchar("order_type").notNull(), // 'buy', 'sell', 'subscription', 'redemption', 'sip', 'application'
  quantity: decimal("quantity", { precision: 18, scale: 4 }),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency").default("INR"),
  
  // Linked entities
  cartId: varchar("cart_id"),
  proposalId: varchar("proposal_id").references(() => investmentProposals.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Order lifecycle status
  status: varchar("status").notNull().default("initiated"), 
  // Status flow: initiated → payment_pending → payment_completed → kyc_verified → processing → executed → settled → completed
  // Error states: payment_failed, kyc_rejected, execution_failed, cancelled
  
  // Payment tracking
  paymentStatus: varchar("payment_status").default("pending"), // pending, completed, failed, refunded
  paymentGateway: varchar("payment_gateway"), // cashfree (primary), phonepe (secondary)
  paymentTransactionId: varchar("payment_transaction_id"),
  paymentAmount: decimal("payment_amount", { precision: 18, scale: 2 }),
  paymentCompletedAt: timestamp("payment_completed_at"),
  
  // KYC validation
  kycStatus: varchar("kyc_status").default("pending"), // pending, verified, rejected
  kycTier: varchar("kyc_tier"), // tier_1, tier_2, tier_3
  kycVerifiedAt: timestamp("kyc_verified_at"),
  kycRejectionReason: text("kyc_rejection_reason"),
  
  // Execution tracking
  executionStatus: varchar("execution_status").default("pending"), // pending, in_progress, completed, failed
  externalOrderId: varchar("external_order_id"), // BSE/Exchange order ID
  externalReference: varchar("external_reference"), // Transaction number, folio number, etc.
  executionPrice: decimal("execution_price", { precision: 18, scale: 6 }),
  executedQuantity: decimal("executed_quantity", { precision: 18, scale: 4 }),
  executedAt: timestamp("executed_at"),
  executionError: text("execution_error"),
  
  // Settlement tracking
  settlementStatus: varchar("settlement_status").default("pending"), // pending, in_progress, completed, failed
  settlementDate: timestamp("settlement_date"),
  settlementReference: varchar("settlement_reference"),
  
  // Additional metadata
  metadata: jsonb("metadata"), // Product-specific details, fees, charges, etc.
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  
  // Audit trail
  createdBy: varchar("created_by").references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id), // RM/Agent assigned
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => [
  index("idx_unified_orders_user").on(table.userId),
  index("idx_unified_orders_status").on(table.status),
  index("idx_unified_orders_product_type").on(table.productType),
  index("idx_unified_orders_payment_status").on(table.paymentStatus),
  index("idx_unified_orders_execution_status").on(table.executionStatus),
  index("idx_unified_orders_created_at").on(table.createdAt),
  index("idx_unified_orders_order_number").on(table.orderNumber),
]);

// Order Lifecycle Events - Track all state changes and events
export const orderLifecycleEvents = pgTable("order_lifecycle_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => unifiedOrders.id).notNull(),
  
  // Event details
  eventType: varchar("event_type").notNull(), // 'status_change', 'payment_update', 'kyc_update', 'execution_update', 'settlement_update', 'note_added'
  eventName: varchar("event_name").notNull(), // e.g., 'Payment Completed', 'Order Executed', 'KYC Verified'
  eventDescription: text("event_description"),
  
  // State tracking
  previousState: jsonb("previous_state"), // Previous status/data
  newState: jsonb("new_state"), // New status/data
  
  // Actor and context
  actorId: varchar("actor_id").references(() => users.id), // Who triggered the event
  actorType: varchar("actor_type"), // 'user', 'system', 'agent', 'payment_gateway', 'execution_service'
  
  // Event metadata
  metadata: jsonb("metadata"), // Additional event-specific data
  isSystemGenerated: boolean("is_system_generated").default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_order_events_order").on(table.orderId),
  index("idx_order_events_type").on(table.eventType),
  index("idx_order_events_created").on(table.createdAt),
]);

// Order Documents - Store generated documents (agreements, confirmations, etc.)
export const orderDocuments = pgTable("order_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => unifiedOrders.id).notNull(),
  
  // Document details
  documentType: varchar("document_type").notNull(), // 'subscription_agreement', 'payment_receipt', 'execution_confirmation', 'settlement_note', 'tax_invoice'
  documentName: text("document_name").notNull(),
  documentUrl: text("document_url"), // Object storage URL
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  
  // Document status
  status: varchar("status").default("generated"), // generated, signed, sent, archived
  sentToClient: boolean("sent_to_client").default(false),
  sentAt: timestamp("sent_at"),
  
  // Digital signature tracking
  requiresSignature: boolean("requires_signature").default(false),
  signedBy: varchar("signed_by").references(() => users.id),
  signedAt: timestamp("signed_at"),
  signatureHash: varchar("signature_hash"),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_order_documents_order").on(table.orderId),
  index("idx_order_documents_type").on(table.documentType),
  index("idx_order_documents_status").on(table.status),
]);

// Insert schemas and types for unified orders
export const insertUnifiedOrderSchema = createInsertSchema(unifiedOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
});
export type UnifiedOrder = typeof unifiedOrders.$inferSelect;
export type InsertUnifiedOrder = z.infer<typeof insertUnifiedOrderSchema>;

export const insertOrderLifecycleEventSchema = createInsertSchema(orderLifecycleEvents).omit({
  id: true,
  createdAt: true,
});
export type OrderLifecycleEvent = typeof orderLifecycleEvents.$inferSelect;
export type InsertOrderLifecycleEvent = z.infer<typeof insertOrderLifecycleEventSchema>;

export const insertOrderDocumentSchema = createInsertSchema(orderDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OrderDocument = typeof orderDocuments.$inferSelect;
export type InsertOrderDocument = z.infer<typeof insertOrderDocumentSchema>;

// Currency Rates table for multi-currency support
export const currencyRates = pgTable("currency_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  baseCurrency: varchar("base_currency").notNull().default("INR"),
  targetCurrency: varchar("target_currency").notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 }).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  dataSource: varchar("data_source").default("exchangerate-api"),
}, (table) => [
  index("idx_currency_rates_base_target").on(table.baseCurrency, table.targetCurrency),
  sql`UNIQUE(base_currency, target_currency)`,
]);

export const insertCurrencyRateSchema = createInsertSchema(currencyRates).omit({
  id: true,
  lastUpdated: true,
});
export type CurrencyRate = typeof currencyRates.$inferSelect;
export type InsertCurrencyRate = z.infer<typeof insertCurrencyRateSchema>;

// ============================================================================
// EXPENSE TRACKING & AI-POWERED BUDGETING SYSTEM
// ============================================================================

// User Expenses - Individual expense transactions with AI categorization
export const userExpenses = pgTable("user_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Transaction details
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("INR").notNull(),
  description: text("description").notNull(),
  transactionDate: timestamp("transaction_date").notNull(),
  
  // Categorization (AI-powered or manual)
  category: varchar("category").notNull(), // housing, food, transportation, utilities, entertainment, healthcare, education, shopping, travel, insurance, investment, other
  subcategory: varchar("subcategory"), // Optional subcategory for detailed tracking
  
  // AI categorization metadata
  aiCategorized: boolean("ai_categorized").default(false),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }), // Confidence score 0-100
  suggestedCategories: jsonb("suggested_categories"), // Alternative AI suggestions with confidence scores
  
  // Payment method and tags
  paymentMethod: varchar("payment_method"), // cash, card, upi, bank_transfer, other
  merchantName: varchar("merchant_name"),
  tags: jsonb("tags"), // User-defined tags for filtering
  
  // Receipt and notes
  receiptUrl: varchar("receipt_url"), // Object storage URL
  notes: text("notes"),
  
  // Recurring expense tracking
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency"), // weekly, monthly, yearly
  recurringGroupId: varchar("recurring_group_id"), // Link recurring transactions
  
  // BBPS Integration - Link to bill payment transactions
  bbpsTransactionId: varchar("bbps_transaction_id").references(() => bbpsTransactions.id),
  isBbpsPayment: boolean("is_bbps_payment").default(false), // Flag for quick filtering
  
  // Status
  isVerified: boolean("is_verified").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_expenses_user").on(table.userId),
  index("idx_user_expenses_category").on(table.category),
  index("idx_user_expenses_date").on(table.transactionDate),
  index("idx_user_expenses_recurring").on(table.recurringGroupId),
]);

// User Budgets - Category-wise budget limits
export const userBudgets = pgTable("user_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Budget details
  budgetName: text("budget_name").notNull(),
  category: varchar("category").notNull(), // Must match expense categories
  subcategory: varchar("subcategory"), // Optional for granular budgets
  
  // Budget amount and period
  budgetAmount: decimal("budget_amount", { precision: 15, scale: 2 }).notNull(),
  period: varchar("period").notNull(), // daily, weekly, monthly, quarterly, yearly
  currency: varchar("currency").default("INR").notNull(),
  
  // Tracking
  currentSpend: decimal("current_spend", { precision: 15, scale: 2 }).default("0"),
  lastResetDate: timestamp("last_reset_date").defaultNow(),
  
  // AI suggestions
  aiSuggested: boolean("ai_suggested").default(false),
  aiReasoning: text("ai_reasoning"), // Why AI suggested this budget
  
  // Alerts
  alertThreshold: decimal("alert_threshold", { precision: 5, scale: 2 }).default("80"), // Percentage
  alertEnabled: boolean("alert_enabled").default(true),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Timestamps
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_budgets_user").on(table.userId),
  index("idx_user_budgets_category").on(table.category),
  index("idx_user_budgets_period").on(table.period),
  sql`UNIQUE(user_id, category, subcategory, period)`,
]);

// Expense Insights - AI-generated spending insights and recommendations
export const expenseInsights = pgTable("expense_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Insight details
  insightType: varchar("insight_type").notNull(), // spending_pattern, anomaly, budget_suggestion, saving_opportunity, trend_analysis
  category: varchar("category"), // Related expense category
  
  // AI-generated content
  title: text("title").notNull(),
  description: text("description").notNull(),
  aiAnalysis: jsonb("ai_analysis").notNull(), // Detailed AI reasoning and data
  
  // Actionable recommendations
  recommendations: jsonb("recommendations"), // Array of actionable suggestions
  potentialSavings: decimal("potential_savings", { precision: 15, scale: 2 }), // Estimated savings if recommendation followed
  
  // Priority and status
  priority: varchar("priority").default("medium"), // high, medium, low
  status: varchar("status").default("new"), // new, viewed, acted_upon, dismissed
  
  // Insight validity period
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  
  // User interaction
  userFeedback: varchar("user_feedback"), // helpful, not_helpful, already_doing
  feedbackNotes: text("feedback_notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  dismissedAt: timestamp("dismissed_at"),
}, (table) => [
  index("idx_expense_insights_user").on(table.userId),
  index("idx_expense_insights_type").on(table.insightType),
  index("idx_expense_insights_status").on(table.status),
  index("idx_expense_insights_priority").on(table.priority),
]);

// Insert schemas and types
export const insertUserExpenseSchema = createInsertSchema(userExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UserExpense = typeof userExpenses.$inferSelect;
export type InsertUserExpense = z.infer<typeof insertUserExpenseSchema>;

export const insertUserBudgetSchema = createInsertSchema(userBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UserBudget = typeof userBudgets.$inferSelect;
export type InsertUserBudget = z.infer<typeof insertUserBudgetSchema>;

export const insertExpenseInsightSchema = createInsertSchema(expenseInsights).omit({
  id: true,
  createdAt: true,
  dismissedAt: true,
});
export type ExpenseInsight = typeof expenseInsights.$inferSelect;
export type InsertExpenseInsight = z.infer<typeof insertExpenseInsightSchema>;

// ============================================================================
// PRE-APPROVED LOAN OFFERS (Portfolio Display)
// ============================================================================

// Pre-Approved Loan Offers - Personalized loan offers shown in client portfolio
export const preApprovedLoanOffers = pgTable("pre_approved_loan_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Lender details
  lenderName: varchar("lender_name").notNull(), // Bajaj Finance, Tata Capital, HDFC, ICICI, etc.
  lenderLogo: varchar("lender_logo"),
  lenderType: varchar("lender_type").default("nbfc"), // nbfc, bank, fintech
  
  // Loan product details
  productType: varchar("product_type").notNull(), // personal_loan, home_loan, business_loan, education_loan, vehicle_loan, gold_loan
  productName: varchar("product_name").notNull(), // e.g., "Bajaj Finserv Personal Loan", "HDFC Home Loan"
  
  // Offer details
  offerAmount: decimal("offer_amount", { precision: 15, scale: 2 }).notNull(), // Pre-approved loan amount
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(), // Annual interest rate
  processingFee: decimal("processing_fee", { precision: 15, scale: 2 }).default("0"), // Processing fee amount
  processingFeePercentage: decimal("processing_fee_percentage", { precision: 5, scale: 2 }), // Processing fee as %
  
  // Tenure options
  minTenureMonths: integer("min_tenure_months").notNull(),
  maxTenureMonths: integer("max_tenure_months").notNull(),
  defaultTenureMonths: integer("default_tenure_months").notNull(), // Default shown to user
  
  // EMI calculation (for default tenure)
  monthlyEmi: decimal("monthly_emi", { precision: 15, scale: 2 }).notNull(),
  totalInterest: decimal("total_interest", { precision: 15, scale: 2 }),
  totalRepayment: decimal("total_repayment", { precision: 15, scale: 2 }),
  
  // Eligibility and status
  eligibilityStatus: varchar("eligibility_status").default("pre_approved"), // pre_approved, eligible, not_eligible, conditionally_approved
  eligibilityCriteria: jsonb("eligibility_criteria"), // Criteria details (income, credit score, etc.)
  
  // Offer validity
  offerValidUntil: timestamp("offer_valid_until").notNull(),
  offerCode: varchar("offer_code"), // Unique offer code for tracking
  
  // Features and benefits
  features: jsonb("features"), // Array of feature strings ["Zero prepayment charges", "Flexible EMI options", etc.]
  benefits: text("benefits"), // Key benefits description
  
  // Documentation required
  documentsRequired: jsonb("documents_required"), // Array of required documents
  
  // Application tracking
  applicationStatus: varchar("application_status").default("not_started"), // not_started, in_progress, submitted, approved, rejected, disbursed
  applicationId: varchar("application_id"), // Lender's application ID
  appliedAt: timestamp("applied_at"),
  approvedAt: timestamp("approved_at"),
  disbursedAt: timestamp("disbursed_at"),
  disbursedAmount: decimal("disbursed_amount", { precision: 15, scale: 2 }),
  
  // Priority and display
  displayPriority: integer("display_priority").default(0), // Higher number = higher priority
  isFeatured: boolean("is_featured").default(false),
  isRecommended: boolean("is_recommended").default(false), // AI/system recommendation
  recommendationReason: text("recommendation_reason"),
  
  // Partner integration
  partnerOfferId: varchar("partner_offer_id"), // Lender's offer ID
  partnerApiEndpoint: varchar("partner_api_endpoint"), // API endpoint for application
  partnerApplicationUrl: varchar("partner_application_url"), // Direct URL for lender application
  
  // Metadata
  metadata: jsonb("metadata"), // Additional lender-specific data
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  viewedAt: timestamp("viewed_at"), // When user viewed the offer
}, (table) => [
  index("idx_pre_approved_loan_offers_user").on(table.userId),
  index("idx_pre_approved_loan_offers_lender").on(table.lenderName),
  index("idx_pre_approved_loan_offers_product_type").on(table.productType),
  index("idx_pre_approved_loan_offers_eligibility").on(table.eligibilityStatus),
  index("idx_pre_approved_loan_offers_application").on(table.applicationStatus),
  index("idx_pre_approved_loan_offers_validity").on(table.offerValidUntil),
]);

// Insert schema and types
export const insertPreApprovedLoanOfferSchema = createInsertSchema(preApprovedLoanOffers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PreApprovedLoanOffer = typeof preApprovedLoanOffers.$inferSelect;
export type InsertPreApprovedLoanOffer = z.infer<typeof insertPreApprovedLoanOfferSchema>;

// ============================================================================
// API & INTEGRATION CONTROL CENTER
// ============================================================================

// Webhook Logs - Track all incoming webhooks from payment gateways and services
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Webhook source
  provider: varchar("provider").notNull(), // cashfree, phonepe, zoho, stripe, etc.
  eventType: varchar("event_type").notNull(), // payment_success, order_created, etc.
  
  // Request details
  method: varchar("method").default("POST"),
  endpoint: varchar("endpoint").notNull(),
  headers: jsonb("headers"),
  payload: jsonb("payload").notNull(),
  
  // Response details
  statusCode: integer("status_code"),
  responseBody: jsonb("response_body"),
  responseTime: integer("response_time"), // milliseconds
  
  // Processing details
  processingStatus: varchar("processing_status").default("pending"), // pending, success, failed, retry
  processingError: text("processing_error"),
  retryCount: integer("retry_count").default(0),
  
  // Verification
  signatureVerified: boolean("signature_verified").default(false),
  ipAddress: varchar("ip_address"),
  
  // Related data
  orderId: varchar("order_id"),
  transactionId: varchar("transaction_id"),
  userId: varchar("user_id"),
  
  // Timestamps
  receivedAt: timestamp("received_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => [
  index("idx_webhook_logs_provider").on(table.provider),
  index("idx_webhook_logs_event").on(table.eventType),
  index("idx_webhook_logs_status").on(table.processingStatus),
  index("idx_webhook_logs_received").on(table.receivedAt),
]);

// API Usage Logs - Track outbound API calls to 3rd party services
export const apiUsageLogs = pgTable("api_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // API details
  provider: varchar("provider").notNull(), // cashfree, phonepe, gemini, twilio, etc.
  apiEndpoint: varchar("api_endpoint").notNull(),
  apiMethod: varchar("api_method").default("GET"),
  
  // Request details
  requestHeaders: jsonb("request_headers"),
  requestBody: jsonb("request_body"),
  
  // Response details
  statusCode: integer("status_code"),
  responseBody: jsonb("response_body"),
  responseTime: integer("response_time"), // milliseconds
  
  // Status and error tracking
  status: varchar("status").default("pending"), // success, error, timeout
  errorMessage: text("error_message"),
  errorCode: varchar("error_code"),
  
  // Usage tracking
  userId: varchar("user_id"),
  feature: varchar("feature"), // payment, kyc, sms, ai_chat, etc.
  
  // Cost tracking (for paid APIs)
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
  currency: varchar("currency").default("USD"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_api_usage_provider").on(table.provider),
  index("idx_api_usage_status").on(table.status),
  index("idx_api_usage_feature").on(table.feature),
  index("idx_api_usage_created").on(table.createdAt),
]);

// Integration Health - Track health and status of all integrations
export const integrationHealth = pgTable("integration_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Integration details
  provider: varchar("provider").notNull().unique(), // cashfree, phonepe, gemini, twilio, etc.
  displayName: varchar("display_name").notNull(),
  category: varchar("category").notNull(), // payment, kyc, communication, ai, etc.
  
  // Status
  status: varchar("status").default("active"), // active, degraded, down, maintenance
  lastCheckedAt: timestamp("last_checked_at"),
  
  // Health metrics
  uptime: decimal("uptime", { precision: 5, scale: 2 }).default("100"), // percentage
  avgResponseTime: integer("avg_response_time"), // milliseconds
  errorRate: decimal("error_rate", { precision: 5, scale: 2 }).default("0"), // percentage
  
  // API usage stats (24h rolling window)
  totalRequests24h: integer("total_requests_24h").default(0),
  successfulRequests24h: integer("successful_requests_24h").default(0),
  failedRequests24h: integer("failed_requests_24h").default(0),
  
  // Configuration
  isEnabled: boolean("is_enabled").default(true),
  hasApiKey: boolean("has_api_key").default(false),
  hasWebhook: boolean("has_webhook").default(false),
  webhookUrl: varchar("webhook_url"),
  
  // Alerts
  alertsEnabled: boolean("alerts_enabled").default(true),
  alertThreshold: integer("alert_threshold").default(90), // error rate threshold
  lastAlertSent: timestamp("last_alert_sent"),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_health_status").on(table.status),
  index("idx_integration_health_category").on(table.category),
]);

// ============================================================================
// KYC VAULT SYSTEM - Comprehensive KYC Data Storage & Reuse
// ============================================================================

// KYC Vault - Secure storage with segregated encryption levels
export const kycVault = pgTable("kyc_vault", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // ENCRYPTED FIELDS (AES-256-GCM)
  encryptedFullName: text("encrypted_full_name"), // Full name from OKYC
  encryptedDateOfBirth: text("encrypted_date_of_birth"), // DOB
  encryptedGender: text("encrypted_gender"), // Gender
  encryptedFatherName: text("encrypted_father_name"), // Father's name
  encryptedAddress: text("encrypted_address"), // Complete address from Aadhaar
  encryptedCity: text("encrypted_city"),
  encryptedState: text("encrypted_state"),
  encryptedPincode: text("encrypted_pincode"),
  encryptedMobile: text("encrypted_mobile"), // Aadhaar-linked mobile
  encryptedEmail: text("encrypted_email"), // Aadhaar-linked email
  
  // TOKENIZED FIELDS (Format-preserving tokenization)
  tokenizedPan: varchar("tokenized_pan"), // Tokenized PAN
  tokenizedAadhaar: varchar("tokenized_aadhaar"), // Tokenized Aadhaar (full)
  tokenizedCkycKin: varchar("tokenized_ckyc_kin"), // Tokenized CKYC KIN number
  aadhaarLast4: varchar("aadhaar_last_4", { length: 4 }), // Last 4 digits (plain text for display)
  
  // HASHED FIELDS (SHA-256 for liveness reuse)
  faceImageHash: varchar("face_image_hash"), // Hash of face photo from OKYC
  faceImageHashAlgorithm: varchar("face_image_hash_algorithm").default("SHA-256"),
  
  // PLAIN TEXT STATUS FIELDS
  kycStatus: varchar("kyc_status").default("pending"), // pending/verified/failed/expired
  ckycStatus: varchar("ckyc_status").default("not_checked"), // not_checked/found/created/failed
  source: varchar("source").notNull(), // cashfree_okyc/ckyc_registry/manual
  verificationMethod: varchar("verification_method"), // aadhaar_otp/video_kyc/offline
  isReusable: boolean("is_reusable").default(false), // Can KYC be shared with external APIs?
  
  // CKYC INFORMATION (Encrypted for security)
  encryptedCkycKin: text("encrypted_ckyc_kin"), // CKYC KIN from registry (AES-256-GCM encrypted)
  ckycRegistrationDate: timestamp("ckyc_registration_date"),
  ckycExpiryDate: timestamp("ckyc_expiry_date"),
  ckycVerificationLevel: varchar("ckyc_verification_level"), // basic/enhanced
  
  // VERIFICATION METADATA
  cashfreeRefId: varchar("cashfree_ref_id"), // Cashfree OKYC reference ID
  aadhaarVerifiedAt: timestamp("aadhaar_verified_at"),
  panVerifiedAt: timestamp("pan_verified_at"),
  addressVerifiedAt: timestamp("address_verified_at"),
  
  // VALIDITY AND COMPLIANCE
  kycVerifiedAt: timestamp("kyc_verified_at").defaultNow(),
  kycExpiryDate: timestamp("kyc_expiry_date"), // Auto-calculated: verified + 2 years (SEBI norms)
  kycNextRenewalDate: timestamp("kyc_next_renewal_date"),
  isExpired: boolean("is_expired").default(false),
  
  // METADATA
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_vault_user").on(table.userId),
  index("idx_kyc_vault_status").on(table.kycStatus),
]);

// KYC Token Map - Reversible tokenization mapping (encrypted storage)
export const kycTokenMap = pgTable("kyc_token_map", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Token mapping
  token: varchar("token").notNull().unique(), // The tokenized value
  encryptedOriginalValue: text("encrypted_original_value").notNull(), // AES-encrypted original value
  fieldType: varchar("field_type").notNull(), // pan/aadhaar/ckyc_kin
  
  // Metadata
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiry for tokens
}, (table) => [
  index("idx_kyc_token_map_token").on(table.token),
  index("idx_kyc_token_map_user").on(table.userId),
]);

// KYC Consent Logs - Digital consent for KYC data reuse
export const kycConsentLogs = pgTable("kyc_consent_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User information
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Consent details
  consentType: varchar("consent_type").notNull(), // kyc_reuse/data_sharing/third_party_access
  consentGiven: boolean("consent_given").notNull(),
  consentText: text("consent_text").notNull(), // Full text of consent shown to user
  
  // Context
  purpose: text("purpose"), // e.g., "BSE STAR MF Onboarding", "Loan Application"
  thirdPartyName: varchar("third_party_name"), // e.g., "BSE", "AMC XYZ"
  
  // Digital signature
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  consentSignature: text("consent_signature"), // HMAC signature of consent
  
  // Timestamps
  consentedAt: timestamp("consented_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Consent validity period
  revokedAt: timestamp("revoked_at"), // If user revokes consent
}, (table) => [
  index("idx_kyc_consent_user").on(table.userId),
  index("idx_kyc_consent_type").on(table.consentType),
  index("idx_kyc_consent_given").on(table.consentGiven),
]);

// KYC Audit Logs - Comprehensive access tracking for compliance
export const kycAuditLogs = pgTable("kyc_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Target user
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Access details
  accessedBy: varchar("accessed_by"), // User ID or system identifier who accessed
  accessType: varchar("access_type").notNull(), // read/write/share/token_generate/token_validate
  dataFieldsAccessed: jsonb("data_fields_accessed"), // Array of field names accessed
  
  // Purpose and context
  purpose: text("purpose").notNull(), // Why was KYC accessed?
  apiEndpoint: varchar("api_endpoint"), // Which API endpoint was used
  externalParty: varchar("external_party"), // If shared with external party (BSE/NSE/AMC)
  
  // Request metadata
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  requestId: varchar("request_id"), // Correlation ID for request tracing
  
  // Result
  accessStatus: varchar("access_status").default("success"), // success/failed/denied
  failureReason: text("failure_reason"),
  
  // Compliance
  regulatoryPurpose: varchar("regulatory_purpose"), // AML/KYC/CDD/EDD
  complianceCheckPassed: boolean("compliance_check_passed").default(true),
  
  // Timestamps
  accessedAt: timestamp("accessed_at").defaultNow(),
}, (table) => [
  index("idx_kyc_audit_user").on(table.userId),
  index("idx_kyc_audit_accessed_by").on(table.accessedBy),
  index("idx_kyc_audit_type").on(table.accessType),
  index("idx_kyc_audit_timestamp").on(table.accessedAt),
]);

// KYC Reuse Tokens - JWT tokens for external API sharing
export const kycReuseTokens = pgTable("kyc_reuse_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Token details
  tokenId: varchar("token_id").notNull().unique(), // Format: KYC_REUSE_{nanoid}
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // JWT payload (encrypted at rest)
  encryptedJwtPayload: text("encrypted_jwt_payload").notNull(), // Encrypted JWT claims
  jwtSignature: text("jwt_signature").notNull(), // HMAC-SHA256 signature
  
  // Token metadata
  tokenPurpose: varchar("token_purpose"), // bse_star_mf/loan_application/insurance/pms_aif
  issuedTo: varchar("issued_to"), // External party name (BSE/AMC/Lender)
  scope: jsonb("scope"), // What data fields are included in token
  
  // Validity
  isActive: boolean("is_active").default(true),
  isRevoked: boolean("is_revoked").default(false),
  revokedAt: timestamp("revoked_at"),
  revokeReason: text("revoke_reason"),
  
  // Usage tracking
  usageCount: integer("usage_count").default(0),
  maxUsageLimit: integer("max_usage_limit"), // Optional usage limit
  lastUsedAt: timestamp("last_used_at"),
  
  // Timestamps
  issuedAt: timestamp("issued_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Token expiry (typ. 1 year)
}, (table) => [
  index("idx_kyc_reuse_token_id").on(table.tokenId),
  index("idx_kyc_reuse_user").on(table.userId),
  index("idx_kyc_reuse_active").on(table.isActive),
]);

// Data Source Consents - Track user consent for auto-population from each data source
export const dataSourceConsents = pgTable("data_source_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User information
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Data source details
  dataSource: varchar("data_source").notNull(), // mutual_funds/demat/bank/loans/insurance
  provider: varchar("provider"), // e.g., BSE_STAR/NSDL/CDSL/CIBIL/Turtlefin
  
  // Consent status
  consentGiven: boolean("consent_given").notNull(),
  consentPurpose: text("consent_purpose").notNull(), // auto_populate_holdings/portfolio_sync
  consentText: text("consent_text").notNull(), // Full consent text shown to user
  
  // Digital signature
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  // Validity period
  consentedAt: timestamp("consented_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Default: 90 days from consent
  revokedAt: timestamp("revoked_at"),
  revokeReason: text("revoke_reason"),
  
  // Status tracking
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"), // Last successful data fetch
  nextSyncDue: timestamp("next_sync_due"), // Next scheduled sync
  syncFrequency: varchar("sync_frequency").default("weekly"), // daily/weekly/monthly/manual
  
  // Audit metadata
  consentVersion: varchar("consent_version").default("v1.0"), // Track consent text versions
  regulatoryCompliance: jsonb("regulatory_compliance"), // RBI AA/SEBI compliance flags
}, (table) => [
  index("idx_data_source_consent_user").on(table.userId),
  index("idx_data_source_consent_source").on(table.dataSource),
  index("idx_data_source_consent_active").on(table.isActive),
  index("idx_data_source_consent_expires").on(table.expiresAt),
]);

// Auto-Population Status Tracking - Track progress of auto-population workflows
export const autoPopulationStatus = pgTable("auto_population_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User information
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Workflow details
  workflowId: varchar("workflow_id").notNull().unique(), // Unique ID for this auto-population run
  triggeredBy: varchar("triggered_by").notNull(), // kyc_completion/manual_refresh/scheduled_sync
  
  // Overall status
  status: varchar("status").notNull().default("initiated"), // initiated/in_progress/completed/partial_success/failed
  totalDataSources: integer("total_data_sources").default(0),
  successfulSources: integer("successful_sources").default(0),
  failedSources: integer("failed_sources").default(0),
  
  // Per-source status (JSON tracking)
  sourceStatus: jsonb("source_status"), // { mutual_funds: 'success', demat: 'failed', ... }
  sourceErrors: jsonb("source_errors"), // { demat: 'API timeout', ... }
  
  // Data metrics
  totalRecordsFetched: integer("total_records_fetched").default(0),
  totalHoldingsValue: numeric("total_holdings_value", { precision: 15, scale: 2 }),
  
  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  
  // Duration tracking
  durationMs: integer("duration_ms"), // Total time taken in milliseconds
  
  // Error handling
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
}, (table) => [
  index("idx_auto_pop_user").on(table.userId),
  index("idx_auto_pop_workflow").on(table.workflowId),
  index("idx_auto_pop_status").on(table.status),
  index("idx_auto_pop_initiated").on(table.initiatedAt),
]);

// Insert schemas and types for KYC Vault System
export const insertKycVaultSchema = createInsertSchema(kycVault).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type KycVault = typeof kycVault.$inferSelect;
export type InsertKycVault = z.infer<typeof insertKycVaultSchema>;

export const insertKycTokenMapSchema = createInsertSchema(kycTokenMap).omit({
  id: true,
  createdAt: true,
});
export type KycTokenMap = typeof kycTokenMap.$inferSelect;
export type InsertKycTokenMap = z.infer<typeof insertKycTokenMapSchema>;

export const insertKycConsentLogSchema = createInsertSchema(kycConsentLogs).omit({
  id: true,
  consentedAt: true,
});
export type KycConsentLog = typeof kycConsentLogs.$inferSelect;
export type InsertKycConsentLog = z.infer<typeof insertKycConsentLogSchema>;

export const insertKycAuditLogSchema = createInsertSchema(kycAuditLogs).omit({
  id: true,
  accessedAt: true,
});
export type KycAuditLog = typeof kycAuditLogs.$inferSelect;
export type InsertKycAuditLog = z.infer<typeof insertKycAuditLogSchema>;

export const insertKycReuseTokenSchema = createInsertSchema(kycReuseTokens).omit({
  id: true,
  issuedAt: true,
});
export type KycReuseToken = typeof kycReuseTokens.$inferSelect;
export type InsertKycReuseToken = z.infer<typeof insertKycReuseTokenSchema>;

// Insert schemas and types
export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  receivedAt: true,
});
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

export const insertApiUsageLogSchema = createInsertSchema(apiUsageLogs).omit({
  id: true,
  createdAt: true,
});
export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type InsertApiUsageLog = z.infer<typeof insertApiUsageLogSchema>;

export const insertIntegrationHealthSchema = createInsertSchema(integrationHealth).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type IntegrationHealth = typeof integrationHealth.$inferSelect;
export type InsertIntegrationHealth = z.infer<typeof insertIntegrationHealthSchema>;

export const insertDataSourceConsentSchema = createInsertSchema(dataSourceConsents).omit({
  id: true,
  consentedAt: true,
});
export type DataSourceConsent = typeof dataSourceConsents.$inferSelect;
export type InsertDataSourceConsent = z.infer<typeof insertDataSourceConsentSchema>;

export const insertAutoPopulationStatusSchema = createInsertSchema(autoPopulationStatus).omit({
  id: true,
  initiatedAt: true,
});
export type AutoPopulationStatus = typeof autoPopulationStatus.$inferSelect;
export type InsertAutoPopulationStatus = z.infer<typeof insertAutoPopulationStatusSchema>;

// Marketing Campaigns - Email and WhatsApp campaigns using Zoho and AiSensy
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Campaign details
  name: varchar("name").notNull(),
  description: text("description"),
  campaignType: varchar("campaign_type").notNull(), // email/whatsapp/sms/multi_channel
  
  // Channel specific IDs
  zohoCampaignId: varchar("zoho_campaign_id"), // Zoho Campaigns API campaign ID
  aisensyBroadcastId: varchar("aisensy_broadcast_id"), // AiSensy broadcast ID
  
  // Status
  status: varchar("status").notNull().default("draft"), // draft/scheduled/sending/sent/failed/cancelled
  
  // Audience
  targetSegment: varchar("target_segment"), // new_users/kyc_pending/active_traders/inactive_users/custom
  customFilters: jsonb("custom_filters"), // Advanced filtering criteria
  recipientCount: integer("recipient_count").default(0),
  
  // Email specific
  emailSubject: varchar("email_subject"),
  emailFromName: varchar("email_from_name"),
  emailReplyTo: varchar("email_reply_to"),
  emailHtmlContent: text("email_html_content"),
  emailTextContent: text("email_text_content"),
  
  // WhatsApp specific
  whatsappTemplateId: varchar("whatsapp_template_id"), // Approved template ID
  whatsappTemplateName: varchar("whatsapp_template_name"),
  whatsappMessage: text("whatsapp_message"),
  whatsappMediaUrl: varchar("whatsapp_media_url"), // Image/video/document URL
  whatsappButtons: jsonb("whatsapp_buttons"), // Interactive buttons
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at"),
  sendAt: timestamp("send_at"), // Actual send time
  
  // Performance metrics
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  openedCount: integer("opened_count").default(0),
  clickedCount: integer("clicked_count").default(0),
  bouncedCount: integer("bounced_count").default(0),
  unsubscribedCount: integer("unsubscribed_count").default(0),
  
  // Conversion tracking
  conversionGoal: varchar("conversion_goal"), // kyc_completion/investment/loan_application
  conversionsCount: integer("conversions_count").default(0),
  revenue: numeric("revenue", { precision: 15, scale: 2 }),
  
  // Creator
  createdBy: varchar("created_by").references(() => users.id),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_campaign_type").on(table.campaignType),
  index("idx_campaign_status").on(table.status),
  index("idx_campaign_created").on(table.createdAt),
]);

// Campaign Recipients - Track individual campaign sends
export const campaignRecipients = pgTable("campaign_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  campaignId: varchar("campaign_id").references(() => marketingCampaigns.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Contact details (denormalized for historical tracking)
  email: varchar("email"),
  mobile: varchar("mobile"),
  fullName: varchar("full_name"),
  
  // Status
  status: varchar("status").notNull().default("pending"), // pending/sent/delivered/opened/clicked/bounced/failed/unsubscribed
  
  // Engagement tracking
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  
  // Conversion tracking
  converted: boolean("converted").default(false),
  convertedAt: timestamp("converted_at"),
  conversionValue: numeric("conversion_value", { precision: 15, scale: 2 }),
  
  // Error handling
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_campaign_recipient_campaign").on(table.campaignId),
  index("idx_campaign_recipient_user").on(table.userId),
  index("idx_campaign_recipient_status").on(table.status),
]);

// Prospect Leads - Companies from Probe42 or other sources
export const prospectLeads = pgTable("prospect_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Company identification
  cin: varchar("cin"), // Company Identification Number
  companyName: varchar("company_name").notNull(),
  registrationNumber: varchar("registration_number"),
  
  // Contact details
  primaryEmail: varchar("primary_email"),
  primaryMobile: varchar("primary_mobile"),
  website: varchar("website"),
  
  // Address
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),
  
  // Financial information from Probe42
  paidUpCapital: numeric("paid_up_capital", { precision: 15, scale: 2 }),
  authorizedCapital: numeric("authorized_capital", { precision: 15, scale: 2 }),
  annualRevenue: numeric("annual_revenue", { precision: 15, scale: 2 }),
  netProfit: numeric("net_profit", { precision: 15, scale: 2 }),
  ebitda: numeric("ebitda", { precision: 15, scale: 2 }),
  totalAssets: numeric("total_assets", { precision: 15, scale: 2 }),
  
  // Financial metrics
  debtToEquityRatio: numeric("debt_to_equity_ratio", { precision: 10, scale: 2 }),
  currentRatio: numeric("current_ratio", { precision: 10, scale: 2 }),
  roe: numeric("roe", { precision: 10, scale: 2 }), // Return on Equity
  probe42Score: integer("probe42_score"), // 1-5 financial strength score
  
  // Classification
  industrySegment: varchar("industry_segment"),
  companyCategory: varchar("company_category"), // msme/large_enterprise/mid_market
  riskLevel: varchar("risk_level"), // low/medium/high
  
  // Directors information
  directors: jsonb("directors"), // Array of director details from Probe42
  authorizedSignatories: jsonb("authorized_signatories"),
  
  // Lead scoring
  leadScore: integer("lead_score").default(0), // 0-100 custom scoring
  leadQuality: varchar("lead_quality"), // hot/warm/cold
  investableSurplus: numeric("investable_surplus", { precision: 15, scale: 2 }), // Estimated investable cash
  
  // Status
  status: varchar("status").notNull().default("new"), // new/contacted/qualified/converted/rejected/on_hold
  assignedTo: varchar("assigned_to").references(() => users.id), // Agent/partner assigned
  
  // Source tracking
  source: varchar("source").notNull().default("probe42"), // probe42/manual/referral/import
  importBatchId: varchar("import_batch_id"), // Batch import tracking
  
  // Engagement
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  notes: text("notes"),
  
  // Conversion
  convertedToUserId: varchar("converted_to_user_id").references(() => users.id),
  convertedAt: timestamp("converted_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_prospect_cin").on(table.cin),
  index("idx_prospect_company_name").on(table.companyName),
  index("idx_prospect_status").on(table.status),
  index("idx_prospect_score").on(table.leadScore),
  index("idx_prospect_assigned").on(table.assignedTo),
  index("idx_prospect_created").on(table.createdAt),
]);

// Lead Activities - Track all interactions with prospect leads
export const leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  leadId: varchar("lead_id").references(() => prospectLeads.id).notNull(),
  
  // Activity details
  activityType: varchar("activity_type").notNull(), // call/email/whatsapp/meeting/note/status_change
  subject: varchar("subject"),
  description: text("description"),
  
  // Outcome
  outcome: varchar("outcome"), // successful/no_response/callback_requested/not_interested
  nextAction: varchar("next_action"),
  nextActionDate: timestamp("next_action_date"),
  
  // Performed by
  performedBy: varchar("performed_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_lead_activity_lead").on(table.leadId),
  index("idx_lead_activity_type").on(table.activityType),
  index("idx_lead_activity_created").on(table.createdAt),
]);

// Client Intelligence - Probe42 data for existing clients
export const clientIntelligence = pgTable("client_intelligence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Probe42 company verification (for corporate clients)
  cin: varchar("cin"),
  companyVerified: boolean("company_verified").default(false),
  
  // Financial health metrics
  probe42Score: integer("probe42_score"), // 1-5 score
  financialHealthStatus: varchar("financial_health_status"), // excellent/good/fair/poor/critical
  
  // Business metrics
  annualRevenue: numeric("annual_revenue", { precision: 15, scale: 2 }),
  netProfit: numeric("net_profit", { precision: 15, scale: 2 }),
  totalAssets: numeric("total_assets", { precision: 15, scale: 2 }),
  
  // Risk indicators
  riskLevel: varchar("risk_level"), // low/medium/high/critical
  riskFactors: jsonb("risk_factors"), // Array of identified risk factors
  legalCases: jsonb("legal_cases"), // Ongoing litigation
  complianceIssues: jsonb("compliance_issues"),
  
  // Opportunity scoring
  crossSellScore: integer("cross_sell_score").default(0), // 0-100
  upsellPotential: varchar("upsell_potential"), // high/medium/low
  recommendedProducts: jsonb("recommended_products"), // AI recommended products
  
  // Group company tracking
  groupCompanies: jsonb("group_companies"), // Related entities
  totalGroupRevenue: numeric("total_group_revenue", { precision: 15, scale: 2 }),
  
  // Refresh tracking
  lastRefreshedAt: timestamp("last_refreshed_at"),
  nextRefreshDue: timestamp("next_refresh_due"),
  refreshFrequency: varchar("refresh_frequency").default("monthly"), // weekly/monthly/quarterly
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_intel_user").on(table.userId),
  index("idx_client_intel_score").on(table.probe42Score),
  index("idx_client_intel_risk").on(table.riskLevel),
]);

// Insert schemas and types for marketing tables
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;

export const insertCampaignRecipientSchema = createInsertSchema(campaignRecipients).omit({
  id: true,
  createdAt: true,
});
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;

export const insertProspectLeadSchema = createInsertSchema(prospectLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ProspectLead = typeof prospectLeads.$inferSelect;
export type InsertProspectLead = z.infer<typeof insertProspectLeadSchema>;

export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({
  id: true,
  createdAt: true,
});
export type LeadActivity = typeof leadActivities.$inferSelect;
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;

export const insertClientIntelligenceSchema = createInsertSchema(clientIntelligence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ClientIntelligence = typeof clientIntelligence.$inferSelect;
export type InsertClientIntelligence = z.infer<typeof insertClientIntelligenceSchema>;

// ============ PREDICTIVE ANALYTICS TABLES ============

// Portfolio performance predictions
export const portfolioPredictions = pgTable("portfolio_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Prediction period
  predictionDate: timestamp("prediction_date").notNull(),
  predictionHorizon: varchar("prediction_horizon").notNull(), // '1M', '3M', '6M', '1Y', '3Y', '5Y'
  
  // Performance predictions
  expectedReturn: decimal("expected_return", { precision: 10, scale: 4 }), // Percentage
  expectedValue: decimal("expected_value", { precision: 20, scale: 2 }),
  lowerBound: decimal("lower_bound", { precision: 20, scale: 2 }), // 95% confidence
  upperBound: decimal("upper_bound", { precision: 20, scale: 2 }), // 95% confidence
  
  // Risk metrics
  volatility: decimal("volatility", { precision: 10, scale: 4 }), // Standard deviation
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  beta: decimal("beta", { precision: 10, scale: 4 }), // Market correlation
  varValue: decimal("var_value", { precision: 20, scale: 2 }), // Value at Risk
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }), // Maximum expected loss
  
  // Trend analysis
  trendDirection: varchar("trend_direction"), // 'bullish', 'bearish', 'neutral'
  trendStrength: decimal("trend_strength", { precision: 5, scale: 2 }), // 0-100
  momentum: decimal("momentum", { precision: 10, scale: 4 }),
  
  // Statistical indicators
  cagr: decimal("cagr", { precision: 10, scale: 4 }), // Compound Annual Growth Rate
  movingAverage50Day: decimal("moving_average_50day", { precision: 20, scale: 2 }),
  movingAverage200Day: decimal("moving_average_200day", { precision: 20, scale: 2 }),
  rsi: decimal("rsi", { precision: 5, scale: 2 }), // Relative Strength Index (0-100)
  
  // Prediction confidence
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }), // 0-100
  modelVersion: varchar("model_version"),
  dataQualityScore: decimal("data_quality_score", { precision: 5, scale: 2 }),
  
  // Historical comparison
  historicalAccuracy: decimal("historical_accuracy", { precision: 5, scale: 2 }), // % accuracy from past predictions
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_portfolio_predictions_user").on(table.userId),
  index("idx_portfolio_predictions_portfolio").on(table.portfolioId),
  index("idx_portfolio_predictions_date").on(table.predictionDate),
]);

// Asset-level performance forecasts
export const assetForecasts = pgTable("asset_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  holdingId: varchar("holding_id").references(() => portfolioHoldings.id),
  
  // Asset identification
  symbol: varchar("symbol").notNull(),
  assetType: varchar("asset_type").notNull(), // 'stock', 'mutual_fund', 'bond', 'crypto'
  
  // Forecast period
  forecastDate: timestamp("forecast_date").notNull(),
  horizon: varchar("horizon").notNull(), // '1M', '3M', '6M', '1Y'
  
  // Price predictions
  currentPrice: decimal("current_price", { precision: 20, scale: 2 }),
  predictedPrice: decimal("predicted_price", { precision: 20, scale: 2 }),
  priceChange: decimal("price_change", { precision: 10, scale: 4 }), // Percentage
  
  // Performance metrics
  expectedReturn: decimal("expected_return", { precision: 10, scale: 4 }),
  volatility: decimal("volatility", { precision: 10, scale: 4 }),
  beta: decimal("beta", { precision: 10, scale: 4 }),
  
  // Technical indicators
  supportLevel: decimal("support_level", { precision: 20, scale: 2 }),
  resistanceLevel: decimal("resistance_level", { precision: 20, scale: 2 }),
  trendSignal: varchar("trend_signal"), // 'buy', 'sell', 'hold'
  
  // Risk assessment
  riskRating: varchar("risk_rating"), // 'low', 'medium', 'high', 'very_high'
  probabilityOfLoss: decimal("probability_of_loss", { precision: 5, scale: 2 }), // 0-100
  
  // Recommendations
  recommendation: varchar("recommendation"), // 'strong_buy', 'buy', 'hold', 'sell', 'strong_sell'
  recommendationReason: text("recommendation_reason"),
  
  // Confidence metrics
  confidenceLevel: decimal("confidence_level", { precision: 5, scale: 2 }), // 0-100
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_asset_forecasts_user").on(table.userId),
  index("idx_asset_forecasts_symbol").on(table.symbol),
  index("idx_asset_forecasts_holding").on(table.holdingId),
]);

// Risk analysis and scenarios
export const riskAnalysis = pgTable("risk_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Analysis metadata
  analysisDate: timestamp("analysis_date").notNull(),
  analysisType: varchar("analysis_type").notNull(), // 'portfolio', 'asset', 'market'
  
  // Overall risk metrics
  overallRiskScore: decimal("overall_risk_score", { precision: 5, scale: 2 }), // 0-100
  riskCategory: varchar("risk_category"), // 'conservative', 'moderate', 'aggressive'
  
  // Diversification metrics
  diversificationScore: decimal("diversification_score", { precision: 5, scale: 2 }), // 0-100
  concentrationRisk: decimal("concentration_risk", { precision: 5, scale: 2 }),
  correlationRisk: decimal("correlation_risk", { precision: 5, scale: 2 }),
  
  // Market risk
  marketRisk: decimal("market_risk", { precision: 10, scale: 4 }),
  sectorRisk: decimal("sector_risk", { precision: 10, scale: 4 }),
  geographicRisk: decimal("geographic_risk", { precision: 10, scale: 4 }),
  
  // Stress test scenarios
  marketCrashScenario: jsonb("market_crash_scenario"), // Impact of 20% market drop
  recessionScenario: jsonb("recession_scenario"), // Economic recession impact
  interestRateRise: jsonb("interest_rate_rise"), // Interest rate increase impact
  inflationScenario: jsonb("inflation_scenario"), // High inflation impact
  
  // VaR calculations
  var1Day: decimal("var_1day", { precision: 20, scale: 2 }), // Value at Risk 1 day
  var1Week: decimal("var_1week", { precision: 20, scale: 2 }),
  var1Month: decimal("var_1month", { precision: 20, scale: 2 }),
  
  // Recommendations
  riskMitigationSuggestions: jsonb("risk_mitigation_suggestions"),
  rebalancingRecommendations: jsonb("rebalancing_recommendations"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_risk_analysis_user").on(table.userId),
  index("idx_risk_analysis_portfolio").on(table.portfolioId),
  index("idx_risk_analysis_date").on(table.analysisDate),
]);

// Prediction accuracy tracking
export const predictionAccuracy = pgTable("prediction_accuracy", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  predictionId: varchar("prediction_id").references(() => portfolioPredictions.id),
  assetForecastId: varchar("asset_forecast_id").references(() => assetForecasts.id),
  
  // Prediction details
  predictionDate: timestamp("prediction_date").notNull(),
  targetDate: timestamp("target_date").notNull(),
  actualDate: timestamp("actual_date").notNull(), // When actual result was measured
  
  // Accuracy metrics
  predictedValue: decimal("predicted_value", { precision: 20, scale: 2 }),
  actualValue: decimal("actual_value", { precision: 20, scale: 2 }),
  errorPercentage: decimal("error_percentage", { precision: 10, scale: 4 }),
  absoluteError: decimal("absolute_error", { precision: 20, scale: 2 }),
  
  // Evaluation
  accuracyScore: decimal("accuracy_score", { precision: 5, scale: 2 }), // 0-100
  predictionQuality: varchar("prediction_quality"), // 'excellent', 'good', 'fair', 'poor'
  
  // Model feedback
  modelVersion: varchar("model_version"),
  improvementNotes: text("improvement_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for predictive analytics
export const insertPortfolioPredictionSchema = createInsertSchema(portfolioPredictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PortfolioPrediction = typeof portfolioPredictions.$inferSelect;
export type InsertPortfolioPrediction = z.infer<typeof insertPortfolioPredictionSchema>;

export const insertAssetForecastSchema = createInsertSchema(assetForecasts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AssetForecast = typeof assetForecasts.$inferSelect;
export type InsertAssetForecast = z.infer<typeof insertAssetForecastSchema>;

export const insertRiskAnalysisSchema = createInsertSchema(riskAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type RiskAnalysis = typeof riskAnalysis.$inferSelect;
export type InsertRiskAnalysis = z.infer<typeof insertRiskAnalysisSchema>;

export const insertPredictionAccuracySchema = createInsertSchema(predictionAccuracy).omit({
  id: true,
  createdAt: true,
});
export type PredictionAccuracy = typeof predictionAccuracy.$inferSelect;
export type InsertPredictionAccuracy = z.infer<typeof insertPredictionAccuracySchema>;

