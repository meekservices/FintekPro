import axios from "axios";
import type { InsertAmfiVerificationLog } from "@shared/schema";

export interface AmfiDistributorDetails {
  arnCode: string;
  distributorName: string;
  distributorStatus: "active" | "inactive" | "suspended" | "expired";
  registrationDate: Date;
  arnExpiryDate: Date | null;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface AmfiValidationResult {
  isValid: boolean;
  status: "success" | "failed" | "error";
  errorMessage?: string;
  distributorDetails?: AmfiDistributorDetails;
}

export interface EuinValidationResult {
  isValid: boolean;
  status: "success" | "failed" | "error";
  errorMessage?: string;
  euinDetails?: {
    euinNumber: string;
    employeeName: string;
    arnCode: string;
    distributorName: string;
    isActive: boolean;
  };
}

class AmfiValidationService {
  private amfiApiUrl = "https://www.amfiindia.com"; // AMFI official website
  
  /**
   * Validate ARN (AMFI Registration Number) against AMFI registry
   * 
   * Note: AMFI doesn't provide an official REST API. In production, you would:
   * 1. Use web scraping with proper rate limiting
   * 2. Integrate with third-party KYC services that have AMFI data
   * 3. Maintain a local synced database of ARN holders
   * 
   * For now, this is a simulated validation that demonstrates the flow.
   */
  async validateArn(arnCode: string): Promise<AmfiValidationResult> {
    try {
      // Input validation
      if (!arnCode || arnCode.trim().length === 0) {
        return {
          isValid: false,
          status: "failed",
          errorMessage: "ARN code cannot be empty",
        };
      }

      // ARN format validation (ARN-XXXXX format, 5-6 digits)
      const arnPattern = /^ARN-\d{5,6}$/i;
      if (!arnPattern.test(arnCode.toUpperCase())) {
        return {
          isValid: false,
          status: "failed",
          errorMessage: "Invalid ARN format. Expected format: ARN-XXXXX",
        };
      }

      // In production, this would call AMFI API or check against synced database
      // For now, simulate validation with predefined test ARNs
      const testValidArns = [
        "ARN-12345",
        "ARN-67890",
        "ARN-54321",
        "ARN-98765",
      ];

      const normalizedArn = arnCode.toUpperCase();
      const isValid = testValidArns.includes(normalizedArn);

      if (isValid) {
        // Simulate distributor details
        const distributorDetails: AmfiDistributorDetails = {
          arnCode: normalizedArn,
          distributorName: `Demo Distributor ${normalizedArn}`,
          distributorStatus: "active",
          registrationDate: new Date("2020-01-01"),
          arnExpiryDate: new Date("2026-12-31"),
          email: `contact@${normalizedArn.toLowerCase()}.com`,
          phone: "+91-9876543210",
          address: "123 Financial District",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
        };

        return {
          isValid: true,
          status: "success",
          distributorDetails,
        };
      } else {
        return {
          isValid: false,
          status: "failed",
          errorMessage: "ARN not found in AMFI registry or has been deactivated",
        };
      }
    } catch (error) {
      console.error("AMFI ARN validation error:", error);
      return {
        isValid: false,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred during ARN validation",
      };
    }
  }

  /**
   * Validate EUIN (Employee Unique Identification Number)
   * 
   * EUIN is issued to employees/relationship managers of AMFI-registered distributors.
   * Each EUIN is linked to a parent ARN.
   */
  async validateEuin(euinNumber: string, arnCode?: string): Promise<EuinValidationResult> {
    try {
      // Input validation
      if (!euinNumber || euinNumber.trim().length === 0) {
        return {
          isValid: false,
          status: "failed",
          errorMessage: "EUIN number cannot be empty",
        };
      }

      // EUIN format validation (typically E followed by 6 digits)
      const euinPattern = /^E\d{6}$/i;
      if (!euinPattern.test(euinNumber.toUpperCase())) {
        return {
          isValid: false,
          status: "failed",
          errorMessage: "Invalid EUIN format. Expected format: EXXXXXX (E followed by 6 digits)",
        };
      }

      // Simulate EUIN validation
      const testValidEuins = [
        { euin: "E123456", arn: "ARN-12345", name: "John Doe" },
        { euin: "E789012", arn: "ARN-67890", name: "Jane Smith" },
        { euin: "E345678", arn: "ARN-54321", name: "Robert Kumar" },
        { euin: "E901234", arn: "ARN-98765", name: "Priya Sharma" },
      ];

      const normalizedEuin = euinNumber.toUpperCase();
      const euinRecord = testValidEuins.find(e => e.euin === normalizedEuin);

      if (euinRecord) {
        // If ARN is provided, verify it matches
        if (arnCode && arnCode.toUpperCase() !== euinRecord.arn) {
          return {
            isValid: false,
            status: "failed",
            errorMessage: `EUIN ${normalizedEuin} is not associated with ARN ${arnCode}. It belongs to ${euinRecord.arn}`,
          };
        }

        return {
          isValid: true,
          status: "success",
          euinDetails: {
            euinNumber: normalizedEuin,
            employeeName: euinRecord.name,
            arnCode: euinRecord.arn,
            distributorName: `Demo Distributor ${euinRecord.arn}`,
            isActive: true,
          },
        };
      } else {
        return {
          isValid: false,
          status: "failed",
          errorMessage: "EUIN not found in AMFI registry or has been deactivated",
        };
      }
    } catch (error) {
      console.error("AMFI EUIN validation error:", error);
      return {
        isValid: false,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred during EUIN validation",
      };
    }
  }

  /**
   * Get detailed distributor information by ARN
   */
  async getDistributorDetails(arnCode: string): Promise<AmfiDistributorDetails | null> {
    const validationResult = await this.validateArn(arnCode);
    
    if (validationResult.isValid && validationResult.distributorDetails) {
      return validationResult.distributorDetails;
    }
    
    return null;
  }

  /**
   * Check if ARN is expired
   */
  async isArnExpired(arnCode: string): Promise<boolean> {
    const details = await this.getDistributorDetails(arnCode);
    
    if (!details || !details.arnExpiryDate) {
      return true; // Consider as expired if we can't verify
    }
    
    return new Date() > details.arnExpiryDate;
  }

  /**
   * Verify both ARN and EUIN together (validates the relationship)
   */
  async validateArnAndEuin(arnCode: string, euinNumber: string): Promise<{
    arnValid: boolean;
    euinValid: boolean;
    relationshipValid: boolean;
    errorMessage?: string;
  }> {
    try {
      // Validate ARN first
      const arnResult = await this.validateArn(arnCode);
      if (!arnResult.isValid) {
        return {
          arnValid: false,
          euinValid: false,
          relationshipValid: false,
          errorMessage: arnResult.errorMessage,
        };
      }

      // Validate EUIN with ARN
      const euinResult = await this.validateEuin(euinNumber, arnCode);
      if (!euinResult.isValid) {
        return {
          arnValid: true,
          euinValid: false,
          relationshipValid: false,
          errorMessage: euinResult.errorMessage,
        };
      }

      return {
        arnValid: true,
        euinValid: true,
        relationshipValid: true,
      };
    } catch (error) {
      return {
        arnValid: false,
        euinValid: false,
        relationshipValid: false,
        errorMessage: error instanceof Error ? error.message : "Validation failed",
      };
    }
  }

  /**
   * Create verification log entry
   */
  createVerificationLog(
    agentId: string | null,
    verificationType: "arn_verification" | "euin_verification" | "distributor_details",
    arnCode?: string,
    euinNumber?: string,
    result?: AmfiValidationResult | EuinValidationResult,
    verifiedBy?: string,
    ipAddress?: string,
    userAgent?: string
  ): InsertAmfiVerificationLog {
    const log: InsertAmfiVerificationLog = {
      agentId,
      verificationType,
      arnCode,
      euinNumber,
      apiRequest: {
        arn: arnCode,
        euin: euinNumber,
        timestamp: new Date().toISOString(),
      },
      apiResponse: result,
      verificationStatus: result?.status || "failed",
      errorMessage: result?.errorMessage,
      distributorName: result && "distributorDetails" in result ? result.distributorDetails?.distributorName : undefined,
      distributorStatus: result && "distributorDetails" in result ? result.distributorDetails?.distributorStatus : undefined,
      arnExpiryDate: result && "distributorDetails" in result ? result.distributorDetails?.arnExpiryDate : undefined,
      registrationDate: result && "distributorDetails" in result ? result.distributorDetails?.registrationDate : undefined,
      verifiedBy,
      ipAddress,
      userAgent,
    };

    return log;
  }
}

export const amfiValidationService = new AmfiValidationService();
