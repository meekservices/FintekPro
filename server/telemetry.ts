/**
 * @file telemetry.ts
 * @description FintekPro Institutional Distributed Tracing & W3C Trace Context.
 *
 * Adheres strictly to FintekPro Institutional Tier-1 Architecture:
 * - W3C Trace Context propagation (traceparent header: 00-trace_id-parent_id-flags)
 * - Distributed request correlation across Cloud Run pods and external Broker gateways
 * - High-precision span timing for database queries and external HTTP calls
 */

import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

export interface TraceContext {
	traceId: string;
	spanId: string;
	parentSpanId?: string;
	traceFlags: string;
}

export class TelemetryTracer {
	/**
	 * Generates a standard W3C 128-bit trace ID (32 hex characters)
	 */
	static generateTraceId(): string {
		return randomBytes(16).toString("hex");
	}

	/**
	 * Generates a standard W3C 64-bit span ID (16 hex characters)
	 */
	static generateSpanId(): string {
		return randomBytes(8).toString("hex");
	}

	/**
	 * Parse incoming W3C traceparent header or generate a new root trace
	 * Format: version-trace_id-parent_id-trace_flags (e.g. 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
	 */
	static extractOrStartTrace(header?: string): TraceContext {
		if (header && typeof header === "string") {
			const parts = header.trim().split("-");
			if (parts.length === 4 && parts[0] === "00") {
				return {
					traceId: parts[1],
					parentSpanId: parts[2],
					spanId: TelemetryTracer.generateSpanId(),
					traceFlags: parts[3],
				};
			}
		}

		return {
			traceId: TelemetryTracer.generateTraceId(),
			spanId: TelemetryTracer.generateSpanId(),
			traceFlags: "01", // sampled
		};
	}

	/**
	 * Serialize TraceContext into W3C traceparent string
	 */
	static formatTraceParent(context: TraceContext): string {
		return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
	}
}

/**
 * Express Middleware for W3C Distributed Tracing
 */
export function distributedTracingMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const rawHeader = req.headers["traceparent"] as string | undefined;
	const traceContext = TelemetryTracer.extractOrStartTrace(rawHeader);

	// Attach trace properties to request
	(req as any).traceContext = traceContext;
	(req as any).traceId = traceContext.traceId;

	// Stamp outgoing response headers
	res.setHeader("x-trace-id", traceContext.traceId);
	res.setHeader("traceparent", TelemetryTracer.formatTraceParent(traceContext));

	const startTime = Date.now();
	res.on("finish", () => {
		const durationMs = Date.now() - startTime;
		if (durationMs > 500) {
			logger.warn("[Tracing] High latency transaction detected", {
				traceId: traceContext.traceId,
				path: req.originalUrl,
				method: req.method,
				statusCode: res.statusCode,
				durationMs,
			});
		}
	});

	next();
}
