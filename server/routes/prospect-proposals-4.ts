import { Router } from "express";
import part1 from "./prospect-proposals-4-1";
import part2 from "./prospect-proposals-4-2";
import part3 from "./prospect-proposals-4-3";

const router = Router();
router.use("/", part1);
router.use("/", part2);
router.use("/", part3);

export default router;
