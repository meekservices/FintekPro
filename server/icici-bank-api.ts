import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

export interface ICICIBankConfig {
  appKey: string;
  secretKey: string;
  baseUrl: string;
  environment: 'sandbox' | 'uat' | 'production';
}

export interface ICICIBankResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface AccountBalance {
  accountNumber: string;
  availableBalance: number;
  ledgerBalance: number;
  currency: string;
  accountType: string;
  lastUpdated: string;
}

export interface TransactionRecord {
  transactionId: string;
  accountNumber: string;
  amount: number;
  transactionType: 'CREDIT' | 'DEBIT';
  description: string;
  referenceNumber: string;
  valueDate: string;
  transactionDate: string;
  balance: number;
}

export interface PaymentRequest {
  accountNumber: string;
  beneficiaryAccountNumber: string;
  beneficiaryIFSC: string;
  amount: number;
  purpose: string;
  remarks?: string;
  beneficiaryName: string;
}

export interface PaymentResponse {
  transactionId: string;
  referenceNumber: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  amount: number;
  charges?: number;
  message: string;
}

export class ICICIBankAPI {
  private client: AxiosInstance;
  private config: ICICIBankConfig;

  constructor(config: ICICIBankConfig) {
    this.config = config;
    
    // Set base URL based on environment
    const baseUrls = {
      sandbox: 'https://apigwuat.icicibank.com',
      uat: 'https://apigwuat.icicibank.com', 
      production: 'https://apigw.icicibank.com'
    };

    this.client = axios.create({
      baseURL: baseUrls[config.environment] || baseUrls.sandbox,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Application-Key': config.appKey
      }
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      (request) => {
        const timestamp = Date.now().toString();
        const jsonData = request.data ? JSON.stringify(request.data) : '';
        const checksum = this.generateChecksum(timestamp, jsonData);
        
        request.headers['X-Timestamp'] = timestamp;
        request.headers['X-Checksum'] = checksum;
        
        return request;
      },
      (error) => Promise.reject(error)
    );
  }

  private generateChecksum(timestamp: string, jsonData: string): string {
    const dataToHash = timestamp + jsonData + this.config.secretKey;
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }

  /**
   * Get account balance for a specific account
   */
  async getAccountBalance(accountNumber: string): Promise<ICICIBankResponse<AccountBalance>> {
    try {
      const response = await this.client.post('/api/v1/accounts/balance', {
        accountNumber: accountNumber
      });

      return {
        success: true,
        data: {
          accountNumber: response.data.accountNumber,
          availableBalance: parseFloat(response.data.availableBalance),
          ledgerBalance: parseFloat(response.data.ledgerBalance),
          currency: response.data.currency || 'INR',
          accountType: response.data.accountType,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status?.toString()
      };
    }
  }

  /**
   * Get transaction history for an account
   */
  async getTransactionHistory(
    accountNumber: string, 
    fromDate: string, 
    toDate: string,
    limit: number = 100
  ): Promise<ICICIBankResponse<TransactionRecord[]>> {
    try {
      const response = await this.client.post('/api/v1/accounts/transactions', {
        accountNumber,
        fromDate,
        toDate,
        limit
      });

      const transactions = response.data.transactions?.map((txn: any) => ({
        transactionId: txn.transactionId,
        accountNumber: txn.accountNumber,
        amount: parseFloat(txn.amount),
        transactionType: txn.transactionType,
        description: txn.description,
        referenceNumber: txn.referenceNumber,
        valueDate: txn.valueDate,
        transactionDate: txn.transactionDate,
        balance: parseFloat(txn.balance)
      })) || [];

      return {
        success: true,
        data: transactions
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status?.toString()
      };
    }
  }

  /**
   * Make IMPS payment
   */
  async makeIMPSPayment(paymentRequest: PaymentRequest): Promise<ICICIBankResponse<PaymentResponse>> {
    try {
      const response = await this.client.post('/api/v1/payments/imps', {
        debitAccount: paymentRequest.accountNumber,
        creditAccount: paymentRequest.beneficiaryAccountNumber,
        ifscCode: paymentRequest.beneficiaryIFSC,
        amount: paymentRequest.amount,
        purpose: paymentRequest.purpose,
        remarks: paymentRequest.remarks || '',
        beneficiaryName: paymentRequest.beneficiaryName,
        transactionDate: new Date().toISOString().split('T')[0]
      });

      return {
        success: true,
        data: {
          transactionId: response.data.transactionId,
          referenceNumber: response.data.referenceNumber,
          status: response.data.status,
          amount: parseFloat(response.data.amount),
          charges: response.data.charges ? parseFloat(response.data.charges) : 0,
          message: response.data.message
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status?.toString()
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(transactionId: string): Promise<ICICIBankResponse<{ status: string; message: string }>> {
    try {
      const response = await this.client.post('/api/v1/payments/status', {
        transactionId
      });

      return {
        success: true,
        data: {
          status: response.data.status,
          message: response.data.message
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status?.toString()
      };
    }
  }

  /**
   * Validate account number and IFSC code
   */
  async validateAccount(accountNumber: string, ifscCode: string): Promise<ICICIBankResponse<{ valid: boolean; accountName?: string }>> {
    try {
      const response = await this.client.post('/api/v1/accounts/validate', {
        accountNumber,
        ifscCode
      });

      return {
        success: true,
        data: {
          valid: response.data.valid,
          accountName: response.data.accountName
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status?.toString()
      };
    }
  }

  /**
   * Get account statement
   */
  async getAccountStatement(
    accountNumber: string,
    fromDate: string,
    toDate: string,
    format: 'pdf' | 'excel' = 'pdf'
  ): Promise<ICICIBankResponse<{ downloadUrl: string; fileSize: number }>> {
    try {
      const response = await this.client.post('/api/v1/accounts/statement', {
        accountNumber,
        fromDate,
        toDate,
        format
      });

      return {
        success: true,
        data: {
          downloadUrl: response.data.downloadUrl,
          fileSize: response.data.fileSize
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        code: error.response?.status?.toString()
      };
    }
  }

  /**
   * Health check for API connectivity
   */
  async healthCheck(): Promise<ICICIBankResponse<{ status: string; timestamp: string }>> {
    try {
      const response = await this.client.get('/api/v1/health');
      
      return {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Health check failed',
        code: error.response?.status?.toString()
      };
    }
  }
}

// Export configured instance
export const iciciBankAPI = new ICICIBankAPI({
  appKey: process.env.ICICI_BANK_APP_KEY || '',
  secretKey: process.env.ICICI_BANK_SECRET_KEY || '',
  baseUrl: process.env.ICICI_BANK_BASE_URL || '',
  environment: (process.env.ICICI_BANK_ENVIRONMENT as 'sandbox' | 'uat' | 'production') || 'sandbox'
});