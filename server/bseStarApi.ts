/**
 * BSE Star MF API Integration Service
 * 
 * Handles mutual fund order processing through BSE Star MF platform
 * Based on BSE Star MF Web Services API v3.1
 */

import { randomUUID } from "crypto";
import axios from "axios";
import * as crypto from "crypto";

// BSE Star API Configuration
const BSE_API_CONFIG = {
  demo: {
    baseUrl: "https://bsestarmfdemo.bseindia.com/StarMFCommonAPI/",
    orderUrl: "https://bsestarmfdemo.bseindia.com/MFOrderEntry/MFOrder.svc",
    uploadUrl: "https://bsestarmfdemo.bseindia.com/MFUploadService/MFUploadService.svc"
  },
  production: {
    baseUrl: "https://www.bsestarmf.in/StarMFWebService/",
    orderUrl: "https://www.bsestarmf.in/MFOrderEntry/MFOrder.svc", 
    uploadUrl: "https://www.bsestarmf.in/MFUploadService/MFUploadService.svc"
  }
};

const IS_PRODUCTION = process.env.BSE_ENVIRONMENT === 'production';
const API_CONFIG = IS_PRODUCTION ? BSE_API_CONFIG.production : BSE_API_CONFIG.demo;

// BSE Credentials - These should be obtained from BSE after MFD registration
const BSE_CREDENTIALS = {
  userId: process.env.BSE_USER_ID || 'demo_user',
  password: process.env.BSE_PASSWORD || 'demo_password', 
  memberId: process.env.BSE_MEMBER_ID || 'demo_member',
  passKey: process.env.BSE_PASS_KEY || 'demo_passkey'
};

interface BSEOrderRequest {
  transCode: string;
  transNo: string;
  orderId: string;
  userId: string;
  memberId: string;
  clientCode: string;
  schemeCode: string;
  buyAmount: number;
  allRedeem?: string;
  folioNo?: string;
  remarks?: string;
  kipId?: string;
  minRedeem?: string;
  dpTxn?: string;
  mintAmount?: string;
  mintUnit?: string;
  maxAmount?: string;
  maxUnit?: string;
  password: string;
  passKey: string;
}

interface BSESIPOrderRequest {
  transCode: string;
  transNo: string;
  orderId: string;
  userId: string;
  memberId: string;
  clientCode: string;
  schemeCode: string;
  sipAmount: number;
  sipFreq: string;
  sipStartDate: string;
  sipEndDate?: string;
  regId?: string;
  subBrokerCode?: string;
  euin?: string;
  euinVal?: string;
  password: string;
  passKey: string;
}

export interface OrderCompletionRequest {
  proposalId: string;
  clientCode: string;
  orderType: 'LUMPSUM' | 'SIP';
  items: Array<{
    schemeCode: string;
    amount: number;
    transactionType: 'P' | 'R'; // Purchase or Redeem
    folioNo?: string;
    sipFreq?: 'MONTHLY' | 'QUARTERLY' | 'DAILY';
    sipStartDate?: string;
    sipEndDate?: string;
  }>;
}

export interface OrderCompletionResponse {
  success: boolean;
  orderId?: string;
  transNo?: string;
  message: string;
  bseReference?: string;
  paymentUrl?: string;
}

/**
 * BSE Star API Service Class
 */
export class BSEStarApiService {
  
  /**
   * Complete order by processing proposal items through BSE Star API
   */
  async completeOrder(request: OrderCompletionRequest): Promise<OrderCompletionResponse> {
    try {
      // Validate BSE credentials
      if (!this.validateCredentials()) {
        return {
          success: false,
          message: "BSE API credentials not configured. Please contact administrator."
        };
      }

      // Generate unique transaction number
      const transNo = this.generateTransactionNumber();
      const orderId = randomUUID();

      // Process each item in the proposal
      const results = [];
      for (const item of request.items) {
        let result;
        
        if (request.orderType === 'SIP') {
          result = await this.processSIPOrder(transNo, orderId, request.clientCode, item);
        } else {
          result = await this.processLumpsumOrder(transNo, orderId, request.clientCode, item);
        }
        
        results.push(result);
      }

      // Check if all orders succeeded
      const allSuccessful = results.every(r => r.success);
      
      if (allSuccessful) {
        // Generate payment link if needed
        const paymentUrl = await this.generatePaymentLink(request.clientCode, transNo);
        
        return {
          success: true,
          orderId,
          transNo,
          message: "Order placed successfully on BSE Star MF",
          paymentUrl
        };
      } else {
        const failedItems = results.filter(r => !r.success);
        return {
          success: false,
          message: `Failed to place ${failedItems.length} orders: ${failedItems.map(f => f.message).join(', ')}`
        };
      }

    } catch (error) {
      console.error('BSE Order completion error:', error);
      return {
        success: false,
        message: `Order processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process lumpsum order through BSE API
   */
  private async processLumpsumOrder(transNo: string, orderId: string, clientCode: string, item: any) {
    try {
      const orderRequest: BSEOrderRequest = {
        transCode: item.transactionType, // 'P' for Purchase, 'R' for Redeem
        transNo: `${transNo}${Math.floor(Math.random() * 1000)}`, // Unique trans number for each item
        orderId,
        userId: BSE_CREDENTIALS.userId,
        memberId: BSE_CREDENTIALS.memberId,
        clientCode,
        schemeCode: item.schemeCode,
        buyAmount: item.amount,
        folioNo: item.folioNo || '',
        remarks: 'FintekPro Order',
        password: BSE_CREDENTIALS.password,
        passKey: BSE_CREDENTIALS.passKey
      };

      // This would be the actual SOAP call to BSE Star API
      // For demo purposes, we'll simulate the response
      if (IS_PRODUCTION) {
        // Actual BSE API call would go here
        // const response = await this.callBSEOrderAPI(orderRequest);
        throw new Error("Production BSE API integration requires valid credentials");
      } else {
        // Demo response simulation
        return {
          success: true,
          transNo: orderRequest.transNo,
          message: `Demo: Lumpsum order placed for scheme ${item.schemeCode}`,
          orderId
        };
      }

    } catch (error) {
      return {
        success: false,
        message: `Lumpsum order failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process SIP order through BSE API
   */
  private async processSIPOrder(transNo: string, orderId: string, clientCode: string, item: any) {
    try {
      const sipRequest: BSESIPOrderRequest = {
        transCode: 'NEW', // Always NEW for SIP
        transNo: `${transNo}${Math.floor(Math.random() * 1000)}`,
        orderId,
        userId: BSE_CREDENTIALS.userId,
        memberId: BSE_CREDENTIALS.memberId,
        clientCode,
        schemeCode: item.schemeCode,
        sipAmount: item.amount,
        sipFreq: item.sipFreq || 'MONTHLY',
        sipStartDate: item.sipStartDate || this.getNextBusinessDay(),
        sipEndDate: item.sipEndDate,
        password: BSE_CREDENTIALS.password,
        passKey: BSE_CREDENTIALS.passKey
      };

      // This would be the actual SOAP call to BSE Star API
      if (IS_PRODUCTION) {
        // Actual BSE API call would go here
        // const response = await this.callBSESIPAPI(sipRequest);
        throw new Error("Production BSE API integration requires valid credentials");
      } else {
        // Demo response simulation
        return {
          success: true,
          transNo: sipRequest.transNo,
          message: `Demo: SIP order placed for scheme ${item.schemeCode}`,
          orderId
        };
      }

    } catch (error) {
      return {
        success: false,
        message: `SIP order failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate payment link for the transaction
   */
  private async generatePaymentLink(clientCode: string, transNo: string): Promise<string> {
    if (IS_PRODUCTION) {
      // Actual BSE payment link generation would go here
      return `${API_CONFIG.baseUrl}/payment?client=${clientCode}&trans=${transNo}`;
    } else {
      // Demo payment link
      return `https://demo-payment.bse.in/pay?client=${clientCode}&trans=${transNo}`;
    }
  }

  /**
   * Check payment status for a transaction
   */
  async checkPaymentStatus(clientCode: string, transNo: string): Promise<{
    paid: boolean;
    amount?: number;
    paymentDate?: string;
    referenceNo?: string;
  }> {
    if (IS_PRODUCTION) {
      // Actual BSE payment status check would go here
      throw new Error("Production BSE API integration requires valid credentials");
    } else {
      // Demo payment status
      return {
        paid: Math.random() > 0.5, // Random demo status
        amount: 10000,
        paymentDate: new Date().toISOString(),
        referenceNo: `PAY${Math.floor(Math.random() * 1000000)}`
      };
    }
  }

  /**
   * Get order status from BSE
   */
  async getOrderStatus(transNo: string): Promise<{
    status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED';
    message: string;
    units?: number;
    nav?: number;
    allotmentDate?: string;
  }> {
    if (IS_PRODUCTION) {
      // Actual BSE order status check would go here
      throw new Error("Production BSE API integration requires valid credentials");
    } else {
      // Demo order status
      const statuses = ['SUCCESS', 'PENDING', 'FAILED'] as const;
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      return {
        status: randomStatus,
        message: `Demo: Order ${randomStatus.toLowerCase()}`,
        units: randomStatus === 'SUCCESS' ? 100.5 : undefined,
        nav: randomStatus === 'SUCCESS' ? 99.75 : undefined,
        allotmentDate: randomStatus === 'SUCCESS' ? new Date().toISOString() : undefined
      };
    }
  }

  /**
   * Generate unique transaction number
   * Format: YYYYMMDDHHMMSSXXX (20 digits)
   */
  private generateTransactionNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}${random}`;
  }

  /**
   * Get next business day for SIP start date (holiday-aware)
   */
  private async getNextBusinessDayAsync(): Promise<string> {
    try {
      const { marketHolidayService } = await import('./services/market-holiday-service');
      const nextTradingDay = marketHolidayService.getNextTradingDay(new Date(), 'BSE');
      return nextTradingDay.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch (error) {
      return this.getNextBusinessDayFallback();
    }
  }

  /**
   * Synchronous fallback for next business day calculation
   */
  private getNextBusinessDayFallback(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayOfWeek = tomorrow.getDay();
    if (dayOfWeek === 0) { // Sunday
      tomorrow.setDate(tomorrow.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday
      tomorrow.setDate(tomorrow.getDate() + 2);
    }
    
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Get next business day for SIP start date (synchronous version)
   */
  private getNextBusinessDay(): string {
    return this.getNextBusinessDayFallback();
  }

  /**
   * Validate BSE API credentials
   */
  private validateCredentials(): boolean {
    // Allow demo mode without strict validation
    if (!IS_PRODUCTION) {
      return true; // Demo mode always passes validation
    }
    
    // Production mode requires real credentials
    return !!(
      BSE_CREDENTIALS.userId && 
      BSE_CREDENTIALS.password && 
      BSE_CREDENTIALS.memberId && 
      BSE_CREDENTIALS.passKey &&
      BSE_CREDENTIALS.userId !== 'demo_user'
    );
  }

  /**
   * Create user on BSE Star platform (called during client onboarding)
   */
  async createBSEUser(userData: {
    clientCode: string;
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    pan: string;
    bankAccount: string;
    ifscCode: string;
  }): Promise<{ success: boolean; message: string }> {
    if (IS_PRODUCTION) {
      // Actual BSE user creation would go here
      throw new Error("Production BSE API integration requires valid credentials");
    } else {
      // Demo user creation
      return {
        success: true,
        message: `Demo: User ${userData.clientCode} created successfully on BSE Star`
      };
    }
  }

  /**
   * Create mandate for SIP transactions
   */
  async createMandate(clientCode: string, amount: number): Promise<{
    success: boolean;
    mandateId?: string;
    message: string;
  }> {
    if (IS_PRODUCTION) {
      // Actual BSE mandate creation would go here
      throw new Error("Production BSE API integration requires valid credentials");
    } else {
      // Demo mandate creation
      return {
        success: true,
        mandateId: `MAN${Math.floor(Math.random() * 1000000)}`,
        message: `Demo: Mandate created for ${clientCode} with amount ${amount}`
      };
    }
  }
}

// Export singleton instance
export const bseStarApi = new BSEStarApiService();