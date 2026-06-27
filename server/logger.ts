/* eslint-disable no-console */
/**
 * Production-Grade Structured Logger
 *
 * Provides consistent, structured logging across the application
 * with support for different log levels, context, and metadata.
 *
 * In production, logs are JSON-formatted for easy parsing by log aggregators.
 * In development, logs are human-readable for better developer experience.
 *
 * PII GUARDRAIL (production only): console.* is overridden to mask
 * PAN, Aadhaar, Indian phone numbers, and email addresses before any
 * string reaches Cloud Logging.
 *
 * NOTE: console.* is intentionally used here — this IS the logger transport.
 * The no-console ESLint rule is disabled at file scope for this reason.
 */

import { db } from "./db";
import { aiGovernanceAuditLogs } from "../shared/schema/ai";
import { aiAuditLogs } from "../shared/schema/admin-copilot";
import { v4 as uuidv4 } from "uuid";
import { randomUUID } from "crypto";
import {
	GovernanceInput,
	GovernanceOutput,
} from "./services/ai-governance/types";

export interface AuditEntry {
	userId?: string;
	userRole?: string;
	agentType: string;
	agentAction: string;
	entityId?: string;
	entityType?: string;
	inputContext?: Record<string, unknown>;
	outputSummary?: string;
	confidenceScore?: number;
	modelVersion?: string;
	approvalStatus?: string;
	approvingAdmin?: string;
	externalApiCalled?: boolean;
	externalService?: string;
	externalCallStatus?: string;
	externalCallMs?: number;
	latencyMs?: number;
	status?: string;
	errorCode?: string;
	errorMessage?: string;
	retryable?: boolean;
	source?: string;
}

export class AIGovernanceAuditLogger {
	async logGovernanceDecision(
		input: GovernanceInput,
		output: GovernanceOutput,
		traceId?: string,
	): Promise<string> {
		const auditId = uuidv4();

		// We do not await this insertion, it fires in the background (fire-and-forget) to minimize latency overhead < 300ms
		db.insert(aiGovernanceAuditLogs)
			.values({
				auditId,
				userId: input.user_id,
				inputQuery: input.query,
				aiRawOutput: input.ai_output || {},
				finalOutput: output.final_output,
				decision: output.decision,
				violations: output.violations,
				riskFlags: output.risk_flags || [],
				modelVersion: input.ai_output?.model_version || "unknown-version",
				traceId: traceId || input.trace_id || auditId,
			})
			.execute()
			.catch((err) => {
				console.error(
					`[AAGE Critical Failure] Failed to append AI Governance Log: ${err.message}`,
				);
			});

		return auditId;
	}
}

export const aiGovernanceAuditLogger = new AIGovernanceAuditLogger();

export async function auditLog(entry: AuditEntry): Promise<string> {
	const auditId = randomUUID();

	try {
		await db.insert(aiAuditLogs).values({
			...entry,
			id: auditId,
			modelVersion: entry.modelVersion ?? "gemini-2.0-flash",
			source: entry.source ?? "api",
			status: entry.status ?? "success",
		});
	} catch (dbErr: any) {
		// Fallback: emit to Cloud Logging — never fail the caller
		console.error("[AuditLogger] DB insert failed — fallback to console log", {
			auditId,
			agentType: entry.agentType,
			agentAction: entry.agentAction,
			error: dbErr?.message,
		});
		console.log("[AUDIT_FALLBACK]", JSON.stringify({ auditId, ...entry }));
	}

	return auditId;
}

export function logCopilotEvent(
	event: string,
	userId: string | undefined,
	latencyMs: number,
	status: "success" | "failure" | "partial",
	extra?: Record<string, unknown>,
): void {
	console.log(
		JSON.stringify({
			event,
			user_id: userId,
			latency_ms: latencyMs,
			status,
			...extra,
			timestamp: new Date().toISOString(),
		}),
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// PII Scrubber — production console override
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex patterns for sensitive Indian financial data.
 * Applied in order — more specific patterns first.
 */
const PII_PATTERNS: [RegExp, string][] = [
	// PAN: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)
	[/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, "[PAN-REDACTED]"],
	// Aadhaar: exactly 12 consecutive digits (not part of a longer number)
	[/(?<!\d)\d{12}(?!\d)/g, "[AADHAAR-REDACTED]"],
	// Indian mobile: optional +91/91/0 prefix, then 10-digit starting 6-9
	[/(?:\+91|91|0)?[6-9]\d{9}\b/g, "[PHONE-REDACTED]"],
	// Email address
	[/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[EMAIL-REDACTED]"],
	// IFSC code (4 letters + 0 + 6 alphanumeric)
	[/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[IFSC-REDACTED]"],
	// Bank account-like numbers: 9-18 consecutive digits
	[/(?<![.\d])\d{9,18}(?![.\d])/g, "[ACCOUNT-REDACTED]"],
];

function scrubPii(raw: string): string {
	let out = raw;
	for (const [pattern, replacement] of PII_PATTERNS) {
		out = out.replace(pattern, replacement);
	}
	return out;
}

function safeJson(arg: unknown): string {
	const seen = new WeakSet();
	return (
		JSON.stringify(arg, (_key, value) => {
			if (typeof value === "object" && value !== null) {
				if (seen.has(value)) return "[Circular]";
				seen.add(value);
			}
			return value;
		}) ?? String(arg)
	);
}

function serializeArg(arg: unknown): string {
	if (arg === null) return "null";
	if (arg === undefined) return "undefined";
	if (typeof arg === "string") return arg;
	if (arg instanceof Error)
		return `${arg.name}: ${arg.message}${arg.stack ? "\n" + arg.stack : ""}`;
	if (Array.isArray(arg)) return safeJson(arg);
	if (typeof arg === "object") return safeJson(arg);
	return String(arg);
}

/**
 * Overrides console.log/warn/error/info/debug in production to scrub PII
 * before any string reaches Cloud Logging / stdout.
 *
 * Call order: caller → scrubPii → original console method.
 * No-op in development.
 *
 * @purpose  Prevent PAN, Aadhaar, phone, email from leaking into Cloud Logging
 * @inputs   NODE_ENV
 * @outputs  Mutates global console (production only)
 * @edge     Large objects are JSON.stringify'd — circular refs are caught
 */
function installPiiScrubber(): void {
	if (process.env.NODE_ENV !== "production") return;

	const methods = ["log", "warn", "error", "info", "debug"] as const;

	for (const method of methods) {
		const original = console[method].bind(console);
		console[method] = (...args: unknown[]) => {
			const scrubbed = args.map((a) => scrubPii(serializeArg(a)));
			original(...scrubbed);
		};
	}
}

// Install immediately at module load (before any other logger usage)
installPiiScrubber();

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

interface LogContext {
	[key: string]: any;
}

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: LogContext;
	error?: {
		message: string;
		stack?: string;
		name?: string;
	};
}

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	fatal: 4,
};

class Logger {
	private minLevel: LogLevel;
	private isProduction: boolean;

	constructor() {
		this.isProduction = process.env.NODE_ENV === "production";
		this.minLevel =
			(process.env.LOG_LEVEL as LogLevel) ||
			(this.isProduction ? "info" : "debug");
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
	}

	private formatLog(entry: LogEntry): string {
		if (this.isProduction) {
			// JSON format for production (easy to parse by log aggregators)
			return JSON.stringify(entry);
		}
		// Human-readable format for development
		const emoji = {
			debug: "🐛",
			info: "ℹ️",
			warn: "⚠️",
			error: "❌",
			fatal: "💀",
		}[entry.level];

		let output = `${emoji} [${entry.level.toUpperCase()}] ${entry.message}`;

		if (entry.context && Object.keys(entry.context).length > 0) {
			output += ` | ${JSON.stringify(entry.context)}`;
		}

		if (entry.error) {
			output += `\n  Error: ${entry.error.message}`;
			if (entry.error.stack) {
				output += `\n  Stack: ${entry.error.stack}`;
			}
		}

		return output;
	}

	private log(
		level: LogLevel,
		message: string,
		context?: LogContext,
		error?: Error,
	): void {
		if (!this.shouldLog(level)) return;

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			context,
		};

		if (error) {
			entry.error = {
				message: error.message,
				stack: error.stack,
				name: error.name,
			};
		}

		const formatted = this.formatLog(entry);

		// Output to appropriate stream
		if (level === "error" || level === "fatal") {
			console.error(formatted);
		} else if (level === "warn") {
			console.warn(formatted);
		} else {
			console.log(formatted);
		}
	}

	debug(message: string, context?: LogContext): void {
		this.log("debug", message, context);
	}

	info(message: string, context?: LogContext): void {
		this.log("info", message, context);
	}

	warn(message: string, context?: LogContext): void {
		this.log("warn", message, context);
	}

	error(
		message: string,
		contextOrError?: LogContext | Error,
		error?: Error,
	): void {
		if (contextOrError instanceof Error) {
			this.log("error", message, undefined, contextOrError);
		} else {
			this.log("error", message, contextOrError, error);
		}
	}

	fatal(
		message: string,
		contextOrError?: LogContext | Error,
		error?: Error,
	): void {
		if (contextOrError instanceof Error) {
			this.log("fatal", message, undefined, contextOrError);
		} else {
			this.log("fatal", message, contextOrError, error);
		}
	}

	// Convenience methods for common patterns
	http(
		method: string,
		path: string,
		statusCode: number,
		duration: number,
		context?: LogContext,
	): void {
		this.info(`${method} ${path} ${statusCode} in ${duration}ms`, context);
	}

	service(serviceName: string, message: string, context?: LogContext): void {
		this.info(`[${serviceName}] ${message}`, context);
	}

	serviceError(
		serviceName: string,
		message: string,
		error?: Error,
		context?: LogContext,
	): void {
		this.error(`[${serviceName}] ${message}`, context, error);
	}
}

// Export singleton instance
export const logger = new Logger();

// Export the scrubber for testing
export { scrubPii };

// Export convenience functions for backward compatibility
export const log = {
	debug: (msg: string, ctx?: LogContext) => logger.debug(msg, ctx),
	info: (msg: string, ctx?: LogContext) => logger.info(msg, ctx),
	warn: (msg: string, ctx?: LogContext) => logger.warn(msg, ctx),
	error: (msg: string, errOrCtx?: Error | LogContext, err?: Error) =>
		logger.error(msg, errOrCtx, err),
	fatal: (msg: string, errOrCtx?: Error | LogContext, err?: Error) =>
		logger.fatal(msg, errOrCtx, err),
	http: (
		method: string,
		path: string,
		status: number,
		duration: number,
		ctx?: LogContext,
	) => logger.http(method, path, status, duration, ctx),
	service: (name: string, msg: string, ctx?: LogContext) =>
		logger.service(name, msg, ctx),
	serviceError: (name: string, msg: string, err?: Error, ctx?: LogContext) =>
		logger.serviceError(name, msg, err, ctx),
};

// ─────────────────────────────────────────────────────────────────────────────
// Cron Job Structured Logger Helper
// GCR Rule: "Every module must emit structured logs: { event, latency_ms, status }"
// ─────────────────────────────────────────────────────────────────────────────

export interface CronJobResult {
	/** Records inserted / updated / processed */
	recordsProcessed?: number;
	/** Optional details map for additional context */
	details?: Record<string, unknown>;
}

/**
 * Emits a GCR-compliant structured log entry for a cron job execution.
 *
 * @param jobName - Human-readable job identifier (e.g. "daily-error-digest")
 * @param startMs - Date.now() captured at the start of the job
 * @param status  - "success" | "failure" | "skipped"
 * @param result  - Optional counts and details
 * @param err     - Optional error (logged at error level if provided)
 *
 * @example
 * const t0 = Date.now();
 * try {
 *   const n = await runJob();
 *   logCronJob("my-job", t0, "success", { recordsProcessed: n });
 * } catch (e) {
 *   logCronJob("my-job", t0, "failure", {}, e as Error);
 * }
 */
export function logCronJob(
	jobName: string,
	startMs: number,
	status: "success" | "failure" | "skipped",
	result: CronJobResult = {},
	err?: Error,
): void {
	const latency_ms = Date.now() - startMs;
	const entry = {
		event: "CRON_JOB_COMPLETE",
		job_name: jobName,
		status,
		latency_ms,
		records_processed: result.recordsProcessed ?? 0,
		...result.details,
		timestamp: new Date().toISOString(),
	};

	if (status === "failure" && err) {
		logger.error(`[CRON:${jobName}] Job failed`, { ...entry }, err);
	} else if (status === "skipped") {
		logger.info(`[CRON:${jobName}] Job skipped`, entry);
	} else {
		logger.info(`[CRON:${jobName}] Job complete`, entry);
	}
}

