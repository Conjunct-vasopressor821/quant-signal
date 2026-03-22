import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import analyzeRouter from "./analyze.js";
import signalsRouter from "./signals.js";
import uploadsRouter from "./uploads.js";
import marketRouter from "./market.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(analyzeRouter);
router.use(signalsRouter);
router.use(uploadsRouter);

export default router;
