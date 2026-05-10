import axios from 'axios';
import { 
  getDecentroClientId, 
  getDecentroClientSecret, 
  getDecentroModuleSecret, 
  getDecentroBaseUrl 
} from '../utils/decentro-config';
import { logger } from '../logger';
import { db } from '../db';
import { verificationCache } from '../../shared/schema/kyc';
import { eq, and, gte } from 'drizzle-orm';
import crypto from 'crypto';

export interface DecentroResponse<T = unknown> {
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
      // 1. Check Cache first
      const identifierHash = crypto.createHash('sha256').update(`${accountNumber}_${ifsc}`).digest('hex');
      
      const [cached] = await db.select()
        .from(verificationCache)
        .where(
          and(
            eq(verificationCache.verificationType, 'bank_account'),
            eq(verificationCache.identifierHash, identifierHash),
            eq(verificationCache.verified, true),
            gte(verificationCache.expiresAt, new Date())
          )
        )
        .limit(1);

      if (cached) {
        logger.info(`[DecentroService] Cache HIT for account validation: ${accountNumber}`);
        return {
          success: true,
          data: cached.additionalData,
          message: 'Verification served from cache',
          isCached: true
        };
      }

      const baseUrl = getDecentroBaseUrl();
      const response = await axios.post<DecentroResponse<Record<string, unknown>>>(
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

      const success = response.data.status === 'SUCCESS';

      // 2. Cache the result if successful
      if (success) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30); // 30 days cache

        await db.insert(verificationCache).values({
          verificationType: 'bank_account',
          identifierHash,
          identifierMasked: `${accountNumber.slice(0, 2)}xxxx${accountNumber.slice(-4)}`,
          verified: true,
          verificationStatus: 'SUCCESS',
          registeredName: (response.data.data as Record<string, unknown>)?.full_name as string || name,
          provider: 'decentro',
          providerReferenceId: response.data.decentro_txn_id,
          additionalData: response.data.data as Record<string, unknown>,
          expiresAt: expiry
        }).onConflictDoUpdate({
          target: [verificationCache.verificationType, verificationCache.identifierHash],
          set: {
            verified: true,
            verifiedAt: new Date(),
            expiresAt: expiry,
            additionalData: response.data.data
          }
        });
      }

      return {
        success,
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: unknown) {
      const errorData = axios.isAxiosError(error) ? error.response?.data : null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[DecentroService] Account validation failed:', errorData || errorMessage);
      return {
        success: false,
        message: (errorData as Record<string, unknown>)?.message as string || errorMessage || 'Account validation failed'
      };
    }
  }

  /**
   * Get balance for a linked account
   */
  async getBalance(accountNumber: string) {
    try {
      const baseUrl = getDecentroBaseUrl();
      const response = await axios.get<DecentroResponse<Record<string, unknown>>>(
        `${baseUrl}/core_banking/money_transfer/balance?account_number=${accountNumber}`,
        { headers: this.getHeaders() }
      );

      return {
        success: response.data.status === 'SUCCESS',
        balance: (response.data.data as Record<string, unknown>)?.balance as number || 0,
        currency: (response.data.data as Record<string, unknown>)?.currency as string || 'INR'
      };
    } catch (error: unknown) {
      const errorData = axios.isAxiosError(error) ? error.response?.data : null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[DecentroService] Balance check failed:', errorData || errorMessage);
      return {
        success: false,
        message: (errorData as Record<string, unknown>)?.message as string || errorMessage || 'Balance check failed'
      };
    }
  }

  /**
   * Fetch recent transactions
   */
  async getTransactions(accountNumber: string, fromDate: string, toDate: string) {
    try {
      const baseUrl = getDecentroBaseUrl();
      const response = await axios.get<DecentroResponse<Record<string, unknown>>>(
        `${baseUrl}/core_banking/money_transfer/statement?account_number=${accountNumber}&from=${fromDate}&to=${toDate}`,
        { headers: this.getHeaders() }
      );

      return {
        success: response.data.status === 'SUCCESS',
        transactions: (response.data.data as Record<string, unknown>)?.statement as unknown[] || []
      };
    } catch (error: unknown) {
      const errorData = axios.isAxiosError(error) ? error.response?.data : null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[DecentroService] Statement fetch failed:', errorData || errorMessage);
      return {
        success: false,
        message: (errorData as Record<string, unknown>)?.message as string || errorMessage || 'Statement fetch failed'
      };
    }
  }
}

export const decentroService = new DecentroService();
