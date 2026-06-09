import { Router } from "express";
export { migrationRouter } from "./bond-seed-admin-migration";
import part1 from "./bond-seed-admin-1";
import part2 from "./bond-seed-admin-2";
import part3 from "./bond-seed-admin-3";

const router = Router();
router.use("/", part1);
router.use("/", part2);
router.use("/", part3);

export default router;
