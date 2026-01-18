import { DsaLoanApplication, LoanRoutingHistory, BankConnector } from "@shared/schema";

export interface BankSubmissionPayload {
  application: DsaLoanApplication;
  documents?: Array<{
    type: string;
    url: string;
    name: string;
  }>;
  routingHistory: LoanRoutingHistory;
}

export interface BankSubmissionResponse {
  success: boolean;
  bankReference?: string;
  message?: string;
  error?: string;
  expectedResponseTime?: number;
}

export interface BankStatusResponse {
  bankStatus: 'pending' | 'in_review' | 'approved' | 'rejected' | 'query' | 'documents_required';
  bankReference?: string;
  approvedAmount?: number;
  approvedTenure?: number;
  offeredInterestRate?: number;
  processingFee?: number;
  rejectionReason?: string;
  queryDetails?: string;
  sanctionLetterUrl?: string;
}

export abstract class BaseBankConnector {
  protected config: BankConnector;
  
  constructor(config: BankConnector) {
    this.config = config;
  }
  
  abstract get connectorType(): string;
  
  abstract submitApplication(payload: BankSubmissionPayload): Promise<BankSubmissionResponse>;
  
  abstract checkStatus(bankReference: string): Promise<BankStatusResponse>;
  
  abstract validateCredentials(): Promise<boolean>;
  
  protected formatPhoneNumber(phone: string): string {
    return phone.startsWith('+91') ? phone : `+91${phone}`;
  }
  
  protected formatAmount(amount: string | number): number {
    return typeof amount === 'string' ? parseFloat(amount) : amount;
  }
  
  protected formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }
  
  protected maskPAN(pan: string | null): string {
    if (!pan) return 'XXXXX****X';
    return pan.substring(0, 5) + '****' + pan.substring(9);
  }
  
  protected generateRequestId(): string {
    return `REQ${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
}
