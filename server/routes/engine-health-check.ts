import { Router } from "express";
import part1 from "./engine-health-check-1";
import part2 from "./engine-health-check-2";

const router = Router();
router.use("/", part1);
router.use("/", part2);

export default router;
