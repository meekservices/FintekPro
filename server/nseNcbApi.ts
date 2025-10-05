/**
 * NSE NCB (Non-Competitive Bidding) API Service
 * 
 * For Government Securities (G-Secs), Treasury Bills (T-Bills), and State Development Loans (SDLs)
 * via NSE goBID platform
 */

import { randomUUID } from "crypto";
import axios from "axios";
import { calculateYieldToMaturity, calculateBondPrice, calculateMacaulayDuration, calculateModifiedDuration } from "./bond-calculator";

// NSE NCB API Configuration
const NSE_NCB_CONFIG = {
  demo: {
    baseUrl: "https://demo.nseindia.com/api/ncb",
    goBidUrl: "https://demo.eipo.nseindia.com/api"
  },
  production: {
    baseUrl: "https://www.nseindia.com/api/ncb",
    goBidUrl: "https://eipo.nseindia.com/api"
  }
};

const IS_PRODUCTION = process.env.NSE_ENVIRONMENT === 'production';
const API_CONFIG = IS_PRODUCTION ? NSE_NCB_CONFIG.production : NSE_NCB_CONFIG.demo;

// NSE Credentials
const NSE_CREDENTIALS = {
  userId: process.env.NSE_USER_ID || 'demo_user',
  password: process.env.NSE_PASSWORD || 'demo_password',
  memberId: process.env.NSE_MEMBER_ID || 'demo_member'
};

export interface GSecurityAuction {
  isin: string;
  securityName: string;
  securityType: 'g_sec' | 't_bill' | 'sdl';
  issuer: string;
  auctionDate: string;
  auctionNumber: string;
  notifiedAmount: number;
  couponRate?: number;
  maturityDate: string;
  tenorYears: number;
  minimumBid: number;
  cutOffPrice?: number;
  cutOffYield?: number;
  status: 'upcoming' | 'ongoing' | 'completed';
}

export interface NCBOrderRequest {
  userId: string;
  clientCode: string;
  isin: string;
  auctionNumber: string;
  bidAmount: number;  // In multiples of ₹10,000
  panNumber: string;
  dematAccountNumber: string;
}

export interface NCBOrderResponse {
  success: boolean;
  orderId?: string;
  message: string;
  allotmentDetails?: {
    isin: string;
    allottedAmount: number;
    allottedPrice: number;
    allottedYield: number;
    settlementDate: string;
  };
}

/**
 * NSE NCB API Service Class
 */
export class NSENCBApiService {
  
  /**
   * Validate NSE credentials
   */
  private validateCredentials(): boolean {
    if (IS_PRODUCTION) {
      return !!(NSE_CREDENTIALS.userId && 
                NSE_CREDENTIALS.password && 
                NSE_CREDENTIALS.memberId &&
                NSE_CREDENTIALS.userId !== 'demo_user');
    }
    return true; // Demo mode always valid
  }

  /**
   * Get upcoming and ongoing G-Sec auctions
   */
  async getUpcomingAuctions(): Promise<GSecurityAuction[]> {
    try {
      if (!this.validateCredentials()) {
        console.log('NSE NCB: Using demo mode - returning sample auctions');
        return this.getDemoAuctions();
      }

      if (!IS_PRODUCTION) {
        return this.getDemoAuctions();
      }

      // Production API call
      const response = await axios.get(`${API_CONFIG.baseUrl}/auctions`, {
        headers: {
          'User-Agent': 'FintekPro/1.0',
          'Accept': 'application/json'
        }
      });

      return response.data.auctions || [];
    } catch (error) {
      console.error('Error fetching NSE NCB auctions:', error);
      // Fallback to demo data
      return this.getDemoAuctions();
    }
  }

  /**
   * Get demo auction data for testing
   */
  private getDemoAuctions(): GSecurityAuction[] {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const in10Years = new Date(today);
    in10Years.setFullYear(in10Years.getFullYear() + 10);
    
    const in5Years = new Date(today);
    in5Years.setFullYear(in5Years.getFullYear() + 5);
    
    const in364Days = new Date(today);
    in364Days.setDate(in364Days.getDate() + 364);

    return [
      {
        isin: 'INE000000001',
        securityName: '7.18% GS 2033',
        securityType: 'g_sec',
        issuer: 'Government of India',
        auctionDate: nextWeek.toISOString().split('T')[0],
        auctionNumber: 'GOI-2025-01',
        notifiedAmount: 25000000000, // ₹25,000 crore
        couponRate: 7.18,
        maturityDate: in10Years.toISOString().split('T')[0],
        tenorYears: 10,
        minimumBid: 10000,
        cutOffYield: 7.20,
        status: 'upcoming'
      },
      {
        isin: 'INE000000002',
        securityName: '6.95% GS 2061',
        securityType: 'g_sec',
        issuer: 'Government of India',
        auctionDate: nextWeek.toISOString().split('T')[0],
        auctionNumber: 'GOI-2025-02',
        notifiedAmount: 15000000000, // ₹15,000 crore
        couponRate: 6.95,
        maturityDate: '2061-02-05',
        tenorYears: 36,
        minimumBid: 10000,
        status: 'upcoming'
      },
      {
        isin: 'INE000000003',
        securityName: '364 Days T-Bill',
        securityType: 't_bill',
        issuer: 'Government of India',
        auctionDate: nextWeek.toISOString().split('T')[0],
        auctionNumber: 'TB-2025-03',
        notifiedAmount: 10000000000, // ₹10,000 crore
        maturityDate: in364Days.toISOString().split('T')[0],
        tenorYears: 1,
        minimumBid: 10000,
        cutOffYield: 6.85,
        status: 'upcoming'
      },
      {
        isin: 'INE000000004',
        securityName: 'Maharashtra SDL 2030',
        securityType: 'sdl',
        issuer: 'Government of Maharashtra',
        auctionDate: nextWeek.toISOString().split('T')[0],
        auctionNumber: 'MH-SDL-2025-01',
        notifiedAmount: 5000000000, // ₹5,000 crore
        couponRate: 7.35,
        maturityDate: in5Years.toISOString().split('T')[0],
        tenorYears: 5,
        minimumBid: 10000,
        status: 'upcoming'
      }
    ];
  }

  /**
   * Place NCB order for G-Sec/T-Bill/SDL
   */
  async placeNCBOrder(request: NCBOrderRequest): Promise<NCBOrderResponse> {
    try {
      // Validate bid amount (must be in multiples of ₹10,000)
      if (request.bidAmount < 10000 || request.bidAmount % 10000 !== 0) {
        return {
          success: false,
          message: 'Bid amount must be in multiples of ₹10,000 with minimum ₹10,000'
        };
      }

      // Validate maximum bid (₹2 crore for retail NCB)
      if (request.bidAmount > 20000000) {
        return {
          success: false,
          message: 'Maximum bid amount is ₹2 crore for retail NCB investors'
        };
      }

      if (!this.validateCredentials()) {
        return {
          success: false,
          message: 'NSE NCB credentials not configured'
        };
      }

      if (!IS_PRODUCTION) {
        // Demo mode - simulate successful order
        return this.simulateNCBOrder(request);
      }

      // Production API call
      const response = await axios.post(
        `${API_CONFIG.goBidUrl}/order`,
        {
          userId: NSE_CREDENTIALS.userId,
          memberId: NSE_CREDENTIALS.memberId,
          clientCode: request.clientCode,
          isin: request.isin,
          auctionNumber: request.auctionNumber,
          bidAmount: request.bidAmount,
          panNumber: request.panNumber,
          dematAccountNumber: request.dematAccountNumber,
          password: NSE_CREDENTIALS.password
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FintekPro/1.0'
          }
        }
      );

      return {
        success: true,
        orderId: response.data.orderId,
        message: 'NCB order placed successfully',
        allotmentDetails: response.data.allotment
      };
    } catch (error: any) {
      console.error('Error placing NSE NCB order:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to place NCB order'
      };
    }
  }

  /**
   * Simulate NCB order in demo mode
   */
  private simulateNCBOrder(request: NCBOrderRequest): NCBOrderResponse {
    const orderId = `NCB-${randomUUID().substring(0, 8).toUpperCase()}`;
    
    // Simulate allotment at weighted average price
    const simulatedPrice = 98.50; // ₹98.50 per ₹100 face value
    const simulatedYield = 7.20;  // 7.20% yield
    
    const settlementDate = new Date();
    settlementDate.setDate(settlementDate.getDate() + 2); // T+2 settlement

    return {
      success: true,
      orderId: orderId,
      message: 'NCB order placed successfully in demo mode',
      allotmentDetails: {
        isin: request.isin,
        allottedAmount: request.bidAmount,
        allottedPrice: simulatedPrice,
        allottedYield: simulatedYield,
        settlementDate: settlementDate.toISOString().split('T')[0]
      }
    };
  }

  /**
   * Get NCB order status
   */
  async getOrderStatus(orderId: string): Promise<any> {
    try {
      if (!IS_PRODUCTION) {
        return {
          orderId: orderId,
          status: 'allotted',
          message: 'Order allotted successfully (Demo mode)'
        };
      }

      const response = await axios.get(
        `${API_CONFIG.goBidUrl}/order/${orderId}`,
        {
          headers: {
            'User-Agent': 'FintekPro/1.0',
            'Accept': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching order status:', error);
      throw error;
    }
  }

  /**
   * Get G-Sec details by ISIN
   */
  async getGSecDetails(isin: string): Promise<any> {
    try {
      if (!IS_PRODUCTION) {
        const demoAuctions = this.getDemoAuctions();
        const gsec = demoAuctions.find(a => a.isin === isin);
        
        if (gsec) {
          // Calculate bond pricing metrics
          const currentPrice = calculateBondPrice({
            faceValue: 100,
            couponRate: gsec.couponRate || 0,
            yieldToMaturity: gsec.cutOffYield || 7.0,
            yearsToMaturity: gsec.tenorYears,
            frequency: 'semi_annual'
          });

          return {
            ...gsec,
            currentPrice: currentPrice,
            faceValue: 100,
            frequency: 'semi_annual'
          };
        }
        
        return null;
      }

      const response = await axios.get(
        `${API_CONFIG.baseUrl}/security/${isin}`,
        {
          headers: {
            'User-Agent': 'FintekPro/1.0',
            'Accept': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching G-Sec details:', error);
      return null;
    }
  }
}

// Export singleton instance
export const nseNcbApi = new NSENCBApiService();
