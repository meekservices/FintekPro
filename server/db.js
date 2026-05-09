"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = exports.isUsingProductionDb = void 0;
exports.getPoolStats = getPoolStats;
exports.testConnection = testConnection;
exports.isPoolClosed = isPoolClosed;
exports.closePool = closePool;
var pg_1 = __importDefault(require("pg"));
var Pool = pg_1.default.Pool;
var node_postgres_1 = require("drizzle-orm/node-postgres");
var schema = __importStar(require("@shared/schema"));
var logger_1 = require("./logger");
var fs_1 = __importDefault(require("fs"));
// Determine environment first — URL selection depends on it.
var isProduction = process.env.NODE_ENV === 'production';
// Connection strategy:
//   PRODUCTION_DATABASE_URL or DATABASE_URL MUST be set (GCP Cloud SQL)
var selectedDbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
if (!selectedDbUrl) {
    throw new Error("No database URL found. Set PRODUCTION_DATABASE_URL or DATABASE_URL in your environment secrets.");
}
exports.isUsingProductionDb = true; // Always true now since we only use the production DB
// SSL config based on URL type:
//   Neon (neon.tech)               → SSL with cert verification (managed CA)
//   Railway public (rlwy.net)      → SSL with cert verification (managed CA)
//   Railway internal (.internal)   → no SSL (private network, no cert needed)
//   Local / Replit Helium          → no SSL
// Force SSL for all non-local production URLs unless using Unix sockets
var instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME || 'fintekpro:asia-south1:fintekpro-db';
// Cloud Run standard path for Cloud SQL sockets is /cloudsql/<INSTANCE_CONNECTION_NAME>
// However, the actual socket file is inside that directory as .s.PGSQL.5432
var cloudSqlSocketDir = "/cloudsql/".concat(instanceConnectionName);
var isCloudSqlSocketAvailable = fs_1.default.existsSync(cloudSqlSocketDir);
// SSL is ONLY needed if:
// 1. Not using a Unix socket
// 2. Not connecting to localhost/127.0.0.1 (proxy)
// 3. The URL actually supports/needs it
var needsSsl = !isCloudSqlSocketAvailable &&
    !selectedDbUrl.includes('localhost') &&
    !selectedDbUrl.includes('127.0.0.1') &&
    !selectedDbUrl.includes('host=');
if (isCloudSqlSocketAvailable) {
    console.log("[DB] \uD83D\uDFE2 Detected Cloud SQL Unix Socket directory: ".concat(cloudSqlSocketDir));
}
else {
    console.warn("[DB] \uD83D\uDFE1 Unix Socket directory not found at ".concat(cloudSqlSocketDir, ". (ENV: ").concat(process.env.NODE_ENV, ", INSTANCE: ").concat(instanceConnectionName, ")"));
}
var POOL_CONFIG = {
    max: isProduction ? 20 : 5,
    min: isProduction ? 2 : 0,
    idleTimeoutMillis: isProduction ? 60000 : 30000,
    connectionTimeoutMillis: 15000, // Increased to 15s for Cloud SQL cold-start tolerance
    statement_timeout: isProduction ? 30000 : 60000,
    allowExitOnIdle: false,
    ssl: needsSsl ? {
        rejectUnauthorized: false,
        servername: ((_b = (_a = selectedDbUrl.split('@')[1]) === null || _a === void 0 ? void 0 : _a.split('/')[0]) === null || _b === void 0 ? void 0 : _b.split(':')[0]) || ''
    } : false,
};
// Extract connection parameters robustly
var user = '';
var password = '';
var database = 'fintekpro';
try {
    // Manual parsing to handle missing hostnames (common for Unix socket URLs)
    // Format: postgresql://user:password@/database?options
    var protocolEnd = selectedDbUrl.indexOf('://');
    var pathStart = selectedDbUrl.indexOf('/', protocolEnd + 3);
    var lastAt = selectedDbUrl.lastIndexOf('@', pathStart === -1 ? undefined : pathStart);
    if (lastAt > protocolEnd) {
        var userinfo = selectedDbUrl.substring(protocolEnd + 3, lastAt);
        var colonIndex = userinfo.indexOf(':');
        if (colonIndex !== -1) {
            user = decodeURIComponent(userinfo.substring(0, colonIndex));
            password = decodeURIComponent(userinfo.substring(colonIndex + 1));
        }
        else {
            user = decodeURIComponent(userinfo);
        }
        if (pathStart !== -1) {
            var dbPart = selectedDbUrl.substring(pathStart + 1).split('?')[0];
            if (dbPart)
                database = dbPart;
        }
    }
    else {
        // Fallback to URL parser if simple parsing fails
        var url = new URL(selectedDbUrl.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
        user = decodeURIComponent(url.username);
        password = decodeURIComponent(url.password);
        database = url.pathname.split('/')[1] || 'fintekpro';
    }
}
catch (e) {
    console.warn("[DB] \uD83D\uDFE1 Non-fatal: Manual URL parsing failed (".concat(e.message, "). Falling back to connection string."));
}
if (isCloudSqlSocketAvailable) {
    // On Cloud Run, the socket is inside the instance-named directory
    POOL_CONFIG.host = cloudSqlSocketDir;
    POOL_CONFIG.port = 5432;
    POOL_CONFIG.user = user;
    POOL_CONFIG.password = password;
    POOL_CONFIG.database = database;
    console.log("[DB] \uD83D\uDFE2 Configured for Unix Socket: host=".concat(POOL_CONFIG.host, ", user=").concat(POOL_CONFIG.user, ", db=").concat(POOL_CONFIG.database));
}
else {
    // Fallback to connection string or explicit host
    if (selectedDbUrl.includes('host=')) {
        // Special case: connection string already specifies host (e.g. for local proxy)
        POOL_CONFIG.connectionString = selectedDbUrl;
        console.log("[DB] Using connection string with explicit host param");
    }
    else {
        POOL_CONFIG.connectionString = selectedDbUrl;
        var maskedHost = ((_c = selectedDbUrl.split('@')[1]) === null || _c === void 0 ? void 0 : _c.split('/')[0]) || 'localhost';
        console.log("[DB] Using TCP connection to ".concat(maskedHost));
    }
}
exports.pool = new Pool(POOL_CONFIG);
var poolHealthWarnings = 0;
var waitingWarnings = 0;
var MAX_WARNINGS_BEFORE_LOG = 5;
var lastPoolErrorTime = 0;
var poolErrorCount = 0;
exports.pool.on('error', function (err) {
    var now = Date.now();
    poolErrorCount++;
    if (now - lastPoolErrorTime > 10000) {
        var suffix = poolErrorCount > 1 ? " (".concat(poolErrorCount, " errors in last batch)") : '';
        logger_1.logger.warn("[DB Pool] Connection error (auto-recovering): ".concat((err === null || err === void 0 ? void 0 : err.message) || err).concat(suffix));
        lastPoolErrorTime = now;
        poolErrorCount = 0;
    }
});
var connectCount = 0;
exports.pool.on('connect', function () {
    connectCount++;
    if (connectCount <= 5 || connectCount % 10 === 0) {
        logger_1.logger.debug("[DB Pool] Client connected (total: ".concat(connectCount, ")"));
    }
});
function checkPoolHealth() {
    var waiting = exports.pool.waitingCount;
    var total = exports.pool.totalCount;
    var idle = exports.pool.idleCount;
    var maxConnections = POOL_CONFIG.max;
    if (total > 0 && (total - idle) / maxConnections > 0.8) {
        poolHealthWarnings++;
        if (poolHealthWarnings >= MAX_WARNINGS_BEFORE_LOG) {
            logger_1.logger.warn("[DB Pool] Pool health warning: ".concat(total - idle, "/").concat(maxConnections, " connections in use, ").concat(waiting, " waiting, ").concat(idle, " idle"));
            poolHealthWarnings = 0;
        }
    }
    else {
        poolHealthWarnings = 0;
    }
    if (waiting > 0) {
        waitingWarnings++;
        if (waitingWarnings >= MAX_WARNINGS_BEFORE_LOG) {
            logger_1.logger.warn("[DB Pool] ".concat(waiting, " clients waiting for connections (pool: ").concat(total - idle, "/").concat(maxConnections, " active, ").concat(idle, " idle)"));
            waitingWarnings = 0;
        }
    }
    else {
        waitingWarnings = 0;
    }
}
setInterval(checkPoolHealth, 30000);
exports.db = (0, node_postgres_1.drizzle)({ client: exports.pool, schema: schema });
function getPoolStats() {
    return {
        totalCount: exports.pool.totalCount,
        idleCount: exports.pool.idleCount,
        waitingCount: exports.pool.waitingCount,
        maxConnections: POOL_CONFIG.max,
        utilizationPercent: exports.pool.totalCount > 0
            ? Math.round(((exports.pool.totalCount - exports.pool.idleCount) / POOL_CONFIG.max) * 100)
            : 0
    };
}
function testConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var source;
        return __generator(this, function (_a) {
            source = 'PRODUCTION_DATABASE_URL';
            console.log("[DB] Attempting to verify connection to ".concat(source, "..."));
            return [2 /*return*/, new Promise(function (resolve) {
                    // 15-second safety timeout for the connection test itself
                    var timeout = setTimeout(function () {
                        console.error("[DB] Connection test TIMED OUT after 15s. Format may be incorrect or database unreachable.");
                        resolve(false);
                    }, 15000);
                    exports.pool.connect()
                        .then(function (client) {
                        return client.query('SELECT 1')
                            .then(function () {
                            client.release();
                            clearTimeout(timeout);
                            console.log('[DB] Connection verified successfully');
                            resolve(true);
                        })
                            .catch(function (err) {
                            client.release();
                            clearTimeout(timeout);
                            console.error("[DB] Query failed during connection test: ".concat(err.message));
                            resolve(false);
                        });
                    })
                        .catch(function (err) {
                        clearTimeout(timeout);
                        console.error("[DB] Pool connection failed: ".concat(err.message));
                        resolve(false);
                    });
                })];
        });
    });
}
// Tracks whether pool.end() has been called — background jobs check this
// before making DB calls during shutdown so they can bail gracefully.
var _poolClosing = false;
function isPoolClosed() {
    return _poolClosing;
}
function closePool() {
    return __awaiter(this, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Set flag BEFORE calling pool.end() so in-flight jobs see it immediately
                    _poolClosing = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, exports.pool.end()];
                case 2:
                    _a.sent();
                    logger_1.logger.info('[DB Pool] Pool closed gracefully');
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    // Ignore \"pool already ended\" errors — can happen on repeated SIGTERM
                    if (!((err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || '').includes('end on the pool')) {
                        logger_1.logger.error('[DB Pool] Error closing pool', { error: (err_1 === null || err_1 === void 0 ? void 0 : err_1.message) || String(err_1) });
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
