import express from 'express'

const router = express.Router()
import {
    createNewMealPlan,
    getAllMealPlans,
    getUserMealPlans,
    deleteMealPlan,
    getMealPlanById,
    updateMealPlan,
    getSortedMealPlans,
    migratePlans
} from '../controllers/mealplanController.js'
import {admin} from '../middleware/authMiddleware.js'
import {protect} from '../middleware/authMiddleware.js'
import {createNewShoppingList} from "../controllers/shoppinglistController.js";

router.route('/')
    .post(protect, createNewMealPlan, createNewShoppingList)

router.route('/all/:pageNum')
    .get(protect, getAllMealPlans)

router.route('/sorted/:filterKey/:direction/:numPerPage/:pageNum')
    .get(protect, getSortedMealPlans)

router.route('/get_mealplan/:id')
    .get(protect, getMealPlanById)
router.route('/user/:pageNum')
    .get(protect, getUserMealPlans)
router.route('/update_mealplan/:id')
    .put(protect, updateMealPlan)
router.route('/delete_mealplan/:id')
    .delete(protect, deleteMealPlan)

// Temporary route for testing
router.route('/migrate').get(protect, admin, migratePlans)

export default router