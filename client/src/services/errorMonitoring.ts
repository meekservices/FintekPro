/**
 * Frontend Error Monitoring Service
 * Captures and reports browser errors, API failures, and unhandled rejections
 */

interface ErrorContext {
  userId?: string;
  sessionId?: string;
  currentPage?: string;
  userAction?: string;
  customData?: Record<string, any>;
}

interface DeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  device: string;
  viewport: string;
  userAgent: string;
}

class ErrorMonitoringService {
  private context: ErrorContext = {};
  private isInitialized = false;
  private errorQueue: Array<any> = [];
  private maxQueueSize = 50;
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchDelay = 5000; // 5 seconds

  /**
   * Initialize the error monitoring service
   */
  initialize(userId?: string) {
    if (this.isInitialized) {
      return;
    }

    this.context.userId = userId;
    this.context.sessionId = this.generateSessionId();

    // Capture uncaught errors
    window.addEventListener("error", this.handleGlobalError.bind(this));

    // Capture unhandled promise rejections
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection.bind(this));

    // Capture console errors (optional)
    this.interceptConsoleError();

    // Send queued errors before page unload
    window.addEventListener("beforeunload", this.flushQueue.bind(this));

    this.isInitialized = true;
    console.log("[Error Monitoring] Service initialized");
  }

  /**
   * Update user context
   */
  setUser(userId: string) {
    this.context.userId = userId;
  }

  /**
   * Set current page context
   */
  setPage(page: string) {
    this.context.currentPage = page;
  }

  /**
   * Set user action context
   */
  setAction(action: string) {
    this.context.userAction = action;
  }

  /**
   * Add custom context data
   */
  addContext(key: string, value: any) {
    if (!this.context.customData) {
      this.context.customData = {};
    }
    this.context.customData[key] = value;
  }

  /**
   * Manually log an error
   */
  logError(
    error: Error | string,
    severity: "critical" | "high" | "medium" | "low" = "medium",
    customContext?: Record<string, any>
  ) {
    const errorData = {
      source: "frontend" as const,
      severity,
      service: "web",
      environment: import.meta.env.MODE || "production",
      message: typeof error === "string" ? error : error.message,
      errorType: typeof error === "object" ? error.constructor.name : "Error",
      stackTrace: typeof error === "object" && error.stack ? error.stack : undefined,
      deviceInfo: this.getDeviceInfo(),
      payload: {
        ...this.context.customData,
        ...customContext,
        currentPage: this.context.currentPage || window.location.pathname,
        userAction: this.context.userAction,
      },
      occurredAt: new Date(),
    };

    this.queueError(errorData);
  }

  /**
   * Log an API failure
   */
  logApiError(
    endpoint: string,
    method: string,
    statusCode: number,
    errorMessage: string,
    responseData?: any
  ) {
    const errorData = {
      source: "frontend" as const,
      severity: statusCode >= 500 ? "high" : "medium" as const,
      service: "web",
      environment: import.meta.env.MODE || "production",
      message: `API Error: ${method} ${endpoint} - ${errorMessage}`,
      errorType: "APIError",
      errorCode: `HTTP_${statusCode}`,
      httpMethod: method,
      httpPath: endpoint,
      httpStatusCode: statusCode,
      deviceInfo: this.getDeviceInfo(),
      payload: {
        ...this.context.customData,
        responseData,
        currentPage: this.context.currentPage || window.location.pathname,
        userAction: this.context.userAction,
      },
      tags: ["api", "http"],
      occurredAt: new Date(),
    };

    this.queueError(errorData);
  }

  /**
   * Handle global uncaught errors
   */
  private handleGlobalError(event: ErrorEvent) {
    event.preventDefault(); // Prevent default browser error handling

    const errorData = {
      source: "frontend" as const,
      severity: "high" as const,
      service: "web",
      environment: import.meta.env.MODE || "production",
      message: event.message,
      errorType: event.error?.constructor?.name || "Error",
      stackTrace: event.error?.stack,
      deviceInfo: this.getDeviceInfo(),
      payload: {
        ...this.context.customData,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        currentPage: this.context.currentPage || window.location.pathname,
        userAction: this.context.userAction,
      },
      occurredAt: new Date(),
    };

    this.queueError(errorData);
  }

  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    event.preventDefault(); // Prevent default browser handling

    const reason = event.reason;
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const stackTrace = reason instanceof Error ? reason.stack : undefined;

    const errorData = {
      source: "frontend" as const,
      severity: "high" as const,
      service: "web",
      environment: import.meta.env.MODE || "production",
      message: `Unhandled Promise Rejection: ${errorMessage}`,
      errorType: "UnhandledRejection",
      stackTrace,
      deviceInfo: this.getDeviceInfo(),
      payload: {
        ...this.context.customData,
        currentPage: this.context.currentPage || window.location.pathname,
        userAction: this.context.userAction,
      },
      occurredAt: new Date(),
    };

    this.queueError(errorData);
  }

  /**
   * Intercept console.error calls
   */
  private interceptConsoleError() {
    const originalError = console.error;
    console.error = (...args: any[]) => {
      // Call original console.error
      originalError.apply(console, args);

      // Log to monitoring (only if it looks like an error)
      if (args.length > 0 && (args[0] instanceof Error || typeof args[0] === "string")) {
        const message = args[0] instanceof Error ? args[0].message : String(args[0]);
        this.logError(message, "low", {
          consoleArgs: args.slice(1),
        });
      }
    };
  }

  /**
   * Queue error for batch sending
   */
  private queueError(errorData: any) {
    // Add to queue
    this.errorQueue.push(errorData);

    // Limit queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest
    }

    // Schedule batch send
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushQueue();
      }, this.batchDelay);
    }

    // For critical errors, send immediately
    if (errorData.severity === "critical") {
      this.flushQueue();
    }
  }

  /**
   * Send queued errors to backend
   */
  private async flushQueue() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.errorQueue.length === 0) {
      return;
    }

    const errorsToSend = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // Send all errors in parallel
      await Promise.allSettled(
        errorsToSend.map((error) =>
          fetch("/api/monitoring/log-error", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(error),
            // Use keepalive for beforeunload
            keepalive: true,
          })
        )
      );
    } catch (error) {
      console.warn("[Error Monitoring] Failed to send errors:", error);
      // Don't re-queue to avoid infinite loops
    }
  }

  /**
   * Get device and browser information
   */
  private getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    const viewport = `${window.innerWidth}x${window.innerHeight}`;

    // Simple browser detection
    let browser = "Unknown";
    let browserVersion = "";
    if (ua.indexOf("Firefox") > -1) {
      browser = "Firefox";
      browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || "";
    } else if (ua.indexOf("Edg") > -1) {
      browser = "Edge";
      browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || "";
    } else if (ua.indexOf("Chrome") > -1) {
      browser = "Chrome";
      browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || "";
    } else if (ua.indexOf("Safari") > -1) {
      browser = "Safari";
      browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || "";
    }

    // Simple OS detection
    let os = "Unknown";
    if (ua.indexOf("Win") > -1) os = "Windows";
    else if (ua.indexOf("Mac") > -1) os = "macOS";
    else if (ua.indexOf("Linux") > -1) os = "Linux";
    else if (ua.indexOf("Android") > -1) os = "Android";
    else if (ua.indexOf("iOS") > -1 || ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1)
      os = "iOS";

    // Simple device detection
    let device = "Desktop";
    if (/Mobi|Android/i.test(ua)) {
      device = "Mobile";
    } else if (/Tablet|iPad/i.test(ua)) {
      device = "Tablet";
    }

    return {
      browser,
      browserVersion,
      os,
      device,
      viewport,
      userAgent: ua,
    };
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and destroy the service
   */
  destroy() {
    if (!this.isInitialized) {
      return;
    }

    window.removeEventListener("error", this.handleGlobalError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
    window.removeEventListener("beforeunload", this.flushQueue);

    this.flushQueue();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const errorMonitoring = new ErrorMonitoringService();

// Auto-initialize on import (can be customized later)
if (typeof window !== "undefined") {
  errorMonitoring.initialize();
}
