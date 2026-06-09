import { Router } from "express";
import part1 from "./agent-prospect-wizard-1";
import part2 from "./agent-prospect-wizard-2";
import part3 from "./agent-prospect-wizard-3";
import part4 from "./agent-prospect-wizard-4";
import part5 from "./agent-prospect-wizard-5";

const router = Router();
router.use("/", part1);
router.use("/", part2);
router.use("/", part3);
router.use("/", part4);
router.use("/", part5);

export default router;
