import { Express } from 'express';
import { registerCarPart1Routes } from './cart-1';
import { registerCarPart2Routes } from './cart-2';

export function registerCartRoutes(app: Express): void {
  registerCarPart1Routes(app);
  registerCarPart2Routes(app);
}
