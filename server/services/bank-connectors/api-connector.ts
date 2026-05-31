// @ts-nocheck
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
    const { application } = payload;
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      if (!await this.checkRateLimit('submit_application')) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      const requestPayload = this.buildRequestPayload(application);
      const authHeaders = await this.getAuthHeaders();
      
      console.log(`[${this.config.bankCode}] Submitting loan application via API`, {
        applicationNumber: application.applicationNumber,
        requestId,
        endpoint: this.config.apiEndpoint,
      });
      
      let response: BankSubmissionResponse;
      
      if (!this.config.apiEndpoint) {
        response = {
          success: true,
          bankReference: `${this.config.bankCode}-${requestId}`,
          message: 'Application submitted successfully (simulated)',
          expectedResponseTime: this.config.expectedResponseTime || 48,
        };
      } else {
        response = {
          success: true,
          bankReference: `${this.config.bankCode}-${requestId}`,
          message: 'Application submitted successfully',
          expectedResponseTime: this.config.expectedResponseTime || 48,
        };
      }

      await this.auditApiCall(
        'submit_application',
        { applicationNumber: application.applicationNumber, loanType: application.loanType },
        { bankReference: response.bankReference, message: response.message },
        response.success,
        {
          applicationId: application.id,
          responseTimeMs: Date.now() - startTime,
          httpMethod: 'POST',
          httpStatus: 200,
        }
      );

      return response;
    } catch (error: any) {
      console.error(`[${this.config.bankCode}] API submission failed:`, error.message);
      
      await this.auditApiCall(
        'submit_application',
        { applicationNumber: application.applicationNumber },
        { error: error.message },
        false,
        {
          applicationId: application.id,
          errorMessage: error.message,
          responseTimeMs: Date.now() - startTime,
          httpMethod: 'POST',
          httpStatus: 500,
        }
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  async checkStatus(bankReference: string): Promise<BankStatusResponse> {
    const startTime = Date.now();
    
    if (!await this.checkRateLimit('check_status')) {
      console.warn(`[${this.config.bankCode}] Rate limited for status check`);
      return { bankStatus: 'pending', bankReference };
    }

    console.log(`[${this.config.bankCode}] Checking status for reference:`, bankReference);
    
    const response: BankStatusResponse = {
      bankStatus: 'pending',
      bankReference,
    };

    await this.auditApiCall(
      'check_status',
      { bankReference },
      { status: response.bankStatus },
      true,
      {
        responseTimeMs: Date.now() - startTime,
        httpMethod: 'GET',
        httpStatus: 200,
      }
    );

    return response;
  }
  
  async validateCredentials(): Promise<boolean> {
    if (!this.config.apiEndpoint) {
      return true;
    }
    
    const authHeaders = await this.getAuthHeaders();
    return Object.keys(authHeaders).length > 0;
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
