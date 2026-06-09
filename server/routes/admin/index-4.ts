import { Express } from "express";
import { registerAdminPanelPart4Sub1Routes } from "./index-4-1";
import { registerAdminPanelPart4Sub2Routes } from "./index-4-2";

export function registerAdminPanelPart4Routes(app: Express): void {
	registerAdminPanelPart4Sub1Routes(app);
	registerAdminPanelPart4Sub2Routes(app);
}
