const express = require('express')
const router = express.Router()
const { errors } = require('celebrate')
const { dailyRewardsForBlockChain } = require('../controllers/cronController')

router.get('/dailyRewardsForBlockChain', dailyRewardsForBlockChain)

router.use(errors())

module.exports = router
