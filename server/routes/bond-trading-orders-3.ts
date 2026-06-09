import { Express } from "express";
import { registerBondTradingOrderPart3Part1Routes } from "./bond-trading-orders-3-1";
import { registerBondTradingOrderPart3Part2Routes } from "./bond-trading-orders-3-2";

export function registerBondTradingOrderPart3Routes(app: Express): void {
	registerBondTradingOrderPart3Part1Routes(app);
	registerBondTradingOrderPart3Part2Routes(app);
}
