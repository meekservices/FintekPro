import { Express } from "express";
import { registerBondsMarkPart1Routes } from "./bonds-market-1";
import { registerBondsMarkPart2Routes } from "./bonds-market-2";
import { registerBondsMarkPart3Routes } from "./bonds-market-3";

export function registerBondsMarketRoutes(app: Express): void {
	registerBondsMarkPart1Routes(app);
	registerBondsMarkPart2Routes(app);
	registerBondsMarkPart3Routes(app);
}
