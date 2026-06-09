import { Express } from "express";
import { registerLoanPart1Routes } from "./index-1";
import { registerLoanPart2Routes } from "./index-2";

export function registerLoanRoutes(app: Express): void {
	registerLoanPart1Routes(app);
	registerLoanPart2Routes(app);
}
export {
	registerLoanProcessingRoutes,
	registerLoanComparisonRoutes,
} from "./index-2";
