import { Router } from "express";
import { exchangeStockService } from "../services/exchange-stock-service";

const router = Router();

// Get sync progress for an exchange
router.get("/progress/:exchange", async (req, res) => {
	try {
		const exchange = req.params.exchange.toUpperCase() as "NSE" | "BSE";
		if (exchange !== "NSE" && exchange !== "BSE") {
			return res
				.status(400)
				.json({ error: "Invalid exchange. Use NSE or BSE" });
		}
		const progress = exchangeStockService.getSyncProgress(exchange);
		res.json(progress);
	} catch (error) {
		console.error("Error getting sync progress:", error);
		res.status(500).json({ error: "Failed to get sync progress" });
	}
});

// Trigger NSE stock sync
router.post("/nse", async (req, res) => {
	try {
		const { limit, topOnly = true } = req.body;

		// Check if already syncing
		const currentProgress = exchangeStockService.getSyncProgress("NSE");
		if (
			currentProgress.status !== "idle" &&
			currentProgress.status !== "complete" &&
			currentProgress.status !== "error"
		) {
			return res.status(409).json({
				error: "NSE sync already in progress",
				progress: currentProgress,
			});
		}

		// Reset and start sync
		exchangeStockService.resetProgress("NSE");

		// Start sync in background
		exchangeStockService.syncNSEStocks({ limit, topOnly }).catch((err) => {
			console.error("NSE sync failed:", err);
		});

		res.json({
			message: "NSE sync started",
			progress: exchangeStockService.getSyncProgress("NSE"),
		});
	} catch (error) {
		console.error("Error starting NSE sync:", error);
		res.status(500).json({ error: "Failed to start NSE sync" });
	}
});

// Trigger BSE stock sync
router.post("/bse", async (req, res) => {
	try {
		const { limit, topOnly = true } = req.body;

		// Check if already syncing
		const currentProgress = exchangeStockService.getSyncProgress("BSE");
		if (
			currentProgress.status !== "idle" &&
			currentProgress.status !== "complete" &&
			currentProgress.status !== "error"
		) {
			return res.status(409).json({
				error: "BSE sync already in progress",
				progress: currentProgress,
			});
		}

		// Reset and start sync
		exchangeStockService.resetProgress("BSE");

		// Start sync in background
		exchangeStockService.syncBSEStocks({ limit, topOnly }).catch((err) => {
			console.error("BSE sync failed:", err);
		});

		res.json({
			message: "BSE sync started",
			progress: exchangeStockService.getSyncProgress("BSE"),
		});
	} catch (error) {
		console.error("Error starting BSE sync:", error);
		res.status(500).json({ error: "Failed to start BSE sync" });
	}
});

// Reset sync progress
router.post("/reset/:exchange", async (req, res) => {
	try {
		const exchange = req.params.exchange.toUpperCase() as "NSE" | "BSE";
		if (exchange !== "NSE" && exchange !== "BSE") {
			return res
				.status(400)
				.json({ error: "Invalid exchange. Use NSE or BSE" });
		}
		exchangeStockService.resetProgress(exchange);
		res.json({ message: `${exchange} sync progress reset` });
	} catch (error) {
		console.error("Error resetting sync:", error);
		res.status(500).json({ error: "Failed to reset sync" });
	}
});

// Get available NSE symbols
router.get("/nse/symbols", async (req, res) => {
	try {
		const symbols = await exchangeStockService.getAllNSESymbols();
		res.json({
			count: symbols.length,
			symbols: symbols.slice(0, 100), // Return first 100 for preview
			topSymbols: exchangeStockService.getTopNSESymbols(),
		});
	} catch (error) {
		console.error("Error fetching NSE symbols:", error);
		res.status(500).json({ error: "Failed to fetch NSE symbols" });
	}
});

// Get BSE stocks list
router.get("/bse/symbols", async (req, res) => {
	try {
		const stocks = exchangeStockService.getTopBSEStocks();
		res.json({
			count: stocks.length,
			stocks,
		});
	} catch (error) {
		console.error("Error fetching BSE symbols:", error);
		res.status(500).json({ error: "Failed to fetch BSE symbols" });
	}
});

export default router;
