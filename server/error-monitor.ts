import {
	analyzeSystemErrors,
	analyzeCodeErrors,
	generateReplitAgentInstructions,
} from "./gemini-service";

export interface ErrorReport {
	timestamp: Date;
	errorType: string;
	severity: "critical" | "high" | "medium" | "low";
	source: string;
	message: string;
	stackTrace?: string;
	context?: any;
}

export interface SystemHealthStatus {
	overall: "healthy" | "degraded" | "critical";
	apis: { [key: string]: "up" | "down" | "slow" };
	database: "connected" | "disconnected" | "slow";
	errors: ErrorReport[];
	performance: {
		avgResponseTime: number;
		errorRate: number;
		uptime: number;
	};
}

class ErrorMonitor {
	private errors: ErrorReport[] = [];
	private systemHealth: SystemHealthStatus = {
		overall: "healthy",
		apis: {},
		database: "connected",
		errors: [],
		performance: {
			avgResponseTime: 0,
			errorRate: 0,
			uptime: 100,
		},
	};

	private startTime = Date.now();
	private responseTimes: number[] = [];
	private totalRequests = 0;
	private totalErrors = 0;

	// Record API response time
	recordResponseTime(duration: number) {
		this.responseTimes.push(duration);
		this.totalRequests++;

		// Keep only last 1000 measurements for performance
		if (this.responseTimes.length > 1000) {
			this.responseTimes.shift();
		}

		this.updatePerformanceMetrics();
	}

	// Record error
	recordError(error: ErrorReport) {
		this.errors.push(error);
		this.totalErrors++;

		// Keep only last 100 errors
		if (this.errors.length > 100) {
			this.errors.shift();
		}

		this.updateSystemHealth();
	}

	// Update performance metrics
	private updatePerformanceMetrics() {
		if (this.responseTimes.length > 0) {
			this.systemHealth.performance.avgResponseTime =
				this.responseTimes.reduce((a, b) => a + b, 0) /
				this.responseTimes.length;
		}

		this.systemHealth.performance.errorRate =
			this.totalRequests > 0
				? (this.totalErrors / this.totalRequests) * 100
				: 0;

		const uptimeMs = Date.now() - this.startTime;
		this.systemHealth.performance.uptime = Math.min(
			100,
			(uptimeMs / (24 * 60 * 60 * 1000)) * 100,
		);
	}

	// Update overall system health
	private updateSystemHealth() {
		const criticalErrors = this.errors.filter(
			(e) => e.severity === "critical",
		).length;
		const highErrors = this.errors.filter((e) => e.severity === "high").length;

		if (criticalErrors > 0) {
			this.systemHealth.overall = "critical";
		} else if (highErrors > 2 || this.systemHealth.performance.errorRate > 5) {
			this.systemHealth.overall = "degraded";
		} else {
			this.systemHealth.overall = "healthy";
		}

		this.systemHealth.errors = this.errors.slice(-10); // Last 10 errors
	}

	// Check API health
	async checkApiHealth(
		apiName: string,
		testUrl: string,
	): Promise<"up" | "down" | "slow"> {
		try {
			const startTime = Date.now();
			const response = await fetch(testUrl, {
				method: "HEAD",
				signal: AbortSignal.timeout(5000), // 5 second timeout
			});
			const duration = Date.now() - startTime;

			if (!response.ok) {
				this.systemHealth.apis[apiName] = "down";
				return "down";
			}

			if (duration > 3000) {
				// Slow if > 3 seconds
				this.systemHealth.apis[apiName] = "slow";
				return "slow";
			}

			this.systemHealth.apis[apiName] = "up";
			return "up";
		} catch (error) {
			this.systemHealth.apis[apiName] = "down";
			return "down";
		}
	}

	// Get current system health
	getSystemHealth(): SystemHealthStatus {
		return { ...this.systemHealth };
	}

	// Generate comprehensive error analysis using Gemini AI
	async generateErrorAnalysis(): Promise<any> {
		const errorData = JSON.stringify({
			recentErrors: this.errors.slice(-20),
			systemHealth: this.systemHealth,
			performance: this.systemHealth.performance,
		});

		try {
			return await analyzeSystemErrors(errorData);
		} catch (error) {
			console.error("Error generating AI analysis:", error);
			return {
				summary: "AI analysis temporarily unavailable",
				recommendations: [
					"Check system logs manually",
					"Review recent changes",
				],
				priority: "medium",
				category: "monitoring",
			};
		}
	}

	// Generate TypeScript/JavaScript code error analysis
	async analyzeCodeErrors(filePath: string): Promise<any> {
		try {
			// Get LSP diagnostics (simulated for this example)
			const lspErrors = await this.getLSPDiagnostics(filePath);
			return await analyzeCodeErrors(JSON.stringify(lspErrors), filePath);
		} catch (error) {
			console.error("Error analyzing code:", error);
			return {
				summary: "Code analysis temporarily unavailable",
				totalErrors: 0,
				fixes: [],
			};
		}
	}

	// Generate Replit Agent instructions
	async generateReplitAgentInstructions(): Promise<any> {
		const currentErrors = JSON.stringify({
			lspErrors: await this.getLSPDiagnostics("server/routes.ts"),
			systemErrors: this.errors.slice(-10),
			healthStatus: this.systemHealth,
		});

		const appState = JSON.stringify({
			architecture: "Full-stack TypeScript (React + Express)",
			database: "PostgreSQL with Drizzle ORM",
			apis: [
				"Alpha Vantage",
				"Yahoo Finance",
				"Gemini AI",
				"ICICI Bank",
				"JM Financial",
			],
			features: [
				"Portfolio Management",
				"Market Data",
				"AI Insights",
				"WhatsApp Marketing",
				"Banking Services",
			],
			currentStatus: this.systemHealth.overall,
		});

		try {
			return await generateReplitAgentInstructions(currentErrors, appState);
		} catch (error) {
			console.error("Error generating Agent instructions:", error);
			return {
				summary: "Agent instructions generation failed",
				priority: "high",
				instructions: [],
			};
		}
	}

	// Simulate LSP diagnostics (replace with actual implementation)
	private async getLSPDiagnostics(filePath: string): Promise<any> {
		// This would integrate with actual LSP diagnostics
		// For now, return a simple mock structure
		return {
			file: filePath,
			errorCount: 0,
			errors: [],
		};
	}

	// Auto-heal common issues
	async autoHeal(): Promise<string[]> {
		const healingActions: string[] = [];

		// Check if APIs are down and suggest alternatives
		for (const [api, status] of Object.entries(this.systemHealth.apis)) {
			if (status === "down") {
				healingActions.push(`Switch to backup data source for ${api}`);
			}
		}

		// Check error rates
		if (this.systemHealth.performance.errorRate > 10) {
			healingActions.push("Implement circuit breaker pattern for failing APIs");
		}

		// Check response times
		if (this.systemHealth.performance.avgResponseTime > 2000) {
			healingActions.push("Enable caching for slow endpoints");
			healingActions.push("Optimize database queries");
		}

		return healingActions;
	}
}

// ── Error-rate sustained alerting ─────────────────────────────────────────────
// Fires a CRITICAL log when error rate stays above 15% for 3 consecutive 5-min checks.
// This is the minimum alerting layer before a full APM integration is wired in.
let _alertConsecutiveHighErrorChecks = 0;
let _alertLastFiredAt: number | null = null;
const ALERT_ERROR_RATE_THRESHOLD = 15; // %
const ALERT_CONSECUTIVE_REQUIRED = 3; // consecutive 5-min windows
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min between repeat alerts

function _checkErrorRateAlert(monitor: ErrorMonitor) {
	const health = monitor.getSystemHealth();
	const rate = health.performance.errorRate;

	if (rate >= ALERT_ERROR_RATE_THRESHOLD) {
		_alertConsecutiveHighErrorChecks++;
	} else {
		_alertConsecutiveHighErrorChecks = 0;
		return;
	}

	if (_alertConsecutiveHighErrorChecks < ALERT_CONSECUTIVE_REQUIRED) return;

	const now = Date.now();
	if (_alertLastFiredAt && now - _alertLastFiredAt < ALERT_COOLDOWN_MS) return;
	_alertLastFiredAt = now;
	_alertConsecutiveHighErrorChecks = 0;

	const msg = `[ErrorMonitor] ALERT — sustained error rate ${rate.toFixed(1)}% (>${ALERT_ERROR_RATE_THRESHOLD}% for ${ALERT_CONSECUTIVE_REQUIRED} consecutive checks). Total requests: ${health.performance.avgResponseTime.toFixed(0)}ms avg response. Check Railway logs immediately.`;
	console.error(msg);

	// Record as a critical self-error so the error digest service picks it up
	monitor.recordError({
		timestamp: new Date(),
		errorType: "error_rate_spike",
		severity: "critical",
		source: "error-monitor-alert",
		message: msg,
		context: { errorRate: rate, threshold: ALERT_ERROR_RATE_THRESHOLD },
	});
}

// Global error monitor instance
export const errorMonitor = new ErrorMonitor();

// Start the 5-minute alerting heartbeat (only in production to avoid noise in dev)
if (process.env.NODE_ENV === "production") {
	setInterval(() => _checkErrorRateAlert(errorMonitor), 5 * 60 * 1000);
}

// Express middleware for error monitoring
export function errorMonitoringMiddleware(req: any, res: any, next: any) {
	const startTime = Date.now();

	// Monitor response time
	res.on("finish", () => {
		const duration = Date.now() - startTime;
		errorMonitor.recordResponseTime(duration);

		// Log slow requests
		if (duration > 1000) {
			errorMonitor.recordError({
				timestamp: new Date(),
				errorType: "performance",
				severity: "medium",
				source: req.originalUrl,
				message: `Slow response: ${duration}ms`,
				context: { method: req.method, url: req.originalUrl, duration },
			});
		}
	});

	next();
}

// Global error handler
export function globalErrorHandler(error: any, req: any, res: any, next: any) {
	errorMonitor.recordError({
		timestamp: new Date(),
		errorType: "runtime",
		severity: error.status >= 500 ? "critical" : "high",
		source: req.originalUrl,
		message: error.message,
		stackTrace: error.stack,
		context: { method: req.method, url: req.originalUrl, body: req.body },
	});

	if (res.headersSent) {
		return next(error);
	}

	// Send error response
	res.status(error.status || 500).json({
		error: "Internal server error",
		message:
			process.env.NODE_ENV === "development"
				? error.message
				: "Something went wrong",
	});
}
