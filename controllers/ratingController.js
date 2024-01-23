import asyncHandler from 'express-async-handler'
import Rating from '../models/ratingModel.js'
import Recipe from "../models/recipeModel.js";
import {mongo} from "mongoose";
// import allUsers from '../data/AllUsers.json' assert {type: "json"};
import User from "../models/userModel.js";
import AppError from "../utilis/appError.js";

// ******** CREATE ********

// @desc    Create a new rating
// @route   POST /api/ratings
// @access  Private
const createNewRating = asyncHandler(async (req, res, next) => {
    try {
        const rating = await Rating.updateOne({recipe: req.body.recipe, user: req.user._id}, {
            $set: {
                score: req.body.score,
                user: req.user._id,
                recipe: req.body.recipe
            }
        }, {upsert: true})

        const [ratingStats] = await Rating.aggregate([
            {
                $match: {
                    recipe: mongo.ObjectId(
                        req.body.recipe
                    ),
                },
            },
            {
                $group: {
                    _id: "$recipe",
                    ratingCount: {
                        $sum: 1,
                    },
                    totalRating: {
                        $sum: "$score",
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    ratingCount: 1,
                    averageRating: {
                        $divide: ["$totalRating", "$ratingCount"],
                    },
                },
            },
        ])

        await Recipe.findByIdAndUpdate(req.body.recipe, {
            total_ratings: ratingStats.ratingCount,
            average_rating: ratingStats.averageRating
        }, {runValidators: true})

        res.status(201).json(rating)
    } catch (error) {
        next(new AppError(error.message, 400))
    }
})

// @desc    Get rating by ID
// @route   GET /api/ratings/get_rating/:id
// @access  Private
const getRatingById = asyncHandler(async (req, res) => {
    const [rating] = await Rating.find({user: req.user._id, recipe: req.params.id})

    if (rating) {
        res.json(rating)
    } else {
        res.json({})
    }
})

const migrateRatings = asyncHandler(async (req, res) => {
    // const recipes = await Recipe.find({})
    // const users = await User.find({})
    //
    // const ratings = allUsers.flatMap(user => {
    //     const currentUser = users.find(u => {
    //         return u.id === user.id.toString()
    //     })
    //     const ratingsOfUser = user?.extraData?.ratedRecipes?.map(ratedRecipe => {
    //         const currentRecipe = recipes.find(r => {
    //             return r.id === ratedRecipe.id.toString()
    //         })
    //
    //         if(currentUser && currentRecipe && ratedRecipe?.rating) {
    //             return {
    //                 user: currentUser?._id,
    //                 recipe: currentRecipe?._id,
    //                 score: ratedRecipe?.rating
    //             }
    //         } else {
    //             return null
    //         }
    //     }).filter(r => r !== null)
    //
    //     return ratingsOfUser
    // }).filter(r => r !== undefined)
    //
    //
    // await Rating.deleteMany({})
    // await Rating.insertMany(ratings)
    res.status(201).json('Ratings migrated successfully')
})

export {
    createNewRating,
    getRatingById,
    migrateRatings
}