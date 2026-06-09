import { Express } from "express";
import { registerUserProfileKYCPart1Routes } from "./user-profile-kyc-1";
import { registerUserProfileKYCPart2Routes } from "./user-profile-kyc-2";

export function registerUserProfileKYCRoutes(app: Express): void {
	registerUserProfileKYCPart1Routes(app);
	registerUserProfileKYCPart2Routes(app);
}
