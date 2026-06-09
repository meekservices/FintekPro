import { Request, Response, NextFunction } from "express";

interface EndpointLatency {
	endpoint: string;
	method: string;
	totalRequests: number;
	totalLatencyMs: number;
	maxLatencyMs: number;
	p95LatencyMs: number;
	recentLatencies: number[];
	lastUpdated: Date;
}

const SLOW_THRESHOLD_MS = 2000;
const MAX_RECENT_LATENCIES = 100;
const MAX_TRACKED_ENDPOINTS = 200;

class RequestLatencyTracker {
	private endpoints: Map<string, EndpointLatency> = new Map();

	recordLatency(method: string, path: string, latencyMs: number): void {
		const normalizedPath = this.normalizePath(path);
		const key = `${method} ${normalizedPath}`;

		let entry = this.endpoints.get(key);
		if (!entry) {
			if (this.endpoints.size >= MAX_TRACKED_ENDPOINTS) {
				const oldestKey = Array.from(this.endpoints.entries()).sort(
					([, a], [, b]) => a.lastUpdated.getTime() - b.lastUpdated.getTime(),
				)[0]?.[0];
				if (oldestKey) this.endpoints.delete(oldestKey);
			}

			entry = {
				endpoint: normalizedPath,
				method,
				totalRequests: 0,
				totalLatencyMs: 0,
				maxLatencyMs: 0,
				p95LatencyMs: 0,
				recentLatencies: [],
				lastUpdated: new Date(),
			};
			this.endpoints.set(key, entry);
		}

		entry.totalRequests++;
		entry.totalLatencyMs += latencyMs;
		entry.maxLatencyMs = Math.max(entry.maxLatencyMs, latencyMs);
		entry.lastUpdated = new Date();

		entry.recentLatencies.push(latencyMs);
		if (entry.recentLatencies.length > MAX_RECENT_LATENCIES) {
			entry.recentLatencies = entry.recentLatencies.slice(
				-MAX_RECENT_LATENCIES,
			);
		}

		const sorted = [...entry.recentLatencies].sort((a, b) => a - b);
		entry.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] || latencyMs;
	}

	getSlowEndpoints(thresholdMs: number = SLOW_THRESHOLD_MS): string[] {
		const slow: Array<{ key: string; avgMs: number }> = [];

		for (const [key, entry] of this.endpoints) {
			if (entry.totalRequests < 3) continue;
			const avgMs = entry.totalLatencyMs / entry.totalRequests;
			if (avgMs > thresholdMs || entry.p95LatencyMs > thresholdMs) {
				slow.push({ key, avgMs });
			}
		}

		return slow
			.sort((a, b) => b.avgMs - a.avgMs)
			.slice(0, 10)
			.map((s) => {
				const entry = this.endpoints.get(s.key)!;
				return `${s.key} (avg: ${Math.round(s.avgMs)}ms, p95: ${entry.p95LatencyMs}ms, max: ${entry.maxLatencyMs}ms)`;
			});
	}

	getMetrics(): Array<{
		endpoint: string;
		method: string;
		avgLatencyMs: number;
		p95LatencyMs: number;
		maxLatencyMs: number;
		totalRequests: number;
	}> {
		return Array.from(this.endpoints.values())
			.filter((e) => e.totalRequests >= 3)
			.map((e) => ({
				endpoint: e.endpoint,
				method: e.method,
				avgLatencyMs: Math.round(e.totalLatencyMs / e.totalRequests),
				p95LatencyMs: e.p95LatencyMs,
				maxLatencyMs: e.maxLatencyMs,
				totalRequests: e.totalRequests,
			}))
			.sort((a, b) => b.avgLatencyMs - a.avgLatencyMs);
	}

	private normalizePath(path: string): string {
		return path
			.replace(
				/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
				"/:id",
			)
			.replace(/\/\d+/g, "/:id")
			.replace(/\?.*$/, "");
	}
}

export const requestLatencyTracker = new RequestLatencyTracker();

export function latencyTrackingMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	if (!req.path.startsWith("/api")) {
		next();
		return;
	}

	const startTime = process.hrtime.bigint();

	const originalEnd = res.end;
	res.end = function (this: Response, ...args: any[]) {
		const endTime = process.hrtime.bigint();
		const latencyMs = Number(endTime - startTime) / 1_000_000;

		requestLatencyTracker.recordLatency(req.method, req.path, latencyMs);

		return originalEnd.apply(this, args as any);
	} as any;

	next();
}
