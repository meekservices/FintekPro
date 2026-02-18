export enum PortalType {
  MAIN = 'main',
  PARTNER = 'partner',
  AGENT = 'agent',
  ADMIN = 'admin',
}

export interface PortalBrandConfig {
  portalType: PortalType;
  logoPath: string;
  label: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  sidebarBg: string;
  sidebarText: string;
}

export const PORTAL_BRAND_CONFIG: Record<PortalType, PortalBrandConfig> = {
  [PortalType.MAIN]: {
    portalType: PortalType.MAIN,
    logoPath: '/api/system/portal-logo/main',
    label: 'FintekPro',
    tagline: 'Your Financial Future, Simplified',
    primaryColor: '#2563EB',
    accentColor: '#3B82F6',
    sidebarBg: '#1A2B3D',
    sidebarText: '#E2E8F0',
  },
  [PortalType.PARTNER]: {
    portalType: PortalType.PARTNER,
    logoPath: '/api/system/portal-logo/partner',
    label: 'FintekPro | Partner',
    tagline: 'Grow With Us',
    primaryColor: '#7C3AED',
    accentColor: '#8B5CF6',
    sidebarBg: '#2D1B4E',
    sidebarText: '#E9D5FF',
  },
  [PortalType.AGENT]: {
    portalType: PortalType.AGENT,
    logoPath: '/api/system/portal-logo/agent',
    label: 'FintekPro | Agent',
    tagline: 'Empower Your Clients',
    primaryColor: '#059669',
    accentColor: '#10B981',
    sidebarBg: '#1B3D2F',
    sidebarText: '#D1FAE5',
  },
  [PortalType.ADMIN]: {
    portalType: PortalType.ADMIN,
    logoPath: '/api/system/portal-logo/admin',
    label: 'FintekPro | Admin',
    tagline: 'Platform Control Center',
    primaryColor: '#DC2626',
    accentColor: '#EF4444',
    sidebarBg: '#3D1B1B',
    sidebarText: '#FEE2E2',
  },
};

export function resolvePortalType(subdomain: string): PortalType {
  switch (subdomain) {
    case 'partner': return PortalType.PARTNER;
    case 'agent': return PortalType.AGENT;
    case 'admin': return PortalType.ADMIN;
    default: return PortalType.MAIN;
  }
}
