import { Express } from 'express';
import { registerAIFPMSSystemPart3Part1Routes } from './aif-pms-system-proposals-3-1';
import { registerAIFPMSSystemPart3Part2Routes } from './aif-pms-system-proposals-3-2';

export function registerAIFPMSSystemPart3Routes(app: Express): void {
  registerAIFPMSSystemPart3Part1Routes(app);
  registerAIFPMSSystemPart3Part2Routes(app);
}
