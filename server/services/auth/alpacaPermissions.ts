import { logger } from '../../../logger';

export type Role = 'USER' | 'AGENT' | 'ADMIN';
export type AlpacaAction = 'TRADE_US' | 'VIEW_PORTFOLIO' | 'VIEW_CLIENT_US_PORTFOLIO' | '*';

export class AlpacaPermissions {
  
  private policies: Record<Role, AlpacaAction[]> = {
    USER: ['TRADE_US', 'VIEW_PORTFOLIO'],
    AGENT: ['VIEW_CLIENT_US_PORTFOLIO'], // Agents can't execute trades directly on US stocks
    ADMIN: ['*'] // Admins have full access including risk overrides
  };

  /**
   * Evaluates if a given role has permission to execute an action on the Alpaca integration.
   */
  hasPermission(role: Role, action: AlpacaAction): boolean {
    const allowedActions = this.policies[role];
    
    if (!allowedActions) return false;
    
    if (allowedActions.includes('*')) return true;
    
    return allowedActions.includes(action);
  }

  /**
   * Middleware-style wrapper for strict enforcement
   */
  enforce(role: Role, action: AlpacaAction) {
    if (!this.hasPermission(role, action)) {
      logger.error(`[AlpacaPermissions] Access Denied for role ${role} attempting action ${action}`);
      throw new Error('Unauthorized Access: You do not have permission to perform this US trading action.');
    }
  }
}

export const alpacaPermissions = new AlpacaPermissions();
