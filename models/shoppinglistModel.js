import mongoose from 'mongoose';


export const ShoppingListSchema = mongoose.Schema({
	owner: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	parent_meal_plan: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'MealPlan',
		required: true,
	},
	meal_plan_title: {
		type: String,
	},
	ingredients: [{
		type: Map,
	}],
});

const ShoppingList = mongoose.model('ShoppingList', ShoppingListSchema);
export default ShoppingList;