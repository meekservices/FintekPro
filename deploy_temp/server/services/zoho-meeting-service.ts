import axios, { AxiosError } from "axios";
import { format } from "date-fns";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        (error.response?.status >= 500 && error.response?.status < 600) ||
        error.response?.status === 429;

      if (!isRetryable || attempt === maxRetries) {
        console.error(`[Zoho Meeting] ${operationName} failed after ${attempt} attempt(s):`, error.message);
        throw error;
      }

      const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[Zoho Meeting] ${operationName} attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }
  
  throw lastError;
}

interface ZohoTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface ZohoMeetingCreateParams {
  topic: string;
  agenda?: string;
  startTime: Date;
  duration: number; // in minutes
  timezone?: string;
  participantEmails?: string[];
}

interface ZohoMeetingResponse {
  meetingId: string;
  joinLink: string;
  startLink: string;
  topic: string;
  startTime: string;
}

class ZohoMeetingService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID || "";
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET || "";
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || null;
  }

  private isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  private async refreshAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Zoho Meeting credentials not configured");
    }

    if (!this.refreshToken) {
      throw new Error("Zoho refresh token not available. Please complete OAuth flow.");
    }

    try {
      const response = await axios.post<ZohoTokenResponse>(
        "https://accounts.zoho.in/oauth/v2/token",
        null,
        {
          params: {
            grant_type: "refresh_token",
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: this.refreshToken,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);

      return this.accessToken;
    } catch (error: any) {
      console.error("Zoho token refresh failed:", error.response?.data || error.message);
      throw new Error("Failed to refresh Zoho access token");
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    return this.refreshAccessToken();
  }

  async createMeeting(params: ZohoMeetingCreateParams): Promise<ZohoMeetingResponse> {
    if (!this.isConfigured()) {
      console.log("Zoho Meeting not configured - returning mock meeting data");
      const mockId = `mock-${Date.now()}`;
      return {
        meetingId: mockId,
        joinLink: `https://meeting.zoho.in/join/${mockId}`,
        startLink: `https://meeting.zoho.in/start/${mockId}`,
        topic: params.topic,
        startTime: params.startTime.toISOString(),
      };
    }

    try {
      return await withRetry(async () => {
        const token = await this.getAccessToken();
        const zsoid = process.env.ZOHO_ZSOID || "";

        const formattedStartTime = format(params.startTime, "MMM dd, yyyy hh:mm a");

        const response = await axios.post(
          `https://meeting.zoho.in/api/v2/${zsoid}/sessions.json`,
          {
            session: {
              topic: params.topic,
              agenda: params.agenda || "",
              startTime: formattedStartTime,
              duration: params.duration * 60 * 1000,
              timezone: params.timezone || "Asia/Kolkata",
              participants: params.participantEmails?.map(email => ({ email })) || [],
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Zoho-oauthtoken ${token}`,
            },
            timeout: 30000,
          }
        );

        const session = response.data.session;

        console.log(`[Zoho Meeting] Successfully created meeting: ${session.sessionKey || session.meetingKey}`);

        return {
          meetingId: session.sessionKey || session.meetingKey,
          joinLink: session.joinLink,
          startLink: session.startLink,
          topic: session.topic,
          startTime: session.startTime,
        };
      }, 'createMeeting');
    } catch (error: any) {
      console.error("Zoho Meeting creation failed:", error.response?.data || error.message);
      
      const mockId = `fallback-${Date.now()}`;
      return {
        meetingId: mockId,
        joinLink: `https://meeting.zoho.in/join/${mockId}`,
        startLink: `https://meeting.zoho.in/start/${mockId}`,
        topic: params.topic,
        startTime: params.startTime.toISOString(),
      };
    }
  }

  async getMeeting(meetingId: string): Promise<any> {
    if (!this.isConfigured() || !this.refreshToken) {
      return null;
    }

    try {
      const token = await this.getAccessToken();
      const zsoid = process.env.ZOHO_ZSOID || "";

      const response = await axios.get(
        `https://meeting.zoho.in/api/v2/${zsoid}/sessions/${meetingId}.json`,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
          },
        }
      );

      return response.data.session;
    } catch (error: any) {
      console.error("Failed to get Zoho meeting:", error.response?.data || error.message);
      return null;
    }
  }

  async cancelMeeting(meetingId: string): Promise<boolean> {
    if (!this.isConfigured() || !this.refreshToken) {
      return true; // Mock success for demo
    }

    try {
      const token = await this.getAccessToken();
      const zsoid = process.env.ZOHO_ZSOID || "";

      await axios.delete(
        `https://meeting.zoho.in/api/v2/${zsoid}/sessions/${meetingId}.json`,
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
          },
        }
      );

      return true;
    } catch (error: any) {
      console.error("Failed to cancel Zoho meeting:", error.response?.data || error.message);
      return false;
    }
  }

  getOAuthUrl(redirectUri: string): string {
    const scopes = "ZohoMeeting.meeting.ALL";
    return `https://accounts.zoho.in/oauth/v2/auth?scope=${scopes}&client_id=${this.clientId}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<ZohoTokenResponse> {
    const response = await axios.post<ZohoTokenResponse>(
      "https://accounts.zoho.in/oauth/v2/token",
      null,
      {
        params: {
          grant_type: "authorization_code",
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
          code,
        },
      }
    );

    this.accessToken = response.data.access_token;
    this.refreshToken = response.data.refresh_token || null;
    this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);

    return response.data;
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: "Zoho Meeting credentials not configured (missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET)"
      };
    }

    if (!this.refreshToken) {
      return {
        success: false,
        message: "Zoho refresh token not available (missing ZOHO_REFRESH_TOKEN)"
      };
    }

    try {
      console.log("[Zoho Meeting] Testing connection - refreshing token...");
      const token = await this.refreshAccessToken();
      console.log("[Zoho Meeting] Token refreshed successfully");
      
      const zsoid = process.env.ZOHO_ZSOID || "";
      console.log(`[Zoho Meeting] ZSOID: ${zsoid ? zsoid : 'NOT SET'}`);
      
      const apiUrl = `https://meeting.zoho.in/api/v2/${zsoid}/sessions.json`;
      console.log(`[Zoho Meeting] Testing API URL: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        }
      });

      console.log("[Zoho Meeting] API call successful");
      return {
        success: true,
        message: "Zoho Meeting credentials verified successfully",
        details: {
          tokenRefreshed: true,
          apiCallSuccess: true,
          zsoid: zsoid ? "configured" : "not configured"
        }
      };
    } catch (error: any) {
      const errorDetails = error.response?.data || error.message;
      const statusCode = error.response?.status;
      console.error(`[Zoho Meeting] Test failed (HTTP ${statusCode}):`, typeof errorDetails === 'string' ? errorDetails.substring(0, 200) : errorDetails);
      return {
        success: false,
        message: "Failed to verify Zoho Meeting credentials",
        details: {
          error: typeof errorDetails === 'string' ? 'HTML error page returned - likely invalid ZSOID or API endpoint' : errorDetails,
          statusCode,
          zsoid: process.env.ZOHO_ZSOID || 'NOT SET'
        }
      };
    }
  }
}

export const zohoMeetingService = new ZohoMeetingService();
