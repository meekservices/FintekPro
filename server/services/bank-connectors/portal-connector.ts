import { BaseBankConnector, BankSubmissionPayload, BankSubmissionResponse, BankStatusResponse } from "./base-connector";
import { BankConnector } from "@shared/schema";

export class PortalBankConnector extends BaseBankConnector {
  constructor(config: BankConnector) {
    super(config);
  }
  
  get connectorType(): string {
    return 'portal';
  }
  
  async submitApplication(payload: BankSubmissionPayload): Promise<BankSubmissionResponse> {
    const { application, routingHistory } = payload;
    
    try {
      const requestId = this.generateRequestId();
      
      console.log(`[${this.config.bankCode}] Creating portal submission task`, {
        applicationNumber: application.applicationNumber,
        requestId,
        portalUrl: this.config.portalUrl,
      });
      
      return {
        success: true,
        bankReference: `${this.config.bankCode}-${requestId}`,
        message: 'Portal submission task created (manual intervention required)',
        expectedResponseTime: this.config.expectedResponseTime || 96,
      };
    } catch (error: any) {
      console.error(`[${this.config.bankCode}] Portal submission task creation failed:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  async checkStatus(bankReference: string): Promise<BankStatusResponse> {
    console.log(`[${this.config.bankCode}] Checking portal status for reference:`, bankReference);
    
    return {
      bankStatus: 'pending',
      bankReference,
    };
  }
  
  async validateCredentials(): Promise<boolean> {
    return true;
  }
  
  getPortalInstructions(application: any): string[] {
    return [
      `Navigate to ${this.config.portalUrl}`,
      'Login with DSA credentials',
      `Create new ${application.loanType} loan application`,
      `Enter applicant details: ${application.applicantName}`,
      `Enter loan amount: ₹${application.requestedAmount}`,
      `Enter tenure: ${application.requestedTenure} months`,
      'Upload required documents',
      'Submit application and note reference number',
    ];
  }
}
