import express from 'express'

const router = express.Router()
import {
    createNewRecipeNote,
    deleteRecipeNote,
    getUserRecipeNotesByRecipeId,
    getCommunityRecipeNotesByRecipeId,
    updateRecipeNote,
    migrateRecipeNotes,
    migrateRecipeParentNotesRef
} from '../controllers/recipenoteController.js'
import {admin, protect} from '../middleware/authMiddleware.js'

router.route('/')
    .post(protect, createNewRecipeNote)

router.route('/get_personal/:id/:pageNum')
    .get(protect, getUserRecipeNotesByRecipeId)

router.route('/get_community/:id/:pageNum')
    .get(protect, getCommunityRecipeNotesByRecipeId)

router.route('/update_recipenote/:id')
    .put(protect, updateRecipeNote)
router.route('/delete_recipenote/:id')
    .delete(protect, deleteRecipeNote)
router.route('/migrate')
    .get(protect, admin, migrateRecipeParentNotesRef)

export default router