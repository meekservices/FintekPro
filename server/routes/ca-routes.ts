import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and, sql, desc, ilike, or, inArray } from 'drizzle-orm';
import { partners, caProfiles, agentItrCases, users } from '@shared/schema';
import { caAssignmentService } from '../services/ca-assignment-service';
import { verifyICAIMembership } from '../services/icai-verification-service';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { 
  requireAuth, 
  requirePartnerPortal, 
  requireAdminPortal,
  requireAgentPortal,
  injectRoleInfo 
} from '../middleware/roleMiddleware';

const router = Router();

const caRegistrationSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  mobile: z.string().length(10),
  password: z.string().min(8),
  icaiMembershipNumber: z.string().min(5),
  membershipType: z.enum(['ACA', 'FCA']),
  copNumber: z.string().optional(),
  qualificationYear: z.coerce.number(),
  experienceYears: z.coerce.number(),
  firmName: z.string().optional(),
  firmRegistrationNumber: z.string().optional(),
  specializations: z.array(z.string()),
  city: z.string(),
  state: z.string(),
  maxCasesPerMonth: z.coerce.number().default(50),
  responseTime: z.enum(['4h', '12h', '24h', '48h']).default('24h'),
  baseFeeItr1: z.coerce.number().default(500),
  baseFeeItr2: z.coerce.number().default(1500),
  baseFeeItr3: z.coerce.number().default(3000),
  baseFeeItr4: z.coerce.number().default(2000),
  panNumber: z.string().length(10),
  bankAccountNumber: z.string().min(8),
  ifscCode: z.string().length(11),
  bankAccountHolderName: z.string().min(3),
  bio: z.string().optional(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = caRegistrationSchema.parse(req.body);
    
    const existingPartner = await db
      .select()
      .from(partners)
      .where(
        or(
          eq(partners.contactEmail, validatedData.email),
          eq(partners.icaiMembershipNumber, validatedData.icaiMembershipNumber)
        )
      )
      .limit(1);
    
    if (existingPartner.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email or ICAI membership number already registered',
      });
    }
    
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);
    
    const [newPartner] = await db
      .insert(partners)
      .values({
        companyName: validatedData.fullName,
        contactEmail: validatedData.email,
        contactPhone: validatedData.mobile,
        password: hashedPassword,
        partnerType: 'chartered_accountant',
        isActive: true,
        isVerified: false,
        
        icaiMembershipNumber: validatedData.icaiMembershipNumber,
        icaiMembershipType: validatedData.membershipType,
        caFirmName: validatedData.firmName || null,
        caFirmRegistrationNumber: validatedData.firmRegistrationNumber || null,
        caSpecializations: validatedData.specializations,
        caExperienceYears: validatedData.experienceYears,
        caQualificationYear: validatedData.qualificationYear,
        caCity: validatedData.city,
        caState: validatedData.state,
        caAvailability: 'available',
        caMaxCasesPerMonth: validatedData.maxCasesPerMonth,
        caCurrentActiveCases: 0,
        caCompletedCases: 0,
        caAverageRating: '5.00',
        caTotalRatings: 0,
        caResponseTime: validatedData.responseTime,
        caVerificationStatus: 'pending',
        caBio: validatedData.bio || null,
        
        panNumber: validatedData.panNumber.toUpperCase(),
        bankAccountNumber: validatedData.bankAccountNumber,
        ifscCode: validatedData.ifscCode.toUpperCase(),
        bankAccountHolderName: validatedData.bankAccountHolderName,
        
        commissionTier: 'standard',
      })
      .returning();
    
    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Your application is under review.',
      partnerId: newPartner.id,
    });
  } catch (error) {
    console.error('CA registration error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.',
    });
  }
});

router.get('/my-profile', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const [caPartner] = await db
      .select()
      .from(partners)
      .where(
        and(
          eq(partners.contactEmail, user.email),
          eq(partners.partnerType, 'chartered_accountant')
        )
      )
      .limit(1);
    
    if (!caPartner) {
      return res.status(404).json({
        success: false,
        error: 'CA profile not found for this user',
      });
    }
    
    res.json({
      success: true,
      partnerId: caPartner.id,
      profile: {
        id: caPartner.id,
        name: caPartner.companyName,
        email: caPartner.contactEmail,
        icaiNumber: caPartner.icaiMembershipNumber,
        membershipType: caPartner.icaiMembershipType,
        verificationStatus: caPartner.caVerificationStatus,
      },
    });
  } catch (error) {
    console.error('Error fetching CA profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CA profile',
    });
  }
});

router.get('/available', requireAuth, async (req: Request, res: Response) => {
  try {
    const { caseType, city, state, itrFormType } = req.query;
    
    const candidates = await caAssignmentService.findBestCA({
      caseType: (caseType as string) || 'itr',
      clientCity: city as string,
      clientState: state as string,
      itrFormType: itrFormType as string,
    });
    
    res.json({
      success: true,
      candidates,
    });
  } catch (error) {
    console.error('Error fetching available CAs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available CAs',
    });
  }
});

router.post('/assign', requireAuth, injectRoleInfo, requireAgentPortal, async (req: Request, res: Response) => {
  try {
    const { caseId, caPartnerId, autoAssign, criteria } = req.body;
    
    if (autoAssign && criteria) {
      const result = await caAssignmentService.autoAssignCA(caseId, criteria);
      return res.json(result);
    }
    
    if (caseId && caPartnerId) {
      const result = await caAssignmentService.assignCAToCaseFromPartners(caseId, caPartnerId);
      return res.json(result);
    }
    
    res.status(400).json({
      success: false,
      error: 'Missing required parameters',
    });
  } catch (error) {
    console.error('Error assigning CA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign CA',
    });
  }
});

router.get('/dashboard/:partnerId', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;
    
    const stats = await caAssignmentService.getCADashboardStats(partnerId);
    
    const [caProfile] = await db
      .select()
      .from(partners)
      .where(
        and(
          eq(partners.id, partnerId),
          eq(partners.partnerType, 'chartered_accountant')
        )
      )
      .limit(1);
    
    if (!caProfile) {
      return res.status(404).json({
        success: false,
        error: 'CA profile not found',
      });
    }
    
    res.json({
      success: true,
      profile: {
        id: caProfile.id,
        name: caProfile.companyName,
        email: caProfile.contactEmail,
        icaiNumber: caProfile.icaiMembershipNumber,
        membershipType: caProfile.icaiMembershipType,
        specializations: caProfile.caSpecializations,
        city: caProfile.caCity,
        state: caProfile.caState,
        availability: caProfile.caAvailability,
        maxCases: caProfile.caMaxCasesPerMonth,
        verificationStatus: caProfile.caVerificationStatus,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching CA dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
    });
  }
});

router.get('/cases/:partnerId', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;
    const { status } = req.query;
    
    res.json({
      success: true,
      cases: [],
      message: 'Cases endpoint - integration with agentItrCases pending CA ID field mapping',
    });
  } catch (error) {
    console.error('Error fetching CA cases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cases',
    });
  }
});

router.patch('/availability/:partnerId', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;
    const { availability } = req.body;
    
    if (!['available', 'busy', 'on_leave', 'unavailable'].includes(availability)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid availability status',
      });
    }
    
    await db
      .update(partners)
      .set({
        caAvailability: availability,
        updatedAt: new Date(),
      })
      .where(eq(partners.id, partnerId));
    
    res.json({
      success: true,
      message: 'Availability updated',
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update availability',
    });
  }
});

router.post('/case/:caseId/complete', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { caPartnerId, rating, feedback } = req.body;
    
    const result = await caAssignmentService.markCaseCompleted(caseId, caPartnerId);
    
    if (rating) {
      await caAssignmentService.updateCARating(caPartnerId, rating);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error completing case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete case',
    });
  }
});

router.get('/admin/pending-verifications', requireAuth, injectRoleInfo, requireAdminPortal, async (req: Request, res: Response) => {
  try {
    const pendingCAs = await db
      .select()
      .from(partners)
      .where(
        and(
          eq(partners.partnerType, 'chartered_accountant'),
          eq(partners.caVerificationStatus, 'pending')
        )
      )
      .orderBy(desc(partners.createdAt));
    
    res.json({
      success: true,
      pendingCAs: pendingCAs.map(ca => ({
        id: ca.id,
        name: ca.companyName,
        email: ca.contactEmail,
        mobile: ca.contactPhone,
        icaiNumber: ca.icaiMembershipNumber,
        membershipType: ca.icaiMembershipType,
        firmName: ca.caFirmName,
        specializations: ca.caSpecializations,
        city: ca.caCity,
        state: ca.caState,
        experience: ca.caExperienceYears,
        appliedAt: ca.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching pending verifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending verifications',
    });
  }
});

router.post('/admin/verify/:partnerId', requireAuth, injectRoleInfo, requireAdminPortal, async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;
    const { action, rejectionReason, adminId } = req.body;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action',
      });
    }
    
    const updateData: any = {
      caVerificationStatus: action === 'approve' ? 'verified' : 'rejected',
      caVerifiedAt: new Date(),
      caVerifiedBy: adminId,
      isVerified: action === 'approve',
      updatedAt: new Date(),
    };
    
    await db
      .update(partners)
      .set(updateData)
      .where(eq(partners.id, partnerId));
    
    res.json({
      success: true,
      message: `CA ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error) {
    console.error('Error verifying CA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify CA',
    });
  }
});

router.get('/admin/all', requireAuth, injectRoleInfo, requireAdminPortal, async (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    
    let query = db.select().from(partners).where(eq(partners.partnerType, 'chartered_accountant'));
    
    const allCAs = await query.orderBy(desc(partners.createdAt));
    
    const filteredCAs = allCAs.filter(ca => {
      if (status && status !== 'all' && ca.caVerificationStatus !== status) {
        return false;
      }
      if (search) {
        const searchLower = (search as string).toLowerCase();
        return (
          ca.companyName?.toLowerCase().includes(searchLower) ||
          ca.contactEmail?.toLowerCase().includes(searchLower) ||
          ca.icaiMembershipNumber?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    const paginatedCAs = filteredCAs.slice(offset, offset + limitNum);
    
    res.json({
      success: true,
      cas: paginatedCAs.map(ca => ({
        id: ca.id,
        name: ca.companyName,
        email: ca.contactEmail,
        mobile: ca.contactPhone,
        icaiNumber: ca.icaiMembershipNumber,
        membershipType: ca.icaiMembershipType,
        firmName: ca.caFirmName,
        specializations: ca.caSpecializations,
        city: ca.caCity,
        state: ca.caState,
        experience: ca.caExperienceYears,
        availability: ca.caAvailability,
        activeCases: ca.caCurrentActiveCases,
        completedCases: ca.caCompletedCases,
        rating: ca.caAverageRating,
        verificationStatus: ca.caVerificationStatus,
        createdAt: ca.createdAt,
      })),
      pagination: {
        total: filteredCAs.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filteredCAs.length / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching CAs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CAs',
    });
  }
});

router.get('/admin/performance', requireAuth, injectRoleInfo, requireAdminPortal, async (req: Request, res: Response) => {
  try {
    const allCAs = await db
      .select()
      .from(partners)
      .where(
        and(
          eq(partners.partnerType, 'chartered_accountant'),
          eq(partners.caVerificationStatus, 'verified')
        )
      );
    
    const performance = allCAs.map(ca => ({
      id: ca.id,
      name: ca.companyName,
      activeCases: ca.caCurrentActiveCases || 0,
      completedCases: ca.caCompletedCases || 0,
      maxCases: ca.caMaxCasesPerMonth || 50,
      utilizationRate: Math.round(((ca.caCurrentActiveCases || 0) / (ca.caMaxCasesPerMonth || 50)) * 100),
      rating: parseFloat(ca.caAverageRating || '5.0'),
      responseTime: ca.caResponseTime,
      availability: ca.caAvailability,
      specializations: ca.caSpecializations,
    }));
    
    res.json({
      success: true,
      performance,
      summary: {
        totalCAs: allCAs.length,
        availableCAs: allCAs.filter(ca => ca.caAvailability === 'available').length,
        avgUtilization: Math.round(
          performance.reduce((sum, ca) => sum + ca.utilizationRate, 0) / performance.length
        ) || 0,
        avgRating: (
          performance.reduce((sum, ca) => sum + ca.rating, 0) / performance.length
        ).toFixed(2) || '0.00',
      },
    });
  } catch (error) {
    console.error('Error fetching CA performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance data',
    });
  }
});

// ─── ICAI Verification (ICHI Scraper Layer) ───────────────────────────────────

/**
 * Admin: trigger ICAI scraper for a registered CA partner
 * POST /api/ca/admin/verify-icai/:partnerId
 */
router.post('/admin/verify-icai/:partnerId', requireAuth, injectRoleInfo, requireAdminPortal, async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;
    const { forceRefresh = false } = req.body;

    const [partner] = await db.select().from(partners)
      .where(and(eq(partners.id, partnerId), eq(partners.partnerType, 'chartered_accountant')))
      .limit(1);

    if (!partner) {
      return res.status(404).json({ success: false, error: 'CA partner not found' });
    }

    if (!partner.icaiMembershipNumber) {
      return res.status(400).json({ success: false, error: 'Partner has no ICAI membership number on record' });
    }

    const result = await verifyICAIMembership(
      partner.icaiMembershipNumber,
      partner.companyName ?? undefined,
      partnerId,
      Boolean(forceRefresh)
    );

    // Compute statuses in TypeScript before writing to DB
    const icaiActive = result.membershipStatus === 'ACTIVE' || result.membershipStatus === 'FELLOW' || result.membershipStatus === 'ASSOCIATE';
    const icaiScraperStatus = icaiActive ? 'verified' : result.source === 'SCRAPER_FAILED' ? 'scraper_failed' : 'unverified';
    const autoApprove = icaiActive && (result.nameMatchScore ?? 0) >= 70;
    const newVerifStatus = autoApprove ? 'verified' : result.source === 'SCRAPER_FAILED' ? partner.caVerificationStatus : 'pending';

    await db.execute(sql`
      UPDATE partners SET
        icai_scraped_name       = ${result.nameAtICAI ?? null},
        icai_scraper_status     = ${icaiScraperStatus},
        icai_scraper_run_at     = NOW(),
        icai_scraper_source     = ${result.source},
        icai_confidence_score   = ${result.confidenceScore},
        icai_cop_status         = ${result.copStatus ?? null},
        ca_verification_status  = ${newVerifStatus},
        updated_at = NOW()
      WHERE id = ${partnerId}
    `);

    return res.json({
      success: true,
      partnerId,
      icaiNumber: partner.icaiMembershipNumber,
      result: {
        nameAtICAI: result.nameAtICAI,
        providedName: partner.companyName,
        membershipStatus: result.membershipStatus,
        membershipType: result.membershipType,
        copStatus: result.copStatus,
        nameMatchScore: result.nameMatchScore,
        confidenceScore: result.confidenceScore,
        source: result.source,
        error: result.error,
      },
      autoApproved: (result.membershipStatus === 'ACTIVE' || result.membershipStatus === 'FELLOW') && (result.nameMatchScore ?? 0) >= 70,
    });
  } catch (error: any) {
    console.error('[ICAI] Admin verify-icai error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Partner self-service: request ICAI membership verification
 * POST /api/ca/icai-check
 */
router.post('/icai-check', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { membershipNumber } = req.body;

    const [partner] = await db.select().from(partners)
      .where(and(eq(partners.contactEmail, user.email), eq(partners.partnerType, 'chartered_accountant')))
      .limit(1);

    if (!partner) {
      return res.status(404).json({ success: false, error: 'CA profile not found' });
    }

    const icaiNumber = membershipNumber || partner.icaiMembershipNumber;
    if (!icaiNumber) {
      return res.status(400).json({ success: false, error: 'No ICAI membership number provided' });
    }

    const result = await verifyICAIMembership(
      icaiNumber,
      partner.companyName ?? undefined,
      partner.id
    );

    await db.execute(sql`
      UPDATE partners SET
        icai_scraped_name     = ${result.nameAtICAI ?? null},
        icai_scraper_status   = ${result.source === 'SCRAPER_FAILED' ? 'scraper_failed' : 'checked'},
        icai_scraper_run_at   = NOW(),
        icai_scraper_source   = ${result.source},
        icai_confidence_score = ${result.confidenceScore},
        icai_cop_status       = ${result.copStatus ?? null},
        updated_at = NOW()
      WHERE id = ${partner.id}
    `);

    return res.json({
      success: true,
      membershipStatus: result.membershipStatus,
      nameAtICAI: result.nameAtICAI,
      copStatus: result.copStatus,
      confidenceScore: result.confidenceScore,
      source: result.source,
      nameMatchScore: result.nameMatchScore,
      message: result.source === 'SCRAPER_FAILED'
        ? 'Could not reach ICAI portal. Manual verification will be done by our team.'
        : result.membershipStatus === 'ACTIVE' || result.membershipStatus === 'FELLOW'
          ? 'ICAI membership confirmed. Your application is under review.'
          : 'ICAI membership status could not be confirmed. Our team will verify manually.',
      error: result.error,
    });
  } catch (error: any) {
    console.error('[ICAI] Self-check error:', error);
    res.status(500).json({ success: false, error: 'Verification request failed. Please try again.' });
  }
});

/**
 * Get cached ICAI status for a membership number (admin + partner)
 * GET /api/ca/icai-status/:membershipNumber
 */
router.get('/icai-status/:membershipNumber', requireAuth, async (req: Request, res: Response) => {
  try {
    const { membershipNumber } = req.params;
    const cleaned = membershipNumber.trim().toUpperCase();

    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.company_name,
        p.icai_membership_number,
        p.icai_scraped_name,
        p.icai_scraper_status,
        p.icai_scraper_run_at,
        p.icai_scraper_source,
        p.icai_confidence_score,
        p.icai_cop_status,
        p.ca_verification_status
      FROM partners p
      WHERE p.icai_membership_number = ${cleaned}
        AND p.partner_type = 'chartered_accountant'
      LIMIT 1
    `);

    const row = (rows as any[])[0];
    if (!row) {
      return res.status(404).json({ success: false, error: 'No CA record found for this membership number' });
    }

    res.json({
      success: true,
      partnerId: row.id,
      membershipNumber: row.icai_membership_number,
      registeredName: row.company_name,
      scraperResult: {
        nameAtICAI: row.icai_scraped_name,
        status: row.icai_scraper_status,
        runAt: row.icai_scraper_run_at,
        source: row.icai_scraper_source,
        confidenceScore: row.icai_confidence_score,
        copStatus: row.icai_cop_status,
      },
      overallVerificationStatus: row.ca_verification_status,
    });
  } catch (error: any) {
    console.error('[ICAI] Status check error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /clients/:partnerId — list all clients whose cases are assigned to this CA
router.get('/clients/:partnerId', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const caUserId = user.id; // agentItrCases.caId references users.id

    const clientCases = await db
      .select({
        clientId: agentItrCases.clientId,
        caseId: agentItrCases.id,
        assessmentYear: agentItrCases.assessmentYear,
        financialYear: agentItrCases.financialYear,
        status: agentItrCases.status,
        itrFormType: agentItrCases.itrFormType,
        totalFee: agentItrCases.totalFee,
        feeStatus: agentItrCases.feeStatus,
        createdAt: agentItrCases.createdAt,
      })
      .from(agentItrCases)
      .where(eq(agentItrCases.caId, caUserId))
      .orderBy(desc(agentItrCases.createdAt));

    const uniqueClientIds = [...new Set(clientCases.map(c => c.clientId))];
    let clientUsers: any[] = [];
    if (uniqueClientIds.length > 0) {
      clientUsers = await db
        .select({ id: users.id, username: users.username, email: users.email })
        .from(users)
        .where(inArray(users.id, uniqueClientIds));
    }
    const clientMap = Object.fromEntries(clientUsers.map(u => [u.id, u]));

    const clientsMap = new Map<string, any>();
    for (const c of clientCases) {
      if (!clientsMap.has(c.clientId)) {
        const u = clientMap[c.clientId] || {};
        clientsMap.set(c.clientId, {
          clientId: c.clientId,
          name: u.username || u.email || 'Client',
          email: u.email || '',
          totalCases: 0,
          activeCases: 0,
          completedCases: 0,
          totalFees: 0,
          joinedAt: c.createdAt,
          latestStatus: c.status,
        });
      }
      const client = clientsMap.get(c.clientId)!;
      client.totalCases++;
      if (['completed', 'filed', 'acknowledged'].includes(c.status || '')) {
        client.completedCases++;
      } else {
        client.activeCases++;
      }
      client.totalFees += parseFloat(String(c.totalFee || '0'));
      client.latestStatus = c.status;
    }

    res.json({
      success: true,
      clients: Array.from(clientsMap.values()),
      totalCases: clientCases.length,
    });
  } catch (error) {
    console.error('Error fetching CA clients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch clients' });
  }
});

// GET /referral-stats — get current CA's referral code and metrics
router.get('/referral-stats', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { caRegistryService } = await import('../services/ca-registry-service');

    // Find the ICAI number for this user
    const [emp] = await db.execute(sql`
      SELECT ca_membership_number FROM agent_empanelments WHERE agent_id = ${user.id} LIMIT 1
    `);
    const icaiNumber = (emp as any)?.ca_membership_number;

    if (!icaiNumber) {
      return res.status(404).json({ success: false, error: 'CA membership not linked to this account' });
    }

    const entry = await caRegistryService.lookupFromRegistry(icaiNumber);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Registry entry not found' });
    }

    res.json({
      success: true,
      referralCode: entry.referralCode,
      referralCount: entry.referralCount || 0,
      tier: entry.tier,
      isPubliclyListed: entry.isPubliclyListed,
    });
  } catch (error) {
    console.error('Error fetching CA referral stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch referral stats' });
  }
});

// POST /redeem-referral — use a referral code (usually called during or after signup)
router.post('/redeem-referral', async (req: Request, res: Response) => {
  try {
    const { code, targetUserId } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Referral code is required' });

    const { caRegistryService } = await import('../services/ca-registry-service');
    const result = await caRegistryService.redeemReferralCode(code);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Invalid or expired referral code' });
    }

    // If targetUserId provided, we could store the link in a separate referrals table if needed
    // For Phase 1, we just increment the counter as per the reward logic

    res.json({
      success: true,
      message: 'Referral code redeemed successfully',
    });
  } catch (error) {
    console.error('Error redeeming referral code:', error);
    res.status(500).json({ success: false, error: 'Failed to redeem code' });
  }
});

// POST /clients/invite — generate a shareable invite link for a new client
router.post('/clients/invite', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, email, mobile } = req.body;

    if (!email && !mobile) {
      return res.status(400).json({ success: false, error: 'Email or mobile number is required' });
    }

    const [caPartner] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(and(eq(partners.contactEmail, user.email), eq(partners.partnerType, 'chartered_accountant')))
      .limit(1);

    const caRef = caPartner?.id || user.id;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'fintekpro.com';
    
    // Check if CA has a registry referral code to use that instead
    const { caRegistryService } = await import('../services/ca-registry-service');
    const [emp] = await db.execute(sql`SELECT ca_membership_number FROM agent_empanelments WHERE agent_id = ${user.id} LIMIT 1`);
    const icai = (emp as any)?.ca_membership_number;
    const registryEntry = icai ? await caRegistryService.lookupFromRegistry(icai) : null;
    
    const code = registryEntry?.referralCode || `ca_${caRef}`;
    const inviteLink = `${protocol}://${host}/itr-tax-services?ref=${code}`;

    res.json({
      success: true,
      inviteLink,
      message: `Invite link generated${name ? ` for ${name}` : ''}`,
      inviteDetails: {
        clientName: name || null,
        clientEmail: email || null,
        clientMobile: mobile || null,
        referralCode: code,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating CA client invite:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invite' });
  }
});

export default router;
