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

interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

interface PartnerRecord {
  id: string;
  companyName: string | null;
  contactEmail: string;
  contactPhone: string | null;
  icaiMembershipNumber: string | null;
  icaiMembershipType: string | null;
  caFirmName: string | null;
  caFirmRegistrationNumber: string | null;
  caSpecializations: string[] | null;
  caExperienceYears: number | null;
  caQualificationYear: number | null;
  caCity: string | null;
  caState: string | null;
  caAvailability: string | null;
  caMaxCasesPerMonth: number | null;
  caCurrentActiveCases: number | null;
  caCompletedCases: number | null;
  caAverageRating: string | null;
  caVerificationStatus: string | null;
  createdAt: string;
}

interface EmpanelmentRecord {
  ca_membership_number: string;
}

interface RegistryEntry {
  referralCode: string;
  referralCount: number;
  tier: string;
  isPubliclyListed: boolean;
}

interface ClientUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

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

router.post('/register', async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({
        success: false,
        error: 'Email or ICAI membership number already registered',
      });
      return;
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
  } catch (error: unknown) {
    console.error('CA registration error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.',
    });
  }
});

router.get('/my-profile', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }
    
    const [caPartner] = await db
      .select()
      .from(partners)
      .where(
        and(
          eq(partners.contactEmail, user.email || ''),
          eq(partners.partnerType, 'chartered_accountant')
        )
      )
      .limit(1);
    
    if (!caPartner) {
      res.status(404).json({
        success: false,
        error: 'CA profile not found for this user',
      });
      return;
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
  } catch (error: unknown) {
    console.error('Error fetching CA profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CA profile',
    });
  }
});

router.get('/available', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseType, city, state, itrFormType } = req.query;
    const validCaseTypes = ['itr', 'gst', 'audit', 'form15', 'tax_notice', 'company_law'];
    const selectedCaseType = typeof caseType === 'string' && validCaseTypes.includes(caseType) 
      ? caseType as 'itr' | 'gst' | 'audit' | 'form15' | 'tax_notice' | 'company_law'
      : 'itr';

    const candidates = await caAssignmentService.findBestCA({
      caseType: selectedCaseType,
      clientCity: city as string,
      clientState: state as string,
      itrFormType: itrFormType as string,
    });
    
    res.json({
      success: true,
      candidates,
    });
  } catch (error: unknown) {
    console.error('Error fetching available CAs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available CAs',
    });
  }
});

router.post('/assign', requireAuth, injectRoleInfo, requireAgentPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId, caPartnerId, autoAssign, criteria } = req.body;
    
    if (autoAssign && criteria) {
      const result = await caAssignmentService.autoAssignCA(caseId, criteria);
      res.json(result);
      return;
    }
    
    if (caseId && caPartnerId) {
      const result = await caAssignmentService.assignCAToCaseFromPartners(caseId, caPartnerId);
      res.json(result);
      return;
    }
    
    res.status(400).json({
      success: false,
      error: 'Missing required parameters',
    });
  } catch (error: unknown) {
    console.error('Error assigning CA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign CA',
    });
  }
});

router.get('/dashboard/:partnerId', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response): Promise<void> => {
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
      res.status(404).json({
        success: false,
        error: 'CA profile not found',
      });
      return;
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
  } catch (error: unknown) {
    console.error('Error fetching CA dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
    });
  }
});

router.get('/cases/:partnerId', requireAuth, injectRoleInfo, requirePartnerPortal, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      cases: [],
      message: 'Cases endpoint - integration with agentItrCases pending CA ID field mapping',
    });
  } catch (error: unknown) {
    console.error('Error fetching CA cases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cases',
    });
  }
});

router.patch('/availability/:partnerId', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const { partnerId } = req.params;
    const { availability } = req.body;
    
    if (!['available', 'busy', 'on_leave', 'unavailable'].includes(availability)) {
      res.status(400).json({
        success: false,
        error: 'Invalid availability status',
      });
      return;
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
  } catch (error: unknown) {
    console.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update availability',
    });
  }
});

router.post('/case/:caseId/complete', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { caPartnerId, rating } = req.body;
    
    const result = await caAssignmentService.markCaseCompleted(caseId, caPartnerId);
    
    if (rating) {
      await caAssignmentService.updateCARating(caPartnerId, rating);
    }
    
    res.json(result);
  } catch (error: unknown) {
    console.error('Error completing case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete case',
    });
  }
});

router.get('/admin/pending-verifications', requireAuth, injectRoleInfo, requireAdminPortal, async (_req: Request, res: Response): Promise<void> => {
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
  } catch (error: unknown) {
    console.error('Error fetching pending verifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending verifications',
    });
  }
});

router.post('/admin/verify/:partnerId', requireAuth, injectRoleInfo, requireAdminPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const { partnerId } = req.params;
    const { action, adminId } = req.body;
    
    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({
        success: false,
        error: 'Invalid action',
      });
      return;
    }
    
    await db
      .update(partners)
      .set({
        caVerificationStatus: action === 'approve' ? 'verified' : 'rejected',
        caVerifiedAt: new Date(),
        caVerifiedBy: adminId,
        isVerified: action === 'approve',
        updatedAt: new Date(),
      })
      .where(eq(partners.id, partnerId));
    
    res.json({
      success: true,
      message: `CA ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error: unknown) {
    console.error('Error verifying CA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify CA',
    });
  }
});

router.get('/admin/all', requireAuth, injectRoleInfo, requireAdminPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    
    const query = db.select().from(partners).where(eq(partners.partnerType, 'chartered_accountant'));
    const allCAs = await query.orderBy(desc(partners.createdAt));
    
    const filteredCAs = allCAs.filter(ca => {
      if (status && status !== 'all' && ca.caVerificationStatus !== status) {
        return false;
      }
      if (search) {
        const searchLower = (search as string).toLowerCase();
        return (
          (ca.companyName?.toLowerCase().includes(searchLower) || false) ||
          (ca.contactEmail?.toLowerCase().includes(searchLower) || false) ||
          (ca.icaiMembershipNumber?.toLowerCase().includes(searchLower) || false)
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
  } catch (error: unknown) {
    console.error('Error fetching CAs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CAs',
    });
  }
});

router.get('/admin/performance', requireAuth, injectRoleInfo, requireAdminPortal, async (_req: Request, res: Response): Promise<void> => {
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
  } catch (error: unknown) {
    console.error('Error fetching CA performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance data',
    });
  }
});

router.post('/admin/verify-icai/:partnerId', requireAuth, injectRoleInfo, requireAdminPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const { partnerId } = req.params;
    const { forceRefresh = false } = req.body;

    const [partner] = await db.select().from(partners)
      .where(and(eq(partners.id, partnerId), eq(partners.partnerType, 'chartered_accountant')))
      .limit(1);

    if (!partner) {
      res.status(404).json({ success: false, error: 'CA partner not found' });
      return;
    }

    if (!partner.icaiMembershipNumber) {
      res.status(400).json({ success: false, error: 'Partner has no ICAI membership number on record' });
      return;
    }

    const result = await verifyICAIMembership(
      partner.icaiMembershipNumber,
      partner.companyName ?? undefined,
      partnerId,
      Boolean(forceRefresh)
    );

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

    res.json({
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[ICAI] Admin verify-icai error:', msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.post('/icai-check', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    const { membershipNumber } = req.body;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const [partner] = await db.select().from(partners)
      .where(and(eq(partners.contactEmail, user.email || ''), eq(partners.partnerType, 'chartered_accountant')))
      .limit(1);

    if (!partner) {
      res.status(404).json({ success: false, error: 'CA profile not found' });
      return;
    }

    const icaiNumber = (membershipNumber as string) || partner.icaiMembershipNumber;
    if (!icaiNumber) {
      res.status(400).json({ success: false, error: 'No ICAI membership number provided' });
      return;
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

    res.json({
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
  } catch (error: unknown) {
    console.error('[ICAI] Self-check error:', error);
    res.status(500).json({ success: false, error: 'Verification request failed. Please try again.' });
  }
});

router.get('/icai-status/:membershipNumber', requireAuth, async (req: Request, res: Response): Promise<void> => {
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

    const row = ((rows as unknown as { rows: any[] }).rows)[0];
    if (!row) {
      res.status(404).json({ success: false, error: 'No CA record found for this membership number' });
      return;
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[ICAI] Status check error:', msg);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get('/clients/:partnerId', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const caUserId = user.id;

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
    let clientUsers: ClientUser[] = [];
    if (uniqueClientIds.length > 0) {
      clientUsers = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(inArray(users.id, uniqueClientIds)) as unknown as ClientUser[];
    }
    const clientMap = Object.fromEntries(clientUsers.map(u => [u.id, u]));

    const clientsMap = new Map<string, any>();
    for (const c of clientCases) {
      if (!clientsMap.has(c.clientId)) {
        const u = clientMap[c.clientId] || {};
        const clientName = (u.firstName || u.lastName) ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : (u.email || 'Client');
        clientsMap.set(c.clientId, {
          clientId: c.clientId,
          name: clientName,
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
  } catch (error: unknown) {
    console.error('Error fetching CA clients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch clients' });
  }
});

router.get('/referral-stats', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const { caRegistryService } = await import('../services/ca-registry-service');

    const empResult = await db.execute(sql`
      SELECT ca_membership_number FROM agent_empanelments WHERE agent_id = ${user.id} LIMIT 1
    `);
    const emp = ((empResult as unknown as { rows: any[] }).rows)[0] as unknown as EmpanelmentRecord | undefined;
    const icaiNumber = emp?.ca_membership_number;

    if (!icaiNumber) {
      res.status(404).json({ success: false, error: 'CA membership not linked to this account' });
      return;
    }

    const entry = await caRegistryService.lookupFromRegistry(icaiNumber) as unknown as RegistryEntry | null;
    if (!entry) {
      res.status(404).json({ success: false, error: 'Registry entry not found' });
      return;
    }

    res.json({
      success: true,
      referralCode: entry.referralCode,
      referralCount: entry.referralCount || 0,
      tier: entry.tier,
      isPubliclyListed: entry.isPubliclyListed,
    });
  } catch (error: unknown) {
    console.error('Error fetching CA referral stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch referral stats' });
  }
});

router.post('/redeem-referral', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ success: false, error: 'Referral code is required' });
      return;
    }

    const { caRegistryService } = await import('../services/ca-registry-service');
    const result = await caRegistryService.redeemReferralCode(code);

    if (!result) {
      res.status(404).json({ success: false, error: 'Invalid or expired referral code' });
      return;
    }

    res.json({
      success: true,
      message: 'Referral code redeemed successfully',
    });
  } catch (error: unknown) {
    console.error('Error redeeming referral code:', error);
    res.status(500).json({ success: false, error: 'Failed to redeem code' });
  }
});

router.post('/clients/invite', requireAuth, injectRoleInfo, requirePartnerPortal, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    const { name, email, mobile } = req.body;

    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!email && !mobile) {
      res.status(400).json({ success: false, error: 'Email or mobile number is required' });
      return;
    }

    const [caPartner] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(and(eq(partners.contactEmail, user.email || ''), eq(partners.partnerType, 'chartered_accountant')))
      .limit(1);

    const caRef = caPartner?.id || user.id;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'fintekpro.com';
    
    const { caRegistryService } = await import('../services/ca-registry-service');
    const empResult = await db.execute(sql`SELECT ca_membership_number FROM agent_empanelments WHERE agent_id = ${user.id} LIMIT 1`);
    const emp = ((empResult as unknown as { rows: any[] }).rows)[0] as unknown as EmpanelmentRecord | undefined;
    const icai = emp?.ca_membership_number;
    const registryEntry = icai ? await caRegistryService.lookupFromRegistry(icai) as unknown as RegistryEntry | null : null;
    
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
  } catch (error: unknown) {
    console.error('Error generating CA client invite:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invite' });
  }
});

export default router;
