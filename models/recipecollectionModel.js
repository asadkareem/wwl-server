import mongoose from 'mongoose';
import Recipe from "./recipeModel.js";



export const RecipeCollectionSchema = mongoose.Schema({
	recipes: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: Recipe,
		required: [true, 'Meal Plan is required'],
	}],
	featured_date: {
		type: Date,
		required: true,
	},
	title: {
		type: String,
		required: true,
	},
});

const RecipeCollection = mongoose.model('RecipeCollection', RecipeCollectionSchema);
export default RecipeCollection;