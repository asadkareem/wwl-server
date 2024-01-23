import {Router} from 'express';
import {protect} from "../middleware/authMiddleware.js";
import {permissionCheck} from "../controllers/memberfulController.js";

const memberfulRouter = Router();

memberfulRouter.route('/permissionCheck')
    .post(protect, permissionCheck)

export default memberfulRouter;
