import { DsaLoanApplication } from "@shared/schema";
import { CanonicalLoanPayload, LoanProductType } from "./canonical-payload";

export function mapLoanTypeToProduct(loanType: string): LoanProductType {
  const mapping: Record<string, LoanProductType> = {
    'personal': 'PERSONAL_LOAN',
    'business': 'BUSINESS_LOAN',
    'home': 'HOME_LOAN',
    'lap': 'LAP',
    'car': 'CAR_LOAN',
    'vehicle': 'CAR_LOAN',
    'education': 'EDUCATION_LOAN',
    'gold': 'GOLD_LOAN',
    'securities': 'LOAN_AGAINST_SECURITIES',
    'las': 'LOAN_AGAINST_SECURITIES',
  };
  return mapping[loanType.toLowerCase()] || 'PERSONAL_LOAN';
}

export function mapEmploymentTypeToCanonical(employmentType: string): 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' {
  const mapping: Record<string, 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS'> = {
    'salaried': 'SALARIED',
    'self_employed': 'SELF_EMPLOYED',
    'self-employed': 'SELF_EMPLOYED',
    'business': 'BUSINESS',
    'professional': 'SELF_EMPLOYED',
  };
  return mapping[employmentType.toLowerCase()] || 'SALARIED';
}

export function applicationToCanonical(
  application: DsaLoanApplication,
  additionalData?: {
    bureauScore?: number;
    bureauName?: 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF';
    documentUrls?: {
      aadhaar?: string;
      pan?: string;
      bank_statement?: string;
    };
    consentIp?: string;
  }
): CanonicalLoanPayload {
  const now = new Date().toISOString();
  
  return {
    application_id: application.applicationNumber,
    applicant: {
      full_name: application.applicantName,
      dob: application.dateOfBirth ? new Date(application.dateOfBirth).toISOString().split('T')[0] : '',
      pan: application.applicantPan || '',
      mobile: application.applicantPhone,
      email: application.applicantEmail || '',
      employment_type: mapEmploymentTypeToCanonical(application.employmentType),
      gender: application.gender?.toUpperCase() as 'MALE' | 'FEMALE' | 'OTHER' | undefined,
      address: application.addressLine1 ? {
        line1: application.addressLine1,
        line2: application.addressLine2 || undefined,
        city: application.city || '',
        state: application.state || '',
        pincode: application.pincode || '',
      } : undefined,
    },
    income: {
      monthly_income: parseFloat(application.monthlyIncome) || 0,
      annual_income: application.annualIncome ? parseFloat(application.annualIncome) : undefined,
      employer_name: application.companyName || undefined,
      designation: application.designation || undefined,
      work_experience_years: application.workExperience || undefined,
    },
    loan: {
      product: mapLoanTypeToProduct(application.loanType),
      amount: parseFloat(application.requestedAmount) || 0,
      tenure_months: application.requestedTenure,
      purpose: application.loanPurpose || undefined,
    },
    bureau: additionalData?.bureauScore ? {
      score: additionalData.bureauScore,
      bureau_name: additionalData.bureauName || 'CIBIL',
    } : (application.creditScore ? {
      score: application.creditScore,
      bureau_name: 'CIBIL',
    } : undefined),
    documents: additionalData?.documentUrls,
    consent: {
      timestamp: now,
      ip: additionalData?.consentIp || '0.0.0.0',
      terms_accepted: true,
    },
    existing_obligations: application.existingLoans ? {
      total_emi: parseFloat(application.existingEmiAmount || '0'),
      loan_count: application.existingLoans,
    } : undefined,
    collateral: application.collateralType ? {
      type: application.collateralType,
      value: parseFloat(application.collateralValue || '0'),
      description: application.collateralDescription || undefined,
    } : undefined,
  };
}

export function validateCanonicalPayload(payload: CanonicalLoanPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!payload.application_id) errors.push('Application ID is required');
  if (!payload.applicant.full_name) errors.push('Applicant name is required');
  if (!payload.applicant.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(payload.applicant.pan)) {
    errors.push('Valid PAN is required');
  }
  if (!payload.applicant.mobile || !/^\d{10}$/.test(payload.applicant.mobile.replace(/^\+91/, '').replace(/\D/g, ''))) {
    errors.push('Valid 10-digit mobile number is required');
  }
  if (!payload.loan.amount || payload.loan.amount <= 0) errors.push('Loan amount must be positive');
  if (!payload.loan.tenure_months || payload.loan.tenure_months <= 0) errors.push('Loan tenure must be positive');
  if (!payload.income.monthly_income || payload.income.monthly_income <= 0) errors.push('Monthly income is required');
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
