import { Router } from "express";
import part1 from "./prospect-proposals-1";
import part2 from "./prospect-proposals-2";
import part3 from "./prospect-proposals-3";
import part4 from "./prospect-proposals-4";

const router = Router();
router.use("/", part1);
router.use("/", part2);
router.use("/", part3);
router.use("/", part4);

export default router;
