import { storage } from "./storage";
import { type User, type UserActivity, type InsertUserActivity, type InsertUserNotification } from "@shared/schema";

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalLogins: number;
  avgSessionTime: number;
}

export interface ActivityMetrics {
  pageViews: number;
  apiCalls: number;
  trades: number;
  portfolioViews: number;
  topActions: Array<{ action: string; count: number }>;
}

export interface PlatformInsights {
  userGrowth: Array<{ date: string; count: number }>;
  popularFeatures: Array<{ feature: string; usage: number }>;
  userEngagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
  };
  systemHealth: {
    uptime: string;
    errorRate: number;
    responseTime: number;
  };
}

class AdminService {
  private activities: Map<string, UserActivity> = new Map();
  private systemStartTime = Date.now();

  // Track user activity
  async logActivity(activity: Omit<InsertUserActivity, 'id' | 'createdAt'>) {
    const activityRecord: UserActivity = {
      id: `activity-${Date.now()}-${Math.random()}`,
      userId: activity.userId || null,
      action: activity.action,
      resource: activity.resource || null,
      details: activity.details || null,
      ipAddress: activity.ipAddress || null,
      userAgent: activity.userAgent || null,
      createdAt: new Date()
    };
    
    this.activities.set(activityRecord.id, activityRecord);
    
    // Keep only last 10000 activities in memory for performance
    if (this.activities.size > 10000) {
      const oldestKey = this.activities.keys().next().value;
      if (oldestKey) {
        this.activities.delete(oldestKey);
      }
    }
    
    console.log(`📊 User Activity: ${activity.userId} - ${activity.action} ${activity.resource || ''}`);
    return activityRecord;
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    const allUsers = await storage.getAllUsers();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const newUsersToday = allUsers.filter(user => 
      user.createdAt && new Date(user.createdAt) >= todayStart
    ).length;

    const activeUsers = allUsers.filter(user => 
      user.isActive && user.lastLoginAt && 
      (now.getTime() - new Date(user.lastLoginAt).getTime()) < (7 * 24 * 60 * 60 * 1000) // Last 7 days
    ).length;

    const totalLogins = allUsers.reduce((sum, user) => sum + (user.loginCount || 0), 0);

    return {
      totalUsers: allUsers.length,
      activeUsers,
      newUsersToday,
      totalLogins,
      avgSessionTime: 25 // minutes (simulated)
    };
  }

  // Get activity metrics
  async getActivityMetrics(): Promise<ActivityMetrics> {
    const activities = Array.from(this.activities.values());
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const recentActivities = activities.filter(a => 
      a.createdAt && new Date(a.createdAt).getTime() > last24h
    );

    const actionCounts = recentActivities.reduce((acc, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topActions = Object.entries(actionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    return {
      pageViews: actionCounts['page_view'] || 0,
      apiCalls: actionCounts['api_call'] || 0,
      trades: actionCounts['trade'] || 0,
      portfolioViews: actionCounts['portfolio_view'] || 0,
      topActions
    };
  }

  // Get platform insights
  async getPlatformInsights(): Promise<PlatformInsights> {
    const allUsers = await storage.getAllUsers();
    const activities = Array.from(this.activities.values());
    
    // User growth over last 30 days
    const userGrowth = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const count = allUsers.filter(user => 
        user.createdAt && new Date(user.createdAt) >= dayStart && new Date(user.createdAt) < dayEnd
      ).length;
      
      userGrowth.push({
        date: dayStart.toISOString().split('T')[0],
        count
      });
    }

    // Popular features based on activity
    const featureCounts = activities.reduce((acc, activity) => {
      const feature = activity.resource || activity.action;
      acc[feature] = (acc[feature] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const popularFeatures = Object.entries(featureCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([feature, usage]) => ({ feature, usage }));

    // Active users metrics
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);

    const dailyActiveUsers = new Set(
      activities
        .filter(a => a.createdAt && new Date(a.createdAt).getTime() > dayAgo)
        .map(a => a.userId)
        .filter(Boolean)
    ).size;

    const weeklyActiveUsers = new Set(
      activities
        .filter(a => a.createdAt && new Date(a.createdAt).getTime() > weekAgo)
        .map(a => a.userId)
        .filter(Boolean)
    ).size;

    const monthlyActiveUsers = new Set(
      activities
        .filter(a => a.createdAt && new Date(a.createdAt).getTime() > monthAgo)
        .map(a => a.userId)
        .filter(Boolean)
    ).size;

    const uptime = Math.floor((Date.now() - this.systemStartTime) / 1000);
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

    return {
      userGrowth,
      popularFeatures,
      userEngagement: {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers
      },
      systemHealth: {
        uptime: uptimeFormatted,
        errorRate: 0.2, // 0.2% error rate
        responseTime: 150 // ms average
      }
    };
  }

  // Send guidance message to user
  async sendUserGuidance(
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'warning' | 'guidance' | 'alert' = 'guidance',
    actionUrl?: string,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    const notification: InsertUserNotification = {
      userId,
      type,
      title,
      message,
      actionUrl,
      priority,
      createdBy: 'admin-system', // System generated
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    // In a real implementation, this would save to database
    console.log(`📬 Sending ${type} to user ${userId}: ${title}`);
    
    // Also send via WhatsApp if it's critical
    if (priority === 'critical' || priority === 'high') {
      const { whatsappService } = await import('./whatsapp');
      const user = await storage.getUser(userId);
      if (user?.mobile) {
        await whatsappService.sendMessage(user.mobile, `🔔 ${title}\n\n${message}`);
      }
    }
  }

  // Update user login tracking
  async updateUserLoginStats(userId: string, ipAddress?: string, userAgent?: string) {
    const user = await storage.getUser(userId);
    if (user) {
      // Update login count and last login time
      user.loginCount = (user.loginCount || 0) + 1;
      user.lastLoginAt = new Date();
      
      // Log the login activity
      await this.logActivity({
        userId,
        action: 'login',
        ipAddress,
        userAgent,
        details: { timestamp: Date.now() }
      });

      console.log(`🔑 User ${userId} logged in (${user.loginCount} total logins)`);
    }
  }

  // Get user activity history
  async getUserActivityHistory(userId: string, limit: number = 50): Promise<UserActivity[]> {
    const userActivities = Array.from(this.activities.values())
      .filter(activity => activity.userId === userId)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);

    return userActivities;
  }

  // Get all users with admin filtering/sorting
  async getUsers(
    page: number = 1,
    limit: number = 50,
    sortBy: 'createdAt' | 'loginCount' | 'lastLoginAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    filter?: {
      role?: string;
      isActive?: boolean;
      searchTerm?: string;
    }
  ) {
    let users = await storage.getAllUsers();

    // Apply filters
    if (filter) {
      if (filter.role) {
        users = users.filter(user => user.roles?.includes(filter.role || ''));
      }
      if (filter.isActive !== undefined) {
        users = users.filter(user => user.isActive === filter.isActive);
      }
      if (filter.searchTerm) {
        const searchTerm = filter.searchTerm.toLowerCase();
        users = users.filter(user => 
          user.email?.toLowerCase().includes(searchTerm) ||
          user.firstName?.toLowerCase().includes(searchTerm) ||
          user.lastName?.toLowerCase().includes(searchTerm) ||
          user.mobile?.includes(searchTerm)
        );
      }
    }

    // Sort users
    users.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (!aVal) return 1;
      if (!bVal) return -1;
      
      let comparison = 0;
      if (sortBy === 'createdAt' || sortBy === 'lastLoginAt') {
        const aTime = aVal ? new Date(aVal as Date).getTime() : 0;
        const bTime = bVal ? new Date(bVal as Date).getTime() : 0;
        comparison = aTime - bTime;
      } else {
        comparison = (aVal as number) - (bVal as number);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedUsers = users.slice(startIndex, startIndex + limit);

    return {
      users: paginatedUsers,
      total: users.length,
      page,
      limit,
      totalPages: Math.ceil(users.length / limit)
    };
  }

  // Check if user is admin
  async isAdmin(userId: string): Promise<boolean> {
    const user = await storage.getUser(userId);
    return user?.roles?.includes('admin') || user?.roles?.includes('super_admin') || false;
  }

  // Check if user is super admin
  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await storage.getUser(userId);
    return user?.roles?.includes('super_admin') || false;
  }
}

export const adminService = new AdminService();