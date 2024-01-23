import asyncHandler from 'express-async-handler'
import RecipeNote from '../models/recipenoteModel.js'
import Recipe from "../models/recipeModel.js";
import User from "../models/userModel.js";
import {mongo} from "mongoose";
import MealPlan from "../models/mealplanModel.js";
import AppError from "../utilis/appError.js";
// import allNotes from '../data/AllNotes.json' assert {type: "json"};

// ******** CREATE ********

// @desc    Create a new recipenote
// @route   POST /api/recipenotes
// @access  Private
const createNewRecipeNote = asyncHandler(async (req, res, next) => {
    try {
        const {owner, user_name, recipe_id, parent_note, note_type, contents} = req.body
        const recipeNote = await RecipeNote.create({
            owner,
            user_name,
            recipe_id,
            parent_note,
            note_type,
            contents
        })
        res.status(201).json({...recipeNote._doc, replies: []})
    } catch (error) {
        next(new AppError(error.message, 400))
    }
})

// @desc    Get User Personal recipenote by Recipe ID
// @route   GET /api/recipenotes/get_personal/:id
// @access  Private
const getUserRecipeNotesByRecipeId = asyncHandler(async (req, res) => {
    const resultsPerPage = 20;
    const page = req.params.pageNum || 0;
    const recipeId = req.params.id

    const recipeNotes = await RecipeNote.aggregate([
        {$match: {recipe_id: mongo.ObjectId(recipeId), note_type: 'personal', owner: req.user._id}},
        {
            $facet: {
                metadata: [{$count: "total"}, {$addFields: {page, resultsPerPage}}],
                data: [{$skip: (page - 1) * resultsPerPage}, {$limit: resultsPerPage}],
            },
        },
    ])

    const pagination = {
        totalCount: recipeNotes[0]?.metadata[0]?.total,
        currentPage: page
    }

    if (recipeNotes[0]?.data?.length > 0) {
        res.json({notes: recipeNotes[0]?.data, pagination})
    } else {
        res.json({notes: []})
    }
})

// @desc    Get Community recipenote by Recipe ID
// @route   GET /api/recipenotes/get_community/:id
// @access  Private
const getCommunityRecipeNotesByRecipeId = asyncHandler(async (req, res) => {
    const resultsPerPage = 20;
    const page = req.params.pageNum || 0;
    const recipeId = req.params.id

    const recipeNotes = await RecipeNote.aggregate([
        {
            $match: {
                recipe_id: mongo.ObjectId(
                    recipeId
                ),
                note_type: "community",
            },
        },
        {
            $addFields: {
                is_pinned_int: {
                    $cond: {
                        if: {
                            $eq: ["$is_pinned", true],
                        },
                        then: 0,
                        else: 1,
                    },
                },
            },
        },
        {
            $sort: {
                is_pinned_int: 1,
            },
        },
        {
            $lookup: {
                from: "recipenotes",
                let: {
                    id: "$_id",
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$parent_note", "$$id"],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            owner: 1,
                            recipe_id: 1,
                            note_type: 1,
                            contents: 1,
                            is_pinned: 1,
                            is_flagged: 1,
                        },
                    },
                ],
                as: "replies",
            },
        },
        {
            $unwind: {
                path: "$replies",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "replies.owner",
                foreignField: "_id",
                as: "replies.user_name",
            },
        },
        {
            $unwind: {
                path: "$replies.owner",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                _id: 1,
                owner: 1,
                user_name: 1,
                recipe_id: 1,
                parent_note: 1,
                note_type: 1,
                contents: 1,
                is_pinned: 1,
                is_flagged: 1,
                replies: {
                    _id: 1,
                    owner: 1,
                    recipe_id: 1,
                    note_type: 1,
                    parent_note: 1,
                    contents: 1,
                    is_pinned: 1,
                    is_flagged: 1,
                    user_name: {
                        name: 1,
                    },
                },
            },
        },
        {
            $match: {
                parent_note: {
                    $eq: null,
                },
            },
        },
        {
            $group: {
                _id: "$_id",
                owner: {
                    $first: "$owner",
                },
                user_name: {
                    $first: "$user_name",
                },
                recipe_id: {
                    $first: "$recipe_id",
                },
                parent_note: {
                    $first: "$parent_note",
                },
                note_type: {
                    $first: "$note_type",
                },
                contents: {
                    $first: "$contents",
                },
                is_pinned: {
                    $first: "$is_pinned",
                },
                is_flagged: {
                    $first: "$is_flagged",
                },
                replies: {
                    $addToSet: "$replies",
                },
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
                        $skip: (page - 1) * resultsPerPage,
                    },
                    {
                        $limit: resultsPerPage,
                    },
                ],
            },
        },
    ])

    const pagination = {
        totalCount: recipeNotes[0]?.metadata[0]?.total,
        currentPage: page
    }

    if (recipeNotes[0]?.data?.length > 0) {
        res.json({notes: recipeNotes[0]?.data, pagination})
    } else {
        res.json({notes: []})
    }
})

// ******** UPDATE ********

// @desc    Update recipenote recipenote
// @route   PUT /api/recipenotes/update_recipenote/:id
// @access  Private
const updateRecipeNote = asyncHandler(async (req, res, next) => {
    const {contents, is_pinned, is_flagged} = req.body
    const recipeNote = await RecipeNote.findByIdAndUpdate(req.params?.id, {
        contents,
        is_pinned,
        is_flagged
    }, {
        new: true,
        runValidators: true
    })

    if (!recipeNote) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json(recipeNote)
})

// ******** DELETE ********

// @desc    Delete recipenote
// @route   DELETE /api/recipenotes/:id
// @access  Private
const deleteRecipeNote = asyncHandler(async (req, res, next) => {
    const id = req?.params?.id
    const doc = await RecipeNote.findByIdAndDelete(id);
    await RecipeNote.deleteMany({parent_note: id})

    if (!doc) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
        status: 'success',
        data: null,
    });
})

// @desc Migrate recipenotes
// @route GET /api/recipenotes/migrate
// @access Private

const migrateRecipeNotes = asyncHandler(async (req, res) => {
    const recipes = await Recipe.find({})
    const users = await User.find({})
    const recipeNotes = allNotes.map(note => {
        const recipe = recipes.find(recipe => recipe.id === note.recipeId.toString())
        const user = users.find(user => user.id === note.userId.toString())

        if (recipe && user) {
            return {
                id: note.id,
                owner: user._id,
                user_name: user.name || note.userName,
                recipe_id: recipe._id,
                parent_note: String(note.parentId),
                note_type: note.displayedNoteType,
                contents: note.contents,
                is_pinned: note.isPinned,
                is_flagged: note.isFlagged
            }
        } else {
            return null
        }
    }).filter(note => note !== null)

    await RecipeNote.deleteMany({})
    await RecipeNote.insertMany(recipeNotes)
    res.status(201).json('Notes migrated successfully')
})

const migrateRecipeParentNotesRef = asyncHandler(async (req, res) => {
    // First Run This Code
    // const recipeNotes = await RecipeNote.find({})
    // const recipeNotesWithParent = recipeNotes.filter(note => note.parent_note !== "null").map(note => {
    //     const parentNote = recipeNotes.find(parentNote => parentNote.id === note.parent_note)
    //     if (parentNote) {
    //         return {
    //             ...note._doc,
    //             parent_note: parentNote._id
    //         }
    //     } else {
    //         return null
    //     }
    // }).filter(note => note !== null).map(async note => {
    //     await RecipeNote.updateOne({_id: note._id}, {parent_note: String(note.parent_note)})
    // })
    //
    // res.status(201).json('Notes migrated successfully')

    // Run this code after running the above code
    // const recipeNotes = allNotes.map(note => {
    //     if (note.parent_note !== "null") {
    //         note.parent_note = {
    //             "$oid": note.parent_note
    //         }
    //     } else {
    //         note.parent_note = null
    //     }
    //     return note
    // })
    //
    // res.json(recipeNotes)
})


export {
    createNewRecipeNote,
    getUserRecipeNotesByRecipeId,
    getCommunityRecipeNotesByRecipeId,
    migrateRecipeNotes,
    migrateRecipeParentNotesRef,
    updateRecipeNote,
    deleteRecipeNote,
}