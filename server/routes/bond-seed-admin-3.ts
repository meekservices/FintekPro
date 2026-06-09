import { Router } from "express";
import part1 from "./bond-seed-admin-3-1";
import part2 from "./bond-seed-admin-3-2";

const router = Router();
router.use("/", part1);
router.use("/", part2);

export default router;
