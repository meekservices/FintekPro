export type UserRole = 'client' | 'agent' | 'admin' | 'partner';
export type NetworkState = 'online' | 'offline' | 'slow';
export type ActionCategory = 
  | 'view'
  | 'draft'
  | 'analyze'
  | 'execute'
  | 'submit'
  | 'approve'
  | 'configure'
  | 'trade'
  | 'payment';

interface RBACRule {
  role: UserRole;
  action: ActionCategory;
  networkStates: NetworkState[];
  allowed: boolean;
  message?: string;
}

const RBAC_RULES: RBACRule[] = [
  { role: 'client', action: 'view', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'client', action: 'draft', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'client', action: 'analyze', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'client', action: 'execute', networkStates: ['online'], allowed: true },
  { role: 'client', action: 'execute', networkStates: ['offline', 'slow'], allowed: false, message: 'Trade execution requires a stable internet connection.' },
  { role: 'client', action: 'submit', networkStates: ['online'], allowed: true },
  { role: 'client', action: 'submit', networkStates: ['offline', 'slow'], allowed: false, message: 'Form submission requires an internet connection.' },
  { role: 'client', action: 'trade', networkStates: ['online'], allowed: true },
  { role: 'client', action: 'trade', networkStates: ['offline', 'slow'], allowed: false, message: 'Trading requires a stable internet connection.' },
  { role: 'client', action: 'payment', networkStates: ['online'], allowed: true },
  { role: 'client', action: 'payment', networkStates: ['offline', 'slow'], allowed: false, message: 'Payments require an internet connection.' },

  { role: 'agent', action: 'view', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'agent', action: 'draft', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'agent', action: 'analyze', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'agent', action: 'execute', networkStates: ['online'], allowed: true },
  { role: 'agent', action: 'execute', networkStates: ['offline', 'slow'], allowed: false, message: 'Order execution requires a stable internet connection.' },
  { role: 'agent', action: 'submit', networkStates: ['online'], allowed: true },
  { role: 'agent', action: 'submit', networkStates: ['offline', 'slow'], allowed: false, message: 'Client consent capture requires an internet connection.' },
  { role: 'agent', action: 'approve', networkStates: ['online'], allowed: true },
  { role: 'agent', action: 'approve', networkStates: ['offline', 'slow'], allowed: false, message: 'Approvals require an internet connection.' },

  { role: 'admin', action: 'view', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'admin', action: 'draft', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'admin', action: 'analyze', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'admin', action: 'execute', networkStates: ['online'], allowed: true },
  { role: 'admin', action: 'execute', networkStates: ['offline', 'slow'], allowed: false, message: 'Execution requires a stable internet connection.' },
  { role: 'admin', action: 'approve', networkStates: ['online'], allowed: true },
  { role: 'admin', action: 'approve', networkStates: ['offline', 'slow'], allowed: false, message: 'Approvals require an internet connection.' },
  { role: 'admin', action: 'configure', networkStates: ['online'], allowed: true },
  { role: 'admin', action: 'configure', networkStates: ['offline', 'slow'], allowed: false, message: 'Configuration changes require an internet connection.' },

  { role: 'partner', action: 'view', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'partner', action: 'draft', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'partner', action: 'analyze', networkStates: ['online', 'offline', 'slow'], allowed: true },
  { role: 'partner', action: 'execute', networkStates: ['online'], allowed: true },
  { role: 'partner', action: 'execute', networkStates: ['offline', 'slow'], allowed: false, message: 'Execution requires a stable internet connection.' },
];

export function checkOfflinePermission(
  role: UserRole,
  action: ActionCategory,
  networkState: NetworkState
): { allowed: boolean; message?: string } {
  const rule = RBAC_RULES.find(
    r => r.role === role && 
         r.action === action && 
         r.networkStates.includes(networkState)
  );

  if (!rule) {
    return { 
      allowed: false, 
      message: `Action "${action}" is not defined for role "${role}" in ${networkState} mode.` 
    };
  }

  return { 
    allowed: rule.allowed, 
    message: rule.allowed ? undefined : rule.message 
  };
}

export function getDisallowedActions(role: UserRole, networkState: NetworkState): ActionCategory[] {
  const disallowed: ActionCategory[] = [];
  
  const actions: ActionCategory[] = ['view', 'draft', 'analyze', 'execute', 'submit', 'approve', 'configure', 'trade', 'payment'];
  
  for (const action of actions) {
    const { allowed } = checkOfflinePermission(role, action, networkState);
    if (!allowed) {
      disallowed.push(action);
    }
  }
  
  return disallowed;
}

export function getAllowedActions(role: UserRole, networkState: NetworkState): ActionCategory[] {
  const allowed: ActionCategory[] = [];
  
  const actions: ActionCategory[] = ['view', 'draft', 'analyze', 'execute', 'submit', 'approve', 'configure', 'trade', 'payment'];
  
  for (const action of actions) {
    const result = checkOfflinePermission(role, action, networkState);
    if (result.allowed) {
      allowed.push(action);
    }
  }
  
  return allowed;
}

export const OFFLINE_CAPABILITIES = {
  client: {
    allowed: ['View portfolio', 'Draft KYC forms', 'Review proposals', 'Use calculators', 'Analyze investments'],
    disallowed: ['Trade execution', 'Payments', 'Final form submissions', 'Consent capture'],
  },
  agent: {
    allowed: ['View client data', 'Draft proposals', 'Take notes', 'Portfolio analysis'],
    disallowed: ['Order execution', 'Client consent capture', 'Approvals'],
  },
  admin: {
    allowed: ['View dashboards', 'Draft reports', 'Analyze data'],
    disallowed: ['Configuration changes', 'Approvals', 'User management'],
  },
  partner: {
    allowed: ['View reports', 'Draft documents', 'Analyze performance'],
    disallowed: ['Execution actions', 'Configuration changes'],
  },
} as const;
