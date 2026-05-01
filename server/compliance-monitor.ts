import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { immutableAuditLogs } from "@shared/schema";
import { sql, desc } from "drizzle-orm";
import * as crypto from "crypto";

export interface ComplianceEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  eventType: 'login' | 'data_access' | 'consent_change' | 'profile_update' | 'transaction' | 'export_data' | 'delete_data' | 'admin_action' | 'security_violation';
  action: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  outcome: 'success' | 'failure' | 'blocked';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  alertType: 'multiple_failed_logins' | 'suspicious_ip' | 'data_breach_attempt' | 'unauthorized_access' | 'compliance_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress?: string;
  description: string;
  resolved: boolean;
}

class ComplianceMonitor {
  private events: ComplianceEvent[] = [];
  private alerts: SecurityAlert[] = [];
  private loginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();
  private ipTracking: Map<string, { requests: number; firstSeen: Date; flagged: boolean }> = new Map();
  private lastChecksum: string | null = null;

  constructor() {
    // Clean up old events every hour
    setInterval(() => {
      this.cleanupOldEvents();
    }, 3600000); // 1 hour
  }

  async logEvent(event: Omit<ComplianceEvent, 'id' | 'timestamp'>): Promise<string> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const complianceEvent: ComplianceEvent = {
      id: eventId,
      timestamp: new Date(),
      ...event
    };

    // Keep in memory for quick reports, but prioritize database
    this.events.push(complianceEvent);

    // Calculate checksum for immutability
    if (!this.lastChecksum) {
      const lastEntry = await db.select({ checksum: immutableAuditLogs.checksum })
        .from(immutableAuditLogs)
        .orderBy(desc(immutableAuditLogs.timestamp))
        .limit(1);
      this.lastChecksum = lastEntry[0]?.checksum || '0'.repeat(64);
    }

    const eventContent = JSON.stringify({
      eventType: complianceEvent.eventType,
      action: complianceEvent.action,
      userId: complianceEvent.userId,
      timestamp: complianceEvent.timestamp.toISOString(),
      details: complianceEvent.details
    });

    const currentChecksum = crypto.createHash('sha256')
      .update(eventContent + this.lastChecksum)
      .digest('hex');

    try {
      await db.insert(immutableAuditLogs).values({
        eventType: complianceEvent.eventType,
        action: complianceEvent.action,
        userId: complianceEvent.userId,
        metadata: complianceEvent.details || {},
        checksum: currentChecksum,
        previousChecksum: this.lastChecksum,
        entityType: complianceEvent.resource
      });
      this.lastChecksum = currentChecksum;
    } catch (error) {
      console.error('[COMPLIANCE] Failed to persist audit log:', error);
    }

    // Analyze event for security concerns
    this.analyzeEvent(complianceEvent);

    // Keep only last 10000 events for memory management
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }

    if (complianceEvent.riskLevel !== 'low' || process.env.NODE_ENV !== 'production') {
      console.log(`[COMPLIANCE] ${complianceEvent.eventType}: ${complianceEvent.action}`, {
        userId: complianceEvent.userId,
        outcome: complianceEvent.outcome,
        riskLevel: complianceEvent.riskLevel
      });
    }

    return eventId;
  }

  async logSuspiciousActivity(activity: {
    userId: string;
    activityType: string;
    details: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: any;
  }): Promise<string> {
    return this.logEvent({
      userId: activity.userId,
      eventType: 'security_violation',
      action: activity.activityType,
      outcome: 'success', // The logging itself is a success
      riskLevel: activity.severity,
      details: {
        note: activity.details,
        ...activity.metadata
      }
    });
  }

  async logComplianceAudit(audit: {
    userId: string;
    action: string;
    outcome: 'success' | 'failure';
    details: string;
    metadata?: any;
  }): Promise<string> {
    return this.logEvent({
      userId: audit.userId,
      eventType: 'admin_action',
      action: audit.action,
      outcome: audit.outcome,
      riskLevel: audit.outcome === 'failure' ? 'medium' : 'low',
      details: {
        note: audit.details,
        ...audit.metadata
      }
    });
  }

  private analyzeEvent(event: ComplianceEvent) {
    // Track failed login attempts
    if (event.eventType === 'login' && event.outcome === 'failure' && event.ipAddress) {
      this.trackFailedLogin(event.ipAddress, event.userId);
    }

    // Track suspicious IP behavior
    if (event.ipAddress) {
      this.trackIpActivity(event.ipAddress);
    }

    // Detect high-risk activities
    if (event.riskLevel === 'critical' || event.riskLevel === 'high') {
      this.createAlert({
        alertType: event.eventType === 'login' ? 'unauthorized_access' : 'compliance_violation',
        severity: event.riskLevel,
        userId: event.userId,
        ipAddress: event.ipAddress,
        description: `High-risk ${event.eventType} detected: ${event.action}`,
        resolved: false
      });
    }
  }

  private trackFailedLogin(ipAddress: string, userId?: string) {
    const key = `${ipAddress}:${userId || 'unknown'}`;
    const existing = this.loginAttempts.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastAttempt = new Date();
      
      // Alert on multiple failed attempts
      if (existing.count >= 5) {
        this.createAlert({
          alertType: 'multiple_failed_logins',
          severity: 'high',
          userId,
          ipAddress,
          description: `${existing.count} failed login attempts from ${ipAddress}`,
          resolved: false
        });
      }
    } else {
      this.loginAttempts.set(key, { count: 1, lastAttempt: new Date() });
    }
  }

  private trackIpActivity(ipAddress: string) {
    const existing = this.ipTracking.get(ipAddress);
    
    if (existing) {
      existing.requests++;
      
      // Flag suspicious IPs with high request volume
      if (existing.requests > 1000 && !existing.flagged) {
        existing.flagged = true;
        this.createAlert({
          alertType: 'suspicious_ip',
          severity: 'medium',
          ipAddress,
          description: `High request volume from IP: ${ipAddress} (${existing.requests} requests)`,
          resolved: false
        });
      }
    } else {
      this.ipTracking.set(ipAddress, { 
        requests: 1, 
        firstSeen: new Date(), 
        flagged: false 
      });
    }
  }

  private createAlert(alert: Omit<SecurityAlert, 'id' | 'timestamp'>): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const securityAlert: SecurityAlert = {
      id: alertId,
      timestamp: new Date(),
      ...alert
    };

    this.alerts.push(securityAlert);

    console.warn(`[SECURITY ALERT] ${securityAlert.alertType}: ${securityAlert.description}`, {
      severity: securityAlert.severity,
      userId: securityAlert.userId,
      ipAddress: securityAlert.ipAddress
    });

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    return alertId;
  }

  private cleanupOldEvents() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Clean old login attempts
    Array.from(this.loginAttempts.entries()).forEach(([key, attempt]) => {
      if (attempt.lastAttempt < oneDayAgo) {
        this.loginAttempts.delete(key);
      }
    });

    // Clean old IP tracking
    Array.from(this.ipTracking.entries()).forEach(([ip, tracking]) => {
      if (tracking.firstSeen < oneDayAgo) {
        this.ipTracking.delete(ip);
      }
    });

    console.log(`[COMPLIANCE] Cleaned up old tracking data`);
  }

  // Compliance reporting methods
  getEvents(filters?: {
    userId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    riskLevel?: string;
  }): ComplianceEvent[] {
    let filteredEvents = [...this.events];

    if (filters) {
      if (filters.userId) {
        filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
      }
      if (filters.eventType) {
        filteredEvents = filteredEvents.filter(e => e.eventType === filters.eventType);
      }
      if (filters.startDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= filters.endDate!);
      }
      if (filters.riskLevel) {
        filteredEvents = filteredEvents.filter(e => e.riskLevel === filters.riskLevel);
      }
    }

    return filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAlerts(resolved?: boolean): SecurityAlert[] {
    let filteredAlerts = [...this.alerts];
    
    if (resolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.resolved === resolved);
    }
    
    return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      console.log(`[COMPLIANCE] Alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }

  getComplianceReport(timeframe: 'day' | 'week' | 'month' = 'day') {
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const events = this.getEvents({ startDate });
    const alerts = this.getAlerts().filter(a => a.timestamp >= startDate);

    const report = {
      timeframe,
      period: { start: startDate, end: now },
      summary: {
        totalEvents: events.length,
        totalAlerts: alerts.length,
        unresolvedAlerts: alerts.filter(a => !a.resolved).length,
        criticalEvents: events.filter(e => e.riskLevel === 'critical').length,
        highRiskEvents: events.filter(e => e.riskLevel === 'high').length,
        failedLogins: events.filter(e => e.eventType === 'login' && e.outcome === 'failure').length,
        successfulLogins: events.filter(e => e.eventType === 'login' && e.outcome === 'success').length,
      },
      eventsByType: this.groupEventsByType(events),
      alertsBySeverity: this.groupAlertsBySeverity(alerts),
      topRiskIPs: this.getTopRiskIPs(events),
      complianceScore: this.calculateComplianceScore(events, alerts)
    };

    return report;
  }

  private groupEventsByType(events: ComplianceEvent[]) {
    const grouped: Record<string, number> = {};
    events.forEach(event => {
      grouped[event.eventType] = (grouped[event.eventType] || 0) + 1;
    });
    return grouped;
  }

  private groupAlertsBySeverity(alerts: SecurityAlert[]) {
    const grouped: Record<string, number> = {};
    alerts.forEach(alert => {
      grouped[alert.severity] = (grouped[alert.severity] || 0) + 1;
    });
    return grouped;
  }

  private getTopRiskIPs(events: ComplianceEvent[]) {
    const ipRisks: Record<string, { events: number; highRisk: number; critical: number }> = {};
    
    events.forEach(event => {
      if (event.ipAddress) {
        if (!ipRisks[event.ipAddress]) {
          ipRisks[event.ipAddress] = { events: 0, highRisk: 0, critical: 0 };
        }
        ipRisks[event.ipAddress].events++;
        if (event.riskLevel === 'high') ipRisks[event.ipAddress].highRisk++;
        if (event.riskLevel === 'critical') ipRisks[event.ipAddress].critical++;
      }
    });

    return Object.entries(ipRisks)
      .sort(([,a], [,b]) => (b.critical * 10 + b.highRisk) - (a.critical * 10 + a.highRisk))
      .slice(0, 10)
      .map(([ip, risks]) => ({ ip, ...risks }));
  }

  private calculateComplianceScore(events: ComplianceEvent[], alerts: SecurityAlert[]): number {
    let score = 100;
    
    // Deduct points for security issues
    score -= alerts.filter(a => a.severity === 'critical').length * 10;
    score -= alerts.filter(a => a.severity === 'high').length * 5;
    score -= alerts.filter(a => a.severity === 'medium').length * 2;
    score -= alerts.filter(a => a.severity === 'low').length * 1;
    
    // Deduct points for high-risk events
    score -= events.filter(e => e.riskLevel === 'critical').length * 5;
    score -= events.filter(e => e.riskLevel === 'high').length * 2;
    
    // Deduct points for failed activities
    score -= events.filter(e => e.outcome === 'failure').length * 0.5;
    
    return Math.max(0, Math.min(100, score));
  }
}

// Create global compliance monitor instance
export const complianceMonitor = new ComplianceMonitor();

// Express middleware for automatic compliance logging
export const complianceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip non-sensitive routes
  if (!req.path.startsWith('/api/') || req.path === '/api/health') {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const isSuccess = res.statusCode < 400;
    
    // Determine risk level based on endpoint and outcome
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let eventType: ComplianceEvent['eventType'] = 'data_access';

    // Classify endpoints by risk
    if (req.path.includes('/login') || req.path.includes('/auth')) {
      eventType = 'login';
      riskLevel = isSuccess ? 'low' : 'medium';
    } else if (req.path.includes('/profile') || req.path.includes('/user')) {
      eventType = 'profile_update';
      riskLevel = req.method === 'GET' ? 'low' : 'medium';
    } else if (req.path.includes('/admin')) {
      eventType = 'admin_action';
      riskLevel = req.method === 'GET' ? 'low' : 'high';
    } else if (req.path.includes('/transaction') || req.path.includes('/payment')) {
      eventType = 'transaction';
      riskLevel = 'high';
    } else if (req.path.includes('/export') || req.path.includes('/download')) {
      eventType = 'export_data';
      riskLevel = 'medium';
    } else if (req.method === 'DELETE') {
      eventType = 'delete_data';
      riskLevel = 'high';
    }

    // Log the compliance event (async, fire and forget)
    complianceMonitor.logEvent({
      userId: (req as any).user?.id,
      eventType,
      action: `${req.method} ${req.path}`,
      resource: req.path,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('User-Agent'),
      outcome: isSuccess ? 'success' : 'failure',
      riskLevel,
      details: {
        statusCode: res.statusCode,
        responseTime,
        queryParams: Object.keys(req.query).length > 0 ? req.query : undefined,
        bodySize: req.get('Content-Length') || 0
      }
    }).catch(err => console.error('[COMPLIANCE] Background logging failed:', err));
  });

  next();
};