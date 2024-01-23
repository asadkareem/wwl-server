import mongoose from 'mongoose';

export const MealPlanSchema = mongoose.Schema({
	default_shopping_list: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ShoppingList',
	},
	owner: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	is_admin_plan: {
		type: Boolean,
		default: false
	},
	title: {
		type: String,
		required: true,
	},
	primary_image: {
		type: String,
	},
	plan_data: [{
		type: Map,
		required: true,
	}],
	featured_date: {
		type: Date,
		default:  () => new Date()
	},
	tags: [{
		type: String,
	}],
});

const MealPlan = mongoose.model('MealPlan', MealPlanSchema);
export default MealPlan;