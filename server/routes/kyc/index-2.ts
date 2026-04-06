import { Express } from 'express';
import { registerKYCWizardPart2Sub1Routes } from './index-2-1';
import { registerKYCWizardPart2Sub2Routes } from './index-2-2';

export function registerKYCWizardPart2Routes(app: Express): void {
  registerKYCWizardPart2Sub1Routes(app);
  registerKYCWizardPart2Sub2Routes(app);
}
