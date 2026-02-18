import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ZohoOAuthService } from './oauth';
import { db } from '../db';
import { zohoSyncLogs } from '@shared/schema';
import { zohoRateLimiter } from './rate-limiter';

interface ZohoApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  data?: any;
  params?: any;
  headers?: any;
}

interface ZohoApiResponse<T = any> {
  data: T;
  status: string;
  message?: string;
}

export class ZohoApiClient {
  private connectionId: string;
  private service: string; // 'CRM', 'Books', 'Desk', 'WorkDrive', etc.
  private oauthService: ZohoOAuthService;
  private axiosInstance: AxiosInstance;
  private dataCenter: string;

  constructor(connectionId: string, service: string, dataCenter: string = 'com') {
    this.connectionId = connectionId;
    this.service = service;
    this.dataCenter = dataCenter;
    this.oauthService = new ZohoOAuthService(dataCenter);

    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: this.getServiceBaseUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor to inject auth token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const accessToken = await this.oauthService.getValidAccessToken(this.connectionId);
        config.headers.Authorization = `Zoho-oauthtoken ${accessToken}`;
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling and token refresh retry
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Check if this is an auth error that we haven't retried yet
        const isAuthError = error.response?.status === 401 || 
          error.response?.data?.message?.toLowerCase().includes('invalid oauth token') ||
          error.response?.data?.code === 'INVALID_TOKEN';
        
        if (isAuthError && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            console.log('[Zoho OAuth] Token invalid, forcing refresh...');
            // Force token refresh by calling the refresh method directly
            const newAccessToken = await this.oauthService.forceRefreshToken(this.connectionId);
            
            // Update the request with new token
            originalRequest.headers.Authorization = `Zoho-oauthtoken ${newAccessToken}`;
            
            console.log('[Zoho OAuth] Retrying request with new token');
            return this.axiosInstance.request(originalRequest);
          } catch (refreshError) {
            console.error('[Zoho OAuth] Token refresh failed:', refreshError);
            // Log and propagate the error
            await this.logApiError(error);
            return Promise.reject(error);
          }
        }
        
        // Log API errors
        await this.logApiError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get base URL for specific Zoho service
   */
  private getServiceBaseUrl(): string {
    const serviceUrls: Record<string, string> = {
      CRM: `https://www.zohoapis.${this.dataCenter}/crm/v6`,
      Books: `https://www.zohoapis.${this.dataCenter}/books/v3`,
      Desk: `https://desk.zoho.${this.dataCenter}/api/v1`,
      WorkDrive: `https://www.zohoapis.${this.dataCenter}/workdrive/api/v1`,
      People: `https://people.zoho.${this.dataCenter}/people/api`,
      Recruit: `https://recruit.zoho.${this.dataCenter}/recruit/v2`,
      Campaigns: `https://campaigns.zoho.${this.dataCenter}/api/v1.1`,
      Analytics: `https://analyticsapi.zoho.${this.dataCenter}`,
      Projects: `https://projectsapi.zoho.${this.dataCenter}/restapi`,
      Meeting: `https://meeting.zoho.${this.dataCenter}`,
      Sign: `https://sign.zoho.${this.dataCenter}`
    };

    return serviceUrls[this.service] || `https://www.zohoapis.${this.dataCenter}`;
  }

  /**
   * Make API request to Zoho (with rate limiting)
   */
  async request<T = any>(options: ZohoApiRequestOptions): Promise<ZohoApiResponse<T>> {
    const startTime = Date.now();

    try {
      // Check rate limit and wait if necessary (with 60s max wait)
      const apiCost = this.estimateApiCost(options.method);
      await zohoRateLimiter.waitForTokens(this.connectionId, apiCost);

      const config: AxiosRequestConfig = {
        method: options.method,
        url: options.endpoint,
        data: options.data,
        params: options.params,
        headers: options.headers
      };

      const response = await this.axiosInstance.request(config);

      // Log successful request
      await this.logApiRequest(options, response.data, Date.now() - startTime, 'success');

      return {
        data: response.data,
        status: 'success'
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      
      // Log failed request
      await this.logApiRequest(options, error.response?.data, Date.now() - startTime, 'failure', errorMessage);

      throw new Error(`Zoho ${this.service} API Error: ${errorMessage}`);
    }
  }

  /**
   * Estimate API credit cost based on operation type
   * (Zoho typically charges 1-5 credits per API call)
   */
  private estimateApiCost(method: string): number {
    const costMap: Record<string, number> = {
      'GET': 1,     // Read operations: 1 credit
      'POST': 3,    // Create operations: 3 credits
      'PUT': 2,     // Update operations: 2 credits
      'PATCH': 2,   // Partial update: 2 credits
      'DELETE': 2   // Delete operations: 2 credits
    };
    
    return costMap[method] || 1;
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, params?: any): Promise<ZohoApiResponse<T>> {
    return this.request<T>({ method: 'GET', endpoint, params });
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data: any, params?: any): Promise<ZohoApiResponse<T>> {
    return this.request<T>({ method: 'POST', endpoint, data, params });
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data: any, params?: any): Promise<ZohoApiResponse<T>> {
    return this.request<T>({ method: 'PUT', endpoint, data, params });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, data: any, params?: any): Promise<ZohoApiResponse<T>> {
    return this.request<T>({ method: 'PATCH', endpoint, data, params });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, params?: any): Promise<ZohoApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', endpoint, params });
  }

  /**
   * Log API request to database
   */
  private async logApiRequest(
    options: ZohoApiRequestOptions,
    responseData: any,
    durationMs: number,
    status: 'success' | 'failure',
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.insert(zohoSyncLogs).values({
        connectionId: this.connectionId,
        operation: options.method.toLowerCase(),
        entityType: 'api_request',
        direction: 'to_zoho',
        zohoService: this.service,
        zohoApiEndpoint: options.endpoint,
        zohoRequestPayload: options.data || options.params,
        zohoResponseData: responseData,
        status,
        recordsProcessed: 1,
        recordsSucceeded: status === 'success' ? 1 : 0,
        recordsFailed: status === 'failure' ? 1 : 0,
        errorMessage,
        durationMs,
        triggeredBy: 'api_client'
      });
    } catch (error) {
      console.error('Failed to log Zoho API request:', error);
    }
  }

  /**
   * Log API error
   */
  private async logApiError(error: any): Promise<void> {
    const errorDetails = {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status
    };

    if (!this.connectionId) {
      console.error(`[Zoho API] Error (no connection): ${this.service} - ${error.message}`);
      return;
    }

    try {
      await db.insert(zohoSyncLogs).values({
        connectionId: this.connectionId,
        operation: 'error',
        entityType: 'api_error',
        direction: 'to_zoho',
        zohoService: this.service,
        status: 'failure',
        errorMessage: error.message,
        errorDetails,
        triggeredBy: 'api_client'
      });
    } catch (logError: any) {
      const msg = String(logError?.message || '');
      if (msg.includes('foreign key constraint')) {
        console.error(`[Zoho API] Error (connection ${this.connectionId} not in DB): ${this.service} - ${error.message}`);
      } else {
        console.error('Failed to log Zoho API error:', logError);
      }
    }
  }

  /**
   * Bulk operations with rate limiting
   */
  async bulkRequest<T = any>(
    requests: ZohoApiRequestOptions[],
    batchSize: number = 100
  ): Promise<ZohoApiResponse<T>[]> {
    const results: ZohoApiResponse<T>[] = [];
    
    // Process requests in batches
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(req => this.request<T>(req))
      );
      results.push(...batchResults);

      // Rate limiting: wait 1 second between batches
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}
