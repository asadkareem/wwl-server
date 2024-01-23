import asyncHandler from "express-async-handler";
import RecipeCollection from "../models/recipecollectionModel.js";
import AppError from "../utilis/appError.js";
import { updateFavoriteOrBookmarkProperty } from "../utilis/generalFuntions.js";
import redisClient from "../config/redis.js";

// ******** CREATE ********

// @desc    Create a new recipecollection
// @route   POST /api/recipecollections
// @access  Private
const createNewRecipeCollection = asyncHandler(async (req, res, next) => {
  try {
    const collection = await RecipeCollection.create(req.body);
    res.status(201).json(collection);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
});

// ******** READ ********

// @desc    Get all recipecollections
// @route   GET /api/recipecollections/:page
// @access  Private/Admin
const getAllRecipeCollections = asyncHandler(async (req, res, next) => {
  const resultsPerPage = 20;
  const page = req.params.pageNum || 0;

  const recipeCollections = await RecipeCollection.aggregate([
    { $sort: { featured_date: -1 } },
    {
      $facet: {
        metadata: [
          { $count: "total" },
          { $addFields: { page, resultsPerPage } },
        ],
        data: [
          { $skip: (page - 1) * resultsPerPage },
          { $limit: resultsPerPage },
        ],
      },
    },
  ]);

  const pagination = {
    totalCount: recipeCollections[0]?.metadata[0]?.total || 0,
    currentPage: page,
  };

  res.json({ recipesCollections: recipeCollections[0]?.data, pagination });
});

// @desc Get Recipe Collection Recipes
// @route GET /api/recipecollections/recipes
// const getAllRecipesFromCollection = asyncHandler(async (req, res, next) => {
//     const key = "__express__" + req.originalUrl || req.url;
//     const resultsPerPage = 3;
//     const page = req.params.pageNum || 0;
//
//     const recipeCollections = await RecipeCollection.aggregate([
//         {
//             $sort: {
//                 featured_date: -1,
//             },
//         },
//         {
//             $facet: {
//                 metadata: [
//                     {
//                         $count: "total",
//                     },
//                     {
//                         $addFields: {
//                             page,
//                             resultsPerPage
//                         },
//                     },
//                 ],
//                 data: [
//                     {
//                         $skip: (page - 1) * resultsPerPage,
//                     },
//                     {
//                         $limit: resultsPerPage,
//                     },
//                 ],
//             },
//         },
//         {
//             $lookup: {
//                 from: "mealplans",
//                 localField: "data.meal_plans",
//                 foreignField: "_id",
//                 as: "plans",
//             },
//         },
//         {
//             $unwind: {
//                 path: "$plans",
//                 preserveNullAndEmptyArrays: true,
//             },
//         },
//         {
//             $unwind: {
//                 path: "$plans.plan_data.meals",
//                 preserveNullAndEmptyArrays: true,
//             },
//         },
//         {
//             $lookup: {
//                 from: "recipes",
//                 localField: "plans.plan_data.meals.id",
//                 foreignField: "_id",
//                 as: "recipe",
//             },
//         },
//         {
//             $unwind: {
//                 path: "$recipe",
//                 preserveNullAndEmptyArrays: true,
//             },
//         },
//         {
//             $unwind: {
//                 path: "$data",
//                 preserveNullAndEmptyArrays: true,
//             },
//         },
//         {
//             $group: {
//                 _id: "$data._id",
//                 title: {
//                     $first: "$data.title",
//                 },
//                 metadata: {
//                     $first: "$metadata",
//                 },
//                 recipes: {
//                     $addToSet: {
//                         _id: "$recipe._id",
//                         title: "$recipe.title",
//                         average_rating: "$recipe.average_rating",
//                         primary_image: "$recipe.primary_image",
//                         total_ratings: "$recipe.total_ratings",
//                         cook_time: "$recipe.cook_time",
//                         servings: 1,
//                     },
//                 },
//             },
//         },
//         {
//             $project: {
//                 metadata: 1,
//                 data: {
//                     _id: "$_id",
//                     title: "$title",
//                     recipes: "$recipes",
//                 },
//             },
//         },
//         {
//             $unwind: {
//                 path: "$metadata",
//                 preserveNullAndEmptyArrays: true,
//             },
//         },
//         {
//             $group: {
//                 _id: "$metadata",
//                 metadata: {
//                     $first: "$metadata",
//                 },
//                 data: {
//                     $push: "$data",
//                 },
//             },
//         },
//         {
//             $project: {
//                 _id: 0,
//             },
//         },
//         {
//             $sort: {
//                 "data._id": -1,
//             },
//         },
//     ])
//
//     recipeCollections[0]?.data?.map((collection) => {
//         updateFavoriteOrBookmarkProperty(collection?.recipes, req?.user?.favorite_recipes, req?.user?.bookmarked_recipes)
//     })
//
//     const pagination = {
//         totalCount: recipeCollections[0]?.metadata?.total,
//         currentPage: page
//     }
//
//     if (recipeCollections[0]?.data[0]?._id === null) res.json({recipesCollections: [], pagination});
//     else {
//         const response = {recipesCollections: recipeCollections[0]?.data, pagination}
//         await redisClient.set(key, JSON.stringify(response), {'EX': 10800})
//         console.log("Response from Recipe Collection")
//         res.json(response);
//     }
// })

const getAllRecipesFromCollection = asyncHandler(async (req, res, next) => {
  const key = "__express__" + req.originalUrl || req.url;
  const page = Number(req.params.pageNum) || 0;
  const resultsPerPage = page === 1 ? 1 : page === 2 ? 2 : 3;
  const isAdmin = req.user.is_admin;
  const skip =
    resultsPerPage === 3 && page === 3
      ? (page - 1) * (resultsPerPage - 1) - 1
      : (page - 1) * (resultsPerPage - 1);

  const recipeCollections = await RecipeCollection.aggregate([
    {
      $sort: {
        featured_date: -1,
      },
    },
    {
      $lookup: {
        from: "recipes",
        localField: "recipes",
        foreignField: "_id",
        as: "recipes",
      },
    },
    {
      $unwind: {
        path: "$recipes",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: isAdmin ? {} : {
        "recipes.is_draft": false
      }
    },
    {
      $lookup: {
        from: "recipenotes",
        localField: "recipes._id",
        foreignField: "recipe_id",
        as: "recipe_notes",
      },
    },
    {
      $addFields: {
        community_note_count: {
          $size: {
            $filter: {
              input: "$recipe_notes",
              cond: {
                $eq: ["$$this.note_type", "community"],
              },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: "$_id",
        title: {
          $first: "$title",
        },

        featured_date: {
          $first: "$featured_date",
        },
        recipes: {
          $addToSet: {
            _id: "$recipes._id",
            title: "$recipes.title",
            average_rating: "$recipes.average_rating",
            primary_image: "$recipes.primary_image",
            total_ratings: "$recipes.total_ratings",
            cook_time: "$recipes.cook_time",
            community_note_count: "$community_note_count",
            servings: 1,
          },
        },
      },
    },
    {
      $sort: {
        featured_date: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: resultsPerPage,
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
        data: [],
      },
    },
  ]);

  recipeCollections[0]?.data?.map((collection) => {
    updateFavoriteOrBookmarkProperty(
      collection?.recipes,
      req?.user?.favorite_recipes,
      req?.user?.bookmarked_recipes
    );
  });

  const pagination = {
    totalCount: recipeCollections[0]?.metadata?.total,
    currentPage: page,
  };

  if (recipeCollections[0]?.data[0]?._id === null)
    res.json({ recipesCollections: [], pagination });
  else {
    const response = {
      recipesCollections: recipeCollections[0]?.data,
      pagination,
    };
    await redisClient.set(key, JSON.stringify(response), { EX: 10800 });
    res.json(response);
  }
});

// @desc    Get sorted recipecollections
// @route   GET /api/recipecollections/sorted/:filterKey/:direction/:numPerPage/:pageNum
// @access  Private/Admin
const getSortedRecipeCollections = asyncHandler(async (req, res, next) => {
  const page = req.params.pageNum || 0;
  const filterKey = req.params.filterKey || "featured_date";
  const direction = req.params.direction || "asc";
  const resultsPerPage = Number(req.params.numPerPage) || 25;

  const filterQuery = {
    [filterKey]: direction === "asc" ? 1 : -1,
  };

  const recipeCollections = await RecipeCollection.aggregate([
    { $sort: filterQuery },
    {
      $facet: {
        metadata: [
          { $count: "total" },
          { $addFields: { page, resultsPerPage } },
        ],
        data: [
          { $skip: (page - 1) * resultsPerPage },
          { $limit: resultsPerPage },
        ],
      },
    },
  ]);

  const pagination = {
    totalCount: recipeCollections[0]?.metadata[0]?.total,
    currentPage: page,
  };

  res.json({ recipeCollections: recipeCollections[0]?.data, pagination });
});

// @desc    Get recipecollection by ID
// @route   GET /api/recipecollections/get_recipecollection/:id
// @access  Private
const getRecipeCollectionById = asyncHandler(async (req, res, next) => {

  const isAdmin = req.user.is_admin;



  // Define the pipeline stages
  const aggregateQuery = [
    {
      $match: {
        _id: ObjectId(req.params.id)
      }
    },
    {
      $lookup: {
        from: "recipes",
        localField: "recipes",
        foreignField: "_id",
        as: "recipes"
      }
    },
    {
      $unwind: {
        path: "$recipes",
        preserveNullAndEmptyArrays: false
      }
    },
    {
      $match: isAdmin ? {} : {
        "recipes.is_draft": false
      }
    },
    {
      $group: {
        _id: "$_id",
        recipes: { $push: "$recipes" },
        featured_date: { $first: "$featured_date" },
        title: { $first: "$title" },
        __v: { $first: "$__v" }
      }
    }
  ];

  // Execute the aggregation pipeline
  const recipeCollection = await RecipeCollection.aggregate(aggregateQuery);

  console.log(recipeCollection);



  if (!recipeCollection) {
    return next(new AppError("No document found with that ID", 404));
  }

  res.json(recipeCollection);
});

// ******** UPDATE ********

// @desc    Update recipecollection recipecollection
// @route   PUT /api/recipecollections/update_recipecollection/:id
// @access  Private
const updateRecipeCollection = asyncHandler(async (req, res, next) => {
  const recipeCollection = await RecipeCollection.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  // If we don't find the ingredient, throw an error.
  if (!recipeCollection) {
    return next(new AppError("No document found with that ID", 404));
  }

  res.status(200).json(recipeCollection);
});

// ******** DELETE ********

// @desc    Delete recipecollection
// @route   DELETE /api/recipecollections/:id
// @access  Private
const deleteRecipeCollection = asyncHandler(async (req, res, next) => {
  const recipeCollection = await RecipeCollection.findByIdAndDelete(
    req.params.id
  );

  if (!recipeCollection) {
    return next(new AppError("No document found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: null,
  });
});

export {
  createNewRecipeCollection,
  getRecipeCollectionById,
  getAllRecipesFromCollection,
  getAllRecipeCollections,
  getSortedRecipeCollections,
  updateRecipeCollection,
  deleteRecipeCollection,
};
