import express from 'express'

const router = express.Router()
import {
    createNewRating,
    getRatingById,
    migrateRatings
} from '../controllers/ratingController.js'
import {admin, protect} from '../middleware/authMiddleware.js'

router.route('/')
    .post(protect, createNewRating)

router.route('/get_rating/:id')
    .get(protect, getRatingById)

router.route('/migrate')
    .get(protect, admin, migrateRatings)

export default router