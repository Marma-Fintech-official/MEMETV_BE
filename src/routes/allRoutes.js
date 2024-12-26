const express = require('express')
const router = express.Router()

//all routes
router.use('/', require('./userRoute'))
router.use('/', require('./userWatchRoute'))

module.exports = router
