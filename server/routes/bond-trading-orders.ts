import { Express } from 'express';
import { registerBondTradingOrderPart1Routes } from './bond-trading-orders-1';
import { registerBondTradingOrderPart2Routes } from './bond-trading-orders-2';
import { registerBondTradingOrderPart3Routes } from './bond-trading-orders-3';
import { registerBondTradingOrderPart4Routes } from './bond-trading-orders-4';

export function registerBondTradingOrdersRoutes(app: Express): void {
  registerBondTradingOrderPart1Routes(app);
  registerBondTradingOrderPart2Routes(app);
  registerBondTradingOrderPart3Routes(app);
  registerBondTradingOrderPart4Routes(app);
}
