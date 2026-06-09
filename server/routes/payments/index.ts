import { Express } from "express";
import { registerPaymentPart1Routes } from "./index-1";
import { registerPaymentPart2Routes } from "./index-2";

export function registerPaymentRoutes(app: Express): void {
	registerPaymentPart1Routes(app);
	registerPaymentPart2Routes(app);
}
