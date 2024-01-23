import express from 'express'

const router = express.Router()
import {
    getAllUsers,
    deleteUser,
    getUserById,
    updateUser,
    addRemoveFavorite,
    addRemoveBookmark,
    getSortedUsers,
    searchData,
    sendEmail,
    login,
    loginAdmin,
    migrateUsers
} from '../controllers/userController.js'
import { admin, protect } from '../middleware/authMiddleware.js'

router.route('/login')
    .post(login)

// Admin Login
router.route('/login/admin')
    .post(loginAdmin)


router.route('/all/:pageNum')
    .get(getAllUsers)

router.route('/sorted/:filterKey/:direction/:numPerPage/:pageNum')
    .get(getSortedUsers)

router.route('/get_user/:id')
    .get(getUserById)
router.route('/update_user/:id')
    .put(updateUser)
router.route('/add_favorite')
    .put(addRemoveFavorite)
router.route('/add_bookmark')
    .put(addRemoveBookmark)
router.route('/delete_user/:id')
    .delete(deleteUser)
router.route('/search/:searchTerm/:type/:page')
    .get(searchData)
router.route('/email')
    .post(sendEmail)

router.route('/migrate')
    .get(admin, migrateUsers)

export default router