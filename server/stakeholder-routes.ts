import { Router, type Express } from 'express';
import { db } from './db';
import { partners, agents, suppliers, users, customerCareAgents, insertPartnerSchema, insertAgentSchema, insertSupplierSchema } from '@shared/schema';
import { eq, ilike, or, sql, and } from 'drizzle-orm';
import { z } from 'zod';
import { apiResponse } from './utils/responses';

const router = Router();

// Middleware to check if user is admin
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return apiResponse.unauthorized(res, 'Authentication required');
  }

  const userRoles = req.user?.roles || [];
  if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
    return apiResponse.forbidden(res, 'Admin access required');
  }

  next();
};

// ===================================
// STAKEHOLDER STATS ROUTE
// ===================================

// GET /api/admin/stakeholders/stats - Get summary stats for all stakeholder types
router.get('/api/admin/stakeholders/stats', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { lt } = await import('drizzle-orm');

    // Get total counts - use customerCareAgents for agents count to match list endpoint
    const [{ count: clientsTotal }] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [{ count: partnersTotal }] = await db.select({ count: sql<number>`count(*)` }).from(partners);
    const [{ count: agentsTotal }] = await db.select({ count: sql<number>`count(*)` }).from(customerCareAgents);
    const [{ count: suppliersTotal }] = await db.select({ count: sql<number>`count(*)` }).from(suppliers);

    // Get counts from last month for growth calculation (records that existed before oneMonthAgo)
    const [{ count: clientsLastMonth }] = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(lt(users.createdAt, oneMonthAgo));
    
    const [{ count: partnersLastMonth }] = await db.select({ count: sql<number>`count(*)` })
      .from(partners)
      .where(lt(partners.createdAt, oneMonthAgo));
    
    const [{ count: agentsLastMonth }] = await db.select({ count: sql<number>`count(*)` })
      .from(customerCareAgents)
      .where(lt(customerCareAgents.createdAt, oneMonthAgo));
    
    const [{ count: suppliersLastMonth }] = await db.select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(lt(suppliers.createdAt, oneMonthAgo));

    // Calculate growth percentages (new records added in the last month)
    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const stats = {
      clients: {
        total: Number(clientsTotal),
        growth: calculateGrowth(Number(clientsTotal), Number(clientsLastMonth)),
      },
      partners: {
        total: Number(partnersTotal),
        growth: calculateGrowth(Number(partnersTotal), Number(partnersLastMonth)),
      },
      agents: {
        total: Number(agentsTotal),
        growth: calculateGrowth(Number(agentsTotal), Number(agentsLastMonth)),
      },
      suppliers: {
        total: Number(suppliersTotal),
        growth: calculateGrowth(Number(suppliersTotal), Number(suppliersLastMonth)),
      },
    };

    return apiResponse.success(res, stats);
  } catch (error: any) {
    console.error('Error fetching stakeholder stats:', error);
    return apiResponse.error(res, 'Failed to fetch stakeholder stats', 500, error.message);
  }
});

// ===================================
// PARTNER ROUTES
// ===================================

// Use shared insert schemas with password requirement for creation
const createPartnerSchema = insertPartnerSchema.extend({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const updatePartnerSchema = insertPartnerSchema.partial().extend({
  password: z.string().min(8).optional().nullable(),
});

// GET /api/admin/partners - List all partners with pagination and search
router.get('/api/admin/partners', requireAdmin, async (req, res) => {
  try {
    const { search, status, partnerType, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (search && typeof search === 'string') {
      conditions.push(
        or(
          ilike(partners.companyName, `%${search}%`),
          ilike(partners.contactEmail, `%${search}%`),
          ilike(partners.contactPhone, `%${search}%`)
        )
      );
    }

    if (status === 'active') {
      conditions.push(eq(partners.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(partners.isActive, false));
    }

    if (partnerType && typeof partnerType === 'string') {
      conditions.push(eq(partners.partnerType, partnerType));
    }

    const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

    const countQuery = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(partners).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(partners);
    
    const [{ count: totalCount }] = await countQuery;

    const query = db.select({
      id: partners.id,
      companyName: partners.companyName,
      contactEmail: partners.contactEmail,
      contactPhone: partners.contactPhone,
      partnerType: partners.partnerType,
      commissionRate: partners.commissionRate,
      isActive: partners.isActive,
      totalClientsReferred: partners.totalClientsReferred,
      totalCommissionsEarned: partners.totalCommissionsEarned,
      createdAt: partners.createdAt,
    }).from(partners);

    const results = whereClause
      ? await query.where(whereClause).limit(limitNum).offset(offset).orderBy(sql`${partners.createdAt} DESC`)
      : await query.limit(limitNum).offset(offset).orderBy(sql`${partners.createdAt} DESC`);

    const data = results.map((partner) => ({
      ...partner,
      status: partner.isActive ? 'active' : 'inactive',
      revenueShare: partner.commissionRate,
    }));

    return apiResponse.success(res, { data, total: totalCount, page: pageNum, limit: limitNum });
  } catch (error: any) {
    console.error('Error fetching partners:', error);
    return apiResponse.error(res, 'Failed to fetch partners', 500, error.message);
  }
});

// GET /api/admin/partners/:id - Get single partner
router.get('/api/admin/partners/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [partner] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);

    if (!partner) {
      return apiResponse.notFound(res, 'Partner not found');
    }

    return apiResponse.success(res, partner);
  } catch (error: any) {
    console.error('Error fetching partner:', error);
    return apiResponse.error(res, 'Failed to fetch partner', 500, error.message);
  }
});

// POST /api/admin/partners - Create new partner
router.post('/api/admin/partners', requireAdmin, async (req, res) => {
  try {
    const validatedData = createPartnerSchema.parse(req.body);

    // Check for duplicate email
    const [existing] = await db.select().from(partners).where(eq(partners.contactEmail, validatedData.contactEmail)).limit(1);
    if (existing) {
      return apiResponse.badRequest(res, 'Partner with this email already exists');
    }

    // Hash password
    const { hashPassword } = await import('./auth');
    const hashedPassword = await hashPassword(validatedData.password);

    const [newPartner] = await db.insert(partners).values({
      ...validatedData,
      password: hashedPassword,
    } as any).returning();

    return apiResponse.created(res, newPartner, 'Partner created successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Validation error', error.issues);
    }
    console.error('Error creating partner:', error);
    return apiResponse.error(res, 'Failed to create partner', 500, error.message);
  }
});

// PATCH /api/admin/partners/:id - Update partner
router.patch('/api/admin/partners/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updatePartnerSchema.parse(req.body);

    const [existing] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
    if (!existing) {
      return apiResponse.notFound(res, 'Partner not found');
    }

    // Check email uniqueness if email is being updated
    if (validatedData.contactEmail && validatedData.contactEmail !== existing.contactEmail) {
      const [duplicate] = await db.select().from(partners).where(eq(partners.contactEmail, validatedData.contactEmail)).limit(1);
      if (duplicate) {
        return apiResponse.badRequest(res, 'Partner with this email already exists');
      }
    }

    const updateData: any = { ...validatedData };

    // Hash password if provided
    if (validatedData.password) {
      const { hashPassword } = await import('./auth');
      updateData.password = await hashPassword(validatedData.password);
    }

    const [updated] = await db.update(partners)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(partners.id, id))
      .returning();

    return apiResponse.success(res, updated, 'Partner updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Validation error', error.issues);
    }
    console.error('Error updating partner:', error);
    return apiResponse.error(res, 'Failed to update partner', 500, error.message);
  }
});

// DELETE /api/admin/partners/:id - Delete partner
router.delete('/api/admin/partners/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
    if (!existing) {
      return apiResponse.notFound(res, 'Partner not found');
    }

    await db.delete(partners).where(eq(partners.id, id));

    return apiResponse.success(res, null, 'Partner deleted successfully');
  } catch (error: any) {
    console.error('Error deleting partner:', error);
    return apiResponse.error(res, 'Failed to delete partner', 500, error.message);
  }
});

// PATCH /api/admin/partners/:id/status - Toggle partner status
router.patch('/api/admin/partners/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [existing] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
    if (!existing) {
      return apiResponse.notFound(res, 'Partner not found');
    }

    const [updated] = await db.update(partners)
      .set({ isActive: status === 'active', updatedAt: new Date() })
      .where(eq(partners.id, id))
      .returning();

    return apiResponse.success(res, updated, 'Partner status updated');
  } catch (error: any) {
    console.error('Error updating partner status:', error);
    return apiResponse.error(res, 'Failed to update partner status', 500, error.message);
  }
});

// ===================================
// AGENT ROUTES
// ===================================

// Validation schemas for Agents
// Use shared insert schemas from shared/schema.ts
const createAgentSchema = insertAgentSchema;
const updateAgentSchema = insertAgentSchema.partial();

// GET /api/admin/agents - List all agents with pagination and search (uses customerCareAgents table)
router.get('/api/admin/agents', requireAdmin, async (req, res) => {
  try {
    const { search, status, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (search && typeof search === 'string') {
      conditions.push(
        or(
          ilike(customerCareAgents.fullName, `%${search}%`),
          ilike(customerCareAgents.email, `%${search}%`),
          ilike(customerCareAgents.phone, `%${search}%`)
        )
      );
    }

    if (status === 'active') {
      conditions.push(eq(customerCareAgents.arnVerificationStatus, 'approved'));
    } else if (status === 'inactive') {
      conditions.push(eq(customerCareAgents.arnVerificationStatus, 'pending'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(customerCareAgents).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(customerCareAgents);
    
    const [{ count: totalCount }] = await countQuery;

    const query = db.select({
      id: customerCareAgents.id,
      fullName: customerCareAgents.fullName,
      email: customerCareAgents.email,
      phone: customerCareAgents.phone,
      employeeId: customerCareAgents.employeeId,
      agentType: customerCareAgents.agentLevel,
      status: customerCareAgents.arnVerificationStatus,
      isActive: sql<boolean>`${customerCareAgents.arnVerificationStatus} = 'approved'`,
      activeClients: sql<number>`0`,
      totalRevenue: sql<string>`'0.00'`,
      commissionSplitModel: customerCareAgents.commissionSplitModel,
      defaultCommissionShare: customerCareAgents.defaultCommissionShare,
      createdAt: customerCareAgents.createdAt,
    }).from(customerCareAgents);

    const results = whereClause
      ? await query.where(whereClause).limit(limitNum).offset(offset).orderBy(sql`${customerCareAgents.createdAt} DESC`)
      : await query.limit(limitNum).offset(offset).orderBy(sql`${customerCareAgents.createdAt} DESC`);

    return apiResponse.success(res, { data: results, total: totalCount, page: pageNum, limit: limitNum });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    return apiResponse.error(res, 'Failed to fetch agents', 500, error.message);
  }
});

// GET /api/admin/agents/:id - Get single agent (uses customerCareAgents table)
router.get('/api/admin/agents/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [agent] = await db.select().from(customerCareAgents).where(eq(customerCareAgents.id, id)).limit(1);

    if (!agent) {
      return apiResponse.notFound(res, 'Agent not found');
    }

    return apiResponse.success(res, agent);
  } catch (error: any) {
    console.error('Error fetching agent:', error);
    return apiResponse.error(res, 'Failed to fetch agent', 500, error.message);
  }
});

// POST /api/admin/agents - Create new agent (uses customerCareAgents table)
router.post('/api/admin/agents', requireAdmin, async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;
    
    if (!fullName || !email) {
      return apiResponse.badRequest(res, 'Full name and email are required');
    }

    // Check for duplicate email
    const [existing] = await db.select().from(customerCareAgents).where(eq(customerCareAgents.email, email)).limit(1);
    if (existing) {
      return apiResponse.badRequest(res, 'Agent with this email already exists');
    }

    const [newAgent] = await db.insert(customerCareAgents).values({
      fullName,
      email,
      phone: phone || null,
      arnVerificationStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any).returning();

    return apiResponse.created(res, newAgent, 'Agent created successfully');
  } catch (error: any) {
    console.error('Error creating agent:', error);
    return apiResponse.error(res, 'Failed to create agent', 500, error.message);
  }
});

// PATCH /api/admin/agents/:id - Update agent (uses customerCareAgents table)
router.patch('/api/admin/agents/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, commissionSplitModel, defaultCommissionShare } = req.body;

    const [existing] = await db.select().from(customerCareAgents).where(eq(customerCareAgents.id, id)).limit(1);
    if (!existing) {
      return apiResponse.notFound(res, 'Agent not found');
    }

    // Check email uniqueness if email is being updated
    if (email && email !== existing.email) {
      const [duplicate] = await db.select().from(customerCareAgents).where(eq(customerCareAgents.email, email)).limit(1);
      if (duplicate) {
        return apiResponse.badRequest(res, 'Agent with this email already exists');
      }
    }

    // Validate commission share percentage if provided and not null
    if (defaultCommissionShare !== undefined && defaultCommissionShare !== null) {
      const shareValue = parseFloat(defaultCommissionShare);
      if (isNaN(shareValue) || shareValue < 0 || shareValue > 100) {
        return apiResponse.badRequest(res, 'Commission share must be between 0 and 100');
      }
    }

    const updateData: any = { updatedAt: new Date() };
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (commissionSplitModel !== undefined) updateData.commissionSplitModel = commissionSplitModel;
    // Allow setting commission share to null (for standard model) or a specific value (for custom model)
    if (defaultCommissionShare !== undefined) updateData.defaultCommissionShare = defaultCommissionShare;

    const [updated] = await db.update(customerCareAgents)
      .set(updateData)
      .where(eq(customerCareAgents.id, id))
      .returning();

    return apiResponse.success(res, updated, 'Agent updated successfully');
  } catch (error: any) {
    console.error('Error updating agent:', error);
    return apiResponse.error(res, 'Failed to update agent', 500, error.message);
  }
});

// DELETE /api/admin/agents/:id - Delete agent (uses customerCareAgents table)
router.delete('/api/admin/agents/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.select().from(customerCareAgents).where(eq(customerCareAgents.id, id)).limit(1);
    if (!existing) {
      return apiResponse.notFound(res, 'Agent not found');
    }

    await db.delete(customerCareAgents).where(eq(customerCareAgents.id, id));

    return apiResponse.success(res, null, 'Agent deleted successfully');
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    return apiResponse.error(res, 'Failed to delete agent', 500, error.message);
  }
});

// PATCH /api/admin/agents/:id/status - Toggle agent status (uses customerCareAgents table)
router.patch('/api/admin/agents/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [existing] = await db.select().from(customerCareAgents).where(eq(customerCareAgents.id, id)).limit(1);
    if (!existing) {
      return apiResponse.notFound(res, 'Agent not found');
    }

    // Map status to verificationStatus for customerCareAgents table
    const verificationStatus = status === 'active' ? 'approved' : 'pending';

    const [updated] = await db.update(customerCareAgents)
      .set({ 
        arnVerificationStatus: verificationStatus,
        updatedAt: new Date() 
      })
      .where(eq(customerCareAgents.id, id))
      .returning();

    return apiResponse.success(res, updated, 'Agent status updated');
  } catch (error: any) {
    console.error('Error updating agent status:', error);
    return apiResponse.error(res, 'Failed to update agent status', 500, error.message);
  }
});

// ===================================
// SUPPLIER ROUTES
// ===================================

// Validation schemas for Suppliers
// Use shared insert schemas from shared/schema.ts
const createSupplierSchema = insertSupplierSchema;
const updateSupplierSchema = insertSupplierSchema.partial();

// GET /api/admin/suppliers - List all suppliers with pagination and search
router.get('/api/admin/suppliers', requireAdmin, async (req, res) => {
  try {
    const { search, status, category, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (search && typeof search === 'string') {
      conditions.push(
        or(
          ilike(suppliers.name, `%${search}%`),
          ilike(suppliers.contactEmail, `%${search}%`),
          ilike(suppliers.contactPhone, `%${search}%`)
        )
      );
    }

    if (status === 'active') {
      conditions.push(eq(suppliers.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(suppliers.isActive, false));
    }

    if (category && typeof category === 'string') {
      conditions.push(sql`${category} = ANY(${suppliers.productCategories})`);
    }

    const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

    const countQuery = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(suppliers).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(suppliers);
    
    const [{ count: totalCount }] = await countQuery;

    const query = db.select().from(suppliers);

    const results = whereClause
      ? await query.where(whereClause).limit(limitNum).offset(offset).orderBy(sql`${suppliers.createdAt} DESC`)
      : await query.limit(limitNum).offset(offset).orderBy(sql`${suppliers.createdAt} DESC`);

    const data = results.map((supplier) => ({
      ...supplier,
      status: supplier.isActive ? 'active' : 'inactive',
      contactPerson: null, // Can be added to schema if needed
    }));

    return apiResponse.success(res, { data, total: totalCount, page: pageNum, limit: limitNum });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return apiResponse.error(res, 'Failed to fetch suppliers', 500, error.message);
  }
});

// GET /api/admin/suppliers/:id - Get single supplier
router.get('/api/admin/suppliers/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);

    if (!supplier) {
      return apiResponse.notFound(res, 'Supplier not found');
    }

    return apiResponse.success(res, supplier);
  } catch (error: any) {
    console.error('Error fetching supplier:', error);
    return apiResponse.error(res, 'Failed to fetch supplier', 500, error.message);
  }
});

// POST /api/admin/suppliers - Create new supplier
router.post('/api/admin/suppliers', requireAdmin, async (req, res) => {
  try {
    const validatedData = createSupplierSchema.parse(req.body);

    const [newSupplier] = await db.insert(suppliers).values(validatedData).returning();

    return apiResponse.created(res, newSupplier, 'Supplier created successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Validation error', error.issues);
    }
    console.error('Error creating supplier:', error);
    return apiResponse.error(res, 'Failed to create supplier', 500, error.message);
  }
});

// PATCH /api/admin/suppliers/:id - Update supplier
router.patch('/api/admin/suppliers/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateSupplierSchema.parse(req.body);

    const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!existing) {
      return apiResponse.notFound(res, 'Supplier not found');
    }

    const [updated] = await db.update(suppliers)
      .set({ ...validatedData, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();

    return apiResponse.success(res, updated, 'Supplier updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Validation error', error.issues);
    }
    console.error('Error updating supplier:', error);
    return apiResponse.error(res, 'Failed to update supplier', 500, error.message);
  }
});

// DELETE /api/admin/suppliers/:id - Delete supplier
router.delete('/api/admin/suppliers/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!existing) {
      return apiResponse.notFound(res, 'Supplier not found');
    }

    await db.delete(suppliers).where(eq(suppliers.id, id));

    return apiResponse.success(res, null, 'Supplier deleted successfully');
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    return apiResponse.error(res, 'Failed to delete supplier', 500, error.message);
  }
});

// PATCH /api/admin/suppliers/:id/status - Toggle supplier status
router.patch('/api/admin/suppliers/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!existing) {
      return apiResponse.notFound(res, 'Supplier not found');
    }

    const [updated] = await db.update(suppliers)
      .set({ isActive: status === 'active', updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();

    return apiResponse.success(res, updated, 'Supplier status updated');
  } catch (error: any) {
    console.error('Error updating supplier status:', error);
    return apiResponse.error(res, 'Failed to update supplier status', 500, error.message);
  }
});

export function registerStakeholderRoutes(app: Express) {
  app.use(router);
  console.log('✅ Stakeholder routes registered');
}
