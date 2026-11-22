import { Express } from "express";
import { registerPartnerHierarchyPart1Routes } from "./hierarchy-routes-1";
import { registerPartnerHierarchyPart2Routes } from "./hierarchy-routes-2";
import { registerPartnerAgreementRoutes } from "./agreement-routes";

export function registerPartnerHierarchyRoutes(app: Express): void {
	registerPartnerHierarchyPart1Routes(app);
	registerPartnerHierarchyPart2Routes(app);
	registerPartnerAgreementRoutes(app);
}
