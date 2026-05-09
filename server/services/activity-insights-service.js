"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
exports.activityInsightsService = void 0;
var db_1 = require("../db");
var schema_1 = require("@shared/schema");
var drizzle_orm_1 = require("drizzle-orm");
var ai_service_1 = require("./ai-service");
var compliance_monitor_1 = require("../compliance-monitor");
var request_latency_tracker_1 = require("./request-latency-tracker");
var ActivityInsightsService = /** @class */ (function () {
    function ActivityInsightsService() {
        this.cachedInsights = [];
        this.lastAnalysisTime = null;
        this.analysisInProgress = false;
    }
    ActivityInsightsService.prototype.getActivityMetrics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, oneDayAgo, oneWeekAgo, thirtyDaysAgo, twoDaysAgo, _a, errorStats, criticalErrors, activeUsers, newUsers, dormantUsers, incompleteKycUsers, pendingBondOrders, pendingUnlistedDeals, yesterdayErrors, completedBondOrders, completedUnlistedDeals, completedMfOrders, cancelledBondOrders, cancelledMfOrders, cancelledUnlistedDeals, pendingMfOrders, pendingBondValue, pendingUnlistedValue, authSecurityEvents, errorsByModule, moduleErrors_1, highErrorModules, todayCount, yesterdayCount, errorTrend, changePercent, complianceReport, complianceAlerts, auditFailedLogins, complianceFailedLogins, failedLogins, auditRateLimitEvents, complianceRateLimits, rateLimitViolations, auditSuspicious, complianceSuspicious, suspiciousActivity, abandonedCarts, completedDeals, pendingMfValue, pendingBondVal, pendingUnlistedVal, cancelledBondVal, cancelledMfVal, cancelledUnlistedVal, potentialRevenue, slowEndpoints, error_1;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
            return __generator(this, function (_z) {
                switch (_z.label) {
                    case 0:
                        now = new Date();
                        oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        _z.label = 1;
                    case 1:
                        _z.trys.push([1, 4, , 5]);
                        twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
                        return [4 /*yield*/, Promise.all([
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.errorLedger).where((0, drizzle_orm_1.gte)(schema_1.errorLedger.createdAt, oneDayAgo)).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.errorLedger).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.errorLedger.createdAt, oneDayAgo), (0, drizzle_orm_1.eq)(schema_1.errorLedger.severity, 'critical'))).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users).where((0, drizzle_orm_1.gte)(schema_1.users.lastLoginAt, oneDayAgo)).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users).where((0, drizzle_orm_1.gte)(schema_1.users.createdAt, oneWeekAgo)).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.lt)(schema_1.users.lastLoginAt, thirtyDaysAgo), (0, drizzle_orm_1.eq)(schema_1.users.isActive, true))).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.users).where((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\"is_active\" = true AND (\"kyc_status\" IS NULL OR \"kyc_status\" NOT IN ('verified', 'approved'))"], ["\"is_active\" = true AND (\"kyc_status\" IS NULL OR \"kyc_status\" NOT IN ('verified', 'approved'))"])))).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.bondOrders).where((0, drizzle_orm_1.eq)(schema_1.bondOrders.orderStatus, 'pending')).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.unlistedDeals).where((0, drizzle_orm_1.eq)(schema_1.unlistedDeals.status, 'pending')).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.errorLedger).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.errorLedger.createdAt, twoDaysAgo), (0, drizzle_orm_1.lt)(schema_1.errorLedger.createdAt, oneDayAgo))).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.bondOrders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.bondOrders.orderStatus, 'executed'), (0, drizzle_orm_1.gte)(schema_1.bondOrders.createdAt, oneWeekAgo))).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.unlistedDeals).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.unlistedDeals.status, 'completed'), (0, drizzle_orm_1.gte)(schema_1.unlistedDeals.createdAt, oneWeekAgo))).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({ count: (0, drizzle_orm_1.count)() }).from(schema_1.mfOrders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.mfOrders.status, ['settled', 'reconciled']), (0, drizzle_orm_1.gte)(schema_1.mfOrders.createdAt, oneWeekAgo))).catch(function () { return [{ count: 0 }]; }),
                                db_1.db.select({
                                    count: (0, drizzle_orm_1.count)(),
                                    totalValue: (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["COALESCE(SUM(CAST(\"gross_amount\" AS numeric)), 0)"], ["COALESCE(SUM(CAST(\"gross_amount\" AS numeric)), 0)"])))
                                }).from(schema_1.bondOrders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.bondOrders.orderStatus, 'cancelled'), (0, drizzle_orm_1.gte)(schema_1.bondOrders.createdAt, oneWeekAgo))).catch(function () { return [{ count: 0, totalValue: 0 }]; }),
                                db_1.db.select({
                                    count: (0, drizzle_orm_1.count)(),
                                    totalValue: (0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["COALESCE(SUM(CAST(\"amount\" AS numeric)), 0)"], ["COALESCE(SUM(CAST(\"amount\" AS numeric)), 0)"])))
                                }).from(schema_1.mfOrders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.mfOrders.status, ['cancelled', 'failed']), (0, drizzle_orm_1.gte)(schema_1.mfOrders.createdAt, oneWeekAgo))).catch(function () { return [{ count: 0, totalValue: 0 }]; }),
                                db_1.db.select({
                                    count: (0, drizzle_orm_1.count)(),
                                    totalValue: (0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["COALESCE(SUM(CAST(\"total_value\" AS numeric)), 0)"], ["COALESCE(SUM(CAST(\"total_value\" AS numeric)), 0)"])))
                                }).from(schema_1.unlistedDeals).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.unlistedDeals.status, ['cancelled', 'failed']), (0, drizzle_orm_1.gte)(schema_1.unlistedDeals.createdAt, oneWeekAgo))).catch(function () { return [{ count: 0, totalValue: 0 }]; }),
                                db_1.db.select({
                                    count: (0, drizzle_orm_1.count)(),
                                    totalValue: (0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["COALESCE(SUM(CAST(\"amount\" AS numeric)), 0)"], ["COALESCE(SUM(CAST(\"amount\" AS numeric)), 0)"])))
                                }).from(schema_1.mfOrders).where((0, drizzle_orm_1.inArray)(schema_1.mfOrders.status, ['created', 'pending_payment'])).catch(function () { return [{ count: 0, totalValue: 0 }]; }),
                                db_1.db.select({
                                    count: (0, drizzle_orm_1.count)(),
                                    totalValue: (0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["COALESCE(SUM(CAST(\"gross_amount\" AS numeric)), 0)"], ["COALESCE(SUM(CAST(\"gross_amount\" AS numeric)), 0)"])))
                                }).from(schema_1.bondOrders).where((0, drizzle_orm_1.eq)(schema_1.bondOrders.orderStatus, 'pending')).catch(function () { return [{ count: 0, totalValue: 0 }]; }),
                                db_1.db.select({
                                    count: (0, drizzle_orm_1.count)(),
                                    totalValue: (0, drizzle_orm_1.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["COALESCE(SUM(CAST(\"total_value\" AS numeric)), 0)"], ["COALESCE(SUM(CAST(\"total_value\" AS numeric)), 0)"])))
                                }).from(schema_1.unlistedDeals).where((0, drizzle_orm_1.eq)(schema_1.unlistedDeals.status, 'pending')).catch(function () { return [{ count: 0, totalValue: 0 }]; }),
                                db_1.db.select({
                                    eventType: schema_1.immutableAuditLogs.eventType,
                                    action: schema_1.immutableAuditLogs.action
                                }).from(schema_1.immutableAuditLogs).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.immutableAuditLogs.timestamp, oneDayAgo), (0, drizzle_orm_1.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["", " IN ('security', 'authentication', 'authorization', 'login')"], ["", " IN ('security', 'authentication', 'authorization', 'login')"])), schema_1.immutableAuditLogs.eventType))).catch(function () { return []; })
                            ])];
                    case 2:
                        _a = _z.sent(), errorStats = _a[0], criticalErrors = _a[1], activeUsers = _a[2], newUsers = _a[3], dormantUsers = _a[4], incompleteKycUsers = _a[5], pendingBondOrders = _a[6], pendingUnlistedDeals = _a[7], yesterdayErrors = _a[8], completedBondOrders = _a[9], completedUnlistedDeals = _a[10], completedMfOrders = _a[11], cancelledBondOrders = _a[12], cancelledMfOrders = _a[13], cancelledUnlistedDeals = _a[14], pendingMfOrders = _a[15], pendingBondValue = _a[16], pendingUnlistedValue = _a[17], authSecurityEvents = _a[18];
                        return [4 /*yield*/, db_1.db.select({
                                module: schema_1.errorLedger.module,
                                count: (0, drizzle_orm_1.count)()
                            })
                                .from(schema_1.errorLedger)
                                .where((0, drizzle_orm_1.gte)(schema_1.errorLedger.createdAt, oneDayAgo))
                                .groupBy(schema_1.errorLedger.module)
                                .catch(function () { return []; })];
                    case 3:
                        errorsByModule = _z.sent();
                        moduleErrors_1 = {};
                        errorsByModule.forEach(function (e) {
                            moduleErrors_1[e.module] = e.count;
                        });
                        highErrorModules = Object.entries(moduleErrors_1)
                            .filter(function (_a) {
                            var _ = _a[0], count = _a[1];
                            return count > 10;
                        })
                            .map(function (_a) {
                            var module = _a[0];
                            return module;
                        });
                        todayCount = ((_b = errorStats[0]) === null || _b === void 0 ? void 0 : _b.count) || 0;
                        yesterdayCount = ((_c = yesterdayErrors[0]) === null || _c === void 0 ? void 0 : _c.count) || 0;
                        errorTrend = 'stable';
                        if (yesterdayCount > 0) {
                            changePercent = ((todayCount - yesterdayCount) / yesterdayCount) * 100;
                            if (changePercent > 20)
                                errorTrend = 'increasing';
                            else if (changePercent < -20)
                                errorTrend = 'decreasing';
                        }
                        else if (todayCount > 5) {
                            errorTrend = 'increasing';
                        }
                        complianceReport = compliance_monitor_1.complianceMonitor.getComplianceReport('day');
                        complianceAlerts = compliance_monitor_1.complianceMonitor.getAlerts();
                        auditFailedLogins = authSecurityEvents.filter(function (e) {
                            var _a, _b;
                            return (e.eventType === 'authentication' || e.eventType === 'login') &&
                                (((_a = e.action) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('fail')) || ((_b = e.action) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes('denied')));
                        }).length;
                        complianceFailedLogins = complianceReport.summary.failedLogins || 0;
                        failedLogins = Math.max(auditFailedLogins, complianceFailedLogins);
                        auditRateLimitEvents = authSecurityEvents.filter(function (e) { var _a, _b, _c; return ((_a = e.action) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('rate')) || ((_b = e.action) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes('throttl')) || ((_c = e.action) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes('blocked')); }).length;
                        complianceRateLimits = complianceAlerts.filter(function (a) { var _a; return a.alertType === 'suspicious_ip' || ((_a = a.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('rate limit')); }).length;
                        rateLimitViolations = auditRateLimitEvents + complianceRateLimits;
                        auditSuspicious = authSecurityEvents.filter(function (e) { var _a, _b, _c; return e.eventType === 'security' && (((_a = e.action) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('suspicious')) || ((_b = e.action) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes('breach')) || ((_c = e.action) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes('unauthorized'))); }).length;
                        complianceSuspicious = complianceAlerts.filter(function (a) { return !a.resolved && (a.severity === 'high' || a.severity === 'critical'); }).length;
                        suspiciousActivity = auditSuspicious + complianceSuspicious;
                        abandonedCarts = (((_d = cancelledBondOrders[0]) === null || _d === void 0 ? void 0 : _d.count) || 0) + (((_e = cancelledMfOrders[0]) === null || _e === void 0 ? void 0 : _e.count) || 0) + (((_f = cancelledUnlistedDeals[0]) === null || _f === void 0 ? void 0 : _f.count) || 0);
                        completedDeals = (((_g = completedBondOrders[0]) === null || _g === void 0 ? void 0 : _g.count) || 0) + (((_h = completedUnlistedDeals[0]) === null || _h === void 0 ? void 0 : _h.count) || 0) + (((_j = completedMfOrders[0]) === null || _j === void 0 ? void 0 : _j.count) || 0);
                        pendingMfValue = Number(((_k = pendingMfOrders[0]) === null || _k === void 0 ? void 0 : _k.totalValue) || 0);
                        pendingBondVal = Number(((_l = pendingBondValue[0]) === null || _l === void 0 ? void 0 : _l.totalValue) || 0);
                        pendingUnlistedVal = Number(((_m = pendingUnlistedValue[0]) === null || _m === void 0 ? void 0 : _m.totalValue) || 0);
                        cancelledBondVal = Number(((_o = cancelledBondOrders[0]) === null || _o === void 0 ? void 0 : _o.totalValue) || 0);
                        cancelledMfVal = Number(((_p = cancelledMfOrders[0]) === null || _p === void 0 ? void 0 : _p.totalValue) || 0);
                        cancelledUnlistedVal = Number(((_q = cancelledUnlistedDeals[0]) === null || _q === void 0 ? void 0 : _q.totalValue) || 0);
                        potentialRevenue = pendingMfValue + pendingBondVal + pendingUnlistedVal + cancelledBondVal + cancelledMfVal + cancelledUnlistedVal;
                        slowEndpoints = request_latency_tracker_1.requestLatencyTracker.getSlowEndpoints();
                        return [2 /*return*/, {
                                errors: {
                                    total: todayCount,
                                    critical: ((_r = criticalErrors[0]) === null || _r === void 0 ? void 0 : _r.count) || 0,
                                    byModule: moduleErrors_1,
                                    trend: errorTrend
                                },
                                users: {
                                    activeToday: ((_s = activeUsers[0]) === null || _s === void 0 ? void 0 : _s.count) || 0,
                                    newThisWeek: ((_t = newUsers[0]) === null || _t === void 0 ? void 0 : _t.count) || 0,
                                    dormant30Days: ((_u = dormantUsers[0]) === null || _u === void 0 ? void 0 : _u.count) || 0,
                                    incompleteKyc: ((_v = incompleteKycUsers[0]) === null || _v === void 0 ? void 0 : _v.count) || 0
                                },
                                revenue: {
                                    pendingOrders: (((_w = pendingBondOrders[0]) === null || _w === void 0 ? void 0 : _w.count) || 0) + (((_x = pendingUnlistedDeals[0]) === null || _x === void 0 ? void 0 : _x.count) || 0) + (((_y = pendingMfOrders[0]) === null || _y === void 0 ? void 0 : _y.count) || 0),
                                    abandonedCarts: abandonedCarts,
                                    completedDeals: completedDeals,
                                    potentialRevenue: Math.round(potentialRevenue)
                                },
                                security: {
                                    failedLogins: failedLogins,
                                    rateLimitViolations: rateLimitViolations,
                                    suspiciousActivity: suspiciousActivity
                                },
                                performance: {
                                    slowEndpoints: slowEndpoints,
                                    highErrorRateModules: highErrorModules
                                }
                            }];
                    case 4:
                        error_1 = _z.sent();
                        console.error("[ActivityInsights] Error fetching metrics:", (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || error_1);
                        return [2 /*return*/, {
                                errors: { total: 0, critical: 0, byModule: {}, trend: 'stable' },
                                users: { activeToday: 0, newThisWeek: 0, dormant30Days: 0, incompleteKyc: 0 },
                                revenue: { pendingOrders: 0, abandonedCarts: 0, completedDeals: 0, potentialRevenue: 0 },
                                security: { failedLogins: 0, rateLimitViolations: 0, suspiciousActivity: 0 },
                                performance: { slowEndpoints: [], highErrorRateModules: [] }
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    ActivityInsightsService.prototype.generateAIInsights = function (metrics) {
        return __awaiter(this, void 0, void 0, function () {
            var prompt_1, aiResponse, jsonMatch, insights;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.analysisInProgress) {
                            return [2 /*return*/, this.cachedInsights];
                        }
                        this.analysisInProgress = true;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        prompt_1 = "You are FintekPro's AI business analyst. Analyze these platform metrics and provide actionable insights.\n\nMETRICS:\n".concat(JSON.stringify(metrics, null, 2), "\n\nGenerate exactly 5-8 insights in the following JSON format. Focus on:\n1. PERFORMANCE: Identify slow modules, high error rates, optimization opportunities\n2. SECURITY/ABUSE: Detect unusual patterns, potential abuse, security risks\n3. REVENUE: Cart abandonment recovery, incomplete KYC follow-ups, dormant user re-engagement, upsell opportunities\n4. ENGAGEMENT: User behavior patterns, drop-off points, feature adoption\n\nReturn a JSON array of insights:\n[\n  {\n    \"category\": \"performance|abuse|revenue|engagement|security\",\n    \"priority\": \"critical|high|medium|low\",\n    \"title\": \"Short actionable title\",\n    \"description\": \"2-3 sentence explanation of the insight\",\n    \"suggestedAction\": \"Specific action to take\",\n    \"estimatedImpact\": \"Expected outcome (e.g., '15% error reduction', '\u20B950,000 potential recovery')\",\n    \"actionType\": \"email|notification|config|manual\"\n  }\n]\n\nIMPORTANT: \n- Be specific with numbers from the metrics\n- Prioritize revenue-generating and security insights\n- Make suggestions actionable and measurable\n- For dormant users (").concat(metrics.users.dormant30Days, "), suggest re-engagement campaigns\n- For incomplete KYC users (").concat(metrics.users.incompleteKyc, "), suggest follow-up strategies\n- For pending orders (").concat(metrics.revenue.pendingOrders, "), suggest conversion tactics\n- For high-error modules, suggest specific fixes");
                        return [4 /*yield*/, ai_service_1.aiService.chat([
                                { role: 'user', content: prompt_1 }
                            ], { model: 'gemini-1.5-flash', maxTokens: 2000 })];
                    case 2:
                        aiResponse = _a.sent();
                        if (!(aiResponse === null || aiResponse === void 0 ? void 0 : aiResponse.content)) {
                            console.error('[ActivityInsights] No AI response received');
                            return [2 /*return*/, this.getDefaultInsights(metrics)];
                        }
                        try {
                            jsonMatch = aiResponse.content.match(/\[[\s\S]*\]/);
                            if (!jsonMatch) {
                                console.error('[ActivityInsights] Could not parse AI response as JSON');
                                return [2 /*return*/, this.getDefaultInsights(metrics)];
                            }
                            insights = JSON.parse(jsonMatch[0]);
                            this.cachedInsights = insights.map(function (insight, index) { return ({
                                id: "insight-".concat(Date.now(), "-").concat(index),
                                category: insight.category || 'engagement',
                                priority: insight.priority || 'medium',
                                title: insight.title || 'Insight',
                                description: insight.description || '',
                                suggestedAction: insight.suggestedAction || '',
                                estimatedImpact: insight.estimatedImpact || 'Unknown',
                                actionType: insight.actionType,
                                actionPayload: insight.actionPayload,
                                createdAt: new Date()
                            }); });
                            this.lastAnalysisTime = new Date();
                            console.log("[ActivityInsights] Generated ".concat(this.cachedInsights.length, " AI insights"));
                            return [2 /*return*/, this.cachedInsights];
                        }
                        catch (parseError) {
                            console.error('[ActivityInsights] Failed to parse AI response:', parseError);
                            return [2 /*return*/, this.getDefaultInsights(metrics)];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        this.analysisInProgress = false;
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ActivityInsightsService.prototype.getDefaultInsights = function (metrics) {
        var insights = [];
        if (metrics.errors.critical > 0) {
            insights.push({
                id: "insight-critical-".concat(Date.now()),
                category: 'performance',
                priority: 'critical',
                title: "".concat(metrics.errors.critical, " Critical Errors Detected"),
                description: "There are ".concat(metrics.errors.critical, " critical errors in the last 24 hours that need immediate attention."),
                suggestedAction: 'Review and resolve critical errors in the Error tab immediately.',
                estimatedImpact: 'Prevent user-facing issues and potential data loss',
                actionType: 'manual',
                createdAt: new Date()
            });
        }
        if (metrics.users.incompleteKyc > 0) {
            insights.push({
                id: "insight-kyc-".concat(Date.now()),
                category: 'revenue',
                priority: metrics.users.incompleteKyc > 10 ? 'high' : 'medium',
                title: "".concat(metrics.users.incompleteKyc, " Users with Incomplete KYC"),
                description: "These users started registration but haven't completed KYC verification, blocking them from trading.",
                suggestedAction: 'Send reminder emails with KYC completion incentives.',
                estimatedImpact: "Potential \u20B9".concat((metrics.users.incompleteKyc * 5000).toLocaleString(), " in first-time investments"),
                actionType: 'email',
                createdAt: new Date()
            });
        }
        if (metrics.users.dormant30Days > 0) {
            insights.push({
                id: "insight-dormant-".concat(Date.now()),
                category: 'engagement',
                priority: 'medium',
                title: "".concat(metrics.users.dormant30Days, " Dormant Users (30+ Days)"),
                description: "These users haven't logged in for over 30 days but have active accounts.",
                suggestedAction: 'Launch re-engagement campaign with personalized investment opportunities.',
                estimatedImpact: '20-30% user reactivation rate expected',
                actionType: 'email',
                createdAt: new Date()
            });
        }
        if (metrics.revenue.pendingOrders > 0) {
            insights.push({
                id: "insight-pending-".concat(Date.now()),
                category: 'revenue',
                priority: 'high',
                title: "".concat(metrics.revenue.pendingOrders, " Pending Orders Awaiting Action"),
                description: "Orders are pending completion which could convert to revenue.",
                suggestedAction: 'Send payment reminders and follow-up with agents.',
                estimatedImpact: "Accelerate \u20B9".concat((metrics.revenue.pendingOrders * 10000).toLocaleString(), " in pending transactions"),
                actionType: 'notification',
                createdAt: new Date()
            });
        }
        if (metrics.performance.highErrorRateModules.length > 0) {
            insights.push({
                id: "insight-errors-".concat(Date.now()),
                category: 'performance',
                priority: 'high',
                title: "High Error Rate in ".concat(metrics.performance.highErrorRateModules.join(', ')),
                description: "These modules have unusually high error rates that may affect user experience.",
                suggestedAction: 'Review error logs and deploy fixes for these modules.',
                estimatedImpact: 'Improved reliability and user satisfaction',
                actionType: 'manual',
                createdAt: new Date()
            });
        }
        if (insights.length === 0) {
            insights.push({
                id: "insight-status-".concat(Date.now()),
                category: 'engagement',
                priority: 'low',
                title: 'Platform Operating Normally',
                description: "Current metrics show healthy platform activity: ".concat(metrics.users.activeToday, " active users today, ").concat(metrics.users.newThisWeek, " new users this week."),
                suggestedAction: 'Continue monitoring for optimization opportunities.',
                estimatedImpact: 'Maintain operational excellence',
                actionType: 'manual',
                createdAt: new Date()
            });
        }
        return insights;
    };
    ActivityInsightsService.prototype.getRecentActivity = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var oneDayAgo, _a, immutableLogs, trailLogs, kycLogs, errorLogs, combined;
            if (limit === void 0) { limit = 50; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                        return [4 /*yield*/, Promise.all([
                                db_1.db.select({
                                    id: schema_1.immutableAuditLogs.id,
                                    timestamp: schema_1.immutableAuditLogs.timestamp,
                                    eventType: schema_1.immutableAuditLogs.eventType,
                                    action: schema_1.immutableAuditLogs.action,
                                    userId: schema_1.immutableAuditLogs.userId,
                                    userRole: schema_1.immutableAuditLogs.userRole,
                                    entityType: schema_1.immutableAuditLogs.entityType,
                                    entityId: schema_1.immutableAuditLogs.entityId
                                })
                                    .from(schema_1.immutableAuditLogs)
                                    .where((0, drizzle_orm_1.gte)(schema_1.immutableAuditLogs.timestamp, oneDayAgo))
                                    .orderBy((0, drizzle_orm_1.desc)(schema_1.immutableAuditLogs.timestamp))
                                    .limit(limit),
                                db_1.db.select({
                                    id: schema_1.auditTrail.id,
                                    timestamp: schema_1.auditTrail.createdAt,
                                    eventType: schema_1.auditTrail.category,
                                    action: schema_1.auditTrail.action,
                                    userId: schema_1.auditTrail.userId,
                                    userRole: (0, drizzle_orm_1.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["'user'"], ["'user'"]))),
                                    entityType: (0, drizzle_orm_1.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["'general'"], ["'general'"]))),
                                    entityId: (0, drizzle_orm_1.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["NULL"], ["NULL"])))
                                })
                                    .from(schema_1.auditTrail)
                                    .where((0, drizzle_orm_1.gte)(schema_1.auditTrail.createdAt, oneDayAgo))
                                    .orderBy((0, drizzle_orm_1.desc)(schema_1.auditTrail.createdAt))
                                    .limit(limit),
                                db_1.db.select({
                                    id: schema_1.kycAuditLogs.id,
                                    timestamp: schema_1.kycAuditLogs.accessedAt,
                                    eventType: schema_1.kycAuditLogs.accessType,
                                    action: schema_1.kycAuditLogs.purpose,
                                    userId: schema_1.kycAuditLogs.userId,
                                    userRole: (0, drizzle_orm_1.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["'kyc_processor'"], ["'kyc_processor'"]))),
                                    entityType: (0, drizzle_orm_1.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["'kyc'"], ["'kyc'"]))),
                                    entityId: schema_1.kycAuditLogs.requestId
                                })
                                    .from(schema_1.kycAuditLogs)
                                    .where((0, drizzle_orm_1.gte)(schema_1.kycAuditLogs.accessedAt, oneDayAgo))
                                    .orderBy((0, drizzle_orm_1.desc)(schema_1.kycAuditLogs.accessedAt))
                                    .limit(limit),
                                db_1.db.select({
                                    id: schema_1.errorLedger.id,
                                    timestamp: schema_1.errorLedger.createdAt,
                                    eventType: (0, drizzle_orm_1.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["'error'"], ["'error'"]))),
                                    action: schema_1.errorLedger.errorCode,
                                    userId: schema_1.errorLedger.clientId,
                                    userRole: (0, drizzle_orm_1.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["'system'"], ["'system'"]))),
                                    entityType: schema_1.errorLedger.module,
                                    entityId: schema_1.errorLedger.transactionId
                                })
                                    .from(schema_1.errorLedger)
                                    .where((0, drizzle_orm_1.gte)(schema_1.errorLedger.createdAt, oneDayAgo))
                                    .orderBy((0, drizzle_orm_1.desc)(schema_1.errorLedger.createdAt))
                                    .limit(limit)
                            ])];
                    case 1:
                        _a = _b.sent(), immutableLogs = _a[0], trailLogs = _a[1], kycLogs = _a[2], errorLogs = _a[3];
                        combined = __spreadArray(__spreadArray(__spreadArray(__spreadArray([], immutableLogs, true), trailLogs, true), kycLogs, true), errorLogs, true).filter(function (log) { return log.timestamp; })
                            .sort(function (a, b) { return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(); })
                            .slice(0, limit);
                        return [2 /*return*/, combined];
                }
            });
        });
    };
    ActivityInsightsService.prototype.getSecurityAlerts = function () {
        return __awaiter(this, void 0, void 0, function () {
            var oneHourAgo, securityEvents;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                        return [4 /*yield*/, db_1.db.select()
                                .from(schema_1.immutableAuditLogs)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.immutableAuditLogs.timestamp, oneHourAgo), (0, drizzle_orm_1.sql)(templateObject_16 || (templateObject_16 = __makeTemplateObject(["", " IN ('security', 'authentication', 'authorization')"], ["", " IN ('security', 'authentication', 'authorization')"])), schema_1.immutableAuditLogs.eventType)))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.immutableAuditLogs.timestamp))
                                .limit(20)];
                    case 1:
                        securityEvents = _a.sent();
                        return [2 /*return*/, securityEvents];
                }
            });
        });
    };
    ActivityInsightsService.prototype.getCachedInsights = function () {
        return this.cachedInsights;
    };
    ActivityInsightsService.prototype.getLastAnalysisTime = function () {
        return this.lastAnalysisTime;
    };
    ActivityInsightsService.prototype.getStuckKycUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rows, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_17 || (templateObject_17 = __makeTemplateObject(["\n        SELECT \n          u.id as \"userId\",\n          u.first_name as \"firstName\",\n          u.last_name as \"lastName\",\n          u.company_name as \"companyName\",\n          u.email,\n          u.kyc_status as \"kycStatus\",\n          u.last_login_at as \"lastLoginAt\",\n          u.created_at as \"userCreatedAt\",\n          kvs.current_step as \"smartKycStep\",\n          kvs.session_outcome as \"smartKycOutcome\",\n          kvs.updated_at as \"smartKycLastActive\",\n          mks.status as \"manualKycStatus\",\n          mks.updated_at as \"manualKycLastActive\",\n          mks.id as \"manualSubmissionId\"\n        FROM users u\n        LEFT JOIN (\n          SELECT DISTINCT ON (user_id) * \n          FROM kyc_verification_sessions \n          ORDER BY user_id, updated_at DESC\n        ) kvs ON kvs.user_id = u.id\n        LEFT JOIN (\n          SELECT DISTINCT ON (user_id) *\n          FROM manual_kyc_submissions\n          ORDER BY user_id, updated_at DESC\n        ) mks ON mks.user_id = u.id\n        WHERE u.is_active = true \n          AND (u.kyc_status IS NULL OR u.kyc_status NOT IN ('verified', 'approved'))\n          AND (kvs.id IS NOT NULL OR mks.id IS NOT NULL)\n        ORDER BY COALESCE(kvs.updated_at, mks.updated_at, u.created_at) DESC\n        LIMIT 50\n      "], ["\n        SELECT \n          u.id as \"userId\",\n          u.first_name as \"firstName\",\n          u.last_name as \"lastName\",\n          u.company_name as \"companyName\",\n          u.email,\n          u.kyc_status as \"kycStatus\",\n          u.last_login_at as \"lastLoginAt\",\n          u.created_at as \"userCreatedAt\",\n          kvs.current_step as \"smartKycStep\",\n          kvs.session_outcome as \"smartKycOutcome\",\n          kvs.updated_at as \"smartKycLastActive\",\n          mks.status as \"manualKycStatus\",\n          mks.updated_at as \"manualKycLastActive\",\n          mks.id as \"manualSubmissionId\"\n        FROM users u\n        LEFT JOIN (\n          SELECT DISTINCT ON (user_id) * \n          FROM kyc_verification_sessions \n          ORDER BY user_id, updated_at DESC\n        ) kvs ON kvs.user_id = u.id\n        LEFT JOIN (\n          SELECT DISTINCT ON (user_id) *\n          FROM manual_kyc_submissions\n          ORDER BY user_id, updated_at DESC\n        ) mks ON mks.user_id = u.id\n        WHERE u.is_active = true \n          AND (u.kyc_status IS NULL OR u.kyc_status NOT IN ('verified', 'approved'))\n          AND (kvs.id IS NOT NULL OR mks.id IS NOT NULL)\n        ORDER BY COALESCE(kvs.updated_at, mks.updated_at, u.created_at) DESC\n        LIMIT 50\n      "]))))];
                    case 1:
                        rows = _a.sent();
                        return [2 /*return*/, (rows.rows || []).map(function (row) { return (__assign(__assign({}, row), { userName: row.companyName || [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email, recommendation: _this.getKycActionRecommendation(row) })); })];
                    case 2:
                        error_2 = _a.sent();
                        console.error("[ActivityInsights] Error fetching stuck KYC users:", error_2);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ActivityInsightsService.prototype.getKycActionRecommendation = function (user) {
        // Logic to determine priority and helper text
        if (user.manualKycStatus === 'pending') {
            return {
                action: 'REVIEW_MANUAL',
                priority: 'high',
                helperText: 'Manual KYC documents are pending your review.'
            };
        }
        if (user.smartKycStep === 'completed' && user.smartKycOutcome === 'failed') {
            return {
                action: 'STUCK_IN_SMART',
                priority: 'high',
                helperText: 'Smart KYC failed. Check documentation or aml risk level.'
            };
        }
        if (user.smartKycStep) {
            var stepNames = {
                'pan_verification': 'PAN Verification',
                'aadhaar_otp': 'Aadhaar OTP',
                'aadhaar_verification': 'Aadhaar Verification',
                'data_collection': 'Profile Completion'
            };
            return {
                action: 'ASSIST_USER',
                priority: 'medium',
                helperText: "User is stuck at ".concat(stepNames[user.smartKycStep] || user.smartKycStep, " step.")
            };
        }
        return {
            action: 'NUDGE_USER',
            priority: 'low',
            helperText: 'User has not started the KYC process recently.'
        };
    };
    return ActivityInsightsService;
}());
exports.activityInsightsService = new ActivityInsightsService();
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17;
