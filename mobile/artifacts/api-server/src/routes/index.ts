import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import statusRouter from "./v1/status.js";
import devicesRouter from "./v1/devices.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/v1", statusRouter);
router.use("/v1", devicesRouter);

export default router;
