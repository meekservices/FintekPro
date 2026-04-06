import { Express } from 'express';
import { registerMarketDataPart1Routes } from './market-data-1';
import { registerMarketDataPart2Routes } from './market-data-2';

export function registerMarketDataRoutes(app: Express): void {
  registerMarketDataPart1Routes(app);
  registerMarketDataPart2Routes(app);
}
