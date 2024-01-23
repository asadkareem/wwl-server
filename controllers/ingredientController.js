import asyncHandler from 'express-async-handler'
import Ingredient, {IngredientSchema} from '../models/ingredientModel.js'
import AppError from "../utilis/appError.js";
import ingredientsData from "../data/Ingredients.json" assert {type: "json"};

// ******** CREATE ********
// @desc    Create a new ingredient
// @route   POST /api/ingredients
// @access  Private
const createNewIngredient = asyncHandler(async (req, res, next) => {
    try {
        const ingredient = await Ingredient.create(req.body)
        res.status(201).json(ingredient)
    } catch (error) {
        next(new AppError(error.message, 400))
    }
})

// ******** READ ********

// @desc    Get all ingredients
// @route   GET /api/ingredients/:page
// @access  Private/Admin
const getAllIngredients = asyncHandler(async (req, res, next) => {
    const resultsPerPage = 10;
    const page = req.params.pageNum || 0;

    const ingredients = await Ingredient.aggregate([
        {$sort: {created_at: -1}},
        {
            $facet: {
                metadata: [{$count: "total"}, {$addFields: {page, resultsPerPage}}],
                data: [{$skip: (page - 1) * resultsPerPage}, {$limit: resultsPerPage}],
            },
        },
    ])

    const pagination = {
        totalCount: ingredients[0]?.metadata[0].total,
        currentPage: page
    }


    res.json({ingredients: ingredients[0]?.data, pagination});
})


// @desc    Get sorted ingredients
// @route   GET /api/ingredients/sorted/:filterKey/:direction/:numPerPage/:pageNum
// @access  Private/Admin
const getSortedIngredients = asyncHandler(async (req, res, next) => {
    const page = req.params.pageNum || 0;
    const filterKey = req.params.filterKey || "created_at";
    const direction = req.params.direction || "asc";
    const resultsPerPage = req.params.numPerPage || 25;

    const filterQuery = {
        [filterKey]: direction === 'asc' ? 1 : -1
    }

    const ingredients = await Ingredient.aggregate([
        {$sort: filterQuery},
        {
            $facet: {
                metadata: [{$count: "total"}, {$addFields: {page, resultsPerPage}}],
                data: [{$skip: (page - 1) * resultsPerPage}, {$limit: resultsPerPage}],
            },
        },
    ])

    const pagination = {
        totalCount: ingredients[0]?.metadata[0].total,
        currentPage: page
    }

    res.json({ingredients: ingredients[0]?.data, pagination});
})


// @desc    Get ingredient by ID
// @route   GET /api/ingredients/get_ingredient/:id
// @access  Private
const getIngredientById = asyncHandler(async (req, res, next) => {
    const ingredient = await Ingredient.findById(req.params.id)

    if (!ingredient) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.json(ingredient)
})

// ******** UPDATE ********

// @desc    Update ingredient ingredient
// @route   PUT /api/ingredients/update_ingredient/:id
// @access  Private
const updateIngredient = asyncHandler(async (req, res, next) => {
    const ingredient = await Ingredient.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    })

    // If we don't find the ingredient, throw an error.
    if (!ingredient) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json(ingredient)
})

// ******** DELETE ********

// @desc    Delete ingredient
// @route   DELETE /api/ingredients/:id
// @access  Private
const deleteIngredient = asyncHandler(async (req, res, next) => {
    const ingredient = await Ingredient.findByIdAndDelete(req.params.id)

    if (!ingredient) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
        status: 'success',
        data: null,
    });
})

// Migrattion
const migrateIngredients = asyncHandler(async (req, res, next) => {
    const newIngredients = ingredientsData.map(item => {
        const obj = {
            title: item.title,
            old_id: item.id,
            category: item.category,
            measurement_type: item.category === 'produce' ? 'count' : 'weight',
            imperial_base_qty: item.category === 'produce' ? 1 : 8,
            imperial_base_unit: item.category === 'produce' ? 'item(s)' : 'ounce(s)',
            imperial_shopping_qty: item.category === 'produce' ? 1 : 8,
            imperial_shopping_unit: item.category === 'produce' ? 'item(s)' : 'ounce(s)',
            metric_base_qty: item.category === 'produce' ? 1 : 227,
            metric_base_unit: item.category === 'produce' ? 'item(s)' : 'gram(s)',
            metric_shopping_qty: item.category === 'produce' ? 1 : 227,
            metric_shopping_unit: item.category === 'produce' ? 'item(s)' : 'gram(s)',
            tags: [],
        }

        return obj
    })
    await Ingredient.deleteMany({})
    await Ingredient.insertMany(newIngredients)
    res.status(201).json('Ingredients migrated')
})


export {
    createNewIngredient,
    getIngredientById,
    getAllIngredients,
    getSortedIngredients,
    updateIngredient,
    deleteIngredient,
    migrateIngredients
}