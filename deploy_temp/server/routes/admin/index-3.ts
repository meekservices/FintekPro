import { Express } from 'express';
import { registerAdminPanelPart3Sub1Routes } from './index-3-1';
import { registerAdminPanelPart3Sub2Routes } from './index-3-2';

export function registerAdminPanelPart3Routes(app: Express): void {
  registerAdminPanelPart3Sub1Routes(app);
  registerAdminPanelPart3Sub2Routes(app);
}
