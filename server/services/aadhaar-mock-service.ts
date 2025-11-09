/**
 * Aadhaar OTP Mock Service
 * 
 * Mock implementation of Aadhaar OTP verification for demo purposes.
 * In production, this should be replaced with actual UIDAI API integration.
 * 
 * Features:
 * - Send OTP to masked Aadhaar number
 * - Verify OTP 
 * - Return mock user data after verification
 */

import { AadhaarOTPResponse, AadhaarVerificationResponse } from './kyc/aadhaar-types';

export class AadhaarMockService {
  private static otpStore = new Map<string, { otp: string; aadhaarNumber: string; expiresAt: number }>();
  
  /**
   * Send OTP to Aadhaar number (Mock)
   */
  static async sendOTP(aadhaarNumber: string): Promise<AadhaarOTPResponse> {
    // Validate Aadhaar number format (12 digits)
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      return {
        success: false,
        message: "Invalid Aadhaar number format. Must be 12 digits.",
        transactionId: "",
        maskedAadhaar: ""
      };
    }

    // Generate random OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Generate transaction ID
    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Store OTP for verification (expires in 10 minutes)
    this.otpStore.set(transactionId, {
      otp,
      aadhaarNumber,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    // Mask Aadhaar number (show only last 4 digits)
    const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;

    // In production, send actual OTP via SMS/Email
    console.log(`[AADHAAR MOCK] OTP for ${maskedAadhaar}: ${otp}`);

    return {
      success: true,
      message: `OTP sent successfully to registered mobile number ending with ${aadhaarNumber.slice(-4)}`,
      transactionId,
      maskedAadhaar
    };
  }

  /**
   * Verify OTP (Mock)
   */
  static async verifyOTP(transactionId: string, otp: string): Promise<AadhaarVerificationResponse> {
    const otpData = this.otpStore.get(transactionId);

    if (!otpData) {
      return {
        success: false,
        message: "Invalid or expired transaction ID",
        verified: false
      };
    }

    // Check if OTP expired
    if (Date.now() > otpData.expiresAt) {
      this.otpStore.delete(transactionId);
      return {
        success: false,
        message: "OTP has expired. Please request a new OTP.",
        verified: false
      };
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      return {
        success: false,
        message: "Invalid OTP. Please try again.",
        verified: false
      };
    }

    // OTP verified successfully - cleanup and return mock data
    this.otpStore.delete(transactionId);

    // Return mock Aadhaar data (in production, this comes from UIDAI API)
    const mockData = this.generateMockAadhaarData(otpData.aadhaarNumber);

    return {
      success: true,
      message: "Aadhaar verified successfully",
      verified: true,
      data: mockData
    };
  }

  /**
   * Generate mock Aadhaar data for demo
   */
  private static generateMockAadhaarData(aadhaarNumber: string) {
    // Different mock data based on Aadhaar number pattern
    const patterns: Record<string, any> = {
      '123456789012': {
        name: "RAJESH KUMAR SHARMA",
        dob: "1990-05-15",
        gender: "Male",
        address: {
          house: "B-123",
          street: "MG Road",
          landmark: "Near City Hospital",
          locality: "Sector 15",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
          country: "India"
        }
      },
      '234567890123': {
        name: "PRIYA SINGH",
        dob: "1985-08-22",
        gender: "Female",
        address: {
          house: "Flat 45, Tower A",
          street: "Palm Avenue",
          landmark: "Opposite Metro Station",
          locality: "Bandra West",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400050",
          country: "India"
        }
      }
    };

    // Return matched pattern or default
    return patterns[aadhaarNumber] || {
      name: "DEMO USER",
      dob: "1992-01-01",
      gender: "Male",
      address: {
        house: "123 Demo House",
        street: "Demo Street",
        landmark: "Near Demo Landmark",
        locality: "Demo Locality",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        country: "India"
      }
    };
  }

  /**
   * Cleanup expired OTPs (call periodically)
   */
  static cleanupExpiredOTPs() {
    const now = Date.now();
    for (const [txnId, data] of this.otpStore.entries()) {
      if (now > data.expiresAt) {
        this.otpStore.delete(txnId);
      }
    }
  }
}

// Cleanup expired OTPs every 5 minutes
setInterval(() => {
  AadhaarMockService.cleanupExpiredOTPs();
}, 5 * 60 * 1000);
