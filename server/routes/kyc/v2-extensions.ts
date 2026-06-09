import { Express } from "express";
import { registerKycV2ExtensionPart1Routes } from "./v2-extensions-1";
import { registerKycV2ExtensionPart2Routes } from "./v2-extensions-2";

export function registerKycV2ExtensionRoutes(app: Express): void {
	console.log("[KYC v2 Extensions] Registering Part 1 routes...");
	registerKycV2ExtensionPart1Routes(app);

	console.log("[KYC v2 Extensions] Registering Part 2 routes...");
	registerKycV2ExtensionPart2Routes(app);

	console.log("✅ KYC v2 Extension routes fully registered");
}
