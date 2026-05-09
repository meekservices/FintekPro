import { Express } from 'express';
import { registerReportsInlinePart1Routes } from './reports-inline-1';
import { registerReportsInlinePart2Routes } from './reports-inline-2';

export function registerReportsInlineRoutes(app: Express): void {
  registerReportsInlinePart1Routes(app);
  registerReportsInlinePart2Routes(app);
}
