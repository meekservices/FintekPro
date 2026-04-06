import { Express } from 'express';
import { registerBondTradingOrderPart4Part1Routes } from './bond-trading-orders-4-1';
import { registerBondTradingOrderPart4Part2Routes } from './bond-trading-orders-4-2';

export function registerBondTradingOrderPart4Routes(app: Express): void {
  registerBondTradingOrderPart4Part1Routes(app);
  registerBondTradingOrderPart4Part2Routes(app);
}
