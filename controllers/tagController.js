import asyncHandler from 'express-async-handler'
import Tag from "../models/tagModel.js";
import MealPlan from "../models/mealplanModel.js";
import Recipe from "../models/recipeModel.js";
import Ingredient from "../models/ingredientModel.js";
import {searchForTagsGeneration} from "./recipeController.js";
import AppError from "../utilis/appError.js";
// ******** READ ********

// @desc    Get all users
// @route   GET /api/users/:page
// @access  Private/Admin
const createTagsArray = asyncHandler(async (req, res, next) => {
    try {
        const [recipe, mealplan, ingredient] = await Promise.all([Recipe.find({}).select('tags'), MealPlan.find({}).select('tags'), Ingredient.find({}).select('tags title'), // Ingredient.find({}).select('title')
        ]);

        let tagsWithIngredientTitle = []
        let ingredientTagsWithType = []

        ingredient.forEach(ingredient => {
            tagsWithIngredientTitle.push({
                tag: ingredient?.title?.toLowerCase(), type: 'ingredient'
            })
            if (ingredient?.tags.length > 0) {
                ingredientTagsWithType.push(ingredient?.tags)
            }
        })

        ingredientTagsWithType = ingredientTagsWithType.flatMap(tags => tags).map(tag => {
            return {
                tag: tag.toLowerCase(), type: 'ingredient'
            }
        })

        const recipeTagsWithType = recipe.flatMap(recipe => recipe.tags).filter(Boolean).map(tag => {
            return {
                tag: tag.toLowerCase(),
                type: 'recipe'
            }
        })

        const mealPlanTagsWithType = mealplan.flatMap(mealplan => mealplan.tags).filter(Boolean).map(tag => {
            return {
                tag: tag.toLowerCase(),
                type: 'mealplan'
            }
        })

        const allTagsArray = [
            ...tagsWithIngredientTitle,
            ...mealPlanTagsWithType,
            ...recipeTagsWithType,
            ...ingredientTagsWithType
        ]

        const uniqueTags = allTagsArray.filter((obj, index, self) => {
            return !self.slice(index + 1).some(otherObj =>
                otherObj.tag === obj.tag && otherObj.type === obj.type
            );
        });

        await Tag.deleteMany({});

        for (const item of uniqueTags) {
            const check = await searchForTagsGeneration(item)
            if (check?.length > 0) {
                await Tag.create(item)
            }
        }

        res.json('Tags Created Successfully')
    } catch (error) {
        next(new AppError('Something went wrong', 400))
    }
})

const getAllTags = asyncHandler(async (req, res) => {
    const tags = await Tag.find({})
    res.json(tags)
})

const getTag = asyncHandler(async (req, res) => {
    const [tag] = await Tag.find({tag: req.params.tag})
    if (!tag) {
        res.json('Tag not found')
    }
    res.json(tag)
})


export {
    getAllTags, getTag, createTagsArray
}