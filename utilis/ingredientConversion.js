import asyncHandler from "express-async-handler";
import Ingredient from "../models/ingredientModel.js";
import {convertFundamentalUnitToTargetUnit, convertToFundamentalUnit} from "./shoppinglistHelperFunctions.js";

export const convertIngredientsToBaseUnit = async (ingredients) => {
  const ingredientsInBaseUnits = []
  for (let i = 0; i < ingredients.length; i++) {
    const {id: {_id}, qty, type, measurement, notes} = ingredients[i];
    const actualIngredient = await Ingredient.findById(_id);

    if (type && type.toLowerCase() === 'whole') {
      ingredientsInBaseUnits.push({
        title: actualIngredient?.title,
        notes: notes || "",
        qty: qty,
        unit: "Item(s)",
      })
    } else {
      if (qty) {
        const measurementFormat = measurement?.charAt(0)?.toUpperCase() + measurement?.slice(1);
        const fundamentalUnit = convertToFundamentalUnit(actualIngredient.measurement_type, `${measurementFormat}(s)`, qty);
        const baseUnit = convertFundamentalUnitToTargetUnit(actualIngredient.measurement_type,
          fundamentalUnit.unit, fundamentalUnit.value, actualIngredient.imperial_base_unit);
        ingredientsInBaseUnits.push({
          id: {
            title: actualIngredient.title,
          },
          notes: notes || "",
          qty: (baseUnit.value / actualIngredient.imperial_base_qty) * actualIngredient.metric_base_qty,
          measurement: actualIngredient.metric_base_unit,
        })
      } else {
        ingredientsInBaseUnits.push({
          title: actualIngredient.title,
          notes: notes || "",
          qty: null,
          unit: null,
        })
      }
    }
  }
  return ingredientsInBaseUnits;
}