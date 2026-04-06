import { Express } from 'express';
import { registerBondsMarkPart2Part1Routes } from './bonds-market-2-1';
import { registerBondsMarkPart2Part2Routes } from './bonds-market-2-2';

export function registerBondsMarkPart2Routes(app: Express): void {
  registerBondsMarkPart2Part1Routes(app);
  registerBondsMarkPart2Part2Routes(app);
}
