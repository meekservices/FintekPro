import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { logger } from "../../logger";
import {
  getFinvuBaseUrl,
  getFinvuClientId,
  getFinvuClientSecret,
  getFinvuFiuEntityId,
  isFinvuConfigured,
} from "../../utils/finvu-config";

export interface FinvuApiResponse<T = any> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  latencyMs: number;
}

export class FinvuClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: getFinvuBaseUrl(),
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      "client_id": getFinvuClientId(),
      "client_secret": getFinvuClientSecret(),
      "fiu_entity_id": getFinvuFiuEntityId(),
      "x-request-id": `FINVU_REQ_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  /**
   * Executes an HTTP request to Finvu with retry logic and structured latency logging
   */
  public async request<T = any>(
    config: AxiosRequestConfig,
    maxRetries = 2
  ): Promise<FinvuApiResponse<T>> {
    const start = Date.now();
    const endpoint = config.url || "";
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const headers = {
          ...this.getAuthHeaders(),
          ...(config.headers || {}),
        };

        const response = await this.client.request<T>({
          ...config,
          headers,
        });

        const latencyMs = Date.now() - start;
        logger.info(
          JSON.stringify({
            event: "FINVU_API_CALL",
            direction: "outbound",
            endpoint,
            method: config.method || "GET",
            http_status: response.status,
            latency_ms: latencyMs,
            status: "success",
            attempt: attempt + 1,
            timestamp: new Date().toISOString(),
          })
        );

        return {
          success: true,
          status: response.status,
          data: response.data,
          latencyMs,
        };
      } catch (err: any) {
        attempt++;
        const latencyMs = Date.now() - start;
        const status = err.response?.status || 500;
        const errorMessage =
          err.response?.data?.message || err.response?.data?.error || err.message;

        logger.warn(
          JSON.stringify({
            event: "FINVU_API_CALL_ERROR",
            endpoint,
            method: config.method || "GET",
            http_status: status,
            latency_ms: latencyMs,
            status: "failed",
            attempt,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          })
        );

        // Do not retry on client 4xx errors (except 429 Rate Limit)
        if (status >= 400 && status < 500 && status !== 429) {
          return {
            success: false,
            status,
            error: errorMessage,
            latencyMs,
          };
        }

        if (attempt <= maxRetries) {
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          return {
            success: false,
            status,
            error: errorMessage,
            latencyMs,
          };
        }
      }
    }

    return {
      success: false,
      status: 500,
      error: "Exceeded max retries for Finvu request",
      latencyMs: Date.now() - start,
    };
  }

  public isReady(): boolean {
    return isFinvuConfigured();
  }
}

export const finvuClient = new FinvuClient();
