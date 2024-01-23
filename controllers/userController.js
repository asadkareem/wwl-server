import asyncHandler from 'express-async-handler'
import User from '../models/userModel.js'
import jwt from 'jsonwebtoken'
import { authenticateThroughMemberful } from "../middleware/memberful.js";
import AppError from "../utilis/appError.js";
// import allUsers from '../data/AllUsers.json' assert {type: "json"};
import Recipe from "../models/recipeModel.js";
import Ingredient from "../models/ingredientModel.js";
import axios from "axios";
import ShoppingList from "../models/shoppinglistModel.js";
import MealPlan from "../models/mealplanModel.js";

const login = asyncHandler(async (req, res, next) => {
    try {
        const user = await authenticateThroughMemberful(req.body, false);
        const { email, memberful_id } = user

        if (!email || !memberful_id) {
            return next(new AppError('Invalid Credentials', 401))
        }

        const token = jwt.sign({ email, memberful_id }, process.env.JWT_SECRET)
        res.status(200).json({ user, token });
    } catch (e) {
        next(e);
    }
});

const loginAdmin = asyncHandler(async (req, res, next) => {
    console.log('API :: loginAdmin')
    try {
        const { email, adminPassword } = req.body;
        if (!email || !adminPassword) {
            return next(new AppError('Invalid credentials', 401))
        }
        const [user] = await User.find({ email: email });
        if (user.is_admin) {
            let id = user?._id;
            const token = jwt.sign({ email, id }, process.env.JWT_SECRET)
            res.status(200).json({ user, token });
        } else {
            return next(new AppError('Invalid credentials', 401))
        }
    } catch (e) {
        next(e);
    }
});

// ******** READ ********

// @desc    Get all users
// @route   GET /api/users/:page
// @access  Private/Admin
const getAllUsers = asyncHandler(async (req, res, next) => {
    const resultsPerPage = 50;
    const page = req.params.pageNum || 0;

    const users = await User.aggregate([
        { $sort: { created_at: -1 } },
        {
            $facet: {
                metadata: [{ $count: "total" }, { $addFields: { page, resultsPerPage } }],
                data: [{ $skip: (page - 1) * resultsPerPage }, { $limit: resultsPerPage }],
            },
        },
    ])

    const pagination = {
        totalCount: users[0]?.metadata[0]?.total,
        currentPage: page
    }

    res.json({ users: users[0]?.data, pagination });
})


// @desc    Get sorted users
// @route   GET /api/users/sorted/:filterKey/:direction/:numPerPage/:pageNum
// @access  Private/Admin
const getSortedUsers = asyncHandler(async (req, res) => {
    const page = req.params.pageNum || 0;
    const filterKey = req.params.filterKey || "createdAt";
    const direction = req.params.direction || "asc";
    const resultsPerPage = req.params.numPerPage || 25;

    const filterQuery = {
        [filterKey]: direction === 'asc' ? 1 : -1
    }
    const users = await User.aggregate([
        { $sort: filterQuery },
        {
            $facet: {
                metadata: [{ $count: "total" }, { $addFields: { page, resultsPerPage } }],
                data: [{ $skip: (page - 1) * resultsPerPage }, { $limit: resultsPerPage }],
            },
        },
    ])

    const pagination = {
        totalCount: users[0]?.metadata[0]?.total,
        currentPage: page
    }

    res.json({ users: users[0]?.data, pagination });
})


// @desc    Get user by ID
// @route   GET /api/users/get_user/:id
// @access  Private
const getUserById = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id)

    if (!user) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.json(user)
})

// ******** UPDATE ********

// @desc    Update user user
// @route   PUT /api/users/update_user/:id
// @access  Private
const updateUser = asyncHandler(async (req, res, next) => {
    const { unit_preference, primary_diet, is_gluten_free, is_dairy_free } = req.body
    const user = await User.findByIdAndUpdate(req.params.id, {
        unit_preference,
        primary_diet,
        is_gluten_free,
        is_dairy_free,
    }, {
        new: true,
        runValidators: true
    })
    // If we don't find the user, throw an error.
    if (!user) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json(user)
})

// ******** Add Favorite ********
// @desc    Add favorite recipe
// @route   PUT /api/users/add_favorite/:id
// @access  Private
const addRemoveFavorite = asyncHandler(async (req, res, next) => {
    const user = req?.user
    const recipeId = req.body.id
    const newFavorite = user?.favorite_recipes.indexOf(recipeId) === -1 ? [...user?.favorite_recipes, recipeId] : user?.favorite_recipes.filter(recipe => !recipe.equals(recipeId))

    const updatedUser = await User.findByIdAndUpdate(user?._id, { favorite_recipes: newFavorite }, {
        new: true,
        runValidators: true
    })

    if (!updatedUser) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json('Favorites Updated Successfully')
})


// ******** Add Bookmark ********
// @desc    Add bookmarked recipe
// @route   PUT /api/users/add_bookmark/:id
// @access  Private
const addRemoveBookmark = asyncHandler(async (req, res, next) => {
    const user = req.user
    const recipeId = req.body.id
    const newBookmark = user.bookmarked_recipes.indexOf(recipeId) === -1 ? [...user.bookmarked_recipes, recipeId] : user.bookmarked_recipes.filter(recipe => !recipe.equals(recipeId))

    const updatedUser = await User.findByIdAndUpdate(user._id, { bookmarked_recipes: newBookmark }, {
        new: true,
        runValidators: true
    })

    if (!updatedUser) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json('Bookmarks Updated Successfully')
})


// ******** DELETE ********

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private
const deleteUser = asyncHandler(async (req, res, next) => {
    const user = await User.findByIdAndDelete(req.params.id)

    if (!user) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: null,
    });
})

// @desc  Search
// @route GET /api/users/search/:searchTerm/:type
// @access Private

const searchData = asyncHandler(async (req, res) => {
    const { searchTerm, type, page } = req.params
    const resultsPerPage = 10
    const searchRegex = new RegExp(`.*${searchTerm}.*`, "i")
    let data = []

    if (type === 'ingredient') {
        data = await Ingredient.aggregate([
            { $match: { title: { $regex: searchRegex } } },
            {
                $facet: {
                    metadata: [{ $count: "total" }, { $addFields: { page, resultsPerPage } }],
                    data: [{ $skip: (page - 1) * resultsPerPage }, { $limit: resultsPerPage }],
                },
            },
        ])
    }
    if (type === 'recipe') {
        data = await Recipe.aggregate([
            { $match: { $or: [{ title: { $regex: searchRegex } }, { description: { $regex: searchRegex } }] } },
            {
                $facet: {
                    metadata: [{ $count: "total" }, { $addFields: { page, resultsPerPage } }],
                    data: [{ $skip: (page - 1) * resultsPerPage }, { $limit: resultsPerPage }],
                },
            },
        ])
    }

    const pagination = {
        totalCount: data[0]?.metadata[0]?.total,
        currentPage: page
    }

    res.json({ data: data[0]?.data, pagination });
}
)

// @desc Send Email
// @route POST /api/users/send_email
// @access Private
const sendEmail = asyncHandler(async (req, res, next) => {
    const { shoppingListId, email } = req?.body
    const headers = {
        'x-api-key': process.env.EMAIL_API_KEY,
    }

    const shoppingList = await ShoppingList.findById(shoppingListId).exec()
    const mealPlan = await MealPlan.findById(shoppingList?.parent_meal_plan).exec()

    let emailBody = `<h1>Shopping List for <span style='color:#FF644C; text-transform:capitalize'>${mealPlan?.title}</span> meal plan</h1>`
    if (shoppingList) {
        shoppingList?.ingredients.forEach((group, i) => {
            if (group && group.get('category')) {
                emailBody += `<h3 style='color:#FF644C'>${group.get('category')}</h3>`
            }


            if (group && group.get('ingredients')) {
                group.get('ingredients').forEach((ing, j) => {
                    emailBody += `<div style='margin-bottom: 5px'><input type='checkbox' ${ing.checked ? 'checked' : ''} id='${ing.title
                        }-${i}-${j}'><label for='${ing.title}-${i}-${j}'> ${ing.desiredTitle} </label>${ing.notes ? `<div><span style='color:#FF644C'>Shopping Notes: </span><span>${ing.notes}</span></div>` : ''}</div>`
                })
            }
        })
        const body = {
            sendAddress: email,
            emailBody: emailBody,
        }

        await axios.post(process.env.EMAIL_URL, body, { headers }).data
        res.json({ message: "Email Sent Successfully" })
    } else {
        next(new AppError('No document found with that ID', 404));
    }
})

// @desc    Migrate User
// @route   GET /api/users/migrate
const migrateUsers = asyncHandler(async (req, res) => {
    // const recipes = await Recipe.find({})
    // const users = allUsers.map(user => {
    //     const obj = {
    //         id: user.id,
    //         name: user.name,
    //         email: user.email,
    //         avatar: 'avatar.png',
    //         memberful_id: user.memberfulId,
    //         is_active: user.isActive,
    //         family_size: user.familySize,
    //         is_admin: user.isAdmin,
    //         is_gluten_free: user.isGlutenFree,
    //         is_dairy_free: user.isDairyFree,
    //         primary_diet: user.primaryDiet,
    //         unit_preference: user.unitPreference,
    //         favorite_recipes: [],
    //         bookmarked_recipes: [],
    //         shopping_lists: [],
    //     }
    //     obj.favorite_recipes = user.favoriteRecipes.map(recipe => {
    //         const recipeObj = recipes.find(r => {
    //             return r.id === recipe.toString()
    //         })
    //         if (recipeObj) {
    //             return recipeObj._id
    //         }
    //     })
    //     obj.bookmarked_recipes = user.bookmarkedRecipes.map(recipe => {
    //         const recipeObj = recipes.find(r => {
    //             return r.id === recipe.toString()
    //         })
    //         if (recipeObj) {
    //             return recipeObj._id
    //         }
    //     })
    //
    //     return obj
    // })
    //
    // await User.deleteMany({})
    // await User.insertMany(users)
    res.status(201).json('Users migrated successfully')
})

export {
    login,
    loginAdmin,
    getUserById,
    getAllUsers,
    getSortedUsers,
    updateUser,
    addRemoveFavorite,
    addRemoveBookmark,
    deleteUser,
    sendEmail,
    searchData,
    migrateUsers,
}