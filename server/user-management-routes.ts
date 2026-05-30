import { Router, type Express } from 'express';
import { db } from './db';
import { users } from '@shared/schema';
import { eq, ilike, or, sql, inArray } from 'drizzle-orm';
import { hashPassword } from './auth';
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

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email().optional().nullable(),
  mobile: z.string().min(10).optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  roles: z.array(z.string()).default(['user']),
  isActive: z.boolean().default(true),
  panNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  agentId: z.string().optional().nullable(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional().nullable(),
  mobile: z.string().min(10).optional().nullable(),
  password: z.string().min(8).optional().nullable(), // Optional for updates
  firstName: z.string().min(1).optional(),
  middleName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  roles: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  panNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  agentId: z.string().optional().nullable(),
});

// GET /api/admin/users - List all users with pagination and search
router.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { search, role, status, page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Build filter conditions
    const conditions = [];

    // Add search filter
    if (search && typeof search === 'string') {
      conditions.push(
        or(
          ilike(users.userId, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.mobile, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.panNumber, `%${search}%`)
        )
      );
    }

    // Add role filter
    if (role && typeof role === 'string') {
      conditions.push(sql`${role} = ANY(${users.roles})`);
    }

    // Add status filter
    if (status === 'active') {
      conditions.push(eq(users.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    }

    // Combine all conditions
    const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

    // Get total count with filters applied
    const countQuery = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(users);
    
    const [{ count: totalCount }] = await countQuery;

    // Get paginated results with filters applied, including agent name via subquery
    const query = db.select({
      id: users.id,
      userId: users.userId,
      email: users.email,
      mobile: users.mobile,
      firstName: users.firstName,
      middleName: users.middleName,
      lastName: users.lastName,
      roles: users.roles,
      isActive: users.isActive,
      panNumber: users.panNumber,
      dateOfBirth: users.dateOfBirth,
      agentId: users.agentId,
      lastLoginAt: users.lastLoginAt,
      loginCount: users.loginCount,
      createdAt: users.createdAt,
      isEmailVerified: users.isEmailVerified,
      isMobileVerified: users.isMobileVerified,
    }).from(users);

    const rawResults = whereClause
      ? await query.where(whereClause).limit(limitNum).offset(offset).orderBy(sql`${users.createdAt} DESC`)
      : await query.limit(limitNum).offset(offset).orderBy(sql`${users.createdAt} DESC`);

    // Fetch agent names for users that have agentId (using safe parameterized query)
    const agentIds = [...new Set(rawResults.filter(u => u.agentId).map(u => u.agentId as string))];
    let agentMap: Record<string, string> = {};
    if (agentIds.length > 0) {
      const agents = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      }).from(users).where(inArray(users.id, agentIds));
      
      agentMap = agents.reduce((acc, agent) => {
        const name = [agent.firstName, agent.lastName].filter(Boolean).join(' ') || agent.email || 'Unknown';
        acc[agent.id] = name;
        return acc;
      }, {} as Record<string, string>);
    }

    // Add fullName and agentName to results
    const results = rawResults.map(user => ({
      ...user,
      fullName: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ') || user.email || 'Unknown',
      status: user.isActive ? 'active' : 'inactive',
      agentName: user.agentId ? agentMap[user.agentId] || null : null,
    }));

    res.json({
      users: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(totalCount),
        totalPages: Math.ceil(Number(totalCount) / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return apiResponse.serverError(res, 'Failed to fetch users');
  }
});

// GET /api/admin/users/:id - Get single user
router.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [user] = await db
      .select({
        id: users.id,
        userId: users.userId,
        email: users.email,
        mobile: users.mobile,
        firstName: users.firstName,
        middleName: users.middleName,
        lastName: users.lastName,
        roles: users.roles,
        isActive: users.isActive,
        panNumber: users.panNumber,
        dateOfBirth: users.dateOfBirth,
        agentId: users.agentId,
        lastLoginAt: users.lastLoginAt,
        loginCount: users.loginCount,
        createdAt: users.createdAt,
        isEmailVerified: users.isEmailVerified,
        isMobileVerified: users.isMobileVerified,
        address: users.address,
        city: users.city,
        state: users.state,
        pincode: users.pincode,
        occupation: users.occupation,
      })
      .from(users)
      .where(eq(users.id, id));

    if (!user) {
      return apiResponse.notFound(res, 'User not found');
    }

    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return apiResponse.serverError(res, 'Failed to fetch user');
  }
});

// POST /api/admin/users - Create new user
router.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const validatedData = createUserSchema.parse(req.body);

    // Check if email or mobile already exists (if provided)
    if (validatedData.email) {
      const [existingEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, validatedData.email))
        .limit(1);

      if (existingEmail) {
        return apiResponse.badRequest(res, 'Email already registered');
      }
    }

    if (validatedData.mobile) {
      const [existingMobile] = await db
        .select()
        .from(users)
        .where(eq(users.mobile, validatedData.mobile))
        .limit(1);

      if (existingMobile) {
        return apiResponse.badRequest(res, 'Mobile number already registered');
      }
    }

    // Check PAN if provided
    if (validatedData.panNumber) {
      const [existingPan] = await db
        .select()
        .from(users)
        .where(eq(users.panNumber, validatedData.panNumber))
        .limit(1);

      if (existingPan) {
        return apiResponse.badRequest(res, 'PAN already registered');
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Generate unique userId
    const prefix = 'FTP';
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const generatedUserId = `${prefix}${randomNum}`;

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        userId: generatedUserId,
        email: validatedData.email,
        mobile: validatedData.mobile,
        password: hashedPassword,
        firstName: validatedData.firstName,
        middleName: validatedData.middleName,
        lastName: validatedData.lastName,
        roles: validatedData.roles,
        isActive: validatedData.isActive,
        panNumber: validatedData.panNumber,
        dateOfBirth: validatedData.dateOfBirth,
        agentId: validatedData.agentId,
      })
      .returning({
        id: users.id,
        userId: users.userId,
        email: users.email,
        mobile: users.mobile,
        firstName: users.firstName,
        middleName: users.middleName,
        lastName: users.lastName,
        roles: users.roles,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    res.status(201).json(newUser);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    console.error('Error creating user:', error);
    return apiResponse.serverError(res, 'Failed to create user');
  }
});

// PATCH /api/admin/users/:id - Update user
router.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existingUser) {
      return apiResponse.notFound(res, 'User not found');
    }

    // Prepare update data
    const updateData: any = {};

    if (validatedData.email !== undefined) updateData.email = validatedData.email;
    if (validatedData.mobile !== undefined) updateData.mobile = validatedData.mobile;
    if (validatedData.firstName !== undefined) updateData.firstName = validatedData.firstName;
    if (validatedData.middleName !== undefined) updateData.middleName = validatedData.middleName;
    if (validatedData.lastName !== undefined) updateData.lastName = validatedData.lastName;
    if (validatedData.roles !== undefined) updateData.roles = validatedData.roles;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.panNumber !== undefined) updateData.panNumber = validatedData.panNumber;
    if (validatedData.dateOfBirth !== undefined) updateData.dateOfBirth = validatedData.dateOfBirth;
    if (validatedData.agentId !== undefined) updateData.agentId = validatedData.agentId;

    // Hash password if provided
    if (validatedData.password) {
      updateData.password = await hashPassword(validatedData.password);
    }

    updateData.updatedAt = new Date();

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        userId: users.userId,
        email: users.email,
        mobile: users.mobile,
        firstName: users.firstName,
        middleName: users.middleName,
        lastName: users.lastName,
        roles: users.roles,
        isActive: users.isActive,
        updatedAt: users.updatedAt,
      });

    res.json(updatedUser);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    console.error('Error updating user:', error);
    return apiResponse.serverError(res, 'Failed to update user');
  }
});

// DELETE /api/admin/users/:id - Delete user (soft delete by setting isActive = false)
router.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existingUser) {
      return apiResponse.notFound(res, 'User not found');
    }

    // Prevent deleting yourself
    if (req.user?.id === id) {
      return apiResponse.badRequest(res, 'Cannot delete your own account');
    }

    if (permanent === 'true') {
      // Permanent deletion (use with caution)
      await db.delete(users).where(eq(users.id, id));
      res.json({ message: 'User permanently deleted' });
    } else {
      // Soft delete - just deactivate
      await db
        .update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, id));
      
      res.json({ message: 'User deactivated successfully' });
    }
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return apiResponse.serverError(res, 'Failed to delete user');
  }
});

// POST /api/admin/users/batch-activate - Batch activate users
router.post('/api/admin/users/batch-activate', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return apiResponse.badRequest(res, 'No user IDs provided');
    }

    const results = { success: [] as string[], failed: [] as string[] };

    for (const id of ids) {
      try {
        if (id === req.user?.id) {
          results.failed.push(id);
          continue;
        }
        const [updated] = await db
          .update(users)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning({ id: users.id });
        
        if (updated) {
          results.success.push(id);
        } else {
          results.failed.push(id);
        }
      } catch (err) {
        results.failed.push(id);
      }
    }

    const allFailed = results.success.length === 0;
    res.status(allFailed ? 400 : 200).json({
      success: !allFailed,
      message: allFailed 
        ? 'All users failed to activate' 
        : `Activated ${results.success.length} users${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}`,
      results
    });
  } catch (error: any) {
    console.error('Error batch activating users:', error);
    return apiResponse.serverError(res, 'Failed to batch activate users');
  }
});

// POST /api/admin/users/batch-suspend - Batch suspend/deactivate users
router.post('/api/admin/users/batch-suspend', requireAdmin, async (req, res) => {
  try {
    const { ids, reason } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return apiResponse.badRequest(res, 'No user IDs provided');
    }

    const results = { success: [] as string[], failed: [] as string[] };

    for (const id of ids) {
      try {
        if (id === req.user?.id) {
          results.failed.push(id);
          continue;
        }
        const [updated] = await db
          .update(users)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning({ id: users.id });
        
        if (updated) {
          results.success.push(id);
        } else {
          results.failed.push(id);
        }
      } catch (err) {
        results.failed.push(id);
      }
    }

    const allFailed = results.success.length === 0;
    res.status(allFailed ? 400 : 200).json({
      success: !allFailed,
      message: allFailed 
        ? 'All users failed to suspend' 
        : `Suspended ${results.success.length} users${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}`,
      results,
      reason: reason || 'Bulk suspension via admin console'
    });
  } catch (error: any) {
    console.error('Error batch suspending users:', error);
    return apiResponse.serverError(res, 'Failed to batch suspend users');
  }
});

// POST /api/admin/users/batch-export - Export selected users
router.post('/api/admin/users/batch-export', requireAdmin, async (req, res) => {
  try {
    const { ids, format = 'json' } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return apiResponse.badRequest(res, 'No user IDs provided');
    }

    const selectedUsers = await db
      .select({
        id: users.id,
        userId: users.userId,
        email: users.email,
        mobile: users.mobile,
        firstName: users.firstName,
        lastName: users.lastName,
        roles: users.roles,
        isActive: users.isActive,
        panNumber: users.panNumber,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(sql`${users.id} = ANY(${ids})`);

    if (format === 'csv') {
      const headers = ['User ID', 'First Name', 'Last Name', 'Email', 'Mobile', 'PAN', 'Roles', 'Status', 'Created At', 'Last Login'];
      const rows = selectedUsers.map((u) => [
        u.userId || 'N/A',
        u.firstName || 'N/A',
        u.lastName || 'N/A',
        u.email || 'N/A',
        u.mobile || 'N/A',
        u.panNumber || 'N/A',
        (u.roles || []).join(';'),
        u.isActive ? 'Active' : 'Inactive',
        u.createdAt || 'N/A',
        u.lastLoginAt || 'Never'
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: selectedUsers,
      count: selectedUsers.length
    });
  } catch (error: any) {
    console.error('Error batch exporting users:', error);
    return apiResponse.serverError(res, 'Failed to export users');
  }
});

// GET /api/admin/users/stats - Get user statistics
router.get('/api/admin/users-stats', requireAdmin, async (req, res) => {
  try {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const [activeResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isActive, true));

    const [adminResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`'admin' = ANY(${users.roles}) OR 'superadmin' = ANY(${users.roles})`);

    const [agentResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`'agent' = ANY(${users.roles})`);

    const [clientResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`'user' = ANY(${users.roles})`);

    res.json({
      total: Number(totalResult.count),
      active: Number(activeResult.count),
      inactive: Number(totalResult.count) - Number(activeResult.count),
      admins: Number(adminResult.count),
      agents: Number(agentResult.count),
      clients: Number(clientResult.count),
    });
  } catch (error: any) {
    console.error('Error fetching user stats:', error);
    return apiResponse.serverError(res, 'Failed to fetch user statistics');
  }
});

export function registerUserManagementRoutes(app: Express) {
  app.use(router);
  console.log('✅ User Management routes registered');
}
