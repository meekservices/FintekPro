import { Express } from "express";
import { registerRiskProfilesPartnerAppPart1Routes } from "./risk-profiles-partner-apps-1";
import { registerRiskProfilesPartnerAppPart2Routes } from "./risk-profiles-partner-apps-2";
import { registerRiskProfilesPartnerAppPart3Routes } from "./risk-profiles-partner-apps-3";

export function registerRiskProfilesPartnerAppsRoutes(app: Express): void {
	registerRiskProfilesPartnerAppPart1Routes(app);
	registerRiskProfilesPartnerAppPart2Routes(app);
	registerRiskProfilesPartnerAppPart3Routes(app);
}
