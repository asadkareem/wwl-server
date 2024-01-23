import express from 'express'

const router = express.Router()
import {
    createNewIngredient,
    getAllIngredients,
    deleteIngredient,
    getIngredientById,
    updateIngredient,
    getSortedIngredients, migrateIngredients
} from '../controllers/ingredientController.js'
import {admin, protect} from '../middleware/authMiddleware.js'

router.route('/')
    .post(protect, admin, createNewIngredient)

router.route('/all/:pageNum')
    .get(protect, getAllIngredients)

router.route('/sorted/:filterKey/:direction/:numPerPage/:pageNum')
    .get(protect, getSortedIngredients)

router.route('/get_ingredient/:id')
    .get(protect, getIngredientById)
router.route('/update_ingredient/:id')
    .put(protect, admin, updateIngredient)
router.route('/delete_ingredient/:id')
    .delete(protect, admin, deleteIngredient)


// Temporary route for testing
router.route('/migrate').get(protect, admin, migrateIngredients)
export default router