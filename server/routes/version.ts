import { Router } from "express";
import { APP_VERSION, BUILD_TIMESTAMP } from "@shared/version";

const router = Router();

router.get("/api/version", (req, res) => {
	res.json({
		success: true,
		data: {
			version: APP_VERSION,
			buildTimestamp: BUILD_TIMESTAMP,
			serverTime: new Date().toISOString(),
		},
	});
});

export default router;
