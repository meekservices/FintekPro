import { Request, Response, NextFunction } from "express";
import {
	clientFeeModeService,
	ClientCapabilities,
} from "../services/client-fee-mode-service";

declare global {
	namespace Express {
		interface Request {
			clientCapabilities?: ClientCapabilities;
		}
	}
}

export async function resolveClientCapabilities(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const userId = (req as any).user?.id;

		if (!userId) {
			req.clientCapabilities = {
				canUseAi: false,
				canViewRecommendations: false,
				advisoryFeeApplicable: false,
				platformFeeApplicable: false,
				feeMode: null,
				feeModeSelected: false,
				requiresModeSelection: true,
				policyVersion: 1,
			};
			return next();
		}

		const capabilities =
			await clientFeeModeService.resolveClientCapabilities(userId);
		req.clientCapabilities = capabilities;
		next();
	} catch (error) {
		console.error("Error resolving client capabilities:", error);
		req.clientCapabilities = {
			canUseAi: false,
			canViewRecommendations: false,
			advisoryFeeApplicable: false,
			platformFeeApplicable: false,
			feeMode: null,
			feeModeSelected: false,
			requiresModeSelection: true,
			policyVersion: 1,
		};
		next();
	}
}

export function requireAdvisoryMode(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (!req.clientCapabilities?.canUseAi) {
		return res.status(403).json({
			error: "AI features not available",
			code: "ADVISORY_MODE_REQUIRED",
			message:
				"This feature requires Advisory + Platform mode. Please update your fee mode selection.",
		});
	}
	next();
}

export function requireRecommendationsAccess(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (!req.clientCapabilities?.canViewRecommendations) {
		return res.status(403).json({
			error: "Recommendations not available",
			code: "RECOMMENDATIONS_BLOCKED",
			message:
				"Recommendations are only available in Advisory + Platform mode.",
		});
	}
	next();
}

export function requireFeeModeSelected(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (!req.clientCapabilities?.feeModeSelected) {
		return res.status(403).json({
			error: "Fee mode not selected",
			code: "FEE_MODE_REQUIRED",
			message:
				"Please select your fee mode before proceeding with Global Investments.",
		});
	}
	next();
}

export function blockTradingWithoutFeeMode(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (!req.clientCapabilities?.feeModeSelected) {
		return res.status(403).json({
			error: "Trading blocked",
			code: "TRADING_BLOCKED_NO_FEE_MODE",
			message:
				"Trading is blocked until you select a fee mode for Global Investments.",
		});
	}
	next();
}
