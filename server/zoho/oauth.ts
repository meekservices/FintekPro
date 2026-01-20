import axios from 'axios';
import { db } from '../db';
import { zohoConnections } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { encryptionService } from '../encryption-service';

interface ZohoOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  dataCenter: string; // 'com', 'eu', 'in', 'com.au', 'jp'
}

interface ZohoTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  api_domain?: string;
}

export class ZohoOAuthService {
  private config: ZohoOAuthConfig;
  private baseAuthUrl: string;
  private baseApiUrl: string;

  constructor(dataCenter: string = 'com') {
    this.config = {
      clientId: process.env.ZOHO_CLIENT_ID!,
      clientSecret: process.env.ZOHO_CLIENT_SECRET!,
      redirectUri: process.env.ZOHO_REDIRECT_URI!,
      dataCenter
    };

    // Set URLs based on data center
    this.baseAuthUrl = `https://accounts.zoho.${dataCenter}`;
    this.baseApiUrl = `https://www.zohoapis.${dataCenter}`;
  }

  /**
   * Generate OAuth authorization URL for user to grant access
   */
  getAuthorizationUrl(scope: string[], state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: scope.join(','),
      access_type: 'offline',
      prompt: 'consent'
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.baseAuthUrl}/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async getTokensFromCode(code: string): Promise<ZohoTokenResponse> {
    try {
      const response = await axios.post(
        `${this.baseAuthUrl}/oauth/v2/token`,
        null,
        {
          params: {
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            redirect_uri: this.config.redirectUri,
            code
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Zoho OAuth token exchange failed:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<ZohoTokenResponse> {
    try {
      const response = await axios.post(
        `${this.baseAuthUrl}/oauth/v2/token`,
        null,
        {
          params: {
            grant_type: 'refresh_token',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            refresh_token: refreshToken
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Zoho token refresh failed:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseAuthUrl}/oauth/v2/token/revoke`,
        null,
        {
          params: {
            token
          }
        }
      );
    } catch (error: any) {
      console.error('Zoho token revocation failed:', error.response?.data || error.message);
      throw new Error('Failed to revoke token');
    }
  }

  /**
   * Store connection in database (tokens encrypted at rest)
   */
  async saveConnection(
    tokenResponse: ZohoTokenResponse,
    userId: string,
    connectionName: string,
    services: string[]
  ): Promise<string> {
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptionService.encrypt(tokenResponse.access_token);
    const encryptedRefreshToken = encryptionService.encrypt(tokenResponse.refresh_token);

    if (!encryptedAccessToken || !encryptedRefreshToken) {
      throw new Error('Failed to encrypt OAuth tokens');
    }

    const [connection] = await db.insert(zohoConnections).values({
      connectionName,
      zohoDataCenter: this.config.dataCenter,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenType: tokenResponse.token_type,
      expiresAt,
      scope: tokenResponse.scope,
      services,
      status: 'active',
      createdBy: userId,
      isProduction: false
    }).returning();

    return connection.id;
  }

  /**
   * Get valid access token from database, refresh if needed (decrypts token on demand)
   */
  async getValidAccessToken(connectionId: string): Promise<string> {
    const [connection] = await db
      .select()
      .from(zohoConnections)
      .where(eq(zohoConnections.id, connectionId))
      .limit(1);

    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.status !== 'active') {
      throw new Error(`Connection is ${connection.status}`);
    }

    // Decrypt tokens - handle both encrypted and legacy unencrypted tokens
    let decryptedRefreshToken: string | null = null;
    try {
      // Check if token looks like unencrypted Zoho token (starts with "1000.")
      if (connection.refreshToken?.startsWith('1000.')) {
        console.log('[Zoho OAuth] Using unencrypted refresh token (legacy format)');
        decryptedRefreshToken = connection.refreshToken;
      } else {
        decryptedRefreshToken = encryptionService.decrypt(connection.refreshToken);
      }
    } catch (decryptError) {
      console.error('[Zoho OAuth] Decrypt error, trying raw token:', decryptError);
      // If decryption fails and it looks like a Zoho token, try using it directly
      if (connection.refreshToken?.includes('.')) {
        console.log('[Zoho OAuth] Falling back to raw refresh token');
        decryptedRefreshToken = connection.refreshToken;
      }
    }
    
    if (!decryptedRefreshToken) {
      throw new Error('Failed to decrypt refresh token');
    }

    // Check if token is expired or will expire in next 5 minutes
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const expiresAt = new Date(connection.expiresAt);

    if (now.getTime() + expiryBuffer >= expiresAt.getTime()) {
      // Token expired or expiring soon, refresh it
      const tokenResponse = await this.refreshAccessToken(decryptedRefreshToken);
      const newExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

      // Encrypt new access token
      const encryptedAccessToken = encryptionService.encrypt(tokenResponse.access_token);
      if (!encryptedAccessToken) {
        throw new Error('Failed to encrypt new access token');
      }

      await db
        .update(zohoConnections)
        .set({
          accessToken: encryptedAccessToken,
          expiresAt: newExpiresAt,
          updatedAt: new Date()
        })
        .where(eq(zohoConnections.id, connectionId));

      return tokenResponse.access_token;
    }

    // Decrypt and return access token - handle both encrypted and legacy unencrypted tokens
    let decryptedAccessToken: string | null = null;
    try {
      if (connection.accessToken?.startsWith('1000.')) {
        console.log('[Zoho OAuth] Using unencrypted access token (legacy format)');
        decryptedAccessToken = connection.accessToken;
      } else {
        decryptedAccessToken = encryptionService.decrypt(connection.accessToken);
      }
    } catch (decryptError) {
      console.error('[Zoho OAuth] Access token decrypt error, trying raw:', decryptError);
      if (connection.accessToken?.includes('.')) {
        decryptedAccessToken = connection.accessToken;
      }
    }
    
    if (!decryptedAccessToken) {
      throw new Error('Failed to decrypt access token');
    }

    return decryptedAccessToken;
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(
    connectionId: string,
    status: string,
    error?: string
  ): Promise<void> {
    await db
      .update(zohoConnections)
      .set({
        status,
        lastError: error,
        lastErrorAt: error ? new Date() : undefined,
        updatedAt: new Date()
      })
      .where(eq(zohoConnections.id, connectionId));
  }
}
