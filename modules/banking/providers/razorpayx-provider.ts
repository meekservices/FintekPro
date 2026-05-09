import axios from 'axios';
import { 
  IBankingProvider, 
  BankBalance, 
  BankTransaction, 
  TransferRequest, 
  TransferResponse 
} from './banking-provider.interface';

export class RazorpayXProvider implements IBankingProvider {
  private readonly baseUrl = 'https://api.razorpay.com/v1';
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly accountId: string;

  constructor(apiKey: string, apiSecret: string, accountId: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.accountId = accountId;
  }

  getProviderName(): string {
    return 'RazorpayX';
  }

  private getAuthHeader() {
    return {
      Authorization: `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
    };
  }

  async getBalances(accountIds: string[]): Promise<BankBalance[]> {
    // RazorpayX often has a primary account but supports virtual accounts
    // For now, we fetch the primary account balance
    const response = await axios.get(`${this.baseUrl}/payout-link/accounts/${this.accountId}`, {
      headers: this.getAuthHeader(),
    });

    const data = response.data;
    return [{
      accountId: this.accountId,
      accountNumber: data.account_number,
      currency: 'INR',
      ledgerBalance: (data.balance / 100).toString(), // convert paise to rupees
      availableBalance: (data.balance / 100).toString(),
      lastSyncedAt: new Date(),
    }];
  }

  async getTransactions(accountId: string, startDate: Date, endDate: Date): Promise<BankTransaction[]> {
    // Note: RazorpayX transaction API endpoint might vary based on account type
    const response = await axios.get(`${this.baseUrl}/transactions`, {
      params: {
        account_id: accountId,
        from: Math.floor(startDate.getTime() / 1000),
        to: Math.floor(endDate.getTime() / 1000),
      },
      headers: this.getAuthHeader(),
    });

    return response.data.items.map((item: any) => ({
      id: item.id,
      accountId: accountId,
      amount: (item.amount / 100).toString(),
      currency: item.currency,
      type: item.type === 'credit' ? 'credit' : 'debit',
      status: this.mapStatus(item.status),
      description: item.notes?.reason || 'Transaction',
      transactionDate: new Date(item.created_at * 1000),
      referenceNumber: item.source_id,
    }));
  }

  async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
    const payload = {
      account_number: this.accountId,
      amount: Math.round(parseFloat(request.amount) * 100),
      currency: request.currency,
      mode: request.paymentRail,
      purpose: 'payout',
      fund_account: {
        account_type: 'bank_account',
        bank_account: {
          name: request.toAccountDetails.beneficiaryName,
          ifsc: request.toAccountDetails.ifscCode,
          account_number: request.toAccountDetails.accountNumber,
        },
        contact: {
          name: request.toAccountDetails.beneficiaryName,
          type: 'vendor',
        },
      },
      queue_if_low_balance: true,
      reference_id: `TRF_${Date.now()}`,
      notes: {
        remarks: request.remarks,
      },
    };

    const response = await axios.post(`${this.baseUrl}/payouts`, payload, {
      headers: this.getAuthHeader(),
    });

    return {
      transferId: response.data.id,
      status: this.mapTransferStatus(response.data.status),
      referenceNumber: response.data.reference_id,
    };
  }

  async verifyBeneficiary(accountNumber: string, ifscCode: string): Promise<boolean> {
    // RazorpayX provides "Fund Account Validation"
    const payload = {
      account_number: this.accountId,
      fund_account: {
        account_type: 'bank_account',
        bank_account: {
          ifsc: ifscCode,
          account_number: accountNumber,
        },
      },
      amount: 100, // ₹1 validation
      currency: 'INR',
      notes: {
        purpose: 'verification',
      },
    };

    try {
      const response = await axios.post(`${this.baseUrl}/fund_account_validations`, payload, {
        headers: this.getAuthHeader(),
      });
      return response.data.status === 'completed' && response.data.results.account_status === 'active';
    } catch (e) {
      return false;
    }
  }

  private mapStatus(status: string): 'pending' | 'success' | 'failed' | 'reversed' {
    switch (status) {
      case 'processed': return 'success';
      case 'processing': return 'pending';
      case 'failed': return 'failed';
      case 'reversed': return 'reversed';
      default: return 'pending';
    }
  }

  private mapTransferStatus(status: string): 'pending' | 'success' | 'failed' {
    switch (status) {
      case 'processed': return 'success';
      case 'processing':
      case 'queued':
      case 'pending': return 'pending';
      case 'failed':
      case 'rejected':
      case 'cancelled': return 'failed';
      default: return 'pending';
    }
  }
}
