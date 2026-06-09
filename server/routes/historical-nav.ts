import { Router } from "express";
import { historicalNavService } from "../services/historical-nav-service";
import { historicalNavRefreshJob } from "../services/historical-nav-refresh-job";

const router = Router();

router.get("/status", async (req, res) => {
	try {
		const status = await historicalNavRefreshJob.getStatus();
		res.json(status);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.post("/trigger-refresh", async (req, res) => {
	try {
		const stats = await historicalNavRefreshJob.runRefresh();
		res.json({ message: "Refresh triggered", stats });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/fetch/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const result =
			await historicalNavService.fetchAndStoreMutualFundHistory(schemeCode);
		res.json(result);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/history/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const { startDate, endDate } = req.query;

		const data = await historicalNavService.getNavHistory(
			schemeCode,
			"mutual_fund",
			startDate as string,
			endDate as string,
		);

		res.json({
			schemeCode,
			count: data.length,
			data: data.slice(0, 100),
		});
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/summary/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const summary = await historicalNavService.getDataSummary(
			schemeCode,
			"mutual_fund",
		);
		res.json(summary);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/metrics/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const { periodYears = "5" } = req.query;

		const { ready, summary } =
			await historicalNavService.ensureData(schemeCode);

		if (!ready) {
			return res.status(404).json({ error: "Could not fetch data for scheme" });
		}

		const metrics = await historicalNavService.calculateMetrics(
			schemeCode,
			"mutual_fund",
			Number.parseInt(periodYears as string),
		);

		res.json({
			schemeCode,
			periodYears: Number.parseInt(periodYears as string),
			dataSummary: summary,
			metrics,
		});
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

router.post("/batch-fetch", async (req, res) => {
	try {
		const { schemeCodes } = req.body;

		if (!Array.isArray(schemeCodes) || schemeCodes.length === 0) {
			return res.status(400).json({ error: "schemeCodes array required" });
		}

		const results = await Promise.all(
			schemeCodes
				.slice(0, 10)
				.map((code) =>
					historicalNavService.fetchAndStoreMutualFundHistory(code.toString()),
				),
		);

		res.json({
			fetched: results.length,
			successful: results.filter((r) => r.success).length,
			results,
		});
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
});

export default router;
