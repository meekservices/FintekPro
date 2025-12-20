import axios from "axios";
import { format } from "date-fns";

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
            duration: params.duration * 60 * 1000, // Convert to milliseconds
            timezone: params.timezone || "Asia/Kolkata",
            participants: params.participantEmails?.map(email => ({ email })) || [],
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Zoho-oauthtoken ${token}`,
          },
        }
      );

      const session = response.data.session;

      return {
        meetingId: session.sessionKey || session.meetingKey,
        joinLink: session.joinLink,
        startLink: session.startLink,
        topic: session.topic,
        startTime: session.startTime,
      };
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
}

export const zohoMeetingService = new ZohoMeetingService();
