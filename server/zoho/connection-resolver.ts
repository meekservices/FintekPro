import { db } from '../db';
import { zohoConnections } from '@shared/schema';
import { eq, and, or, sql } from 'drizzle-orm';

export interface ResolvedConnection {
  connectionId: string;
  zohoDataCenter: string;
  isMaster: boolean;
  masterAgentId?: string;
}

let envBootstrapAttempted = false;

export class ZohoConnectionResolver {

  static async bootstrapFromEnvVars(): Promise<ResolvedConnection | null> {
    if (envBootstrapAttempted) return null;
    envBootstrapAttempted = true;

    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const dataCenter = process.env.ZOHO_DATACENTER || 'in';

    if (!refreshToken || !clientId || !clientSecret) {
      return null;
    }

    try {
      const [existingCheck] = await db
        .select({ id: zohoConnections.id, zohoDataCenter: zohoConnections.zohoDataCenter })
        .from(zohoConnections)
        .where(eq(zohoConnections.status, 'active'))
        .limit(1);

      if (existingCheck) {
        return {
          connectionId: existingCheck.id,
          zohoDataCenter: existingCheck.zohoDataCenter || dataCenter,
          isMaster: true,
        };
      }

      console.log('[ZohoConnectionResolver] No DB connections found, bootstrapping from env vars...');
      const { ZohoOAuthService } = await import('./oauth');
      const oauthService = new ZohoOAuthService(dataCenter);
      const tokenResponse = await oauthService.refreshAccessToken(refreshToken);

      if (!tokenResponse?.access_token) {
        console.error('[ZohoConnectionResolver] Bootstrap failed: no access token returned');
        return null;
      }

      const { encryptionService } = await import('../encryption-service');
      const encryptedAccessToken = encryptionService.encrypt(tokenResponse.access_token);
      const encryptedRefreshToken = encryptionService.encrypt(refreshToken);

      if (!encryptedAccessToken || !encryptedRefreshToken) {
        console.error('[ZohoConnectionResolver] Encryption service unavailable, aborting bootstrap for security');
        return null;
      }

      const expiresInMs = (tokenResponse.expires_in && typeof tokenResponse.expires_in === 'number')
        ? tokenResponse.expires_in * 1000
        : 3600 * 1000;
      const expiresAt = new Date(Date.now() + expiresInMs);

      const [connection] = await db.insert(zohoConnections).values({
        connectionName: 'Auto-provisioned (env)',
        zohoDataCenter: dataCenter,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenType: tokenResponse.token_type || 'Bearer',
        expiresAt,
        scope: tokenResponse.scope || '',
        services: ['CRM', 'Books', 'Campaigns', 'Meeting', 'Sign'],
        status: 'active',
        isProduction: true,
        isDefault: true,
        isMaster: true,
      }).returning();

      console.log(`[ZohoConnectionResolver] Bootstrap successful, connection ID: ${connection.id}`);
      return {
        connectionId: connection.id,
        zohoDataCenter: dataCenter,
        isMaster: true,
      };
    } catch (error: any) {
      console.error('[ZohoConnectionResolver] Bootstrap from env vars failed:', error.message);
      return null;
    }
  }

  static async resolveForAgent(agentId: string): Promise<ResolvedConnection | null> {
    try {
      const [agentConnection] = await db
        .select()
        .from(zohoConnections)
        .where(
          and(
            eq(zohoConnections.masterAgentId, agentId),
            eq(zohoConnections.status, 'active')
          )
        )
        .limit(1);

      if (agentConnection) {
        return {
          connectionId: agentConnection.id,
          zohoDataCenter: agentConnection.zohoDataCenter || 'com',
          isMaster: agentConnection.isMaster || false,
          masterAgentId: agentConnection.masterAgentId || undefined,
        };
      }

      const [masterConnection] = await db
        .select()
        .from(zohoConnections)
        .where(
          and(
            eq(zohoConnections.isMaster, true),
            eq(zohoConnections.status, 'active')
          )
        )
        .limit(1);

      if (masterConnection) {
        return {
          connectionId: masterConnection.id,
          zohoDataCenter: masterConnection.zohoDataCenter || 'com',
          isMaster: true,
          masterAgentId: masterConnection.masterAgentId || undefined,
        };
      }

      const [defaultConnection] = await db
        .select()
        .from(zohoConnections)
        .where(
          and(
            eq(zohoConnections.isDefault, true),
            eq(zohoConnections.status, 'active')
          )
        )
        .limit(1);

      if (defaultConnection) {
        return {
          connectionId: defaultConnection.id,
          zohoDataCenter: defaultConnection.zohoDataCenter || 'com',
          isMaster: defaultConnection.isMaster || false,
          masterAgentId: defaultConnection.masterAgentId || undefined,
        };
      }

      return await ZohoConnectionResolver.bootstrapFromEnvVars();
    } catch (error) {
      console.warn('ZohoConnectionResolver: Error resolving connection:', error);
      return null;
    }
  }

  /**
   * Get the master connection for hierarchical sync.
   * All clients acquired by sub-agents should be linked to the master agent in Zoho.
   */
  static async getMasterConnection(): Promise<ResolvedConnection | null> {
    try {
      const [masterConnection] = await db
        .select()
        .from(zohoConnections)
        .where(
          and(
            eq(zohoConnections.isMaster, true),
            eq(zohoConnections.status, 'active')
          )
        )
        .limit(1);

      if (masterConnection) {
        return {
          connectionId: masterConnection.id,
          zohoDataCenter: masterConnection.zohoDataCenter || 'com',
          isMaster: true,
          masterAgentId: masterConnection.masterAgentId || undefined,
        };
      }

      const [defaultConnection] = await db
        .select()
        .from(zohoConnections)
        .where(
          and(
            eq(zohoConnections.isDefault, true),
            eq(zohoConnections.status, 'active')
          )
        )
        .limit(1);

      if (defaultConnection) {
        return {
          connectionId: defaultConnection.id,
          zohoDataCenter: defaultConnection.zohoDataCenter || 'com',
          isMaster: false,
          masterAgentId: defaultConnection.masterAgentId || undefined,
        };
      }

      return await ZohoConnectionResolver.bootstrapFromEnvVars();
    } catch (error) {
      console.warn('ZohoConnectionResolver: Error getting master connection:', error);
      return null;
    }
  }

  /**
   * Check if Zoho CRM sync is available.
   * Use this to gracefully skip sync when no connection is configured.
   */
  static async isZohoSyncAvailable(): Promise<boolean> {
    try {
      const [anyConnection] = await db
        .select()
        .from(zohoConnections)
        .where(eq(zohoConnections.status, 'active'))
        .limit(1);

      return !!anyConnection;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the master agent's Zoho Account ID for hierarchical linking.
   * This is used to set the parentZohoRecordId when syncing clients/prospects.
   * 
   * Looks for the Zoho Account mapping associated with the master connection
   * (the connection with isMaster=true), or falls back to the first partner
   * account if no specific master is configured.
   */
  static async getMasterAgentZohoAccountId(connectionId: string): Promise<string | null> {
    try {
      const { zohoEntityMappings } = await import('@shared/schema');
      
      // First, check if this connection is a master connection
      const [connection] = await db
        .select()
        .from(zohoConnections)
        .where(eq(zohoConnections.id, connectionId))
        .limit(1);

      if (!connection) {
        return null;
      }

      // If this is the master connection and has a masterAgentId, 
      // find that specific agent's Zoho Account
      if (connection.isMaster && connection.masterAgentId) {
        const [masterAgentMapping] = await db
          .select()
          .from(zohoEntityMappings)
          .where(
            and(
              eq(zohoEntityMappings.connectionId, connectionId),
              eq(zohoEntityMappings.fintekproEntityType, 'partner'),
              eq(zohoEntityMappings.zohoModule, 'Accounts'),
              eq(zohoEntityMappings.fintekproEntityId, connection.masterAgentId)
            )
          )
          .limit(1);

        if (masterAgentMapping) {
          return masterAgentMapping.zohoRecordId;
        }
      }

      // Fallback: Find the master connection's first partner account
      const [masterConnection] = await db
        .select()
        .from(zohoConnections)
        .where(
          and(
            eq(zohoConnections.isMaster, true),
            eq(zohoConnections.status, 'active')
          )
        )
        .limit(1);

      if (masterConnection) {
        const [masterMapping] = await db
          .select()
          .from(zohoEntityMappings)
          .where(
            and(
              eq(zohoEntityMappings.connectionId, masterConnection.id),
              eq(zohoEntityMappings.fintekproEntityType, 'partner'),
              eq(zohoEntityMappings.zohoModule, 'Accounts')
            )
          )
          .limit(1);

        return masterMapping?.zohoRecordId || null;
      }

      return null;
    } catch (error) {
      console.warn('ZohoConnectionResolver: Error getting master agent Zoho Account ID:', error);
      return null;
    }
  }
}

/**
 * Helper function to get the default Zoho connection ID for admin operations
 */
export async function getZohoConnectionId(): Promise<string | null> {
  try {
    const [connection] = await db
      .select({ id: zohoConnections.id })
      .from(zohoConnections)
      .where(
        or(
          eq(zohoConnections.isMaster, true),
          eq(zohoConnections.isDefault, true)
        )
      )
      .limit(1);

    if (connection?.id) return connection.id;

    const bootstrapped = await ZohoConnectionResolver.bootstrapFromEnvVars();
    return bootstrapped?.connectionId || null;
  } catch (error) {
    console.warn('getZohoConnectionId: Error fetching connection:', error);
    return null;
  }
}
