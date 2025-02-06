const express = require('express')
const router = express.Router()

//all routes
router.use('/', require('./userRoute'))
router.use('/', require('./userWatchRoute'))
router.use('/', require('./userStreakRoute'))
router.use('/', require('./promoCodeRoute'))
router.use('/', require('./cronRoute'))
router.use('/', require('../../src/admin/routes/adminRoute'))
console.log("Admin login route hit"); // Debug log for verification

module.exports = router
