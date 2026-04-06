import { Express } from 'express';
import { registerAdminPanelPart1Routes } from './index-1';
import { registerAdminPanelPart2Routes } from './index-2';
import { registerAdminPanelPart3Routes } from './index-3';
import { registerAdminPanelPart4Routes } from './index-4';
import { registerAdminPanelPart5Routes } from './index-5';
import { registerAdminPanelPart6Routes } from './index-6';
import { registerAdminPanelPart7Routes } from './index-7';

export function registerAdminPanelRoutes(app: Express): void {
  registerAdminPanelPart1Routes(app);
  registerAdminPanelPart2Routes(app);
  registerAdminPanelPart3Routes(app);
  registerAdminPanelPart4Routes(app);
  registerAdminPanelPart5Routes(app);
  registerAdminPanelPart6Routes(app);
  registerAdminPanelPart7Routes(app);
}
