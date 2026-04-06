import { Express } from 'express';
import { registerAdminPanelPart5Sub1Routes } from './index-5-1';
import { registerAdminPanelPart5Sub2Routes } from './index-5-2';

export function registerAdminPanelPart5Routes(app: Express): void {
  registerAdminPanelPart5Sub1Routes(app);
  registerAdminPanelPart5Sub2Routes(app);
}
