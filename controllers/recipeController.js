import asyncHandler from 'express-async-handler';
import Recipe from '../models/recipeModel.js';
import MealPlan from '../models/mealplanModel.js';
import AppError from '../utilis/appError.js';
import User from '../models/userModel.js';
import recipesData from '../data/Recipes.json' assert {type: 'json'};
import ingredientsList from '../data/IngredientList.json' assert {type: 'json'};
import Rating from '../models/ratingModel.js';
import Ingredient from '../models/ingredientModel.js';
import {
    getIngredientIds,
    getRecipeTitlesFromMealPlans,
    getSortingFilters,
    updateFavoriteOrBookmarkProperty,
} from '../utilis/generalFuntions.js';
import mongoose from 'mongoose';
import redisClient from '../config/redis.js';
import { convertIngredientsToBaseUnit } from "../utilis/ingredientConversion.js";

// ******** CREATE ********

// @desc    Create a new recipe
// @route   POST /api/recipes
// @access  Private
const createNewRecipe = asyncHandler(async (req, res, next) => {
    try {
        const recipe = await Recipe.create(req.body);
        res.status(201).json(recipe);
    } catch (error) {
        next(new AppError(error.message, 400));
    }
});

// ******** READ ********

// @desc    Get all recipes
// @route   GET /api/recipes/:page
// @access  Private/Admin

const getAllRecipes = asyncHandler(async (req, res, next) => {
    let projectionData = {
        metadata: 1,
        data: {
            _id: 1,
            title: 1,
            primary_image: 1,
            average_rating: 1,
            total_ratings: 1,
            prep_time: 1,
            cook_time: 1,
            servings: 1,
            publish_date: 1,
            tags: 1,
            community_note_count: 1,
        },
    };
    const resultsPerPage = 18;
    const page = req.params.pageNum || 0;
    const filter = req.query.filter || 'Date';
    const sortOrder = req.query.sortOrder || 'desc';
    let sort = getSortingFilters(filter, sortOrder);

    const recipes = await Recipe.aggregate([

        {
            $sort: {
                publish_date: -1,
            },
        },
        {
            $lookup: {
                from: 'recipenotes',
                localField: '_id',
                foreignField: 'recipe_id',
                as: 'recipe_notes',
            },
        },
        {
            $addFields: {
                community_note_count: {
                    $size: {
                        $filter: {
                            input: '$recipe_notes',
                            cond: {
                                $eq: ['$$this.note_type', 'community'],
                            },
                        },
                    },
                },
            },
        },
        {
            $facet: {
                metadata: [
                    {
                        $count: 'total',
                    },
                    {
                        $addFields: {
                            page,
                            resultsPerPage,
                        },
                    },
                ],
                data: [
                    {
                        $skip: (page - 1) * resultsPerPage,
                    },
                    {
                        $limit: resultsPerPage,
                    },
                    {
                        $sort: sort,
                    },
                ],
            },
        },
        {
            $unwind: '$metadata',
        },
        {
            $unwind: {
                path: '$data',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: projectionData,
        },
        {
            $group: {
                _id: null,
                metadata: {
                    $first: '$metadata',
                },
                data: {
                    $push: '$data',
                },
            },
        },
        {
            $project: {
                _id: 0,
            },
        },
    ]);
    const pagination = {
        totalCount: recipes[0]?.metadata?.total,
        currentPage: page,
    };
    res.json({ recipes: recipes[0]?.data, pagination });
});

// @desc    Get Featured Recipes
// @route   GET /api/featured_recipes
// @access  Private/User

const getNewlyAddedRecipes = asyncHandler(async (req, res, next) => {
    const key = '__express__new' + req.originalUrl || req.url;
    const isAdmin = req.user.is_admin;
    //   {
    //     $match: isAdmin ? {} : { is_draft: false },
    //   },

    const recipes = await Recipe.aggregate([
        {
            $match: isAdmin ? {} : { is_draft: false },
        },
        {
            $sort: {
                publish_date: -1,
            },
        },
        {
            $limit: 10,
        },
        {
            $project: {
                _id: 1,
                title: 1,
                primary_image: 1,
                average_rating: 1,
                total_ratings: 1,
                cook_time: 1,
                prep_time: 1,
                servings: 1,
                publish_date: 1,
            },
        },
        {
            $lookup: {
                from: 'recipenotes',
                localField: '_id',
                foreignField: 'recipe_id',
                as: 'recipe_notes',
            },
        },
        {
            $addFields: {
                community_note_count: {
                    $size: {
                        $filter: {
                            input: '$recipe_notes',
                            cond: {
                                $eq: ['$$this.note_type', 'community'],
                            },
                        },
                    },
                },
            },
        },
    ]).exec();
    if (recipes.length > 0 && req?.user) {
        const recipesWithFavorites = updateFavoriteOrBookmarkProperty(
            recipes,
            req?.user?.favorite_recipes,
            req?.user?.bookmarked_recipes
        );
        const sortedRecipes = recipesWithFavorites.sort(
            (a, b) => Number(b.publish_date) - Number(a.publish_date)
        );
        await redisClient.set(key, JSON.stringify(sortedRecipes), { EX: 10800 });
        res?.json(sortedRecipes);
    } else {
        res?.json([]);
    }
});
const getFeaturedRecipes = asyncHandler(async (req, res, next) => {
    const key = '__express__featured' + req.originalUrl || req.url;
    const recipes = await MealPlan.aggregate([
        {
            $match: {
                is_admin_plan: true,
            },
        },
        {
            $sort: {
                featured_date: -1, // sort in descending order based on featured_date
            },
        },
        {
            $limit: 1, // select only one record based on the most recent featured_date
        },
        {
            $unwind: {
                path: '$plan_data',
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $unwind: {
                path: '$plan_data.meals',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                default_shopping_list: 1,
                owner: 1,
                is_admin_plan: 1,
                title: 1,
                primary_image: 1,
                plan_data: 1,
                featured_date: 1,
                tags: 1,
                recipe_id: {
                    $toObjectId: '$plan_data.meals.id',
                },
            },
        },
        {
            $lookup: {
                from: 'recipes',
                localField: 'recipe_id',
                foreignField: '_id',
                as: 'recipe',
            },
        },
        {
            $addFields: {
                isRecipeDraft: { $arrayElemAt: ['$recipe.is_draft', 0] }
            }
        },
        {
            $match: {
                isRecipeDraft: false
            }
        },
        {
            $lookup: {
                from: 'recipenotes',
                localField: 'recipe._id',
                foreignField: 'recipe_id',
                as: 'recipe_notes',
            },
        },
        {
            $addFields: {
                community_note_count: {
                    $size: {
                        $filter: {
                            input: '$recipe_notes',
                            cond: {
                                $eq: ['$$this.note_type', 'community'],
                            },
                        },
                    },
                },
            },
        },
        {
            $unwind: {
                path: '$recipe',
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $project: {
                _id: 1,
                title: 1,
                community_note_count: 1,
                recipe: {
                    _id: 1,
                    title: 1,
                    primary_image: 1,
                    average_rating: 1,
                    total_ratings: 1,
                    cook_time: 1,
                    prep_time: 1,
                    servings: 1,
                    publish_date: 1,
                    community_note_count: '$community_note_count',
                },
            },
        },
        {
            $group: {
                _id: '$_id',
                title: {
                    $first: '$title',
                },
                recipes: {
                    $addToSet: '$recipe',
                },
            },
        },
        {
            $project: {
                _id: 1,
                title: 1,
                recipes: 1,
            },
        },
    ]);
    if (recipes.length > 0 && req?.user) {
        const recipesWithFavorites = updateFavoriteOrBookmarkProperty(
            recipes[0]?.recipes,
            req?.user?.favorite_recipes,
            req?.user?.bookmarked_recipes
        );
        const sortedRecipes = recipesWithFavorites.sort(
            (a, b) => Number(b.publish_date) - Number(a.publish_date)
        );
        await redisClient.set(
            key,
            JSON.stringify({
                _id: recipes[0]._id,
                title: recipes[0].title,
                recipes: sortedRecipes,
            }),
            { EX: 10800 }
        );
        res.json({
            _id: recipes[0]._id,
            title: recipes[0].title,
            recipes: sortedRecipes,
        });
    } else {
        res.json([]);
    }
});
// @desc    Get sorted recipes
// @route   GET /api/recipes/sorted/:filterKey/:direction/:numPerPage/:pageNum
// @access  Private/Admin
const getSortedRecipes = asyncHandler(async (req, res, next) => {
    try {
        let {
            page = 0,
            filterKey = 'created_at',
            direction = 'desc',
            numPerPage = 25,
        } = req?.params;
        page = Number(page);
        numPerPage = Number(numPerPage);
        const searchTags = req?.body.searchTags || [];
        const filter = req?.query.filter || 'Date';
        const isAdmin = req.user.is_admin;
        const sortOrder = direction || 'desc';
        // let sort = getSortingFilters(filter, sortOrder);
        // const sortQuery = {[filterKey]: direction}; // ex: { title: "asc" }
        const sortQuery = getSortingFilters(filter, sortOrder);
        let recipeTitlesFromMealPlans = [];
        let ingredientIds = [];
        let tags = [];
        let tagWithModifySearchTagsTrue = [];
        let modifySearchTags = false;
        if (searchTags.length > 0) {
            for (let i = 0; i < searchTags.length; i++) {
                switch (searchTags[i].type) {
                    case 'recipe':
                        tags.push({ $regex: searchTags[i].tag, $options: 'i' });
                        break;
                    case 'mealplan':
                        const mealPlans = await MealPlan.find({
                            tags: {
                                $regex: searchTags[i].tag,
                                $options: 'i',
                            },
                        })
                            .select('plan_data')
                            .exec();
                        recipeTitlesFromMealPlans.push(
                            getRecipeTitlesFromMealPlans(mealPlans)
                        );
                        recipeTitlesFromMealPlans = recipeTitlesFromMealPlans
                            .flat()
                            .filter(Boolean);
                        break;
                    case 'ingredient':
                        // This Request can be moved outside of the loop to reduce the number of requests
                        let ingredients = await Ingredient.find({
                            title: searchTags[i].tag,
                        })
                            .select('_id')
                            .exec();
                        if (ingredients.length > 0) {
                            ingredientIds.push(getIngredientIds(ingredients));
                            ingredientIds = ingredientIds
                                .flat()
                                .map((item) => String(item))
                                .filter((value, index, array) => array.indexOf(value) === index)
                                .map((item) => mongoose.Types.ObjectId(item));
                        } else {
                            modifySearchTags = true;
                            tagWithModifySearchTagsTrue.push(searchTags[i].tag);
                        }
                        break;
                    default:
                        tags.push({ $regex: searchTags[i].tag, $options: 'i' });
                }
            }
        }
        tags = tags
            .filter((obj, index, self) => {
                return !self
                    .slice(index + 1)
                    .some(
                        (otherObj) =>
                            otherObj.$regex === obj.$regex &&
                            otherObj.$options === obj.$options
                    );
            })
            .map((tag) => tag.$regex);

        const aggregateQuery = [

            {
                $set: {
                    ingredients: {
                        $concatArrays: [
                            '$vegetarian_ingredients.id',
                            '$dairy_free_ingredients.id',
                            '$omnivore_ingredients.id',
                            '$vegan_ingredients.id',
                        ],
                    },
                },
            },
            {
                $match: {
                    $and: [],
                },
            },
            {
                $match: isAdmin ? {} : { is_draft: false },
            },
            {
                $lookup: {
                    from: 'recipenotes',
                    localField: '_id',
                    foreignField: 'recipe_id',
                    as: 'recipe_notes',
                },
            },
            {
                $addFields: {
                    community_note_count: {
                        $size: {
                            $filter: {
                                input: '$recipe_notes',
                                cond: {
                                    $eq: ['$$this.note_type', 'community'],
                                },
                            },
                        },
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    primary_image: 1,
                    average_rating: 1,
                    total_ratings: 1,
                    cook_time: 1,
                    is_draft: 1,
                    prep_time: 1,
                    servings: 1,
                    publish_date: 1,
                    community_note_count: 1,
                    tags: 1,
                },
            },
            {
                $addFields: {
                    containsInTitle: {
                        $cond: [
                            {
                                $regexMatch: {
                                    input: '$title',
                                    regex: `(?i)\\b${tags[0]}?\\b`,
                                },
                            },
                            1,
                            0,
                        ],
                    },
                    containsInTags: {
                        $cond: [
                            {
                                $gt: [
                                    {
                                        $size: {
                                            $filter: {
                                                input: '$tags',
                                                as: 'tag',
                                                cond: {
                                                    $regexMatch: {
                                                        input: '$$tag',
                                                        regex: `(?i)\\b${tags[0]}?\\b`,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    0,
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
            },
            {
                $sort: {
                    containsInTitle: -1,
                    containsInTags: -1,
                    title: 1, // Sort alphabetically if neither condition is met
                },
            },
            {
                $facet: {
                    metadata: [
                        {
                            $count: 'total',
                        },
                        {
                            $addFields: {
                                page,
                                resultsPerPage: numPerPage,
                            },
                        },
                    ],
                    data: [
                        {
                            $skip: (page - 1) * numPerPage,
                        },
                        {
                            $limit: numPerPage,
                        },
                        {
                            $sort: {
                                ...sortQuery,
                            },
                        },
                    ],
                },
            },
            {
                $unwind: {
                    path: '$metadata',
                },
            },
            {
                $unwind: {
                    path: '$data',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $group: {
                    _id: null,
                    metadata: {
                        $first: '$metadata',
                    },
                    data: {
                        $push: '$data',
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                },
            },
        ];
        if (modifySearchTags) {
            let tagsQuery = tagWithModifySearchTagsTrue
                .map((tag) => {
                    return [{ title: { $regex: tag, $options: 'i' } }];
                })
                .flat(1);
            aggregateQuery[1].$match.$and.push({
                $or: tagsQuery,
            });
        }
        if (tags.length > 0) {
            tags.forEach((tag) => {
                const matchQuery = {
                    $or: [
                        { tags: { $regex: `\\b${tag}\\b`, $options: 'i' } },
                        { title: { $regex: `\\b${tag}\\b`, $options: 'i' } },
                        // { description: { $regex: `\\b${tag}\\b`, $options: 'i' } },
                    ]
                };
                aggregateQuery[1].$match.$and.push(matchQuery);
            });
        }
        if (ingredientIds.length > 0) {
            aggregateQuery[1].$match.$and.push({
                ingredients: {
                    $all: ingredientIds,
                },
            });
        }
        if (recipeTitlesFromMealPlans.length > 0) {
            aggregateQuery[1].$match.$and.push({
                title: { $in: recipeTitlesFromMealPlans },
            });
        }
        const recipes = await Recipe.aggregate(aggregateQuery).exec();
        if (recipes.length > 0) {
            const pagination = {
                totalCount: recipes[0]?.metadata?.total,
                currentPage: page,
            };
            res.json({ recipes: recipes[0]?.data, pagination });
            // res.json(aggregateQuery)
        } else {
            res.json({ recipes: [], pagination: {} });
        }
    } catch (error) {
        next(new AppError(error.message, 400));
    }
});

const searchForTagsGeneration = async ({ tag, type }) => {
    let query = {};
    switch (type) {
        case 'recipe':
            query = { tags: { $regex: tag, $options: 'i' } };
            break;
        case 'mealplan':
            const mealPlans = await MealPlan.find({
                tags: {
                    $regex: tag,
                    $options: 'i',
                },
            })
                .select('plan_data')
                .exec();
            const recipeTitlesFromMealPlans = Array.from(
                new Set(
                    mealPlans
                        .flatMap((plan) => plan.plan_data)
                        .flatMap((item) => item.get('meals'))
                        .map((item) => item.title)
                )
            );
            query = { title: { $in: recipeTitlesFromMealPlans } };
            break;
        case 'ingredient':
            const ingredients = await Ingredient.find({
                $or: [
                    { title: { $regex: tag, $options: 'i' } },
                    { tags: { $regex: tag, $options: 'i' } },
                ],
            })
                .select('_id')
                .exec();

            const ingredientIds = ingredients.map((ingredient) => ingredient._id);
            query = {
                $or: [
                    { 'dairy_free_ingredients.id': { $in: ingredientIds } },
                    { 'omnivore_ingredients.id': { $in: ingredientIds } },
                    { 'vegetarian_ingredients.id': { $in: ingredientIds } },
                    { 'vegan_ingredients.id': { $in: ingredientIds } },
                ],
            };
            break;
    }

    return Recipe.find(query).select(
        '_id title primary_image average_rating total_ratings cook_time prep_time servings'
    );
};

// @desc    Get recipe by ID
// @route   GET /api/recipes/get_recipe/:id
// @access  Private
const getRecipeById = asyncHandler(async (req, res, next) => {
    const userId = req?.query?.userId;
    const user = await User.findById(userId);
    const userDiet = req.query.diet || 'omnivore';
    const isAdmin = user.is_admin;
    const query = !isAdmin ? { _id: req.params.id, is_draft: false } : { _id: req.params.id };
    const userUnitPreference = user?.unit_preference?.toLowerCase() || 'imperial';
    const populateQuery = {
        populate: {
            path: 'id',
            model: 'Ingredient',
            select: { title: 1 },
        },
    };
    const selectedData = {
        _id: 1,
        title: 1,
        is_reviewed: 1,
        is_draft: 1,
        is_public: 1,
        publish_date: 1,
        primary_image: 1,
        description: 1,
        average_rating: 1,
        total_ratings: 1,
        prep_time: 1,
        cook_time: 1,
        servings: 1,
        tags: 1,
    };
    const selectedInstructions = `${userDiet}_instructions`;
    const selectedIngredients = `${userDiet}_ingredients`;
    let data = await Recipe.findOne(query, {
        ...selectedData,
        [selectedInstructions]: 1,
        [selectedIngredients]: 1,
    }).populate([{ path: `${selectedIngredients}`, ...populateQuery }]);
    if (!data) {
        return next(new AppError('No document found with that ID', 404));
    }
    const recipe = JSON.parse(JSON.stringify(data));
    recipe['default_instructions'] = recipe[selectedInstructions];
    recipe['default_ingredients'] = recipe[selectedIngredients];
    if (userUnitPreference === 'metric') {
        recipe['default_ingredients'] = await convertIngredientsToBaseUnit(recipe['default_ingredients'])
    }
    delete recipe[selectedInstructions];
    delete recipe[selectedIngredients];
    res.json(recipe);
});

const getRecipeComDetailsById = asyncHandler(async (req, res, next) => {
    const isAdmin = req.user.is_admin;
    const query = !isAdmin ? { _id: req.params.id, is_draft: false } : { _id: req.params.id };
    const populateQuery = {
        populate: {
            path: 'id',
            model: 'Ingredient',
            select: { title: 1 },
        },
    };

    let data = await Recipe.findOne(query).populate([
        { path: 'omnivore_ingredients', ...populateQuery },
        { path: 'vegetarian_ingredients', ...populateQuery },
        { path: 'vegan_ingredients', ...populateQuery },
        { path: 'dairy_free_ingredients', ...populateQuery },
    ]);

    if (!data) {
        return next(new AppError('No document found with that ID', 404));
    }
    res.json(data);
});

// @desc    Get recipe particular Instructions and Ingredients
// @route   GET /api/recipes/get_recipe/:id
// @access  Private
const getRecipeParticularDetails = asyncHandler(async (req, res, next) => {
    const userDiet = req.query.diet || 'omnivore';
    const isAdmin = req.user.is_admin;
    const query = !isAdmin ? { _id: req.params.id, is_draft: false } : { _id: req.params.id };
    const userUnitPreference =
        req.query?.unit_preference?.toLowerCase() || 'imperial';
    const populateQuery = {
        populate: {
            path: 'id',
            model: 'Ingredient',
            select: { title: 1 },
        },
    };
    const selectedData = {
        _id: 1,
        title: 1,
        is_reviewed: 1,
        is_draft: 1,
        is_public: 1,
        publish_date: 1,
        primary_image: 1,
        description: 1,
        average_rating: 1,
        total_ratings: 1,
        prep_time: 1,
        cook_time: 1,
        servings: 1,
        tags: 1,
    };
    const selectedInstructions = `${userDiet}_instructions`;
    const selectedIngredients = `${userDiet}_ingredients`;
    let data = await Recipe.findOne(query, {
        ...selectedData,
        [selectedInstructions]: 1,
        [selectedIngredients]: 1,
    }).populate([{ path: `${selectedIngredients}`, ...populateQuery }]);
    if (!data) {
        return next(new AppError('No document found with that ID', 404));
    }
    const recipe = JSON.parse(JSON.stringify(data));
    recipe['default_instructions'] = recipe[selectedInstructions];
    recipe['default_ingredients'] = recipe[selectedIngredients];
    if (userUnitPreference === 'metric') {
        recipe['default_ingredients'] = await convertIngredientsToBaseUnit(recipe['default_ingredients'])
    }
    delete recipe[selectedInstructions];
    delete recipe[selectedIngredients];
    res.json(recipe);
});

// ******** UPDATE ********

// @desc    Update recipe recipe
// @route   PUT /api/recipes/update_recipe/:id
// @access  Private
const updateRecipe = asyncHandler(async (req, res, next) => {
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    // If we don't find the recipe, throw an error.
    if (!recipe) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json(recipe);
});

const getUserFavorites = asyncHandler(async (req, res, next) => {
    const user = req?.user;
    const userFavorites = user?.favorite_recipes;

    const resultsPerPage = 9;
    const page = req.params.pageNum || 0;

    const filter = req?.query.filter || 'Date';
    // const sortQuery = {[filterKey]: direction}; // ex: { title: "asc" }
    const sortOrder = req.query.sortOrder || 'desc';
    let sortQuery = getSortingFilters(filter, sortOrder);
    // const sortQuery = getSortingFilters(filter);
    const isAdmin = req.user.is_admin;

    if (user) {
        const recipes = await Recipe.aggregate([
            {
                $match: isAdmin ? {} : { is_draft: false },
            },
            { $match: { _id: { $in: userFavorites } } },
            {
                $project: {
                    _id: 1,
                    publish_date: 1,
                    title: 1,
                    primary_image: 1,
                    average_rating: 1,
                    total_ratings: 1,
                    cook_time: 1,
                    prep_time: 1,
                    servings: 1,
                },
            },
            { $sort: sortQuery },
            {
                $facet: {
                    metadata: [
                        { $count: 'total' },
                        { $addFields: { page, resultsPerPage } },
                    ],
                    data: [
                        { $skip: (page - 1) * resultsPerPage },
                        { $limit: resultsPerPage },
                    ],
                },
            },
        ]);

        const recipesWithFavorites = updateFavoriteOrBookmarkProperty(
            recipes[0].data,
            req.user.favorite_recipes,
            req.user.bookmarked_recipes
        );

        const pagination = {
            totalCount: recipes[0]?.metadata[0]?.total,
            currentPage: page,
        };

        res.status(200).json({
            recipes: recipesWithFavorites,
            pagination,
        });
    } else {
        return next(new AppError("User doesn't exists", 404));
    }
});

const getUserBookmarks = asyncHandler(async (req, res, next) => {
    const user = req?.user;
    const userBookmarks = user?.bookmarked_recipes;

    const resultsPerPage = 9;
    const page = req.params.pageNum || 0;

    const filter = req?.query.filter || 'Date';
    const sortOrder = req.query.sortOrder || 'desc';
    let sortQuery = getSortingFilters(filter, sortOrder);
    // const sortQuery = {[filterKey]: direction}; // ex: { title: "asc" }
    // const sortQuery = getSortingFilters(filter);
    const isAdmin = req.user.is_admin;

    if (user) {
        const recipes = await Recipe.aggregate([
            {
                $match: isAdmin ? {} : { is_draft: false },
            },
            { $match: { _id: { $in: userBookmarks } } },
            {
                $project: {
                    _id: 1,
                    publish_date: 1,
                    title: 1,
                    primary_image: 1,
                    average_rating: 1,
                    total_ratings: 1,
                    cook_time: 1,
                    prep_time: 1,
                    servings: 1,
                },
            },
            { $sort: sortQuery },
            {
                $facet: {
                    metadata: [
                        { $count: 'total' },
                        { $addFields: { page, resultsPerPage } },
                    ],
                    data: [
                        { $skip: (page - 1) * resultsPerPage },
                        { $limit: resultsPerPage },
                    ],
                },
            },
        ]);

        const recipesWithBookmarks = updateFavoriteOrBookmarkProperty(
            recipes[0].data,
            req.user.favorite_recipes,
            req.user.bookmarked_recipes
        );

        const pagination = {
            totalCount: recipes[0]?.metadata[0]?.total,
            currentPage: page,
        };
        // If we don't find the recipe, throw an error.

        res.status(200).json({ recipes: recipesWithBookmarks, pagination });
    } else {
        return next(new AppError("User doesn't exists", 404));
    }
});

const getUserFavoritesAndBookmarks = asyncHandler(async (req, res, next) => {
    const user = req?.user;
    const userFavorites = user?.favorite_recipes;
    const userBookmarks = user?.bookmarked_recipes;

    const resultsPerPage = 9;
    const page = req.params.pageNum || 0;

    const filter = req?.query.filter || 'Date';
    // const sortQuery = {[filterKey]: direction}; // ex: { title: "asc" }
    const sortOrder = req.query.sortOrder || 'desc';
    let sortQuery = getSortingFilters(filter, sortOrder);
    // const sortQuery = getSortingFilters(filter);
    const isAdmin = req.user.is_admin;
    if (user) {
        const recipes = await Recipe.aggregate([
            {
                $match: isAdmin ? {} : { is_draft: false },
            },
            {
                $match: {
                    $or: [
                        { _id: { $in: userFavorites } },
                        { _id: { $in: userBookmarks } },
                    ],
                },
            },
            {
                $project: {
                    _id: 1,
                    publish_date: 1,
                    title: 1,
                    primary_image: 1,
                    average_rating: 1,
                    total_ratings: 1,
                    cook_time: 1,
                    prep_time: 1,
                    servings: 1,
                },
            },
            { $sort: sortQuery },
            {
                $facet: {
                    metadata: [
                        { $count: 'total' },
                        { $addFields: { page, resultsPerPage } },
                    ],
                    data: [
                        { $skip: (page - 1) * resultsPerPage },
                        { $limit: resultsPerPage },
                    ],
                },
            },
        ]);

        const recipesWithBookmarks = updateFavoriteOrBookmarkProperty(
            recipes[0].data,
            req.user.favorite_recipes,
            req.user.bookmarked_recipes
        );

        const pagination = {
            totalCount: recipes[0]?.metadata[0]?.total,
            currentPage: page,
        };
        // If we don't find the recipe, throw an error.

        res.status(200).json({ recipes: recipesWithBookmarks, pagination });
    } else {
        return next(new AppError("User doesn't exists", 404));
    }
});

// ******** DELETE ********

// @desc    Delete recipe
// @route   DELETE /api/recipes/:id
// @access  Private
const deleteRecipe = asyncHandler(async (req, res, next) => {
    const recipe = await Recipe.findByIdAndDelete(req.params.id);

    if (!recipe) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
        status: 'success',
        data: null,
    });
});

// Temporary route for testing
const migrateRecipes = asyncHandler(async (req, res, next) => {
    //get all the ingredients from the database which is live
    const allIngredients = await Ingredient.find({});
    //get all the recipie data from the recipie data
    const newRecipe = recipesData.map((item) => {
        const tagsArray = item.tags?.split(',').map((tag) => tag.trim());
        const obj = {
            id: item.id,
            title: item.title,
            is_reviewed: item.reviewed,
            is_draft: item.isDraft,
            is_public: item.isPublic,
            publish_date: item.publishedDate,
            primary_image: item.primaryImage,
            description: item.description || 'No description available',
            average_rating: 4.5,
            total_ratings: 10,
            dairy_free_instructions: item.dairyFreeInstructions,
            omnivore_instructions: item.omnivoreInstructions,
            vegan_instructions: item.veganInstructions,
            vegetarian_instructions: item.vegetarianInstructions,
            dairy_free_ingredients: [],
            omnivore_ingredients: [],
            vegan_ingredients: [],
            vegetarian_ingredients: [],
            prep_time: item.prepTime,
            cook_time: item.cookTime || 15,
            servings: item.servings || 1,
            tags: tagsArray,
        };

        ingredientsList.forEach((ingredient) => {
            if (ingredient.RecipeId === item.id) {
                switch (ingredient.diet) {
                    case 'dairyFree':
                        const dairyFreeIngredient = ingredient.data.map((item) => {
                            const ingredientData = allIngredients.find(
                                (ingredient) => ingredient.old_id === item.id
                            );
                            item.id = ingredientData?._id;
                            return item;
                        });
                        obj.dairy_free_ingredients = dairyFreeIngredient;
                        break;
                    case 'omnivore':
                        const omnivoreIngredient = ingredient.data.map((item) => {
                            const ingredientData = allIngredients.find(
                                (ingredient) => ingredient.old_id === item.id
                            );
                            item.id = ingredientData?._id;
                            return item;
                        });
                        obj.omnivore_ingredients = omnivoreIngredient;
                        break;
                    case 'vegan':
                        const veganIngredient = ingredient.data.map((item) => {
                            const ingredientData = allIngredients.find(
                                (ingredient) => ingredient.old_id === item.id
                            );
                            item.id = ingredientData?._id;
                            return item;
                        });
                        obj.vegan_ingredients = veganIngredient;
                        break;
                    case 'vegetarian':
                        const vegetarianIngredient = ingredient.data.map((item) => {
                            const ingredientData = allIngredients.find(
                                (ingredient) => ingredient.old_id === item.id
                            );
                            item.id = ingredientData?._id;
                            return item;
                        });
                        obj.vegetarian_ingredients = vegetarianIngredient;
                        break;
                }
            }
        });

        return obj;
    });
    await Recipe.deleteMany({});
    await Recipe.insertMany(newRecipe);
    res.status(201).json('Recipes migrated successfully');
});

const recipesRatings = async (req, res) => {
    const recipes = await Recipe.find({});
    for (const recipe of recipes) {
        const ratings = await Rating.find({
            recipe: recipe._id,
        });
        let ratingSum = 0;
        const totalRating = ratings.length;
        if (totalRating) {
            for (const rating of ratings) {
                ratingSum += rating.score;
            }
            recipe.total_ratings = totalRating;
            recipe.average_rating = ratingSum / totalRating;
        } else {
            recipe.total_ratings = 0;
            recipe.average_rating = 4.5;
        }
        await recipe.save();
    }
    // Save the updated recipe
    res.status(200).json({
        message: 'recipe ratings updated',
    });
};

const getRecipeByEmptyIngredients = asyncHandler(async (req, res, next) => {
    const recipes = await Recipe.find({
        $or: [
            { dairy_free_ingredients: { $size: 0 } },
            { omnivore_ingredients: { $size: 0 } },
            { vegan_ingredients: { $size: 0 } },
            { vegetarian_ingredients: { $size: 0 } },
        ],
    });
    const requiredData = recipes.map((recipe) => {
        return {
            _id: recipe._id,
            id: recipe.id,
        };
    });
    res.status(200).json({
        message: ' recipe empty ingredients',
        length: requiredData.length,
        data: requiredData,
    });
});
const getRecipeByEmptyInstructions = asyncHandler(async (req, res, next) => {
    const recipes = await Recipe.find({
        $or: [
            { omnivore_instructions: null },
            { dairy_free_instructions: null },
            { vegan_instructions: null },
            { dairy_free_instructions: null },
        ],
    });
    const requiredData = recipes.map((recipe) => {
        return {
            _id: recipe._id,
            id: recipe.id,
        };
    });
    res.status(200).json({
        message: ' recipe empty instructions',
        length: requiredData.length,
        data: requiredData,
        recipes: recipes,
    });
});

export {
    createNewRecipe,
    getRecipeById,
    getRecipeParticularDetails,
    getAllRecipes,
    getFeaturedRecipes,
    getSortedRecipes,
    getNewlyAddedRecipes,
    searchForTagsGeneration,
    getRecipeComDetailsById,
    getUserFavoritesAndBookmarks,
    updateRecipe,
    getUserFavorites,
    getUserBookmarks,
    deleteRecipe,
    migrateRecipes,
    recipesRatings,
    getRecipeByEmptyIngredients,
    getRecipeByEmptyInstructions,
};
