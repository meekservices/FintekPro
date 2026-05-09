import axios from 'axios';
import { 
  IBankingProvider, 
  BankBalance, 
  BankTransaction, 
  TransferRequest, 
  TransferResponse 
} from './banking-provider.interface';

export class SetuProvider implements IBankingProvider {
  private readonly baseUrl = 'https://payments-api.setu.co/v1';
  private readonly clientId: string;
  private readonly secret: string;

  constructor(clientId: string, secret: string) {
    this.clientId = clientId;
    this.secret = secret;
  }

  getProviderName(): string {
    return 'Setu';
  }

  private async getAuthToken(): Promise<string> {
    // Setu uses JWT or API keys depending on the product
    // This is a placeholder for their authentication logic
    return 'MOCK_TOKEN';
  }

  async getBalances(accountIds: string[]): Promise<BankBalance[]> {
    const token = await this.getAuthToken();
    const balances: BankBalance[] = [];

    for (const accId of accountIds) {
      const response = await axios.get(`${this.baseUrl}/accounts/${accId}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      balances.push({
        accountId: accId,
        accountNumber: accId,
        currency: 'INR',
        ledgerBalance: response.data.balance.toString(),
        availableBalance: response.data.availableBalance.toString(),
        lastSyncedAt: new Date(),
      });
    }

    return balances;
  }

  async getTransactions(accountId: string, startDate: Date, endDate: Date): Promise<BankTransaction[]> {
    const token = await this.getAuthToken();
    const response = await axios.get(`${this.baseUrl}/accounts/${accountId}/statement`, {
      params: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.data.transactions.map((item: any) => ({
      id: item.id,
      accountId: accountId,
      amount: item.amount.toString(),
      currency: 'INR',
      type: item.type === 'CREDIT' ? 'credit' : 'debit',
      status: 'success',
      description: item.remarks,
      transactionDate: new Date(item.createdAt),
      referenceNumber: item.utr,
    }));
  }

  async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
    const token = await this.getAuthToken();
    const payload = {
      amount: Math.round(parseFloat(request.amount) * 100),
      beneficiary: {
        accountNumber: request.toAccountDetails.accountNumber,
        ifsc: request.toAccountDetails.ifscCode,
        name: request.toAccountDetails.beneficiaryName,
      },
      mode: request.paymentRail,
      remarks: request.remarks,
    };

    const response = await axios.post(`${this.baseUrl}/payouts`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return {
      transferId: response.data.id,
      status: this.mapTransferStatus(response.data.status),
      referenceNumber: response.data.utr,
    };
  }

  async verifyBeneficiary(accountNumber: string, ifscCode: string): Promise<boolean> {
    const token = await this.getAuthToken();
    const payload = {
      accountNumber,
      ifsc: ifscCode,
    };

    try {
      const response = await axios.post(`${this.baseUrl}/verifications/bank-account`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.status === 'SUCCESS';
    } catch (e) {
      return false;
    }
  }

  private mapTransferStatus(status: string): 'pending' | 'success' | 'failed' {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
      case 'SETTLED': return 'success';
      case 'PENDING':
      case 'PROCESSING': return 'pending';
      case 'FAILED':
      case 'REJECTED': return 'failed';
      default: return 'pending';
    }
  }
}
