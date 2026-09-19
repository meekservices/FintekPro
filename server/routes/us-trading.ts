import { Router } from "express";
import part1 from "./us-trading-1";
import part2 from "./us-trading-2";
import part3 from "./us-trading-3";
import part4 from "./us-trading-4";

const router = Router();
// Mount part2 first so public routes (like GET /market/screener) are matched before subrouters with top-level requireAuth
router.use("/", part2);
router.use("/", part1);
router.use("/", part3);
router.use("/", part4);

export default router;
