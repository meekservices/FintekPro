import { Express } from 'express';
import { registerAdminPanelPart4Sub1Sub1Routes } from './index-4-1-1';
import { registerAdminPanelPart4Sub1Sub2Routes } from './index-4-1-2';

export function registerAdminPanelPart4Sub1Routes(app: Express): void {
  registerAdminPanelPart4Sub1Sub1Routes(app);
  registerAdminPanelPart4Sub1Sub2Routes(app);
}
