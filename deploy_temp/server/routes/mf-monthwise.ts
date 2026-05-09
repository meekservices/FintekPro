import { Express } from 'express';
import { registerMFMonthwiPart1Routes } from './mf-monthwise-1';
import { registerMFMonthwiPart2Routes } from './mf-monthwise-2';
import { registerMFMonthwiPart3Routes } from './mf-monthwise-3';
import { registerMFMonthwiPart4Routes } from './mf-monthwise-4';

export function registerMFMonthwiseRoutes(app: Express): void {
  registerMFMonthwiPart1Routes(app);
  registerMFMonthwiPart2Routes(app);
  registerMFMonthwiPart3Routes(app);
  registerMFMonthwiPart4Routes(app);
}
