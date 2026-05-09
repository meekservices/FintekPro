"use strict";
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
exports.requestLatencyTracker = void 0;
exports.latencyTrackingMiddleware = latencyTrackingMiddleware;
var SLOW_THRESHOLD_MS = 2000;
var MAX_RECENT_LATENCIES = 100;
var MAX_TRACKED_ENDPOINTS = 200;
var RequestLatencyTracker = /** @class */ (function () {
    function RequestLatencyTracker() {
        this.endpoints = new Map();
    }
    RequestLatencyTracker.prototype.recordLatency = function (method, path, latencyMs) {
        var _a;
        var normalizedPath = this.normalizePath(path);
        var key = "".concat(method, " ").concat(normalizedPath);
        var entry = this.endpoints.get(key);
        if (!entry) {
            if (this.endpoints.size >= MAX_TRACKED_ENDPOINTS) {
                var oldestKey = (_a = Array.from(this.endpoints.entries())
                    .sort(function (_a, _b) {
                    var a = _a[1];
                    var b = _b[1];
                    return a.lastUpdated.getTime() - b.lastUpdated.getTime();
                })[0]) === null || _a === void 0 ? void 0 : _a[0];
                if (oldestKey)
                    this.endpoints.delete(oldestKey);
            }
            entry = {
                endpoint: normalizedPath,
                method: method,
                totalRequests: 0,
                totalLatencyMs: 0,
                maxLatencyMs: 0,
                p95LatencyMs: 0,
                recentLatencies: [],
                lastUpdated: new Date()
            };
            this.endpoints.set(key, entry);
        }
        entry.totalRequests++;
        entry.totalLatencyMs += latencyMs;
        entry.maxLatencyMs = Math.max(entry.maxLatencyMs, latencyMs);
        entry.lastUpdated = new Date();
        entry.recentLatencies.push(latencyMs);
        if (entry.recentLatencies.length > MAX_RECENT_LATENCIES) {
            entry.recentLatencies = entry.recentLatencies.slice(-MAX_RECENT_LATENCIES);
        }
        var sorted = __spreadArray([], entry.recentLatencies, true).sort(function (a, b) { return a - b; });
        entry.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] || latencyMs;
    };
    RequestLatencyTracker.prototype.getSlowEndpoints = function (thresholdMs) {
        var _this = this;
        if (thresholdMs === void 0) { thresholdMs = SLOW_THRESHOLD_MS; }
        var slow = [];
        for (var _i = 0, _a = this.endpoints; _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], entry = _b[1];
            if (entry.totalRequests < 3)
                continue;
            var avgMs = entry.totalLatencyMs / entry.totalRequests;
            if (avgMs > thresholdMs || entry.p95LatencyMs > thresholdMs) {
                slow.push({ key: key, avgMs: avgMs });
            }
        }
        return slow
            .sort(function (a, b) { return b.avgMs - a.avgMs; })
            .slice(0, 10)
            .map(function (s) {
            var entry = _this.endpoints.get(s.key);
            return "".concat(s.key, " (avg: ").concat(Math.round(s.avgMs), "ms, p95: ").concat(entry.p95LatencyMs, "ms, max: ").concat(entry.maxLatencyMs, "ms)");
        });
    };
    RequestLatencyTracker.prototype.getMetrics = function () {
        return Array.from(this.endpoints.values())
            .filter(function (e) { return e.totalRequests >= 3; })
            .map(function (e) { return ({
            endpoint: e.endpoint,
            method: e.method,
            avgLatencyMs: Math.round(e.totalLatencyMs / e.totalRequests),
            p95LatencyMs: e.p95LatencyMs,
            maxLatencyMs: e.maxLatencyMs,
            totalRequests: e.totalRequests
        }); })
            .sort(function (a, b) { return b.avgLatencyMs - a.avgLatencyMs; });
    };
    RequestLatencyTracker.prototype.normalizePath = function (path) {
        return path
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
            .replace(/\/\d+/g, '/:id')
            .replace(/\?.*$/, '');
    };
    return RequestLatencyTracker;
}());
exports.requestLatencyTracker = new RequestLatencyTracker();
function latencyTrackingMiddleware(req, res, next) {
    if (!req.path.startsWith('/api')) {
        next();
        return;
    }
    var startTime = process.hrtime.bigint();
    var originalEnd = res.end;
    res.end = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var endTime = process.hrtime.bigint();
        var latencyMs = Number(endTime - startTime) / 1000000;
        exports.requestLatencyTracker.recordLatency(req.method, req.path, latencyMs);
        return originalEnd.apply(this, args);
    };
    next();
}
