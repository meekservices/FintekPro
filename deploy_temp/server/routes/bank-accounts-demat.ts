import { Express } from 'express';
import { registerBankAccountsDemaPart1Routes } from './bank-accounts-demat-1';
import { registerBankAccountsDemaPart2Routes } from './bank-accounts-demat-2';

export function registerBankAccountsDematRoutes(app: Express): void {
  registerBankAccountsDemaPart1Routes(app);
  registerBankAccountsDemaPart2Routes(app);
}
