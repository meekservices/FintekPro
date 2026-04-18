/**
 * hub-types.ts
 * Shared type definitions for the AlpacaClientHub component.
 * Imported by hub.tsx to keep the component file free of inline interface declarations.
 */

import type { LucideIcon } from "lucide-react";

/** Shape of the /api/us-trading/account API response */
export interface AccountQueryResponse {
  account: Record<string, string> | null;
  onboarding: boolean;
  onboarding_status: string;
  is_paper: boolean;
}

/** Props for the NavItem sub-component used in the sidebar */
export interface NavItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
}
