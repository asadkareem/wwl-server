import mongoose from 'mongoose';

import ShoppingList from './shoppinglistModel.js';
import Recipe from './recipeModel.js';

export const UserSchema = mongoose.Schema({
  id: String,
  name: {
    type: String,
    // required: true,
  },
  email: {
    type: String,
    // required: true,
    // unique: true,
  },
  avatar: {
    type: String,
    // required: true,
  },
  memberful_id: {
    type: String,
    // required: true,
  },
  is_active: {
    type: Boolean,
    default: true
  },
  family_size: {
    type: Number,
    default: 1
  },
  is_admin: {
    type: Boolean,
    default: false
  },
  primary_diet: {
    type: String,
    default: "omnivore"
  },
  is_gluten_free: {
    type: Boolean,
    default: false
  },
  is_dairy_free: {
    type: Boolean,
    default: false
  },
  unit_preference: {
    type: String,
    default: "imperial"
  },
  favorite_recipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: Recipe,
  }],
  bookmarked_recipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: Recipe,
  }],
  shopping_lists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: ShoppingList,
  }],
  created_at: {
    type: Date,
    default: Date.now()
  }
});

const User = mongoose.model('User', UserSchema);
export default User;