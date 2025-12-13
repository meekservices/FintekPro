import { DatabaseStorage } from '../storage';
import type { SellListing, BuyRequest, User } from '@shared/schema';
import { nanoid } from 'nanoid';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { complianceService } from './compliance-service';
import { pmlaAuditService } from './pmla-audit-service';
import { auditLogArchivalService } from './audit-log-archival';

export interface MatchResult {
  matched: boolean;
  dealId?: string;
  reason?: string;
  sellListing: SellListing;
  buyRequest: BuyRequest;
  matchScore?: number;
}

export interface DealMatchParams {
  sellListingId: string;
  buyRequestId: string;
  quantity: number;
  agreedPrice: string;
}

export class DealMatcherService {
  private storage: DatabaseStorage;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  /**
   * Find compatible buy requests for a sell listing
   */
  async findMatchesForSellListing(sellListingId: string): Promise<MatchResult[]> {
    const listing = await this.storage.getSellListingById(sellListingId);
    if (!listing) {
      throw new Error('Sell listing not found');
    }

    // Get all active buy requests for the same company
    const buyRequests = await this.storage.getBuyRequestsByCompany(listing.companyId);
    
    const matches: MatchResult[] = [];

    for (const buyRequest of buyRequests) {
      const result = await this.evaluateMatch(listing, buyRequest);
      if (result.matched || result.matchScore && result.matchScore > 0) {
        matches.push(result);
      }
    }

    // Sort by match score (highest first)
    return matches.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }

  /**
   * Find compatible sell listings for a buy request
   */
  async findMatchesForBuyRequest(buyRequestId: string): Promise<MatchResult[]> {
    const buyRequest = await this.storage.getBuyRequestById(buyRequestId);
    if (!buyRequest) {
      throw new Error('Buy request not found');
    }

    // Get all active sell listings for the same company
    const sellListings = await this.storage.getSellListingsByCompany(buyRequest.companyId);
    
    const matches: MatchResult[] = [];

    for (const listing of sellListings) {
      const result = await this.evaluateMatch(listing, buyRequest);
      if (result.matched || result.matchScore && result.matchScore > 0) {
        matches.push(result);
      }
    }

    // Sort by match score (highest first)
    return matches.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }

  /**
   * Evaluate if a sell listing and buy request are compatible
   */
  async evaluateMatch(listing: SellListing, buyRequest: BuyRequest): Promise<MatchResult> {
    const reasons: string[] = [];
    let matchScore = 0;

    // Check if both are active
    if (listing.status !== 'active') {
      return {
        matched: false,
        reason: 'Sell listing is not active',
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    if (buyRequest.status !== 'active') {
      return {
        matched: false,
        reason: 'Buy request is not active',
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    // Check validity dates
    const now = new Date();
    if (listing.validUntil && new Date(listing.validUntil) < now) {
      return {
        matched: false,
        reason: 'Sell listing has expired',
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    if (buyRequest.validUntil && new Date(buyRequest.validUntil) < now) {
      return {
        matched: false,
        reason: 'Buy request has expired',
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    // Check KYC verification (both must be verified)
    if (!listing.kycVerified || !buyRequest.kycVerified) {
      return {
        matched: false,
        reason: 'KYC verification required for both parties',
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    // Verify users have Enhanced or Accredited Investor KYC tier
    const [seller, buyer] = await Promise.all([
      this.storage.getUser(listing.sellerUserId),
      this.storage.getUser(buyRequest.buyerUserId),
    ]);

    if (!this.isKycEligible(seller) || !this.isKycEligible(buyer)) {
      return {
        matched: false,
        reason: 'Both parties must have Enhanced or Accredited Investor KYC tier',
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    // Check same company
    if (listing.companyId !== buyRequest.companyId) {
      return {
        matched: false,
        reason: 'Different companies',
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    // Check same user (can't buy from yourself)
    if (listing.sellerUserId === buyRequest.buyerUserId) {
      return {
        matched: false,
        reason: 'Cannot trade with yourself',
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    // Price compatibility check
    const buyMaxPrice = Number(buyRequest.maxPrice);
    const sellLandingPrice = Number(listing.landingPrice);
    const sellAskPrice = Number(listing.askPrice);
    const sellFloorPrice = Number(listing.floorPrice);

    if (buyMaxPrice < sellFloorPrice) {
      return {
        matched: false,
        reason: `Buy max price (₹${buyMaxPrice}) is below sell floor price (₹${sellFloorPrice})`,
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    // Calculate match score based on price alignment
    if (buyMaxPrice >= sellLandingPrice) {
      // Perfect match - buyer willing to pay at or above landing price
      matchScore += 50;
      reasons.push('Price range compatible');
      
      if (buyMaxPrice >= sellAskPrice) {
        // Buyer willing to pay ask price - best match
        matchScore += 30;
        reasons.push('Buyer willing to pay ask price');
      } else {
        // Negotiation zone between landing and ask
        const priceProximity = (buyMaxPrice - sellLandingPrice) / (sellAskPrice - sellLandingPrice);
        matchScore += Math.floor(priceProximity * 20);
      }
    } else if (buyMaxPrice >= sellFloorPrice) {
      // Partial match - buyer price in negotiation zone
      matchScore += 20;
      reasons.push('Buyer price in negotiation zone');
      
      const priceProximity = (buyMaxPrice - sellFloorPrice) / (sellLandingPrice - sellFloorPrice);
      matchScore += Math.floor(priceProximity * 15);
    }

    // Quantity compatibility
    const minQuantity = Math.max(listing.minimumLotSize || 1, buyRequest.preferredLotSize || 1);
    const maxQuantity = Math.min(listing.quantity, buyRequest.quantity);

    if (maxQuantity < minQuantity) {
      return {
        matched: false,
        reason: 'Quantity requirements incompatible',
        sellListing: listing,
        buyRequest,
        matchScore: 0,
      };
    }

    matchScore += 10; // Base points for quantity compatibility
    reasons.push('Quantity compatible');

    // Bonus points for exact quantity match
    if (listing.quantity === buyRequest.quantity) {
      matchScore += 10;
      reasons.push('Exact quantity match');
    }

    // Consider target price preference (if buyer has one)
    if (buyRequest.targetPrice) {
      const buyTargetPrice = Number(buyRequest.targetPrice);
      if (buyTargetPrice >= sellLandingPrice) {
        matchScore += 5;
        reasons.push('Target price aligns well');
      }
    }

    // Match threshold: score >= 60 for automatic match
    const matched = matchScore >= 60;

    return {
      matched,
      reason: matched ? reasons.join('; ') : 'Match score too low for automatic execution',
      sellListing: listing,
      buyRequest,
      matchScore,
    };
  }

  /**
   * Create a deal from a match
   * All operations are wrapped in a transaction for atomicity
   * Compliance checks prevent deal creation if high-risk flags detected
   */
  async createDealFromMatch(match: MatchResult, agreedPrice?: number): Promise<string> {
    if (!match.matched) {
      throw new Error('Cannot create deal from unmatched pair');
    }

    const { sellListing, buyRequest } = match;

    // Check compliance flags - block if high-risk
    const hasBlockingFlags = await complianceService.hasBlockingFlags(sellListing.companyId);
    if (hasBlockingFlags) {
      throw new Error('Deal creation blocked: Company has high-risk compliance flags. Contact admin for review.');
    }

    // Determine agreed price
    const finalPrice = agreedPrice || Number(sellListing.landingPrice);

    // Determine quantity (use minimum of available quantities)
    const quantity = Math.min(sellListing.quantity, buyRequest.quantity);

    // Calculate total value and fees
    const totalValue = (finalPrice * quantity).toFixed(2);
    const platformFee = (finalPrice * quantity * 0.01).toFixed(2);

    // Execute all DB operations in a transaction for atomicity
    return await this.storage.withTransaction(async (tx) => {
      // Create the deal with auto-generated UUID as ID (serves as ticket reference)
      const [deal] = await tx.insert(schema.unlistedDeals)
        .values({
          sellListingId: sellListing.id,
          buyRequestId: buyRequest.id,
          companyId: sellListing.companyId,
          sellerUserId: sellListing.sellerUserId,
          buyerUserId: buyRequest.buyerUserId,
          quantity,
          agreedPrice: finalPrice.toString(),
          totalValue,
          platformFee,
          status: 'pending_payment',
        })
        .returning();

      if (!deal) {
        throw new Error('Failed to create deal');
      }

      // Update listing quantity and status
      const newListingQuantity = sellListing.quantity - quantity;
      await tx.update(schema.sellListings)
        .set({
          quantity: newListingQuantity,
          status: newListingQuantity === 0 ? 'filled' : 'active',
          updatedAt: new Date(),
        })
        .where(eq(schema.sellListings.id, sellListing.id));

      // Update request quantity and status
      const newRequestQuantity = buyRequest.quantity - quantity;
      await tx.update(schema.buyRequests)
        .set({
          quantity: newRequestQuantity,
          status: newRequestQuantity === 0 ? 'filled' : 'active',
          updatedAt: new Date(),
        })
        .where(eq(schema.buyRequests.id, buyRequest.id));

      // Record price in history
      await tx.insert(schema.unlistedPriceHistory)
        .values({
          companyId: sellListing.companyId,
          date: new Date(),
          price: finalPrice.toString(),
          volume: quantity,
          sourceType: 'DEAL',
          sourceDealId: deal.id,
        });

      // PMLA Transaction Monitoring for AML compliance
      // Monitor both buyer and seller transactions
      const totalValueNum = parseFloat(totalValue);
      
      // Monitor buyer's transaction
      const buyerPmlaResult = await pmlaAuditService.monitorTransaction({
        userId: buyRequest.buyerUserId,
        transactionId: deal.id,
        amount: totalValueNum,
        currency: 'INR',
        transactionType: 'unlisted_share_purchase',
        sourceCountry: 'IN',
        destinationCountry: 'IN',
        metadata: {
          dealId: deal.id,
          companyId: sellListing.companyId,
          quantity,
          pricePerShare: finalPrice,
          tradeType: 'buy',
          sellListingId: sellListing.id,
          buyRequestId: buyRequest.id,
        },
      });
      
      // Monitor seller's transaction
      const sellerPmlaResult = await pmlaAuditService.monitorTransaction({
        userId: sellListing.sellerUserId,
        transactionId: deal.id,
        amount: totalValueNum,
        currency: 'INR',
        transactionType: 'unlisted_share_sale',
        sourceCountry: 'IN',
        destinationCountry: 'IN',
        metadata: {
          dealId: deal.id,
          companyId: sellListing.companyId,
          quantity,
          pricePerShare: finalPrice,
          tradeType: 'sell',
          sellListingId: sellListing.id,
          buyRequestId: buyRequest.id,
        },
      });
      
      // If either party's transaction is blocked, throw error
      if (!buyerPmlaResult.allowed) {
        console.error(`[PMLA] Buyer transaction blocked for deal ${deal.id}: ${buyerPmlaResult.flags.join(', ')}`);
        throw new Error(`Transaction blocked by AML compliance: Buyer failed PMLA checks. Risk score: ${buyerPmlaResult.riskScore}`);
      }
      
      if (!sellerPmlaResult.allowed) {
        console.error(`[PMLA] Seller transaction blocked for deal ${deal.id}: ${sellerPmlaResult.flags.join(', ')}`);
        throw new Error(`Transaction blocked by AML compliance: Seller failed PMLA checks. Risk score: ${sellerPmlaResult.riskScore}`);
      }
      
      // Log if transaction requires FIU reporting
      if (buyerPmlaResult.requiresFIUReport || sellerPmlaResult.requiresFIUReport) {
        console.log(`[PMLA] Deal ${deal.id} flagged for FIU reporting. Buyer report: ${buyerPmlaResult.reportType || 'none'}, Seller report: ${sellerPmlaResult.reportType || 'none'}`);
      }

      // Archive deal creation event to immutable audit log
      await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
        eventType: 'deal_created',
        userId: buyRequest.buyerUserId,
        dealId: deal.id,
        companyId: sellListing.companyId,
        action: 'Deal created from match',
        details: {
          sellListingId: sellListing.id,
          buyRequestId: buyRequest.id,
          sellerUserId: sellListing.sellerUserId,
          buyerUserId: buyRequest.buyerUserId,
          quantity,
          agreedPrice: finalPrice,
          totalValue: totalValueNum,
          platformFee,
          matchScore: match.matchScore,
          buyerPmlaRiskScore: buyerPmlaResult.riskScore,
          sellerPmlaRiskScore: sellerPmlaResult.riskScore,
        },
        riskLevel: Math.max(buyerPmlaResult.riskScore, sellerPmlaResult.riskScore) >= 60 ? 'high' : 'low',
      });

      // Return deal ID
      return deal.id;
    });
  }

  /**
   * Auto-match new sell listing with compatible buy requests
   */
  async autoMatchSellListing(sellListingId: string): Promise<string[]> {
    const matches = await this.findMatchesForSellListing(sellListingId);
    const dealIds: string[] = [];

    for (const match of matches) {
      if (match.matched && match.matchScore && match.matchScore >= 80) {
        // Only auto-execute very high confidence matches
        try {
          const dealId = await this.createDealFromMatch(match);
          dealIds.push(dealId);
          
          // Check if listing is fully filled
          const updatedListing = await this.storage.getSellListingById(sellListingId);
          if (!updatedListing || updatedListing.quantity === 0) {
            break; // Listing fully matched
          }
        } catch (error) {
          console.error(`Error creating deal from match:`, error);
        }
      }
    }

    return dealIds;
  }

  /**
   * Auto-match new buy request with compatible sell listings
   */
  async autoMatchBuyRequest(buyRequestId: string): Promise<string[]> {
    const matches = await this.findMatchesForBuyRequest(buyRequestId);
    const dealIds: string[] = [];

    for (const match of matches) {
      if (match.matched && match.matchScore && match.matchScore >= 80) {
        // Only auto-execute very high confidence matches
        try {
          const dealId = await this.createDealFromMatch(match);
          dealIds.push(dealId);
          
          // Check if request is fully filled
          const updatedRequest = await this.storage.getBuyRequestById(buyRequestId);
          if (!updatedRequest || updatedRequest.quantity === 0) {
            break; // Request fully matched
          }
        } catch (error) {
          console.error(`Error creating deal from match:`, error);
        }
      }
    }

    return dealIds;
  }

  /**
   * Check if user has eligible KYC tier for unlisted trading
   */
  private isKycEligible(user: User | undefined): boolean {
    if (!user) return false;
    const kycTier = (user as any).kycTier || 'basic';
    return kycTier === 'enhanced' || kycTier === 'accredited_investor';
  }

  /**
   * Clean up expired listings and requests
   */
  async cleanupExpiredOrders(): Promise<{ expiredListings: number; expiredRequests: number }> {
    const now = new Date();
    let expiredListings = 0;
    let expiredRequests = 0;

    // Get all active listings and requests
    const allCompanies = await this.storage.getAllUnlistedCompanies({});
    
    for (const company of allCompanies) {
      // Process sell listings
      const listings = await this.storage.getSellListingsByCompany(company.id);
      for (const listing of listings) {
        if (listing.status === 'active' && listing.validUntil && new Date(listing.validUntil) < now) {
          await this.storage.updateSellListing(listing.id, { status: 'expired' });
          expiredListings++;
        }
      }

      // Process buy requests
      const requests = await this.storage.getBuyRequestsByCompany(company.id);
      for (const request of requests) {
        if (request.status === 'active' && request.validUntil && new Date(request.validUntil) < now) {
          await this.storage.updateBuyRequest(request.id, { status: 'expired' });
          expiredRequests++;
        }
      }
    }

    return { expiredListings, expiredRequests };
  }
}
