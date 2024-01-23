import mongoose from 'mongoose';



export const IngredientSchema = mongoose.Schema({
	old_id: {
		type: Number,
	},
	title: {
		type: String,
		required: true,
		unique: true,
	},
	category: {
		type: String,
		required: true,
	},
	measurement_type: {
		type: String,
	},
	imperial_base_qty: {
		type: Number,
	},
	imperial_base_unit: {
		type: String,
	},
	imperial_shopping_qty: {
		type: Number,
	},
	imperial_shopping_unit: {
		type: String,
	},
	metric_base_qty: {
		type: Number,
	},
	metric_base_unit: {
		type: String,
	},
	metric_shopping_qty: {
		type: Number,
	},
	metric_shopping_unit: {
		type: String,
	},
	tags: [{
		type: String,
	}],
	created_at: {
		type: Date,
		default: Date.now,
	}
});

const Ingredient = mongoose.model('Ingredient', IngredientSchema);
export default Ingredient;