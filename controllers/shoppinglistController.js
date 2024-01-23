import asyncHandler from 'express-async-handler';
import ShoppingList, {
    ShoppingListSchema,
} from '../models/shoppinglistModel.js';
import MealPlan from '../models/mealplanModel.js';
import {mongo} from 'mongoose';
import Ingredient from '../models/ingredientModel.js';
import AppError from '../utilis/appError.js';
import {
    collectMealPlanRecipes,
    convertFundamentalUnitToTargetUnit, convertShoppingListToStandardFormat,
    populateIngredientsForRecipeList
} from "../utilis/shoppinglistHelperFunctions.js";
import {roundToNearestHalf} from "../utilis/generalFuntions.js";


// latest

// ******** CREATE ********

// @desc    Create a new shoppinglist
// @route   POST /api/shoppinglists
// @access  Private
const createNewShoppingList = asyncHandler(async (req, res, next) => {
    try {
        const {owner, parent_meal_plan, meal_plan_title, ingredients} = req.body;
        await ShoppingList.deleteOne({owner, parent_meal_plan});
        const shoppingListData = await ShoppingList.create({
            owner,
            parent_meal_plan,
            meal_plan_title,
            ingredients,
        });
        res.status(201).json(shoppingListData);
    } catch (error) {
        next(new AppError(error.message, 400));
    }
});

// @desc    Get shoppinglist by ID
// @route   GET /api/shoppinglists/get_shoppinglist/:id
// @access  Private

const deleteShoppingListOnReset =asyncHandler(async(req,res,next)=>{
    const shoppingListId=req.params.id;
    const owner=req.user._id;
    const reset=req.query.reset
    if(reset){
        await ShoppingList.deleteOne({owner, parent_meal_plan: shoppingListId});
    }
  next()
});
const getMealPlanShoppingList = asyncHandler(async (req, res, next) => {
    try {
        const unitPreference = req?.user?.unit_preference.toLowerCase();
        // const unitPreference = 'metric';
        // Step 1: Collect all recipes from Meal Plan // Confirmed this works as intended.
        const recipes = await collectMealPlanRecipes(req.params.id);
        // console.log('***** collectMealPlanRecipes result')
        // console.log(recipes[0].recipe.omnivore_ingredients)
        // console.log(recipes[1])
        // console.log("***")

        // Step 2: Collect all Ingredients for Recipes // Confirmed this works as intended, except one bug
        const ingredients = await populateIngredientsForRecipeList(recipes);
        // console.log('***** populateIngredientsForRecipeList result')
        // console.log(ingredients.length)
        // console.log(ingredients[0])
        // console.log(ingredients[1])

        // NOTE: The above function is broken for "count" ingredients right now. We will need to fix this.

        // Properties of all Ingredients which are returned in this list:
        // _id: ingredientInActualUnit && ingredientInActualUnit._id, // id of ingredient
        // title: ingredientInActualUnit && ingredientInActualUnit.title, // title of ingredient
        // quantity: ingredient.qty, // qty of ingredient listed in recipe
        // measurement: ingredient.measurement, // unit described in recipe for ingredient
        // recipe_imperial_qty: (recipeConvertedIngredient && recipeConvertedIngredient.value) || 0, // qty of ingredient listed in recipe in fundamental unit
        // recipe_imperial_unit: (recipeConvertedIngredient && recipeConvertedIngredient.unit) || 0, // fundamental unit being used
        // measurement_type: ingredientInActualUnit.measurement_type, // qty of ingredient listed in recipe in fundamental unit
        // imperial_grams: actualConvertedIngredient && actualConvertedIngredient.value, // Used to calculate imperial to metric conversion factor
        // metric_conversion_factor: metricConversionFactor, // Metric conversion factor used to populate metric ingredients
        // metric_base_qty: ingredientInActualUnit.metric_base_qty, // base qty for metric conversions
        // recipe_metric_qty: (recipeConvertedIngredient && metricConversionFactor && metricConversionFactor * recipeConvertedIngredient.value) || 0, // qty of ingredient listed in recipe in fundamental metric unit
        // recipe_metric_unit: (recipeConvertedIngredient && recipeConvertedIngredient.unit) || 0, // fundamental metric unit being used
        // notes: ingredient.notes, // Any shopping notes which are required to include from the ingredient
        // imperial_base_qty: ingredientInActualUnit.imperial_base_qty, // base qty for imperial to metric conversions
        // imperial_base_unit: ingredientInActualUnit.imperial_base_unit, // base unit for imperial to metric conversions
        // metric_base_unit: ingredientInActualUnit.metric_base_unit, // base unit for metric
        // imperial_shopping_unit: ingredientInActualUnit.imperial_shopping_unit, // output unit for shopping
        // metric_shopping_unit: ingredientInActualUnit.metric_shopping_unit, //output unit for metric shopping
        // imperial_shopping_unit: ingredientInActualUnit.imperial_shopping_unit, // output unit for shopping
        // metric_shopping_unit: ingredientInActualUnit.metric_shopping_unit, //output unit for metric shopping


        // Step 3: Collapse Ingredients into one single unique list // Confirmed this works as intended.
        const ingredientsSummed = ingredients.reduce((unique, ingredient) => {
            const existingIngredientIndex = unique.findIndex(
                r => r._id.toString() === ingredient._id.toString()
            );

            if (existingIngredientIndex !== -1) {
                unique[existingIngredientIndex].meal_plan_imperial_qty += ingredient.meal_plan_imperial_qty;
                unique[existingIngredientIndex].meal_plan_metric_qty += ingredient.meal_plan_metric_qty;
                unique[existingIngredientIndex].notes += `,${ingredient.notes?.trim()}`;
            } else {
                unique.push({...ingredient});
            }
            return unique;
        }, []);

        console.log("*************** ingredientsSummed")
        console.log(ingredientsSummed)

        // Updated values in ingredientsSummed right now are:
        // check_imperial_qty --> To be "meal_plan_imperial_qty"
        // check_metric_qty --> to be "meal_plan_metric_qty"
        // notes --> to be removed for this version


        // Step 4: Convert units from fundamental units to base units. // Confirmed this works as intended.
        const convertedUnitsToBase = ingredientsSummed.map(ingredient => {
            if (ingredient.notes) {
                ingredient.notes = [...new Set(ingredient.notes.split(','))].filter(note => note !== 'undefined' && note !== '' && note !== "null" && note !== null);
            } else {
                ingredient.notes = []
            }
            if (ingredient.measurement_type != 'count' && ingredient.meal_plan_imperial_qty && ingredient.imperial_base_unit && ingredient.meal_plan_metric_qty && ingredient.metric_base_unit) {
                console.log("Title", ingredient.title)
                console.log("Imperial Unit Call");
                const convertedImperialUnit = convertFundamentalUnitToTargetUnit(
                    ingredient.measurement_type,
                    ingredient.measurement_type.toLowerCase() === 'weight' ? 'g' : 'mL',
                    ingredient.meal_plan_imperial_qty,
                    ingredient.imperial_base_unit === 'Milliliter(s)' ? 'mL' : ingredient.imperial_base_unit,
                );

                console.log("Metric Unit Call")

                const convertedMetricUnit = convertFundamentalUnitToTargetUnit(
                    ingredient.measurement_type,
                    ingredient.measurement_type.toLowerCase() === 'weight' ? 'g' : 'mL',
                    ingredient.meal_plan_metric_qty,
                    ingredient.metric_base_unit === 'Gram(s)' ? 'g' : ingredient.metric_base_unit,
                );

                console.log("Hello World")


                ingredient.final_imperial_base_qty = convertedImperialUnit && convertedImperialUnit.value;
                ingredient.final_imperial_base_unit = convertedImperialUnit && convertedImperialUnit.unit;
                ingredient.final_metric_base_qty = convertedMetricUnit && convertedMetricUnit.value;
                ingredient.final_metric_base_unit = convertedMetricUnit && convertedMetricUnit.unit;
            } else {
                // Handle Count
                // TODO: Temporary fix for count ingredients. Need to fix this.
                ingredient.final_imperial_base_qty = ingredient.meal_plan_imperial_qty || 1;
                ingredient.final_imperial_base_unit = "Item(s)";
                ingredient.final_metric_base_qty = ingredient.meal_plan_metric_qty || 1;
                ingredient.final_metric_base_unit = "Item(s)";
            }


            return ingredient;
        })



        // console.log("***********convertedUnitsToBase")
        // console.log(convertedUnitsToBase.length)
        // console.log(convertedUnitsToBase[0])
        // console.log(convertedUnitsToBase[1])

        // Step 5: Convert Units from Base units to Shopping Units
        let convertedIngredientsToShopping = [];

        for (let i = 0; i < convertedUnitsToBase.length; i++) {
            // console.log('Ingredient:', i)
            // console.log(convertedUnitsToBase[i])
            let ingredient = convertedUnitsToBase[i];

            // Step 1 - Get ingredient data for base conversion factor (ensure not 0 or anything else strange)
            if (
                ingredient.imperial_shopping_qty &&
                ingredient.imperial_base_qty > 0 &&
                ingredient.metric_shopping_qty &&
                ingredient.metric_base_qty > 0
            ) {
                const imperialBaseToShopping = ingredient.imperial_shopping_qty / ingredient.imperial_base_qty;
                const metricBaseToShopping = ingredient.metric_shopping_qty / ingredient.metric_base_qty;

                // Step 2 - convert to shopping from base via simple multiplication and save
                convertedIngredientsToShopping.push({
                    ...ingredient,
                    // TODO: Check if this is correct
                    final_imperial_shopping_qty: roundToNearestHalf(imperialBaseToShopping * ingredient.final_imperial_base_qty) || ingredient.imperial_shopping_qty,
                    final_metric_shopping_qty: roundToNearestHalf(metricBaseToShopping * ingredient.final_metric_base_qty) || ingredient.metric_shopping_qty
                });

            } else {
                // Some kind of error, which we will check for at the end.
                convertedIngredientsToShopping.push({
                    ...ingredient,
                    final_imperial_shopping_qty: roundToNearestHalf(ingredient.imperial_shopping_qty) || -1,
                    final_metric_shopping_qty: roundToNearestHalf(ingredient.metric_shopping_qty) || -1,
                });
            }
        }


        // console.log("***********convertedIngredientsToShopping")
        // console.log(convertedIngredientsToShopping.length)
        // console.log(convertedIngredientsToShopping[0])
        // console.log(convertedIngredientsToShopping[1])
        // console.log(convertedIngredientsToShopping)
        // console.log('...')

        // Step 6: Final cleanup
        // Temporary but necessary we are:
        // - Removing repeated notes
        //     Earlier in our script, Rather than summing notes in-line with a comma, we should keep track of notes in an array.
        //     This is because sometimes we get duplicate notes, and we need to be able to remove them.
        // - Fixing "-1" amount ingredients to just appear as their base amount.
        //     For ingredients that have issues on final output, temporary solution:
        //     Output the items to be "1" of their shopping units.
        //     This is because we get "0" in the instance of, for example, salt. This is because it is mostly used in "pinches" in recipes. So, instead we'll return 1tbsp salt, or similar.
        //     so, if any of our final_* quantities are missing, we will just replace them with our "shopping_*" quantity, for now.
        // - Round up to nearest 0.5 value for purchase (ex 1.222 Bunche(s) --> 1.5 Bunche(s))

        // Step 7: Convert into our standard shopping list format and Return
        const data = await convertShoppingListToStandardFormat(convertedIngredientsToShopping, req.params.id, unitPreference);
        res.json(data);
        // res.json(convertedIngredientsToShopping);
    } catch (error) {
        next(new AppError(error.message, 400));
    }


    // try {
    //   // const unitPreference = req.user.unit_preference.toLowerCase();
    //     const unitPreference = 'imperial';
    //   // const user = req.user.unit_preference;
    //   const id = req.params.id;
    //   const [mealPlanRecipes] = await MealPlan.aggregate([
    //     {
    //       $match: {
    //         _id: mongo.ObjectId(id),
    //       },
    //     },
    //     {
    //       $unwind: {
    //         path: '$plan_data',
    //         preserveNullAndEmptyArrays: false,
    //       },
    //     },
    //     {
    //       $unwind: {
    //         path: '$plan_data.meals',
    //         preserveNullAndEmptyArrays: false,
    //       },
    //     },
    //     {
    //       $project: {
    //         plan_data: {
    //           meals: {
    //             id: 1,
    //             servings: 1,
    //             diet: 1,
    //             isDairyFree: 1,
    //             isGlutenFree: 1,
    //           },
    //         },
    //       },
    //     },
    //     {
    //       $addFields: {
    //         newId: {
    //           $toObjectId: '$plan_data.meals.id',
    //         },
    //       },
    //     },
    //     {
    //       $lookup: {
    //         from: 'recipes',
    //         localField: 'newId',
    //         foreignField: '_id',
    //         as: 'plan_data.meals.recipe',
    //       },
    //     },
    //     {
    //       $unwind: {
    //         path: '$plan_data.meals.recipe',
    //         preserveNullAndEmptyArrays: true,
    //       },
    //     },
    //     {
    //       $project: {
    //         plan_data: {
    //           meals: {
    //             servings: 1,
    //             diet: 1,
    //             isDairyFree: 1,
    //             isGlutenFree: 1,
    //             recipe: {
    //               _id: 1,
    //               title: 1,
    //               dairy_free_ingredients: 1,
    //               omnivore_ingredients: 1,
    //               vegetarian_ingredients: 1,
    //               vegan_ingredients: 1,
    //               servings: 1,
    //             },
    //           },
    //         },
    //       },
    //     },
    //     {
    //       $group: {
    //         _id: '$_id',
    //         recipes: {
    //           $push: {
    //             meal_plan_servings: '$plan_data.meals.servings',
    //             diet: '$plan_data.meals.diet',
    //             is_dairy_free: '$plan_data.meals.isDairyFree',
    //             is_gluten_free: '$plan_data.meals.isGlutenFree',
    //             recipe: '$plan_data.meals.recipe',
    //           },
    //         },
    //       },
    //     },
    //   ]);
    //
    //   if (!mealPlanRecipes) return res.json([]);
    //   else {
    //     const ingredientIds = [];
    //     let actualIngredients = [];
    //
    //     mealPlanRecipes.recipes
    //       .filter((recipe) => Object.keys(recipe).length > 0)
    //       .map((recipe) => {
    //         const recipeServingsInPlan = recipe?.meal_plan_servings;
    //         const recipeDefaultServings = recipe?.recipe?.servings;
    //         const recipeServingsRatio =
    //           recipeServingsInPlan / recipeDefaultServings;
    //         const dietType = recipe?.diet?.toLowerCase();
    //         let ingredients =
    //           recipe.recipe[
    //             `${
    //               dietType === 'dairy free'
    //                 ? 'dairy_free_ingredients'
    //                 : dietType.toLowerCase()
    //             }_ingredients`
    //           ];
    //         ingredients = ingredients.map((ingredient) => {
    //           ingredient.servings_multiplier = recipeServingsRatio;
    //           ingredient.id = ingredient.id?._id || ingredient.id;
    //           return ingredient;
    //         });
    //         actualIngredients.push(...ingredients);
    //         ingredientIds.push(
    //           ...new Set(ingredients.map((ingredient) => ingredient.id))
    //         );
    //       });
    //     const ingredients = await Ingredient.find({
    //       _id: { $in: ingredientIds },
    //     }).exec();
    //
    //     const ingredientsInBaseUnits = actualIngredients.map(
    //       (actualIngredient) => {
    //         const ingredient = ingredients.find(
    //           (ingredient) =>
    //             ingredient._id.toString() === actualIngredient.id.toString()
    //         );
    //         let amount_in_base_units;
    //         const baseUnitField = `${unitPreference}_base_unit`;
    //         const baseQtyField = `${unitPreference}_base_qty`;
    //         const shoppingQtyField = `${unitPreference}_shopping_qty`;
    //         const shoppingUnitField = `${unitPreference}_shopping_unit`;
    //
    //         if (
    //           !actualIngredient?.measurement ||
    //           ingredient?.[baseUnitField]
    //             ?.toLowerCase()
    //             ?.includes(actualIngredient?.measurement?.toLowerCase())
    //         )
    //           actualIngredient.base_unit_multiplier = 1;
    //         else {
    //           actualIngredient.base_unit_multiplier = ingredient?.[baseQtyField];
    //         }
    //
    //         if (
    //           actualIngredient.measurement === 'ounce' &&
    //           baseUnitField === 'metric_base_unit'
    //         ) {
    //           amount_in_base_units = Math.trunc(
    //             (actualIngredient.qty / 15) *
    //               actualIngredient.base_unit_multiplier
    //           );
    //         } else {
    //           amount_in_base_units = Math.trunc(
    //             actualIngredient.qty * actualIngredient.base_unit_multiplier
    //           );
    //         }
    //         actualIngredient.amount_in_base_units =
    //           amount_in_base_units * actualIngredient.servings_multiplier;
    //         actualIngredient.final_amount =
    //           (actualIngredient.amount_in_base_units /
    //             ingredient?.[baseQtyField]) *
    //           ingredient?.[shoppingQtyField];
    //
    //         actualIngredient[shoppingUnitField] = ingredient?.[shoppingUnitField];
    //         actualIngredient.title = ingredient?.title;
    //         actualIngredient.category = ingredient?.category;
    //         return actualIngredient;
    //       }
    //     );
    //
    //     const ingredient_dict = {};
    //     for (const ingredient of ingredientsInBaseUnits) {
    //       if (!ingredient_dict[ingredient.id]) {
    //         ingredient_dict[ingredient.id] = { ...ingredient };
    //       } else {
    //         ingredient_dict[ingredient.id].final_amount +=
    //           ingredient.final_amount;
    //         if (
    //           ingredient.notes &&
    //           !ingredient_dict[ingredient.id]?.notes?.includes(ingredient?.notes)
    //         ) {
    //           ingredient_dict[ingredient.id].notes += `, ${ingredient.notes}`;
    //         }
    //       }
    //     }
    //     const output = Object.values(ingredient_dict).map((ingredient) => ({
    //       ...ingredient,
    //     }));
    //     const mealPlanTitle = await MealPlan.findById(id).select('title').exec();
    //
    //     const data = [
    //       {
    //         category: 'Pantry',
    //         ingredients: [],
    //       },
    //       {
    //         category: 'Produce',
    //         ingredients: [],
    //       },
    //       {
    //         category: 'Refrigerated',
    //         ingredients: [],
    //       },
    //     ];
    //
    //     const results = output.map((ingredient) => {
    //       const obj = {
    //         _id: ingredient.id,
    //         desiredTitle: `${
    //           ingredient.final_amount > 0
    //             ? `${Math.ceil(ingredient.final_amount)} ${
    //                 ingredient[`${unitPreference}_shopping_unit`]
    //               } of ${ingredient.title}`
    //             : `${ingredient.title}`
    //         }`,
    //         title: `${ingredient.title}`,
    //         qty: Math.ceil(ingredient.final_amount),
    //         measurement: ingredient[`${unitPreference}_shopping_unit`],
    //         notes: ingredient.notes || '',
    //         checked: false,
    //       };
    //
    //       if (
    //         ingredient.category.toLowerCase() === data[0].category.toLowerCase()
    //       )
    //         data[0].ingredients.push(obj);
    //       if (
    //         ingredient.category.toLowerCase() === data[1].category.toLowerCase()
    //       )
    //         data[1].ingredients.push(obj);
    //       if (
    //         ingredient.category.toLowerCase() === data[2].category.toLowerCase()
    //       )
    //         data[2].ingredients.push(obj);
    //     });
    //     res.json({ title: mealPlanTitle.title, data });
    //   }
    // } catch (error) {
    //   next(new AppError(error.message, 400));
    // }
});

// ******** GET USER SHOPPING LIST ********
// @desc    Get user shopping list
// @route   GET /api/shoppinglists/user/:id
// @access  Private

const getUserShoppingList = asyncHandler(async (req, res, next) => {
    const {ownerId, mealPlanId} = req.params;
    const shoppingList = await ShoppingList.find({
        owner: ownerId,
        parent_meal_plan: mealPlanId,
    })
        .populate('parent_meal_plan')
        .exec();
    if (shoppingList.length > 0)
        res.json({
            data: shoppingList[0]?.ingredients,
            title: shoppingList[0]?.meal_plan_title,
            _id: shoppingList[0]._id
        });
    else res.json([]);
});

// ******** UPDATE ********

// @desc    Update shoppinglist shoppinglist
// @route   PUT /api/shoppinglists/update_shoppinglist/:id
// @access  Private
const updateShoppingList = asyncHandler(async (req, res, next) => {
    const shoppingList = await ShoppingList.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true,
        }
    );

    // If we don't find the shoppingList, throw an error.
    if (!shoppingList) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json(shoppingList);
});

// ******** DELETE ********

// @desc    Delete shoppinglist
// @route   DELETE /api/shoppinglists/:id
// @access  Private
const deleteShoppingList = asyncHandler(async (req, res, next) => {
    const shoppingList = await ShoppingList.findByIdAndDelete(req.params.id);

    if (!shoppingList) {
        return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
        status: 'success',
        data: null,
    });
});

export {
    createNewShoppingList,
    getMealPlanShoppingList,
    deleteShoppingListOnReset,
    getUserShoppingList,
    updateShoppingList,
    deleteShoppingList,
};
