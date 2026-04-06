import { Express } from 'express';
import { registerPartnerPortalPart1Routes } from './index-1';
import { registerPartnerPortalPart2Routes } from './index-2';

export function registerPartnerPortalRoutes(app: Express): void {
  registerPartnerPortalPart1Routes(app);
  registerPartnerPortalPart2Routes(app);
}
