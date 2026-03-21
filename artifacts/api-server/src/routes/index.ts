import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import analyzeRouter from "./analyze.js";
import signalsRouter from "./signals.js";
import uploadsRouter from "./uploads.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(signalsRouter);
router.use(uploadsRouter);

export default router;
