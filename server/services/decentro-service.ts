import axios from 'axios';
import { 
  getDecentroClientId, 
  getDecentroClientSecret, 
  getDecentroModuleSecret, 
  getDecentroBaseUrl 
} from '../utils/decentro-config';
import { logger } from '../logger';

export interface DecentroResponse<T = any> {
  status: string;
  response_code: string;
  message: string;
  data?: T;
  decentro_txn_id: string;
}

export class DecentroService {
  private getHeaders() {
    return {
      'client_id': getDecentroClientId(),
      'client_secret': getDecentroClientSecret(),
      'module_secret': getDecentroModuleSecret(),
      'Content-Type': 'application/json'
    };
  }

  /**
   * Validate a bank account (Penny Drop / Account Verification)
   */
  async validateAccount(accountNumber: string, ifsc: string, name: string) {
    try {
      const baseUrl = getDecentroBaseUrl();
      const response = await axios.post<DecentroResponse>(
        `${baseUrl}/core_banking/money_transfer/validate_bank_account`,
        {
          beneficiary_details: {
            account_number: accountNumber,
            ifsc_code: ifsc,
            name: name
          },
          transfer_type: 'IMPS'
        },
        { headers: this.getHeaders() }
      );

      return {
        success: response.data.status === 'SUCCESS',
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      logger.error('[DecentroService] Account validation failed:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Account validation failed'
      };
    }
  }

  /**
   * Get balance for a linked account
   */
  async getBalance(accountNumber: string) {
    try {
      const baseUrl = getDecentroBaseUrl();
      const response = await axios.get<DecentroResponse>(
        `${baseUrl}/core_banking/money_transfer/balance?account_number=${accountNumber}`,
        { headers: this.getHeaders() }
      );

      return {
        success: response.data.status === 'SUCCESS',
        balance: response.data.data?.balance || 0,
        currency: response.data.data?.currency || 'INR'
      };
    } catch (error: any) {
      logger.error('[DecentroService] Balance check failed:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Balance check failed'
      };
    }
  }

  /**
   * Fetch recent transactions
   */
  async getTransactions(accountNumber: string, fromDate: string, toDate: string) {
    try {
      const baseUrl = getDecentroBaseUrl();
      const response = await axios.get<DecentroResponse>(
        `${baseUrl}/core_banking/money_transfer/statement?account_number=${accountNumber}&from=${fromDate}&to=${toDate}`,
        { headers: this.getHeaders() }
      );

      return {
        success: response.data.status === 'SUCCESS',
        transactions: response.data.data?.statement || []
      };
    } catch (error: any) {
      logger.error('[DecentroService] Statement fetch failed:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Statement fetch failed'
      };
    }
  }
}

export const decentroService = new DecentroService();
