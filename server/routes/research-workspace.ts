import { Router } from "express";
import part1 from "./research-workspace-1";
import part2 from "./research-workspace-2";

const router = Router();
router.use("/", part1);
router.use("/", part2);

export default router;
