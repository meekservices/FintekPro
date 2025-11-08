import { db } from "../db";
import { agents, customerCareAgents, agentClientMapping } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface AgentDetails {
  agentId: string;
  arnCode: string | null;
  euinNumber: string | null;
  fullName: string;
}

/**
 * Agent Selection Service
 * Determines which agent's EUIN/ARN to use for orders based on client-agent mappings
 * Falls back to default agent if no mapping exists
 */
export class AgentSelectionService {
  /**
   * Get the agent details for a specific client and product type
   * Uses client-agent mapping if exists, otherwise uses default agent
   * 
   * @param clientId - User ID of the client
   * @param productType - Product type (e.g., 'mutual_funds', 'aif', 'pms', etc.)
   * @returns Agent details with ARN and EUIN for order snapshot
   */
  async getAgentForClient(
    clientId: string, 
    productType: string = 'mutual_funds'
  ): Promise<AgentDetails> {
    try {
      // Step 1: Check if there's an active client-agent mapping
      const mappings = await db
        .select()
        .from(agentClientMapping)
        .where(
          and(
            eq(agentClientMapping.clientId, clientId),
            eq(agentClientMapping.isActive, true),
            eq(agentClientMapping.status, 'active')
          )
        );

      // Filter for product-specific or general mapping
      const relevantMapping = mappings.find(
        m => m.productType === productType || m.productType === null
      );

      if (relevantMapping) {
        // Client has an assigned agent - check both agent tables
        // Try agents table first
        const agentResults = await db
          .select()
          .from(agents)
          .where(eq(agents.id, relevantMapping.agentId))
          .limit(1);

        if (agentResults.length > 0 && agentResults[0].status === 'active') {
          return {
            agentId: agentResults[0].id,
            arnCode: agentResults[0].arnCode,
            euinNumber: agentResults[0].euinNumber,
            fullName: agentResults[0].fullName
          };
        }

        // Try customer_care_agents table if not found in agents
        const careAgentResults = await db
          .select()
          .from(customerCareAgents)
          .where(eq(customerCareAgents.id, relevantMapping.agentId))
          .limit(1);

        if (careAgentResults.length > 0 && careAgentResults[0].status === 'active') {
          return {
            agentId: careAgentResults[0].id,
            arnCode: careAgentResults[0].arnCode,
            euinNumber: careAgentResults[0].euinNumber,
            fullName: careAgentResults[0].fullName
          };
        }
      }

      // Step 2: No mapping found or agent inactive - fall back to default agent
      return await this.getDefaultAgent();

    } catch (error) {
      console.error('[Agent Selection Service] Error getting agent for client:', error);
      // In case of error, fall back to default agent
      return await this.getDefaultAgent();
    }
  }

  /**
   * Get the default agent for fallback scenarios
   * Looks up the agent marked with isDefault = true
   * 
   * @returns Default agent details
   * @throws Error if no default agent is configured
   */
  async getDefaultAgent(): Promise<AgentDetails> {
    try {
      // Try to get from agents table first
      const agentResults = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.isDefault, true),
            eq(agents.status, 'active')
          )
        )
        .limit(1);

      if (agentResults.length > 0) {
        const agent = agentResults[0];
        return {
          agentId: agent.id,
          arnCode: agent.arnCode,
          euinNumber: agent.euinNumber,
          fullName: agent.fullName
        };
      }

      // Fall back to customer_care_agents table
      const careAgentResults = await db
        .select()
        .from(customerCareAgents)
        .where(
          and(
            eq(customerCareAgents.isDefault, true),
            eq(customerCareAgents.status, 'active')
          )
        )
        .limit(1);

      if (careAgentResults.length > 0) {
        const agent = careAgentResults[0];
        return {
          agentId: agent.id,
          arnCode: agent.arnCode,
          euinNumber: agent.euinNumber,
          fullName: agent.fullName
        };
      }

      throw new Error('No default agent configured in the system');

    } catch (error) {
      console.error('[Agent Selection Service] Error getting default agent:', error);
      throw error;
    }
  }

  /**
   * Set a specific agent as the default agent
   * Removes default flag from all other agents
   * 
   * @param agentId - Agent ID to set as default
   */
  async setDefaultAgent(agentId: string, tableType: 'agents' | 'customer_care_agents' = 'customer_care_agents'): Promise<void> {
    try {
      if (tableType === 'agents') {
        // Remove default flag from all agents
        await db
          .update(agents)
          .set({ isDefault: false });

        // Set the specified agent as default
        await db
          .update(agents)
          .set({ isDefault: true })
          .where(eq(agents.id, agentId));

      } else {
        // Remove default flag from all customer care agents
        await db
          .update(customerCareAgents)
          .set({ isDefault: false });

        // Set the specified agent as default
        await db
          .update(customerCareAgents)
          .set({ isDefault: true })
          .where(eq(customerCareAgents.id, agentId));
      }

      console.log(`✅ Default agent set to: ${agentId}`);
    } catch (error) {
      console.error('[Agent Selection Service] Error setting default agent:', error);
      throw error;
    }
  }
}

export const agentSelectionService = new AgentSelectionService();
