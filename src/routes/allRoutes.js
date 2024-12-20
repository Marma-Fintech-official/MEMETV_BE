const express = require('express')
const router = express.Router()

//all routes
router.use('/', require('./userRoute'))
router.use('/', require('./userWatchRoute'))
router.use('/', require('./userStreakRoute'))
router.use('/', require('./userVoteRoute'))

module.exports = router
