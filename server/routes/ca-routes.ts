import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and, sql, desc, ilike, or } from 'drizzle-orm';
import { partners, caProfiles, agentItrCases, users } from '@shared/schema';
import { caAssignmentService } from '../services/ca-assignment-service';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

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

router.get('/my-profile', async (req: Request, res: Response) => {
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

router.get('/available', async (req: Request, res: Response) => {
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

router.post('/assign', async (req: Request, res: Response) => {
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

router.get('/dashboard/:partnerId', async (req: Request, res: Response) => {
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

router.get('/cases/:partnerId', async (req: Request, res: Response) => {
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

router.patch('/availability/:partnerId', async (req: Request, res: Response) => {
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

router.post('/case/:caseId/complete', async (req: Request, res: Response) => {
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

router.get('/admin/pending-verifications', async (req: Request, res: Response) => {
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

router.post('/admin/verify/:partnerId', async (req: Request, res: Response) => {
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

router.get('/admin/all', async (req: Request, res: Response) => {
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

router.get('/admin/performance', async (req: Request, res: Response) => {
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

export default router;
