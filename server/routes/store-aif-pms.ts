import { Router } from "express";
import part1 from "./store-aif-pms-1";
import part2 from "./store-aif-pms-2";
import part3 from "./store-aif-pms-3";
import part4 from "./store-aif-pms-4";
import part5 from "./store-aif-pms-5";

const router = Router();
router.use("/", part1);
router.use("/", part2);
router.use("/", part3);
router.use("/", part4);
router.use("/", part5);

export default router;
