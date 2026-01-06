import { db } from '../db';
import { zohoConnections } from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';

export interface ResolvedConnection {
  connectionId: string;
  zohoDataCenter: string;
  isMaster: boolean;
  masterAgentId?: string;
}

export class ZohoConnectionResolver {
  /**
   * Resolve the appropriate Zoho connection for an agent.
   * Priority:
   * 1. Agent's own connection (if they have one)
   * 2. Master connection (isMaster = true)
   * 3. Default connection (isDefault = true)
   * 
   * Returns null if no connection is available (graceful skip)
   */
  static async resolveForAgent(agentId: string): Promise<ResolvedConnection | null> {
    try {
      // First try to find agent's own connection
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

      // Fall back to master connection
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

      // Fall back to default connection
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

      // No connection available
      return null;
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

      // Fall back to default if no master is configured
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

      return null;
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
