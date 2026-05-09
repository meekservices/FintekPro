import { Express } from 'express';
import { registerReportsInline21Routes } from './reports-inline-2-1';
import { registerReportsInline22Routes } from './reports-inline-2-2';

export function registerReportsInlinePart2Routes(app: Express): void {
  registerReportsInline21Routes(app);
  registerReportsInline22Routes(app);
}
