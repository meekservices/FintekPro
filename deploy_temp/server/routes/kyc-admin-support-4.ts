import { Express } from 'express';
import { registerKYCAdminSupporPart4Part1Routes } from './kyc-admin-support-4-1';
import { registerKYCAdminSupporPart4Part2Routes } from './kyc-admin-support-4-2';

export function registerKYCAdminSupporPart4Routes(app: Express): void {
  registerKYCAdminSupporPart4Part1Routes(app);
  registerKYCAdminSupporPart4Part2Routes(app);
}
