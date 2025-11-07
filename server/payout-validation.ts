import type { Response } from 'express';

export interface PayoutFields {
  panNumber?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

export function validatePayoutFields(fields: PayoutFields, isCreateOperation: boolean = false): string | null {
  const { panNumber, bankAccountNumber, ifscCode } = fields;
  
  // For create operations, PAN and bank account are required
  if (isCreateOperation) {
    if (!panNumber) {
      return "PAN number is required for payout processing";
    }
    if (!bankAccountNumber) {
      return "Bank account number is required for payout processing";
    }
  }
  
  // Validate PAN number format if provided
  if (panNumber) {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(panNumber)) {
      return "Invalid PAN number format. Must be 10 characters (e.g., ABCDE1234F)";
    }
  }
  
  // Validate bank account number format if provided
  if (bankAccountNumber) {
    const trimmed = bankAccountNumber.trim();
    
    if (trimmed.length === 0) {
      return "Bank account number cannot be empty";
    }
    
    // Bank account should be numeric and between 8-18 digits (typical for Indian banks)
    const bankAccountRegex = /^[0-9]{8,18}$/;
    if (!bankAccountRegex.test(trimmed)) {
      return "Invalid bank account number. Must be 8-18 digits";
    }
  }
  
  // Validate IFSC code format if provided
  if (ifscCode) {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscCode)) {
      return "Invalid IFSC code format. Must be 11 characters (e.g., HDFC0000123)";
    }
  }
  
  return null;
}
