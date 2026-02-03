/**
 * Sandbox.co.in API Error Handler
 * Based on: https://developer.sandbox.co.in/guides/developer-resources/errors
 * Rate limits: https://developer.sandbox.co.in/guides/developer-resources/rate-limits
 */

// Rate limits per environment (requests per minute)
export const RATE_LIMITS = {
  test: {
    host: 'https://test-api.sandbox.co.in',
    requestsPerMinute: 25,
  },
  production: {
    host: 'https://api.sandbox.co.in',
    requestsPerMinute: 500,
  },
} as const;

export interface SandboxErrorResponse {
  code: number;
  message: string;
  timestamp: number;
  transaction_id: string;
}

export class SandboxAPIError extends Error {
  public readonly statusCode: number;
  public readonly transactionId?: string;
  public readonly timestamp?: number;
  public readonly isRetryable: boolean;
  public readonly resolution: string;

  constructor(
    message: string,
    statusCode: number,
    transactionId?: string,
    timestamp?: number
  ) {
    super(message);
    this.name = 'SandboxAPIError';
    this.statusCode = statusCode;
    this.transactionId = transactionId;
    this.timestamp = timestamp;
    this.isRetryable = [429, 500, 503, 504].includes(statusCode);
    this.resolution = getResolution(statusCode);
  }
}

function getResolution(statusCode: number): string {
  const resolutions: Record<number, string> = {
    400: 'Check request body against API documentation',
    401: 'Verify your API credentials (SANDBOX_API_KEY and SANDBOX_API_SECRET)',
    403: 'Check token validity, permissions, credits, or quota',
    404: 'Verify the API endpoint path',
    422: 'Validate field values against schema',
    429: 'Reduce request frequency or wait before retrying',
    500: 'Retry the request; contact support if persistent',
    503: 'Source system unavailable - retry later',
    504: 'Request timed out - retry the request',
  };
  return resolutions[statusCode] || 'Unknown error - contact support';
}

export function handleSandboxError(error: any): never {
  const statusCode = error.response?.status || 500;
  const data = error.response?.data as Partial<SandboxErrorResponse> | undefined;
  
  const message = data?.message || error.message || 'Unknown Sandbox API error';
  const transactionId = data?.transaction_id;
  const timestamp = data?.timestamp;

  // Log with transaction_id for support reference
  console.error(`[Sandbox API Error] Status: ${statusCode}, Message: ${message}${transactionId ? `, Transaction ID: ${transactionId}` : ''}`);

  throw new SandboxAPIError(message, statusCode, transactionId, timestamp);
}

export function is403InsufficientPrivilege(error: any): boolean {
  return error.response?.status === 403 || 
         error.response?.data?.message?.toLowerCase()?.includes('insufficient privilege');
}

export function is401InvalidCredentials(error: any): boolean {
  return error.response?.status === 401 ||
         error.response?.data?.message?.toLowerCase()?.includes('invalid api key');
}

export function isRateLimited(error: any): boolean {
  return error.response?.status === 429;
}

export function isRetryable(error: any): boolean {
  const status = error.response?.status;
  return [429, 500, 503, 504].includes(status);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (!isRetryable(error) || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`[Sandbox API] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Pagination helpers for Sandbox list endpoints
 * Based on: https://developer.sandbox.co.in/guides/developer-resources/pagination
 */

export interface PaginatedRequest {
  page_size?: number; // Max 50
  last_evaluated_key?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  last_evaluated_key?: string; // Present only when more pages exist
}

export function hasMorePages<T>(response: PaginatedResponse<T>): boolean {
  return !!response.last_evaluated_key;
}

export async function fetchAllPages<T>(
  fetchPage: (cursor?: string) => Promise<PaginatedResponse<T>>,
  pageSize: number = 50
): Promise<T[]> {
  const allItems: T[] = [];
  let cursor: string | undefined;
  
  do {
    const response = await fetchPage(cursor);
    allItems.push(...response.items);
    cursor = response.last_evaluated_key;
  } while (cursor);
  
  return allItems;
}

export function buildPaginatedRequest<T extends object>(
  baseRequest: T,
  pageSize: number = 50,
  cursor?: string
): T & PaginatedRequest {
  return {
    ...baseRequest,
    page_size: Math.min(pageSize, 50), // Max 50 per docs
    ...(cursor && { last_evaluated_key: cursor }),
  };
}

/**
 * Job-based async workflow helpers
 * Based on: https://developer.sandbox.co.in/guides/developer-resources/job-based-api-workflow
 */

export type JobStatus = 'created' | 'queued' | 'in_progress' | 'succeeded' | 'failed';

export interface JobResponse {
  job_id: string;
  status: JobStatus;
  url?: string; // Pre-signed S3 URL for upload/download
  created_at: number;
  updated_at: number;
  '@entity': string;
}

export function isJobComplete(status: JobStatus): boolean {
  return status === 'succeeded' || status === 'failed';
}

export function isJobSucceeded(status: JobStatus): boolean {
  return status === 'succeeded';
}

export async function uploadToPresignedUrl(
  presignedUrl: string,
  payload: any,
  contentType: string = 'application/json'
): Promise<void> {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
  }
}

export async function downloadFromPresignedUrl<T = any>(
  presignedUrl: string
): Promise<T> {
  const response = await fetch(presignedUrl);
  
  if (!response.ok) {
    throw new Error(`S3 download failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json() as Promise<T>;
}

export async function pollJobUntilComplete(
  pollFn: () => Promise<JobResponse>,
  options: {
    initialDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number;
    onProgress?: (status: JobStatus, attempt: number) => void;
  } = {}
): Promise<JobResponse> {
  const {
    initialDelayMs = 2000,
    maxDelayMs = 30000,
    maxAttempts = 60,
    onProgress,
  } = options;
  
  let attempt = 0;
  let delay = initialDelayMs;
  
  while (attempt < maxAttempts) {
    const job = await pollFn();
    onProgress?.(job.status, attempt);
    
    if (isJobComplete(job.status)) {
      return job;
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, maxDelayMs); // Exponential backoff
    attempt++;
  }
  
  throw new Error(`Job polling timeout after ${maxAttempts} attempts`);
}
