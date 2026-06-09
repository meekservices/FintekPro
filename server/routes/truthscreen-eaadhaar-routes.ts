import { Router } from "express";
import { truthScreenEAadhaarDGLService } from "../services/truthscreen-eaadhaar-digilocker-service";

const router = Router();

router.post("/api/kyc/eaadhaar-digilocker/initiate", async (req, res) => {
	try {
		if (!req.user?.id) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const { transId } = req.body;

		const result =
			await truthScreenEAadhaarDGLService.generateDigiLockerLink(transId);

		if (!result.success) {
			return res.status(400).json(result);
		}

		res.json(result);
	} catch (error: any) {
		console.error("[E-Aadhaar DGL Route] Initiate error:", error.message);
		res
			.status(500)
			.json({
				success: false,
				message: "Failed to initiate E-Aadhaar DigiLocker flow",
			});
	}
});

router.get(
	"/api/kyc/eaadhaar-digilocker/status/:tsTransId",
	async (req, res) => {
		try {
			if (!req.user?.id) {
				return res
					.status(401)
					.json({ success: false, message: "Authentication required" });
			}

			const { tsTransId } = req.params;

			if (!tsTransId) {
				return res
					.status(400)
					.json({ success: false, message: "Transaction ID is required" });
			}

			const result = await truthScreenEAadhaarDGLService.checkStatus(tsTransId);

			res.json(result);
		} catch (error: any) {
			console.error("[E-Aadhaar DGL Route] Status check error:", error.message);
			res
				.status(500)
				.json({
					success: false,
					message: "Failed to check E-Aadhaar DigiLocker status",
				});
		}
	},
);

router.get("/api/kyc/eaadhaar-digilocker/info", async (_req, res) => {
	try {
		const info = truthScreenEAadhaarDGLService.getServiceInfo();
		res.json({ success: true, ...info });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
});

export default router;
