/**
 * External API Health Monitoring Service
 * 
 * Periodically checks the health of external APIs and logs results to database.
 * Monitors: Alpha Vantage, Finnhub, Gemini, News API
 * 
 * Features:
 * - Configurable check intervals
 * - Latency measurement
 * - Failure detection and logging
 * - Health status determination (healthy/degraded/down)
 */

import cron, { type ScheduledTask } from 'node-cron';
import { monitoringStorage } from '../monitoringStorage';
import { logger } from '../logger';
import axios from 'axios';

interface ApiCheck {
  service: string;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  validateResponse?: (data: any) => boolean;
}

class ExternalApiMonitor {
  private cronJob: ScheduledTask | null = null;
  private isRunning: boolean = false;
  private checkInterval: string = '*/5 * * * *'; // Every 5 minutes

  constructor() {
    // Service will be started manually
  }

  /**
   * Start the monitoring service
   */
  start(interval: string = '*/5 * * * *'): void {
    if (this.isRunning) {
      logger.warn('External API monitor already running');
      return;
    }

    this.checkInterval = interval;
    
    // Run initial check immediately
    this.runHealthChecks().catch(error => {
      logger.error('Failed to run initial health checks', error);
    });

    // Schedule recurring checks
    this.cronJob = cron.schedule(this.checkInterval, () => {
      this.runHealthChecks().catch(error => {
        logger.error('Failed to run scheduled health checks', error);
      });
    });

    this.isRunning = true;
    logger.info(`External API monitor started with interval: ${this.checkInterval}`);
  }

  /**
   * Stop the monitoring service
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    logger.info('External API monitor stopped');
  }

  /**
   * Run health checks for all APIs
   */
  private async runHealthChecks(): Promise<void> {
    logger.debug('Running external API health checks');

    const checks: ApiCheck[] = [
      // Alpha Vantage
      {
        service: 'alpha_vantage',
        url: 'https://www.alphavantage.co/query',
        method: 'GET',
        timeout: 10000,
        validateResponse: (data) => !data.Note && !data['Error Message'],
      },
      // Finnhub
      {
        service: 'finnhub',
        url: 'https://finnhub.io/api/v1/quote',
        method: 'GET',
        timeout: 10000,
        validateResponse: (data) => data && typeof data === 'object',
      },
      // Google Gemini
      {
        service: 'gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
        method: 'POST',
        timeout: 15000,
        validateResponse: (data) => data && !data.error,
      },
      // News API
      {
        service: 'news_api',
        url: 'https://newsapi.org/v2/top-headlines',
        method: 'GET',
        timeout: 10000,
        validateResponse: (data) => data && data.status !== 'error',
      },
    ];

    // Run checks in parallel
    await Promise.allSettled(
      checks.map(check => this.checkApi(check))
    );

    logger.debug('Completed external API health checks');
  }

  /**
   * Check a single API endpoint
   */
  private async checkApi(check: ApiCheck): Promise<void> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'down' = 'down';
    let failureReason: string | null = null;
    let errorMessage: string | null = null;
    let responseCode: number | null = null;

    try {
      // Skip check if API key not configured (except for basic connectivity)
      const apiKey = this.getApiKey(check.service);
      if (!apiKey && this.requiresApiKey(check.service)) {
        logger.debug(`Skipping ${check.service} health check - API key not configured`);
        return;
      }

      // Build request URL with API key if needed
      const url = this.buildUrl(check, apiKey);

      // Make request
      const response = await axios({
        method: check.method,
        url,
        headers: check.headers,
        data: check.body,
        timeout: check.timeout || 10000,
        validateStatus: () => true, // Don't throw on any status
      });

      responseCode = response.status;
      const latencyMs = Date.now() - startTime;

      // Determine health status
      if (response.status >= 200 && response.status < 300) {
        // Check response data if validator provided
        if (check.validateResponse && !check.validateResponse(response.data)) {
          status = 'degraded';
          failureReason = 'Invalid response format';
        } else {
          status = 'healthy';
        }
      } else if (response.status === 429) {
        status = 'degraded';
        failureReason = 'Rate limit exceeded';
      } else if (response.status >= 500) {
        status = 'down';
        failureReason = `Server error: ${response.status}`;
        errorMessage = response.data?.message || response.statusText;
      } else {
        status = 'degraded';
        failureReason = `Client error: ${response.status}`;
        errorMessage = response.data?.message || response.statusText;
      }

      // Log to database
      await monitoringStorage.logApiHealth({
        service: check.service,
        status,
        latencyMs,
        responseCode,
        failureReason,
        errorMessage,
      });

      // Log to console
      if (status === 'healthy') {
        logger.debug(`${check.service} health check: ${status} (${latencyMs}ms)`);
      } else {
        logger.warn(`${check.service} health check: ${status}`, {
          latency: latencyMs,
          failureReason,
          errorMessage,
        });
      }

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      status = 'down';
      failureReason = error instanceof Error ? error.name : 'Unknown error';
      errorMessage = error instanceof Error ? error.message : String(error);

      // Log to database
      await monitoringStorage.logApiHealth({
        service: check.service,
        status,
        latencyMs,
        responseCode: null,
        failureReason,
        errorMessage,
      });

      // Log to console
      logger.error(`${check.service} health check failed`, {
        error: errorMessage,
        failureReason,
      });
    }
  }

  /**
   * Get API key for a service
   */
  private getApiKey(service: string): string | null {
    const envMap: Record<string, string> = {
      alpha_vantage: 'ALPHA_VANTAGE_API_KEY',
      finnhub: 'FINNHUB_API_KEY',
      gemini: 'GEMINI_API_KEY',
      news_api: 'NEWS_API_KEY',
    };

    const envVar = envMap[service];
    return envVar ? process.env[envVar] || null : null;
  }

  /**
   * Check if service requires an API key
   */
  private requiresApiKey(service: string): boolean {
    return true; // All our external APIs require keys
  }

  /**
   * Build request URL with API key
   */
  private buildUrl(check: ApiCheck, apiKey: string | null): string {
    if (!apiKey) return check.url;

    const url = new URL(check.url);
    
    switch (check.service) {
      case 'alpha_vantage':
        url.searchParams.set('function', 'TIME_SERIES_INTRADAY');
        url.searchParams.set('symbol', 'IBM');
        url.searchParams.set('interval', '5min');
        url.searchParams.set('apikey', apiKey);
        break;
      
      case 'finnhub':
        url.searchParams.set('symbol', 'AAPL');
        url.searchParams.set('token', apiKey);
        break;
      
      case 'gemini':
        url.searchParams.set('key', apiKey);
        // For POST request, body will be minimal test
        check.body = {
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
        };
        break;
      
      case 'news_api':
        url.searchParams.set('country', 'us');
        url.searchParams.set('pageSize', '1');
        url.searchParams.set('apiKey', apiKey);
        break;
    }

    return url.toString();
  }

  /**
   * Get current monitoring status
   */
  getStatus(): { running: boolean; interval: string } {
    return {
      running: this.isRunning,
      interval: this.checkInterval,
    };
  }

  /**
   * Run health checks on demand
   */
  async runNow(): Promise<void> {
    await this.runHealthChecks();
  }
}

// Export singleton instance
export const externalApiMonitor = new ExternalApiMonitor();
