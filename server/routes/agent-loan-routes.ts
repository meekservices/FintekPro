import { Router } from "express";
import part1 from "./agent-loan-routes-1";
import part2 from "./agent-loan-routes-2";
import part3 from "./agent-loan-routes-3";

const router = Router();
router.use("/", part1);
router.use("/", part2);
router.use("/", part3);

export default router;
