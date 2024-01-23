import mongoose from 'mongoose';

import User from './userModel.js';
import Recipe from './recipeModel.js';


export const RatingSchema = mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: User,
		required: true,
	},
	recipe: {
		type: mongoose.Schema.Types.ObjectId,
		ref: Recipe,
		required: true,
	},
	score: {
		type: Number,
		required: true,
	},
});

const Rating = mongoose.model('Rating', RatingSchema);
export default Rating;