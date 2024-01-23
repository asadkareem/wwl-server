import asyncHandler from 'express-async-handler'
import MealPlan from '../models/mealplanModel.js'
import AppError from "../utilis/appError.js";
import mealPlansData from "../data/mealPlans.json" assert {type: "json"};
import Recipe from "../models/recipeModel.js";
import { mongo } from "mongoose";
import User from "../models/userModel.js";

// ******** CREATE ********

// @desc    Create a new mealplan
// @route   POST /api/mealplans
// @access  Private
const createNewMealPlan = asyncHandler(async (req, res, next) => {
    try {
        const mealplan = await MealPlan.create(req.body)
        res.status(201).json(mealplan)
    } catch (error) {
        next(new AppError(error.message, 400))
    }
})

// ******** READ ********

// @desc    Get all mealplans
// @route   GET /api/mealplans/:page
// @access  Private/Admin

const getAllMealPlans = asyncHandler(async (req, res, next) => {
    const resultsPerPage = 10;
    const page = req.params.pageNum || 0;
    const isAdmin = req.user.is_admin;
    const mealplans = await MealPlan.aggregate([
        {
            $match: {
                is_admin_plan: true,
            },
        },
        {
            $unwind: {
                path: "$plan_data",
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $unwind: {
                path: "$plan_data.meals",
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $unwind: {
                path: "$owner",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                _id: 1,
                owner: {
                    _id: 1,
                    name: 1,
                },
                primary_image: 1,
                tags: 1,
                default_shopping_list: 1,
                is_admin_plan: 1,
                title: 1,
                plan_data: {
                    meals: {
                        id: 1,
                        title: 1,
                    },
                },
                featured_date: 1,
            },
        },
        {
            $group: {
                _id: "$_id",
                primary_image: {
                    $first: "$primary_image",
                },
                owner: {
                    $first: "$owner",
                },
                tags: {
                    $first: "$tags",
                },
                default_shopping_list: {
                    $first: "$default_shopping_list",
                },
                is_admin_plan: {
                    $first: "$is_admin_plan",
                },
                title: {
                    $first: "$title",
                },
                recipes: {
                    $addToSet: {
                        title: "$plan_data.meals.title",
                        id: "$plan_data.meals.id",
                    },
                },
                featured_date: {
                    $first: "$featured_date",
                },
            },
        },
        {
            $sort: {
                featured_date: -1,
            },
        },

        {
            $facet: {
                metadata: [
                    {
                        $count: "total",
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
                        $skip: (page - 1) * 10,
                    },
                    {
                        $limit: resultsPerPage,
                    },
                ],
            },
        },
    ])
    const updatedMealPlans = [];
    if (!isAdmin) {
        for (const mealplan of mealplans) {
            const updatedDataItems = [];

            for (const dataItem of mealplan.data) {
                const recipeIds = dataItem.recipes.map(recipe => recipe.id);

                try {
                    const detailedRecipes = await Recipe.find({ _id: { $in: recipeIds }, is_draft: false });
                    const updatedRecipes = detailedRecipes.map(recipe => ({ id: recipe._id, title: recipe.title }));

                    updatedDataItems.push({
                        ...dataItem,
                        recipes: updatedRecipes
                    });
                } catch (error) {
                    console.error("Error fetching detailed recipes:", error);
                    updatedDataItems.push(dataItem); // Keep the original dataItem in case of error
                }
            }

            updatedMealPlans.push({
                ...mealplan,
                data: updatedDataItems
            });
        }
    }

    if (isAdmin) {
        const pagination = {
            totalCount: mealplans[0]?.metadata[0].total,
            currentPage: page
        }

        res.json({ mealplans: mealplans[0]?.data, pagination });
    } else {
        const pagination = {
            totalCount: updatedMealPlans[0]?.metadata[0].total,
            currentPage: page
        }
        res.json({ mealplans: updatedMealPlans[0]?.data, pagination });
    }
})


// @desc    Get sorted mealplans
// @route   GET /api/mealplans/sorted/:filterKey/:direction/:numPerPage/:pageNum
// @access  Private/Admin
const getSortedMealPlans = asyncHandler(async (req, res, next) => {
    const page = req.params.pageNum || 0;
    const filterKey = req.params.filterKey || "featured_date";
    const direction = req.params.direction || "asc";
    const resultsPerPage = Number(req.params.numPerPage) || 25;

    const filterQuery = {
        [filterKey]: direction === 'asc' ? 1 : -1
    }

    const mealplans = await MealPlan.aggregate([
        { $sort: filterQuery },
        {
            $facet: {
                metadata: [{ $count: "total" }, { $addFields: { page, resultsPerPage } }],
                data: [{ $skip: (page - 1) * resultsPerPage }, { $limit: resultsPerPage }],
            },
        },
    ])

    const pagination = {
        totalCount: mealplans[0]?.metadata[0].total,
        currentPage: page
    }

    res.json({ mealplans: mealplans[0]?.data, pagination });
})

// @desc Get mealplan for a user
// @route GET /api/mealplans/get_user_mealplan
const getUserMealPlans = asyncHandler(async (req, res, next) => {
    const resultsPerPage = 10;
    const page = req.params.pageNum || 0;
    const isAdmin = req.user.is_admin;
    const mealplans = await MealPlan.aggregate([
        { $match: { owner: mongo.ObjectId(req.user?._id) } },
        {
            $unwind: {
                path: "$plan_data",
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $unwind: {
                path: "$plan_data.meals",
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $project: {
                _id: 1,
                default_shopping_list: 1,
                is_admin_plan: 1,
                title: 1,
                owner: 1,
                plan_data: {
                    meals: {
                        id: 1,
                        title: 1,
                    },
                },
                featured_date: 1,
            },
        },
        {
            $group: {
                _id: "$_id",
                default_shopping_list: {
                    $first: "$default_shopping_list",
                },
                is_admin_plan: {
                    $first: "$is_admin_plan",
                },
                title: {
                    $first: "$title",
                },
                owner: {
                    $first: "$owner"
                },
                recipes: {
                    $addToSet: {
                        title: "$plan_data.meals.title",
                        id: "$plan_data.meals.id",
                    },
                },
                featured_date: {
                    $first: "$featured_date",
                },
            },
        },
        { $sort: { featured_date: -1 } },
        {
            $facet: {
                metadata: [{ $count: "total" }, { $addFields: { page, resultsPerPage } }],
                data: [{ $skip: (page - 1) * resultsPerPage }, { $limit: resultsPerPage }],
            },
        },
    ])

    const updatedMealPlans = [];
    if (!isAdmin) {
        for (const mealplan of mealplans) {
            const updatedDataItems = [];

            for (const dataItem of mealplan.data) {
                const recipeIds = dataItem.recipes.map(recipe => recipe.id);

                try {
                    const detailedRecipes = await Recipe.find({ _id: { $in: recipeIds }, is_draft: false });
                    const updatedRecipes = detailedRecipes.map(recipe => ({ id: recipe._id, title: recipe.title }));

                    updatedDataItems.push({
                        ...dataItem,
                        recipes: updatedRecipes
                    });
                } catch (error) {
                    console.error("Error fetching detailed recipes:", error);
                    updatedDataItems.push(dataItem); // Keep the original dataItem in case of error
                }
            }

            updatedMealPlans.push({
                ...mealplan,
                data: updatedDataItems
            });
        }
    }

    if (isAdmin) {
        const pagination = {
            totalCount: mealplans[0]?.metadata[0].total,
            currentPage: page
        }

        res.json({ mealplans: mealplans[0]?.data, pagination });
    } else {
        const pagination = {
            totalCount: updatedMealPlans[0]?.metadata[0].total,
            currentPage: page
        }
        res.json({ mealplans: updatedMealPlans[0]?.data, pagination });
    }
})


// @desc    Get mealplan by ID
// @route   GET /api/mealplans/get_mealplan/:id
// @access  Private
const getMealPlanById = asyncHandler(async (req, res, next) => {
    const id = req.params.id
    const isAdmin = req.user.is_admin;
    const mealplan = await MealPlan.aggregate([
        {
            $match: {
                _id: mongo.ObjectId(id),
            },
        },
        {
            $unwind: "$plan_data",
        },
        {
            $unwind: {
                path: "$plan_data.meals",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project:
            /**
             * specifications: The fields to
             *   include or exclude.
             */
            {
                default_shopping_list: 1,
                owner: 1,
                is_admin_plan: 1,
                title: 1,
                primary_image: 1,
                plan_data: 1,
                featured_date: 1,
                tags: 1,
                recipe_id: {
                    $toObjectId: "$plan_data.meals.id",
                },
            },
        },
        {
            $lookup: {
                from: "recipes",
                localField: "recipe_id",
                foreignField: "_id",
                as: "plan_data.meals.recipe",
            },
        },
        {
            $unwind: {
                path: "$plan_data.meals.recipe",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                title: 1,
                default_shopping_list: 1,
                is_admin_plan: 1,
                primary_image: 1,
                plan_data: {
                    title: 1,
                    meals: {
                        title: 1,
                        id: "$plan_data.meals.recipe._id",
                        cook_time:
                            "$plan_data.meals.recipe.cook_time",
                        prep_time:
                            "$plan_data.meals.recipe.prep_time",
                        is_draft: "$plan_data.meals.recipe.is_draft",
                        primaryImage: 1,
                        details: 1,
                        servings: 1,
                        diet: 1,
                        isDairyFree: 1,
                        isGlutenFree: 1,
                    },
                },
                featured_date: 1,
                tags: 1,
            },
        },
        {
            $group: {
                _id: "$plan_data.title",
                id: {
                    $first: "$_id",
                },
                default_shopping_list: {
                    $first: "$default_shopping_list",
                },
                is_admin_plan: {
                    $first: "$is_admin_plan",
                },
                title: {
                    $first: "$title",
                },
                primary_image: {
                    $first: "$primary_image",
                },
                plan_data: {
                    $first: "$plan_data",
                },
                meals: {
                    $push: "$plan_data.meals",
                },
                featured_date: {
                    $first: "$featured_date",
                },
                tags: {
                    $first: "$tags",
                },
            },
        },
        {
            $project: {
                title: 1,
                id: 1,
                default_shopping_list: 1,
                is_admin_plan: 1,
                primary_image: 1,
                plan_data: {
                    title: 1,
                    meals: "$meals",
                },
                featured_date: 1,
                tags: 1,
            },
        },
        {
            $group: {
                _id: "$id",
                default_shopping_list: {
                    $first: "$default_shopping_list",
                },
                is_admin_plan: {
                    $first: "$is_admin_plan",
                },
                title: {
                    $first: "$title",
                },
                primary_image: {
                    $first: "$primary_image",
                },
                plan_data: {
                    $addToSet: "$plan_data",
                },
                featured_date: {
                    $first: "$featured_date",
                },
                tags: {
                    $first: "$tags",
                },
            },
        },
    ]).exec()

    if (!mealplan) {
        return next(new AppError('No document found with that ID', 404));
    }

    const plan_data = mealplan.flatMap((plan) => {
        return plan.plan_data.map((time) => {
            switch (time?.title?.toLowerCase()) {
                case "breakfast":
                    time.order = 1;
                    break;
                case "lunch":
                    time.order = 2;
                    break;
                case "dinner":
                    time.order = 3;
                    break;
            }
            return time
        }).sort((a, b) => a.order - b.order)
    })
    if (!isAdmin) {
        function filterDraftMeals(mealsArray) {
            return mealsArray.map(meal => (meal.is_draft === false ? meal : {}));
        }
        for (let i = 0; i < plan_data.length; i++) {
            const updatedMeals = filterDraftMeals(plan_data[i].meals);
            plan_data[i].meals = updatedMeals;
        }
    }
    mealplan[0].plan_data = plan_data
    res.json(mealplan[0])
})

// ******** UPDATE ********

// @desc    Update mealplan mealplan
// @route   PUT /api/mealplans/update_mealplan/:id
// @access  Private
const updateMealPlan = asyncHandler(async (req, res, next) => {
    const mealplan = await MealPlan.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    })

    if (!mealplan) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json(mealplan)
})

// ******** DELETE ********

// @desc    Delete mealplan
// @route   DELETE /api/mealplans/:id
// @access  Private
const deleteMealPlan = asyncHandler(async (req, res, next) => {
    const doc = await MealPlan.findByIdAndDelete(req.params.id);

    if (!doc) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
        status: 'success',
        data: null,
    });

})

// ******** MIGRATE ********
const migratePlans = asyncHandler(async (req, res, next) => {
    const recipes = await Recipe.find({})
    const users = await User.find({})
    const newPlans = mealPlansData.map(item => {
        const tagsArray = []
        item.tags?.map(tag => {
            tag.split(',').forEach(tag => {
                tagsArray.push(tag)
            })
        })

        const planData = item.plan.map(plan => {
            const obj = {
                title: plan.title,
            }
            const arr = plan.meals.map(meal => {
                const id = meal.id
                const title = meal.title
                let recipe = ''
                if (id) {
                    recipe = recipes.find(recipe => String(recipe.id) === String(id) || recipe.title === title)
                }

                if (recipe) {
                    meal.id = recipe._id
                }

                meal.details = {
                    diet: meal.diet,
                    isDairyFree: meal.isDairyFree,
                    isGlutenFree: meal.isGlutenFree,
                }
                return meal
            })
            obj.meals = arr
            return obj
        })

        const currentUser = users.find(user => user.id === item.UserId?.toString())

        const obj = {
            default_shopping_list: '63fc5ec5a93cc61ac031b843',
            title: item.title,
            owner: currentUser?._id || null,
            is_admin_plan: item.isAdmin,
            primary_image: item.primaryImage,
            plan_data: planData,
            featured_date: Date.now(),
            tags: item.tags,
        }
        if (currentUser) {
            return obj
        } else {
            return null
        }
    }).filter(item => item !== null)

    await MealPlan.deleteMany({})
    await MealPlan.insertMany(newPlans)
    res.status(201).json('Meal Plans migrated')
})

export {
    createNewMealPlan,
    getMealPlanById,
    getUserMealPlans,
    getAllMealPlans,
    getSortedMealPlans,
    updateMealPlan,
    deleteMealPlan,
    migratePlans
}