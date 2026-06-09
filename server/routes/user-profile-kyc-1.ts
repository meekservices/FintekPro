import { Express } from "express";
import { registerUserProfileKYCPart1Part1Routes } from "./user-profile-kyc-1-1";
import { registerUserProfileKYCPart1Part2Routes } from "./user-profile-kyc-1-2";

export function registerUserProfileKYCPart1Routes(app: Express): void {
	registerUserProfileKYCPart1Part1Routes(app);
	registerUserProfileKYCPart1Part2Routes(app);
}
