import { Express } from "express";
import { registerKYCAdminSupporPart1Routes } from "./kyc-admin-support-1";
import { registerKYCAdminSupporPart2Routes } from "./kyc-admin-support-2";
import { registerKYCAdminSupporPart3Routes } from "./kyc-admin-support-3";
import { registerKYCAdminSupporPart4Routes } from "./kyc-admin-support-4";

export function registerKYCAdminSupportRoutes(app: Express): void {
	registerKYCAdminSupporPart1Routes(app);
	registerKYCAdminSupporPart2Routes(app);
	registerKYCAdminSupporPart3Routes(app);
	registerKYCAdminSupporPart4Routes(app);
}
