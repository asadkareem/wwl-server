import express from 'express'

const router = express.Router()
import {
    createNewRecipe,
    getAllRecipes,
    deleteRecipe,
    getRecipeById,
    getRecipeParticularDetails,
    updateRecipe,
    getSortedRecipes,
    getUserFavorites,
    getUserBookmarks,
    getFeaturedRecipes,
    migrateRecipes,
    getNewlyAddedRecipes,
    recipesRatings,
    getUserFavoritesAndBookmarks, getRecipeComDetailsById
} from '../controllers/recipeController.js'
import { admin, protect } from '../middleware/authMiddleware.js'
import { redisCache } from "../controllers/redisController.js";
import { convertIngredientsToBaseUnit } from "../utilis/ingredientConversion.js";

router.route('/')
    .post(createNewRecipe)
router.route("/newRecipesRatings").get(recipesRatings);
router.route('/all/:pageNum')
    .get(getAllRecipes)

router.route('/featured_recipes')
    .get(getFeaturedRecipes)

router.route('/new_recipes')
    .get(getNewlyAddedRecipes)

router.route('/getUserFavAndBookmarkedRecipes/:pageNum')
    .get(getUserFavoritesAndBookmarks)

router.route('/sorted/:filterKey/:direction/:numPerPage/:page')
    .post(getSortedRecipes)

router.route("/get_recipe/:id").get(getRecipeById);

router.route('/get_recipe_all_details/:id')
    .get(getRecipeComDetailsById)

router.route('/get_recipe_details/:id')
    .get(getRecipeParticularDetails)

router.route('/get_featured_recipes/:id')
    .get(getRecipeParticularDetails)


router.route('/update_recipe/:id')
    .put(updateRecipe)
router.route('/favorites/:pageNum')
    .get(getUserFavorites)
router.route('/bookmarked/:pageNum')
    .get(getUserBookmarks)
router.route('/delete_recipe/:id')
    .delete(deleteRecipe)

// TODO: Remove this route
router.route('/convert')
    .get(convertIngredientsToBaseUnit)

// Temporary route for testing
router.route('/migrate').get(migrateRecipes)
export default router