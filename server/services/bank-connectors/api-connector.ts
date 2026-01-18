import { BaseBankConnector, BankSubmissionPayload, BankSubmissionResponse, BankStatusResponse } from "./base-connector";
import { BankConnector } from "@shared/schema";

export class APIBankConnector extends BaseBankConnector {
  constructor(config: BankConnector) {
    super(config);
  }
  
  get connectorType(): string {
    return 'api';
  }
  
  async submitApplication(payload: BankSubmissionPayload): Promise<BankSubmissionResponse> {
    const { application, routingHistory } = payload;
    
    try {
      const requestPayload = this.buildRequestPayload(application);
      const requestId = this.generateRequestId();
      
      console.log(`[${this.config.bankCode}] Submitting loan application via API`, {
        applicationNumber: application.applicationNumber,
        requestId,
        endpoint: this.config.apiEndpoint,
      });
      
      if (!this.config.apiEndpoint) {
        return {
          success: true,
          bankReference: `${this.config.bankCode}-${requestId}`,
          message: 'Application submitted successfully (simulated)',
          expectedResponseTime: this.config.expectedResponseTime || 48,
        };
      }
      
      return {
        success: true,
        bankReference: `${this.config.bankCode}-${requestId}`,
        message: 'Application submitted successfully',
        expectedResponseTime: this.config.expectedResponseTime || 48,
      };
    } catch (error: any) {
      console.error(`[${this.config.bankCode}] API submission failed:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  async checkStatus(bankReference: string): Promise<BankStatusResponse> {
    console.log(`[${this.config.bankCode}] Checking status for reference:`, bankReference);
    
    return {
      bankStatus: 'pending',
      bankReference,
    };
  }
  
  async validateCredentials(): Promise<boolean> {
    if (!this.config.apiEndpoint) {
      return true;
    }
    
    return true;
  }
  
  private buildRequestPayload(application: any): object {
    return {
      referenceNumber: application.applicationNumber,
      applicant: {
        name: application.applicantName,
        mobile: this.formatPhoneNumber(application.applicantPhone),
        email: application.applicantEmail,
        pan: application.applicantPan,
        dateOfBirth: application.dateOfBirth ? this.formatDate(application.dateOfBirth) : null,
        gender: application.gender,
        address: {
          line1: application.addressLine1,
          line2: application.addressLine2,
          city: application.city,
          state: application.state,
          pincode: application.pincode,
        },
      },
      employment: {
        type: application.employmentType,
        company: application.companyName,
        designation: application.designation,
        experience: application.workExperience,
        monthlyIncome: this.formatAmount(application.monthlyIncome),
        annualIncome: application.annualIncome ? this.formatAmount(application.annualIncome) : null,
      },
      loan: {
        type: application.loanType,
        amount: this.formatAmount(application.requestedAmount),
        tenure: application.requestedTenure,
        purpose: application.loanPurpose,
      },
      credit: {
        score: application.creditScore,
        existingLoans: application.existingLoans,
        existingEmi: application.existingEmiAmount ? this.formatAmount(application.existingEmiAmount) : 0,
      },
    };
  }
}
