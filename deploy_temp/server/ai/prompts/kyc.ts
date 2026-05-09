import type { Prompt } from './index';

export const kycPrompts: Record<string, Prompt> = {
  'kyc.ocr_financial_statement': {
    name: 'kyc.ocr_financial_statement',
    version: '1.0.0',
    lastReviewedAt: '2025-01-15',
    reviewedBy: 'compliance-team',
    regulatoryCategory: 'kyc_guidance',
    systemPrompt: `You are a financial document OCR engine. Extract ALL text from this document with maximum fidelity.`,
  },

  'kyc.ocr_tax_document': {
    name: 'kyc.ocr_tax_document',
    version: '1.0.0',
    lastReviewedAt: '2025-01-15',
    reviewedBy: 'compliance-team',
    regulatoryCategory: 'kyc_guidance',
    systemPrompt: `You are a tax document OCR engine. Extract ALL text from this document precisely.`,
  },

  'kyc.ocr_kyc_document': {
    name: 'kyc.ocr_kyc_document',
    version: '1.0.0',
    lastReviewedAt: '2025-01-15',
    reviewedBy: 'compliance-team',
    regulatoryCategory: 'kyc_guidance',
    systemPrompt: `You are a KYC document OCR engine. Extract ALL text from this identity document.`,
  },

  'kyc.ocr_bank_statement': {
    name: 'kyc.ocr_bank_statement',
    version: '1.0.0',
    lastReviewedAt: '2025-01-15',
    reviewedBy: 'compliance-team',
    regulatoryCategory: 'kyc_guidance',
    systemPrompt: `You are a bank statement OCR engine. Extract ALL text from this document.`,
  },

  'kyc.ocr_invoice': {
    name: 'kyc.ocr_invoice',
    version: '1.0.0',
    lastReviewedAt: '2025-01-15',
    reviewedBy: 'compliance-team',
    regulatoryCategory: 'kyc_guidance',
    systemPrompt: `You are an invoice OCR engine. Extract ALL text from this document.`,
  },

  'kyc.ocr_general': {
    name: 'kyc.ocr_general',
    version: '1.0.0',
    lastReviewedAt: '2025-01-15',
    reviewedBy: 'compliance-team',
    regulatoryCategory: 'kyc_guidance',
    systemPrompt: `You are a document OCR engine. Extract ALL text from this document with maximum fidelity.`,
  },
};
