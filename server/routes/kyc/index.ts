import { Express } from "express";
import { registerKYCWizardPart1Routes } from "./index-1";
import { registerKYCWizardPart2Routes } from "./index-2";
import { registerKYCWizardPart3Routes } from "./index-3";
import { registerKYCWizardPart4Routes } from "./index-4";
import { registerKYCWizardPart5Routes } from "./index-5";

export function registerKYCWizardRoutes(app: Express): void {
	registerKYCWizardPart1Routes(app);
	registerKYCWizardPart2Routes(app);
	registerKYCWizardPart3Routes(app);
	registerKYCWizardPart4Routes(app);
	registerKYCWizardPart5Routes(app);
}
