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
}
