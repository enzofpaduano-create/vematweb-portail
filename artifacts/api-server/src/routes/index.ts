import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import cataloguesRouter from "./catalogues";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(cataloguesRouter);

export default router;
