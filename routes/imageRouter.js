import express from 'express'

const imageRouter = express.Router()
import {admin, protect} from '../middleware/authMiddleware.js'
import {uploadImageFromS3, deleteImageFromS3} from "../controllers/imageController.js";

imageRouter.route('/:bucket').post(protect, admin, uploadImageFromS3);

imageRouter.route('/:bucket/:fileName').delete(protect, admin, deleteImageFromS3);

export default imageRouter;