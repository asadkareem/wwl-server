import {mongo} from "mongoose";
import MealPlan from "../models/mealplanModel.js";
import Ingredient from "../models/ingredientModel.js";

// latest

// Function to collect all recipes from a meal plan and sum up their servings in meal plan if recipe repeats
export const collectMealPlanRecipes = async (mealPlanId) => {
    let data = await MealPlan.aggregate([
        {
            $match: {
                _id: mongo.ObjectId(mealPlanId),
            },
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
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $project: {
                plan_data: {
                    meals: {
                        id: 1,
                        servings: 1,
                        diet: 1,
                        isDairyFree: 1,
                        isGlutenFree: 1,
                    },
                },
            },
        },
        {
            $addFields: {
                newId: {
                    $toObjectId: '$plan_data.meals.id',
                },
            },
        },
        {
            $lookup: {
                from: 'recipes',
                localField: 'newId',
                foreignField: '_id',
                as: 'plan_data.meals.recipe',
            },
        },
        {
            $unwind: {
                path: '$plan_data.meals.recipe',
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                plan_data: {
                    meals: {
                        servings: 1,
                        diet: 1,
                        isDairyFree: 1,
                        isGlutenFree: 1,
                        recipe: {
                            _id: 1,
                            title: 1,
                            dairy_free_ingredients: 1,
                            omnivore_ingredients: 1,
                            vegetarian_ingredients: 1,
                            vegan_ingredients: 1,
                            servings: 1,
                        },
                    },
                },
            },
        },
        {
            $group: {
                _id: '$_id',
                recipes: {
                    $push: {
                        meal_plan_servings: '$plan_data.meals.servings',
                        diet: '$plan_data.meals.diet',
                        is_dairy_free: '$plan_data.meals.isDairyFree',
                        is_gluten_free: '$plan_data.meals.isGlutenFree',
                        recipe: '$plan_data.meals.recipe',
                    },
                },
            },
        },
    ])

    const recipes = JSON.parse(JSON.stringify(data[0]?.recipes))

    // Remove empty recipes
    const removedEmptyRecipes = recipes.filter(recipe => Object.keys(recipe).length > 0)
    if (!removedEmptyRecipes) return null


    // Sum up servings of recipes that repeat in meal plan and return unique recipes
    return removedEmptyRecipes.reduce((unique, recipe) => {
        const existingRecipeIndex = unique.findIndex(
            r => r.recipe._id.toString() === recipe.recipe._id.toString() &&
                r.diet.toLowerCase() === recipe.diet.toLowerCase() &&
                r.is_dairy_free === recipe.is_dairy_free &&
                r.is_gluten_free === recipe.is_gluten_free
        );

        if (existingRecipeIndex !== -1) {
            unique[existingRecipeIndex].meal_plan_servings += recipe.meal_plan_servings;
        } else {
            unique.push({...recipe});
        }
        return unique;
    }, [])
}
// Getting Ingredient Lists from Recipes based on Diet Type
export const populateIngredientsForRecipeList = async (recipes) => {
    const finalRecipes = [];
    for (let i = 0; i < recipes.length; i++) {
        const recipe = recipes[i];
        const {diet, is_dairy_free, is_gluten_free} = recipe;
        const dietType = `${diet.toLowerCase()}_`;
        const dairyFree = is_dairy_free ? 'dairy_free_' : '';
        const ingredients = recipe.recipe[`${dairyFree ? dairyFree : dietType}ingredients`];
        let ingredientWithSubstitute = [];
        for (let j = 0; j < ingredients.length; j++) {
            const ingredient = ingredients[j];
            if (is_gluten_free && ingredient.substituteId) {
                const data = await Ingredient.find({old_id: ingredient.substituteId});
                const substitute = JSON.parse(JSON.stringify(data));
                const subsitituteIngredient = {
                    ...ingredient,
                    substitute: substitute[0],
                }
                const convertedIngredients = await convertRecipeIngredientToMetric(subsitituteIngredient, true)
                ingredientWithSubstitute.push(convertedIngredients);
            } else {
                const convertedIngredients = await convertRecipeIngredientToMetric(ingredient)
                ingredientWithSubstitute.push(convertedIngredients);
            }
        }


        finalRecipes.push({
            ...recipe,
            recipe: {
                _id: recipe.recipe._id,
                title: recipe.recipe.title,
                servings: recipe.recipe.servings,
                ingredients: ingredientWithSubstitute,
            }
        })
    }


    return multiplyIngredientsWithServingsMultiplier(finalRecipes);
}

const convertRecipeIngredientToMetric = async (ingredient, substitute = false) => {
    let ingredientInActualUnit = null;
    substitute ? ingredientInActualUnit = ingredient.substitute : ingredientInActualUnit = JSON.parse(JSON.stringify(await Ingredient.findById(ingredient.id)));
    let actualConvertedIngredient = null;
    let metricConversionFactor = null;
    let recipeConvertedIngredient = null;

    // TODO: Modify this for count
    if (ingredientInActualUnit.measurement_type.toLowerCase() !== "count") {
        // This is Calculated Conversion Value
        actualConvertedIngredient = convertToFundamentalUnit(ingredientInActualUnit.measurement_type, (`${ingredientInActualUnit.imperial_base_unit}`) || "count", ingredientInActualUnit.imperial_base_qty);

        metricConversionFactor = ingredientInActualUnit.metric_base_qty / actualConvertedIngredient.value;

        // Convert Recipe Units to the Fundamental Unit
        recipeConvertedIngredient = convertToFundamentalUnit(ingredientInActualUnit.measurement_type, (ingredient.measurement && `${ingredient.measurement}`) || "count", ingredient.qty);
    } else {

        // Handle "count" situation
        return {
            // Ingredient Data
            _id: ingredientInActualUnit && ingredientInActualUnit._id, // id of ingredient
            measurement_type: "count", // type of measurement for ingredient: weight, volume, or count
            title: ingredientInActualUnit && ingredientInActualUnit.title, // title of ingredient
            category: ingredientInActualUnit && ingredientInActualUnit.category, // category of ingredient
            metric_conversion_factor: 1, // Metric conversion factor used to populate metric ingredients
            notes: ingredient.notes, // Any shopping notes which are required to include from the ingredient
            imperial_grams: actualConvertedIngredient && actualConvertedIngredient.value, // Used to calculate imperial to metric conversion factor

            // - Imperial
            imperial_base_qty: ingredientInActualUnit.imperial_base_qty, // base qty for imperial to metric conversions
            imperial_base_unit: ingredientInActualUnit.imperial_base_unit, // base unit for imperial to metric conversions
            imperial_shopping_qty: ingredientInActualUnit.imperial_shopping_qty, // output qty for imperial shopping for conversion from base
            imperial_shopping_unit: ingredientInActualUnit.imperial_shopping_unit, // output unit for shopping

            // - metric
            metric_base_qty: ingredientInActualUnit.metric_base_qty, // base qty for metric conversions
            metric_base_unit: ingredientInActualUnit.metric_base_unit, // base unit for metric
            metric_shopping_qty: ingredientInActualUnit.metric_shopping_qty, // output qty for metric shopping for conversion from base
            metric_shopping_unit: ingredientInActualUnit.metric_shopping_unit, //output unit for metric shopping

            // Recipe Data
            quantity: ingredient.qty, // qty of ingredient listed in recipe
            measurement: ingredient.measurement, // unit described in recipe for ingredient
            recipe_imperial_qty: ingredient.qty, // qty of ingredient listed in recipe in fundamental unit
            recipe_imperial_unit: "Item(s)" || 0, // fundamental unit being used
            recipe_metric_qty: ingredient.qty, // qty of ingredient listed in recipe in fundamental metric unit
            recipe_metric_unit: "Item(s)" || 0, // fundamental metric unit being used
        }
    }

    return {

        // Ingredient
        _id: ingredientInActualUnit && ingredientInActualUnit._id, // id of ingredient
        measurement_type: ingredientInActualUnit.measurement_type, // type of measurement for ingredient: weight, volume, or count
        title: ingredientInActualUnit && ingredientInActualUnit.title, // title of ingredient
        metric_conversion_factor: metricConversionFactor, // Metric conversion factor used to populate metric ingredients
        notes: ingredient.notes, // Any shopping notes which are required to include from the ingredient
        imperial_grams: actualConvertedIngredient && actualConvertedIngredient.value, // Used to calculate imperial to metric conversion factor
        category: ingredientInActualUnit && ingredientInActualUnit.category, // category of ingredient

        // Imperial v Metric
        imperial_base_qty: ingredientInActualUnit.imperial_base_qty, // base qty for imperial to metric conversions
        imperial_base_unit: ingredientInActualUnit.imperial_base_unit, // base unit for imperial to metric conversions
        imperial_shopping_qty: ingredientInActualUnit.imperial_shopping_qty, // output qty for imperial shopping for conversion from base
        imperial_shopping_unit: ingredientInActualUnit.imperial_shopping_unit, // output unit for shopping

        metric_base_qty: ingredientInActualUnit.metric_base_qty, // output unit for shopping
        metric_base_unit: ingredientInActualUnit.metric_base_unit, // base unit for metric
        metric_shopping_unit: ingredientInActualUnit.metric_shopping_unit, //output unit for metric shopping
        metric_shopping_qty: ingredientInActualUnit.metric_shopping_qty, // output qty for metric shopping for conversion from base

        // Recipe
        quantity: ingredient.qty, // qty of ingredient listed in recipe
        measurement: ingredient.measurement, // unit described in recipe for ingredient
        recipe_imperial_qty: (recipeConvertedIngredient && recipeConvertedIngredient.value) || 0, // qty of ingredient listed in recipe in fundamental unit
        recipe_imperial_unit: (recipeConvertedIngredient && recipeConvertedIngredient.unit) || 0, // fundamental unit being used
        recipe_metric_qty: (recipeConvertedIngredient && metricConversionFactor && metricConversionFactor * recipeConvertedIngredient.value) || 0, // qty of ingredient listed in recipe in fundamental metric unit
        recipe_metric_unit: (recipeConvertedIngredient && recipeConvertedIngredient.unit) || 0, // fundamental metric unit being used
    }
}

const multiplyIngredientsWithServingsMultiplier = (recipes) => {
    console.log('multiplyIngredientsWithServingsMultiplier')
    return recipes.map(recipe => {
        const servingsMultiplier = recipe.meal_plan_servings / recipe.recipe.servings;
        return recipe.recipe.ingredients.map(ingredient => {
            return {
                ...ingredient,
                meal_plan_imperial_qty: ingredient.recipe_imperial_qty * servingsMultiplier, // "meal_plan_imperial_qty" --> Units are same as recipe_imperial_qty = recipe_imperial_unit = fundamental unit
                meal_plan_metric_qty: ingredient.recipe_metric_qty * servingsMultiplier,  //  "meal_plan_metric_qty" --> Units are same as recipe_metric_qty = recipe_metric_unit = fundamental unit
            }
        })
    }).flat(1)
}


// Valid units for each measurement type
const volumeUnits = {
    value: 946, // mL
    units: [
        {
            name: 'Cup(s)',
            value: 4,
        },
        {
            name: 'Pint(s)',
            value: 2,
        },
        {
            name: 'Quart(s)',
            value: 1,
        },
        {
            name: 'Gallon(s)',
            value: 0.25,
        },
        {
            name: 'Ounce(s)',
            value: 32,
        },
        {
            name: 'Fluid Ounce(s)',
            value: 32,
        },
        {
            name: 'Tablespoon(s)',
            value: 64,
        },
        {
            name: 'Teaspoon(s)',
            value: 192,
        },
        {
            name: 'Milliliter(s)',
            value: 946,
        }
    ]
}

const weightUnits = {
    value: 453.6, // g
    units: [
        {
            name: 'Teaspoon(s)',
            value: 96,
        },
        {
            name: 'Tablespoon(s)',
            value: 32,
        },
        {
            name: 'Ounce(s)',
            value: 16,
        },
        {
            name: 'Pound(s)',
            value: 1,
        },
        {
            name: 'Cup(s)',
            value: 2,
        },
        {
            name: 'Pint(s)',
            value: 1,
        }
    ]
}

// Unit Conversion Logic
const checkIfValidUnit = (measurement_type, current_unit) => {
    const type = measurement_type.toLowerCase();
    if (!['volume', 'weight', 'count'].includes(type)) {
        return "Invalid measurement type";
    }


    const unit = type === 'volume' ? volumeUnits.units
            .find(
                unit => unit.name.toLowerCase().includes(current_unit.toLowerCase()) || unit.name.toLowerCase() === current_unit.toLowerCase())
        : type === 'weight' ? weightUnits.units.find(unit =>
                unit.name.toLowerCase().includes(current_unit.toLowerCase()) || unit.name.toLowerCase() === current_unit.toLowerCase())
            : null;
    if (!unit) return "Invalid unit";

    return {type, unit};
}

export const convertToFundamentalUnit = (measurement_type, current_unit, qty) => {
    if (qty) {
        const data = checkIfValidUnit(measurement_type, current_unit);
        if (typeof data === 'string') return data;
        const {type, unit} = data;
        switch (type) {
            case 'volume':
                return {unit: 'mL', value: (volumeUnits.value / unit.value) * qty};
            case 'weight':
                return {unit: "g", value: (weightUnits.value / unit.value) * qty};
            case 'count':
                return {unit: current_unit, value: qty};
        }
    } else {
        return {unit: current_unit, value: qty};
    }
}

export const convertFundamentalUnitToTargetUnit = (measurement_type, current_unit, qty, target_unit) => {
    if (current_unit === target_unit) return {unit: target_unit, value: qty};
    const data = checkIfValidUnit(measurement_type, target_unit);
    if (typeof data === 'string') return data;
    const {unit} = data;
    console.log("Data", data)
    console.log("Inputs", measurement_type, current_unit, qty, target_unit);

    switch (current_unit) {
        case 'mL':
        case 'milliliters':
        case 'millilitres':
        case 'Milliliter(s)':
            console.log({unit: target_unit, value: (unit.value / volumeUnits.value) * qty}, "Milliliters")
            return {unit: target_unit, value: (unit.value / volumeUnits.value) * qty};
            break;
        case 'g':
        case 'grams':
        case "Gram(s)":
            return {unit: target_unit, value: (unit.value / weightUnits.value) * qty};
            break;
        case 'count':
            return {unit: target_unit, value: qty};
            break;
    }
}

export const convertShoppingListToStandardFormat = async (ingredients, id, preference) => {
    const data = [
        {
            category: 'Pantry',
            ingredients: [],
        },
        {
            category: 'Produce',
            ingredients: [],
        },
        {
            category: 'Refrigerated',
            ingredients: [],
        },
    ];

    ingredients.map((ingredient) => {
        const obj = {
            _id: ingredient._id,
            desiredTitle: `${ingredient[`final_${preference}_shopping_qty`]} ${
                ingredient[`${preference}_shopping_unit`]
            } of ${ingredient.title}`
            ,
            title: `${ingredient.title}`,
            qty: ingredient[`final_${preference}_shopping_qty`],
            measurement: ingredient[`${preference}_shopping_unit`] === 'g' ? 'Gram(s)' : ingredient[`${preference}_shopping_unit`],
            notes: ingredient.notes.join(',') || '',
            checked: false,
        };

        if (
            ingredient.category.toLowerCase() === data[0].category.toLowerCase()
        )
            data[0].ingredients.push(obj);
        if (
            ingredient.category.toLowerCase() === data[1].category.toLowerCase()
        )
            data[1].ingredients.push(obj);
        if (
            ingredient.category.toLowerCase() === data[2].category.toLowerCase()
        )
            data[2].ingredients.push(obj);
    });
    const mealPlanTitle = await MealPlan.findById(mongo.ObjectId(id)).select('title').exec();
    return {
        title: mealPlanTitle.title,
        data,
    }
}