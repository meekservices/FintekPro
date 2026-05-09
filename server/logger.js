"use strict";
/**
 * Production-Grade Structured Logger
 *
 * Provides consistent, structured logging across the application
 * with support for different log levels, context, and metadata.
 *
 * In production, logs are JSON-formatted for easy parsing by log aggregators.
 * In development, logs are human-readable for better developer experience.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.logger = void 0;
var LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
};
var Logger = /** @class */ (function () {
    function Logger() {
        this.isProduction = process.env.NODE_ENV === 'production';
        this.minLevel = process.env.LOG_LEVEL || (this.isProduction ? 'info' : 'debug');
    }
    Logger.prototype.shouldLog = function (level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
    };
    Logger.prototype.formatLog = function (entry) {
        if (this.isProduction) {
            // JSON format for production (easy to parse by log aggregators)
            return JSON.stringify(entry);
        }
        else {
            // Human-readable format for development
            var emoji = {
                debug: '🐛',
                info: 'ℹ️',
                warn: '⚠️',
                error: '❌',
                fatal: '💀',
            }[entry.level];
            var output = "".concat(emoji, " [").concat(entry.level.toUpperCase(), "] ").concat(entry.message);
            if (entry.context && Object.keys(entry.context).length > 0) {
                output += " | ".concat(JSON.stringify(entry.context));
            }
            if (entry.error) {
                output += "\n  Error: ".concat(entry.error.message);
                if (entry.error.stack) {
                    output += "\n  Stack: ".concat(entry.error.stack);
                }
            }
            return output;
        }
    };
    Logger.prototype.log = function (level, message, context, error) {
        if (!this.shouldLog(level))
            return;
        var entry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            context: context,
        };
        if (error) {
            entry.error = {
                message: error.message,
                stack: error.stack,
                name: error.name,
            };
        }
        var formatted = this.formatLog(entry);
        // Output to appropriate stream
        if (level === 'error' || level === 'fatal') {
            console.error(formatted);
        }
        else if (level === 'warn') {
            console.warn(formatted);
        }
        else {
            console.log(formatted);
        }
    };
    Logger.prototype.debug = function (message, context) {
        this.log('debug', message, context);
    };
    Logger.prototype.info = function (message, context) {
        this.log('info', message, context);
    };
    Logger.prototype.warn = function (message, context) {
        this.log('warn', message, context);
    };
    Logger.prototype.error = function (message, contextOrError, error) {
        if (contextOrError instanceof Error) {
            this.log('error', message, undefined, contextOrError);
        }
        else {
            this.log('error', message, contextOrError, error);
        }
    };
    Logger.prototype.fatal = function (message, contextOrError, error) {
        if (contextOrError instanceof Error) {
            this.log('fatal', message, undefined, contextOrError);
        }
        else {
            this.log('fatal', message, contextOrError, error);
        }
    };
    // Convenience methods for common patterns
    Logger.prototype.http = function (method, path, statusCode, duration, context) {
        this.info("".concat(method, " ").concat(path, " ").concat(statusCode, " in ").concat(duration, "ms"), context);
    };
    Logger.prototype.service = function (serviceName, message, context) {
        this.info("[".concat(serviceName, "] ").concat(message), context);
    };
    Logger.prototype.serviceError = function (serviceName, message, error, context) {
        this.error("[".concat(serviceName, "] ").concat(message), context, error);
    };
    return Logger;
}());
// Export singleton instance
exports.logger = new Logger();
// Export convenience functions for backward compatibility
exports.log = {
    debug: function (msg, ctx) { return exports.logger.debug(msg, ctx); },
    info: function (msg, ctx) { return exports.logger.info(msg, ctx); },
    warn: function (msg, ctx) { return exports.logger.warn(msg, ctx); },
    error: function (msg, errOrCtx, err) { return exports.logger.error(msg, errOrCtx, err); },
    fatal: function (msg, errOrCtx, err) { return exports.logger.fatal(msg, errOrCtx, err); },
    http: function (method, path, status, duration, ctx) {
        return exports.logger.http(method, path, status, duration, ctx);
    },
    service: function (name, msg, ctx) { return exports.logger.service(name, msg, ctx); },
    serviceError: function (name, msg, err, ctx) {
        return exports.logger.serviceError(name, msg, err, ctx);
    },
};
