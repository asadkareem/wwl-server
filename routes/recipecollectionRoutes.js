import express from "express";

const router = express.Router();
import {
  createNewRecipeCollection,
  getAllRecipeCollections,
  getAllRecipesFromCollection,
  deleteRecipeCollection,
  getRecipeCollectionById,
  updateRecipeCollection,
  getSortedRecipeCollections,
} from "../controllers/recipecollectionController.js";
import { admin, protect } from "../middleware/authMiddleware.js";
import { redisCache } from "../controllers/redisController.js";

router.route("/").post(protect, admin, createNewRecipeCollection);

router.route("/all/:pageNum").get(protect, getAllRecipeCollections);

router.route('/recipes/:pageNum')
    .get(protect, redisCache, getAllRecipesFromCollection)

router
  .route("/sorted/:filterKey/:direction/:numPerPage/:pageNum")
  .get(protect, getSortedRecipeCollections);

router.route("/get_recipecollection/:id").get(protect, getRecipeCollectionById);
router
  .route("/update_recipecollection/:id")
  .put(protect, admin, updateRecipeCollection);
router
  .route("/delete_recipecollection/:id")
  .delete(protect, admin, deleteRecipeCollection);

export default router;
