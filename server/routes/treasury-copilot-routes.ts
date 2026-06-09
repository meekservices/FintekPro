import { Router } from "express";
import { treasuryCopilotService } from "../services/treasury-copilot-service";
import { apiResponse } from "../utils/responses";

const router = Router();

router.post("/query", async (req, res) => {
	if (!req.isAuthenticated()) {
		return apiResponse.unauthorized(res);
	}

	const { entityId, query } = req.body;

	if (!entityId || !query) {
		return apiResponse.badRequest(res, "Missing entityId or query");
	}

	try {
		const result = await treasuryCopilotService.handleQuery(entityId, query);
		return res.json(result);
	} catch (error: any) {
		console.error("[TreasuryCopilotRoutes] Error handling query:", error);
		return apiResponse.error(res, error.message || "Failed to process query");
	}
});

export default router;
