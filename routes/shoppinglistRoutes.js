import express from 'express'

const router = express.Router()
import {
    createNewShoppingList,
    deleteShoppingList,
    getMealPlanShoppingList,
    deleteShoppingListOnReset,
    getUserShoppingList,
    updateShoppingList,
} from '../controllers/shoppinglistController.js'
import { protect } from '../middleware/authMiddleware.js'

router.route('/')
    .post(createNewShoppingList)
router.route('/get_mealplan_shoppinglist/:id')
    .get(deleteShoppingListOnReset, getMealPlanShoppingList)
router.route('/user/:ownerId/:mealPlanId')
    .get(getUserShoppingList)
router.route('/update_shoppinglist/:id')
    .put(updateShoppingList)
router.route('/delete_shoppinglist/:id')
    .delete(deleteShoppingList)

export default router