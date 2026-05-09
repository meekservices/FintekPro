import { Express } from 'express';
import { registerLoanAdminPart1Routes } from './admin-1';
import { registerLoanAdminPart2Routes } from './admin-2';

export function registerLoanAdminRoutes(app: Express): void {
  registerLoanAdminPart1Routes(app);
  registerLoanAdminPart2Routes(app);
}
