import mongoose from 'mongoose';

export const RecipeSchema = mongoose.Schema({
	id: {
		type: String,
	},
	title: {
		type: String,
		required: true,
		unique: true,
	},
	is_reviewed: {
		type: Boolean,
		default: false
	},
	is_draft: {
		type: Boolean,
		default: true
	},
	is_public: {
		type: Boolean,
		default: false
	},
	publish_date: {
		type: Date,
		required: true,
	},
	primary_image: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
	average_rating: {
		type: Number,
		default: 4.5
	},
	total_ratings: {
		type: Number,
	},
	dairy_free_instructions: {
		type: String,
	},
	omnivore_instructions: {
		type: String,
	},
	vegan_instructions: {
		type: String,
	},
	vegetarian_instructions: {
		type: String,
	},
	dairy_free_ingredients: [{
		type: Map,
	}],
	omnivore_ingredients: [{
		type: Map,
	}],
	vegan_ingredients: [{
		type: Map,
	}],
	vegetarian_ingredients: [{
		type: Map,
	}],
	prep_time: {
		type: Number,
		required: true,
	},
	cook_time: {
		type: Number,
		required: true,
	},
	servings: {
		type: Number,
		required: true,
	},
	tags: [{
		type: String,
	}],
});

const Recipe = mongoose.model('Recipe', RecipeSchema);
export default Recipe;