import axios from 'axios';
import { 
  IBankingProvider, 
  BankBalance, 
  BankTransaction, 
  TransferRequest, 
  TransferResponse 
} from './banking-provider.interface';

export class DecentroProvider implements IBankingProvider {
  private readonly baseUrl = 'https://api.decentro.tech/v2';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly moduleSecret: string;

  constructor(clientId: string, clientSecret: string, moduleSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.moduleSecret = moduleSecret;
  }

  getProviderName(): string {
    return 'Decentro';
  }

  private getHeaders() {
    return {
      'client_id': this.clientId,
      'client_secret': this.clientSecret,
      'module_secret': this.moduleSecret,
      'Content-Type': 'application/json',
    };
  }

  async getBalances(accountIds: string[]): Promise<BankBalance[]> {
    // Decentro usually requires a specific provider_code and bank_account_number
    const balances: BankBalance[] = [];
    
    for (const accId of accountIds) {
      const response = await axios.get(`${this.baseUrl}/core_banking/accounts/balance`, {
        params: { account_number: accId },
        headers: this.getHeaders(),
      });

      const data = response.data.data;
      balances.push({
        accountId: accId,
        accountNumber: accId,
        currency: 'INR',
        ledgerBalance: data.balance.toString(),
        availableBalance: data.balance.toString(),
        lastSyncedAt: new Date(),
      });
    }

    return balances;
  }

  async getTransactions(accountId: string, startDate: Date, endDate: Date): Promise<BankTransaction[]> {
    const response = await axios.get(`${this.baseUrl}/core_banking/accounts/statement`, {
      params: {
        account_number: accountId,
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      },
      headers: this.getHeaders(),
    });

    return response.data.data.statement.map((item: any) => ({
      id: item.bank_reference_number || item.decentro_txn_id,
      accountId: accountId,
      amount: item.amount.toString(),
      currency: 'INR',
      type: item.transaction_type.toLowerCase() === 'credit' ? 'credit' : 'debit',
      status: 'success', // Decentro statement usually only returns successful txns
      description: item.narration,
      transactionDate: new Date(item.timestamp),
      referenceNumber: item.bank_reference_number,
    }));
  }

  async initiateTransfer(request: TransferRequest): Promise<TransferResponse> {
    const payload = {
      reference_id: `TRF_${Date.now()}`,
      transfer_type: request.paymentRail,
      transfer_amount: parseFloat(request.amount),
      purpose_message: request.remarks || 'Treasury Payout',
      beneficiary_details: {
        account_number: request.toAccountDetails.accountNumber,
        ifsc_code: request.toAccountDetails.ifscCode,
        beneficiary_name: request.toAccountDetails.beneficiaryName,
      },
    };

    const response = await axios.post(`${this.baseUrl}/core_banking/money_transfer/initiate`, payload, {
      headers: this.getHeaders(),
    });

    return {
      transferId: response.data.decentro_txn_id,
      status: this.mapTransferStatus(response.data.status),
      referenceNumber: response.data.bank_reference_number,
    };
  }

  async verifyBeneficiary(accountNumber: string, ifscCode: string): Promise<boolean> {
    const payload = {
      reference_id: `VAL_${Date.now()}`,
      account_number: accountNumber,
      ifsc_code: ifscCode,
    };

    try {
      const response = await axios.post(`${this.baseUrl}/core_banking/money_transfer/validate_bank_account`, payload, {
        headers: this.getHeaders(),
      });
      return response.data.status === 'success' && response.data.data.account_status === 'active';
    } catch (e) {
      return false;
    }
  }

  private mapTransferStatus(status: string): 'pending' | 'success' | 'failed' {
    switch (status.toLowerCase()) {
      case 'success': return 'success';
      case 'pending': return 'pending';
      case 'failure': return 'failed';
      default: return 'pending';
    }
  }
}
