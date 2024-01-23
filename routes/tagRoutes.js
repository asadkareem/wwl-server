import express from 'express'

const router = express.Router()
import { admin, protect } from '../middleware/authMiddleware.js'
import { createTagsArray, getAllTags, getTag } from "../controllers/tagController.js";

router.route('/')
    .get(createTagsArray)

router.route('/all')
    .get(getAllTags)

router.route('/:tag')
    .get(getTag)
export default router