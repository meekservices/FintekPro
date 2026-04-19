import type { KycVerificationSession } from "@shared/schema";
import { db } from "../db";
import * as schema from "@shared/schema";
import { portfolios, prospectClients } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Transfer verified KYC data from verification session to user profile
 * Called when Smart KYC wizard is completed (after Aadhaar verification)
 */
export async function transferVerifiedKYCData(
  userId: string,
  session: KycVerificationSession,
  aadhaarVerificationData: any
): Promise<void> {
  const panData = session.panVerificationData as any;
  const currentUser = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  
  if (!currentUser) {
    throw new Error("User not found");
  }

  // Prepare update data for users table
  const userUpdateData: any = {
    panVerifiedViaSmartKyc: true,
    panVerificationDate: session.panVerifiedAt,
    aadhaarVerifiedViaSmartKyc: true,
    aadhaarVerificationDate: new Date(),
    smartKycCompletedAt: new Date(),
  };

  // Transfer verified PAN if not already present
  if (session.panNumber && !currentUser.panNumber) {
    userUpdateData.panNumber = session.panNumber; // Already encrypted in session
  }

  // Transfer name from PAN verification if user doesn't have name
  if (panData?.name && !currentUser.firstName) {
    // Split the full name from PAN (format: "FIRSTNAME MIDDLENAME LASTNAME")
    const nameParts = panData.name.trim().split(/\s+/);
    if (nameParts.length > 0) {
      userUpdateData.firstName = nameParts[0];
      if (nameParts.length > 2) {
        userUpdateData.middleName = nameParts.slice(1, -1).join(' ');
        userUpdateData.lastName = nameParts[nameParts.length - 1];
      } else if (nameParts.length === 2) {
        userUpdateData.lastName = nameParts[1];
      }
    }
  }

  // Transfer date of birth from PAN if available
  if (session.panDob && !currentUser.dateOfBirth) {
    const dobDate = typeof session.panDob === 'string' ? new Date(session.panDob) : session.panDob;
    userUpdateData.dateOfBirth = dobDate.toISOString().split('T')[0];
  }

  // Update the user with verified data
  await db.update(schema.users)
    .set(userUpdateData)
    .where(eq(schema.users.id, userId));

  // Also update userProfiles table with PAN and tier (product access reads from here)
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  if (userProfile) {
    const profileUpdateData: any = {};
    
    // Transfer PAN to profile if not present
    if (session.panNumber && !userProfile.panNumber) {
      profileUpdateData.panNumber = session.panNumber;
    }
    
    // Update tier to basic if not set (initial KYC completion)
    if (!(userProfile as any).kycTier || (userProfile as any).kycTier === "basic") {
      profileUpdateData.kycTier = "basic";
      profileUpdateData.kycTierUpgradedAt = new Date();
    }

    if (Object.keys(profileUpdateData).length > 0) {
      await db.update(schema.userProfiles)
        .set(profileUpdateData)
        .where(eq(schema.userProfiles.userId, userId));
    }
  }

  // Mark the KYC session as completed
  await db.update(schema.kycVerificationSessions)
    .set({
      completedAt: new Date(),
      currentStep: "completed",
    })
    .where(eq(schema.kycVerificationSessions.id, session.id));
  
  // Trigger portfolio auto-fetch and verification
  // This transfers any existing prospect portfolio to the user's verified portfolio
  try {
    await transferProspectPortfolioToUser(userId);
  } catch (error) {
    console.error('[KYC Completion] Failed to transfer prospect portfolio:', error);
    // Don't fail KYC completion if portfolio transfer fails
  }
}

/**
 * Transfer prospect portfolio data to user portfolio when KYC is completed
 * Marks the portfolio as verified since it's now associated with a verified user
 * Also marks any existing user portfolio as verified
 */
async function transferProspectPortfolioToUser(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  
  if (!user) return;
  
  // First, check if user already has a portfolio and mark it as verified
  const existingUserPortfolio = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .limit(1);
  
  if (existingUserPortfolio.length > 0) {
    // Mark existing portfolio as verified after KYC
    await db
      .update(portfolios)
      .set({
        isVerified: true,
        lastFetchedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(portfolios.id, existingUserPortfolio[0].id));
    
    console.log('[KYC Completion] Marked existing user portfolio as verified:', userId);
    
    // Trigger background portfolio refresh from authoritative sources
    triggerPortfolioRefresh(userId, user.panNumber);
    return;
  }
  
  // Try to find a matching prospect using multiple matching strategies
  let matchingProspect = await db.query.prospectClients.findFirst({
    where: eq(prospectClients.convertedUserId, userId),
  });
  
  // Fallback: Try matching by PAN if convertedUserId not set
  if (!matchingProspect && user.panNumber) {
    matchingProspect = await db.query.prospectClients.findFirst({
      where: eq(prospectClients.pan, user.panNumber),
    });
    if (matchingProspect) {
      console.log('[KYC Completion] Found prospect by PAN match');
    }
  }
  
  // Fallback: Try matching by email
  if (!matchingProspect && user.email) {
    matchingProspect = await db.query.prospectClients.findFirst({
      where: eq(prospectClients.email, user.email),
    });
    if (matchingProspect) {
      console.log('[KYC Completion] Found prospect by email match');
    }
  }
  
  // Fallback: Try matching by mobile
  if (!matchingProspect && user.mobileNumber) {
    matchingProspect = await db.query.prospectClients.findFirst({
      where: eq(prospectClients.mobile, user.mobileNumber),
    });
    if (matchingProspect) {
      console.log('[KYC Completion] Found prospect by mobile match');
    }
  }
  
  if (!matchingProspect) {
    console.log('[KYC Completion] No matching prospect found for user:', userId, 
      '- checked convertedUserId, PAN, email, and mobile');
    return;
  }
  
  // Check if prospect has portfolio data in unified tables
  const prospectPortfolio = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.prospectId, matchingProspect.id))
    .limit(1);
  
  if (prospectPortfolio.length === 0) {
    console.log('[KYC Completion] No prospect portfolio found to transfer for prospect:', matchingProspect.id);
    return;
  }
  
  const portfolio = prospectPortfolio[0];
  
  // Transfer the portfolio to the user and mark as verified
  await db
    .update(portfolios)
    .set({
      userId,
      prospectId: null, // Remove prospect association
      isVerified: true,
      lastFetchedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(portfolios.id, portfolio.id));
  
  // Also update the prospect to link to the user
  await db
    .update(prospectClients)
    .set({
      convertedUserId: userId,
      state: 'active_client',
      convertedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(prospectClients.id, matchingProspect.id));
  
  console.log('[KYC Completion] Successfully transferred and verified portfolio for user:', userId);
  
  // Trigger background portfolio refresh from authoritative sources
  triggerPortfolioRefresh(userId, user.panNumber);
}

/**
 * Trigger a background portfolio refresh from authoritative sources
 * This attempts to fetch holdings from BSE STAR CAS, CAMS, or other official sources
 * Runs asynchronously and won't block KYC completion
 * 
 * Uses database transactions to ensure atomicity - either all holdings are updated or none
 */
function triggerPortfolioRefresh(userId: string, panNumber?: string | null): void {
  // Schedule refresh asynchronously - don't await or block KYC completion
  setImmediate(async () => {
    try {
      // Handle missing PAN
      if (!panNumber) {
        console.log('[Portfolio Refresh] No PAN available for user, skipping auto-fetch:', userId);
        await db
          .update(schema.portfolios)
          .set({
            lastFetchStatus: 'skipped',
            lastFetchError: 'No PAN available for CAS fetch',
            updatedAt: new Date()
          })
          .where(eq(schema.portfolios.userId, userId));
        return;
      }
      
      console.log('[Portfolio Refresh] Starting background portfolio fetch for user:', userId);
      
      // Fetch user details for CAS request
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });
      
      if (!user) {
        console.log('[Portfolio Refresh] User not found:', userId);
        await db
          .update(schema.portfolios)
          .set({
            lastFetchStatus: 'skipped',
            lastFetchError: 'User record not found',
            updatedAt: new Date()
          })
          .where(eq(schema.portfolios.userId, userId));
        return;
      }
      
      // Validate required fields for CAS fetch
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      if (!userName || !user.dateOfBirth) {
        console.log('[Portfolio Refresh] Missing required user data (name or DOB), skipping CAS fetch:', userId);
        // Update portfolio status to indicate skip
        await db
          .update(schema.portfolios)
          .set({
            lastFetchStatus: 'skipped',
            lastFetchError: 'Missing required user data (name or DOB)',
            updatedAt: new Date()
          })
          .where(eq(schema.portfolios.userId, userId));
        return;
      }
      
      // Import services dynamically to avoid circular dependencies
      const { BSEStarCASService } = await import('./bse-star-cas-service');
      const { DematHoldingsService } = await import('./demat-holdings-service');
      const casService = new BSEStarCASService();
      const dematService = new DematHoldingsService();
      
      const fetchRequest = {
        panNumber: panNumber,
        name: userName,
        dob: user.dateOfBirth,
        mobile: user.mobileNumber || undefined,
        email: user.email || undefined
      };
      
      // Fetch MF (BSE STAR CAS) and Demat (NSDL/CDSL) data in parallel
      console.log('[Portfolio Refresh] Fetching MF + Demat data in parallel...');
      const [mfUnifiedResult, dematUnifiedResult] = await Promise.all([
        casService.fetchCASWithTransactions(fetchRequest),
        dematService.fetchDematWithTransactions(fetchRequest)
      ]);
      
      const casResult = mfUnifiedResult.holdings;
      const mfTransactionResult = mfUnifiedResult.transactions;
      const dematResult = dematUnifiedResult.holdings;
      const dematTransactionResult = dematUnifiedResult.transactions;
      
      // Check if at least one source succeeded
      const mfSuccess = casResult?.success || false;
      const dematSuccess = dematResult?.success || false;
      
      if (!mfSuccess && !dematSuccess) {
        console.log('[Portfolio Refresh] Both MF and Demat fetch failed');
        await db
          .update(schema.portfolios)
          .set({
            lastFetchStatus: 'failed',
            lastFetchError: casResult?.message || dematResult?.message || 'All data sources failed',
            updatedAt: new Date()
          })
          .where(eq(schema.portfolios.userId, userId));
        return;
      }
      
      const mfHoldingsCount = casResult?.holdings?.length || 0;
      const dematHoldingsCount = dematResult?.holdings?.length || 0;
      
      if (mfHoldingsCount === 0 && dematHoldingsCount === 0) {
        console.log('[Portfolio Refresh] No holdings found in MF or Demat');
        await db
          .update(schema.portfolios)
          .set({
            lastFetchStatus: 'success',
            lastFetchError: null,
            lastFetchedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.portfolios.userId, userId));
        return;
      }
      
      const mfTxCount = mfTransactionResult?.transactions?.length || 0;
      const dematTxCount = dematTransactionResult?.transactions?.length || 0;
      console.log(`[Portfolio Refresh] Fetched: MF=${mfHoldingsCount} holdings/${mfTxCount} transactions, Demat=${dematHoldingsCount} holdings/${dematTxCount} transactions`);
      
      const { portfolioHoldings } = await import('@shared/schema');
      
      // Use transaction for atomic update - either all changes succeed or none
      // CAS-verified holdings have confidenceScore=100, uploaded holdings have lower scores
      await db.transaction(async (tx) => {
        // Get or create portfolio for user
        let userPortfolio = await tx.query.portfolios.findFirst({
          where: eq(schema.portfolios.userId, userId),
        });
        
        if (!userPortfolio) {
          // Create new portfolio within transaction
          const [newPortfolio] = await tx
            .insert(schema.portfolios)
            .values({
              userId,
              name: `${userName}'s Portfolio`,
              totalValue: casResult.totalValue.toString(),
              source: 'cas_fetch',
              lastFetchedAt: new Date(),
              lastFetchStatus: 'success',
              lastFetchError: null,
              isVerified: true,
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .returning();
          
          userPortfolio = newPortfolio;
          console.log('[Portfolio Refresh] Created new portfolio for user:', userId);
        } else {
          // Delete all mutual fund holdings - CAS data is authoritative for MFs
          // This includes legacy CAS holdings and uploaded MF data
          // Non-MF holdings (stocks, bonds, etc.) are preserved
          await tx
            .delete(portfolioHoldings)
            .where(
              and(
                eq(portfolioHoldings.portfolioId, userPortfolio.id),
                eq(portfolioHoldings.assetType, 'mutual_fund')
              )
            );
          
          // Update portfolio with fresh CAS data
          await tx
            .update(schema.portfolios)
            .set({
              totalValue: casResult.totalValue.toString(),
              source: 'cas_fetch',
              lastFetchedAt: new Date(),
              lastFetchStatus: 'success',
              lastFetchError: null,
              isVerified: true,
              updatedAt: new Date()
            })
            .where(eq(schema.portfolios.id, userPortfolio.id));
        }
        
        // Insert fresh CAS holdings - deduplicate by schemeCode+folioNumber
        // Set confidenceScore=100 to mark as CAS-verified
        const insertedKeys = new Set<string>();
        for (const holding of casResult.holdings) {
          const dedupKey = `${holding.schemeCode}|${holding.folioNumber}`;
          if (insertedKeys.has(dedupKey)) {
            console.log('[Portfolio Refresh] Skipping duplicate holding:', dedupKey);
            continue;
          }
          insertedKeys.add(dedupKey);
          
          await tx
            .insert(portfolioHoldings)
            .values({
              portfolioId: userPortfolio.id,
              assetType: 'mutual_fund',
              symbol: holding.schemeCode,
              name: holding.schemeName,
              quantity: holding.units.toString(),
              avgPrice: holding.averageNav.toString(),
              currentValue: holding.currentValue.toString(),
              investedValue: holding.investedAmount.toString(),
              productType: 'mutual_fund',
              folioNumber: holding.folioNumber,
              broker: holding.amcName,
              confidenceScore: 100, // Mark as CAS-verified
              source: 'cas_fetch', // Track holding origin
              updatedAt: new Date()
            } as any);
        }
        
        console.log('[Portfolio Refresh] MF holdings sync complete - refreshed', insertedKeys.size, 'MF holdings');
        
        // Sync Demat holdings if available
        const hasDematHoldings = dematSuccess && dematResult?.holdings?.length > 0;
        let dematInsertedCount = 0;
        
        if (hasDematHoldings) {
          // Delete existing demat holdings (equity, bond, etf, etc.) - demat data is authoritative
          await tx
            .delete(portfolioHoldings)
            .where(
              and(
                eq(portfolioHoldings.portfolioId, userPortfolio.id),
                sql`${portfolioHoldings.assetType} IN ('equity', 'bond', 'ncd', 'etf', 'aif', 'pms', 'reit', 'invit', 'sgb', 'mld', 'gsec')`
              )
            );
          
          // Insert demat holdings
          const dematKeys = new Set<string>();
          for (const holding of dematResult.holdings) {
            const dedupKey = `${holding.isin}|${holding.dematAccountNumber}`;
            if (dematKeys.has(dedupKey)) continue;
            dematKeys.add(dedupKey);
            
            await tx
              .insert(portfolioHoldings)
              .values({
                portfolioId: userPortfolio.id,
                assetType: holding.assetType,
                symbol: holding.symbol,
                name: holding.companyName,
                isin: holding.isin,
                quantity: holding.quantity.toString(),
                avgPrice: holding.averagePrice.toString(),
                currentValue: holding.currentValue.toString(),
                investedValue: holding.investedAmount.toString(),
                productType: holding.assetType,
                broker: holding.depository,
                confidenceScore: 100,
                source: holding.depository === 'NSDL' ? 'nsdl' : 'cdsl',
                updatedAt: new Date()
              } as any);
            
            dematInsertedCount++;
          }
          console.log('[Portfolio Refresh] Demat holdings sync complete - refreshed', dematInsertedCount, 'demat holdings');
        }
        
        // Sync MF transactions if available (with null guards)
        const hasMfTransactions = mfTransactionResult?.success && 
          mfTransactionResult?.transactions && 
          mfTransactionResult.transactions.length > 0;
        
        if (hasMfTransactions) {
          console.log('[Portfolio Refresh] Syncing', mfTransactionResult.transactions.length, 'MF transactions');
          
          // Get current financial year (April to March)
          const now = new Date();
          const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          const financialYear = `${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
          
          // Create or update transaction report for MF sync
          const existingMfReport = await tx.query.transactionReports.findFirst({
            where: and(
              eq(schema.transactionReports.userId, userId),
              eq(schema.transactionReports.financialYear, financialYear),
              eq(schema.transactionReports.source, 'bse_star_cas'),
              eq(schema.transactionReports.assetType, 'mutual_fund')
            ),
          });
          
          let mfReportId: string;
          
          if (existingMfReport) {
            mfReportId = existingMfReport.id;
            // Update existing report
            await tx
              .update(schema.transactionReports)
              .set({
                transactionCount: mfTransactionResult.transactions.length,
                fetchedAt: new Date(),
                status: 'success',
                updatedAt: new Date()
              })
              .where(eq(schema.transactionReports.id, mfReportId));
          } else {
            // Create new transaction report
            const [newReport] = await tx
              .insert(schema.transactionReports)
              .values({
                userId,
                financialYear,
                source: 'bse_star_cas',
                assetType: 'mutual_fund',
                transactionCount: mfTransactionResult.transactions.length,
                status: 'success',
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
              })
              .returning();
            
            mfReportId = newReport.id;
          }
          
          // Delete existing transactions for this report to avoid duplicates
          await tx
            .delete(schema.transactionRecords)
            .where(eq(schema.transactionRecords.reportId, mfReportId));
          
          // Insert fresh transactions
          let purchaseTotal = 0;
          let redemptionTotal = 0;
          let switchTotal = 0;
          let dividendTotal = 0;
          
          for (const tx_record of mfTransactionResult.transactions) {
            // Track totals for report summary
            const amount = Math.abs(tx_record.amount);
            if (tx_record.transactionType === 'purchase' || tx_record.transactionType === 'sip') {
              purchaseTotal += amount;
            } else if (tx_record.transactionType === 'redemption') {
              redemptionTotal += amount;
            } else if (tx_record.transactionType === 'switch_in' || tx_record.transactionType === 'switch_out') {
              switchTotal += amount;
            } else if (tx_record.transactionType === 'dividend') {
              dividendTotal += amount;
            }
            
            await tx
              .insert(schema.transactionRecords)
              .values({
                reportId: mfReportId,
                userId,
                transactionDate: tx_record.transactionDate,
                transactionType: tx_record.transactionType,
                fundName: tx_record.schemeName,
                fundCode: tx_record.schemeCode,
                folio: tx_record.folioNumber,
                units: tx_record.units.toString(),
                nav: tx_record.nav.toString(),
                amount: tx_record.amount.toString(),
                stampDuty: tx_record.stampDuty.toString(),
                stt: tx_record.stt.toString(),
                tds: tx_record.tds.toString(),
                netAmount: tx_record.netAmount.toString(),
                registrar: tx_record.registrarName,
                createdAt: new Date()
              });
          }
          
          // Update report with calculated totals
          await tx
            .update(schema.transactionReports)
            .set({
              totalPurchases: purchaseTotal.toString(),
              totalRedemptions: redemptionTotal.toString(),
              totalSwitches: switchTotal.toString(),
              totalDividendReceived: dividendTotal.toString(),
              updatedAt: new Date()
            })
            .where(eq(schema.transactionReports.id, mfReportId));
          
          console.log('[Portfolio Refresh] MF transaction sync complete - synced', mfTransactionResult.transactions.length, 'transactions');
        }
        
        // Sync Demat transactions if available
        const hasDematTransactions = dematTransactionResult?.success && 
          dematTransactionResult?.transactions && 
          dematTransactionResult.transactions.length > 0;
        
        if (hasDematTransactions) {
          console.log('[Portfolio Refresh] Syncing', dematTransactionResult.transactions.length, 'demat transactions');
          
          const now = new Date();
          const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          const financialYear = `${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
          
          // Create or update transaction report for demat sync
          const existingDematReport = await tx.query.transactionReports.findFirst({
            where: and(
              eq(schema.transactionReports.userId, userId),
              eq(schema.transactionReports.financialYear, financialYear),
              eq(schema.transactionReports.source, dematTransactionResult.source || 'nsdl'),
              eq(schema.transactionReports.assetType, 'equity')
            ),
          });
          
          let dematReportId: string;
          
          if (existingDematReport) {
            dematReportId = existingDematReport.id;
            await tx
              .update(schema.transactionReports)
              .set({
                transactionCount: dematTransactionResult.transactions.length,
                fetchedAt: new Date(),
                status: 'success',
                updatedAt: new Date()
              })
              .where(eq(schema.transactionReports.id, dematReportId));
          } else {
            const [newReport] = await tx
              .insert(schema.transactionReports)
              .values({
                userId,
                financialYear,
                source: dematTransactionResult.source || 'nsdl',
                assetType: 'equity',
                transactionCount: dematTransactionResult.transactions.length,
                status: 'success',
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
              })
              .returning();
            
            dematReportId = newReport.id;
          }
          
          // Delete existing transactions for this report to avoid duplicates
          await tx
            .delete(schema.transactionRecords)
            .where(eq(schema.transactionRecords.reportId, dematReportId));
          
          // Insert demat transactions
          for (const tx_record of dematTransactionResult.transactions) {
            await tx
              .insert(schema.transactionRecords)
              .values({
                reportId: dematReportId,
                userId,
                transactionDate: tx_record.transactionDate,
                transactionType: tx_record.transactionType,
                fundName: tx_record.securityName,
                fundCode: tx_record.isin, // Using fundCode for ISIN
                folio: tx_record.dematAccountNumber, // Using folio for demat account
                units: tx_record.quantity.toString(),
                nav: tx_record.price.toString(),
                amount: tx_record.amount.toString(),
                stampDuty: tx_record.stampDuty?.toString() || '0',
                stt: tx_record.stt?.toString() || '0',
                tds: tx_record.tds?.toString() || '0',
                netAmount: tx_record.netAmount?.toString() || tx_record.amount.toString(),
                createdAt: new Date()
              } as any);
          }
          
          console.log('[Portfolio Refresh] Demat transaction sync complete - synced', dematTransactionResult.transactions.length, 'transactions');
        }
        
        const totalHoldings = insertedKeys.size + dematInsertedCount;
        const totalTransactions = (hasMfTransactions ? mfTransactionResult.transactions.length : 0) + 
          (hasDematTransactions ? dematTransactionResult.transactions.length : 0);
        console.log('[Portfolio Refresh] Unified sync complete - refreshed', totalHoldings, 'holdings and', totalTransactions, 'transactions for user:', userId);
      });
      
    } catch (error) {
      // Log but don't throw - this is a background task
      // Transaction automatically rolls back on error - existing data preserved
      console.error('[Portfolio Refresh] Background fetch failed for user:', userId, error);
      
      // Update portfolio status to indicate failure
      try {
        await db
          .update(schema.portfolios)
          .set({
            lastFetchStatus: 'failed',
            lastFetchError: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date()
          })
          .where(eq(schema.portfolios.userId, userId));
      } catch (statusError) {
        console.error('[Portfolio Refresh] Failed to update error status:', statusError);
      }
    }
  });
}
