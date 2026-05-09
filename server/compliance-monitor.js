"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.complianceMiddleware = exports.complianceMonitor = void 0;
var ComplianceMonitor = /** @class */ (function () {
    function ComplianceMonitor() {
        var _this = this;
        this.events = [];
        this.alerts = [];
        this.loginAttempts = new Map();
        this.ipTracking = new Map();
        // Clean up old events every hour
        setInterval(function () {
            _this.cleanupOldEvents();
        }, 3600000); // 1 hour
    }
    ComplianceMonitor.prototype.logEvent = function (event) {
        var eventId = "evt_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
        var complianceEvent = __assign({ id: eventId, timestamp: new Date() }, event);
        this.events.push(complianceEvent);
        // Analyze event for security concerns
        this.analyzeEvent(complianceEvent);
        // Keep only last 10000 events for memory management
        if (this.events.length > 10000) {
            this.events = this.events.slice(-10000);
        }
        if (complianceEvent.riskLevel !== 'low' || process.env.NODE_ENV !== 'production') {
            console.log("[COMPLIANCE] ".concat(complianceEvent.eventType, ": ").concat(complianceEvent.action), {
                userId: complianceEvent.userId,
                outcome: complianceEvent.outcome,
                riskLevel: complianceEvent.riskLevel
            });
        }
        return eventId;
    };
    ComplianceMonitor.prototype.logSuspiciousActivity = function (activity) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.logEvent({
                        userId: activity.userId,
                        eventType: 'security_violation',
                        action: activity.activityType,
                        outcome: 'success', // The logging itself is a success
                        riskLevel: activity.severity,
                        details: __assign({ note: activity.details }, activity.metadata)
                    })];
            });
        });
    };
    ComplianceMonitor.prototype.logComplianceAudit = function (audit) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.logEvent({
                        userId: audit.userId,
                        eventType: 'admin_action',
                        action: audit.action,
                        outcome: audit.outcome,
                        riskLevel: audit.outcome === 'failure' ? 'medium' : 'low',
                        details: __assign({ note: audit.details }, audit.metadata)
                    })];
            });
        });
    };
    ComplianceMonitor.prototype.analyzeEvent = function (event) {
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
                description: "High-risk ".concat(event.eventType, " detected: ").concat(event.action),
                resolved: false
            });
        }
    };
    ComplianceMonitor.prototype.trackFailedLogin = function (ipAddress, userId) {
        var key = "".concat(ipAddress, ":").concat(userId || 'unknown');
        var existing = this.loginAttempts.get(key);
        if (existing) {
            existing.count++;
            existing.lastAttempt = new Date();
            // Alert on multiple failed attempts
            if (existing.count >= 5) {
                this.createAlert({
                    alertType: 'multiple_failed_logins',
                    severity: 'high',
                    userId: userId,
                    ipAddress: ipAddress,
                    description: "".concat(existing.count, " failed login attempts from ").concat(ipAddress),
                    resolved: false
                });
            }
        }
        else {
            this.loginAttempts.set(key, { count: 1, lastAttempt: new Date() });
        }
    };
    ComplianceMonitor.prototype.trackIpActivity = function (ipAddress) {
        var existing = this.ipTracking.get(ipAddress);
        if (existing) {
            existing.requests++;
            // Flag suspicious IPs with high request volume
            if (existing.requests > 1000 && !existing.flagged) {
                existing.flagged = true;
                this.createAlert({
                    alertType: 'suspicious_ip',
                    severity: 'medium',
                    ipAddress: ipAddress,
                    description: "High request volume from IP: ".concat(ipAddress, " (").concat(existing.requests, " requests)"),
                    resolved: false
                });
            }
        }
        else {
            this.ipTracking.set(ipAddress, {
                requests: 1,
                firstSeen: new Date(),
                flagged: false
            });
        }
    };
    ComplianceMonitor.prototype.createAlert = function (alert) {
        var alertId = "alert_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
        var securityAlert = __assign({ id: alertId, timestamp: new Date() }, alert);
        this.alerts.push(securityAlert);
        console.warn("[SECURITY ALERT] ".concat(securityAlert.alertType, ": ").concat(securityAlert.description), {
            severity: securityAlert.severity,
            userId: securityAlert.userId,
            ipAddress: securityAlert.ipAddress
        });
        // Keep only last 1000 alerts
        if (this.alerts.length > 1000) {
            this.alerts = this.alerts.slice(-1000);
        }
        return alertId;
    };
    ComplianceMonitor.prototype.cleanupOldEvents = function () {
        var _this = this;
        var oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // Clean old login attempts
        Array.from(this.loginAttempts.entries()).forEach(function (_a) {
            var key = _a[0], attempt = _a[1];
            if (attempt.lastAttempt < oneDayAgo) {
                _this.loginAttempts.delete(key);
            }
        });
        // Clean old IP tracking
        Array.from(this.ipTracking.entries()).forEach(function (_a) {
            var ip = _a[0], tracking = _a[1];
            if (tracking.firstSeen < oneDayAgo) {
                _this.ipTracking.delete(ip);
            }
        });
        console.log("[COMPLIANCE] Cleaned up old tracking data");
    };
    // Compliance reporting methods
    ComplianceMonitor.prototype.getEvents = function (filters) {
        var filteredEvents = __spreadArray([], this.events, true);
        if (filters) {
            if (filters.userId) {
                filteredEvents = filteredEvents.filter(function (e) { return e.userId === filters.userId; });
            }
            if (filters.eventType) {
                filteredEvents = filteredEvents.filter(function (e) { return e.eventType === filters.eventType; });
            }
            if (filters.startDate) {
                filteredEvents = filteredEvents.filter(function (e) { return e.timestamp >= filters.startDate; });
            }
            if (filters.endDate) {
                filteredEvents = filteredEvents.filter(function (e) { return e.timestamp <= filters.endDate; });
            }
            if (filters.riskLevel) {
                filteredEvents = filteredEvents.filter(function (e) { return e.riskLevel === filters.riskLevel; });
            }
        }
        return filteredEvents.sort(function (a, b) { return b.timestamp.getTime() - a.timestamp.getTime(); });
    };
    ComplianceMonitor.prototype.getAlerts = function (resolved) {
        var filteredAlerts = __spreadArray([], this.alerts, true);
        if (resolved !== undefined) {
            filteredAlerts = filteredAlerts.filter(function (a) { return a.resolved === resolved; });
        }
        return filteredAlerts.sort(function (a, b) { return b.timestamp.getTime() - a.timestamp.getTime(); });
    };
    ComplianceMonitor.prototype.resolveAlert = function (alertId) {
        var alert = this.alerts.find(function (a) { return a.id === alertId; });
        if (alert) {
            alert.resolved = true;
            console.log("[COMPLIANCE] Alert resolved: ".concat(alertId));
            return true;
        }
        return false;
    };
    ComplianceMonitor.prototype.getComplianceReport = function (timeframe) {
        if (timeframe === void 0) { timeframe = 'day'; }
        var now = new Date();
        var startDate;
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
        var events = this.getEvents({ startDate: startDate });
        var alerts = this.getAlerts().filter(function (a) { return a.timestamp >= startDate; });
        var report = {
            timeframe: timeframe,
            period: { start: startDate, end: now },
            summary: {
                totalEvents: events.length,
                totalAlerts: alerts.length,
                unresolvedAlerts: alerts.filter(function (a) { return !a.resolved; }).length,
                criticalEvents: events.filter(function (e) { return e.riskLevel === 'critical'; }).length,
                highRiskEvents: events.filter(function (e) { return e.riskLevel === 'high'; }).length,
                failedLogins: events.filter(function (e) { return e.eventType === 'login' && e.outcome === 'failure'; }).length,
                successfulLogins: events.filter(function (e) { return e.eventType === 'login' && e.outcome === 'success'; }).length,
            },
            eventsByType: this.groupEventsByType(events),
            alertsBySeverity: this.groupAlertsBySeverity(alerts),
            topRiskIPs: this.getTopRiskIPs(events),
            complianceScore: this.calculateComplianceScore(events, alerts)
        };
        return report;
    };
    ComplianceMonitor.prototype.groupEventsByType = function (events) {
        var grouped = {};
        events.forEach(function (event) {
            grouped[event.eventType] = (grouped[event.eventType] || 0) + 1;
        });
        return grouped;
    };
    ComplianceMonitor.prototype.groupAlertsBySeverity = function (alerts) {
        var grouped = {};
        alerts.forEach(function (alert) {
            grouped[alert.severity] = (grouped[alert.severity] || 0) + 1;
        });
        return grouped;
    };
    ComplianceMonitor.prototype.getTopRiskIPs = function (events) {
        var ipRisks = {};
        events.forEach(function (event) {
            if (event.ipAddress) {
                if (!ipRisks[event.ipAddress]) {
                    ipRisks[event.ipAddress] = { events: 0, highRisk: 0, critical: 0 };
                }
                ipRisks[event.ipAddress].events++;
                if (event.riskLevel === 'high')
                    ipRisks[event.ipAddress].highRisk++;
                if (event.riskLevel === 'critical')
                    ipRisks[event.ipAddress].critical++;
            }
        });
        return Object.entries(ipRisks)
            .sort(function (_a, _b) {
            var a = _a[1];
            var b = _b[1];
            return (b.critical * 10 + b.highRisk) - (a.critical * 10 + a.highRisk);
        })
            .slice(0, 10)
            .map(function (_a) {
            var ip = _a[0], risks = _a[1];
            return (__assign({ ip: ip }, risks));
        });
    };
    ComplianceMonitor.prototype.calculateComplianceScore = function (events, alerts) {
        var score = 100;
        // Deduct points for security issues
        score -= alerts.filter(function (a) { return a.severity === 'critical'; }).length * 10;
        score -= alerts.filter(function (a) { return a.severity === 'high'; }).length * 5;
        score -= alerts.filter(function (a) { return a.severity === 'medium'; }).length * 2;
        score -= alerts.filter(function (a) { return a.severity === 'low'; }).length * 1;
        // Deduct points for high-risk events
        score -= events.filter(function (e) { return e.riskLevel === 'critical'; }).length * 5;
        score -= events.filter(function (e) { return e.riskLevel === 'high'; }).length * 2;
        // Deduct points for failed activities
        score -= events.filter(function (e) { return e.outcome === 'failure'; }).length * 0.5;
        return Math.max(0, Math.min(100, score));
    };
    return ComplianceMonitor;
}());
// Create global compliance monitor instance
exports.complianceMonitor = new ComplianceMonitor();
// Express middleware for automatic compliance logging
var complianceMiddleware = function (req, res, next) {
    // Skip non-sensitive routes
    if (!req.path.startsWith('/api/') || req.path === '/api/health') {
        return next();
    }
    var originalSend = res.send;
    var startTime = Date.now();
    res.send = function (data) {
        var _a;
        var responseTime = Date.now() - startTime;
        var isSuccess = res.statusCode < 400;
        // Determine risk level based on endpoint and outcome
        var riskLevel = 'low';
        var eventType = 'data_access';
        // Classify endpoints by risk
        if (req.path.includes('/login') || req.path.includes('/auth')) {
            eventType = 'login';
            riskLevel = isSuccess ? 'low' : 'medium';
        }
        else if (req.path.includes('/profile') || req.path.includes('/user')) {
            eventType = 'profile_update';
            riskLevel = req.method === 'GET' ? 'low' : 'medium';
        }
        else if (req.path.includes('/admin')) {
            eventType = 'admin_action';
            // Only flag mutating admin operations as high-risk
            // GET requests (dashboard views, counts, etc.) are low-risk read-only operations
            riskLevel = req.method === 'GET' ? 'low' : 'high';
        }
        else if (req.path.includes('/transaction') || req.path.includes('/payment')) {
            eventType = 'transaction';
            riskLevel = 'high';
        }
        else if (req.path.includes('/export') || req.path.includes('/download')) {
            eventType = 'export_data';
            riskLevel = 'medium';
        }
        else if (req.method === 'DELETE') {
            eventType = 'delete_data';
            riskLevel = 'high';
        }
        // Log the compliance event
        exports.complianceMonitor.logEvent({
            userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
            eventType: eventType,
            action: "".concat(req.method, " ").concat(req.path),
            resource: req.path,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.get('User-Agent'),
            outcome: isSuccess ? 'success' : 'failure',
            riskLevel: riskLevel,
            details: {
                statusCode: res.statusCode,
                responseTime: responseTime,
                queryParams: Object.keys(req.query).length > 0 ? req.query : undefined,
                bodySize: req.get('Content-Length') || 0
            }
        });
        return originalSend.call(this, data);
    };
    next();
};
exports.complianceMiddleware = complianceMiddleware;
