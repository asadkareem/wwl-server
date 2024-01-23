import mongoose from 'mongoose';

export const RecipeNoteSchema = mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    user_name: {
        type: String,
        required: true,
    },
    recipe_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Recipe",
        required: true,
    },
    parent_note: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RecipeNote",
        default: null,
    },
    note_type: {
        type: String,
        required: true,
    },
    contents: {
        type: String,
        required: true,
    },
    is_pinned: {
        type: Boolean,
        default: false,
    },
    is_flagged: {
        type: Boolean,
        default: false,
    },
});

const RecipeNote = mongoose.model('RecipeNote', RecipeNoteSchema);
export default RecipeNote;